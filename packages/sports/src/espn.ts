/**
 * ESPN public scoreboard adapter. CONNECTED for reads (verified from this repo), but it is
 * an unofficial, unauthenticated endpoint: no SLA, no play-by-play here, no standings.
 * Keep it for development and personal use; swap in a licensed provider for anything more.
 */
import type { Game, GameStats, League, Leader, Play, ScoringPlay, Sport, SportsProvider, Standing, StatLine, Team, Unsubscribe, IntegrationStatus } from "@room/core";

const LEAGUE_PATHS: Record<string, { path: string; name: string; sport: Sport }> = {
  nfl: { path: "football/nfl", name: "NFL", sport: "football" },
  ncaaf: { path: "football/college-football", name: "College Football", sport: "football" },
  nba: { path: "basketball/nba", name: "NBA", sport: "basketball" },
  wnba: { path: "basketball/wnba", name: "WNBA", sport: "basketball" },
  ncaab: { path: "basketball/mens-college-basketball", name: "College Basketball", sport: "basketball" },
  mlb: { path: "baseball/mlb", name: "MLB", sport: "baseball" },
  nhl: { path: "hockey/nhl", name: "NHL", sport: "hockey" },
  mls: { path: "soccer/usa.1", name: "MLS", sport: "soccer" },
  epl: { path: "soccer/eng.1", name: "Premier League", sport: "soccer" },
};

interface EspnSummary {
  boxscore?: { teams?: Array<{ team: { id: string; abbreviation: string }; homeAway?: "home" | "away"; statistics: Array<{ name: string; label?: string; displayValue?: string; stats?: Array<{ name: string; label?: string; displayValue: string }> }> }> };
  plays?: Array<{ period?: { number: number; type?: string }; team?: { id: string }; text?: string; homeScore?: number; awayScore?: number; scoringPlay?: boolean; type?: { text?: string } }>;
  leaders?: Array<{ team?: { id: string; abbreviation: string }; leaders?: Array<{ name: string; leaders?: Array<{ displayValue?: string; value?: number; athlete?: { displayName?: string; jersey?: string; position?: { abbreviation?: string }; headshot?: { href?: string } } }> }> }>;
  scoringPlays?: Array<{ period?: { number: number }; clock?: { displayValue: string }; team?: { id: string; abbreviation: string }; text?: string; homeScore?: number; awayScore?: number; type?: { text?: string } }>;
  winprobability?: Array<{ homeWinPercentage: number }>;
  drives?: { previous?: Array<{ team?: { abbreviation: string }; description?: string; displayResult?: string }> };
}

interface EspnCompetitor { id: string; homeAway: "home" | "away"; score?: string; hits?: number; errors?: number; linescores?: Array<{ value?: number }>; records?: Array<{ summary: string }>; leaders?: Array<{ name: string; leaders?: Array<{ displayValue?: string; value?: number; athlete?: { shortName?: string; displayName?: string; jersey?: string; position?: { abbreviation?: string }; headshot?: string } }> }>; team: { id: string; abbreviation: string; displayName: string; shortDisplayName: string; color?: string; alternateColor?: string; logo?: string } }
interface EspnEvent {
  id: string; date: string;
  status: { type: { state: "pre" | "in" | "post"; shortDetail: string; name?: string }; period: number; displayClock: string };
  competitions: Array<{ competitors: EspnCompetitor[]; venue?: { fullName?: string }; broadcasts?: Array<{ names?: string[] }>; series?: { summary?: string }; situation?: { possession?: string; down?: number; distance?: number; yardLine?: number; isRedZone?: boolean; downDistanceText?: string; possessionText?: string; lastPlay?: { text?: string; type?: { text?: string; type?: string }; scoreValue?: number }; balls?: number; strikes?: number; outs?: number; onFirst?: boolean; onSecond?: boolean; onThird?: boolean; batter?: { athlete?: { shortName?: string; displayName?: string } }; pitcher?: { athlete?: { shortName?: string; displayName?: string } } } }>;
}

export class EspnProvider implements SportsProvider {
  id = "espn";
  status: IntegrationStatus = "UNVERIFIED";
  private cache = new Map<string, Game>();
  private seqs = new Map<string, number>();
  private sbLeaders = new Map<string, { home: Leader[]; away: Leader[] }>();
  private leagues: string[];
  private pollMs: number;

  constructor(opts: { leagues?: string[]; pollMs?: number } = {}) {
    this.leagues = (opts.leagues ?? ["nfl", "ncaaf"]).filter((l) => LEAGUE_PATHS[l]);
    this.pollMs = opts.pollMs ?? 15_000;
  }

