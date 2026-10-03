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
  overlay: { kind: "celebration" | "banner" | "alert" | "clear"; text?: string; subtext?: string; color?: string; durationMs?: number };
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
  | { not: AutomationCondition };

export interface AutomationTrigger {
  eventTypes: SportsEventType[];
  /** Only for these teams (abbreviations). Empty = any. */
  teams?: string[];
  /** Only the watched game(s). Default true. */
  watchedGamesOnly?: boolean;
  /** Also fire for manual events. Default true. */
  manual?: boolean;
}

export interface Automation {
  id: string;
  roomId: string;
  name: string;
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
