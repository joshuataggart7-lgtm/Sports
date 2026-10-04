/**
 * Govee LAN driver (UNVERIFIED). Govee Wi-Fi strips sold at Lowe's, Walmart and Amazon
 * (H619A, H61A0..A3, H6159, H6163, H6172, H6176, H615x, H7060 and more) accept plain UDP
 * commands on the local network once "LAN Control" is switched on in the Govee Home app
 * (device page → settings gear → LAN Control). No cloud, no hub, sub-100 ms response.
 *
 * Protocol: JSON over UDP to <host>:4003; replies come back on UDP 4002. Status is
 * requested with devStatus. Device driverConfig: { host: "192.168.1.70" }.
 * Govee has no built-in effects over LAN, so flash/pulse/chase are driven here by
 * alternating colors for the requested duration.
 */
import dgram from "node:dgram";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

const PORT_CMD = 4003, PORT_REPLY = 4002;

export class GoveeDriver implements DeviceDriver {
  id = "govee";
  private timers = new Map<string, NodeJS.Timeout>();

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const s = await this.status(device); return s ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const s = await this.status(device);
    if (!s) throw new Error(`${device.name} did not answer devStatus`);
    const c = s.color;
    return { power: s.onOff ? "on" : "off", brightness: s.brightness, color: c ? `#${[c.r, c.g, c.b].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : undefined };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": this.stopEffect(device); await this.send(device, "turn", { value: 1 }); return { power: "on" };
      case "power_off": this.stopEffect(device); await this.send(device, "turn", { value: 0 }); return { power: "off", effect: undefined };
      case "set_brightness": await this.send(device, "brightness", { value: Math.max(1, Math.min(100, Math.round(command.brightness))) }); return { brightness: command.brightness, power: "on" };
      case "set_color": this.stopEffect(device); await this.setColor(device, command.color); return { color: command.color, power: "on", effect: undefined };
      case "effect": {
        this.stopEffect(device);
        if (command.effect === "off") { await this.send(device, "turn", { value: 1 }); return { effect: undefined, power: "on" }; }
        const colors = (command.colors?.length ? command.colors : ["#ffffff", "#000000"]).slice(0, 3);
        const period = command.effect === "breathe" ? 1200 : command.effect === "pulse" ? 600 : command.effect === "chase" ? 250 : 180;
        const until = Date.now() + (command.durationMs ?? 4000);
        let i = 0;
        await this.setColor(device, colors[0]);
        const tick = async () => {
          if (Date.now() > until) { this.timers.delete(device.id); return; }
          i = (i + 1) % colors.length;
          try { await this.setColor(device, colors[i]); } catch { /* keep the effect loop alive on a dropped packet */ }
          this.timers.set(device.id, setTimeout(tick, period));
        };
        this.timers.set(device.id, setTimeout(tick, period));
        return { effect: command.effect, power: "on", color: colors[0] };
      }
      default: throw new Error(`Govee cannot ${command.type}`);
    }
  }

  private stopEffect(device: RoomDevice): void { const t = this.timers.get(device.id); if (t) { clearTimeout(t); this.timers.delete(device.id); } }

  private async setColor(device: RoomDevice, hex: string): Promise<void> {
    const [r, g, b] = rgb(hex);
    await this.send(device, "turn", { value: 1 });
    await this.send(device, "colorwc", { color: { r, g, b }, colorTemInKelvin: 0 });
  }

  private host(device: RoomDevice): string { const host = String(device.driverConfig?.host ?? ""); if (!host) throw new Error(`${device.name} has no host`); return host; }

  private send(device: RoomDevice, cmd: string, data: Record<string, unknown>): Promise<void> {
    const host = this.host(device);
    const payload = Buffer.from(JSON.stringify({ msg: { cmd, data } }));
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket("udp4");
      sock.send(payload, PORT_CMD, host, (err) => { sock.close(); err ? reject(err) : resolve(); });
    });
  }

  /** Ask for devStatus and wait up to 1.5 s for the reply on port 4002. */
  private status(device: RoomDevice): Promise<{ onOff: number; brightness: number; color?: { r: number; g: number; b: number } } | undefined> {
    const host = this.host(device);
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
      const done = (v?: { onOff: number; brightness: number; color?: { r: number; g: number; b: number } }) => { clearTimeout(timer); try { sock.close(); } catch { /* already closed */ } resolve(v); };
      const timer = setTimeout(() => done(undefined), 1500);
      sock.on("error", (e) => { clearTimeout(timer); try { sock.close(); } catch { /* ignore */ } reject(e); });
      sock.on("message", (m, rinfo) => {
        if (rinfo.address !== host) return;
        try { const j = JSON.parse(m.toString()) as { msg?: { cmd?: string; data?: { onOff: number; brightness: number; color?: { r: number; g: number; b: number } } } }; if (j.msg?.cmd === "devStatus" && j.msg.data) done(j.msg.data); } catch { /* not ours */ }
      });
      sock.bind(PORT_REPLY, () => {
        const payload = Buffer.from(JSON.stringify({ msg: { cmd: "devStatus", data: {} } }));
        sock.send(payload, PORT_CMD, host, (err) => { if (err) { clearTimeout(timer); try { sock.close(); } catch { /* ignore */ } reject(err); } });
      });
    });
  }
}

function rgb(hex: string): [number, number, number] { const m = /^#?([0-9a-f]{6})$/i.exec(hex); const n = m ? parseInt(m[1], 16) : 0xffffff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
