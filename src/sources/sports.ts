import type { Card, Source, SourceContext } from "../core/types.js";

/** Short league names -> ESPN scoreboard paths. */
export const LEAGUES: Record<string, string> = {
  nfl: "football/nfl",
  ncaaf: "football/college-football",
  mlb: "baseball/mlb",
  nba: "basketball/nba",
  wnba: "basketball/wnba",
  ncaab: "basketball/mens-college-basketball",
  nhl: "hockey/nhl",
  mls: "soccer/usa.1",
  epl: "soccer/eng.1",
  laliga: "soccer/esp.1",
  bundesliga: "soccer/ger.1",
  seriea: "soccer/ita.1",
  ucl: "soccer/uefa.champions",
};

interface Competitor { homeAway: "home" | "away"; score: string; team: { abbreviation: string; displayName: string; color?: string } }
interface EspnEvent {
  id: string; shortName: string; date: string;
  status: { type: { state: "pre" | "in" | "post"; shortDetail: string; detail: string }; period: number; displayClock: string };
  competitions: Array<{ competitors: Competitor[]; situation?: { lastPlay?: { text?: string } } }>;
}

interface Snapshot { state: string; period: number; home: number; away: number }

/**
 * Live scores from ESPN's public scoreboard. Options:
 * { leagues: ["nfl", "mlb"], teams: ["HOU", "DAL"] (optional filter), interval?: ms }
 * Emits: game_start, score (with the scoring team), period, game_end.
 * The first poll only establishes a baseline so a restart never replays old goals.
 */
export const sports: Source = {
  id: "sports",
  start(ctx: SourceContext, opts) {
    const leagues = ((opts.leagues as string[] | undefined) ?? ["nfl"]).map((l) => l.toLowerCase());
    const teams = ((opts.teams as string[] | undefined) ?? []).map((t) => t.toUpperCase());
    const snapshots = new Map<string, Snapshot>();
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      const cards: Card[] = [];
      let anyLive = false;
      for (const league of leagues) {
        const path = LEAGUES[league] ?? league;
        try {
          const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = (await res.json()) as { events?: EspnEvent[] };
          for (const ev of j.events ?? []) {
            const comp = ev.competitions?.[0];
            if (!comp) continue;
            const home = comp.competitors.find((c) => c.homeAway === "home");
            const away = comp.competitors.find((c) => c.homeAway === "away");
            if (!home || !away) continue;
            const hAb = home.team.abbreviation, aAb = away.team.abbreviation;
            const followed = teams.length === 0 || teams.includes(hAb) || teams.includes(aAb);
            const state = ev.status.type.state;
            const hs = Number(home.score ?? 0), as = Number(away.score ?? 0);
            const key = `${league}:${ev.id}`;
            const tags = [league, hAb, aAb];
            const snap: Snapshot = { state, period: ev.status.period, home: hs, away: as };
            const prev = snapshots.get(key);
            if (state === "in") anyLive = true;

            if (followed) {
              const chip = `#${(state === "in" ? home.team.color : undefined) ?? "555555"}`;
              if (state === "in") cards.push({ key, source: "sports", text: `${aAb} ${as} ${hAb} ${hs} ${ev.status.type.shortDetail}`, chip, color: "#ffffff", priority: 10, tags });
              else if (state === "pre") cards.push({ key, source: "sports", text: `${aAb} @ ${hAb} ${when(ev.date, ctx.config.timezone)}`, color: "#9a9a9a", priority: 4, tags });
              else cards.push({ key, source: "sports", text: `FINAL ${aAb} ${as} ${hAb} ${hs}`, color: "#c8c8c8", priority: 2, tags });
            }

            if (prev && followed) {
              const base = { league, game: ev.shortName, home: hAb, away: aAb, homeName: home.team.displayName, awayName: away.team.displayName, homeScore: hs, awayScore: as, homeColor: `#${home.team.color ?? "ffffff"}`, awayColor: `#${away.team.color ?? "ffffff"}`, detail: ev.status.type.shortDetail, lastPlay: comp.situation?.lastPlay?.text };
              if (prev.state === "pre" && state === "in") ctx.emit({ kind: "game_start", key, title: `${aAb} @ ${hAb} is underway`, importance: 0.5, tags, data: base });
              if (hs !== prev.home || as !== prev.away) {
                const homeScored = hs > prev.home;
                const team = homeScored ? hAb : aAb;
                const pts = homeScored ? hs - prev.home : as - prev.away;
                ctx.emit({ kind: "score", key, title: `${team} scores`, text: `${aAb} ${as} - ${hAb} ${hs}`, importance: 0.7, tags: [...tags, team], data: { ...base, team, teamName: homeScored ? home.team.displayName : away.team.displayName, teamColor: homeScored ? base.homeColor : base.awayColor, points: pts, summary: `${aAb} ${as} - ${hAb} ${hs}` } });
              }
              if (state === "in" && prev.period !== ev.status.period) ctx.emit({ kind: "period", key, title: `${ev.shortName} ${ev.status.type.shortDetail}`, importance: 0.3, tags, data: { ...base, period: ev.status.period } });
              if (prev.state === "in" && state === "post") {
                const winner = hs > as ? hAb : as > hs ? aAb : "TIE";
                ctx.emit({ kind: "game_end", key, title: `FINAL ${aAb} ${as} ${hAb} ${hs}`, importance: 0.6, tags: [...tags, winner], data: { ...base, winner } });
              }
            }
            snapshots.set(key, snap);
          }
        } catch (e) {
          ctx.log(`${league} fetch failed: ${(e as Error).message}`);
        }
      }
      ctx.setCards(cards);
      const next = Number(opts.interval ?? (anyLive ? 15_000 : 120_000));
      timer = setTimeout(poll, next);
    };
    poll();
    this.stop = () => { if (timer) clearTimeout(timer); };
  },
};

function when(iso: string, tz?: string): string {
  const d = new Date(iso);
  const sameDay = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric", day: "numeric" }).format(d) === new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric", day: "numeric" }).format(new Date());
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  return sameDay ? time : `${new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d)} ${time}`;
}
