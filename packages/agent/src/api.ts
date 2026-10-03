import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, RoomSnapshot, ServerMessage, DisplayRole, DeviceCommand, RoomMode, SportsEventType } from "@room/core";
import { DISPLAY_ROLES, ROOM_MODES } from "@room/core";
import type { Agent } from "./agent";

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

export function createApi(agent: Agent, opts: { staticDir?: string; pin?: string }) {
  const json = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(body)); };
  const readBody = (req: http.IncomingMessage) => new Promise<Record<string, unknown>>((resolve, reject) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 1e6) reject(new Error("too large")); }); req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } }); });
  const authorized = (req: http.IncomingMessage, url: URL) => !opts.pin || req.headers["x-room-pin"] === opts.pin || url.searchParams.get("pin") === opts.pin;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = url.pathname;
    const m = req.method ?? "GET";
    try {
      if (m === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,x-room-pin", "access-control-allow-methods": "GET,POST,PUT,DELETE" }); return res.end(); }
      if (p.startsWith("/api/")) {
        if (p === "/api/health") return json(res, 200, { ok: true, agent: agent.status() });
        if (p === "/api/displays/pair" && m === "POST") { const b = await readBody(req); const d = agent.displays.pair(String(b.code ?? "")); return d ? json(res, 200, d) : json(res, 404, { error: "No display with that code" }); }
        if (!authorized(req, url)) return json(res, 401, { error: "PIN required" });

        if (p === "/api/snapshot") return json(res, 200, agent.snapshot());
        if (p === "/api/mode" && m === "POST") { const b = await readBody(req); const mode = String(b.mode) as RoomMode; if (!ROOM_MODES.includes(mode)) return json(res, 400, { error: "unknown mode" }); void agent.orchestrator.setMode(mode, "manual"); return json(res, 202, { ok: true, mode }); }
        if (p.startsWith("/api/scenes/") && m === "POST") { const s = agent.orchestrator.scenes.find((x) => x.id === p.split("/")[3]); if (!s) return json(res, 404, { error: "no scene" }); void agent.orchestrator.runScene(s); return json(res, 202, { ok: true }); }
        if (p === "/api/devices/reconnect" && m === "POST") { agent.driverStatus = await agent.devices.connectAll(); agent.changed(); return json(res, 200, agent.driverStatus); }
        if (p.startsWith("/api/devices/") && m === "PUT") { const b = await readBody(req); const d = await agent.devices.update(p.split("/")[3], b); agent.changed(); return d ? json(res, 200, d) : json(res, 404, { error: "no device" }); }
        if (p.startsWith("/api/devices/") && p.endsWith("/command") && m === "POST") { const b = await readBody(req); const r = await agent.devices.execute(p.split("/")[3], b.command as DeviceCommand, "manual"); agent.changed(); return json(res, r.ok ? 200 : 400, r); }
        if (p === "/api/displays" && m === "POST") { const b = await readBody(req); const d = agent.displays.add(String(b.name ?? "Display"), (b.kind as "tv") ?? "tv", agent.room.id); return json(res, 200, d); }
        if (p.startsWith("/api/displays/") && p.endsWith("/role") && m === "POST") { const b = await readBody(req); const role = String(b.role) as DisplayRole; if (!DISPLAY_ROLES.includes(role)) return json(res, 400, { error: "unknown role" }); const d = agent.displays.setRole(p.split("/")[3], role, b.roleOptions as Record<string, unknown> | undefined); return d ? json(res, 200, d) : json(res, 404, { error: "no display" }); }
        if (p.startsWith("/api/displays/") && m === "PUT") { const b = await readBody(req); const d = agent.displays.update(p.split("/")[3], b); return d ? json(res, 200, d) : json(res, 404, { error: "no display" }); }
        if (p.startsWith("/api/displays/") && m === "DELETE") return json(res, agent.displays.remove(p.split("/")[3]) ? 200 : 404, { ok: true });
        if (p === "/api/presets/apply" && m === "POST") { const b = await readBody(req); const pr = agent.displays.applyPreset(String(b.id)); return pr ? json(res, 200, pr) : json(res, 404, { error: "no preset" }); }
        if (p === "/api/presets" && m === "POST") { const b = await readBody(req); return json(res, 200, agent.displays.savePreset(String(b.name ?? "Preset"), agent.room.id, b.id ? String(b.id) : undefined)); }
        if (p.startsWith("/api/presets/") && m === "DELETE") return json(res, agent.displays.deletePreset(p.split("/")[3]) ? 200 : 404, { ok: true });
        if (p === "/api/events/manual" && m === "POST") { const b = await readBody(req); const ev = agent.watcher.manual(String(b.type) as SportsEventType, b.side as "home" | "away" | undefined, b.gameId ? String(b.gameId) : undefined); return json(res, 200, ev); }
        if (p === "/api/sync" && m === "POST") { const b = await readBody(req); return json(res, 200, agent.sync(b.profileId ? String(b.profileId) : undefined, b.eventId ? String(b.eventId) : undefined)); }
        if (p === "/api/room" && m === "POST") { const b = await readBody(req); agent.updateRoom(b); return json(res, 200, agent.room); }
        if (p.startsWith("/api/delay-profiles/") && m === "PUT") { const b = await readBody(req); const pr = agent.delayProfiles.find((x) => x.id === p.split("/")[3]); if (!pr) return json(res, 404, { error: "no profile" }); Object.assign(pr, { name: b.name ?? pr.name, delayMs: b.delayMs !== undefined ? Number(b.delayMs) : pr.delayMs, source: b.source ?? pr.source, app: b.app ?? pr.app }); agent.changed(); return json(res, 200, pr); }
        if (p === "/api/delay-profiles" && m === "POST") { const b = await readBody(req); const pr = agent.addDelayProfile(String(b.name ?? "Profile"), Number(b.delayMs ?? 20000)); return json(res, 200, pr); }
        if (p.startsWith("/api/automations/") && m === "POST") { const b = await readBody(req); const a = agent.orchestrator.automations.find((x) => x.id === p.split("/")[3]); if (!a) return json(res, 404, { error: "no automation" }); if (typeof b.enabled === "boolean") a.enabled = b.enabled; agent.changed(); return json(res, 200, a); }
        if (p.startsWith("/api/automations/") && p.endsWith("/run") && m === "POST") { /* handled above by prefix; kept for clarity */ }
        if (p === "/api/sim" && m === "POST") { const b = await readBody(req); return json(res, 200, agent.simulate(String(b.action), b)); }
        if (p === "/api/games") return json(res, 200, [...agent.watcher.games.values()]);
        return json(res, 404, { error: "not found" });
      }
      // Static PWA (built) or a hint when it is not built.
      if (opts.staticDir && fs.existsSync(opts.staticDir)) {
        let file = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
        let full = path.join(opts.staticDir, file);
        if (!full.startsWith(opts.staticDir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) full = path.join(opts.staticDir, "index.html");
        res.writeHead(200, { "content-type": MIME[path.extname(full)] ?? "application/octet-stream", "cache-control": full.endsWith("index.html") ? "no-cache" : "public, max-age=3600" });
        return fs.createReadStream(full).pipe(res);
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("Room Agent is running. Build the web app (npm run build -w @room/web) or run it with npm run web.");
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // ------------------------------------------------------------------ realtime
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, { role: "app" | "display"; displayId?: string }>();
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.set(ws, { role: "app" });
      ws.on("message", (raw) => {
        let msg: ClientMessage;
        try { msg = JSON.parse(String(raw)); } catch { return; }
        if (msg.type === "hello") {
          const info = { role: msg.role, displayId: msg.displayId };
          if (msg.role === "display" && msg.displayId) agent.displays.seen(msg.displayId);
          else if (opts.pin && msg.token !== opts.pin) { ws.send(JSON.stringify({ type: "patch", patch: { agent: { ...agent.status(), online: false } } } satisfies ServerMessage)); ws.close(4401, "PIN required"); return; }
          clients.set(ws, info);
          ws.send(JSON.stringify({ type: "snapshot", snapshot: agent.snapshot() } satisfies ServerMessage));
        } else if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", t: msg.t } satisfies ServerMessage));
      });
      ws.on("close", () => clients.delete(ws));
    });
  });

  const send = (ws: WebSocket, msg: ServerMessage) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
  const broadcast = (msg: ServerMessage) => { for (const ws of clients.keys()) send(ws, msg); };

  let snapshotTimer: NodeJS.Timeout | null = null;
  agent.on("change", () => { if (snapshotTimer) return; snapshotTimer = setTimeout(() => { snapshotTimer = null; const s: RoomSnapshot = agent.snapshot(); broadcast({ type: "snapshot", snapshot: s }); }, 150); });
  agent.on("game", (game) => broadcast({ type: "game", game }));
  agent.on("stats", (stats) => broadcast({ type: "stats", stats }));
  agent.on("event", (event) => broadcast({ type: "event", event }));
  agent.on("timeline", (entry) => broadcast({ type: "timeline", entry }));
  agent.on("overlay", (ids, overlay) => broadcast({ type: "overlay", displayIds: ids, overlay }));

  return server;
}
