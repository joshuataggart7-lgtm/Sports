/**
 * GameWatcher: subscribes to watched games, runs the EventEngine over every update,
 * schedules the resulting events behind the active broadcast delay, and hands released
 * events to the orchestrator. Reversals cancel whatever has not reached the room yet.
 */
import { EventEmitter } from "node:events";
import { EVENT_BASE_IMPORTANCE, type BroadcastDelayProfile, type EventContext, type Game, type GameStats, type Play, type Room, type SportsEvent, type SportsProvider, type TimelineEntry, type Unsubscribe } from "@room/core";
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
    this.scheduler.onRelease((e) => { const game = this.games.get(e.gameId); e.context = this.contextFor(e, game); this.remember(e); this.emit("event", e); this.onRelease(e, game); });
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
    const wpNow = this.stats.get(game.id)?.winProbabilityHome;
    // Refresh stats shortly before the events release so win probability and the drive summary reflect the play.
    if (events.length && this.provider.getGameStats) setTimeout(() => void this.refreshStats(), Math.max(500, delay - 3000));
    for (const e of events) {
      // Win probability before the play, read at feed time; the swing is measured when the event releases.
      if (wpNow !== undefined) e.data.wpBefore = wpNow;
      this.scheduler.schedule(e, delay);
      this.remember(e);
      this.emit("event", e);
      this.log({ kind: "event", text: `${e.text} (feed; room in ${Math.round(delay / 1000)}s)`, detail: { eventId: e.id, type: e.type } });
    }
  }

  /**
   * Derived context for a released event: how important it is, how tense the game is, whether
   * it belongs to the primary game, the latest drive summary. The orchestrator scales effects and
   * picks scene flavors from this; nothing here names hardware.
   */
  contextFor(e: SportsEvent, game: Game | undefined): EventContext {
    const st = this.stats.get(e.gameId);
    const primaryGame = !game || e.gameId === (this.room.watchedGameIds[0] ?? e.gameId) || e.source === "manual";
    const favs = this.room.favoriteTeams.map((t) => t.toUpperCase());
    const rivals = (this.room.rivals ?? []).map((t) => t.toUpperCase());
    const opp = game && e.side ? game[e.side === "home" ? "away" : "home"].abbreviation.toUpperCase() : undefined;
    const both = game ? [game.home.abbreviation.toUpperCase(), game.away.abbreviation.toUpperCase()] : [];
    const rivalry = !!game && both.some((t) => favs.includes(t)) && both.some((t) => rivals.includes(t)) && (!opp || rivals.includes(opp) || favs.includes(opp));
    const margin = game ? Math.abs(game.homeScore - game.awayScore) : 99;
    const reg = game?.sport === "football" ? 4 : game?.sport === "basketball" ? 4 : game?.sport === "hockey" ? 3 : 9;
    const lateGame = !!game && game.status !== "final" && game.period >= reg && (game.clockSeconds ?? 9999) <= 300;
    const oneScore = margin <= (game?.sport === "football" ? 8 : game?.sport === "basketball" ? 3 : 1);
    // Win probability from the event team's point of view.
    const wpHome = st?.winProbabilityHome;
    const sideSign = e.side === "away" ? -1 : 1;
    const wp = wpHome === undefined ? undefined : e.side === "away" ? 1 - wpHome : wpHome;
    const before = typeof e.data.wpBefore === "number" ? e.data.wpBefore : undefined;
    const wpDelta = wpHome !== undefined && before !== undefined ? Math.round((wpHome - before) * sideSign * 1000) / 1000 : undefined;
    let importance = EVENT_BASE_IMPORTANCE[e.type] ?? 0.3;
    if (wpDelta !== undefined) importance += Math.min(0.5, Math.abs(wpDelta) * 1.5);
    if (e.data.long) importance += 0.15;
    if (lateGame && oneScore) importance += 0.15;
    if (rivalry) importance += 0.1;
    let pressure = e.type === "FOURTH_DOWN" ? 0.65 : e.type === "THIRD_DOWN" ? 0.35 : e.type === "RED_ZONE" ? 0.4 : e.type === "TWO_MINUTE" ? 0.5 : 0;
    if (pressure && game?.situation.redZone) pressure += 0.15;
    if (pressure && lateGame && oneScore) pressure += 0.2;
    const drive = st?.drives?.[0];
    return { importance: Math.round(Math.min(1.5, importance) * 100) / 100, pressure: Math.round(Math.min(1, pressure) * 100) / 100, wpDelta, wp, lateGame, oneScore, rivalry, primaryGame, drive };
  }

  /** Manual button: fires now, no delay, and the timeline says a person did it. */
  manual(type: SportsEvent["type"], side?: "home" | "away", gameId?: string): SportsEvent {
    const game = this.games.get(gameId ?? this.room.watchedGameIds[0] ?? "");
    const ev = this.engine.manual(game, type, side);
    ev.state = "released"; ev.releaseAt = ev.ts;
    ev.context = this.contextFor(ev, game);
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