  async getLeagues(): Promise<League[]> { return this.leagues.map((id) => ({ id, name: LEAGUE_PATHS[id].name, sport: LEAGUE_PATHS[id].sport })); }

  async getGames(_date?: Date, leagueId?: string): Promise<Game[]> {
    const ids = leagueId ? [leagueId] : this.leagues;
    const out: Game[] = [];
    for (const id of ids) {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${LEAGUE_PATHS[id].path}/scoreboard`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { events?: EspnEvent[] };
        for (const ev of j.events ?? []) { const g = this.normalize(id, ev); if (g) { this.cache.set(g.id, g); out.push(g); } }
        this.status = "CONNECTED";
      } catch (e) {
        this.status = "OFFLINE";
        console.warn(`[espn] ${id}: ${(e as Error).message}`);
      }
    }
    return out;
  }

  async getGame(gameId: string): Promise<Game | undefined> {
    const cached = this.cache.get(gameId);
    const leagueId = gameId.split(":")[1];
    if (!cached || Date.now() - cached.updatedAt > 10_000) await this.getGames(undefined, leagueId);
    return this.cache.get(gameId);
  }

  async getTeams(leagueId: string): Promise<Team[]> {
    const games = await this.getGames(undefined, leagueId);
    const map = new Map<string, Team>();
    for (const g of games) { map.set(g.home.id, g.home); map.set(g.away.id, g.away); }
    return [...map.values()];
  }

  async getStandings(): Promise<Standing[]> { return []; }      // not available on this endpoint

  /** Box score, leaders, scoring plays, win probability and drives from ESPN's game summary. */
  async getGameStats(gameId: string): Promise<GameStats | undefined> {
    const [, leagueId, eventId] = gameId.split(":");
    const league = LEAGUE_PATHS[leagueId];
    const game = this.cache.get(gameId);
    if (!league || !eventId || !game) return undefined;
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/summary?event=${eventId}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as EspnSummary;
    const sideOf = (teamId?: string, abbr?: string): "home" | "away" | undefined => {
      if (teamId && j.boxscore?.teams) { const t = j.boxscore.teams.find((x) => x.team.id === teamId); if (t?.homeAway) return t.homeAway; }
      if (abbr) return abbr === game.home.abbreviation ? "home" : abbr === game.away.abbreviation ? "away" : undefined;
      return undefined;
    };
    const teams = j.boxscore?.teams ?? [];
    const home = teams.find((t) => t.homeAway === "home"), away = teams.find((t) => t.homeAway === "away");
    if (game.sport === "baseball") {
      const pick = (t: typeof home, group: string, name: string) => t?.statistics.find((g) => g.name === group)?.stats?.find((x) => x.name === name)?.displayValue ?? "";
      const n = (v: string) => Number(v) || 0;
      const rows: Array<[string, string, string, boolean]> = [
        ["Runs", "batting", "runs", false], ["Hits", "batting", "hits", false], ["Home runs", "batting", "homeRuns", false], ["RBI", "batting", "RBIs", false],
        ["Walks", "batting", "walks", false], ["Strikeouts (batting)", "batting", "strikeouts", true], ["Stolen bases", "batting", "stolenBases", false], ["Left on base", "batting", "leftOnBase", true],
        ["Errors", "fielding", "errors", true], ["Pitching K", "pitching", "strikeouts", false],
      ];
      const team: StatLine[] = [];
      for (const [label, group, name, invert] of rows) {
        const hv = pick(home, group, name), av = pick(away, group, name);
        if (hv === "" && av === "") continue;
        const tot = n(hv) + n(av) || 1;
        const [hp, ap] = invert ? [n(av) / tot, n(hv) / tot] : [n(hv) / tot, n(av) / tot];
        team.push({ label, home: hv || "0", away: av || "0", homePct: hp, awayPct: ap });
      }
      const leaders = this.sbLeaders.get(gameId) ?? { home: [], away: [] };
      const scoringPlays: ScoringPlay[] = (j.plays ?? []).filter((p) => p.scoringPlay).slice(-8).reverse().map((p) => ({ period: p.period?.number ?? 0, clock: p.period?.type ? (p.period.type.toLowerCase().startsWith("top") ? "▲" : "▼") : "", side: sideOf(p.team?.id) ?? "home", text: p.text ?? "", homeScore: p.homeScore ?? 0, awayScore: p.awayScore ?? 0, type: p.type?.text }));
      const wpLast = j.winprobability?.[j.winprobability.length - 1];
      return { gameId, updatedAt: Date.now(), team: team.slice(0, 8), leaders, scoringPlays, winProbabilityHome: wpLast ? Number(wpLast.homeWinPercentage) : undefined, drives: [] };
    }
    const num = (v: string) => { const m = /^(\d+)(?:[\/-](\d+))?/.exec(v ?? ""); if (!m) return Number(v) || 0; return m[2] ? Number(m[1]) / Math.max(1, Number(m[2])) : Number(m[1]); };
    const secs = (v: string) => { const m = /^(\d+):(\d+)$/.exec(v ?? ""); return m ? Number(m[1]) * 60 + Number(m[2]) : num(v); };
    const PREFERRED = ["totalYards", "netPassingYards", "rushingYards", "firstDowns", "thirdDownEff", "turnovers", "totalPenaltiesYards", "possessionTime", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted", "totalRebounds", "assists", "turnovers", "pointsInPaint"];
    const INVERT = new Set(["turnovers", "totalPenaltiesYards"]);
    const team: StatLine[] = [];
    if (home && away) {
      const names = home.statistics.map((x) => x.name);
      const order = [...PREFERRED.filter((n) => names.includes(n)), ...names.filter((n) => !PREFERRED.includes(n))].slice(0, 8);
      for (const n of order) {
        const hs = home.statistics.find((x) => x.name === n), as = away.statistics.find((x) => x.name === n);
        if (!hs?.displayValue || !as?.displayValue) continue;
        const hv = n === "possessionTime" ? secs(hs.displayValue) : num(hs.displayValue), av = n === "possessionTime" ? secs(as.displayValue) : num(as.displayValue);
        const tot = hv + av || 1;
        const [hp, ap] = INVERT.has(n) ? [av / tot, hv / tot] : [hv / tot, av / tot];
        team.push({ label: hs.label ?? n, home: hs.displayValue, away: as.displayValue, homePct: hp, awayPct: ap });
      }
    }
    const CAT: Record<string, Leader["category"]> = { passingYards: "passing", rushingYards: "rushing", receivingYards: "receiving", sacks: "defense", tackles: "defense", points: "points", rebounds: "rebounds", assists: "assists" };
    const leaders = { home: [] as Leader[], away: [] as Leader[] };
    for (const tl of j.leaders ?? []) {
      const side = sideOf(tl.team?.id, tl.team?.abbreviation);
      if (!side) continue;
      for (const c of tl.leaders ?? []) {
        const top = c.leaders?.[0];
        const cat = CAT[c.name];
        if (!top || !cat) continue;
        leaders[side].push({ category: cat, name: top.athlete?.displayName ?? "", position: top.athlete?.position?.abbreviation, number: top.athlete?.jersey, line: top.displayValue ?? "", value: Number(top.value ?? 0), headshotUrl: top.athlete?.headshot?.href });
      }
    }
    const scoringPlays: ScoringPlay[] = (j.scoringPlays ?? []).slice(-8).reverse().map((p) => ({ period: p.period?.number ?? 0, clock: p.clock?.displayValue ?? "", side: sideOf(p.team?.id, p.team?.abbreviation) ?? "home", text: p.text ?? "", homeScore: p.homeScore ?? 0, awayScore: p.awayScore ?? 0, type: p.type?.text }));
    const wpLast = j.winprobability?.[j.winprobability.length - 1];
    const drives = (j.drives?.previous ?? []).slice(-5).reverse().map((d) => `${d.team?.abbreviation ?? ""} · ${d.description ?? ""}${d.displayResult ? ` · ${d.displayResult}` : ""}`);
    return { gameId, updatedAt: Date.now(), team, leaders, scoringPlays, winProbabilityHome: wpLast ? Number(wpLast.homeWinPercentage) : undefined, drives };
  }
  async getPlayByPlay(): Promise<Play[]> { return []; }          // not available on this endpoint

  subscribeToGame(gameId: string, onUpdate: (game: Game, plays: Play[]) => void): Unsubscribe {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      const g = await this.getGame(gameId);
      if (g) onUpdate(g, []);
      if (!stopped) setTimeout(poll, g?.status === "live" ? this.pollMs : this.pollMs * 6);
    };
    poll();
    return () => { stopped = true; };
  }

  private normalize(leagueId: string, ev: EspnEvent): Game | undefined {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors.find((c) => c.homeAway === "home");
    const away = comp?.competitors.find((c) => c.homeAway === "away");
    if (!comp || !home || !away) return undefined;
    const sport = LEAGUE_PATHS[leagueId].sport;
    const id = `espn:${leagueId}:${ev.id}`;
    const seq = (this.seqs.get(id) ?? 0) + 1;
    if (sport === "baseball") {
      const MLB_CAT: Record<string, Leader["category"]> = { avg: "batting", homeRuns: "home runs", RBIs: "rbi", ERA: "pitching", strikeouts: "pitching" };
      const conv = (c: EspnCompetitor): Leader[] => { const out: Leader[] = []; const seen = new Set<string>(); for (const l of c.leaders ?? []) { const cat = MLB_CAT[l.name]; const top = l.leaders?.[0]; if (!cat || !top || seen.has(cat)) continue; seen.add(cat); out.push({ category: cat, name: top.athlete?.shortName ?? top.athlete?.displayName ?? "", position: top.athlete?.position?.abbreviation, number: top.athlete?.jersey, line: top.displayValue ?? "", value: Number(top.value ?? 0), headshotUrl: top.athlete?.headshot }); } return out; };
      this.sbLeaders.set(id, { home: conv(home), away: conv(away) });
    }
    this.seqs.set(id, seq);
    const state = ev.status.type.state;
    // ESPN occasionally leaves STATUS_HALFTIME on a game already in the third quarter; trust the period.
    const status = state === "in" ? (ev.status.type.name === "STATUS_HALFTIME" && (ev.status.period ?? 0) <= 2 ? "halftime" : "live") : state === "post" ? "final" : "scheduled";
    const sit = comp.situation;
    const possession = sit?.possession ? (sit.possession === home.team.id ? "home" : sit.possession === away.team.id ? "away" : undefined) : undefined;
    const detail = ev.status.type.shortDetail ?? "";
    let periodLabel = status === "final" ? "FINAL" : status === "halftime" ? "HALF" : detail.split(" - ")[0];
    const situation: Game["situation"] = { possession, down: sit?.down, distance: sit?.distance, yardLine: sit?.yardLine, yardLineText: sit?.possessionText, redZone: sit?.isRedZone, lastPlay: sit?.lastPlay?.text };
    if (sport === "baseball") {
      // "Top 3rd" / "Bot 5th" / "Mid 7th" / "End 2nd" -> half + "TOP 3" style label
      const m = /^(Top|Bot|Bottom|Mid|Middle|End)\s+(\d+)/i.exec(detail);
      if (m) { const h = m[1].toLowerCase(); situation.half = h.startsWith("top") ? "top" : h.startsWith("bot") ? "bottom" : h.startsWith("mid") ? "middle" : "end"; if (status !== "final") periodLabel = `${h.startsWith("top") ? "TOP" : h.startsWith("bot") ? "BOT" : h.startsWith("mid") ? "MID" : "END"} ${m[2]}`; }
      Object.assign(situation, { balls: sit?.balls, strikes: sit?.strikes, outs: sit?.outs, onFirst: sit?.onFirst, onSecond: sit?.onSecond, onThird: sit?.onThird, batter: sit?.batter?.athlete?.shortName ?? sit?.batter?.athlete?.displayName, pitcher: sit?.pitcher?.athlete?.shortName ?? sit?.pitcher?.athlete?.displayName });
      if (situation.half === "top") situation.possession = "away"; else if (situation.half === "bottom") situation.possession = "home";
      if (sit?.lastPlay?.type?.text) situation.lastPlay = `${sit.lastPlay.type.text}: ${sit.lastPlay.text ?? ""}`.replace(/: $/, "");
    }
    return {
      id, leagueId, sport, startTime: Date.parse(ev.date), status, period: ev.status.period, periodLabel,
      clock: sport === "baseball" ? "" : ev.status.displayClock ?? "", home: toTeam(leagueId, home), away: toTeam(leagueId, away),
      homeScore: Number(home.score ?? 0), awayScore: Number(away.score ?? 0),
      homeHits: home.hits, awayHits: away.hits, homeErrors: home.errors, awayErrors: away.errors,
      homeLine: home.linescores?.map((l) => Number(l.value ?? 0)), awayLine: away.linescores?.map((l) => Number(l.value ?? 0)),
      seriesText: comp.series?.summary, situation,
      venue: comp.venue?.fullName, broadcast: comp.broadcasts?.[0]?.names?.[0], seq, updatedAt: Date.now(),
    };
  }
}

function toTeam(leagueId: string, c: EspnCompetitor): Team {
  return {
    id: `${leagueId}:${c.team.abbreviation}`, leagueId, abbreviation: c.team.abbreviation, name: c.team.displayName, shortName: c.team.shortDisplayName,
    logoUrl: c.team.logo, record: c.records?.[0]?.summary,
    profile: { primaryColor: `#${c.team.color ?? "888888"}`, secondaryColor: `#${c.team.alternateColor ?? "ffffff"}`, celebration: "pulse" },
  };
}
