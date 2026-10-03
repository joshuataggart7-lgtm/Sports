// Renders the font and every moment kind to PNG files so they can be checked by eye.
import fs from "node:fs";
import zlib from "node:zlib";
import { createFrame, drawText, renderState, type Frame } from "../src/render/renderer.js";
import { ICONS, iconGlyph } from "../src/render/font.js";
import { drawGlyph } from "../src/render/renderer.js";
import type { DisplayState } from "../src/core/types.js";

function png(f: Frame, scale = 4): Buffer {
  const w = f.w * scale, h = f.h * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (((y / scale) | 0) * f.w + ((x / scale) | 0)) * 3;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = f.px[i]; raw[o + 1] = f.px[i + 1]; raw[o + 2] = f.px[i + 2];
    }
  }
  const crc = (buf: Buffer) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const out = process.argv[2] ?? "/tmp/lanes-preview";
fs.mkdirSync(out, { recursive: true });

// Font sheet
const sheet = createFrame(200, 80);
drawText(sheet, 1, 1, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", [255, 255, 255]);
drawText(sheet, 1, 10, "abcdefghijklmnopqrstuvwxyz", [255, 255, 255]);
drawText(sheet, 1, 19, "0123456789 !\"#$%&'()*+,-./", [255, 220, 100]);
drawText(sheet, 1, 28, ":;<=>?@[\\]^_`{|}~°•↑↓→←★♥✓", [100, 220, 255]);
let x = 1;
for (const name of Object.keys(ICONS)) { drawGlyph(sheet, x, 40, iconGlyph(name)!, [120, 255, 160]); x += 7; }
drawText(sheet, 1, 52, "HOU 4 NYY 1", [255, 255, 255], 2);
fs.writeFileSync(`${out}/font.png`, png(sheet, 4));

// Lanes + each moment
const base: DisplayState = {
  v: 1, serverTime: 0, matrix: { width: 256, height: 64 }, attention: { spent: 0, budget: 20, quiet: false }, moment: null,
  lanes: [
    { id: "top", y: 0, height: 31, speed: 36, scale: 2, mode: "scroll", separator: "•", color: "#ffffff", items: [{ key: "a", text: "NYY 1 HOU 4 Top 7", chip: "#eb6e1f" }, { key: "b", text: "BTC 84,523 ↓0.3%", color: "#ff6b6b" }, { key: "c", text: "ETH 2,670 ↑1.2%", color: "#5ee37a" }] },
    { id: "bottom", y: 32, height: 32, speed: 26, scale: 2, mode: "auto", separator: "•", color: "#ffffff", items: [{ key: "d", text: "Fri 7:21 PM", icon: "clock", color: "#9ad1ff" }, { key: "e", text: "80°F Partly cloudy", icon: "sun", color: "#ffe08a" }] },
  ],
};
const f = createFrame(256, 64);
renderState(f, base, 2500);
fs.writeFileSync(`${out}/lanes.png`, png(f, 4));
for (const kind of ["flash", "confetti", "pulse", "rain", "wipe"] as const) {
  const m = { id: `m-${kind}`, kind, title: "HOU SCORE!", subtitle: "NYY 1 - HOU 4", color: "#eb6e1f", color2: "#ffffff", durationMs: 6000, priority: 80, cost: 4, startedAt: 0 };
  renderState(f, { ...base, moment: m }, 2000);
  fs.writeFileSync(`${out}/moment-${kind}.png`, png(f, 4));
}
console.log(`wrote previews to ${out}`);
