import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEngine, DelayScheduler, rankGames } from "../src/index";
import type { Game, BroadcastDelayProfile } from "@room/core";

const team = (abbr: string) => ({ id: `ncaaf:${abbr}`, leagueId: "ncaaf", abbreviation: abbr, name: abbr, shortName: abbr, profile: { primaryColor: "#f00", secondaryColor: "#00f" } });
const game = (over: Partial<Game> = {}): Game => ({
  id: "g1", leagueId: "ncaaf", sport: "football", startTime: 0, status: "live", period: 4, periodLabel: "4TH", clock: "03:42", clockSeconds: 222,
  home: team("MISS"), away: team("LSU"), homeScore: 24, awayScore: 24, situation: { possession: "home", down: 1, distance: 10, yardLine: 38, redZone: false }, seq: 1, updatedAt: 0, ...over,
});

test("touchdown with extra point yields SCORE_CHANGE, TOUCHDOWN, EXTRA_POINT and LEAD_CHANGE, exactly once", () => {
  let t = 1000;
  const e = new EventEngine({ now: () => t });
  e.derive(undefined, game());
  const next = game({ homeScore: 31, seq: 2 });
  const { events } = e.derive(game(), next);
  const types = events.map((x) => x.type);
  assert.deepEqual(types, ["SCORE_CHANGE", "TOUCHDOWN", "EXTRA_POINT", "LEAD_CHANGE"]);
  assert.equal(events[1].teamAbbr, "MISS");
  assert.equal(events[1].data.points, 7);
  t += 5000;
  const again = e.derive(game(), next);
  assert.equal(again.events.length, 0, "same update twice is deduplicated");
});

test("a score decrease reverses the earlier celebration and emits SCORE_CORRECTION", () => {
  const e = new EventEngine();
  e.derive(undefined, game());
  const scored = game({ homeScore: 30, seq: 2 });
  const first = e.derive(game(), scored).events;
  const td = first.find((x) => x.type === "SCORE_CHANGE")!;
  const { events, reversedIds } = e.derive(scored, game({ homeScore: 24, seq: 3 }));
  assert.ok(reversedIds.includes(td.id));
  assert.equal(td.state, "reversed");
  assert.equal(events[0].type, "SCORE_CORRECTION");
});

test("red zone, turnover and game end are derived from the situation", () => {
  const e = new EventEngine({ favoriteTeams: ["MISS"] });
  const g0 = game();
  e.derive(undefined, g0);
  const rz = e.derive(g0, game({ seq: 2, situation: { possession: "home", yardLine: 84, redZone: true } }));
  assert.ok(rz.events.some((x) => x.type === "RED_ZONE" && x.teamAbbr === "MISS"));
  const to = e.derive(game({ seq: 2 }), game({ seq: 3, situation: { possession: "away", lastPlay: "pass intercepted by LSU" } }));
  assert.deepEqual(to.events.map((x) => x.type), ["TURNOVER", "INTERCEPTION"]);
  const end = e.derive(game({ seq: 3, homeScore: 31 }), game({ seq: 4, homeScore: 31, status: "final", periodLabel: "FINAL" }));
  assert.deepEqual(end.events.map((x) => x.type), ["GAME_END", "WIN"]);
});

test("scheduler releases after the broadcast delay and SYNC TO TV calibrates the profile", () => {
  let t = 100_000;
  const s = new DelayScheduler(() => t);
  const e = new EventEngine({ now: () => t });
  e.derive(undefined, game());
  const [change] = e.derive(game(), game({ homeScore: 27, seq: 2 })).events;
  s.schedule(change, 23_000);
  assert.equal(s.pump().length, 0);
  t += 10_000;
  assert.equal(s.pump().length, 0, "still waiting on the TV");
  const profile: BroadcastDelayProfile = { id: "p", roomId: "r", name: "YouTube TV", delayMs: 23_000 };
  t += 7_400; // person sees it at +17.4s
  const sync = s.syncToTv(profile);
  assert.equal(sync.delayMs, 17_400);
  assert.equal(profile.delayMs, 17_400);
  assert.equal(s.pump().length, 1, "re-timed event releases now");
  assert.equal(change.state, "released");
});

test("cancelled events never release", () => {
  let t = 0;
  const s = new DelayScheduler(() => t);
  const e = new EventEngine({ now: () => t });
  e.derive(undefined, game());
  const [change] = e.derive(game(), game({ homeScore: 27, seq: 2 })).events;
  s.schedule(change, 1000);
  assert.equal(s.cancel(change.id, "reversed"), true);
  t = 5000;
  assert.equal(s.pump().length, 0);
  assert.equal(change.state, "reversed");
});

test("rankGames puts favorites and close late games first and never ranks finals high", () => {
  const live = game({ id: "a", homeScore: 24, awayScore: 21, clockSeconds: 120 });
  const blowout = game({ id: "b", homeScore: 45, awayScore: 3, home: team("ALA"), away: team("UGA") });
  const done = game({ id: "c", status: "final", home: team("NO"), away: team("ATL") });
  const r = rankGames([blowout, done, live], ["MISS"]);
  assert.equal(r[0].gameId, "a");
  assert.ok(r[0].reasons.includes("favorite team"));
  assert.equal(r[r.length - 1].gameId, "c");
});
