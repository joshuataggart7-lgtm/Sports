/**
 * Plays celebration sounds from the agent machine itself. On a Mac this uses the built-in
 * `afplay`; on Linux `mpg123`/`aplay`. Point the Mac's sound output at whatever you like:
 * its own speaker, a USB speaker by the TV, an AirPlay speaker, or a line into the receiver's
 * AUX input. Clips live in packages/agent/sounds/<clip>.(mp3|wav|m4a|aiff).
 * Device driverConfig: { dir?: "/path/to/sounds", volume?: 0-100 }
 * Reports CONNECTED when a player binary exists on this machine.
 */
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(here, "..", "..", "sounds");
const EXT = [".mp3", ".wav", ".m4a", ".aiff", ".aif", ".ogg"];

export class LocalAudioDriver implements DeviceDriver {
  id = "localaudio";
  private player: "afplay" | "mpg123" | "aplay" | null = null;
  private current: ReturnType<typeof spawn> | null = null;

  async connect(devices: RoomDevice[]): Promise<IntegrationStatus> {
    this.player = await this.findPlayer();
    const status: IntegrationStatus = this.player ? "CONNECTED" : "OFFLINE";
    for (const d of devices) d.status = status;
    return devices.length ? status : this.player ? "CONNECTED" : "UNVERIFIED";
  }

  async probe(): Promise<IntegrationStatus> { return (this.player ?? (this.player = await this.findPlayer())) ? "CONNECTED" : "OFFLINE"; }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    if (command.type !== "play_audio") {
      if (command.type === "power_on" || command.type === "power_off") return { power: command.type === "power_on" ? "on" : "off" };
      throw new Error(`local audio cannot ${command.type}`);
    }
    const dir = String(device.driverConfig?.dir ?? DEFAULT_DIR);
    const file = this.resolve(dir, command.clip) ?? this.resolve(dir, "celebration");
    if (!file) throw new Error(`no sound file for "${command.clip}" in ${dir}`);
    if (!this.player) throw new Error("no audio player on this machine (afplay, mpg123 or aplay)");
    const vol = Math.max(0, Math.min(100, command.volume ?? Number(device.driverConfig?.volume ?? 80))) / 100;
    this.current?.kill();
    const args = this.player === "afplay" ? ["-v", String(vol), file] : this.player === "mpg123" ? ["-q", "-f", String(Math.round(vol * 32768)), file] : [file];
    this.current = spawn(this.player, args, { stdio: "ignore" });
    this.current.on("exit", () => { this.current = null; });
    return { playing: command.clip };
  }

  private resolve(dir: string, clip: string): string | undefined {
    if (!clip) return undefined;
    if (path.isAbsolute(clip) && fs.existsSync(clip)) return clip;
    for (const ext of ["", ...EXT]) { const f = path.join(dir, clip + ext); if (fs.existsSync(f)) return f; }
    return undefined;
  }

  private findPlayer(): Promise<"afplay" | "mpg123" | "aplay" | null> {
    const check = (bin: string) => new Promise<boolean>((r) => execFile("which", [bin], (e) => r(!e)));
    return (async () => { for (const b of ["afplay", "mpg123", "aplay"] as const) if (await check(b)) return b; return null; })();
  }
}
