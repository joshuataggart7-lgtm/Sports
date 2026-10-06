export const SPORTS_EVENT_TYPES = [
  "GAME_START", "GAME_END", "PERIOD_START", "PERIOD_END", "TOUCHDOWN", "FIELD_GOAL", "EXTRA_POINT", "TWO_POINT",
  "SAFETY", "TURNOVER", "INTERCEPTION", "FUMBLE", "RED_ZONE", "BIG_PLAY", "SCORE_CHANGE", "LEAD_CHANGE", "OVERTIME",
  "WIN", "LOSS", "SCORE_CORRECTION", "HOME_RUN", "THREE_POINTER", "DUNK", "GOAL", "POWER_PLAY",
  "FIRST_DOWN", "THIRD_DOWN", "FOURTH_DOWN", "SACK", "HALFTIME", "TWO_MINUTE", "KICKOFF", "COMMERCIAL_BREAK", "RETURN_TO_GAME",
  "PICK_SIX", "FOURTH_DOWN_STOP", "MISSED_FIELD_GOAL", "BLOCKED_KICK",
  "CELEBRATION", "DEFENSE", "RESET",
] as const;
export type SportsEventType = (typeof SPORTS_EVENT_TYPES)[number];

export type EventState = "pending" | "released" | "reversed" | "cancelled";

export interface SportsEvent {
  id: string;
  gameId: string;
  /** When the feed knew about it. */
  ts: number;
  /** When the room should act on it: ts + broadcast delay. Set by the scheduler. */
  releaseAt?: number;
  type: SportsEventType;
  /** home / away / undefined for neutral events. */
  side?: "home" | "away";
  teamId?: string;
  teamAbbr?: string;
  data: Record<string, unknown>;
  confidence: number;          // 0..1
  state: EventState;
  source: "provider" | "manual" | "engine";
  /** Short human text for the timeline and the ticker. */
  text: string;
  /** Derived at release time: how much this moment matters, and how tense the game is. */
  context?: EventContext;
}

/**
 * What the room knows about a moment beyond its type. Importance drives effect intensity;
 * pressure drives the build-up scenes; the rest let automations pick a flavor.
 */
export interface EventContext {
  /** 0..1.5. 0.7 is an ordinary touchdown; a game-swinging play lands above 1. */
  importance: number;
  /** 0..1. 3rd down 0.35, 4th down 0.65, red zone adds, clutch adds. */
  pressure: number;
  /** Win-probability change for the event's team since the play, -1..1. */
  wpDelta?: number;
  /** Win probability for the event's team now, 0..1. */
  wp?: number;
  lateGame: boolean;
  oneScore: boolean;
  rivalry: boolean;
  /** The event belongs to the primary watched game (physical effects allowed). */
  primaryGame: boolean;
  /** Most recent drive summary, when the feed has one. */
  drive?: string;
}
