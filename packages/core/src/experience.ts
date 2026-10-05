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
  QUIET:    { lighting: 0.8,  dmx: 0.6,  tactile: 0.3,  audio: 0.35, display: 1, effects: 0 },
};

export interface FxCategorySettings { enabled: boolean; intensity: number; }

export interface ExperienceSettings {
  /** Master switch. Off = no effect of any category fires; room modes still work. */
  master: boolean;
  mode: IntensityMode;
  categories: Record<FxCategory, FxCategorySettings>;
}

export const DEFAULT_EXPERIENCE: ExperienceSettings = {
  master: true,
  mode: "NORMAL",
  categories: {
    lighting: { enabled: true, intensity: 100 },
    dmx: { enabled: true, intensity: 100 },
    tactile: { enabled: true, intensity: 70 },
    audio: { enabled: true, intensity: 80 },
    display: { enabled: true, intensity: 100 },
    effects: { enabled: true, intensity: 100 },
  },
};

/** Effective 0..1 multiplier for a category, given the dial and the intensity mode. */
export function fxScale(settings: ExperienceSettings, category: FxCategory): number {
  const c = settings.categories[category];
  if (!settings.master || !c?.enabled) return 0;
  return Math.max(0, Math.min(1.35, (c.intensity / 100) * INTENSITY_MODE_SCALE[settings.mode][category]));
}

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
