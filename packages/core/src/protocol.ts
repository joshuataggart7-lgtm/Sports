import type { Automation, AutomationRun } from "./automation";
import type { RoomDevice } from "./devices";
import type { DisplayDevice, DisplayPreset } from "./displays";
import type { SportsEvent } from "./events";
import type { Scene } from "./modes";
import type { AgentStatus, BroadcastDelayProfile, Room, TimelineEntry } from "./room";
import type { Game, GameStats, League } from "./sports";

/** Everything a client needs to render, pushed whole on connect and patched afterwards. */
export interface RoomSnapshot {
  room: Room;
  agent: AgentStatus;
  devices: RoomDevice[];
  displays: DisplayDevice[];
  presets: DisplayPreset[];
  scenes: Scene[];
  automations: Automation[];
  delayProfiles: BroadcastDelayProfile[];
  games: Game[];            // today's games from the provider
  /** Stats for watched and displayed games, by game id. */
  stats: Record<string, GameStats>;
  leagues: League[];
  pendingEvents: SportsEvent[];
  recentEvents: SportsEvent[];
  recentRuns: AutomationRun[];
  timeline: TimelineEntry[];
  /** Interest-ranked games for smart multiview. */
  suggestions: Array<{ gameId: string; score: number; reasons: string[] }>;
}

export interface DisplayOverlay {
  kind: "celebration" | "banner" | "alert" | "clear";
  text?: string;
  subtext?: string;
  color?: string;
  until: number;
}

export type ServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "patch"; patch: Partial<RoomSnapshot> }
  | { type: "game"; game: Game }
  | { type: "stats"; stats: GameStats }
  | { type: "event"; event: SportsEvent }
  | { type: "timeline"; entry: TimelineEntry }
  | { type: "overlay"; displayIds: string[] | "all"; overlay: DisplayOverlay }
  | { type: "display"; display: DisplayDevice }
  | { type: "pong"; t: number };

export type ClientMessage =
  | { type: "hello"; role: "app" | "display"; displayId?: string; token?: string }
  | { type: "ping"; t: number };
