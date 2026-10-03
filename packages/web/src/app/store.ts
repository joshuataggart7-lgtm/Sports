/**
 * One WebSocket to the Room Agent, one snapshot, many subscribers. Game updates, events,
 * timeline entries and overlays are patched in; everything else arrives as a fresh snapshot.
 */
import { useSyncExternalStore } from "react";
import type { DisplayOverlay, Game, RoomSnapshot, ServerMessage, SportsEvent, TimelineEntry } from "@room/core";
import { pin } from "./api";

export interface RoomState {
  connected: boolean;
  authFailed: boolean;
  snapshot: RoomSnapshot | null;
  overlays: Record<string, DisplayOverlay>;   // by display id, "all" applies to every display
  lastEvent: SportsEvent | null;
}

let state: RoomState = { connected: false, authFailed: false, snapshot: null, overlays: {}, lastEvent: null };
const listeners = new Set<() => void>();
let ws: WebSocket | null = null;
let role: "app" | "display" = "app";
let displayId: string | undefined;
let reconnect: ReturnType<typeof setTimeout> | null = null;

function set(patch: Partial<RoomState>): void { state = { ...state, ...patch }; for (const l of listeners) l(); }

export function connect(opts: { role: "app" | "display"; displayId?: string } = { role: "app" }): void {
  role = opts.role; displayId = opts.displayId;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => { ws!.send(JSON.stringify({ type: "hello", role, displayId, token: pin() ?? undefined })); set({ connected: true, authFailed: false }); };
  ws.onmessage = (m) => handle(JSON.parse(m.data as string) as ServerMessage);
  ws.onclose = (e) => {
    set({ connected: false, authFailed: e.code === 4401 });
    if (reconnect) clearTimeout(reconnect);
    reconnect = setTimeout(() => connect({ role, displayId }), e.code === 4401 ? 5000 : 1500);
  };
  ws.onerror = () => ws?.close();
}

export function reconnectNow(): void { ws?.close(); }

function handle(msg: ServerMessage): void {
  const s = state.snapshot;
  switch (msg.type) {
    case "snapshot": set({ snapshot: msg.snapshot }); break;
    case "game": if (s) set({ snapshot: { ...s, games: s.games.some((g) => g.id === msg.game.id) ? s.games.map((g) => (g.id === msg.game.id ? msg.game : g)) : [...s.games, msg.game] } }); break;
    case "event": if (s) { const rest = s.recentEvents.filter((e) => e.id !== msg.event.id); set({ snapshot: { ...s, recentEvents: [msg.event, ...rest].slice(0, 40), pendingEvents: msg.event.state === "pending" ? [msg.event, ...s.pendingEvents.filter((e) => e.id !== msg.event.id)] : s.pendingEvents.filter((e) => e.id !== msg.event.id) }, lastEvent: msg.event }); } break;
    case "timeline": if (s) set({ snapshot: { ...s, timeline: [msg.entry, ...s.timeline].slice(0, 120) } }); break;
    case "overlay": {
      const next = { ...state.overlays };
      const ids = msg.displayIds === "all" ? ["all"] : msg.displayIds;
      for (const id of ids) { if (msg.overlay.kind === "clear") { delete next[id]; if (id === "all") for (const k of Object.keys(next)) delete next[k]; } else next[id] = msg.overlay; }
      set({ overlays: next });
      break;
    }
    default: break;
  }
}

export function useRoom(): RoomState { return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state); }

export function gameById(s: RoomSnapshot | null, id?: string): Game | undefined { return s?.games.find((g) => g.id === id); }
export function primaryGame(s: RoomSnapshot | null): Game | undefined { return gameById(s, s?.room.watchedGameIds[0]); }
export function favoriteSide(s: RoomSnapshot | null, g?: Game): "home" | "away" | undefined {
  if (!s || !g) return undefined;
  const fav = s.room.favoriteTeams.map((t) => t.toUpperCase());
  if (fav.includes(g.home.abbreviation.toUpperCase())) return "home";
  if (fav.includes(g.away.abbreviation.toUpperCase())) return "away";
  return undefined;
}
export function fmtTime(ts: number): string { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
export function fmtClock(ts: number): string { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }); }
export function entryFor(_t: TimelineEntry): void { /* placeholder for future filtering */ }
