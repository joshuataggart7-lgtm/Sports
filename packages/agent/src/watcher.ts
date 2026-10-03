/**
 * GameWatcher: subscribes to watched games, runs the EventEngine over every update,
 * schedules the resulting events behind the active broadcast delay, and hands released
 * events to the orchestrator. Reversals cancel whatever has not reached the room yet.
 */
import { EventEmitter } from "node:events";
import type { BroadcastDelayProfile, Game, GameStats, Play, Room, SportsEvent, SportsProvider, TimelineEntry, Unsubscribe } from "@room/core";
import { DelayScheduler, EventEngine, rankGames, type GameInterest } from "@room/engine";

export class GameWatcher extends EventEmitter {
  games = new Map<string, Game>();
  stats = new Map<string, GameStats>();
  /** Extra game ids displays are showing (second-game screens), so their stats stay fresh too. */
  extraStatIds = new Set<string>();
  readonly engine: EventEngine;
  readonly scheduler = new DelayScheduler();
  recentEvents: SportsEvent[] = [];
  private subs = new Map<string, Unsubscribe>();
  private timers: NodeJS.Timeout[] = [];

  constructor(
    public provider: SportsProvider,
    private room: Room,
    private profiles: () => BroadcastDelayProfile[],
    private onRelease: (event: SportsEvent, game: Game | undefined) => void,
    private onReversal: (ids: string[]) => void,
    private log: (e: Omit<TimelineEntry, "id" | "roomId" | "ts">) => void,
  ) {
    super();
    this.engine = new EventEngine({ favoriteTeams: room.favoriteTeams });
    this.scheduler.onRelease((e) => { this.remember(e); this.emit("event", e); this.onRelease(e, this.games.get(e.gameId)); });
    this.scheduler.onCancel((e, reason) => { this.remember(e); this.log({ kind: "event", text: `${e.text} ${reason === "reversed" ? "reversed before it reached the room" : "cancelled"}`, detail: { eventId: e.id } }); this.emit("event", e); });
  }

  start(): void {
    this.timers.push(setInterval(() => this.scheduler.pump(), 200));
    this.timers.push(setInterval(() => void this.refreshGames(), 30_000));
    this.timers.push(setInterval(() => void this.refreshStats(), 15_000));
    void this.refreshGames().then(() => { this.syncSubscriptions(); void this.refreshStats(); });
  }

  stop(): void { for (const t of this.timers) clearInterval(t); for (const u of this.subs.values()) u(); }

  delayMs(): number {
    const p = this.profiles().find((x) => x.id === this.room.activeDelayProfileId);
    return p?.delayMs ?? 0;
  }

  async refreshGames(): Promise<void> {
    try {
      const games = await this.provider.getGames();
      for (const g of games) if (!this.subs.has(g.id)) this.games.set(g.id, g);
      this.emit("games");
    } catch (e) { this.log({ kind: "system", text: `Sports feed unavailable: ${(e as Error).message}` }); }
  }

  async refreshStats(): Promise<void> {
    if (!this.provider.getGameStats) return;
    const ids = new Set([...this.room.watchedGameIds, ...this.extraStatIds]);
    for (const id of ids) {
      try {
        const st = await this.provider.getGameStats(id);
        if (st) { this.stats.set(id, st); this.emit("stats", st); }
      } catch (e) { this.log({ kind: "system", text: `Stats unavailable for ${id}: ${(e as Error).message}` }); }
    }
  }

  setWatched(ids: string[]): void {
    this.room.watchedGameIds = ids;
    this.engine.setFavorites(this.room.favoriteTeams);
    this.syncSubscriptions();
  }

  private syncSubscriptions(): void {
    const want = new Set(this.room.watchedGameIds);
    for (const [id, unsub] of this.subs) if (!want.has(id)) { unsub(); this.subs.delete(id); }
    for (const id of want) if (!this.subs.has(id)) {
      this.subs.set(id, this.provider.subscribeToGame(id, (game, plays) => this.onUpdate(game, plays)));
      this.log({ kind: "system", text: `Watching ${id}` });
    }
    void this.refreshStats();
  }

  private onUpdate(game: Game, plays: Play[]): void {
    const prev = this.games.get(game.id);
    this.games.set(game.id, game);
    this.emit("game", game);
    const { events, reversedIds } = this.engine.derive(prev, game, plays);
    if (reversedIds.length) {
      const cancelled = this.scheduler.cancelWhere((e) => reversedIds.includes(e.id) || (e.gameId === game.id && e.ts >= Math.min(...this.recentEvents.filter((x) => reversedIds.includes(x.id)).map((x) => x.ts), Infinity)), "reversed");
      this.onReversal(reversedIds);
      this.log({ kind: "event", text: `Play overturned in ${game.away.abbreviation} @ ${game.home.abbreviation}; ${cancelled} queued reaction(s) withdrawn`, detail: { reversedIds } });
    }
    const delay = this.delayMs();
    for (const e of events) {
      this.scheduler.schedule(e, delay);
      this.remember(e);
      this.emit("event", e);
      this.log({ kind: "event", text: `${e.text} (feed; room in ${Math.round(delay / 1000)}s)`, detail: { eventId: e.id, type: e.type } });
    }
  }

  /** Manual button: fires now, no delay, and the timeline says a person did it. */
  manual(type: SportsEvent["type"], side?: "home" | "away", gameId?: string): SportsEvent {
    const game = this.games.get(gameId ?? this.room.watchedGameIds[0] ?? "");
    const ev = this.engine.manual(game, type, side);
    ev.state = "released"; ev.releaseAt = ev.ts;
    this.remember(ev);
    this.emit("event", ev);
    this.log({ kind: "manual", text: ev.text, detail: { eventId: ev.id } });
    this.onRelease(ev, game);
    return ev;
  }

  sync(profile: BroadcastDelayProfile, anchorEventId?: string): { delayMs: number; anchor?: SportsEvent } {
    const r = this.scheduler.syncToTv(profile, anchorEventId);
    this.log({ kind: "sync", text: r.anchor ? `Synced to TV: ${(r.delayMs / 1000).toFixed(1)}s behind the feed (${r.anchor.text})` : `No recent event to sync against; delay stays ${(r.delayMs / 1000).toFixed(1)}s`, detail: { profileId: profile.id, delayMs: r.delayMs } });
    return r;
  }

  suggestions(): GameInterest[] { return rankGames([...this.games.values()], this.room.favoriteTeams).slice(0, 5); }

  private remember(e: SportsEvent): void {
    const i = this.recentEvents.findIndex((x) => x.id === e.id);
    if (i >= 0) this.recentEvents[i] = e; else this.recentEvents.unshift(e);
    if (this.recentEvents.length > 100) this.recentEvents.pop();
  }
}
