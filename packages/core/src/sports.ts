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
}
