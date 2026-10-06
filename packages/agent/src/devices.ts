import { EventEmitter } from "node:events";
import { CAPABILITY_FOR_COMMAND, type DeviceCommand, type DeviceDriver, type FxCategory, type RoomDevice, type TimelineEntry } from "@room/core";
import { Metrics } from "./metrics";

export type Origin = "manual" | "automation" | "scene" | "system";
/** Extra context a dispatcher can attach to a command for the timing log. */
export interface ExecMeta { runId?: string; category?: FxCategory }
const MANUAL_HOLD_MS = 10 * 60_000;

/**
 * DeviceManager: the only path to a device. Checks capabilities, routes to the driver,
 * tracks state, enforces "manual overrides automation" via a hold window, and logs.
 */
export class DeviceManager extends EventEmitter {
  private drivers = new Map<string, DeviceDriver>();
  readonly metrics = new Metrics();
  constructor(public devices: RoomDevice[], private log: (e: Omit<TimelineEntry, "id" | "roomId" | "ts">) => void) { super(); }

  register(driver: DeviceDriver): void { this.drivers.set(driver.id, driver); }

  async connectAll(): Promise<Record<string, RoomDevice["status"]>> {
    const out: Record<string, RoomDevice["status"]> = {};
    for (const [id, driver] of this.drivers) {
      const mine = this.devices.filter((d) => d.driver === id);
      const status = await driver.connect(mine);
      out[id] = status;
      for (const d of mine) if (!driver.probe) d.status = status;
      if (driver.refresh) for (const d of mine) if (d.status === "CONNECTED") { try { Object.assign(d.state, await driver.refresh(d), { updatedAt: Date.now() }); } catch { /* keep last state */ } }
    }
    for (const d of this.devices) if (!this.drivers.has(d.driver)) d.status = "OFFLINE";
    this.emit("change");
    return out;
  }

  get(id: string): RoomDevice | undefined { return this.devices.find((d) => d.id === id); }
  driverIds(): string[] { return [...this.drivers.keys()]; }

  /** Re-point a device at real hardware: driver + config. Status is re-probed afterwards. */
  async update(id: string, patch: Partial<Pick<RoomDevice, "name" | "driver" | "driverConfig" | "inputs" | "groups" | "position" | "capabilities" | "type">>): Promise<RoomDevice | undefined> {
    const d = this.get(id);
    if (!d) return undefined;
    if (patch.driver && !this.drivers.has(patch.driver)) throw new Error(`unknown driver ${patch.driver}`);
    Object.assign(d, patch);
    // A seeded device remembers the driver it is meant to use; entering a host switches it over.
    const intended = d.driverConfig?.intendedDriver;
    const hasHost = !!d.driverConfig?.host || (Array.isArray(d.driverConfig?.hosts) && d.driverConfig.hosts.length > 0);
    if (d.driver === "mock" && typeof intended === "string" && hasHost && (intended !== "bravia" || d.driverConfig?.psk) && this.drivers.has(intended)) d.driver = intended;
    const driver = this.drivers.get(d.driver);
    if (driver) d.status = driver.probe ? await driver.probe(d) : await driver.connect([d]);
    this.log({ kind: "device", text: `${d.name}: driver ${d.driver} → ${d.status}`, detail: { deviceId: id } });
    this.emit("change", d);
    return d;
  }
  byGroup(group: string): RoomDevice[] { return this.devices.filter((d) => d.groups?.includes(group)); }
  byType(type: string): RoomDevice[] { return this.devices.filter((d) => d.type === type); }

