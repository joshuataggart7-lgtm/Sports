/**
 * SIMULATED sports provider.
 *
 * A self-contained football/basketball simulation with drives, a clock, possession,
 * downs, the red zone, scoring, overtime and occasional overturned plays. It exists so
 * the whole room (events, delay sync, automations, displays) can be proven without a
 * paid feed or a game on TV. Deterministic given a seed; speed is adjustable.
 */
import type { Game, League, Play, SportsProvider, Standing, Team, Unsubscribe } from "@room/core";

const LEAGUES: League[] = [
  { id: "ncaaf", name: "College Football", sport: "football" },
  { id: "nfl", name: "NFL", sport: "football" },
  { id: "nba", name: "NBA", sport: "basketball" },
];

/** Logos come from ESPN's public CDN (personal, in-home use). */
const LOGOS: Record<string, string> = {
  MISS: "https://a.espncdn.com/i/teamlogos/ncaa/500/145.png", LSU: "https://a.espncdn.com/i/teamlogos/ncaa/500/99.png",
  ALA: "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png", UGA: "https://a.espncdn.com/i/teamlogos/ncaa/500/61.png",
  NO: "https://a.espncdn.com/i/teamlogos/nfl/500/no.png", ATL: "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png",
  DAL: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png", PHI: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png",
  BOS: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png", NYK: "https://a.espncdn.com/i/teamlogos/nba/500/nyk.png",
};

function team(leagueId: string, abbreviation: string, name: string, shortName: string, primary: string, secondary: string, celebration: Team["profile"]["celebration"] = "pulse"): Team {
  return { id: `${leagueId}:${abbreviation}`, leagueId, abbreviation, name, shortName, logoUrl: LOGOS[abbreviation], record: "4-1", profile: { primaryColor: primary, secondaryColor: secondary, celebration } };
}

export const SIM_TEAMS: Team[] = [
  team("ncaaf", "MISS", "Ole Miss Rebels", "Ole Miss", "#CE1126", "#14213D", "chase"),
  team("ncaaf", "LSU", "LSU Tigers", "LSU", "#461D7C", "#FDD023"),
  team("ncaaf", "ALA", "Alabama Crimson Tide", "Alabama", "#9E1B32", "#828A8F"),
  team("ncaaf", "UGA", "Georgia Bulldogs", "Georgia", "#BA0C2F", "#000000"),
  team("nfl", "NO", "New Orleans Saints", "Saints", "#D3BC8D", "#101820"),
  team("nfl", "ATL", "Atlanta Falcons", "Falcons", "#A71930", "#000000"),
  team("nfl", "DAL", "Dallas Cowboys", "Cowboys", "#041E42", "#869397"),
  team("nfl", "PHI", "Philadelphia Eagles", "Eagles", "#004C54", "#A5ACAF"),
  team("nba", "BOS", "Boston Celtics", "Celtics", "#007A33", "#BA9653"),
  team("nba", "NYK", "New York Knicks", "Knicks", "#006BB6", "#F58426"),
];

const byAbbr = (abbr: string) => SIM_TEAMS.find((t) => t.abbreviation === abbr)!;

function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

interface SimState {
  game: Game;
  clockSeconds: number;
  yardLine: number;     // 0..100 from offense's own goal
  down: number;
  distance: number;
  plays: Play[];
  seq: number;
  pendingOverturn?: { inTicks: number; play: Play };
  halftimeTicks?: number;
  finalTicks?: number;
  driveId: number;
}

export interface SimulatedOptions {
  seed?: number;
  /** Real ms between plays. */
  tickMs?: number;
  /** 0..1 chance a touchdown gets overturned two plays later. */
  overturnRate?: number;
  /** Start games already live. */
  startLive?: boolean;
}

export class SimulatedProvider implements SportsProvider {
  id = "simulated";
  status = "SIMULATED" as const;
  private rnd: () => number;
  private games = new Map<string, SimState>();
  private subs = new Map<string, Set<(g: Game, p: Play[]) => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickMs: number;
  private overturnRate: number;

