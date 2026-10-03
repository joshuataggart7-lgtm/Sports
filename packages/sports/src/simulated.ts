/**
 * SIMULATED sports provider.
 *
 * A self-contained football/basketball simulation with drives, a clock, possession,
 * downs, the red zone, scoring, overtime and occasional overturned plays. It exists so
 * the whole room (events, delay sync, automations, displays) can be proven without a
 * paid feed or a game on TV. Deterministic given a seed; speed is adjustable.
 */
import type { Game, GameStats, League, Leader, Play, ScoringPlay, SportsProvider, Standing, Team, Unsubscribe } from "@room/core";

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
  acc: Record<"home" | "away", SideAcc>;
  roster: Record<"home" | "away", Roster>;
  drives: string[];
  driveLog: { side: "home" | "away"; plays: number; yards: number; startClock: number; period: number };
}

interface SideAcc { plays: number; passYds: number; rushYds: number; passAtt: number; passComp: number; firstDowns: number; turnovers: number; thirdAtt: number; thirdConv: number; possession: number; penalties: number; pts: number; reb: number; ast: number; fgm: number; fga: number; tpm: number }
interface Roster { qb: Player; rb: Player; wr1: Player; wr2: Player; def: Player; g1: Player; g2: Player; c: Player }
interface Player { name: string; number: string; position: string; passYds: number; passTd: number; comp: number; att: number; rushYds: number; rushTd: number; carries: number; recYds: number; recTd: number; rec: number; tackles: number; sacks: number; pts: number; reb: number; ast: number }

