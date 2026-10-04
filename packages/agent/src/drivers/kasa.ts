/**
 * TP-Link Kasa / Tapo plug driver (UNVERIFIED). The $7-a-plug route: Kasa EP10/HS103/EP25/KP125
 * and Tapo P100/P105/P125 all sold at Walmart, Lowe's and Amazon in 4-packs. They answer on the
 * local network; newer firmware needs your TP-Link account email + password for the local
 * handshake (nothing goes to the cloud, the credentials only unlock the plug).
 *
 * Uses the python-kasa command line tool on the agent machine, which speaks every TP-Link
 * protocol variant: `brew install pipx && pipx install python-kasa` on a Mac (start-mac.sh
 * does this). Device driverConfig: { host: "192.168.1.80", username?: "you@x.com", password?: "..." }.
 * `pulse` is on → wait → off in software; use a Shelly relay where a stuck-on would matter.
 */
import { execFile } from "node:child_process";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

function run(args: string[], timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("kasa", args, { timeout: timeoutMs, env: { ...process.env, PATH: `${process.env.PATH ?? ""}:${process.env.HOME ?? ""}/.local/bin:/opt/homebrew/bin:/usr/local/bin` } }, (err, stdout, stderr) => {
      if (err) return reject(new Error((err as NodeJS.ErrnoException).code === "ENOENT" ? "python-kasa is not installed on the agent machine (pipx install python-kasa)" : (stderr || err.message).trim()));
      resolve(String(stdout));
    });
  });
}

export class KasaDriver implements DeviceDriver {
  id = "kasa";
  private pulses = new Map<string, NodeJS.Timeout>();

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const out = await this.kasa(device, ["state"]); return /Device state:\s*(ON|OFF)/i.test(out) ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const out = await this.kasa(device, ["state"]);
    const m = /Device state:\s*(ON|OFF)/i.exec(out);
    if (!m) throw new Error(`${device.name}: could not read state`);
    return { power: m[1].toUpperCase() === "ON" ? "on" : "off" };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": this.cancelPulse(device); await this.kasa(device, ["on"]); return { power: "on" };
      case "power_off": this.cancelPulse(device); await this.kasa(device, ["off"]); return { power: "off" };
      case "pulse": {
        this.cancelPulse(device);
        const ms = Math.max(200, Math.min(60_000, command.durationMs ?? 1000));
        await this.kasa(device, ["on"]);
        this.pulses.set(device.id, setTimeout(() => { this.pulses.delete(device.id); void this.kasa(device, ["off"]).catch(() => undefined); }, ms));
        return { power: "on", playing: `pulse ${(ms / 1000).toFixed(1)}s` };
      }
      default: throw new Error(`Kasa cannot ${command.type}`);
    }
  }

  private cancelPulse(device: RoomDevice): void { const t = this.pulses.get(device.id); if (t) { clearTimeout(t); this.pulses.delete(device.id); } }

  private kasa(device: RoomDevice, cmd: string[]): Promise<string> {
    const host = String(device.driverConfig?.host ?? "");
    if (!host) throw new Error(`${device.name} has no host`);
    const u = device.driverConfig?.username ? ["--username", String(device.driverConfig.username)] : [];
    const p = device.driverConfig?.password ? ["--password", String(device.driverConfig.password)] : [];
    return run(["--host", host, ...u, ...p, ...cmd]);
  }
}