  constructor(opts: SimulatedOptions = {}) {
    this.rnd = prng(opts.seed ?? 7);
    this.tickMs = opts.tickMs ?? 6000;
    this.overturnRate = opts.overturnRate ?? 0.08;
    const now = Date.now();
    const live = opts.startLive ?? true;
    this.add("ncaaf", "MISS", "LSU", now - 50 * 60_000, live, { period: 4, clock: 582, home: 31, away: 24 }, "Vaught-Hemingway Stadium", "ESPN");
    this.add("nfl", "ATL", "NO", now - 40 * 60_000, live, { period: 3, clock: 540, home: 17, away: 21 }, "Mercedes-Benz Stadium", "FOX");
    this.add("nfl", "PHI", "DAL", now - 35 * 60_000, live, { period: 3, clock: 300, home: 24, away: 27 }, "Lincoln Financial Field", "CBS");
    this.add("nba", "NYK", "BOS", now - 70 * 60_000, live, { period: 4, clock: 180, home: 98, away: 102 }, "Madison Square Garden", "TNT");
    this.add("ncaaf", "UGA", "ALA", now + 3 * 3600_000, false, { period: 0, clock: 900, home: 0, away: 0 }, "Sanford Stadium", "CBS");
  }

  private add(leagueId: string, homeAbbr: string, awayAbbr: string, startTime: number, live: boolean, s: { period: number; clock: number; home: number; away: number }, venue: string, broadcast: string): void {
    const league = LEAGUES.find((l) => l.id === leagueId)!;
    const id = `sim:${leagueId}:${awayAbbr}@${homeAbbr}`;
    const game: Game = {
      id, leagueId, sport: league.sport, startTime, status: live ? "live" : "scheduled", period: s.period,
      periodLabel: live ? periodLabel(league.sport, s.period) : "", clock: fmtClock(s.clock), clockSeconds: s.clock,
      home: byAbbr(homeAbbr), away: byAbbr(awayAbbr), homeScore: s.home, awayScore: s.away,
      situation: league.sport === "football" ? { possession: "home", down: 1, distance: 10, yardLine: 38, yardLineText: `${homeAbbr} 38`, redZone: false } : {},
      venue, broadcast, seq: 1, updatedAt: Date.now(),
    };
    this.games.set(id, { game, clockSeconds: s.clock, yardLine: 38, down: 1, distance: 10, plays: [], seq: 1, driveId: 1 });
  }

  // ------------------------------------------------------------------ provider surface

  async getLeagues(): Promise<League[]> { return LEAGUES; }
  async getGames(_date?: Date, leagueId?: string): Promise<Game[]> {
    return [...this.games.values()].map((s) => structuredClone(s.game)).filter((g) => !leagueId || g.leagueId === leagueId);
  }
  async getGame(gameId: string): Promise<Game | undefined> { const s = this.games.get(gameId); return s ? structuredClone(s.game) : undefined; }
  async getTeams(leagueId: string): Promise<Team[]> { return SIM_TEAMS.filter((t) => t.leagueId === leagueId); }
  async getStandings(leagueId: string): Promise<Standing[]> {
    return SIM_TEAMS.filter((t) => t.leagueId === leagueId).map((t, i) => ({ team: t, wins: 5 - (i % 3), losses: i % 3, rank: i + 1 }));
  }
  async getPlayByPlay(gameId: string): Promise<Play[]> { return [...(this.games.get(gameId)?.plays ?? [])]; }
  subscribeToGame(gameId: string, onUpdate: (game: Game, plays: Play[]) => void): Unsubscribe {
    if (!this.subs.has(gameId)) this.subs.set(gameId, new Set());
    this.subs.get(gameId)!.add(onUpdate);
    const s = this.games.get(gameId);
    if (s) onUpdate(structuredClone(s.game), []);
    return () => this.subs.get(gameId)?.delete(onUpdate);
  }

  // ------------------------------------------------------------------ simulation control

