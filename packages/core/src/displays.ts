export const DISPLAY_ROLES = [
  "MAIN_GAME", "SECOND_GAME", "SCOREBOARD", "PLAYER_STATS", "FANTASY", "LEAGUE_SCORES", "BRACKET",
  "SOCIAL", "ROOM_STATUS", "MOVIE_INFO", "PROJECTED_TICKER", "AMBIENT", "CUSTOM", "OFF",
] as const;
export type DisplayRole = (typeof DISPLAY_ROLES)[number];

export const ROLE_LABELS: Record<DisplayRole, string> = {
  MAIN_GAME: "Primary Game", SECOND_GAME: "Second Game", SCOREBOARD: "Scoreboard", PLAYER_STATS: "Player Stats",
  FANTASY: "Fantasy", LEAGUE_SCORES: "League Scores", BRACKET: "Bracket", SOCIAL: "Social", ROOM_STATUS: "Room Status",
  MOVIE_INFO: "Movie Info", PROJECTED_TICKER: "Projected Ribbon", AMBIENT: "Ambient Art", CUSTOM: "Custom URL", OFF: "Off",
};

/** The projected ribbon's viewport on the projector's full image. Everything outside is true black. */
export interface TickerConfig {
  x: number;          // px from the left of the projector image
  y: number;          // px from the top
  width: number;      // px
  height: number;     // px
  fontPx: number;
  mode: "static" | "scroll";
  scrollPxPerSec: number;
  leagues: string[];  // which leagues to show in the secondary line; [] = only the watched game
  showClock: boolean;
  showDownDistance: boolean;
  showPossession: boolean;
  redZoneAlert: boolean;
  scoreFlash: boolean;
  /** Full projector image size, so the editor can preview the black surround. */
  canvasWidth: number;
  canvasHeight: number;
}

export const DEFAULT_TICKER: TickerConfig = {
  x: 0, y: 30, width: 1920, height: 150, fontPx: 56, mode: "static", scrollPxPerSec: 60, leagues: [],
  showClock: true, showDownDistance: true, showPossession: true, redZoneAlert: true, scoreFlash: true,
  canvasWidth: 1920, canvasHeight: 1080,
};

export interface DisplayDevice {
  id: string;
  roomId: string;
  name: string;
  /** Device record that carries this display (TV, monitor, projector). Optional for pure browser displays. */
  deviceId?: string;
  role: DisplayRole;
  /** Role-specific options: gameId for SECOND_GAME, url for CUSTOM, ticker config for PROJECTED_TICKER. */
  roleOptions?: Record<string, unknown>;
  pairingCode: string;
  paired: boolean;
  lastSeenAt?: number;
  /** Schematic position in the room editor. */
  position: { x: number; y: number; w: number; h: number };
  kind: "tv" | "monitor" | "projector" | "ultrawide";
}

export interface DisplayPreset {
  id: string;
  roomId: string;
  name: string;
  assignments: Array<{ displayId: string; role: DisplayRole; roleOptions?: Record<string, unknown> }>;
}
