import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import * as esbuild from "esbuild";
import { loadConfig } from "./core/config.js";
import { Engine } from "./core/engine.js";
import { selectSources, webhook } from "./sources/index.js";
import { createFrame, renderState } from "./render/renderer.js";
import { composeRule, composerAvailable } from "./ai/composer.js";
import type { Rule } from "./core/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const demo = args.includes("--demo");
const configPath = path.resolve(args[args.indexOf("--config") + 1] && args.includes("--config") ? args[args.indexOf("--config") + 1] : "lanes.yaml");
const dataDir = path.join(root, "data");
const rulesFile = path.join(dataDir, "rules.json");
const publicDir = path.join(root, "public");

// ---------------------------------------------------------------- boot

const config = loadConfig(configPath);
const port = Number(process.env.PORT ?? config.port ?? 8787);
const engine = new Engine(config);

if (fs.existsSync(rulesFile)) {
  try { for (const r of JSON.parse(fs.readFileSync(rulesFile, "utf8")) as Rule[]) engine.addRule(r); }
  catch (e) { console.warn("[lanes] could not read data/rules.json:", (e as Error).message); }
}
const persistRules = () => {
  const fromConfig = new Set(config.rules.map((r) => r.id));
  const extra = engine.rules.filter((r) => !fromConfig.has(r.id) || JSON.stringify(r) !== JSON.stringify(config.rules.find((c) => c.id === r.id)));
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(rulesFile, JSON.stringify(extra, null, 2));
};

engine.on("log", (m: string) => console.log("[lanes]", m));
engine.on("rules", persistRules);
engine.start();

for (const { source, options } of selectSources(config, demo)) {
  Promise.resolve(source.start(engine.contextFor(source.id), options)).catch((e) => console.error(`[lanes] source ${source.id} failed:`, e));
}

await esbuild.build({
  entryPoints: [path.join(root, "src/client/display.ts")],
  bundle: true,
  format: "esm",
  target: "es2020",
  outfile: path.join(publicDir, "display.js"),
  logLevel: "silent",
});

// ---------------------------------------------------------------- http

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1_000_000) reject(new Error("body too large")); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const p = url.pathname;
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,DELETE" }); return res.end(); }

    if (p === "/api/state" && req.method === "GET") return json(res, 200, engine.state());
    if (p === "/api/config" && req.method === "GET") return json(res, 200, { ...config, demo, composer: composerAvailable() });
    if (p === "/api/rules" && req.method === "GET") return json(res, 200, engine.rules);
    if (p === "/api/rules" && req.method === "POST") {
      const rule = (await readBody(req)) as Rule;
      if (!rule?.id || !rule.when || !rule.then) return json(res, 400, { error: "rule needs id, when, then" });
      engine.addRule(rule);
      return json(res, 200, { ok: true, rule });
    }
    if (p.startsWith("/api/rules/") && req.method === "DELETE") {
      const id = decodeURIComponent(p.slice("/api/rules/".length));
      return json(res, engine.removeRule(id) ? 200 : 404, { ok: true });
    }
    if (p === "/api/events" && req.method === "POST") {
      const body = (await readBody(req)) as Parameters<typeof webhook.handle>[0];
      // `?as=sports` lets you test rules by impersonating another source.
      const as = url.searchParams.get("as");
      if (as && as !== "webhook") {
        if (!body?.title) return json(res, 400, { ok: false, error: "title is required" });
        engine.contextFor(as).emit({ kind: body.kind ?? "event", key: body.key ?? body.kind ?? "event", title: body.title, text: body.text, importance: body.importance ?? 0.5, tags: body.tags ?? [], data: body.data ?? {} });
        return json(res, 202, { ok: true, as });
      }
      const r = webhook.handle(body);
      return json(res, r.ok ? 202 : 400, r);
    }
    if (p === "/api/log" && req.method === "GET") return json(res, 200, { events: engine.eventLog.slice(-100), fired: engine.firedLog.slice(-100) });
    if (p === "/api/compose" && req.method === "POST") {
      if (!composerAvailable()) return json(res, 503, { error: "No Anthropic credentials found. Set ANTHROPIC_API_KEY (or run `ant auth login`) to compose rules in plain English. You can still paste rule JSON." });
      const { text } = (await readBody(req)) as { text?: string };
      if (!text?.trim()) return json(res, 400, { error: "text is required" });
      const out = await composeRule(text.trim(), config);
      return json(res, 200, out);
    }
    if (p === "/api/moment" && req.method === "POST") {
      const b = (await readBody(req)) as { kind?: string; title?: string; subtitle?: string; color?: string; color2?: string; duration?: number; priority?: number };
      const outcome = engine.fireMoment({ id: `manual-${Date.now()}`, kind: (b.kind as "flash") ?? "flash", title: b.title ?? "HELLO", subtitle: b.subtitle, color: b.color ?? "#ffcc00", color2: b.color2, durationMs: b.duration ?? 5000, priority: b.priority ?? 50, cost: 1, startedAt: 0 });
      return json(res, 200, { outcome });
    }

    // static
    let file = p === "/" ? "/index.html" : p === "/admin" ? "/admin.html" : p;
    file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
    const full = path.join(publicDir, file);
    if (!full.startsWith(publicDir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(full)] ?? "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
});

