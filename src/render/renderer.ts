/**
 * Pixel renderer shared by every display. Takes a DisplayState and a clock and
 * paints an RGB frame. No DOM, no Node APIs: the browser draws the frame as LEDs,
 * the matrix bridge pushes the same bytes to real panels.
 */
import { GLYPH_GAP, GLYPH_H, GLYPH_W, glyphFor, iconGlyph, measure, type Glyph } from "./font.js";
import type { DisplayState, LaneItem, Moment } from "../core/types.js";

export interface Frame {
  w: number;
  h: number;
  /** RGB triplets, row-major. */
  px: Uint8ClampedArray;
}

export type RGB = [number, number, number];

export function createFrame(w: number, h: number): Frame {
  return { w, h, px: new Uint8ClampedArray(w * h * 3) };
}

export function clear(f: Frame, color: RGB = [0, 0, 0]): void {
  for (let i = 0; i < f.px.length; i += 3) {
    f.px[i] = color[0]; f.px[i + 1] = color[1]; f.px[i + 2] = color[2];
  }
}

export function hexToRgb(hex: string | undefined, fallback: RGB = [255, 255, 255]): RGB {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function scale(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

export function setPx(f: Frame, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
  const i = ((y | 0) * f.w + (x | 0)) * 3;
  f.px[i] = c[0]; f.px[i + 1] = c[1]; f.px[i + 2] = c[2];
}

export function fillRect(f: Frame, x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(f.w, (x + w) | 0), y1 = Math.min(f.h, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * f.w + xx) * 3;
      f.px[i] = c[0]; f.px[i + 1] = c[1]; f.px[i + 2] = c[2];
    }
  }
}

export function drawGlyph(f: Frame, x: number, y: number, g: Glyph, c: RGB, s = 1): void {
  if (x + GLYPH_W * s < 0 || x >= f.w) return;
  for (let gy = 0; gy < GLYPH_H; gy++) {
    const row = g[gy];
    if (!row) continue;
    for (let gx = 0; gx < GLYPH_W; gx++) {
      if (row & (1 << (GLYPH_W - 1 - gx))) {
        if (s === 1) setPx(f, x + gx, y + gy, c);
        else fillRect(f, x + gx * s, y + gy * s, s, s, c);
      }
    }
  }
}

/** Draws text, returns the pixel width drawn. */
export function drawText(f: Frame, x: number, y: number, text: string, c: RGB, s = 1): number {
  let cx = x;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    drawGlyph(f, cx, y, glyphFor(chars[i]), c, s);
    cx += GLYPH_W * s;
    if (i < chars.length - 1) cx += GLYPH_GAP * s;
  }
  return cx - x;
}

export function drawTextCentered(f: Frame, y: number, text: string, c: RGB, s = 1): void {
  const w = measure(text, s);
  drawText(f, Math.floor((f.w - w) / 2), y, text, c, s);
}

// ---------------------------------------------------------------------------
// Lanes

const CHIP_W = 3;
const ITEM_GAP = 6;
const WRAP_GAP = 24;

interface Placed { x: number; w: number; item: LaneItem }

function layoutStrip(items: LaneItem[], s: number, separator: string): { placed: Placed[]; width: number } {
  const placed: Placed[] = [];
  let x = 0;
  const sepW = separator ? measure(separator, s) : 0;
  items.forEach((item, i) => {
    let w = 0;
    if (item.chip) w += (CHIP_W + 2) * s;
    if (item.icon && iconGlyph(item.icon)) w += (GLYPH_W + GLYPH_GAP) * s;
    w += measure(item.text, s);
    placed.push({ x, w, item });
    x += w;
    if (i < items.length - 1) x += ITEM_GAP * s + sepW + ITEM_GAP * s;
  });
  return { placed, width: x };
}

