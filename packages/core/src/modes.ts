import type { DeviceAction, DisplayAction } from "./automation";
import type { DisplayRole } from "./displays";

export const ROOM_MODES = ["SPORTS", "MOVIE", "MULTIVIEW", "WORK", "GAME_DAY", "PARTY", "AMBIENT", "ALL_OFF"] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

export const MODE_LABELS: Record<RoomMode, string> = {
  SPORTS: "Sports", MOVIE: "Movie", MULTIVIEW: "Multiview", WORK: "Work", GAME_DAY: "Game Day",
  PARTY: "Party", AMBIENT: "Ambient", ALL_OFF: "All Off",
};

export interface SceneAction {
  action: DeviceAction | DisplayAction | { roleAssignment: { displayId?: string; displayKind?: string; role: DisplayRole; roleOptions?: Record<string, unknown> } } | { preset: string };
  /** Offset from scene start; the orchestrator runs actions in order of delay. */
  delayMs: number;
  label?: string;
}

export interface Scene {
  id: string;
  roomId: string;
  name: string;
  mode?: RoomMode;
  actions: SceneAction[];
  /** While this scene's mode is active, sports automations are suppressed. */
  suppressSportsAutomations?: boolean;
}
