import os from "node:os";
import { EventEmitter } from "node:events";
import { DEFAULT_EXPERIENCE, DEFAULT_LIMITS, FX_CATEGORIES, INTENSITY_MODES, uid, type AgentStatus, type ExperienceSettings, type FxCategory, type GameStats, type BroadcastDelayProfile, type DisplayOverlay, type Game, type IntegrationStatus, type League, type RoomSnapshot, type SportsEvent, type SportsProvider, type Team, type TimelineEntry } from "@room/core";
import { SimulatedProvider } from "@room/sports";
import { DeviceManager } from "./devices";
import { DisplayManager } from "./displays";
import { Orchestrator } from "./orchestrator";
import { GameWatcher } from "./watcher";
import type { RoomData, RoomStore } from "./store";

export const VERSION = "0.1.0";

/** Seed devices replaced by the five WiZ strips. */
const RETIRED_DEVICE_IDS = ["bias_lights", "room_leds"];

function normalizeExperience(e: ExperienceSettings | undefined): ExperienceSettings {
  const out: ExperienceSettings = { master: e?.master ?? DEFAULT_EXPERIENCE.master, mode: e?.mode ?? DEFAULT_EXPERIENCE.mode, categories: { ...DEFAULT_EXPERIENCE.categories }, limits: { ...DEFAULT_LIMITS, ...(e?.limits ?? {}) } };
  for (const c of FX_CATEGORIES) out.categories[c] = { ...DEFAULT_EXPERIENCE.categories[c], ...(e?.categories?.[c] ?? {}) };
  return out;
}

export class Agent extends EventEmitter {
  readonly devices: DeviceManager;
  readonly displays: DisplayManager;
  readonly orchestrator: Orchestrator;
  readonly watcher: GameWatcher;
  readonly startedAt = Date.now();
  driverStatus: Record<string, IntegrationStatus> = {};
  leagues: League[] = [];

  constructor(public data: RoomData, public provider: SportsProvider, private store: RoomStore, public authMode: AgentStatus["auth"]) {
    super();
    const log = (e: Omit<TimelineEntry, "id" | "roomId" | "ts">) => this.log(e);
    this.devices = new DeviceManager(data.devices, log);
    this.displays = new DisplayManager(data.displays, data.presets, log);
    this.watcher = new GameWatcher(provider, data.room, () => data.delayProfiles, (e, g) => void this.orchestrator.handleEvent(e, g), (ids) => this.orchestrator.cancelRunsForEvent(ids, "play overturned"), log);
    this.orchestrator = new Orchestrator(data.room, data.scenes, data.automations, data.runs, this.devices, this.displays, log, {
      favoriteTeam: () => this.favoriteTeam(),
      primaryGame: () => this.watcher.games.get(data.room.watchedGameIds[0] ?? ""),
    });
    for (const src of [this.devices, this.displays, this.orchestrator]) src.on("change", () => this.changed());
    this.orchestrator.on("scene", (scene: { fx?: boolean }) => { if (!scene.fx) void this.openDisplayPages(); });
    this.displays.on("overlay", (ids: string[] | "all", overlay: DisplayOverlay) => this.emit("overlay", ids, overlay));
    this.watcher.on("game", (g: Game) => this.emit("game", g));
    this.watcher.on("games", () => { this.autoWatch(); this.changed(); });
    this.watcher.on("event", (e: SportsEvent) => this.emit("event", e));
    this.watcher.on("stats", (st: GameStats) => this.emit("stats", st));
    this.displays.on("change", () => this.syncExtraStats());
  }

  get room() { return this.data.room; }

  /**
   * Additive upgrade of a saved room: scenes, automations and devices the current seed has
   * and the file does not are appended by id, defaults are filled in. Nothing the person
   * configured is touched, so a git pull brings new experiences without a reseed.
   */
  static migrate(data: RoomData, seed: RoomData): RoomData {
    const add = <T extends { id: string }>(have: T[], want: T[], label: string) => {
      for (const w of want) if (!have.some((h) => h.id === w.id)) { have.push(w); console.log(`[store] added ${label} ${w.id}`); }
    };
    add(data.scenes, seed.scenes, "scene");
    add(data.automations, seed.automations, "automation");
    for (const w of seed.scenes) {
      const i = data.scenes.findIndex((h) => h.id === w.id);
      if (i >= 0 && (w.version ?? 0) > (data.scenes[i].version ?? 0)) { data.scenes[i] = w; console.log(`[store] upgraded scene ${w.id} to v${w.version}`); }
    }
    // A seed automation with a higher version replaces the stored one (its enabled flag survives).
    for (const w of seed.automations) {
      const i = data.automations.findIndex((h) => h.id === w.id);
      if (i >= 0 && (w.version ?? 0) > (data.automations[i].version ?? 0)) { data.automations[i] = { ...w, enabled: data.automations[i].enabled }; console.log(`[store] upgraded automation ${w.id} to v${w.version}`); }
    }
    add(data.devices, seed.devices, "device");
    // Devices the seed no longer ships and the person never configured (still mock) are dropped.
    for (const id of RETIRED_DEVICE_IDS) { const i = data.devices.findIndex((d) => d.id === id && d.driver === "mock"); if (i >= 0) { data.devices.splice(i, 1); console.log(`[store] retired device ${id}`); } }
    data.room.experience = normalizeExperience(data.room.experience);
    if (!data.room.teams) data.room.teams = seed.room.teams;
    if (!data.room.rivals) data.room.rivals = seed.room.rivals;
    return data;
  }

