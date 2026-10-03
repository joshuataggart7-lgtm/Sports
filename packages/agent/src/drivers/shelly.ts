/**
 * Shelly relay driver (UNVERIFIED). Shelly Plus 1 / 1PM / 2PM and the older Shelly 1 expose a
 * local HTTP API with no cloud and no hub. Use it for: a fog machine trigger (relay wired
 * across the machine's remote-button contacts), a goal light or air horn on a smart plug, a
 * 12 V screen trigger, or a confetti cannon. Device driverConfig: { host: "192.168.1.70",
 * channel?: 0, gen?: 1 | 2 } (gen 2 is the "Plus"/"Pro" line and the default).
 */
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

export class ShellyDriver implements DeviceDriver {
  id = "shelly";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const r = await this.get(device, "/shelly"); return r && ("id" in r || "type" in r) ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const ch = Number(device.driverConfig?.channel ?? 0);
    if (this.gen(device) === 1) { const r = await this.get(device, `/relay/${ch}`); return { power: r.ison ? "on" : "off" }; }
    const r = await this.get(device, `/rpc/Switch.GetStatus?id=${ch}`);
    return { power: r.output ? "on" : "off" };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    const ch = Number(device.driverConfig?.channel ?? 0);
    const g1 = this.gen(device) === 1;
    switch (command.type) {
      case "power_on": await this.get(device, g1 ? `/relay/${ch}?turn=on` : `/rpc/Switch.Set?id=${ch}&on=true`); return { power: "on" };
      case "power_off": await this.get(device, g1 ? `/relay/${ch}?turn=off` : `/rpc/Switch.Set?id=${ch}&on=false`); return { power: "off" };
      case "pulse": {
        const sec = Math.max(0.1, (command.durationMs ?? 1000) / 1000);
        // The relay times itself off, so a dropped network packet can never leave a fog machine running.
        await this.get(device, g1 ? `/relay/${ch}?turn=on&timer=${sec}` : `/rpc/Switch.Set?id=${ch}&on=true&toggle_after=${sec}`);
        return { playing: `pulse ${sec}s` };
      }
      case "screen_up": await this.get(device, g1 ? `/roller/0?go=open` : `/rpc/Cover.Open?id=0`); return { screenPosition: "up" };
      case "screen_down": await this.get(device, g1 ? `/roller/0?go=close` : `/rpc/Cover.Close?id=0`); return { screenPosition: "down" };
      default: throw new Error(`Shelly cannot ${command.type}`);
    }
  }

  private gen(device: RoomDevice): number { return Number(device.driverConfig?.gen ?? 2); }
  private async get(device: RoomDevice, path: string): Promise<Record<string, unknown>> {
    const host = String(device.driverConfig?.host ?? "");
    if (!host) throw new Error(`${device.name} has no host`);
    const r = await fetch(`http://${host}${path}`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`Shelly ${path} -> ${r.status}`);
    return (await r.json().catch(() => ({}))) as Record<string, unknown>;
  }
}
