import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulatedProvider } from "../src/index";

test("simulated games progress and keep scores consistent with plays", async () => {
  const p = new SimulatedProvider({ seed: 3, overturnRate: 0 });
  const games = await p.getGames();
  assert.ok(games.length >= 4);
  const g = games[0];
  const seen: number[] = [];
  p.subscribeToGame(g.id, (game) => seen.push(game.seq));
  for (let i = 0; i < 60; i++) p.tickAll();
  const after = (await p.getGame(g.id))!;
  assert.ok(after.seq > g.seq);
  const plays = await p.getPlayByPlay(g.id);
  const last = plays[plays.length - 1];
  assert.equal(last.homeScore, after.homeScore);
  assert.equal(last.awayScore, after.awayScore);
  assert.ok(seen.length > 1);
});

test("forced touchdown adds points and an overturn removes them", async () => {
  const p = new SimulatedProvider({ seed: 5, overturnRate: 0 });
  const [g] = await p.getGames(undefined, "ncaaf");
  const before = g.homeScore;
  const play = p.forcePlay(g.id, "touchdown", "home")!;
  assert.equal(play.type, "touchdown");
  const mid = (await p.getGame(g.id))!;
  assert.ok(mid.homeScore === before + 6 || mid.homeScore === before + 7);
  const rev = p.forceOverturn(g.id)!;
  assert.equal(rev.type, "review");
  const after = (await p.getGame(g.id))!;
  assert.equal(after.homeScore, before);
});
