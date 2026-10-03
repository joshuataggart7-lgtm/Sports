import type { IntegrationStatus } from "./status";

export type DeviceType =
  | "television" | "monitor" | "projector" | "projector_screen" | "av_receiver" | "speaker"
  | "light" | "smart_plug" | "computer" | "browser_display" | "virtual_display" | "button";

export type DeviceCapability =
  | "power" | "input" | "volume" | "brightness" | "color" | "url" | "layout"
  | "screen_position" | "audio_playback" | "scene" | "effect";

/** Commands are a closed union so drivers, scenes and automations all agree on the vocabulary. */
export type DeviceCommand =
  | { type: "power_on" }
  | { type: "power_off" }
  | { type: "set_input"; input: string }
  | { type: "set_volume"; volume: number }
  | { type: "set_brightness"; brightness: number }
  | { type: "set_color"; color: string; transitionMs?: number }
  | { type: "effect"; effect: "pulse" | "flash" | "chase" | "breathe" | "off"; colors?: string[]; durationMs?: number }
  | { type: "open_url"; url: string }
  | { type: "display_layout"; layout: string }
  | { type: "screen_up" }
  | { type: "screen_down" }
  | { type: "play_audio"; clip: string; volume?: number }
  | { type: "run_scene"; scene: string };

export type DeviceCommandType = DeviceCommand["type"];

export interface DeviceState {
  power?: "on" | "off" | "unknown";
  input?: string;
  volume?: number;
  brightness?: number;
  color?: string;
  effect?: string;
  url?: string;
  screenPosition?: "up" | "down" | "moving";
  playing?: string | null;
  updatedAt: number;
}

export interface RoomDevice {
  id: string;
  roomId: string;
  type: DeviceType;
  name: string;
  /** Where the device sits in the schematic room map, 0..1 of the wall/floor plan. */
  position?: { x: number; y: number; w?: number; h?: number };
  capabilities: DeviceCapability[];
  /** Named inputs this device exposes, e.g. { appletv: "HDMI1", cable: "HDMI2" }. */
  inputs?: Record<string, string>;
  /** Logical groups automations can target: tv_bias, room_leds, sports_wall... */
  groups?: string[];
  driver: string;
  driverConfig?: Record<string, unknown>;
  status: IntegrationStatus;
  state: DeviceState;
  /** Until this timestamp, automations leave the device alone because a person touched it. */
  manualHoldUntil?: number;
}

export interface DeviceDriver {
  id: string;
  /** Called once; return the status the driver can honestly report. */
  connect(devices: RoomDevice[]): Promise<IntegrationStatus>;
  execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>>;
  /** Optional polling of real state. */
  refresh?(device: RoomDevice): Promise<Partial<DeviceState>>;
}

export const CAPABILITY_FOR_COMMAND: Record<DeviceCommandType, DeviceCapability> = {
  power_on: "power", power_off: "power", set_input: "input", set_volume: "volume", set_brightness: "brightness",
  set_color: "color", effect: "effect", open_url: "url", display_layout: "layout", screen_up: "screen_position",
  screen_down: "screen_position", play_audio: "audio_playback", run_scene: "scene",
};
