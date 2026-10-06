/**
 * The dispatch gate. Effect commands (from automations and effect scenes) pass through here:
 * the category decides which switch and dial apply, the intensity mode scales them, and a
 * disabled category or master-off drops the command. Room-setup scenes (Game Day, Movie) do
 * not pass through: the receiver volume in Game Day is a setting, not an effect.
 */
import { DEFAULT_EXPERIENCE, DEFAULT_LIMITS, fxScale, type DeviceCommand, type ExperienceSettings, type FxCategory, type RoomDevice } from "@room/core";

/** Last time a prop group fired, for cooldowns. Keyed by device id. */
const lastFired = new Map<string, number>();
const propKind = (device?: RoomDevice): "fog" | "horn" | "goal_light" | undefined => device?.groups?.includes("fog") ? "fog" : device?.groups?.includes("horn") ? "horn" : device?.groups?.includes("goal_light") ? "goal_light" : undefined;

export function categoryOf(command: DeviceCommand, device?: RoomDevice): FxCategory | undefined {
  switch (command.type) {
    case "tactile": return "tactile";
    case "fixture": return "dmx";
    case "play_audio": return "audio";
    case "pulse": return "effects";
    case "set_color": case "set_brightness": case "effect": return device && device.type !== "light" && device.type !== "dmx_fixture" ? undefined : device?.type === "dmx_fixture" ? "dmx" : "lighting";
    case "power_on": case "power_off": return device?.type === "light" ? "lighting" : device?.type === "tactile" ? "tactile" : device?.type === "dmx_fixture" ? "dmx" : undefined;
    default: return undefined;
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Returns the command to send, scaled, or null when the Experience settings drop it. */
export function applyExperience(settings: ExperienceSettings | undefined, command: DeviceCommand, device?: RoomDevice, importance?: number): { command: DeviceCommand | null; category?: FxCategory; reason?: string } {
  const s = settings ?? DEFAULT_EXPERIENCE;
  const category = categoryOf(command, device);
  if (!category) return { command };
  if (!s.master) return { command: null, category, reason: "effects off" };
  const k = fxScale(s, category, importance);
  if (k === 0) return { command: null, category, reason: `${category} off` };
  const lim = { ...DEFAULT_LIMITS, ...(s.limits ?? {}) };
  switch (command.type) {
    case "set_brightness": return { command: { ...command, brightness: clamp(command.brightness * k) }, category };
    case "play_audio": return { command: { ...command, volume: clamp((command.volume ?? 80) * k) }, category };
    case "tactile": return { command: { ...command, intensity: Math.min(lim.maxTactileIntensity, clamp((command.intensity ?? 70) * k)) }, category };
    case "pulse": {
      // Props: cap the burst and enforce a cooldown per device, whatever the scene asked for.
      const kind = propKind(device);
      if (kind && device) {
        const max = kind === "fog" ? lim.maxFogBurstMs : kind === "horn" ? lim.hornMaxMs : lim.beaconMaxMs;
        const cool = kind === "fog" ? lim.fogCooldownMs : kind === "horn" ? lim.hornCooldownMs : 0;
        const last = lastFired.get(device.id) ?? 0;
        if (cool && Date.now() - last < cool) return { command: null, category, reason: `${kind} cooldown` };
        lastFired.set(device.id, Date.now());
        return { command: { ...command, durationMs: Math.min(max, command.durationMs ?? 1000) }, category };
      }
      return { command, category };
    }
    case "fixture": return { command: command.intensity === undefined ? command : { ...command, intensity: clamp(command.intensity * k) }, category };
    default: return { command, category };
  }
}
