/**
 * Home Assistant REST driver. UNVERIFIED: written against the documented REST API
 * (POST /api/services/<domain>/<service>) but not run against a live instance from this
 * repository. It only reports CONNECTED after GET /api/ answers with the agent's token.
 *
 * Device driverConfig: { entityId: "light.room_leds" } (domain decides the service map).
 * Inputs for media players: device.inputs maps logical names to HA source names.
 */
import type { DeviceCommand, DeviceDriver, DeviceState, IntegrationStatus, RoomDevice } from "@room/core";

export class HomeAssistantDriver implements DeviceDriver {
  id = "homeassistant";
  private status: IntegrationStatus = "UNVERIFIED";
  constructor(private url: string, private token: string) {}

  async connect(): Promise<IntegrationStatus> {
    try {
      const res = await fetch(`${this.url.replace(/\/$/, "")}/api/`, { headers: this.headers() });
      this.status = res.ok ? "CONNECTED" : "OFFLINE";
    } catch { this.status = "OFFLINE"; }
    return this.status;
  }

  async refresh(device: RoomDevice): Promise<Partial<DeviceState>> {
    const entityId = String(device.driverConfig?.entityId ?? "");
    if (!entityId) return {};
    const res = await fetch(`${this.url.replace(/\/$/, "")}/api/states/${entityId}`, { headers: this.headers() });
    if (!res.ok) return {};
    const j = (await res.json()) as { state: string; attributes: Record<string, unknown> };
    const out: Partial<DeviceState> = { power: j.state === "on" || j.state === "playing" || j.state === "idle" ? "on" : j.state === "off" ? "off" : "unknown" };
    if (typeof j.attributes.brightness === "number") out.brightness = Math.round((j.attributes.brightness / 255) * 100);
    if (typeof j.attributes.volume_level === "number") out.volume = Math.round(j.attributes.volume_level * 100);
    if (typeof j.attributes.source === "string") out.input = j.attributes.source;
    if (entityId.startsWith("cover.")) out.screenPosition = j.state === "open" ? "up" : j.state === "closed" ? "down" : "moving";
    return out;
  }

  async execute(device: RoomDevice, command: DeviceCommand): Promise<Partial<DeviceState>> {
    const entityId = String(device.driverConfig?.entityId ?? "");
    if (!entityId) throw new Error(`${device.name} has no entityId`);
    const domain = entityId.split(".")[0];
    const call = (service: string, data: Record<string, unknown> = {}) => this.service(domain, service, { entity_id: entityId, ...data });
    switch (command.type) {
      case "power_on": await call(domain === "media_player" ? "turn_on" : domain === "cover" ? "open_cover" : "turn_on"); return { power: "on" };
      case "power_off": await call(domain === "cover" ? "close_cover" : "turn_off"); return { power: "off" };
      case "set_input": await this.service("media_player", "select_source", { entity_id: entityId, source: device.inputs?.[command.input] ?? command.input }); return { input: command.input };
      case "set_volume": await this.service("media_player", "volume_set", { entity_id: entityId, volume_level: command.volume / 100 }); return { volume: command.volume };
      case "set_brightness": await this.service("light", "turn_on", { entity_id: entityId, brightness_pct: command.brightness, transition: 1 }); return { brightness: command.brightness, power: "on" };
      case "set_color": await this.service("light", "turn_on", { entity_id: entityId, rgb_color: hexToRgb(command.color), transition: (command.transitionMs ?? 500) / 1000 }); return { color: command.color, power: "on" };
      case "effect": {
        if (command.effect === "off") { await this.service("light", "turn_on", { entity_id: entityId, effect: "none" }); return { effect: undefined }; }
        // Most integrations expose named effects; colors are applied first so the effect inherits them.
        if (command.colors?.[0]) await this.service("light", "turn_on", { entity_id: entityId, rgb_color: hexToRgb(command.colors[0]) });
        await this.service("light", "turn_on", { entity_id: entityId, effect: command.effect });
        return { effect: command.effect, power: "on" };
      }
      case "screen_up": await this.service("cover", "open_cover", { entity_id: entityId }); return { screenPosition: "up" };
      case "screen_down": await this.service("cover", "close_cover", { entity_id: entityId }); return { screenPosition: "down" };
      case "play_audio": await this.service("media_player", "play_media", { entity_id: entityId, media_content_type: "music", media_content_id: command.clip }); return { playing: command.clip };
      case "run_scene": await this.service("scene", "turn_on", { entity_id: command.scene }); return {};
      case "open_url": case "display_layout": return {}; // browser displays are driven by the display manager, not HA
    }
  }

  private headers(): Record<string, string> { return { authorization: `Bearer ${this.token}`, "content-type": "application/json" }; }
  private async service(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/api/services/${domain}/${service}`, { method: "POST", headers: this.headers(), body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`HA ${domain}.${service} -> ${res.status}`);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
