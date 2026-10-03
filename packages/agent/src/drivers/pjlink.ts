/**
 * PJLink projector driver (UNVERIFIED). PJLink is the vendor-neutral network protocol
 * most Epson, Sony, Panasonic, BenQ, Optoma and NEC projectors speak on TCP 4352.
 * Device driverConfig: { host: "192.168.1.50", port?: 4352, password?: "..." }
 * Inputs map logical names to PJLink input codes, e.g. { ribbon: "31", appletv: "32" }
 * (3x = digital/HDMI, 1x = RGB, 2x = video). Status is per device: a projector that
 * answers the POWR query reports CONNECTED, otherwise OFFLINE.
 */
import net from "node:net";
import { createHash } from "node:crypto";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

export class PjLinkDriver implements DeviceDriver {
  id = "pjlink";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const r = await this.send(device, "%1POWR ?"); return /POWR=[0-3]/.test(r) ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const r = await this.send(device, "%1POWR ?");
    const m = /POWR=(\d)/.exec(r);
    return { power: m ? (m[1] === "1" ? "on" : m[1] === "0" ? "off" : "unknown") : "unknown" };
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": this.ok(await this.send(device, "%1POWR 1")); return { power: "on" };
      case "power_off": this.ok(await this.send(device, "%1POWR 0")); return { power: "off" };
      case "set_input": { const code = device.inputs?.[command.input] ?? command.input; this.ok(await this.send(device, `%1INPT ${code}`)); return { input: command.input }; }
      default: throw new Error(`PJLink cannot ${command.type}`);
    }
  }

  private ok(r: string): void { if (!/=OK/.test(r)) throw new Error(`projector answered ${r.trim()}`); }

  /** One command per connection, as the protocol expects. Handles the optional MD5 auth handshake. */
  private send(device: RoomDevice, cmd: string): Promise<string> {
    const host = String(device.driverConfig?.host ?? "");
    const port = Number(device.driverConfig?.port ?? 4352);
    const password = String(device.driverConfig?.password ?? "");
    if (!host) return Promise.reject(new Error(`${device.name} has no host`));
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host, port });
      let buf = "", sent = false;
      const timer = setTimeout(() => { sock.destroy(); reject(new Error("PJLink timeout")); }, 4000);
      sock.on("data", (d) => {
        buf += d.toString();
        if (!sent && buf.includes("\r")) {
          const hello = buf.split("\r")[0];
          buf = buf.slice(hello.length + 1);
          let prefix = "";
          if (/^PJLINK 1 /.test(hello)) prefix = createHash("md5").update(hello.split(" ")[2] + password).digest("hex");
          sock.write(`${prefix}${cmd}\r`);
          sent = true;
        } else if (sent && buf.includes("\r")) { clearTimeout(timer); sock.end(); resolve(buf); }
      });
      sock.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
  }
}
