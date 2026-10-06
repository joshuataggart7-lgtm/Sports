import type { Game, SportsEvent, Team, TeamExperience } from "@room/core";

export interface RenderContext {
  team?: { abbr: string; name: string; primary: string; secondary: string; audio: string; bigPlayAudio: string; winAudio: string; logo: string };
  opponent?: { abbr: string; name: string };
  event?: { text: string; score: string; points: number; yard: string; type: string };
  game?: { home: string; away: string; homeScore: number; awayScore: number; clock: string; period: string };
  ctx?: { importance: number; pressure: number; wpDelta: string; wp: string; rivalry: boolean; lateGame: boolean };
  drive?: { summary: string };
  /** Down and distance line for pressure banners, e.g. "3RD & GOAL". */
  down?: { text: string };
}

export function contextFor(event: SportsEvent | undefined, game: Game | undefined, fallbackTeam?: Team, teams?: TeamExperience[]): RenderContext {
  const side = event?.side;
  const team = game && side ? game[side] : fallbackTeam;
  const opp = game && side ? game[side === "home" ? "away" : "home"] : undefined;
  // Room-level team preferences (own colors, own clips) win over what the feed says.
  const pref = team ? teams?.find((t) => t.abbr.toUpperCase() === team.abbreviation.toUpperCase()) : undefined;
  const score = pref?.audio?.score ?? team?.profile.audioClip ?? `${team?.abbreviation.toLowerCase()}_celebration`;
  return {
    team: team ? { abbr: team.abbreviation, name: pref?.name ?? team.name, primary: pref?.primaryColor ?? team.profile.primaryColor, secondary: pref?.secondaryColor ?? team.profile.secondaryColor, audio: score, bigPlayAudio: pref?.audio?.bigPlay ?? "big_play", winAudio: pref?.audio?.win ?? score, logo: team.logoUrl ?? "" } : undefined,
    opponent: opp ? { abbr: opp.abbreviation, name: opp.name } : undefined,
    event: event ? { text: event.text, score: String(event.data.score ?? (game ? `${game.away.abbreviation} ${game.awayScore} - ${game.home.abbreviation} ${game.homeScore}` : "")), points: Number(event.data.points ?? 0), yard: String(event.data.text ?? ""), type: event.type } : undefined,
    game: game ? { home: game.home.abbreviation, away: game.away.abbreviation, homeScore: game.homeScore, awayScore: game.awayScore, clock: game.clock, period: game.periodLabel } : undefined,
    ctx: event?.context ? { importance: event.context.importance, pressure: event.context.pressure, wpDelta: event.context.wpDelta === undefined ? "" : `${event.context.wpDelta > 0 ? "+" : ""}${Math.round(event.context.wpDelta * 100)}%`, wp: event.context.wp === undefined ? "" : `${Math.round(event.context.wp * 100)}%`, rivalry: event.context.rivalry, lateGame: event.context.lateGame } : undefined,
    drive: event?.context?.drive ? { summary: event.context.drive.replace(/^[A-Z]{2,5}\s*·\s*/, "").replace(/\s*·\s*/g, " • ").toUpperCase() } : undefined,
    down: game?.situation.down ? { text: `${ordinal(game.situation.down)} & ${game.situation.redZone && (game.situation.distance ?? 99) >= (game.situation.yardLine ?? 0) ? "GOAL" : game.situation.distance ?? "?"}` } : undefined,
  };
}

function ordinal(n: number): string { return n === 1 ? "1ST" : n === 2 ? "2ND" : n === 3 ? "3RD" : `${n}TH`; }

export function render<T>(value: T, ctx: RenderContext): T {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
      let cur: unknown = ctx;
      for (const p of path.split(".")) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[p] : undefined;
      return cur === undefined || cur === null ? "" : String(cur);
    }) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => render(v, ctx)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = render(v, ctx);
    return out as T;
  }
  return value;
}
