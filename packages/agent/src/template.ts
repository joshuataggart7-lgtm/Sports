import type { Game, SportsEvent, Team } from "@room/core";

export interface RenderContext {
  team?: { abbr: string; name: string; primary: string; secondary: string; audio: string; logo: string };
  opponent?: { abbr: string; name: string };
  event?: { text: string; score: string; points: number; yard: string; type: string };
  game?: { home: string; away: string; homeScore: number; awayScore: number; clock: string; period: string };
}

export function contextFor(event: SportsEvent | undefined, game: Game | undefined, fallbackTeam?: Team): RenderContext {
  const side = event?.side;
  const team = game && side ? game[side] : fallbackTeam;
  const opp = game && side ? game[side === "home" ? "away" : "home"] : undefined;
  return {
    team: team ? { abbr: team.abbreviation, name: team.name, primary: team.profile.primaryColor, secondary: team.profile.secondaryColor, audio: team.profile.audioClip ?? `${team.abbreviation.toLowerCase()}_celebration`, logo: team.logoUrl ?? "" } : undefined,
    opponent: opp ? { abbr: opp.abbreviation, name: opp.name } : undefined,
    event: event ? { text: event.text, score: String(event.data.score ?? (game ? `${game.away.abbreviation} ${game.awayScore} - ${game.home.abbreviation} ${game.homeScore}` : "")), points: Number(event.data.points ?? 0), yard: String(event.data.text ?? ""), type: event.type } : undefined,
    game: game ? { home: game.home.abbreviation, away: game.away.abbreviation, homeScore: game.homeScore, awayScore: game.awayScore, clock: game.clock, period: game.periodLabel } : undefined,
  };
}

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