function drawItem(f: Frame, x: number, y: number, item: LaneItem, s: number, laneColor: RGB, bright: number): void {
  let cx = x;
  if (item.chip) {
    fillRect(f, cx, y, CHIP_W * s, GLYPH_H * s, scale(hexToRgb(item.chip), bright));
    cx += (CHIP_W + 2) * s;
  }
  const color = scale(hexToRgb(item.color, laneColor), bright);
  if (item.icon) {
    const g = iconGlyph(item.icon);
    if (g) { drawGlyph(f, cx, y, g, color, s); cx += (GLYPH_W + GLYPH_GAP) * s; }
  }
  drawText(f, cx, y, item.text, color, s);
}

function drawLane(f: Frame, lane: DisplayState["lanes"][number], now: number, bright: number): void {
  const s = Math.max(1, Math.min(3, lane.scale | 0));
  const laneColor = hexToRgb(lane.color, [255, 255, 255]);
  const textY = lane.y + Math.floor((lane.height - GLYPH_H * s) / 2);
  const items = lane.items.length ? lane.items : [{ key: "_empty", text: "", color: "#404040" }];
  const { placed, width } = layoutStrip(items, s, lane.separator);
  const sepColor = scale([90, 90, 90], bright);
  const sepW = lane.separator ? measure(lane.separator, s) : 0;

  const drawAt = (x0: number) => {
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const px = x0 + p.x;
      if (px + p.w < 0 || px > f.w) {
        // still may need the separator after it
      } else {
        drawItem(f, px, textY, p.item, s, laneColor, bright);
      }
      if (lane.separator && i < placed.length - 1) {
        const sx = px + p.w + ITEM_GAP * s;
        if (sx + sepW >= 0 && sx <= f.w) drawText(f, sx, textY, lane.separator, sepColor, s);
      }
    }
  };

  if (lane.mode === "auto" && width <= f.w - 4) {
    drawAt(Math.floor((f.w - width) / 2));
    return;
  }
  const period = width + WRAP_GAP * s;
  const offset = ((now / 1000) * lane.speed) % period;
  const x = f.w - offset;
  drawAt(x);
  drawAt(x + period);
  if (x - period + period > 0) drawAt(x - period);
}

// ---------------------------------------------------------------------------
// Moments

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function prng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function fitScale(f: Frame, text: string, maxH: number): number {
  for (const s of [3, 2, 1]) if (measure(text, s) <= f.w - 4 && GLYPH_H * s <= maxH) return s;
  return 1;
}

function drawTitleBlock(f: Frame, m: Moment, bright: number, fg: RGB, sub: RGB, boxed: boolean): void {
  const hasSub = !!m.subtitle;
  const subH = hasSub ? GLYPH_H + 3 : 0;
  const s = fitScale(f, m.title, f.h - subH - 2);
  const titleH = GLYPH_H * s;
  const total = titleH + subH;
  const y0 = Math.floor((f.h - total) / 2);
  if (boxed) {
    const w = Math.max(measure(m.title, s), hasSub ? measure(m.subtitle!, 1) : 0) + 6;
    fillRect(f, Math.floor((f.w - w) / 2), y0 - 2, w, total + 4, [0, 0, 0]);
  }
  let title = m.title;
  while (measure(title, s) > f.w - 2 && title.length > 1) title = title.slice(0, -1);
  drawTextCentered(f, y0, title, scale(fg, bright), s);
  if (hasSub) {
    let st = m.subtitle!;
    while (measure(st, 1) > f.w - 2 && st.length > 1) st = st.slice(0, -1);
    drawTextCentered(f, y0 + titleH + 3, st, scale(sub, bright), 1);
  }
}

