/**
 * EventEngine: turns consecutive game snapshots (and plays when a provider has them)
 * into typed SportsEvents. Deterministic ids make duplicates impossible to celebrate twice,
 * score decreases become SCORE_CORRECTION events that reverse what they undo, and
 * per-type cooldowns stop a chatty feed from spamming the room.
 */
import { hashId, type Game, type Play, type SportsEvent, type SportsEventType } from "@room/core";

export interface EngineOptions {
  favoriteTeams?: string[];
  cooldownsMs?: Partial<Record<SportsEventType, number>>;
  now?: () => number;
}

const DEFAULT_COOLDOWNS: Partial<Record<SportsEventType, number>> = { BIG_PLAY: 30_000, RED_ZONE: 45_000, LEAD_CHANGE: 10_000 };
const REGULATION: Record<string, number> = { football: 4, basketball: 4, hockey: 3, soccer: 2, baseball: 9 };

export class EventEngine {
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private lastFired = new Map<string, number>();
  private favorites: Set<string>;
  private cooldowns: Partial<Record<SportsEventType, number>>;
  private now: () => number;
  /** Scoring events per game so a correction can reverse them. */
  private scoreEvents = new Map<string, SportsEvent[]>();

  constructor(opts: EngineOptions = {}) {
    this.favorites = new Set((opts.favoriteTeams ?? []).map((t) => t.toUpperCase()));
    this.cooldowns = { ...DEFAULT_COOLDOWNS, ...(opts.cooldownsMs ?? {}) };
    this.now = opts.now ?? (() => Date.now());
  }

  setFavorites(teams: string[]): void { this.favorites = new Set(teams.map((t) => t.toUpperCase())); }