const FIRST = ["J.", "M.", "D.", "T.", "K.", "A.", "C.", "R.", "B.", "E."];
const LAST = ["Carter", "Hayes", "Brooks", "Reed", "Walker", "Bennett", "Cole", "Foster", "Grant", "Hughes", "Parker", "Quinn", "Sutton", "Turner", "Vance", "Wells"];
function roster(seed: number): Roster {
  let i = seed;
  const mk = (position: string, num: number): Player => ({ name: `${FIRST[(i += 3) % FIRST.length]} ${LAST[(i += 7) % LAST.length]}`, number: String(num), position, passYds: 0, passTd: 0, comp: 0, att: 0, rushYds: 0, rushTd: 0, carries: 0, recYds: 0, recTd: 0, rec: 0, tackles: 0, sacks: 0, pts: 0, reb: 0, ast: 0 });
  return { qb: mk("QB", 10 + (seed % 7)), rb: mk("RB", 20 + (seed % 9)), wr1: mk("WR", 1 + (seed % 9)), wr2: mk("WR", 11 + (seed % 8)), def: mk("LB", 40 + (seed % 15)), g1: mk("G", 1 + (seed % 20)), g2: mk("G", 1 + ((seed * 3) % 20)), c: mk("C", 30 + (seed % 10)) };
}
const emptyAcc = (): SideAcc => ({ plays: 0, passYds: 0, rushYds: 0, passAtt: 0, passComp: 0, firstDowns: 0, turnovers: 0, thirdAtt: 0, thirdConv: 0, possession: 0, penalties: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, tpm: 0 });
function hashSeed(str: string): number { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

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
    const st: SimState = { game, clockSeconds: s.clock, yardLine: 38, down: 1, distance: 10, plays: [], seq: 1, driveId: 1, acc: { home: emptyAcc(), away: emptyAcc() }, roster: { home: roster(hashSeed(homeAbbr)), away: roster(hashSeed(awayAbbr)) }, drives: [], driveLog: { side: "home", plays: 0, yards: 0, startClock: s.clock, period: s.period } };
    // Pre-game stats so a game joined in progress looks like one: roughly proportional to the score.
    for (const side of ["home", "away"] as const) {
      const pts = side === "home" ? s.home : s.away;
      const a = st.acc[side], r = st.roster[side];
      if (league.sport === "football") {
        a.passYds = Math.round(pts * 6.5 + 40); a.rushYds = Math.round(pts * 3.2 + 30); a.passAtt = Math.round(pts * 0.9 + 8); a.passComp = Math.round(a.passAtt * 0.64);
        a.firstDowns = Math.round(pts * 0.55 + 4); a.thirdAtt = Math.round(pts * 0.35 + 3); a.thirdConv = Math.round(a.thirdAtt * 0.42); a.possession = 60 * (12 + Math.round(pts * 0.3)); a.turnovers = pts < 20 ? 1 : 0; a.penalties = 3;
        r.qb.passYds = a.passYds; r.qb.att = a.passAtt; r.qb.comp = a.passComp; r.qb.passTd = Math.floor(pts / 10);
        r.rb.rushYds = Math.round(a.rushYds * 0.7); r.rb.carries = Math.round(a.rushYds / 5); r.rb.rushTd = Math.max(0, Math.floor(pts / 14) - 1);
        r.wr1.recYds = Math.round(a.passYds * 0.45); r.wr1.rec = Math.round(a.passComp * 0.4); r.wr1.recTd = Math.floor(pts / 17);
        r.wr2.recYds = Math.round(a.passYds * 0.3); r.wr2.rec = Math.round(a.passComp * 0.3);
        r.def.tackles = 5 + Math.round(pts / 8); r.def.sacks = pts > 20 ? 1 : 0;
      } else {
        a.pts = pts; a.fga = Math.round(pts * 0.85); a.fgm = Math.round(pts * 0.38); a.tpm = Math.round(pts * 0.12); a.reb = Math.round(pts * 0.4); a.ast = Math.round(pts * 0.22);
        r.g1.pts = Math.round(pts * 0.28); r.g1.ast = Math.round(a.ast * 0.4); r.g2.pts = Math.round(pts * 0.2); r.c.pts = Math.round(pts * 0.18); r.c.reb = Math.round(a.reb * 0.35);
      }
    }
    this.games.set(id, st);
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
    s.acc = { home: emptyAcc(), away: emptyAcc() }; s.roster = { home: roster(hashSeed(g.home.abbreviation)), away: roster(hashSeed(g.away.abbreviation)) }; s.drives = []; s.driveLog = { side: "away", plays: 0, yards: 0, startClock: s.clockSeconds, period: 1 };
    g.situation = g.sport === "football" ? { possession: "away", down: 1, distance: 10, yardLine: 25, yardLineText: `${g.away.abbreviation} 25`, redZone: false } : {};
    this.record(s, undefined, "kickoff", "New game (simulated replay)", 0, false);
  }

  private record(s: SimState, team: "home" | "away" | undefined, type: string, text: string, yards: number, scoring: boolean): Play {
    s.seq += 1;
    if (team) this.accumulate(s, team, type, yards);
    const p: Play = { id: `${s.game.id}:${s.seq}`, gameId: s.game.id, seq: s.seq, ts: Date.now(), period: s.game.period, clock: fmtClock(s.clockSeconds), team, type, text, yards, scoring, homeScore: s.game.homeScore, awayScore: s.game.awayScore };
    s.plays.push(p);
    if (s.plays.length > 400) s.plays.shift();
    s.game.situation.lastPlay = text;
    return p;
  }

  private accumulate(s: SimState, side: "home" | "away", type: string, yards: number): void {
    const a = s.acc[side], r = s.roster[side], other = s.acc[side === "home" ? "away" : "home"];
    const dl = s.driveLog;
    if (dl.side !== side && ["pass", "rush", "punt", "field_goal", "touchdown"].includes(type)) {
      if (dl.plays > 0) s.drives.unshift(`${abbr(s, dl.side)} · ${dl.plays} plays, ${dl.yards} yds`);
      s.drives.length = Math.min(s.drives.length, 6);
      Object.assign(dl, { side, plays: 0, yards: 0, startClock: s.clockSeconds, period: s.game.period });
    }
    if (s.game.sport === "football") {
      if (["pass", "rush", "touchdown", "interception", "fumble"].includes(type)) { a.plays++; dl.plays++; a.possession += 25; }
      if (s.down === 3 && (type === "pass" || type === "rush")) a.thirdAtt++;
      if (type === "pass") { a.passAtt++; r.qb.att++; if (yards > 0) { a.passComp++; r.qb.comp++; a.passYds += yards; r.qb.passYds += yards; dl.yards += yards; const wr = Math.random() < 0.6 ? r.wr1 : r.wr2; wr.rec++; wr.recYds += yards; } }
      if (type === "rush") { a.rushYds += yards; r.rb.rushYds += yards; r.rb.carries++; dl.yards += yards; }
      if ((type === "pass" || type === "rush") && yards >= s.distance) { a.firstDowns++; if (s.down === 3) a.thirdConv++; }
      if (type === "touchdown") { if (/pass/.test(s.game.situation.lastPlay ?? "")) { r.qb.passTd++; r.wr1.recTd++; } else r.rb.rushTd++; dl.yards += yards; s.drives.unshift(`${abbr(s, side)} · ${dl.plays + 1} plays, ${dl.yards} yds · Touchdown`); dl.plays = 0; dl.yards = 0; }
      if (type === "field_goal") { s.drives.unshift(`${abbr(s, side)} · ${dl.plays} plays, ${dl.yards} yds · Field goal`); dl.plays = 0; dl.yards = 0; }
      if (type === "interception" || type === "fumble") { a.turnovers++; const d = s.roster[side === "home" ? "away" : "home"].def; d.tackles++; }
      if (type === "pass" && yards === 0 && Math.random() < 0.08) { const d = s.roster[side === "home" ? "away" : "home"].def; d.sacks++; }
      if (Math.random() < 0.04) a.penalties++;
      void other;
    } else {
      const pts = type === "three_pointer" ? 3 : type === "dunk" || type === "field_goal_2" ? 2 : type === "free_throw" ? 1 : 0;
      if (type !== "free_throw" && type !== "miss") { a.fga++; a.fgm++; if (pts === 3) a.tpm++; } else if (type === "miss") { a.fga++; if (Math.random() < 0.5) { const reb = Math.random() < 0.7 ? other : a; reb.reb++; if (reb === a) r.c.reb++; } }
      if (pts) { a.pts += pts; const who = [r.g1, r.g1, r.g2, r.c][Math.floor(Math.random() * 4)]; who.pts += pts; if (Math.random() < 0.55) { a.ast++; (who === r.g1 ? r.g2 : r.g1).ast++; } }
    }
  }

  async getGameStats(gameId: string): Promise<GameStats | undefined> {
    const s = this.games.get(gameId);
    if (!s) return undefined;
    const g = s.game, h = s.acc.home, a = s.acc.away;
    const pct = (x: number, y: number) => (x + y > 0 ? [x / (x + y), y / (x + y)] : [0.5, 0.5]);
    const row = (label: string, hv: string | number, av: string | number, hn: number, an: number): import("@room/core").StatLine => { const [hp, ap] = pct(hn, an); return { label, home: hv, away: av, homePct: hp, awayPct: ap }; };
    const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    const team = g.sport === "football" ? [
      row("Total yards", h.passYds + h.rushYds, a.passYds + a.rushYds, h.passYds + h.rushYds, a.passYds + a.rushYds),
      row("Passing", h.passYds, a.passYds, h.passYds, a.passYds),
      row("Rushing", h.rushYds, a.rushYds, h.rushYds, a.rushYds),
      row("First downs", h.firstDowns, a.firstDowns, h.firstDowns, a.firstDowns),
      row("3rd down", `${h.thirdConv}/${h.thirdAtt}`, `${a.thirdConv}/${a.thirdAtt}`, h.thirdAtt ? h.thirdConv / h.thirdAtt : 0, a.thirdAtt ? a.thirdConv / a.thirdAtt : 0),
      row("Turnovers", h.turnovers, a.turnovers, a.turnovers, h.turnovers),
      row("Penalties", h.penalties, a.penalties, a.penalties, h.penalties),
      row("Possession", mmss(h.possession), mmss(a.possession), h.possession, a.possession),
    ] : [
      row("Field goals", `${h.fgm}/${h.fga}`, `${a.fgm}/${a.fga}`, h.fga ? h.fgm / h.fga : 0, a.fga ? a.fgm / a.fga : 0),
      row("3-pointers", h.tpm, a.tpm, h.tpm, a.tpm),
      row("Rebounds", h.reb, a.reb, h.reb, a.reb),
      row("Assists", h.ast, a.ast, h.ast, a.ast),
    ];
    const leaders = (side: "home" | "away"): Leader[] => {
      const r = s.roster[side];
      if (g.sport === "football") return [
        { category: "passing", name: r.qb.name, position: "QB", number: r.qb.number, line: `${r.qb.comp}/${r.qb.att}, ${r.qb.passYds} YDS, ${r.qb.passTd} TD`, value: r.qb.passYds },
        { category: "rushing", name: r.rb.name, position: "RB", number: r.rb.number, line: `${r.rb.carries} CAR, ${r.rb.rushYds} YDS, ${r.rb.rushTd} TD`, value: r.rb.rushYds },
        { category: "receiving", name: r.wr1.name, position: "WR", number: r.wr1.number, line: `${r.wr1.rec} REC, ${r.wr1.recYds} YDS, ${r.wr1.recTd} TD`, value: r.wr1.recYds },
        { category: "defense", name: r.def.name, position: "LB", number: r.def.number, line: `${r.def.tackles} TKL, ${r.def.sacks} SACK`, value: r.def.tackles },
      ];
      return [
        { category: "points", name: r.g1.name, position: "G", number: r.g1.number, line: `${r.g1.pts} PTS, ${r.g1.ast} AST`, value: r.g1.pts },
        { category: "rebounds", name: r.c.name, position: "C", number: r.c.number, line: `${r.c.pts} PTS, ${r.c.reb} REB`, value: r.c.reb },
        { category: "assists", name: r.g2.name, position: "G", number: r.g2.number, line: `${r.g2.pts} PTS, ${r.g2.ast} AST`, value: r.g2.ast },
      ];
    };
    const scoringPlays: ScoringPlay[] = s.plays.filter((p) => p.scoring && !p.reversed && p.team && p.type !== "extra_point" && p.type !== "free_throw").slice(-8).reverse().map((p) => ({ period: p.period, clock: p.clock, side: p.team!, text: p.text, homeScore: p.homeScore, awayScore: p.awayScore, type: p.type }));
    // Win probability: score margin against time left, squashed. Good enough for a demo board.
    const regulation = g.sport === "football" ? 4 * 900 : 4 * 720;
    const elapsed = Math.min(regulation, (g.period - 1) * (regulation / 4) + ((regulation / 4) - (s.clockSeconds || 0)));
    const left = Math.max(1, regulation - elapsed);
    const margin = g.homeScore - g.awayScore;
    const k = g.sport === "football" ? 6.5 : 4.5;
    const z = margin / (k * Math.sqrt(left / regulation) + 0.6);
    const wp = g.status === "final" ? (margin > 0 ? 1 : margin < 0 ? 0 : 0.5) : 1 / (1 + Math.exp(-z));
    return { gameId, updatedAt: Date.now(), team, leaders: { home: leaders("home"), away: leaders("away") }, scoringPlays, winProbabilityHome: Math.round(wp * 1000) / 1000, drives: s.drives.slice(0, 5) };
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
