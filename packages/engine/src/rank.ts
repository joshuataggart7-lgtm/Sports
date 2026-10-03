import type { Game } from "@room/core";

export interface GameInterest { gameId: string; score: number; reasons: string[] }

/**
 * Smart multiview: which games deserve a screen right now. Favorites first, then drama.
 * Never used to replace the primary game, only to suggest or to fill auxiliary displays.
 */
export function rankGames(games: Game[], favorites: string[] = []): GameInterest[] {
  const fav = new Set(favorites.map((t) => t.toUpperCase()));
  const out: GameInterest[] = [];
  for (const g of games) {
    let score = 0;
    const reasons: string[] = [];
    const isFav = fav.has(g.home.abbreviation.toUpperCase()) || fav.has(g.away.abbreviation.toUpperCase());
    if (isFav) { score += 50; reasons.push("favorite team"); }
    if (g.status === "live" || g.status === "halftime") { score += 20; reasons.push("live"); } else if (g.status === "scheduled") { score += 2; } else { score -= 30; }
    const diff = Math.abs(g.homeScore - g.awayScore);
    const late = g.period >= 4 || (g.sport === "basketball" && g.period >= 4);
    const closeThreshold = g.sport === "football" ? 8 : g.sport === "basketball" ? 6 : 1;
    if (g.status === "live" && diff <= closeThreshold) { score += late ? 30 : 12; reasons.push(late ? "close and late" : "close"); }
    if (g.situation.redZone) { score += 15; reasons.push("red zone"); }
    if (g.period > 4 && g.status === "live") { score += 40; reasons.push("overtime"); }
    if (g.status === "live" && late && (g.clockSeconds ?? 999) < 300) { score += 10; reasons.push("final minutes"); }
    out.push({ gameId: g.id, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}
