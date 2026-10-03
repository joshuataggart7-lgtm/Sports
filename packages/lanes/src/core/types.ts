/**
 * Lanes core types.
 *
 * The whole system is built on three nouns:
 *   - Event:  something happened (a goal, a price crossing, rain starting, a webhook).
 *   - Card:   the current state of something (the score right now, today's weather).
 *   - Rule:   when an Event matches, do something: push a lane item, fire a Moment,
 *             call a webhook (lights, speakers, anything).
 *
 * Lanes show Cards and rule-pushed items as scrolling strips. Moments take over the
 * whole surface for a few seconds. Everything is source-agnostic: sports, weather,
 * markets, calendars and home automation all speak this same vocabulary.
 */

export interface LanesEvent {
  id: string;
  ts: number;
  /** Source id, e.g. "sports", "weather", "webhook". */
  source: string;
  /** Event kind within the source, e.g. "score", "game_start", "rain_start", "price_cross". */
  kind: string;
  /** Stable key for the thing the event is about, e.g. "nfl:401772" or "bitcoin". */
  key: string;
  /** One-line human text. */
  title: string;
  /** Optional longer text. */
  text?: string;
  /** Importance hint 0..1 from the source. Rules may override. */
  importance: number;
  /** Free-form tags for matching (team abbreviations, league, symbol...). */
  tags: string[];
  /** Source-specific fields, available to rule conditions and templates. */
  data: Record<string, unknown>;
}

export interface Card {
  /** Stable key, unique within a source. */
  key: string;
  source: string;
  /** Text shown in a lane. Keep it short, it scrolls. */
  text: string;
  /** Hex color for the text, e.g. "#ffcc00". */
  color?: string;
  /** Optional colored chip drawn before the text (team color, severity). */
  chip?: string;
  /** Optional icon glyph name from the font's icon set. */
  icon?: string;
  /** Larger number means earlier in the lane. Live things sort first. */
  priority?: number;
  /** Tags for lane filters. */
  tags?: string[];
  /** Absolute ms timestamp after which the card disappears. */
  expiresAt?: number;
  data?: Record<string, unknown>;
}

export interface LaneItem {
  key: string;
  text: string;
  color?: string;
  chip?: string;
  icon?: string;
}

export type MomentKind = "flash" | "confetti" | "pulse" | "rain" | "wipe";

export interface Moment {
  id: string;
  kind: MomentKind;
  title: string;
  subtitle?: string;
  /** Primary color. */
  color: string;
  /** Secondary color (confetti mix, flash alternate). */
  color2?: string;
  durationMs: number;
  /** 0..100. Higher wins contention and survives the attention budget. */
  priority: number;
  /** Attention cost charged against the hourly budget. */
  cost: number;
  startedAt: number;
  /** Rule that produced this moment, for logs. */
  ruleId?: string;
  /** Event that produced it. */
  eventId?: string;
}

/** Condition value in a rule's `when` clause. */
export type Cond =
  | string
  | number
  | boolean
  | { eq?: unknown; ne?: unknown; gt?: number; gte?: number; lt?: number; lte?: number; in?: unknown[]; has?: string; regex?: string };

export interface RuleWhen {
  source?: Cond;
  kind?: Cond;
  key?: Cond;
  tags?: Cond; // {has: "HOU"} or a plain string meaning "has"
  importance?: Cond;
  /** Match against event.data fields by name. */
  [field: string]: Cond | undefined;
}

export interface RuleThen {
  moment?: {
    kind?: MomentKind;
    title?: string;
    subtitle?: string;
    color?: string;
    color2?: string;
    duration?: number;
    priority?: number;
    cost?: number;
  };
  lane?: {
    /** Lane id to push into. Defaults to the first lane. */
    id?: string;
    text: string;
    color?: string;
    chip?: string;
    icon?: string;
    /** How long the item stays, ms. Default 5 minutes. */
    ttl?: number;
  };
  webhook?: {
    url: string;
    method?: "POST" | "PUT" | "GET";
    headers?: Record<string, string>;
    /** JSON body template. Strings inside are templated with {{field}}. */
    body?: unknown;
  };
  /** Log only, useful while writing rules. */
  log?: string;
}

export interface Rule {
  id: string;
  /** Human description, what the person typed if the AI composer wrote it. */
  description?: string;
  enabled?: boolean;
  when: RuleWhen;
  then: RuleThen;
  /** Minimum ms between two firings of this rule. */
  cooldown?: number;
  /** When this rule fires, skip the rules after it for the same event. Order rules specific to general. */
  stop?: boolean;
}

export interface LaneShow {
  source: string;
  /** Only cards with all of these tags. */
  tags?: string[];
  /** Max cards from this source. */
  limit?: number;
}

export interface LaneConfig {
  id: string;
  /** Row span in the matrix, in pixels. Lanes are stacked top to bottom. */
  height: number;
  show: LaneShow[];
  /** Pixels per second. */
  speed?: number;
  /** Text scale 1..3. */
  scale?: number;
  /** "scroll" always scrolls, "auto" shows static when it fits. */
  mode?: "scroll" | "auto";
  separator?: string;
  color?: string;
}

export interface AttentionConfig {
  /** How many attention points per rolling hour the display may spend on moments. */
  budgetPerHour: number;
  /** Quiet hours as "HH:MM" start and end in local time. */
  quietHours?: { start: string; end: string };
  /** Moments at or above this priority ignore budget and quiet hours. */
  alwaysPriority: number;
}

export interface MatrixConfig {
  width: number;
  height: number;
}

export interface LanesConfig {
  name?: string;
  matrix: MatrixConfig;
  lanes: LaneConfig[];
  sources: Record<string, Record<string, unknown> | false>;
  rules: Rule[];
  attention: AttentionConfig;
  /** Local timezone for quiet hours and clock. */
  timezone?: string;
  port?: number;
}

/** What every display receives over the socket. */
export interface DisplayState {
  v: 1;
  serverTime: number;
  matrix: MatrixConfig;
  lanes: Array<{
    id: string;
    y: number;
    height: number;
    speed: number;
    scale: number;
    mode: "scroll" | "auto";
    separator: string;
    color: string;
    items: LaneItem[];
  }>;
  moment: Moment | null;
  /** Rolling attention spent and budget, for the admin page. */
  attention: { spent: number; budget: number; quiet: boolean };
}

export interface SourceContext {
  emit(event: Omit<LanesEvent, "id" | "ts" | "source"> & Partial<Pick<LanesEvent, "ts">>): void;
  setCards(cards: Card[]): void;
  log(msg: string): void;
  config: LanesConfig;
}

export interface Source {
  id: string;
  start(ctx: SourceContext, options: Record<string, unknown>): Promise<void> | void;
  stop?(): void;
}
