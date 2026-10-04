import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const base = "file://" + process.cwd() + "/docs/renders/wall7.html";
for (const [m, f] of [["", "wall7-gameday.png"], ["?mode=td", "wall7-touchdown.png"]]) { await p.goto(base + m); await p.waitForTimeout(800); await p.screenshot({ path: "docs/renders/" + f }); }
await b.close();