  async execute(deviceId: string, command: DeviceCommand, origin: Origin, meta: ExecMeta = {}): Promise<{ ok: boolean; reason?: string }> {
    const device = this.get(deviceId);
    if (!device) return { ok: false, reason: "unknown device" };
    const cap = CAPABILITY_FOR_COMMAND[command.type];
    if (!device.capabilities.includes(cap)) return { ok: false, reason: `${device.name} cannot ${command.type}` };
    const now = Date.now();
    const timing = (ok: boolean, reason?: string) => this.metrics.record({ ts: now, deviceId, deviceName: device.name, driver: device.driver, status: device.status, command: describe(command), origin, category: meta.category, runId: meta.runId, durationMs: Date.now() - now, ok, reason });
    if (origin === "automation" && device.manualHoldUntil && device.manualHoldUntil > now) {
      this.log({ kind: "device", text: `Skipped ${command.type} on ${device.name}: manual hold`, detail: { deviceId, command } });
      timing(false, "manual hold");
      return { ok: false, reason: "manual hold" };
    }
    if (origin === "manual") device.manualHoldUntil = now + MANUAL_HOLD_MS;
    if (origin === "scene") device.manualHoldUntil = undefined;
    const driver = this.drivers.get(device.driver);
    if (!driver) { timing(false, `no driver ${device.driver}`); return { ok: false, reason: `no driver ${device.driver}` }; }
    try {
      const patch = await driver.execute(device, command);
      Object.assign(device.state, patch, { updatedAt: Date.now() });
      timing(true);
      this.log({ kind: "device", text: `${device.name}: ${describe(command)}${device.status === "SIMULATED" ? " (simulated)" : ""}`, detail: { deviceId, command, origin } });
      this.emit("change", device);
      return { ok: true };
    } catch (e) {
      timing(false, (e as Error).message);
      this.log({ kind: "device", text: `${device.name}: ${describe(command)} failed: ${(e as Error).message}`, detail: { deviceId, command, origin } });
      return { ok: false, reason: (e as Error).message };
    }
  }

  /** Fire a device's most telling command for its type: a Test button. */
  async test(deviceId: string): Promise<{ ok: boolean; reason?: string; command?: DeviceCommand }> {
    const d = this.get(deviceId);
    if (!d) return { ok: false, reason: "unknown device" };
    const caps = new Set(d.capabilities);
    const command: DeviceCommand | undefined =
      caps.has("tactile") ? { type: "tactile", pattern: "impact", intensity: 60 } :
      caps.has("dmx") ? { type: "fixture", op: "beam_burst", intensity: 80, durationMs: 1500 } :
      caps.has("effect") ? { type: "effect", effect: "flash", colors: ["#ffffff", d.state.color ?? "#1d4ed8"], durationMs: 1500 } :
      caps.has("audio_playback") ? { type: "play_audio", clip: "celebration", volume: 60 } :
      caps.has("momentary") ? { type: "pulse", durationMs: 500 } :
      caps.has("brightness") ? { type: "set_brightness", brightness: d.state.brightness ?? 50 } :
      caps.has("power") ? { type: d.state.power === "on" ? "power_on" : "power_on" } : undefined;
    if (!command) return { ok: false, reason: `${d.name} has nothing to test` };
    const r = await this.execute(deviceId, command, "manual");
    return { ...r, command };
  }
}

export function describe(c: DeviceCommand): string {
  switch (c.type) {
    case "set_input": return `input ${c.input}`;
    case "set_volume": return `volume ${c.volume}`;
    case "set_brightness": return `brightness ${c.brightness}%`;
    case "set_color": return `color ${c.color}`;
    case "effect": return c.effect === "off" ? "effect off" : `${c.effect} ${(c.colors ?? []).join("/")}`;
    case "open_url": return `open ${c.url}`;
    case "play_audio": return `play ${c.clip}`;
    case "run_scene": return `scene ${c.scene}`;
    case "pulse": return `fire for ${((c.durationMs ?? 1000) / 1000).toFixed(1)}s`;
    case "tactile": return c.pattern === "stop" ? "tactile stop" : `${c.pattern} ${c.intensity ?? 70}%`;
    case "fixture": return `${c.op.replace("_", " ")}${c.color ? ` ${c.color}` : ""}${c.intensity !== undefined ? ` ${c.intensity}%` : ""}`;
    default: return c.type.replace(/_/g, " ");
  }
}
