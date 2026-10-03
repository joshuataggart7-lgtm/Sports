/**
 * SIMULATED device driver. Honors every command instantly (with a touch of latency so
 * choreography can be seen), keeps state, and never pretends to be hardware.
 */
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

export class MockDriver implements DeviceDriver {
  id = "mock";
  async connect(): Promise<IntegrationStatus> { return "SIMULATED"; }
  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
    switch (command.type) {
      case "power_on": return { power: "on" };
      case "power_off": return { power: "off", effect: undefined, playing: null };
      case "set_input": return { input: device.inputs?.[command.input] ? command.input : command.input, power: "on" };
      case "set_volume": return { volume: Math.max(0, Math.min(100, command.volume)) };
      case "set_brightness": return { brightness: Math.max(0, Math.min(100, command.brightness)), power: command.brightness > 0 ? "on" : device.state.power };
      case "set_color": return { color: command.color, power: "on" };
      case "effect": return { effect: command.effect === "off" ? undefined : `${command.effect}:${(command.colors ?? []).join(",")}`, power: "on" };
      case "open_url": return { url: command.url, power: "on" };
      case "display_layout": return { url: `layout:${command.layout}` };
      case "screen_up": return { screenPosition: "up" };
      case "screen_down": return { screenPosition: "down" };
      case "play_audio": return { playing: command.clip, power: "on" };
      case "run_scene": return {};
    }
  }
}
