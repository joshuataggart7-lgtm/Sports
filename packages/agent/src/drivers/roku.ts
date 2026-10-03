/**
 * Roku TV driver (UNVERIFIED) using Roku's External Control Protocol: plain HTTP on port
 * 8060, on by default on every Roku TV (TCL, Element, Hisense...). Device driverConfig:
 * { host: "192.168.1.41" }. Inputs map logical names to Roku input ids:
 * { browser: "tvinput.hdmi1", cable: "tvinput.hdmi2", antenna: "tvinput.dtv" }.
 *
 * Network power-on only works when the TV's "Fast TV Start" is enabled
 * (Settings → System → Power → Fast TV Start). Without it the TV powers off fully and
 * ignores the network until the remote wakes it.
 */
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

export class RokuDriver implements DeviceDriver {
  id = "roku";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const xml = await this.get(device, "/query/device-info"); return xml.includes("<device-info>") ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const xml = await this.get(device, "/query/device-info");
    const mode = /<power-mode>([^<]+)<\/power-mode>/.exec(xml)?.[1];
    const out: Partial<DeviceState> = { power: mode === "PowerOn" ? "on" : "off" };
    try {
      const app = await this.get(device, "/query/active-app");
      const id = /<app id="([^"]+)"/.exec(app)?.[1];
      if (id) out.input = Object.entries(device.inputs ?? {}).find(([, v]) => v === id)?.[0] ?? id;
    } catch { /* fine */ }
    return out;
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": await this.post(device, "/keypress/PowerOn"); return { power: "on" };
      case "power_off": await this.post(device, "/keypress/PowerOff"); return { power: "off" };
      case "set_input": { const id = device.inputs?.[command.input] ?? command.input; await this.post(device, `/launch/${id}`); return { input: command.input, power: "on" }; }
      case "set_volume": {
        // ECP has no absolute volume; step from the last known level.
        const cur = device.state.volume ?? 20, target = Math.max(0, Math.min(100, command.volume));
        const key = target > cur ? "VolumeUp" : "VolumeDown";
        for (let i = 0; i < Math.abs(target - cur); i++) await this.post(device, `/keypress/${key}`);
        return { volume: target };
      }
      default: throw new Error(`Roku cannot ${command.type}`);
    }
  }

  private base(device: RoomDevice): string { const host = String(device.driverConfig?.host ?? ""); if (!host) throw new Error(`${device.name} has no host`); return `http://${host}:8060`; }
  private async get(device: RoomDevice, path: string): Promise<string> { const r = await fetch(this.base(device) + path, { signal: AbortSignal.timeout(3000) }); if (!r.ok) throw new Error(`Roku ${r.status}`); return r.text(); }
  private async post(device: RoomDevice, path: string): Promise<void> { const r = await fetch(this.base(device) + path, { method: "POST", signal: AbortSignal.timeout(3000) }); if (!r.ok) throw new Error(`Roku ${path} -> ${r.status}`); }
}
