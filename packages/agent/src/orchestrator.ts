/**
 * The Room Orchestrator decides what the room does: modes become scenes, scenes become
 * timed device and display actions, sports events become automation runs. It never talks
 * to hardware directly; DeviceManager and DisplayManager do, through drivers.
 */
import { EventEmitter } from "node:events";
import { uid, type Automation, type AutomationCondition, type AutomationRun, type AutomationStep, type DeviceAction, type DeviceCommand, type DisplayAction, type Game, type Room, type RoomMode, type Scene, type SportsEvent, type Team, type TimelineEntry } from "@room/core";
import type { DeviceManager, Origin } from "./devices";
import type { DisplayManager } from "./displays";
import { applyExperience } from "./experience";
import { contextFor, render, type RenderContext } from "./template";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Orchestrator extends EventEmitter {
  runs: AutomationRun[];
  private activeRuns = new Map<string, { cancelled: boolean }>();
  private lastRun = new Map<string, number>();
  private favoriteTeam: () => Team | undefined;
  private primaryGame: () => Game | undefined;

  constructor(
    public room: Room,
    public scenes: Scene[],
    public automations: Automation[],
    runs: AutomationRun[],
    private devices: DeviceManager,
    private displays: DisplayManager,
    private log: (e: Omit<TimelineEntry, "id" | "roomId" | "ts">) => void,
    lookups: { favoriteTeam: () => Team | undefined; primaryGame: () => Game | undefined },
  ) {
    super();
    this.runs = runs;
    this.favoriteTeam = lookups.favoriteTeam;
    this.primaryGame = lookups.primaryGame;
  }

  // ------------------------------------------------------------------ modes & scenes

  sceneForMode(mode: RoomMode): Scene | undefined { return this.scenes.find((s) => s.mode === mode); }

  async setMode(mode: RoomMode, origin: Origin = "manual"): Promise<void> {
    const scene = this.sceneForMode(mode);
    if (!scene) throw new Error(`No scene for mode ${mode}`);
    const previous = this.room.mode;
    this.room.mode = mode;
    this.log({ kind: "mode", text: `${mode.replace("_", " ")} mode${previous ? ` (from ${previous.replace("_", " ")})` : ""}`, detail: { mode, previous, origin } });
    if (scene.suppressSportsAutomations) {
      // Movie Mode must stop celebrations at once, including ones mid-flight.
      for (const [id, flag] of this.activeRuns) { flag.cancelled = true; const run = this.runs.find((r) => r.id === id); if (run && run.status === "running") { run.status = "cancelled"; run.reason = `${mode} mode`; run.finishedAt = Date.now(); } }
      this.displays.overlay({ all: true }, { kind: "clear", durationMs: 0 });
    }
    this.emit("change");
    await this.runScene(scene, origin);
  }

  async runScene(scene: Scene, origin: Origin = "manual", event?: SportsEvent): Promise<void> {
    const game = this.primaryGame();
    const ctx = contextFor(event, game, this.favoriteTeam(), this.room.teams);
    if (game && ctx.team === undefined) ctx.team = contextFor(undefined, game, game.home, this.room.teams).team;
    const actions = [...scene.actions].sort((a, b) => a.delayMs - b.delayMs);
    const runId = uid("scene");
    this.devices.metrics.startRun(runId);
    const start = Date.now();
    if (scene.fx) this.log({ kind: "automation", text: `${scene.name}`, detail: { sceneId: scene.id, runId, origin } });
    await Promise.all(actions.map(async (a) => {
      const wait = start + a.delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      const action = render(a.action, ctx);
      if ("preset" in action) this.displays.applyPreset(action.preset, `scene ${scene.name}`);
      else if ("roleAssignment" in action) {
        const ra = action.roleAssignment;
        const targets = ra.displayId ? [this.displays.get(ra.displayId)] : this.displays.displays.filter((d) => d.kind === ra.displayKind);
        for (const d of targets) if (d) this.displays.setRole(d.id, ra.role, ra.roleOptions, `scene ${scene.name}`);
      } else if ("overlay" in action) this.showOverlay(action, !!scene.fx);
      else await this.runDeviceAction(action, origin === "manual" ? "scene" : origin, { fx: !!scene.fx, runId });
    }));
    this.emit("change");
    this.emit("scene", scene);
  }

  /** Display FX go through the Experience gate too; a disabled Display FX category hides overlays. */
  private showOverlay(action: DisplayAction, fx: boolean): void {
    const e = this.room.experience;
    if (fx && e && (!e.master || !e.categories.display?.enabled)) return;
    this.displays.overlay(action.target, action.overlay);
  }

  /**
   * Resolve the target, pass each command through the Experience gate when it is an effect,
   * and fire every device concurrently so one slow or dead device never holds the rest.
   */
  private async runDeviceAction(action: DeviceAction, origin: Origin, opts: { fx: boolean; runId?: string }): Promise<void> {
    const t = action.target;
    let targets: string[] = [];
    if ("device" in t) targets = [t.device];
    else if ("group" in t) targets = this.devices.byGroup(t.group).map((d) => d.id);
    else if ("deviceType" in t) targets = this.devices.byType(t.deviceType).map((d) => d.id);
    else if ("displayRole" in t) targets = this.displays.byRole(t.displayRole).map((d) => d.deviceId).filter((x): x is string => !!x);
    else if ("display" in t) { const d = this.displays.get(t.display); if (d?.deviceId) targets = [d.deviceId]; }
    await Promise.all(targets.map((id) => {
      const device = this.devices.get(id);
      if (!opts.fx) return this.devices.execute(id, action.command as DeviceCommand, origin, { runId: opts.runId });
      const gated = applyExperience(this.room.experience, action.command as DeviceCommand, device);
      if (!gated.command) { this.devices.metrics.record({ ts: Date.now(), deviceId: id, deviceName: device?.name ?? id, driver: device?.driver ?? "?", status: device?.status ?? "OFFLINE", command: (action.command as DeviceCommand).type, origin, category: gated.category, runId: opts.runId, durationMs: 0, ok: false, reason: gated.reason }); return undefined; }
      return this.devices.execute(id, gated.command, origin, { runId: opts.runId, category: gated.category });
    }));
  }

  // ------------------------------------------------------------------ automations

  isSuppressed(): string | undefined {
    const now = Date.now();
    if (this.room.automationsPausedUntil && this.room.automationsPausedUntil > now) return "automations paused";
    const scene = this.room.mode ? this.sceneForMode(this.room.mode) : undefined;
    if (scene?.suppressSportsAutomations) return `${this.room.mode} mode`;
    return undefined;
  }

  /** Called when the scheduler releases an event (already broadcast-delayed) or a manual button fires. */
  /** "@favorites" and "@opponents" resolve against the room's favorite teams; anything else is a plain abbreviation. */
  teamMatches(teams: string[], abbr: string): boolean {
    const a = abbr.toUpperCase();
    const favs = this.room.favoriteTeams.map((t) => t.toUpperCase());
    for (const t of teams) {
      if (t === "@favorites" && favs.includes(a)) return true;
      if (t === "@opponents" && !favs.includes(a)) return true;
      if (t.toUpperCase() === a) return true;
    }
    return false;
  }

  async handleEvent(event: SportsEvent, game: Game | undefined): Promise<void> {
    const watched = new Set(this.room.watchedGameIds);
    for (const auto of this.automations) {
      if (!auto.enabled) continue;
      const tr = auto.trigger;
      if (!tr.eventTypes.includes(event.type)) continue;
      if (event.source === "manual" && tr.manual === false) continue;
      if (event.source !== "manual" && (tr.watchedGamesOnly ?? true) && !watched.has(event.gameId)) continue;
      if (tr.teams?.length && event.teamAbbr && !this.teamMatches(tr.teams, event.teamAbbr)) continue;
      if (tr.teams?.length && !event.teamAbbr && event.source !== "manual") continue;
      const suppressed = this.isSuppressed();
      if (suppressed) { this.recordRun(auto, event, "suppressed", suppressed); continue; }
      if (auto.allowedModes?.length && (!this.room.mode || !auto.allowedModes.includes(this.room.mode))) { this.recordRun(auto, event, "suppressed", `not allowed in ${this.room.mode}`); continue; }
      const last = this.lastRun.get(auto.id) ?? 0;
      if (auto.cooldownMs && Date.now() - last < auto.cooldownMs) { this.recordRun(auto, event, "suppressed", "cooldown"); continue; }
      this.lastRun.set(auto.id, Date.now());
      void this.runAutomation(auto, event, game);
    }
  }

  private recordRun(auto: Automation, event: SportsEvent | undefined, status: AutomationRun["status"], reason?: string): AutomationRun {
    const run: AutomationRun = { id: uid("run"), automationId: auto.id, automationName: auto.name, eventId: event?.id, startedAt: Date.now(), finishedAt: status === "running" ? undefined : Date.now(), status, reason, log: [] };
    this.runs.push(run);
    if (this.runs.length > 200) this.runs.shift();
    if (status !== "running") this.log({ kind: "automation", text: `${auto.name}: ${status}${reason ? ` (${reason})` : ""}`, detail: { automationId: auto.id, eventId: event?.id } });
    this.emit("change");
    return run;
  }

  async runAutomation(auto: Automation, event: SportsEvent | undefined, game: Game | undefined): Promise<AutomationRun> {
    const run = this.recordRun(auto, event, "running");
    const flag = { cancelled: false };
    this.activeRuns.set(run.id, flag);
    const ctx = contextFor(event, game, this.favoriteTeam(), this.room.teams);
    const snapshot = this.snapshotLights();
    this.devices.metrics.startRun(run.id);
    const say = (text: string) => { run.log.push({ ts: Date.now(), text }); this.emit("change"); };
    this.log({ kind: "automation", text: `${auto.name} started${event ? ` for ${event.text}` : ""}`, detail: { automationId: auto.id, runId: run.id, eventId: event?.id } });
    try {
      await this.runSteps(auto.steps, ctx, event, flag, say, snapshot, run.id);
      run.status = flag.cancelled ? "cancelled" : "done";
    } catch (e) {
      run.status = "failed"; run.reason = (e as Error).message;
    } finally {
      run.finishedAt = Date.now();
      this.activeRuns.delete(run.id);
      this.log({ kind: "automation", text: `${auto.name} ${run.status}${run.reason ? ` (${run.reason})` : ""}`, detail: { runId: run.id } });
      this.emit("change");
    }
    return run;
  }

  private async runSteps(steps: AutomationStep[], ctx: RenderContext, event: SportsEvent | undefined, flag: { cancelled: boolean }, say: (t: string) => void, snapshot: LightSnapshot, runId?: string): Promise<void> {
    for (const step of steps) {
      if (flag.cancelled) return;
      if (step.kind === "wait") {
        const ms = step.ms === "broadcast_delay" ? Math.max(0, (event?.releaseAt ?? 0) - Date.now()) : step.ms;
        say(`wait ${step.ms === "broadcast_delay" ? `broadcast delay (${Math.round(ms / 100) / 10}s remaining)` : `${ms}ms`}`);
        // Sleep in slices so a cancellation (Movie Mode, reversal) lands promptly.
        const end = Date.now() + ms;
        while (Date.now() < end) { if (flag.cancelled) return; await sleep(Math.min(250, end - Date.now())); }
      } else if (step.kind === "do") {
        say(step.label ?? `do ${step.actions.length} action(s)`);
        const start = Date.now();
        await Promise.all(step.actions.map(async (raw) => {
          const a = render(raw, ctx);
          const wait = start + (a.delayMs ?? 0) - Date.now();
          if (wait > 0) await sleep(wait);
          if (flag.cancelled) return;
          if ("overlay" in a) this.showOverlay(a as DisplayAction, true);
          else await this.runDeviceAction(a as DeviceAction, "automation", { fx: true, runId });
        }));
      } else if (step.kind === "if") {
        const ok = this.evaluate(step.condition, event);
        say(`if ${JSON.stringify(step.condition)} → ${ok}`);
        await this.runSteps(ok ? step.then : step.else ?? [], ctx, event, flag, say, snapshot, runId);
      } else if (step.kind === "restore") {
        say(`restore ${step.what ?? "all"}`);
        await this.restore(step.what ?? "all", snapshot);
      } else if (step.kind === "scene") {
        const scene = this.scenes.find((s) => s.id === step.sceneId);
        if (scene) { say(`scene ${scene.name}`); await this.runScene(scene, "automation", event); }
      }
    }
  }

  private evaluate(c: AutomationCondition, event: SportsEvent | undefined): boolean {
    if ("not" in c) return !this.evaluate(c.not, event);
    if ("mode" in c) return !!this.room.mode && c.mode.includes(this.room.mode);
    if ("team" in c) return !!event?.teamAbbr && c.team.map((t) => t.toUpperCase()).includes(event.teamAbbr.toUpperCase());
    if ("minPoints" in c) return Number(event?.data.points ?? 0) >= c.minPoints;
    if ("scoreDiffAtMost" in c) return Math.abs(Number(event?.data.homeScore ?? 0) - Number(event?.data.awayScore ?? 0)) <= c.scoreDiffAtMost;
    if ("period" in c) return c.period.includes(Number(event?.data.period ?? -1));
    return false;
  }

  /** Reversal arrived: stop celebrations for that event. */
  cancelRunsForEvent(eventIds: string[], reason: string): number {
    let n = 0;
    for (const run of this.runs) {
      if (run.status === "running" && run.eventId && eventIds.includes(run.eventId)) {
        const flag = this.activeRuns.get(run.id);
        if (flag) flag.cancelled = true;
        run.status = "cancelled"; run.reason = reason; run.finishedAt = Date.now(); n++;
        this.log({ kind: "automation", text: `${run.automationName} cancelled: ${reason}`, detail: { runId: run.id } });
      }
    }
    if (n) { this.displays.overlay({ all: true }, { kind: "clear", durationMs: 0 }); void this.restore("lights", this.snapshotLights()); this.emit("change"); }
    return n;
  }

  // ------------------------------------------------------------------ restore

  private snapshotLights(): LightSnapshot {
    return this.devices.byType("light").map((d) => ({ id: d.id, power: d.state.power, color: d.state.color, brightness: d.state.brightness, effect: d.state.effect }));
  }

  private async restore(what: "lights" | "displays" | "audio" | "all", snapshot: LightSnapshot): Promise<void> {
    if (what === "lights" || what === "all") {
      for (const s of snapshot) {
        const d = this.devices.get(s.id);
        if (!d) continue;
        if (d.state.effect) await this.devices.execute(s.id, { type: "effect", effect: "off" }, "automation");
        if (s.color && s.color !== d.state.color && d.capabilities.includes("color")) await this.devices.execute(s.id, { type: "set_color", color: s.color, transitionMs: 1500 }, "automation");
        if (s.brightness !== undefined && s.brightness !== d.state.brightness && d.capabilities.includes("brightness")) await this.devices.execute(s.id, { type: "set_brightness", brightness: s.brightness }, "automation");
        if (s.power === "off" && d.state.power === "on") await this.devices.execute(s.id, { type: "power_off" }, "automation");
      }
    }
    if (what === "displays" || what === "all") this.displays.overlay({ all: true }, { kind: "clear", durationMs: 0 });
    if (what === "audio" || what === "all") for (const d of this.devices.byType("av_receiver")) if (d.state.playing) Object.assign(d.state, { playing: null });
  }
}

type LightSnapshot = Array<{ id: string; power?: string; color?: string; brightness?: number; effect?: string }>;
