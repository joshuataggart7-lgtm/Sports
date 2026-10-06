import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`file://${process.cwd()}/docs/renders/wall8-strips.html`); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/wall8-strips.png` });
await b.close();
