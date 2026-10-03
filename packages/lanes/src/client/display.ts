/**
 * Browser display: receives DisplayState over a WebSocket, renders with the shared
 * pixel renderer at 60fps, and paints it as an LED matrix on a canvas.
 * Works on a TV, a tablet on the fridge, an old phone, or a kiosk window.
 */
import { createFrame, renderState, type Frame } from "../render/renderer.js";
import type { DisplayState } from "../core/types.js";

const canvas = document.getElementById("matrix") as HTMLCanvasElement;
const ctx2d = canvas.getContext("2d")!;
const status = document.getElementById("status")!;

let state: DisplayState | null = null;
let frame: Frame | null = null;
let offscreen: HTMLCanvasElement | null = null;
let mask: HTMLCanvasElement | null = null;
let clockOffset = 0;
let pixelSize = 4;

const params = new URLSearchParams(location.search);
const style = params.get("style") ?? "led"; // led | flat
const gap = Number(params.get("gap") ?? 0.22);

function connect(): void {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => { status.textContent = ""; };
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data as string);
    if (msg.type === "state") {
      const s = msg.state as DisplayState;
      const sample = s.serverTime - Date.now();
      clockOffset = clockOffset === 0 ? sample : clockOffset * 0.8 + sample * 0.2;
      if (!state || state.matrix.width !== s.matrix.width || state.matrix.height !== s.matrix.height) {
        frame = createFrame(s.matrix.width, s.matrix.height);
        layout();
      }
      state = s;
    }
  };
  ws.onclose = () => { status.textContent = "reconnecting…"; setTimeout(connect, 1500); };
  ws.onerror = () => ws.close();
}

function layout(): void {
  if (!frame) return;
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  pixelSize = Math.max(1, Math.floor(Math.min(W / frame.w, H / frame.h)));
  const cw = frame.w * pixelSize, ch = frame.h * pixelSize;
  canvas.width = cw * dpr; canvas.height = ch * dpr;
  canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.imageSmoothingEnabled = false;
  offscreen = document.createElement("canvas");
  offscreen.width = frame.w; offscreen.height = frame.h;
  // The LED mask: dark everywhere except a round hole per pixel. Drawn once, reused every frame.
  mask = document.createElement("canvas");
  mask.width = cw * dpr; mask.height = ch * dpr;
  const mc = mask.getContext("2d")!;
  mc.setTransform(dpr, 0, 0, dpr, 0, 0);
  mc.fillStyle = "#000";
  mc.fillRect(0, 0, cw, ch);
  if (style === "led" && pixelSize >= 3) {
    mc.globalCompositeOperation = "destination-out";
    const r = (pixelSize * (1 - gap)) / 2;
    for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
      mc.beginPath();
      mc.arc(x * pixelSize + pixelSize / 2, y * pixelSize + pixelSize / 2, r, 0, Math.PI * 2);
      mc.fill();
    }
  } else if (style === "led") {
    mc.globalCompositeOperation = "destination-out";
    mc.fillRect(0, 0, cw, ch);
  } else {
    mc.globalCompositeOperation = "destination-out";
    mc.fillRect(0, 0, cw, ch);
  }
}

function draw(): void {
  requestAnimationFrame(draw);
  if (!state || !frame || !offscreen || !mask) return;
  const now = Date.now() + clockOffset;
  renderState(frame, state, now);
  const oc = offscreen.getContext("2d")!;
  const img = oc.createImageData(frame.w, frame.h);
  const src = frame.px, dst = img.data;
  for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
    dst[j] = src[i]; dst[j + 1] = src[i + 1]; dst[j + 2] = src[i + 2]; dst[j + 3] = 255;
  }
  oc.putImageData(img, 0, 0);
  const cw = frame.w * pixelSize, ch = frame.h * pixelSize;
  ctx2d.fillStyle = "#000";
  ctx2d.fillRect(0, 0, cw, ch);
  if (style === "led" && pixelSize >= 3) {
    // Soft glow under the LEDs.
    ctx2d.save();
    ctx2d.filter = `blur(${pixelSize * 0.6}px)`;
    ctx2d.globalAlpha = 0.55;
    ctx2d.drawImage(offscreen, 0, 0, cw, ch);
    ctx2d.restore();
  }
  ctx2d.drawImage(offscreen, 0, 0, cw, ch);
  ctx2d.drawImage(mask, 0, 0, cw, ch);
}

window.addEventListener("resize", layout);
canvas.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});
connect();
draw();