function drawMoment(f: Frame, m: Moment, now: number): void {
  const t = Math.max(0, now - m.startedAt);
  const remaining = m.durationMs - t;
  const bright = Math.min(1, t / 250, Math.max(0, remaining / 400));
  const c1 = hexToRgb(m.color, [255, 200, 0]);
  const c2 = hexToRgb(m.color2, [255, 255, 255]);
  const seed = hash(m.id);
  const white: RGB = [255, 255, 255];

  switch (m.kind) {
    case "flash": {
      if (t < 1200) {
        const on = Math.floor(t / 150) % 2 === 0;
        clear(f, on ? scale(c1, bright) : [0, 0, 0]);
        if (on) return; // pure color frames read as a strobe
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(t / 180);
        const border = scale(c1, bright * (0.35 + 0.65 * pulse));
        fillRect(f, 0, 0, f.w, 1, border); fillRect(f, 0, f.h - 1, f.w, 1, border);
        fillRect(f, 0, 0, 1, f.h, border); fillRect(f, f.w - 1, 0, 1, f.h, border);
      }
      drawTitleBlock(f, m, bright, white, c1, false);
      return;
    }
    case "confetti": {
      const rnd = prng(seed);
      const n = Math.floor((f.w * f.h) / 90);
      for (let i = 0; i < n; i++) {
        const x0 = rnd() * f.w, sp = 12 + rnd() * 28, phase = rnd() * (f.h + 8), drift = (rnd() - 0.5) * 6;
        const col = [c1, c2, white, c1][Math.floor(rnd() * 4)];
        const y = ((t / 1000) * sp + phase) % (f.h + 8) - 4;
        const x = x0 + Math.sin(t / 400 + i) * drift;
        const size = i % 3 === 0 ? 2 : 1;
        fillRect(f, x, y, size, size, scale(col, bright));
      }
      drawTitleBlock(f, m, bright, white, c1, true);
      return;
    }
    case "pulse": {
      const cx = f.w / 2, cy = f.h / 2;
      const maxR = Math.hypot(cx, cy) + 2;
      for (let k = 0; k < 3; k++) {
        const r = (((t / 900) + k / 3) % 1) * maxR;
        const col = scale(k === 1 ? c2 : c1, bright * (1 - r / maxR));
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const d = Math.hypot((x - cx) * (f.h / f.w) * 2, y - cy);
          if (Math.abs(d - r * (f.h / Math.max(f.w, f.h)) * 2) < 1) setPx(f, x, y, col);
        }
      }
      drawTitleBlock(f, m, bright, white, c1, true);
      return;
    }
    case "rain": {
      const rnd = prng(seed);
      const n = Math.floor(f.w / 3);
      for (let i = 0; i < n; i++) {
        const x = Math.floor(rnd() * f.w), sp = 20 + rnd() * 30, phase = rnd() * f.h * 2;
        const y = ((t / 1000) * sp + phase) % (f.h + 6) - 6;
        for (let k = 0; k < 4; k++) setPx(f, x, y + k, scale(c1, bright * (0.3 + k * 0.2)));
      }
      drawTitleBlock(f, m, bright, white, c2, true);
      return;
    }
    case "wipe":
    default: {
      const inT = 700;
      if (t < inT) { fillRect(f, 0, 0, Math.ceil(f.w * (t / inT)), f.h, scale(c1, bright)); return; }
      if (remaining < 500) { const k = remaining / 500; fillRect(f, 0, 0, f.w, f.h, scale(c1, k)); drawTitleBlock(f, m, k, [0, 0, 0], [0, 0, 0], false); return; }
      clear(f, c1);
      drawTitleBlock(f, m, 1, [0, 0, 0], [20, 20, 20], false);
      return;
    }
  }
}

// ---------------------------------------------------------------------------

export function renderState(f: Frame, state: DisplayState, now: number): void {
  clear(f);
  const m = state.moment;
  if (m && now - m.startedAt < m.durationMs) {
    drawMoment(f, m, now);
    return;
  }
  for (let i = 0; i < state.lanes.length; i++) {
    const lane = state.lanes[i];
    drawLane(f, lane, now, 1);
    if (i < state.lanes.length - 1) fillRect(f, 0, lane.y + lane.height, f.w, 1, [18, 18, 18]);
  }
}