  start(): void { if (!this.timer) this.timer = setInterval(() => this.tickAll(), this.tickMs); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
  setTickMs(ms: number): void { this.tickMs = Math.max(250, ms); if (this.timer) { this.stop(); this.start(); } }

  /** Manual simulated plays, used by the SIMULATED buttons and tests. */
  forcePlay(gameId: string, kind: "touchdown" | "field_goal" | "turnover" | "big_play" | "safety", side?: "home" | "away"): Play | undefined {
    const s = this.games.get(gameId);
    if (!s) return undefined;
    const off = side ?? s.game.situation.possession ?? "home";
    s.game.situation.possession = off;
    let play: Play;
    if (kind === "touchdown") play = this.score(s, off, 6, "touchdown", `${abbr(s, off)} touchdown, ${12 + Math.floor(this.rnd() * 40)} yard pass`);
    else if (kind === "field_goal") play = this.score(s, off, 3, "field_goal", `${abbr(s, off)} ${20 + Math.floor(this.rnd() * 30)} yard field goal is good`);
    else if (kind === "safety") play = this.score(s, off === "home" ? "away" : "home", 2, "safety", `Safety, ${abbr(s, off)} tackled in the end zone`);
    else if (kind === "turnover") play = this.turnover(s, off, this.rnd() < 0.5 ? "interception" : "fumble");
    else play = this.play(s, off, "pass", 35 + Math.floor(this.rnd() * 30), `${abbr(s, off)} deep pass complete`);
    if (kind === "touchdown") this.extraPoint(s, off);
    this.publish(s, [play]);
    return play;
  }

  /** Overturn the most recent scoring play of a game. Tests the reversal path on demand. */
  forceOverturn(gameId: string): Play | undefined {
    const s = this.games.get(gameId);
    const last = s ? [...s.plays].reverse().find((p) => p.scoring && !p.reversed && p.type !== "extra_point" && p.type !== "free_throw") : undefined;
    if (!s || !last) return undefined;
    const p = this.overturn(s, last);
    this.publish(s, [p]);
    return p;
  }

  // ------------------------------------------------------------------ internals

  tickAll(): void { for (const s of this.games.values()) this.tick(s); }

  tick(s: SimState): void {
    const g = s.game;
    if (g.status === "scheduled") { if (Date.now() >= g.startTime) { g.status = "live"; g.period = 1; g.periodLabel = periodLabel(g.sport, 1); this.publish(s, []); } return; }
    if (g.status === "final") { if (++s.finalTicks! >= 20) this.restart(s); return; }
    if (g.status === "halftime") { if (--s.halftimeTicks! <= 0) { g.status = "live"; g.period = 3; g.periodLabel = periodLabel(g.sport, 3); s.clockSeconds = g.sport === "football" ? 900 : 720; this.publish(s, []); } return; }
    const out: Play[] = [];
    if (s.pendingOverturn && --s.pendingOverturn.inTicks <= 0) {
      out.push(this.overturn(s, s.pendingOverturn.play));
      s.pendingOverturn = undefined;
    }
    const elapsed = g.sport === "football" ? 12 + Math.floor(this.rnd() * 20) : 8 + Math.floor(this.rnd() * 16);
    s.clockSeconds = Math.max(0, s.clockSeconds - elapsed);
    if (g.sport === "football") out.push(this.footballPlay(s)); else out.push(this.basketballPlay(s));
    if (s.clockSeconds === 0) this.endPeriod(s);
    this.publish(s, out);
  }

  private footballPlay(s: SimState): Play {
    const g = s.game;
    const off = g.situation.possession ?? "home";
    const r = this.rnd();
    if (s.down === 4) {
      const toGo = 100 - s.yardLine;
      if (toGo <= 35 && r < 0.85) {
        if (this.rnd() < 0.8) return this.score(s, off, 3, "field_goal", `${abbr(s, off)} ${toGo + 17} yard field goal is good`);
        return this.punt(s, off, `${abbr(s, off)} field goal attempt is no good`);
      }
      if (s.distance <= 2 && r < 0.5) { /* go for it */ }
      else return this.punt(s, off, `${abbr(s, off)} punts`);
    }
    if (r < 0.05) return this.turnover(s, off, r < 0.03 ? "interception" : "fumble");
    const pass = this.rnd() < 0.55;
    let yards: number;
    if (pass) { const x = this.rnd(); yards = x < 0.35 ? 0 : x < 0.9 ? 3 + Math.floor(this.rnd() * 14) : 20 + Math.floor(this.rnd() * 40); }
    else { const x = this.rnd(); yards = x < 0.1 ? -2 : x < 0.85 ? 1 + Math.floor(this.rnd() * 7) : 12 + Math.floor(this.rnd() * 30); }
    if (s.yardLine + yards >= 100) { const p = this.score(s, off, 6, "touchdown", `${abbr(s, off)} touchdown, ${100 - s.yardLine} yard ${pass ? "pass" : "run"}`); this.extraPoint(s, off); this.maybeOverturn(s, p); return p; }
    const text = pass ? (yards === 0 ? `${abbr(s, off)} pass incomplete` : `${abbr(s, off)} pass complete for ${yards} yards`) : `${abbr(s, off)} run for ${yards} yards`;
    return this.play(s, off, pass ? "pass" : "rush", yards, text);
  }

  private play(s: SimState, off: "home" | "away", type: string, yards: number, text: string): Play {
    s.yardLine = Math.min(99, Math.max(1, s.yardLine + yards));
    if (yards >= s.distance) { s.down = 1; s.distance = Math.min(10, 100 - s.yardLine); }
    else { s.down += 1; s.distance -= yards; }
    this.situation(s, off);
    return this.record(s, off, type, text, yards, false);
  }

  private punt(s: SimState, off: "home" | "away", text: string): Play {
    const p = this.record(s, off, "punt", text, 0, false);
    this.changePossession(s, off, Math.max(10, Math.min(60, 100 - (s.yardLine + 40))));
    return p;
  }

  private turnover(s: SimState, off: "home" | "away", type: "interception" | "fumble"): Play {
    const text = type === "interception" ? `${abbr(s, off)} pass intercepted` : `${abbr(s, off)} fumbles, recovered by ${abbr(s, off === "home" ? "away" : "home")}`;
    const p = this.record(s, off, type, text, 0, false);
    this.changePossession(s, off, 100 - s.yardLine);
    return p;
  }

  private score(s: SimState, side: "home" | "away", points: number, type: string, text: string): Play {
    if (side === "home") s.game.homeScore += points; else s.game.awayScore += points;
    const p = this.record(s, side, type, text, 100 - s.yardLine, true);
    const other = side === "home" ? "away" : "home";
    if (type !== "safety") this.changePossession(s, side, 25); else this.changePossession(s, other, 35);
    return p;
  }

  private extraPoint(s: SimState, side: "home" | "away"): void {
    if (this.rnd() < 0.96) { if (side === "home") s.game.homeScore += 1; else s.game.awayScore += 1; this.record(s, side, "extra_point", `${abbr(s, side)} extra point is good`, 0, true); }
    else this.record(s, side, "extra_point_missed", `${abbr(s, side)} extra point is no good`, 0, false);
  }

  private maybeOverturn(s: SimState, play: Play): void {
    if (this.rnd() < this.overturnRate) s.pendingOverturn = { inTicks: 2, play };
  }

  private overturn(s: SimState, play: Play): Play {
    play.reversed = true;
    const pts = play.type === "touchdown" ? 6 : play.type === "field_goal" ? 3 : play.type === "safety" ? 2 : play.type === "three_pointer" ? 3 : play.type === "dunk" || play.type === "field_goal_2" ? 2 : 0;
    const xp = s.plays.find((p) => p.seq === play.seq + 1 && p.type === "extra_point");
    const total = pts + (xp ? 1 : 0);
    if (xp) xp.reversed = true;
    if (play.team === "home") s.game.homeScore -= total; else s.game.awayScore -= total;
    return this.record(s, play.team, "review", `After review, the ${play.type.replace("_", " ")} is overturned`, 0, false);
  }

  private changePossession(s: SimState, from: "home" | "away", yardLine: number): void {
    const to = from === "home" ? "away" : "home";
    s.yardLine = yardLine; s.down = 1; s.distance = 10; s.driveId += 1;
    this.situation(s, to);
  }

  private situation(s: SimState, off: "home" | "away"): void {
    const g = s.game;
    const own = s.yardLine <= 50;
    const teamSide = own ? abbr(s, off) : abbr(s, off === "home" ? "away" : "home");
    const yl = own ? s.yardLine : 100 - s.yardLine;
    g.situation = { possession: off, down: s.down, distance: s.distance, yardLine: s.yardLine, yardLineText: `${teamSide} ${yl}`, redZone: s.yardLine >= 80, lastPlay: g.situation.lastPlay };
  }

  private basketballPlay(s: SimState): Play {
    const g = s.game;
    const side: "home" | "away" = this.rnd() < 0.5 ? "home" : "away";
    const x = this.rnd();
    const pts = x < 0.4 ? 0 : x < 0.75 ? 2 : x < 0.9 ? 3 : 1;
    if (pts) { if (side === "home") g.homeScore += pts; else g.awayScore += pts; }
    const type = pts === 3 ? "three_pointer" : pts === 2 ? (this.rnd() < 0.3 ? "dunk" : "field_goal_2") : pts === 1 ? "free_throw" : "miss";
    const text = pts ? `${abbr(s, side)} ${type === "three_pointer" ? "hits a three" : type === "dunk" ? "dunks" : pts === 1 ? "free throw" : "scores"}` : `${abbr(s, side)} misses`;
    return this.record(s, side, type, text, 0, pts > 0);
  }

  private endPeriod(s: SimState): void {
    const g = s.game;
    const regulation = g.sport === "football" ? 4 : 4;
    if (g.period >= regulation && g.homeScore !== g.awayScore) { g.status = "final"; g.periodLabel = "FINAL"; s.finalTicks = 0; return; }
    if (g.period === 2) { g.status = "halftime"; g.periodLabel = "HALF"; s.halftimeTicks = 3; return; }
    g.period += 1;
    g.periodLabel = periodLabel(g.sport, g.period);
    s.clockSeconds = g.period > regulation ? (g.sport === "football" ? 600 : 300) : g.sport === "football" ? 900 : 720;
  }

  /** SIMULATED only: a finished game starts over as a new game so the room never goes dark during a demo. */
  private restart(s: SimState): void {
    const g = s.game;
    g.status = "live"; g.period = 1; g.periodLabel = periodLabel(g.sport, 1); g.homeScore = 0; g.awayScore = 0; g.startTime = Date.now();
    s.clockSeconds = g.sport === "football" ? 900 : 720; s.yardLine = 25; s.down = 1; s.distance = 10; s.plays = []; s.finalTicks = 0; s.driveId += 1; s.pendingOverturn = undefined;
    g.situation = g.sport === "football" ? { possession: "away", down: 1, distance: 10, yardLine: 25, yardLineText: `${g.away.abbreviation} 25`, redZone: false } : {};
    this.record(s, undefined, "kickoff", "New game (simulated replay)", 0, false);
  }

  private record(s: SimState, team: "home" | "away" | undefined, type: string, text: string, yards: number, scoring: boolean): Play {
    s.seq += 1;
    const p: Play = { id: `${s.game.id}:${s.seq}`, gameId: s.game.id, seq: s.seq, ts: Date.now(), period: s.game.period, clock: fmtClock(s.clockSeconds), team, type, text, yards, scoring, homeScore: s.game.homeScore, awayScore: s.game.awayScore };
    s.plays.push(p);
    if (s.plays.length > 400) s.plays.shift();
    s.game.situation.lastPlay = text;
    return p;
  }

  private publish(s: SimState, plays: Play[]): void {
    const g = s.game;
    g.clock = fmtClock(s.clockSeconds); g.clockSeconds = s.clockSeconds; g.seq = s.seq; g.updatedAt = Date.now();
    if (g.status === "live") g.periodLabel = periodLabel(g.sport, g.period);
    const snapshot: Game = structuredClone(g);
    for (const cb of this.subs.get(g.id) ?? []) cb(snapshot, plays.map((p) => ({ ...p })));
  }
}

function abbr(s: SimState, side: "home" | "away"): string { return side === "home" ? s.game.home.abbreviation : s.game.away.abbreviation; }
function fmtClock(sec: number): string { return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; }
export function periodLabel(sport: string, period: number): string {
  const reg = 4;
  if (period > reg) return period === reg + 1 ? "OT" : `${period - reg}OT`;
  return ["1ST", "2ND", "3RD", "4TH"][period - 1] ?? `${period}`;
}
