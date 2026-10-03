/**
 * ESPN public scoreboard adapter. CONNECTED for reads (verified from this repo), but it is
 * an unofficial, unauthenticated endpoint: no SLA, no play-by-play here, no standings.
 * Keep it for development and personal use; swap in a licensed provider for anything more.
 */
import type { Game, League, Play, Sport, SportsProvider, Standing, Team, Unsubscribe, IntegrationStatus } from "@room/core";

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

interface EspnCompetitor { id: string; homeAway: "home" | "away"; score?: string; records?: Array<{ summary: string }>; team: { id: string; abbreviation: string; displayName: string; shortDisplayName: string; color?: string; alternateColor?: string; logo?: string } }
interface EspnEvent {
  id: string; date: string;
  status: { type: { state: "pre" | "in" | "post"; shortDetail: string; name?: string }; period: number; displayClock: string };
  competitions: Array<{ competitors: EspnCompetitor[]; venue?: { fullName?: string }; broadcasts?: Array<{ names?: string[] }>; situation?: { possession?: string; down?: number; distance?: number; yardLine?: number; isRedZone?: boolean; downDistanceText?: string; possessionText?: string; lastPlay?: { text?: string } } }>;
}

export class EspnProvider implements SportsProvider {
  id = "espn";
  status: IntegrationStatus = "UNVERIFIED";
  private cache = new Map<string, Game>();
  private seqs = new Map<string, number>();
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
    this.seqs.set(id, seq);
    const state = ev.status.type.state;
    const status = state === "in" ? (ev.status.type.name === "STATUS_HALFTIME" ? "halftime" : "live") : state === "post" ? "final" : "scheduled";
    const sit = comp.situation;
    const possession = sit?.possession ? (sit.possession === home.team.id ? "home" : sit.possession === away.team.id ? "away" : undefined) : undefined;
    return {
      id, leagueId, sport, startTime: Date.parse(ev.date), status, period: ev.status.period,
      periodLabel: status === "final" ? "FINAL" : status === "halftime" ? "HALF" : ev.status.type.shortDetail?.split(" - ")[0] ?? "",
      clock: ev.status.displayClock ?? "", home: toTeam(leagueId, home), away: toTeam(leagueId, away),
      homeScore: Number(home.score ?? 0), awayScore: Number(away.score ?? 0),
      situation: { possession, down: sit?.down, distance: sit?.distance, yardLine: sit?.yardLine, yardLineText: sit?.possessionText, redZone: sit?.isRedZone, lastPlay: sit?.lastPlay?.text },
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
