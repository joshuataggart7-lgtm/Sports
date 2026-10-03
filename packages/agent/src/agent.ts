import { EventEmitter } from "node:events";
import { uid, type AgentStatus, type BroadcastDelayProfile, type DisplayOverlay, type Game, type IntegrationStatus, type League, type RoomSnapshot, type SportsEvent, type SportsProvider, type Team, type TimelineEntry } from "@room/core";
import { SimulatedProvider } from "@room/sports";
import { DeviceManager } from "./devices";
import { DisplayManager } from "./displays";
import { Orchestrator } from "./orchestrator";
import { GameWatcher } from "./watcher";
import type { RoomData, RoomStore } from "./store";

export const VERSION = "0.1.0";

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
    this.displays.on("overlay", (ids: string[] | "all", overlay: DisplayOverlay) => this.emit("overlay", ids, overlay));
    this.watcher.on("game", (g: Game) => this.emit("game", g));
    this.watcher.on("games", () => { this.autoWatch(); this.changed(); });
    this.watcher.on("event", (e: SportsEvent) => this.emit("event", e));
  }

  get room() { return this.data.room; }
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

  status(): AgentStatus {
    return { online: true, version: VERSION, startedAt: this.startedAt, provider: { id: this.provider.id, status: this.provider.status }, drivers: this.driverStatus, auth: this.authMode };
  }

  snapshot(): RoomSnapshot {
    return {
      room: this.room, agent: this.status(), devices: this.data.devices, displays: this.data.displays, presets: this.data.presets, scenes: this.data.scenes,
      automations: this.data.automations, delayProfiles: this.data.delayProfiles, games: [...this.watcher.games.values()], leagues: this.leagues,
      pendingEvents: this.watcher.scheduler.pendingEvents(), recentEvents: this.watcher.recentEvents.slice(0, 40), recentRuns: this.data.runs.slice(-30).reverse(),
      timeline: this.data.timeline.slice(-120).reverse(), suggestions: this.watcher.suggestions(),
    };
  }
}
