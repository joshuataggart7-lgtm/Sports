import type { IntegrationStatus } from "./status";

export type Sport = "football" | "basketball" | "baseball" | "hockey" | "soccer";

export interface League {
  id: string;        // nfl, ncaaf, nba...
  name: string;
  sport: Sport;
}

export interface TeamProfile {
  primaryColor: string;
  secondaryColor: string;
  celebration?: "pulse" | "flash" | "chase" | "breathe";
  audioClip?: string;
  theme?: string;
}

export interface Team {
  id: string;
  leagueId: string;
  abbreviation: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  profile: TeamProfile;
  record?: string;
}

export type GameStatus = "scheduled" | "live" | "halftime" | "final" | "postponed";

export interface GameSituation {
  possession?: "home" | "away";
  down?: number;
  distance?: number;
  /** Yard line 0..100 measured from the offense's own goal line, so 80+ is the red zone. */
  yardLine?: number;
  yardLineText?: string;   // "MISS 38"
  redZone?: boolean;
  lastPlay?: string;
  timeouts?: { home: number; away: number };
}

export interface Game {
  id: string;
  leagueId: string;
  sport: Sport;
  startTime: number;
  status: GameStatus;
  period: number;
  periodLabel: string;   // "4TH", "OT", "HALF"
  clock: string;         // "03:42"
  clockSeconds?: number;
  home: Team;
  away: Team;
  homeScore: number;
  awayScore: number;
  situation: GameSituation;
  venue?: string;
  broadcast?: string;
  /** Sequence number from the provider, increases on every update. */
  seq: number;
  updatedAt: number;
}

export interface Play {
  id: string;
  gameId: string;
  seq: number;
  ts: number;
  period: number;
  clock: string;
  team?: "home" | "away";
  type: string;          // touchdown, field_goal, rush, pass, interception, fumble, punt, kickoff, ...
  text: string;
  yards?: number;
  scoring: boolean;
  homeScore: number;
  awayScore: number;
  /** A play the provider later overturned. */
  reversed?: boolean;
}

export interface Standing {
  team: Team;
  wins: number;
  losses: number;
  ties?: number;
  rank?: number;
}

/** One comparison row on a stats board; pct values (0..1) drive the mirrored bars. */
export interface StatLine { label: string; home: string | number; away: string | number; homePct?: number; awayPct?: number }

export interface Leader {
  category: "passing" | "rushing" | "receiving" | "points" | "rebounds" | "assists" | "defense";
  name: string;
  position?: string;
  number?: string;
  /** The stat line as a broadcast would show it: "24/31, 312 YDS, 3 TD". */
  line: string;
  value: number;
  headshotUrl?: string;
}

export interface ScoringPlay { period: number; clock: string; side: "home" | "away"; text: string; homeScore: number; awayScore: number; type?: string }

export interface GameStats {
  gameId: string;
  updatedAt: number;
  team: StatLine[];
  leaders: { home: Leader[]; away: Leader[] };
  scoringPlays: ScoringPlay[];
  /** 0..1 for the home team. */
  winProbabilityHome?: number;
  /** Most recent drives, newest first, e.g. "MISS · 8 plays, 75 yds, 3:42 · Touchdown". */
  drives?: string[];
}

export type Unsubscribe = () => void;

/** Never design around one feed. Mock first, licensed feeds later, identical surface. */
export interface SportsProvider {
  id: string;
  status: IntegrationStatus;
  getLeagues(): Promise<League[]>;
  getGames(date?: Date, leagueId?: string): Promise<Game[]>;
  getGame(gameId: string): Promise<Game | undefined>;
  getTeams(leagueId: string): Promise<Team[]>;
  getStandings(leagueId: string): Promise<Standing[]>;
  getPlayByPlay(gameId: string): Promise<Play[]>;
  subscribeToGame(gameId: string, onUpdate: (game: Game, plays: Play[]) => void): Unsubscribe;
  /** Box score, leaders, scoring summary, win probability. Optional; providers without it return undefined. */
  getGameStats?(gameId: string): Promise<GameStats | undefined>;
}
