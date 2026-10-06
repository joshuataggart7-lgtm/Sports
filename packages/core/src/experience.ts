/**
 * The Experience layer: one set of switches and dials that every effect in the room passes
 * through before it reaches a device. Scenes and automations stay declarative; the
 * orchestrator applies these settings at dispatch time (gate + scale), so a disabled
 * category or Quiet Mode changes what the room does without editing a single scene.
 */

/** Effect categories. "effects" covers plug-driven props (fog, horn, goal light). */
export const FX_CATEGORIES = ["lighting", "dmx", "tactile", "audio", "display", "effects"] as const;
export type FxCategory = (typeof FX_CATEGORIES)[number];

export const FX_CATEGORY_LABELS: Record<FxCategory, string> = {
  lighting: "Lighting", dmx: "DMX", tactile: "Tactile", audio: "Audio FX", display: "Display FX", effects: "Props",
};

export const INTENSITY_MODES = ["NORMAL", "BIG_GAME", "INSANE", "QUIET"] as const;
export type IntensityMode = (typeof INTENSITY_MODES)[number];

export const INTENSITY_MODE_LABELS: Record<IntensityMode, string> = { NORMAL: "Normal", BIG_GAME: "Big Game", INSANE: "Insane", QUIET: "Quiet" };

/** Multiplier each mode applies on top of the category dial. INSANE never exceeds 100% of a device's own range. */
export const INTENSITY_MODE_SCALE: Record<IntensityMode, Record<FxCategory, number>> = {
  NORMAL:   { lighting: 1,    dmx: 1,    tactile: 1,    audio: 1,    display: 1, effects: 1 },
  BIG_GAME: { lighting: 1.15, dmx: 1.15, tactile: 1.2,  audio: 1.1,  display: 1, effects: 1 },
  INSANE:   { lighting: 1.3,  dmx: 1.3,  tactile: 1.35, audio: 1.2,  display: 1, effects: 1 },
  // Quiet swaps modality: the screens and slow light carry the moment; horn, fog, hard hits and loud clips do not.
  QUIET:    { lighting: 0.35, dmx: 0.15, tactile: 0.15, audio: 0,    display: 1, effects: 0 },
};

export interface FxCategorySettings { enabled: boolean; intensity: number; }

export interface ExperienceSettings {
  /** Master switch. Off = no effect of any category fires; room modes still work. */
  master: boolean;
  mode: IntensityMode;
  categories: Record<FxCategory, FxCategorySettings>;
  /** Hard limits that no scene, mode or dial can exceed. */
  limits?: ExperienceLimits;
}

/**
 * Sanity rules applied at dispatch, after every dial. Props (fog, horn, beacon) are capped and
 * rate-limited by device group; tactile is capped; quiet hours force QUIET whatever the mode says.
 */
