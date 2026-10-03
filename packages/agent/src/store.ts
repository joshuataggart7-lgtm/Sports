/**
 * RoomStore is the persistence boundary. Today: a JSON file next to the agent (LOCAL).
 * Tomorrow: a Supabase adapter with the same interface (see supabase/migrations). The
 * orchestrator never touches storage details, which is what keeps "cloud decides what,
 * room agent decides how" a deployment choice rather than a rewrite.
 */
import fs from "node:fs";
import path from "node:path";
import type { Automation, AutomationRun, BroadcastDelayProfile, DisplayDevice, DisplayPreset, Room, RoomDevice, Scene, TimelineEntry } from "@room/core";

export interface RoomData {
  room: Room;
  devices: RoomDevice[];
  displays: DisplayDevice[];
  presets: DisplayPreset[];
  scenes: Scene[];
  automations: Automation[];
  delayProfiles: BroadcastDelayProfile[];
  timeline: TimelineEntry[];
  runs: AutomationRun[];
}

export interface RoomStore {
  load(): Promise<RoomData>;
  save(data: RoomData): Promise<void>;
  readonly kind: "LOCAL_JSON" | "SUPABASE";
}

export class JsonFileStore implements RoomStore {
  readonly kind = "LOCAL_JSON" as const;
  private timer: NodeJS.Timeout | null = null;
  private pending: RoomData | null = null;
  constructor(private file: string, private seed: () => RoomData) {}

  async load(): Promise<RoomData> {
    if (fs.existsSync(this.file)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.file, "utf8")) as RoomData;
        // Devices always boot as not-yet-connected; drivers report real status on connect.
        for (const d of data.devices) d.status = d.driver === "mock" ? "SIMULATED" : "OFFLINE";
        return data;
      } catch (e) {
        console.warn(`[store] ${this.file} unreadable (${(e as Error).message}); reseeding`);
      }
    }
    const data = this.seed();
    await this.save(data);
    return data;
  }

  /** Debounced write; the agent saves often and the file must stay consistent. */
  async save(data: RoomData): Promise<void> {
    this.pending = data;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const d = this.pending!;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const trimmed = { ...d, timeline: d.timeline.slice(-500), runs: d.runs.slice(-200) };
      fs.writeFileSync(this.file, JSON.stringify(trimmed, null, 2));
    }, 300);
  }

  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.pending) { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.pending, null, 2)); }
  }
}
