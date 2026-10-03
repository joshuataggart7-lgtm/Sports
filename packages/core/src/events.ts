export const SPORTS_EVENT_TYPES = [
  "GAME_START", "GAME_END", "PERIOD_START", "PERIOD_END", "TOUCHDOWN", "FIELD_GOAL", "EXTRA_POINT", "TWO_POINT",
  "SAFETY", "TURNOVER", "INTERCEPTION", "FUMBLE", "RED_ZONE", "BIG_PLAY", "SCORE_CHANGE", "LEAD_CHANGE", "OVERTIME",
  "WIN", "LOSS", "SCORE_CORRECTION", "HOME_RUN", "THREE_POINTER", "DUNK", "GOAL", "POWER_PLAY",
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
}