// ---------------------------------------------------------------- websockets

const wsState = new WebSocketServer({ noServer: true });
const wsFrames = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/ws") wsState.handleUpgrade(req, socket, head, (ws) => wsState.emit("connection", ws, req));
  else if (url.pathname === "/frames") wsFrames.handleUpgrade(req, socket, head, (ws) => wsFrames.emit("connection", ws, req));
  else socket.destroy();
});

function broadcast(msg: unknown): void {
  const s = JSON.stringify(msg);
  for (const c of wsState.clients) if (c.readyState === WebSocket.OPEN) c.send(s);
}
wsState.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "state", state: engine.state() }));
  ws.send(JSON.stringify({ type: "rules", rules: engine.rules }));
});
engine.on("state", (state) => broadcast({ type: "state", state }));
engine.on("event", (event) => broadcast({ type: "event", event }));
engine.on("fired", (fired) => broadcast({ type: "fired", fired }));
engine.on("rules", (rules) => broadcast({ type: "rules", rules }));
engine.on("log", (msg) => broadcast({ type: "log", msg }));
setInterval(() => { if (wsState.clients.size) broadcast({ type: "state", state: engine.state() }); }, 5000); // clock resync

/**
 * /frames streams raw RGB frames for hardware bridges (Raspberry Pi + HUB75 panels,
 * ESP32, anything that can draw pixels). First message is a JSON header {w,h,fps},
 * then binary frames of w*h*3 bytes.
 */
wsFrames.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://x");
  const fps = Math.min(60, Math.max(1, Number(url.searchParams.get("fps") ?? 20)));
  const frame = createFrame(config.matrix.width, config.matrix.height);
  ws.send(JSON.stringify({ w: frame.w, h: frame.h, fps }));
  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return clearInterval(timer);
    if (ws.bufferedAmount > frame.px.length * 4) return; // slow consumer, skip a frame
    renderState(frame, engine.state(), Date.now());
    ws.send(frame.px);
  }, 1000 / fps);
  ws.on("close", () => clearInterval(timer));
});

server.listen(port, () => {
  console.log(`[lanes] ${config.name ?? "Lanes"} on http://localhost:${port}  (display: /  admin: /admin  frames: ws://localhost:${port}/frames)`);
  console.log(`[lanes] config ${fs.existsSync(configPath) ? configPath : "defaults (no lanes.yaml found)"}${demo ? ", demo mode" : ""}, composer ${composerAvailable() ? "ready" : "off (no Anthropic credentials)"}`);
});
