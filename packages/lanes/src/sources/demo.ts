import type { Source, SourceContext } from "../core/types.js";

/**
 * A synthetic "sports" source for demos and screenshots: one live game that scores
 * every so often, so lanes and moments light up with no network and no game on.
 * It registers under the id "sports" so the real rules apply unchanged.
 */
export const demo: Source = {
  id: "sports",
  start(ctx: SourceContext, opts) {
    const every = Number(opts.every ?? 25_000);
    const home = { ab: "HOU", name: "Houston Astros", color: "#eb6e1f" };
    const away = { ab: "NYY", name: "New York Yankees", color: "#003087" };
    let hs = 2, as = 1, inning = 5;
    const tags = ["mlb", home.ab, away.ab];
    const base = () => ({ league: "mlb", game: `${away.ab} @ ${home.ab}`, home: home.ab, away: away.ab, homeName: home.name, awayName: away.name, homeScore: hs, awayScore: as, homeColor: home.color, awayColor: away.color, detail: `Top ${inning}` });
    const cards = () => ctx.setCards([
      { key: "demo", source: "sports", text: `${away.ab} ${as} ${home.ab} ${hs} ${inning}th`, chip: home.color, color: "#ffffff", priority: 10, tags },
      { key: "demo2", source: "sports", text: `DAL @ PHI 7:20 PM`, color: "#9a9a9a", priority: 4, tags: ["nfl", "DAL", "PHI"] },
    ]);
    cards();
    setInterval(() => {
      const homeScored = Math.random() < 0.6;
      const pts = 1 + (Math.random() < 0.3 ? 1 : 0);
      if (homeScored) hs += pts; else as += pts;
      const t = homeScored ? home : away;
      cards();
      ctx.emit({ kind: "score", key: "demo", title: `${t.ab} scores`, text: `${away.ab} ${as} - ${home.ab} ${hs}`, importance: 0.7, tags: [...tags, t.ab], data: { ...base(), team: t.ab, teamName: t.name, teamColor: t.color, points: pts, summary: `${away.ab} ${as} - ${home.ab} ${hs}` } });
      if (Math.random() < 0.25) { inning++; ctx.emit({ kind: "period", key: "demo", title: `Top ${inning}`, importance: 0.3, tags, data: { ...base(), period: inning } }); }
    }, every);
  },
};
