/**
 * Onkyo / Integra / newer Pioneer receiver driver (UNVERIFIED). Uses the eISCP protocol
 * every networked Onkyo has spoken since about 2010: TCP port 60128, ASCII commands in a
 * small binary frame. Device driverConfig: { host: "192.168.1.30" }
 * Inputs map logical names to eISCP source codes, e.g. { appletv: "10", game: "02", tv_arc: "12", music: "2B" }
 * Common codes: 01 CBL/SAT, 02 GAME, 03 AUX, 05 PC, 10 BD/DVD, 11 STRM BOX, 12 TV, 2B NET, 2E Bluetooth.
 */
import net from "node:net";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

function frame(cmd: string): Buffer {
  const data = Buffer.from(`!1${cmd}\r`, "ascii");
  const header = Buffer.alloc(16);
  header.write("ISCP", 0, "ascii");
  header.writeUInt32BE(16, 4);
  header.writeUInt32BE(data.length, 8);
  header[12] = 1;
  return Buffer.concat([header, data]);
}

function parse(buf: Buffer): string[] {
  const out: string[] = [];
  let i = 0;
  while (i + 16 <= buf.length && buf.toString("ascii", i, i + 4) === "ISCP") {
    const len = buf.readUInt32BE(i + 8);
    out.push(buf.toString("ascii", i + 16, i + 16 + len).replace(/^!1/, "").replace(/[\r\n\x1a]+$/, ""));
    i += 16 + len;
  }
  return out;
}

export class OnkyoDriver implements DeviceDriver {
  id = "onkyo";

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    return devices.length ? any : "UNVERIFIED";
  }

  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    try { const r = await this.send(device, "PWRQSTN"); return r.some((x) => x.startsWith("PWR")) ? "CONNECTED" : "OFFLINE"; } catch { return "OFFLINE"; }
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const out: Partial<DeviceState> = {};
    for (const [q, apply] of [["PWRQSTN", (v: string) => { out.power = v === "01" ? "on" : "off"; }], ["MVLQSTN", (v: string) => { out.volume = Math.round((parseInt(v, 16) / 100) * 100); }], ["SLIQSTN", (v: string) => { const name = Object.entries(device.inputs ?? {}).find(([, code]) => code.toUpperCase() === v.toUpperCase())?.[0]; out.input = name ?? v; }]] as const) {
      try { for (const r of await this.send(device, q)) if (r.startsWith(q.slice(0, 3))) apply(r.slice(3)); } catch { /* partial state is fine */ }
    }
    return out;
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    switch (command.type) {
      case "power_on": await this.send(device, "PWR01"); return { power: "on" };
      case "power_off": await this.send(device, "PWR00"); return { power: "off", playing: null };
      case "set_input": {
        // Only switch to inputs we have a real code for; an unmapped name would land on a dead source and black out the TV.
        const code = device.inputs?.[command.input];
        if (!code) throw new Error(`no Onkyo input code for "${command.input}" yet; set it in the device's inputs`);
        await this.send(device, `SLI${code.toUpperCase().padStart(2, "0")}`); return { input: command.input, power: "on" };
      }
      case "set_volume": { const v = Math.max(0, Math.min(100, Math.round(command.volume))); await this.send(device, `MVL${v.toString(16).toUpperCase().padStart(2, "0")}`); return { volume: v }; }
      case "play_audio": return { playing: command.clip }; // celebration audio plays from the Apple TV / a speaker; the receiver only routes it
      default: throw new Error(`Onkyo cannot ${command.type}`);
    }
  }

  private send(device: RoomDevice, cmd: string): Promise<string[]> {
    const host = String(device.driverConfig?.host ?? "");
    const port = Number(device.driverConfig?.port ?? 60128);
    if (!host) return Promise.reject(new Error(`${device.name} has no host`));
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host, port });
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => { sock.destroy(); const got = parse(Buffer.concat(chunks)); got.length ? resolve(got) : reject(new Error("eISCP timeout")); }, 1500);
      sock.on("connect", () => sock.write(frame(cmd)));
      sock.on("data", (d: Buffer) => { chunks.push(Buffer.from(d)); if (!cmd.endsWith("QSTN")) { clearTimeout(timer); sock.end(); resolve(parse(Buffer.concat(chunks))); } });
      sock.on("error", (e) => { clearTimeout(timer); reject(e); });
      sock.on("close", () => { clearTimeout(timer); resolve(parse(Buffer.concat(chunks))); });
    });
  }
}