export interface ExperienceLimits {
  /** Longest single fog burst, ms. */
  maxFogBurstMs: number;
  /** Minimum gap between fog bursts, ms. */
  fogCooldownMs: number;
  /** Longest horn blast, ms. */
  hornMaxMs: number;
  hornCooldownMs: number;
  /** Longest beacon run, ms. */
  beaconMaxMs: number;
  /** Tactile intensity ceiling, 0-100. */
  maxTactileIntensity: number;
  /** Local times "HH:MM"; inside this window the room behaves as QUIET. Empty strings disable. */
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const DEFAULT_LIMITS: ExperienceLimits = {
  maxFogBurstMs: 1500, fogCooldownMs: 45_000, hornMaxMs: 3000, hornCooldownMs: 15_000, beaconMaxMs: 15_000,
  maxTactileIntensity: 100, quietHoursStart: "23:00", quietHoursEnd: "07:00",
};

/** The intensity mode in force right now: the chosen one, or QUIET inside quiet hours. */
export function effectiveMode(settings: ExperienceSettings, now = new Date()): IntensityMode {
  const l = settings.limits;
  if (!l?.quietHoursStart || !l.quietHoursEnd) return settings.mode;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const cur = now.getHours() * 60 + now.getMinutes(), a = toMin(l.quietHoursStart), b = toMin(l.quietHoursEnd);
  const inside = a <= b ? cur >= a && cur < b : cur >= a || cur < b;
  return inside ? "QUIET" : settings.mode;
}

export const DEFAULT_EXPERIENCE: ExperienceSettings = {
  master: true,
  mode: "NORMAL",
  limits: DEFAULT_LIMITS,
  categories: {
    lighting: { enabled: true, intensity: 100 },
    dmx: { enabled: true, intensity: 100 },
    tactile: { enabled: true, intensity: 70 },
    audio: { enabled: true, intensity: 80 },
    display: { enabled: true, intensity: 100 },
    effects: { enabled: true, intensity: 100 },
  },
};

/**
 * Effective 0..1.35 multiplier for a category, given the dial, the intensity mode and, when a
 * sports event carries one, its importance (0.7 is an ordinary score and scales 1.0; a
 * game-swinging play scales up to 1.3, a routine moment down to 0.7). Display FX never scale.
 */
export function fxScale(settings: ExperienceSettings, category: FxCategory, importance?: number): number {
  const c = settings.categories[category];
  if (!settings.master || !c?.enabled) return 0;
  const byImportance = importance === undefined || category === "display" ? 1 : Math.max(0.7, Math.min(1.3, 1 + (importance - 0.7) * 0.6));
  return Math.max(0, Math.min(1.35, (c.intensity / 100) * INTENSITY_MODE_SCALE[effectiveMode(settings)][category] * byImportance));
}

/** Base importance per event type before win probability, clutch and rivalry are added. */
export const EVENT_BASE_IMPORTANCE: Record<string, number> = {
  PICK_SIX: 1.0, WIN: 1.0, TOUCHDOWN: 0.7, BLOCKED_KICK: 0.7, FOURTH_DOWN_STOP: 0.6, INTERCEPTION: 0.6, TURNOVER: 0.6, SAFETY: 0.6,
  HOME_RUN: 0.6, LEAD_CHANGE: 0.5, FIELD_GOAL: 0.4, BIG_PLAY: 0.4, MISSED_FIELD_GOAL: 0.4, SACK: 0.3, OVERTIME: 0.6,
  RED_ZONE: 0.25, FOURTH_DOWN: 0.2, THIRD_DOWN: 0.1, FIRST_DOWN: 0.05, GAME_START: 0.4, HALFTIME: 0.2, TWO_MINUTE: 0.3,
  CELEBRATION: 0.7, DEFENSE: 0.5, LOSS: 0.3, GAME_END: 0.3,
};

// ------------------------------------------------------------------ tactile

export const TACTILE_PATTERNS = ["impact", "doubleImpact", "heartbeat", "rumble", "engine", "crowdPulse", "explosion", "kickoff", "victoryPulse", "stop"] as const;
export type TactilePattern = (typeof TACTILE_PATTERNS)[number];

// ------------------------------------------------------------------ DMX

/** Semantic fixture operations. Scenes speak these; a fixture profile maps them to channels. */
export const FIXTURE_OPS = ["beam_burst", "set_color", "set_brightness", "motor_speed", "strobe", "blackout"] as const;
export type FixtureOp = (typeof FIXTURE_OPS)[number];

/**
 * A DMX fixture profile: where it sits in the universe and what each channel means.
 * channels maps a role (dimmer, red, green, blue, white, strobe, motor, mode, program...) to a
 * 0-based channel offset from the fixture's address.
 */
export interface FixtureProfile {
  name: string;
  universe: number;
  address: number;
  channelCount: number;
  channels: Partial<Record<"dimmer" | "red" | "green" | "blue" | "white" | "strobe" | "motor" | "mode" | "program" | "speed" | "sound", number>>;
  capabilities: FixtureOp[];
  /** Channel values the fixture needs to sit in DMX mode / be visible at all. Applied before every op. */
  base?: Record<number, number>;
}

// ------------------------------------------------------------------ teams

/** Per-team preferences the same scenes use: colors override the feed, audio clips by moment. */
export interface TeamExperience {
  abbr: string;
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  audio?: { score?: string; bigPlay?: string; win?: string; };
}

// ------------------------------------------------------------------ timing

/** One device command, timed. Collected by the DeviceManager, shown in the Simulator debug view. */
export interface CommandTiming {
  id: string;
  ts: number;
  deviceId: string;
  deviceName: string;
  driver: string;
  status: string;
  command: string;
  origin: string;
  category?: FxCategory;
  durationMs: number;
  ok: boolean;
  reason?: string;
  /** Scene or automation run the command belonged to, when known. */
  runId?: string;
  /** ms since that run started. */
  offsetMs?: number;
}

export interface MetricsSummary {
  recent: CommandTiming[];
  byDriver: Record<string, { count: number; avgMs: number; p95Ms: number; failures: number }>;
}