  /** Returns new events plus the ids of earlier events this update reversed. */
  derive(prev: Game | undefined, next: Game, plays: Play[] = []): { events: SportsEvent[]; reversedIds: string[] } {
    const out: SportsEvent[] = [];
    const reversedIds: string[] = [];
    const ts = this.now();
    const mk = (type: SportsEventType, side: "home" | "away" | undefined, data: Record<string, unknown>, text: string, keyParts: Array<string | number | undefined>, confidence = 0.9): SportsEvent => ({
      id: hashId(next.id, type, side, ...keyParts), gameId: next.id, ts, type, side,
      teamId: side ? next[side].id : undefined, teamAbbr: side ? next[side].abbreviation : undefined,
      data, confidence, state: "pending", source: "provider", text,
    });

    if (!prev) {
      // First sight of a game is a baseline, never a celebration. Live games still announce themselves.
      if (next.status === "live") out.push(mk("GAME_START", undefined, { baseline: true }, `${next.away.abbreviation} @ ${next.home.abbreviation} is live`, ["start"], 1));
      return { events: this.admit(out), reversedIds };
    }

    if (prev.status === "scheduled" && (next.status === "live" || next.status === "halftime")) out.push(mk("GAME_START", undefined, {}, `${next.away.abbreviation} @ ${next.home.abbreviation} kicks off`, ["start"], 1));
    if (next.period !== prev.period && next.status !== "final") {
      if (prev.period > 0) out.push(mk("PERIOD_END", undefined, { period: prev.period }, `End of ${prev.periodLabel || "period " + prev.period}`, ["pend", prev.period], 1));
      out.push(mk("PERIOD_START", undefined, { period: next.period }, `${next.periodLabel || "Period " + next.period} begins`, ["pstart", next.period], 1));
      if (next.period > (REGULATION[next.sport] ?? 4) && prev.period <= (REGULATION[next.sport] ?? 4)) out.push(mk("OVERTIME", undefined, { period: next.period }, `Overtime: ${next.away.abbreviation} ${next.awayScore} ${next.home.abbreviation} ${next.homeScore}`, ["ot", next.period], 1));
    }

    // Scores
    for (const side of ["home", "away"] as const) {
      const before = side === "home" ? prev.homeScore : prev.awayScore;
      const after = side === "home" ? next.homeScore : next.awayScore;
      if (after > before) {
        const points = after - before;
        const scoreText = `${next.away.abbreviation} ${next.awayScore} - ${next.home.abbreviation} ${next.homeScore}`;
        const key = [next.period, next.homeScore, next.awayScore];
        const base = { points, homeScore: next.homeScore, awayScore: next.awayScore, score: scoreText, lastPlay: next.situation.lastPlay };
        const specific = this.classifyScore(next, side, points, plays);
        const change = mk("SCORE_CHANGE", side, { ...base, kind: specific?.type }, next.sport === "baseball" ? `${next[side].abbreviation} scores ${points > 1 ? points + " runs" : "a run"}  ${scoreText}` : `${next[side].abbreviation} +${points}  ${scoreText}`, key, 0.95);
        out.push(change);
        if (specific) {
          const ev = mk(specific.type, side, { ...base, ...specific.data }, `${specific.label} ${next[side].abbreviation}  ${scoreText}`, [...key, specific.type], 0.9);
          out.push(ev);
          if (specific.secondary) out.push(mk(specific.secondary, side, { ...base, points: specific.secondaryPoints }, `${next[side].abbreviation} ${specific.secondary === "EXTRA_POINT" ? "extra point" : "two-point conversion"}`, [...key, specific.secondary], 0.85));
        }
        this.track(next.id, change);
      } else if (after < before) {
        // Reversal. Undo what we celebrated, then tell the room the score was corrected.
        const undone = (this.scoreEvents.get(next.id) ?? []).filter((e) => e.side === side && (side === "home" ? Number(e.data.homeScore) : Number(e.data.awayScore)) > after);
        for (const e of undone) { e.state = "reversed"; reversedIds.push(e.id); }
        this.scoreEvents.set(next.id, (this.scoreEvents.get(next.id) ?? []).filter((e) => !undone.includes(e)));
        out.push(mk("SCORE_CORRECTION", side, { from: before, to: after, homeScore: next.homeScore, awayScore: next.awayScore, reversedIds: undone.map((e) => e.id) }, `Score corrected: ${next.away.abbreviation} ${next.awayScore} - ${next.home.abbreviation} ${next.homeScore}`, [next.period, next.homeScore, next.awayScore, "corr"], 1));
      }
    }

    // Lead change
    const leadBefore = Math.sign(prev.homeScore - prev.awayScore), leadAfter = Math.sign(next.homeScore - next.awayScore);
    if (leadAfter !== 0 && leadBefore !== leadAfter && (prev.homeScore + prev.awayScore) > 0) {
      const side = leadAfter > 0 ? "home" : "away";
      out.push(mk("LEAD_CHANGE", side, { homeScore: next.homeScore, awayScore: next.awayScore }, `${next[side].abbreviation} takes the lead ${Math.max(next.homeScore, next.awayScore)}-${Math.min(next.homeScore, next.awayScore)}`, [next.period, next.homeScore, next.awayScore]));
    }

    // Situation: red zone, turnovers, big plays (football)
    const s = next.situation, ps = prev.situation;
    if (s.redZone && !ps.redZone && s.possession) out.push(mk("RED_ZONE", s.possession, { yardLine: s.yardLine, text: s.yardLineText }, `${next[s.possession].abbreviation} in the red zone`, [next.period, next.homeScore, next.awayScore, s.possession, Math.floor((next.clockSeconds ?? 0) / 120)], 0.8));
    const scored = next.homeScore !== prev.homeScore || next.awayScore !== prev.awayScore;
    if (s.possession && ps.possession && s.possession !== ps.possession && !scored && next.period === prev.period) {
      const turnoverPlay = plays.find((p) => p.type === "interception" || p.type === "fumble");
      const lastText = (s.lastPlay ?? "").toLowerCase();
      const kind = turnoverPlay?.type ?? (lastText.includes("intercept") ? "interception" : lastText.includes("fumble") ? "fumble" : undefined);
      if (kind) {
        const lost = ps.possession;
        out.push(mk("TURNOVER", s.possession, { kind, lostBy: next[lost].abbreviation, lastPlay: s.lastPlay }, `${next[s.possession].abbreviation} takes it away (${kind})`, [next.period, prev.seq, kind]));
        out.push(mk(kind === "interception" ? "INTERCEPTION" : "FUMBLE", s.possession, { lostBy: next[lost].abbreviation, lastPlay: s.lastPlay }, `${kind === "interception" ? "Interception" : "Fumble recovery"} by ${next[s.possession].abbreviation}`, [next.period, prev.seq, kind, "x"]));
      }
    }
    for (const p of plays) if (!p.scoring && (p.yards ?? 0) >= 25 && p.team) out.push(mk("BIG_PLAY", p.team, { yards: p.yards, text: p.text }, `Big play: ${p.text}`, [p.id], 0.8));

    // End
    if (prev.status !== "final" && next.status === "final") {
      const winner = next.homeScore > next.awayScore ? "home" : next.awayScore > next.homeScore ? "away" : undefined;
      out.push(mk("GAME_END", winner, { homeScore: next.homeScore, awayScore: next.awayScore }, `Final: ${next.away.abbreviation} ${next.awayScore} ${next.home.abbreviation} ${next.homeScore}`, ["end"], 1));
      if (winner) {
        const loser = winner === "home" ? "away" : "home";
        if (this.favorites.has(next[winner].abbreviation.toUpperCase())) out.push(mk("WIN", winner, {}, `${next[winner].name} win!`, ["win"], 1));
        if (this.favorites.has(next[loser].abbreviation.toUpperCase())) out.push(mk("LOSS", loser, {}, `${next[loser].name} fall ${next[loser === "home" ? "homeScore" : "awayScore"]}-${next[winner === "home" ? "homeScore" : "awayScore"]}`, ["loss"], 1));
      }
    }
    return { events: this.admit(out), reversedIds };
  }

