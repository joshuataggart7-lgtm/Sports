import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, template } from "../src/core/rules.js";
import type { LanesEvent, Rule } from "../src/core/types.js";

const ev: LanesEvent = {
  id: "1", ts: 0, source: "sports", kind: "score", key: "mlb:1", title: "HOU scores", text: "NYY 1 - HOU 4", importance: 0.7,
  tags: ["mlb", "HOU", "NYY"], data: { team: "HOU", teamColor: "#eb6e1f", points: 2, pct: 3.5 },
};
const rule = (when: Rule["when"]): Rule => ({ id: "r", when, then: {} });

test("plain values match source, kind and tags", () => {
  assert.equal(matches(rule({ source: "sports", kind: "score", tags: "hou" }), ev), true);
  assert.equal(matches(rule({ source: "weather" }), ev), false);
  assert.equal(matches(rule({ tags: "DAL" }), ev), false);
});

test("data fields and numeric operators", () => {
  assert.equal(matches(rule({ team: "HOU", points: { gte: 2 } }), ev), true);
  assert.equal(matches(rule({ points: { gt: 2 } }), ev), false);
  assert.equal(matches(rule({ pct: { gte: 3 } }), ev), true);
  assert.equal(matches(rule({ tags: { in: ["DAL", "NYY"] } }), ev), true);
  assert.equal(matches(rule({ tags: { ne: "HOU" } }), ev), false);
  assert.equal(matches(rule({ title: { regex: "scores$" } }), ev), true);
});

test("disabled rules never match", () => {
  assert.equal(matches({ ...rule({ source: "sports" }), enabled: false }, ev), false);
});

test("templates read event fields and flattened data", () => {
  assert.equal(template("{{team}} +{{points}} ({{source}}/{{kind}})", ev), "HOU +2 (sports/score)");
  assert.equal(template("{{data.teamColor}} {{missing}}", ev), "#eb6e1f ");
});
