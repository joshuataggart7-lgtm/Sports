import fs from "node:fs";
import { chromium } from "playwright";
const base = "http://localhost:8790"; const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const snap = await (await fetch(base + "/api/snapshot")).json();
const code = (id) => snap.displays.find((d) => d.id === id).pairingCode;
await post("/api/room", { watchedGameIds: ["sim:ncaaf:LSU@MISS"] });
await post("/api/mode", { mode: "GAME_DAY" }); await new Promise((r) => setTimeout(r, 2500));
await post("/api/displays/disp_left/role", { role: "PLAYER_STATS" });
await post("/api/displays/disp_right/role", { role: "LEAGUE_SCORES" });
const extra = await (await post("/api/displays", { name: "Small TV", kind: "tv" })).json();
const mon = await (await post("/api/displays", { name: "Monitor", kind: "tv" })).json();
await post(`/api/displays/${extra.id}/role`, { role: "SCOREBOARD" });
await post(`/api/displays/${mon.id}/role`, { role: "ROOM_STATUS" });
const pages = {};
for (const [name, c, vp] of [["stats", code("disp_left"), [1920,1080]], ["league", code("disp_right"), [1920,1080]], ["scoreboard", extra.pairingCode, [1920,1080]], ["status", mon.pairingCode, [1920,1080]]]) {
  const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } }); await p.goto(`${base}/display/${c}`); pages[name] = p;
}
const proj = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await proj.goto(`${base}/display/projector?mode=ticker`); pages.ribbon = proj;
await new Promise((r) => setTimeout(r, 2000));
for (const [n, p] of Object.entries(pages)) await p.screenshot({ path: `${out}/${n}.png`, ...(n === "ribbon" ? { clip: { x: 0, y: 0, width: 1920, height: 220 } } : {}) });
await post("/api/events/manual", { type: "TOUCHDOWN", side: "home" });
await new Promise((r) => setTimeout(r, 1200));
for (const [n, p] of Object.entries(pages)) await p.screenshot({ path: `${out}/${n}-td.png`, ...(n === "ribbon" ? { clip: { x: 0, y: 0, width: 1920, height: 220 } } : {}) });
await b.close();
