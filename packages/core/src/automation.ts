import type { DeviceCommand } from "./devices";
import type { DisplayRole } from "./displays";
import type { SportsEventType } from "./events";

/** Who an action is aimed at. Resolved by the orchestrator at run time. */
export type ActionTarget =
  | { device: string }
  | { group: string }
  | { deviceType: string }
  | { displayRole: DisplayRole }
  | { display: string };

export interface DeviceAction {
  target: ActionTarget;
  command: DeviceCommand;
  /** Choreography offset from the start of this step. */
  delayMs?: number;
}

/** Display-level actions that are not device commands: show an overlay, change a role temporarily. */
export interface DisplayAction {
  target: { displayRole: DisplayRole } | { display: string } | { all: true };
  overlay: { kind: "celebration" | "banner" | "alert" | "clear"; text?: string; subtext?: string; color?: string; color2?: string; logoUrl?: string; durationMs?: number };
  delayMs?: number;
}

export type AutomationStep =
  | { kind: "do"; actions: Array<DeviceAction | DisplayAction>; label?: string }
  | { kind: "wait"; ms: number | "broadcast_delay"; label?: string }
  | { kind: "if"; condition: AutomationCondition; then: AutomationStep[]; else?: AutomationStep[] }
  | { kind: "restore"; what?: "lights" | "displays" | "audio" | "all" }
  | { kind: "scene"; sceneId: string };

export type AutomationCondition =
  | { mode: string[] }                       // current room mode is one of
  | { team: string[] }                       // event team abbreviation in
  | { minPoints: number }                    // event data.points >= n
  | { scoreDiffAtMost: number }              // close game
  | { period: number[] }                     // event data.period in (halftime = PERIOD_END with period 2)
  | { minImportance: number }                // event.context.importance >= n
  | { minPressure: number }                  // event.context.pressure >= n
  | { primaryGame: boolean }                 // event is (not) from the primary watched game
  | { rivalry: boolean }
  | { flag: string }                         // event.data[flag] is truthy
  | { not: AutomationCondition };

export interface AutomationTrigger {
  eventTypes: SportsEventType[];
  /**
   * Only for these teams (abbreviations). Empty = any. Two special entries: "@favorites" matches
   * any of the room's favorite teams, "@opponents" matches a team that is not a favorite.
   */
  teams?: string[];
  /** Only the watched game(s). Default true. */
  watchedGamesOnly?: boolean;
  /** Also fire for manual events. Default true. */
  manual?: boolean;
  /**
   * Which watched games can fire this. "primary" (default): only the first watched game, which
   * owns the physical room. "secondary": only the other watched games, for display-only notices.
   * "any": both.
   */
  games?: "primary" | "secondary" | "any";
}

export interface Automation {
  id: string;
  roomId: string;
  name: string;
  /** Seed revision; a saved copy with a lower version is replaced on load (user edits bump it). */
  version?: number;
  enabled: boolean;
  trigger: AutomationTrigger;
  steps: AutomationStep[];
  /** Minimum ms between runs. */
  cooldownMs?: number;
  /** Modes in which this automation is allowed. Movie Mode is never in the list by default. */
  allowedModes?: string[];
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  eventId?: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "done" | "suppressed" | "failed" | "cancelled";
  reason?: string;
  log: Array<{ ts: number; text: string }>;
}
