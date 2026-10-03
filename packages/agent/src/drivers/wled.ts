/**
 * WLED LED strip driver (UNVERIFIED). WLED runs on cheap ESP32 controllers and exposes a
 * JSON API at http://<host>/json/state. Great for TV bias lighting and room accent strips.
 * Device driverConfig: { host: "192.168.1.60" }
 */
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

const EFFECTS: Record<string, number> = { off: 0, flash: 1, breathe: 2, pulse: 2, chase: 28 }; // WLED effect ids: 0 solid, 1 blink, 2 breathe, 28 chase

export class WledDriver implements DeviceDriver {
  id = "wled";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const r = await this.get(device); return typeof r.on === "boolean" ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const r = await this.get(device);
    const seg = (r.seg as Array<{ col?: number[][] }> | undefined)?.[0];
    const c = seg?.col?.[0];
    return { power: r.on ? "on" : "off", brightness: Math.round((Number(r.bri ?? 0) / 255) * 100), color: c ? `#${c.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("")}` : undefined };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": await this.post(device, { on: true }); return { power: "on" };
      case "power_off": await this.post(device, { on: false }); return { power: "off", effect: undefined };
      case "set_brightness": await this.post(device, { on: command.brightness > 0, bri: Math.round((command.brightness / 100) * 255) }); return { brightness: command.brightness, power: command.brightness > 0 ? "on" : "off" };
      case "set_color": await this.post(device, { on: true, transition: Math.round((command.transitionMs ?? 500) / 100), seg: [{ col: [rgb(command.color)], fx: 0 }] }); return { color: command.color, power: "on", effect: undefined };
      case "effect": {
        const fx = EFFECTS[command.effect] ?? 0;
        const cols = (command.colors ?? []).slice(0, 3).map(rgb);
        await this.post(device, { on: true, seg: [{ fx, sx: 180, ix: 128, ...(cols.length ? { col: cols } : {}) }] });
        return { effect: command.effect === "off" ? undefined : command.effect, power: "on" };
      }
      default: throw new Error(`WLED cannot ${command.type}`);
    }
  }

  private url(device: RoomDevice): string { const host = String(device.driverConfig?.host ?? ""); if (!host) throw new Error(`${device.name} has no host`); return `http://${host}/json/state`; }
  private async get(device: RoomDevice): Promise<Record<string, unknown>> { const r = await fetch(this.url(device), { signal: AbortSignal.timeout(3000) }); return (await r.json()) as Record<string, unknown>; }
  private async post(device: RoomDevice, body: Record<string, unknown>): Promise<void> { const r = await fetch(this.url(device), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) }); if (!r.ok) throw new Error(`WLED ${r.status}`); }
}

function rgb(hex: string): number[] { const m = /^#?([0-9a-f]{6})$/i.exec(hex); const n = m ? parseInt(m[1], 16) : 0xffffff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
