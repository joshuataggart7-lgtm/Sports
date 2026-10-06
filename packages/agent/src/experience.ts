/**
 * The dispatch gate. Effect commands (from automations and effect scenes) pass through here:
 * the category decides which switch and dial apply, the intensity mode scales them, and a
 * disabled category or master-off drops the command. Room-setup scenes (Game Day, Movie) do
 * not pass through: the receiver volume in Game Day is a setting, not an effect.
 */
import { DEFAULT_EXPERIENCE, fxScale, type DeviceCommand, type ExperienceSettings, type FxCategory, type RoomDevice } from "@room/core";

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
  switch (command.type) {
    case "set_brightness": return { command: { ...command, brightness: clamp(command.brightness * k) }, category };
    case "play_audio": return { command: { ...command, volume: clamp((command.volume ?? 80) * k) }, category };
    case "tactile": return { command: { ...command, intensity: clamp((command.intensity ?? 70) * k) }, category };
    case "fixture": return { command: command.intensity === undefined ? command : { ...command, intensity: clamp(command.intensity * k) }, category };
    default: return { command, category };
  }
}