  get experience(): ExperienceSettings { return this.room.experience ?? (this.room.experience = normalizeExperience(undefined)); }

  setExperience(patch: Record<string, unknown>): ExperienceSettings {
    const e = this.experience;
    if (typeof patch.master === "boolean") e.master = patch.master;
    if (typeof patch.mode === "string" && (INTENSITY_MODES as readonly string[]).includes(patch.mode)) e.mode = patch.mode as ExperienceSettings["mode"];
    if (patch.limits && typeof patch.limits === "object") {
      const l = { ...DEFAULT_LIMITS, ...(e.limits ?? {}) } as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch.limits as Record<string, unknown>)) if (k in DEFAULT_LIMITS && (typeof v === "number" || typeof v === "string")) l[k] = v;
      e.limits = l as unknown as ExperienceSettings["limits"];
    }
    if (patch.categories && typeof patch.categories === "object") {
      for (const [k, v] of Object.entries(patch.categories as Record<string, { enabled?: unknown; intensity?: unknown }>)) {
        if (!(FX_CATEGORIES as readonly string[]).includes(k) || !v) continue;
        const c = e.categories[k as FxCategory];
        if (typeof v.enabled === "boolean") c.enabled = v.enabled;
        if (typeof v.intensity === "number") c.intensity = Math.max(0, Math.min(100, Math.round(v.intensity)));
      }
    }
    this.log({ kind: "manual", text: `Effects: ${e.master ? e.mode.replace("_", " ").toLowerCase() : "OFF"} · ${FX_CATEGORIES.filter((c) => !e.categories[c].enabled).map((c) => `${c} off`).join(", ") || "all categories on"}`, detail: { experience: e } });
    this.changed();
    return e;
  }

  /** Second-game displays name a game; keep its stats fresh as well. */
  private syncExtraStats(): void {
    this.watcher.extraStatIds = new Set(this.data.displays.map((d) => String(d.roleOptions?.gameId ?? "")).filter(Boolean));
  }
  get delayProfiles() { return this.data.delayProfiles; }

  async start(): Promise<void> {
    this.driverStatus = await this.devices.connectAll();
    this.leagues = await this.provider.getLeagues().catch(() => []);
    this.watcher.start();
    if (this.provider instanceof SimulatedProvider) this.provider.start();
    this.log({ kind: "system", text: `Room Agent ${VERSION} online. Provider ${this.provider.id} (${this.provider.status}). Drivers: ${Object.entries(this.driverStatus).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}` });
  }

  /** With nothing watched, follow the best game for the favorite teams. Never changes an existing choice. */
  private autoWatch(): void {
    if (this.room.watchedGameIds.length) return;
    const best = this.watcher.suggestions()[0];
    if (best) { this.watcher.setWatched([best.gameId]); this.log({ kind: "system", text: `Auto-selected ${best.gameId} (${best.reasons.join(", ")})` }); }
  }

  favoriteTeam(): Team | undefined {
    const fav = this.room.favoriteTeams.map((t) => t.toUpperCase());
    const g = this.watcher.games.get(this.room.watchedGameIds[0] ?? "");
    if (g) { if (fav.includes(g.home.abbreviation.toUpperCase())) return g.home; if (fav.includes(g.away.abbreviation.toUpperCase())) return g.away; }
    for (const game of this.watcher.games.values()) { if (fav.includes(game.home.abbreviation.toUpperCase())) return game.home; if (fav.includes(game.away.abbreviation.toUpperCase())) return game.away; }
    return g?.home;
  }

  log(e: Omit<TimelineEntry, "id" | "roomId" | "ts">): void {
    const entry: TimelineEntry = { id: uid("t"), roomId: this.room.id, ts: Date.now(), ...e };
    this.data.timeline.push(entry);
    if (this.data.timeline.length > 500) this.data.timeline.shift();
    console.log(`[${new Date(entry.ts).toLocaleTimeString()}] ${entry.kind.padEnd(10)} ${entry.text}`);
    this.emit("timeline", entry);
    void this.store.save(this.data);
  }

  changed(): void { this.emit("change"); void this.store.save(this.data); }

  updateRoom(patch: Record<string, unknown>): void {
    if (Array.isArray(patch.watchedGameIds)) this.watcher.setWatched(patch.watchedGameIds.map(String));
    if (Array.isArray(patch.favoriteTeams)) { this.room.favoriteTeams = patch.favoriteTeams.map(String); this.watcher.engine.setFavorites(this.room.favoriteTeams); }
    if (Array.isArray(patch.rivals)) this.room.rivals = patch.rivals.map((t) => String(t).toUpperCase());
    if (typeof patch.activeDelayProfileId === "string") this.room.activeDelayProfileId = patch.activeDelayProfileId;
    if (typeof patch.name === "string") this.room.name = patch.name;
    if (patch.automationsPausedUntil !== undefined) { this.room.automationsPausedUntil = patch.automationsPausedUntil ? Number(patch.automationsPausedUntil) : undefined; this.log({ kind: "manual", text: this.room.automationsPausedUntil ? "Automations paused" : "Automations resumed" }); }
    this.changed();
  }

  sync(profileId?: string, eventId?: string) {
    const profile = this.delayProfiles.find((p) => p.id === (profileId ?? this.room.activeDelayProfileId));
    if (!profile) throw new Error("no delay profile");
    const r = this.watcher.sync(profile, eventId);
    this.changed();
    return { delayMs: r.delayMs, anchor: r.anchor, profile };
  }

  addDelayProfile(name: string, delayMs: number): BroadcastDelayProfile {
    const p: BroadcastDelayProfile = { id: uid("delay"), roomId: this.room.id, name, delayMs };
    this.delayProfiles.push(p);
    this.changed();
    return p;
  }

  /** SIMULATED controls. Only works with the simulated provider and says so. */
  simulate(action: string, b: Record<string, unknown>): unknown {
    if (!(this.provider instanceof SimulatedProvider)) return { ok: false, error: "Simulation controls need PROVIDER=simulated" };
    const gameId = String(b.gameId ?? this.room.watchedGameIds[0] ?? "");
    if (action === "play") return { ok: true, play: this.provider.forcePlay(gameId, b.kind as "touchdown", b.side as "home" | undefined) };
    if (action === "overturn") return { ok: true, play: this.provider.forceOverturn(gameId) };
    if (action === "speed") { this.provider.setTickMs(Number(b.tickMs ?? 4000)); return { ok: true }; }
    return { ok: false, error: "unknown action" };
  }

  /** The address displays open: PUBLIC_URL if set, else this machine's LAN address and port. */
  baseUrl(): string {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
    const port = Number(process.env.PORT ?? 8790);
    for (const list of Object.values(os.networkInterfaces())) for (const n of list ?? []) if (n.family === "IPv4" && !n.internal) return `http://${n.address}:${port}`;
    return `http://localhost:${port}`;
  }

  /**
   * After a scene, every display whose device can open a URL (Fire Sticks, Fire TVs, Android TV
   * boxes) gets its own page pushed to it, unless that page already checked in during the last
   * minute. So Game Day puts the stats board on the left TV by itself.
   */
  private lastPushed = new Map<string, number>();

  async openDisplayPages(): Promise<void> {
    const base = this.baseUrl();
    for (const disp of this.displays.displays) {
      if (!disp.deviceId || disp.role === "OFF") continue;
      const dev = this.devices.get(disp.deviceId);
      if (!dev || !dev.capabilities.includes("url") || dev.driver === "mock") continue;
      // A scene may have just sent the device home (input switch, power), so a recent check-in
      // from the page proves nothing. Only a push we made ourselves in the last 15 s is skipped.
      if (Date.now() - (this.lastPushed.get(disp.id) ?? 0) < 15_000) continue;
      this.lastPushed.set(disp.id, Date.now());
      const url = disp.role === "PROJECTED_TICKER" ? `${base}/display/projector?mode=ticker` : `${base}/display/${disp.pairingCode}`;
      const r = await this.devices.execute(dev.id, { type: "open_url", url }, "scene");
      if (!r.ok) this.log({ kind: "device", text: `${dev.name}: could not open ${disp.name}'s page (${r.reason ?? "unknown"})`, detail: { deviceId: dev.id } });
    }
  }

  status(): AgentStatus {
    return { online: true, version: VERSION, startedAt: this.startedAt, provider: { id: this.provider.id, status: this.provider.status }, drivers: this.driverStatus, auth: this.authMode, availableDrivers: this.devices.driverIds() };
  }

  snapshot(): RoomSnapshot {
    return {
      room: this.room, agent: this.status(), devices: this.data.devices, displays: this.data.displays, presets: this.data.presets, scenes: this.data.scenes,
      automations: this.data.automations, delayProfiles: this.data.delayProfiles, games: [...this.watcher.games.values()], stats: Object.fromEntries(this.watcher.stats), leagues: this.leagues,
      pendingEvents: this.watcher.scheduler.pendingEvents(), recentEvents: this.watcher.recentEvents.slice(0, 40), recentRuns: this.data.runs.slice(-30).reverse(),
      timeline: this.data.timeline.slice(-120).reverse(), suggestions: this.watcher.suggestions(),
    };
  }
}
