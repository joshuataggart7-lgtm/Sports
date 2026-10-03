import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/core/engine.js";
import { DEFAULT_CONFIG } from "../src/core/config.js";
import type { LanesConfig, Moment } from "../src/core/types.js";

function engine(over: Partial<LanesConfig> = {}): Engine {
  return new Engine({ ...structuredClone(DEFAULT_CONFIG), ...over });
}
const moment = (priority: number, cost = 1): Moment => ({ id: `m${Math.random()}`, kind: "flash", title: "T", color: "#fff", durationMs: 5000, priority, cost, startedAt: 0 });

test("rules push lane items and moments from events", () => {
  const e = engine({ rules: [{ id: "a", when: { source: "sports", kind: "score" }, then: { lane: { id: "top", text: "{{team}} scored", ttl: 1000 }, moment: { kind: "confetti", title: "{{team}}", priority: 60 } } }] });
  e.contextFor("sports").emit({ kind: "score", key: "g", title: "x", importance: 0.5, tags: [], data: { team: "HOU" } });
  const s = e.state();
  assert.equal(s.lanes[0].items[0].text, "HOU scored");
  assert.equal(s.moment?.title, "HOU");
  assert.equal(s.moment?.kind, "confetti");
});

test("cooldown and stop are honored", () => {
  const e = engine({ rules: [
    { id: "specific", when: { tags: "HOU" }, then: { lane: { id: "top", text: "specific" } }, cooldown: 60_000, stop: true },
    { id: "generic", when: { source: "sports" }, then: { lane: { id: "top", text: "generic" } } },
  ] });
  const ctx = e.contextFor("sports");
  ctx.emit({ kind: "score", key: "g", title: "x", importance: 0.5, tags: ["HOU"], data: {} });
  ctx.emit({ kind: "score", key: "g", title: "x", importance: 0.5, tags: ["HOU"], data: {} });
  const actions = e.firedLog.map((f) => `${f.ruleId}:${f.action}`);
  assert.deepEqual(actions, ["specific:lane", "specific:skipped", "generic:lane"]);
});

test("higher priority preempts, lower priority queues", () => {
  const e = engine();
  assert.equal(e.fireMoment(moment(50)), "shown");
  assert.equal(e.fireMoment(moment(40)), "queued");
  assert.equal(e.fireMoment(moment(90)), "preempted");
  assert.equal(e.state().moment?.priority, 90);
});

test("attention budget demotes ordinary moments but not protected ones", () => {
  const e = engine({ attention: { budgetPerHour: 3, alwaysPriority: 85 } });
  assert.equal(e.fireMoment(moment(50, 2)), "shown");
  assert.equal(e.fireMoment(moment(50, 2)), "demoted:over-budget");
  assert.equal(e.fireMoment(moment(90, 2)), "preempted");
  assert.ok(e.state().lanes[0].items.some((i) => i.key.startsWith("demoted:")), "demoted moment became a lane item");
});

test("quiet hours demote below the protected priority", () => {
  const e = engine({ attention: { budgetPerHour: 100, alwaysPriority: 85, quietHours: { start: "00:00", end: "23:59" } } });
  assert.equal(e.fireMoment(moment(50)), "demoted:quiet-hours");
  assert.equal(e.fireMoment(moment(85)), "shown");
});

test("cards show up in the lanes that list their source, sorted by priority", () => {
  const e = engine();
  e.setCards("weather", [{ key: "a", source: "weather", text: "low", priority: 1 }, { key: "b", source: "weather", text: "high", priority: 9 }]);
  const bottom = e.state().lanes.find((l) => l.id === "bottom")!;
  assert.deepEqual(bottom.items.map((i) => i.text), ["high", "low"]);
  assert.equal(e.state().lanes[0].items.length, 0);
});
