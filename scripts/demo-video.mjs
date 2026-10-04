// Records a ~50 s walkthrough of the room reacting to live events. Output: webm in out dir.
import fs from "node:fs";
import { chromium } from "playwright";
const base = "http://localhost:8790"; const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = await (await fetch(base + "/api/snapshot")).json();
const code = (id) => snap.displays.find((d) => d.id === id).pairingCode;
const ticker = snap.displays.find((d) => d.id === "disp_projector").roleOptions.ticker;
await post("/api/displays/disp_projector/role", { role: "PROJECTED_TICKER", roleOptions: { ticker: { ...ticker, x: 0, y: 343, width: 1920, height: 150, lower: { enabled: true, y: 49, height: 150, content: "scores", scrollPxPerSec: 90 } } } });
await post("/api/room", { watchedGameIds: ["sim:ncaaf:LSU@MISS"] });
await post("/api/mode", { mode: "GAME_DAY" }); await sleep(2500);
await post("/api/displays/disp_left/role", { role: "PLAYER_STATS" });
await post("/api/displays/disp_right/role", { role: "LEAGUE_SCORES" });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined, args: ["--ignore-certificate-errors", "--allow-file-access-from-files"] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const page = await ctx.newPage();
await page.goto(`file://${process.cwd()}/docs/renders/wall-live.html?left=${code("disp_left")}&right=${code("disp_right")}`);
const cap = (h, p, s) => page.evaluate(([h, p, s]) => window.setCaption(h, p, s), [h, p, s]);
const glow = (c) => page.evaluate((c) => window.setGlow(c), c);
const log = (t, hot) => page.evaluate(([t, hot]) => window.addLog(t, hot), [t, !!hot]);
await sleep(4500);
await log("Game Day: Sony on, Onkyo to Apple TV, side TVs to stats and scores, ribbon on");
await sleep(3500);

await cap("Red zone", "Ole Miss inside the 20. The ribbon pulses and the bias light warms up. No horn yet, it is just a heads-up.", "2 / 6");
await post("/api/events/manual", { type: "RED_ZONE", side: "home" }); await glow("#7a1020"); await log("RED ZONE · MISS at the LSU 14", true);
await sleep(6500);

await cap("Touchdown", "Both side TVs, both ribbon lines, the bias light and the horn fire together. Then everything puts itself back.", "3 / 6");
await post("/api/events/manual", { type: "TOUCHDOWN", side: "home" }); await glow("#CE1126"); await log("TOUCHDOWN MISS · all screens take over · fog 1.5 s · horn", true);
await sleep(9000); await glow("#1e3a8a"); await log("Restore: panels back, lights to team color");
await sleep(3000);

await cap("Opponent scores", "LSU answers. Shorter, muted, no horn. You still see it, you just do not celebrate it.", "4 / 6");
await post("/api/events/manual", { type: "TOUCHDOWN", side: "away" }); await glow("#3a2a66"); await log("LSU touchdown · quiet alert", true);
await sleep(7000); await glow("#1e3a8a");

await cap("Padres home run", "Switch the watched game and the same room speaks Padres: brown and gold, SD logo, the MLB score bug with count and outs.", "5 / 6");
await post("/api/room", { watchedGameIds: ["sim:mlb:SD@MIL"] }); await sleep(2500);
await post("/api/events/manual", { type: "HOME_RUN", side: "away" }); await glow("#2F241D"); await log("HOME RUN SD · Padres takeover", true);
await sleep(9000); await glow("#2F241D");

await cap("Manual buttons, always", "Every one of those is also a button on the iPad. Feed late? Tap it yourself. Something fires wrong? Pause automations for an hour.", "6 / 6");
await post("/api/events/manual", { type: "RESET" }); await log("RESET ROOM · back to Game Day");
await sleep(6000);
await ctx.close(); await b.close();
