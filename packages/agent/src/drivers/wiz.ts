/**
 * Philips WiZ bulb driver (UNVERIFIED). The $5 WiZ Color bulbs at Walmart and Home Depot speak
 * a documented local protocol: JSON over UDP to <bulb>:38899, reply on the same socket. No cloud,
 * no hub, about 30 ms per command on Wi-Fi.
 *
 * Device driverConfig: { host: "192.168.1.80" } for one bulb, or { hosts: ["…", "…", "…"] } for a
 * ceiling fan with several bulbs that should act as one light (commands fan out concurrently).
 * Bulb IPs show in the WiZ app (device → settings → Device info) or the Orbi device list.
 * WiZ has built-in scenes but no fast color effects, so flash/pulse/chase alternate colors here.
 */
import dgram from "node:dgram";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

const PORT = 38899;

interface Pilot { state?: boolean; r?: number; g?: number; b?: number; c?: number; w?: number; temp?: number; dimming?: number; sceneId?: number }

export class WizDriver implements DeviceDriver {
  id = "wiz";
  private timers = new Map<string, NodeJS.Timeout>();

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const hosts = this.hosts(device); const r = await this.call(hosts[0], "getPilot", {}); return r ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const p = (await this.call(this.hosts(device)[0], "getPilot", {}))?.result as Pilot | undefined;
    if (!p) throw new Error(`${device.name} did not answer getPilot`);
    const out: Partial<DeviceState> = { power: p.state ? "on" : "off", brightness: p.dimming };
    if (p.r !== undefined && p.g !== undefined && p.b !== undefined) out.color = `#${[p.r, p.g, p.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    return out;
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": this.stopEffect(device); await this.all(device, { state: true }); return { power: "on" };
      case "power_off": this.stopEffect(device); await this.all(device, { state: false }); return { power: "off", effect: undefined };
      case "set_brightness": {
        const dimming = Math.max(10, Math.min(100, Math.round(command.brightness))); // WiZ floors at 10%
        if (command.brightness <= 0) { await this.all(device, { state: false }); return { brightness: 0, power: "off" }; }
        await this.all(device, { state: true, dimming }); return { brightness: dimming, power: "on" };
      }
      case "set_color": this.stopEffect(device); await this.all(device, { state: true, ...rgb(command.color) }); return { color: command.color, power: "on", effect: undefined };
      case "effect": {
        this.stopEffect(device);
        if (command.effect === "off") { await this.all(device, { state: true }); return { effect: undefined, power: "on" }; }
        const colors = (command.colors?.length ? command.colors : ["#ffffff", "#000000"]).slice(0, 3);
        // Bulbs are slower than strips: keep the fastest alternation at 300 ms so frames do not pile up.
        const period = command.effect === "breathe" ? 1500 : command.effect === "pulse" ? 700 : command.effect === "chase" ? 400 : 300;
        const until = Date.now() + (command.durationMs ?? 4000);
        let i = 0;
        await this.all(device, { state: true, ...rgb(colors[0]) });
        const tick = async () => {
          if (Date.now() > until) { this.timers.delete(device.id); return; }
          i = (i + 1) % colors.length;
          try { await this.all(device, { state: true, ...rgb(colors[i]) }); } catch { /* keep the loop alive on a dropped packet */ }
          this.timers.set(device.id, setTimeout(tick, period));
        };
        this.timers.set(device.id, setTimeout(tick, period));
        return { effect: command.effect, power: "on", color: colors[0] };
      }
      default: throw new Error(`WiZ cannot ${command.type}`);
    }
  }

  private stopEffect(device: RoomDevice): void { const t = this.timers.get(device.id); if (t) { clearTimeout(t); this.timers.delete(device.id); } }

  private hosts(device: RoomDevice): string[] {
    const cfg = device.driverConfig ?? {};
    const list = Array.isArray(cfg.hosts) ? cfg.hosts.map(String).filter(Boolean) : [];
    if (typeof cfg.host === "string" && cfg.host) list.unshift(cfg.host);
    if (!list.length) throw new Error(`${device.name} has no host`);
    return [...new Set(list)];
  }

  /** setPilot on every bulb of the device at once; one dead bulb does not fail the others. */
  private async all(device: RoomDevice, params: Pilot): Promise<void> {
    const results = await Promise.allSettled(this.hosts(device).map((h) => this.call(h, "setPilot", { ...params })));
    if (results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
  }

  private call(host: string, method: string, params: Record<string, unknown>): Promise<{ result?: Record<string, unknown>; error?: unknown } | undefined> {
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket("udp4");
      const done = (v?: { result?: Record<string, unknown> }) => { clearTimeout(timer); try { sock.close(); } catch { /* closed */ } resolve(v); };
      const timer = setTimeout(() => done(undefined), 1200);
      sock.on("error", (e) => { clearTimeout(timer); try { sock.close(); } catch { /* ignore */ } reject(e); });
      sock.on("message", (m) => { try { done(JSON.parse(m.toString())); } catch { done(undefined); } });
      sock.send(Buffer.from(JSON.stringify({ method, params })), PORT, host, (err) => { if (err) { clearTimeout(timer); try { sock.close(); } catch { /* ignore */ } reject(err); } });
    });
  }
}

function rgb(hex: string): { r: number; g: number; b: number } { const m = /^#?([0-9a-f]{6})$/i.exec(hex); const n = m ? parseInt(m[1], 16) : 0xffffff; return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
