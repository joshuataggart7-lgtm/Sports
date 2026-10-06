/**
 * macOS Shortcuts driver (UNVERIFIED): switches anything Apple Home can reach, which includes
 * every Matter plug (Tapo TP15, P125M, Eve, Meross) paired through an Apple TV or HomePod. The
 * agent runs the Mac's own `shortcuts run "<name>"`; the Shortcut holds a Home action
 * ("Control Smoke Screen: Turn On"). Local over Matter, about a second end to end.
 *
 * Device driverConfig: { on: "Smoke Screen On", off: "Smoke Screen Off" }
 * Make both Shortcuts in the Shortcuts app on the Mac (same Apple ID as the Home).
 * `pulse` runs on, waits, runs off; capped at 30 s so a lost "off" never leaves a horn running.
 */
import { execFile } from "node:child_process";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

const run = (args: string[], timeoutMs = 8000) => new Promise<string>((resolve, reject) => {
  execFile("shortcuts", args, { timeout: timeoutMs }, (err, stdout, stderr) => err ? reject(new Error((stderr || err.message).trim())) : resolve(String(stdout)));
});

export class ShortcutsDriver implements DeviceDriver {
  id = "shortcuts";
  private names: Set<string> | null = null;
  private pulses = new Map<string, NodeJS.Timeout>();

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    let any: IntegrationStatus = "OFFLINE";
    for (const d of devices) { d.status = await this.probe(d); if (d.status === "CONNECTED") any = "CONNECTED"; }
    if (!devices.length) return (await this.list()) ? "UNVERIFIED" : "OFFLINE";
    return any;
  }

  /** CONNECTED when both named Shortcuts exist on this Mac. */
  async probe(device: RoomDevice): Promise<IntegrationStatus> {
    const names = await this.list(true);
    if (!names) return "OFFLINE";
    const on = String(device.driverConfig?.on ?? ""), off = String(device.driverConfig?.off ?? "");
    return on && off && names.has(on) && names.has(off) ? "CONNECTED" : "OFFLINE";
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    const on = String(device.driverConfig?.on ?? ""), off = String(device.driverConfig?.off ?? "");
    if (!on || !off) throw new Error(`${device.name} needs "on" and "off" Shortcut names`);
    switch (command.type) {
      case "power_on": this.cancelPulse(device); await run(["run", on]); return { power: "on" };
      case "power_off": this.cancelPulse(device); await run(["run", off]); return { power: "off", playing: null };
      case "pulse": {
        this.cancelPulse(device);
        const ms = Math.min(30_000, Math.max(300, command.durationMs ?? 1000));
        await run(["run", on]);
        this.pulses.set(device.id, setTimeout(() => { this.pulses.delete(device.id); run(["run", off]).catch(() => undefined); }, ms));
        return { power: "on", playing: `pulse ${(ms / 1000).toFixed(1)}s` };
      }
      default: throw new Error(`Shortcuts cannot ${command.type}`);
    }
  }

  private cancelPulse(device: RoomDevice): void { const t = this.pulses.get(device.id); if (t) { clearTimeout(t); this.pulses.delete(device.id); } }

  private async list(fresh = false): Promise<Set<string> | null> {
    if (this.names && !fresh) return this.names;
    try { this.names = new Set((await run(["list"])).split("\n").map((s) => s.trim()).filter(Boolean)); return this.names; }
    catch { return null; }
  }
}
