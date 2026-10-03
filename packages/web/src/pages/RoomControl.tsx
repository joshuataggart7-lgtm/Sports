import type { RoomMode } from "@room/core";
import { MODE_LABELS } from "@room/core";
import { api } from "../app/api";
import { useRoom } from "../app/store";
import { Button, Card, Dot, StatusTag } from "../components/ui";
import { Connecting } from "./Home";

const MODES: Array<{ mode: RoomMode; hint: string; glyph: string }> = [
  { mode: "SPORTS", hint: "Wall on, ribbon up, sports audio", glyph: "🏈" },
  { mode: "MOVIE", hint: "Screen down, lights to theater, sports muted", glyph: "🎬" },
  { mode: "MULTIVIEW", hint: "Three games, scores on the ribbon", glyph: "▦" },
  { mode: "WORK", hint: "Desk on, wall off, neutral light", glyph: "💻" },
  { mode: "PARTY", hint: "Music, color, no desk", glyph: "🎉" },
  { mode: "AMBIENT", hint: "Projected art, low light", glyph: "✦" },
];

export function RoomControl() {
  const { snapshot: s } = useRoom();
  if (!s) return <Connecting />;
  const current = s.room.mode;
  return (
    <div className="space-y-5 rise">
      <header><h1 className="text-3xl font-bold tracking-tight">Room</h1><p className="text-sm text-mute">One button. The room does the rest.</p></header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MODES.map((m) => (
          <button key={m.mode} type="button" onClick={() => api("/api/mode", { mode: m.mode })} className={`flex aspect-[4/3] flex-col items-start justify-between rounded-xl2 border p-4 text-left transition active:scale-[0.98] ${current === m.mode ? "border-fog bg-panel2" : "border-line bg-panel hover:border-mute/60"}`}>
            <span className="text-2xl">{m.glyph}</span>
            <span><span className="block text-lg font-bold tracking-wide">{MODE_LABELS[m.mode].toUpperCase()}</span><span className="block text-xs text-mute">{m.hint}</span></span>
          </button>
        ))}
        <button type="button" onClick={() => api("/api/mode", { mode: "ALL_OFF" })} className={`col-span-2 flex items-center justify-between rounded-xl2 border p-4 sm:col-span-3 ${current === "ALL_OFF" ? "border-fog bg-panel2" : "border-line bg-panel hover:border-alert/50"}`}>
          <span className="text-lg font-bold tracking-wide">ALL OFF</span><span className="text-xs text-mute">Shuts down in sequence: audio, displays, projector, screen, lights</span>
        </button>
      </div>

      <Card title="Devices" right={<span className="text-xs text-mute">Tap to toggle. Manual changes hold off automations for 10 minutes.</span>}>
        <ul className="divide-y divide-line">
          {s.devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <Dot on={d.state.power === "on" || d.state.screenPosition === "down"} color={d.state.color && d.state.power === "on" ? d.state.color : undefined} />
                <div><div className="font-medium">{d.name}</div><div className="text-xs text-mute">{describe(d.state)}</div></div>
              </div>
              <div className="flex items-center gap-2">
                <StatusTag status={d.status} />
                {d.capabilities.includes("screen_position") ? (
                  <Button onClick={() => api(`/api/devices/${d.id}/command`, { command: { type: d.state.screenPosition === "down" ? "screen_up" : "screen_down" } })}>{d.state.screenPosition === "down" ? "Up" : "Down"}</Button>
                ) : d.capabilities.includes("power") ? (
                  <Button onClick={() => api(`/api/devices/${d.id}/command`, { command: { type: d.state.power === "on" ? "power_off" : "power_on" } })}>{d.state.power === "on" ? "Off" : "On"}</Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function describe(st: { power?: string; input?: string; volume?: number; brightness?: number; color?: string; effect?: string; screenPosition?: string }): string {
  const parts: string[] = [];
  if (st.screenPosition) parts.push(`screen ${st.screenPosition}`);
  else parts.push(st.power ?? "unknown");
  if (st.input) parts.push(`input ${st.input}`);
  if (st.volume !== undefined) parts.push(`vol ${st.volume}`);
  if (st.brightness !== undefined) parts.push(`${st.brightness}%`);
  if (st.color) parts.push(st.color);
  if (st.effect) parts.push(st.effect.split(":")[0]);
  return parts.join(" · ");
}
