// Captures every Room OS screen from a running agent (default http://localhost:8790).
// Usage: CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshots.mjs out-dir
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.env.ROOM_URL ?? "http://localhost:8790";
const out = process.argv[2] ?? "screenshots";
fs.mkdirSync(out, { recursive: true });
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const page = async (vp) => { const p = await b.newPage({ viewport: vp }); p.on("pageerror", (e) => errors.push(e.message)); return p; };

const snap = await (await fetch(base + "/api/snapshot")).json();
const code = (id) => snap.displays.find((d) => d.id === id).pairingCode;

await post("/api/mode", { mode: "GAME_DAY" });
await new Promise((r) => setTimeout(r, 2500));

const desktop = await page({ width: 1366, height: 900 });
for (const [name, path] of [["home", "/"], ["live", "/game"], ["room", "/room"], ["displays", "/displays"], ["automations", "/automations"], ["timeline", "/timeline"], ["settings", "/settings"]]) {
  await desktop.goto(base + path); await desktop.waitForTimeout(1200); await desktop.screenshot({ path: `${out}/${name}.png`, fullPage: name !== "home" });
}
const phone = await page({ width: 390, height: 844 });
await phone.goto(base + "/"); await phone.waitForTimeout(1200); await phone.screenshot({ path: `${out}/phone-home.png` });
await phone.goto(base + "/game"); await phone.waitForTimeout(1200); await phone.screenshot({ path: `${out}/phone-live.png` });
await phone.goto(base + "/guest"); await phone.waitForTimeout(1000); await phone.screenshot({ path: `${out}/phone-guest.png` });

const tv = await page({ width: 1920, height: 1080 });
await tv.goto(`${base}/display/${code("disp_sony")}`); await tv.waitForTimeout(1500); await tv.screenshot({ path: `${out}/display-main-game.png` });
const left = await page({ width: 1920, height: 1080 });
await left.goto(`${base}/display/${code("disp_right")}`); await left.waitForTimeout(1500); await left.screenshot({ path: `${out}/display-league-scores.png` });
const desk = await page({ width: 1920, height: 540 });
await desk.goto(`${base}/display/${code("disp_desk")}`); await desk.waitForTimeout(1500); await desk.screenshot({ path: `${out}/display-room-status.png` });
const proj = await page({ width: 1920, height: 1080 });
await proj.goto(`${base}/display/projector?mode=ticker`); await proj.waitForTimeout(1500); await proj.screenshot({ path: `${out}/projector-ribbon.png` });
await proj.screenshot({ path: `${out}/projector-ribbon-crop.png`, clip: { x: 0, y: 0, width: 1920, height: 220 } });

// Manual touchdown: the room celebrates now (no delay for manual events).
await post("/api/events/manual", { type: "TOUCHDOWN", side: "home" });
await new Promise((r) => setTimeout(r, 900));
await proj.screenshot({ path: `${out}/projector-touchdown.png`, clip: { x: 0, y: 0, width: 1920, height: 220 } });
await left.screenshot({ path: `${out}/display-touchdown-overlay.png` });
await b.close();
console.log(`wrote ${fs.readdirSync(out).length} screenshots to ${out}`);
if (errors.length) { console.log("PAGE ERRORS:", errors); process.exit(1); }
