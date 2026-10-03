import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, drawText, renderState } from "../src/render/renderer.js";
import { measure } from "../src/render/font.js";
import { parseIcs } from "../src/sources/calendar.js";
import type { DisplayState } from "../src/core/types.js";

const lit = (px: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < px.length; i += 3) if (px[i] || px[i + 1] || px[i + 2]) n++; return n; };

test("text measures and draws", () => {
  assert.equal(measure("HOU", 1), 17);
  assert.equal(measure("HOU", 2), 34);
  const f = createFrame(32, 8);
  assert.equal(drawText(f, 0, 0, "HOU", [255, 255, 255]), 17);
  assert.ok(lit(f.px) > 20);
});

test("lanes and moments both produce pixels, and moments expire", () => {
  const state: DisplayState = {
    v: 1, serverTime: 0, matrix: { width: 64, height: 16 }, attention: { spent: 0, budget: 1, quiet: false }, moment: null,
    lanes: [{ id: "a", y: 0, height: 16, speed: 10, scale: 1, mode: "auto", separator: "•", color: "#ffffff", items: [{ key: "k", text: "HELLO", chip: "#ff0000" }] }],
  };
  const f = createFrame(64, 16);
  renderState(f, state, 1000);
  const laneLit = lit(f.px);
  assert.ok(laneLit > 30);
  const m = { id: "m", kind: "wipe" as const, title: "GO", color: "#00ff00", durationMs: 3000, priority: 50, cost: 1, startedAt: 0 };
  renderState(f, { ...state, moment: m }, 1500);
  assert.ok(lit(f.px) > laneLit, "wipe fills the frame");
  renderState(f, { ...state, moment: m }, 5000);
  assert.equal(lit(f.px), laneLit, "after the moment ends the lanes are back");
});

test("ics parser reads timed and all-day events", () => {
  const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Standup\r\nDTSTART:20261003T150000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Trash\r\nDTSTART;VALUE=DATE:20261007\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
  const ev = parseIcs(ics);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].summary, "Standup");
  assert.equal(ev[0].start, Date.UTC(2026, 9, 3, 15, 0, 0));
  assert.equal(ev[1].allDay, true);
});