  /** Manual events bypass dedup against the feed but still get ids and cooldowns. */
  manual(game: Game | undefined, type: SportsEventType, side: "home" | "away" | undefined, text?: string): SportsEvent {
    const ts = this.now();
    const team = game && side ? game[side] : undefined;
    return {
      id: hashId("manual", game?.id, type, side, ts), gameId: game?.id ?? "manual", ts, type, side,
      teamId: team?.id, teamAbbr: team?.abbreviation, data: { manual: true, points: type === "TOUCHDOWN" ? 6 : type === "FIELD_GOAL" ? 3 : type === "THREE_POINTER" ? 3 : type === "DUNK" ? 2 : type === "HOME_RUN" || type === "SCORE_CHANGE" ? 1 : 0, score: game ? `${game.away.abbreviation} ${game.awayScore} - ${game.home.abbreviation} ${game.homeScore}` : "" },
      confidence: 1, state: "pending", source: "manual",
      text: text ?? `${type.replace(/_/g, " ")}${team ? " " + team.abbreviation : ""}`,
    };
  }

  private classifyScore(game: Game, side: "home" | "away", points: number, plays: Play[]): { type: SportsEventType; label: string; data: Record<string, unknown>; secondary?: SportsEventType; secondaryPoints?: number } | undefined {
    const scoringPlays = plays.filter((p) => p.scoring && p.team === side && !p.reversed);
    if (game.sport === "football") {
      if (scoringPlays.some((p) => p.type === "safety") || (points === 2 && scoringPlays.length === 0 && /safety/i.test(game.situation.lastPlay ?? ""))) return { type: "SAFETY", label: "Safety", data: {} };
      if (points === 6) return { type: "TOUCHDOWN", label: "Touchdown", data: {} };
      if (points === 7) return { type: "TOUCHDOWN", label: "Touchdown", data: {}, secondary: "EXTRA_POINT", secondaryPoints: 1 };
      if (points === 8) return { type: "TOUCHDOWN", label: "Touchdown", data: {}, secondary: "TWO_POINT", secondaryPoints: 2 };
      if (points === 3) return { type: "FIELD_GOAL", label: "Field goal", data: {} };
      if (points === 1) return { type: "EXTRA_POINT", label: "Extra point", data: {} };
      if (points === 2) return { type: "TWO_POINT", label: "Two-point conversion", data: {} };
      return undefined;
    }
    if (game.sport === "basketball") {
      if (scoringPlays.some((p) => p.type === "dunk")) return { type: "DUNK", label: "Dunk", data: {} };
      if (points === 3 || scoringPlays.some((p) => p.type === "three_pointer")) return { type: "THREE_POINTER", label: "Three", data: {} };
      return undefined;
    }
    if (game.sport === "hockey" || game.sport === "soccer") return { type: "GOAL", label: "Goal", data: {} };
    if (game.sport === "baseball") {
      const lp = game.situation.lastPlay ?? "";
      if (scoringPlays.some((p) => /home_run|homer/i.test(p.type)) || /home run|homers|homered|grand slam/i.test(lp)) return { type: "HOME_RUN", label: points > 1 ? `${points}-run homer` : "Home run", data: { runs: points } };
      return undefined; // a plain run is a SCORE_CHANGE with points = runs
    }
    return undefined;
  }

  private track(gameId: string, ev: SportsEvent): void {
    const list = this.scoreEvents.get(gameId) ?? [];
    list.push(ev);
    if (list.length > 60) list.shift();
    this.scoreEvents.set(gameId, list);
  }

  private admit(events: SportsEvent[]): SportsEvent[] {
    const out: SportsEvent[] = [];
    for (const e of events) {
      if (this.seen.has(e.id)) continue;
      const cd = this.cooldowns[e.type];
      const cdKey = `${e.gameId}:${e.type}:${e.side ?? ""}`;
      if (cd && this.now() - (this.lastFired.get(cdKey) ?? -Infinity) < cd) continue;
      this.seen.add(e.id); this.seenOrder.push(e.id);
      if (this.seenOrder.length > 5000) this.seen.delete(this.seenOrder.shift()!);
      if (cd) this.lastFired.set(cdKey, this.now());
      out.push(e);
    }
    return out;
  }
}
