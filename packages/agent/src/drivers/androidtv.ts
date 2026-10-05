/**
 * Android TV driver over ADB (UNVERIFIED). For XGIMI projectors (Horizon Pro, MoGo 2 Plus),
 * Chromecast/Google TV boxes and any Android TV with network debugging enabled:
 * Settings → Device Preferences → About → tap "Build" seven times → Developer options →
 * Network debugging (or USB debugging + "ADB over network") → On. Accept the RSA prompt
 * on the device the first time the agent connects.
 *
 * Needs the `adb` binary on the agent machine: `brew install android-platform-tools` on a
 * Mac, `apt install adb` on Linux. Device driverConfig: { host: "192.168.1.52", port?: 5555,
 * browser?: "com.android.chrome" }. Inputs map logical names to HDMI numbers or an
 * explicit `am start` intent: { ribbon: "hdmi1", appletv: "hdmi2" }.
 */
import { execFile } from "node:child_process";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

const KEY = { WAKEUP: 224, SLEEP: 223, POWER: 26, HDMI1: 243, HDMI2: 244, HDMI3: 245, HDMI4: 246, HOME: 3 } as const;

function adb(args: string[], timeoutMs = 6000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("adb", args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) return reject(new Error((err as NodeJS.ErrnoException).code === "ENOENT" ? "adb is not installed on the agent machine" : (stderr || err.message).trim()));
      resolve(String(stdout).trim());
    });
  });
}

export class AndroidTvDriver implements DeviceDriver {
  id = "androidtv";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const model = await this.shell(device, ["getprop", "ro.product.model"]); return model ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const out = await this.shell(device, ["dumpsys", "power"]);
    const awake = /mWakefulness=Awake|Display Power: state=ON/.test(out);
    return { power: awake ? "on" : "off" };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": await this.shell(device, ["input", "keyevent", String(KEY.WAKEUP)]); return { power: "on" };
      case "power_off": await this.shell(device, ["input", "keyevent", String(KEY.SLEEP)]); return { power: "off" };
      case "set_input": {
        const target = device.inputs?.[command.input] ?? command.input;
        const m = /^hdmi([1-4])$/i.exec(target);
        if (m) await this.shell(device, ["input", "keyevent", String([KEY.HDMI1, KEY.HDMI2, KEY.HDMI3, KEY.HDMI4][Number(m[1]) - 1])]);
        else await this.shell(device, ["am", "start", ...target.split(" ")]);
        return { input: command.input, power: "on" };
      }
      case "open_url": {
        const browser = device.driverConfig?.browser ? ["-n", String(device.driverConfig.browser)] : [];
        await this.shell(device, ["am", "start", "-a", "android.intent.action.VIEW", "-d", command.url, ...browser]);
        // A D-pad press a few seconds later counts as the user gesture that lets the page go full
        // screen and hides the browser's address bar.
        setTimeout(() => { void this.shell(device, ["input", "keyevent", "20"]).catch(() => undefined); }, 5000);
        return { url: command.url, power: "on" };
      }
      default: throw new Error(`Android TV cannot ${command.type}`);
    }
  }

  private async shell(device: RoomDevice, cmd: string[]): Promise<string> {
    const host = String(device.driverConfig?.host ?? "");
    if (!host) throw new Error(`${device.name} has no host`);
    const serial = `${host}:${Number(device.driverConfig?.port ?? 5555)}`;
    await adb(["connect", serial], 4000);
    return adb(["-s", serial, "shell", ...cmd]);
  }
}
