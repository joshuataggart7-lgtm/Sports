import { useState } from "react";
import type { DisplayDevice, DisplayRole } from "@room/core";
import { DISPLAY_ROLES, ROLE_LABELS } from "@room/core";
import { api } from "../app/api";
import { useRoom } from "../app/store";
import { Button, Card, Dot } from "../components/ui";
import { Connecting } from "./Home";

const DRAGGABLE: DisplayRole[] = ["MAIN_GAME", "SECOND_GAME", "SCOREBOARD", "LEAGUE_SCORES", "PLAYER_STATS", "FANTASY", "BRACKET", "ROOM_STATUS", "PROJECTED_TICKER", "AMBIENT", "MOVIE_INFO", "SOCIAL", "CUSTOM", "OFF"];

/**
 * Display layout editor: a schematic of the room. Drag a role chip onto a screen, or tap a
 * screen and pick a role. Save the arrangement as a preset.
 */
export function Displays() {
  const { snapshot: s } = useRoom();
  const [selected, setSelected] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [drag, setDrag] = useState<DisplayRole | null>(null);
  if (!s) return <Connecting />;
  const assign = (id: string, role: DisplayRole) => api(`/api/displays/${id}/role`, { role });
  const sel = s.displays.find((d) => d.id === selected);

  return (
    <div className="space-y-5 rise">
      <header className="flex items-end justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Displays</h1><p className="text-sm text-mute">Drag a role onto a screen. Nothing is hard-coded.</p></div></header>

      <Card title="Roles" right={<span className="text-xs text-mute">drag onto a screen</span>}>
        <div className="flex flex-wrap gap-2">
          {DRAGGABLE.map((r) => (
            <span key={r} draggable onDragStart={(e) => { e.dataTransfer.setData("text/role", r); setDrag(r); }} onDragEnd={() => setDrag(null)} onClick={() => sel && assign(sel.id, r)}
              className={`cursor-grab select-none rounded-lg border px-3 py-1.5 text-sm font-medium active:cursor-grabbing ${drag === r ? "border-fog" : "border-line bg-panel2"} ${sel ? "hover:border-fog" : ""}`}>{ROLE_LABELS[r]}</span>
          ))}
        </div>
        {sel && <p className="mt-2 text-xs text-mute">Tap a role to assign it to <b className="text-fog">{sel.name}</b>.</p>}
      </Card>

      <Card title="Room">
        <div className="relative aspect-[16/8] w-full overflow-hidden rounded-xl border border-line bg-ink" onDragOver={(e) => e.preventDefault()}>
          <div className="absolute left-[3%] right-[3%] top-[1%] text-center text-[9px] uppercase tracking-[0.3em] text-dim">TV wall · projector screen drops to here for the ribbon</div>
          <div className="absolute left-[34%] top-[46%] w-[32%] rounded-md border border-line/60 py-0.5 text-center text-[9px] uppercase tracking-widest text-dim">console · receiver · apple tv</div>
          <div className="absolute inset-x-[30%] bottom-[8%] rounded-t-3xl border border-line/60 px-3 py-1 text-center text-[10px] uppercase tracking-widest text-dim">loveseat (closet wall)</div>
          <div className="absolute right-[3%] bottom-[10%] w-[22%] rounded-md border border-line/60 py-1 text-center text-[9px] uppercase tracking-widest text-dim">window · curtains</div>
          {s.displays.map((d) => <Screen key={d.id} d={d} selected={selected === d.id} onSelect={() => setSelected(selected === d.id ? null : d.id)} onDrop={(role) => assign(d.id, role)} />)}
        </div>
        <p className="mt-2 text-xs text-mute">Screens report ● when a browser is paired and showing their role. Open <code>/display/&lt;code&gt;</code> on any TV browser.</p>
      </Card>

      {sel && (
        <Card title={sel.name} right={<span className="text-xs text-mute">pairing code <b className="tnum text-fog">{sel.pairingCode}</b></span>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Role<select className="mt-1 w-full rounded-lg border border-line bg-panel2 p-2" value={sel.role} onChange={(e) => assign(sel.id, e.target.value as DisplayRole)}>{DISPLAY_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
            {sel.role === "SECOND_GAME" && <label className="text-sm">Game<select className="mt-1 w-full rounded-lg border border-line bg-panel2 p-2" value={String(sel.roleOptions?.gameId ?? "")} onChange={(e) => api(`/api/displays/${sel.id}/role`, { role: sel.role, roleOptions: { gameId: e.target.value } })}><option value="">Best other game</option>{s.games.map((g) => <option key={g.id} value={g.id}>{g.away.abbreviation} @ {g.home.abbreviation}</option>)}</select></label>}
            {sel.role === "CUSTOM" && <label className="text-sm">URL<input className="mt-1 w-full rounded-lg border border-line bg-panel2 p-2" defaultValue={String(sel.roleOptions?.url ?? "")} onBlur={(e) => api(`/api/displays/${sel.id}/role`, { role: sel.role, roleOptions: { url: e.target.value } })} /></label>}
            <div className="text-sm"><div className="text-mute">Open on that screen</div><code className="text-fog">{location.origin}/display/{sel.id}</code></div>
            {sel.role === "PROJECTED_TICKER" && <TickerSettings d={sel} />}
          </div>
        </Card>
      )}

      <Card title="Presets">
        <div className="flex flex-wrap gap-2">
          {s.presets.map((p) => <span key={p.id} className="flex items-center gap-1 rounded-lg border border-line bg-panel2 pl-3 text-sm"><button type="button" className="py-1.5 font-medium" onClick={() => api("/api/presets/apply", { id: p.id })}>{p.name}</button><button type="button" className="px-2 py-1.5 text-mute hover:text-alert" title="delete" onClick={() => confirm(`Delete preset "${p.name}"?`) && api(`/api/presets/${p.id}`, undefined, "DELETE")}>✕</button></span>)}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="flex-1 rounded-lg border border-line bg-panel2 p-2 text-sm" placeholder="Save current layout as…" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <Button disabled={!presetName.trim()} onClick={() => { api("/api/presets", { name: presetName.trim() }); setPresetName(""); }}>Save preset</Button>
        </div>
      </Card>
    </div>
  );
}

function Screen({ d, selected, onSelect, onDrop }: { d: DisplayDevice; selected: boolean; onSelect: () => void; onDrop: (r: DisplayRole) => void }) {
  const [over, setOver] = useState(false);
  const isRibbon = d.kind === "projector";
  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const r = e.dataTransfer.getData("text/role") as DisplayRole; if (r) onDrop(r); }}
      className={`absolute flex cursor-pointer flex-col items-center justify-center rounded-md border text-center transition ${over ? "border-fog bg-panel2 scale-[1.03]" : selected ? "border-fog bg-panel2" : "border-line bg-panel hover:border-mute"} ${isRibbon ? "rounded-sm" : ""}`}
      style={{ left: `${d.position.x}%`, top: `${d.position.y}%`, width: `${d.position.w}%`, height: `${d.position.h}%` }}>
      <div className="absolute right-1 top-1"><Dot on={d.paired} /></div>
      <div className={`font-semibold ${isRibbon ? "text-[10px]" : "text-xs sm:text-sm"}`}>{d.name}</div>
      <div className={`text-mute ${isRibbon ? "text-[9px]" : "text-[10px] sm:text-xs"}`}>{ROLE_LABELS[d.role]}</div>
    </div>
  );
}

function TickerSettings({ d }: { d: DisplayDevice }) {
  const t = (d.roleOptions?.ticker ?? {}) as Record<string, unknown>;
  const set = (k: string, v: unknown) => api(`/api/displays/${d.id}/role`, { role: "PROJECTED_TICKER", roleOptions: { ticker: { ...t, [k]: v } } });
  const num = (k: string, label: string) => <label className="text-xs text-mute">{label}<input type="number" className="mt-1 w-full rounded-lg border border-line bg-panel2 p-1.5 text-sm text-fog" defaultValue={Number(t[k] ?? 0)} onBlur={(e) => set(k, Number(e.target.value))} /></label>;
  const bool = (k: string, label: string) => <label className="flex items-center gap-2 text-xs text-mute"><input type="checkbox" checked={Boolean(t[k])} onChange={(e) => set(k, e.target.checked)} />{label}</label>;
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-mute">Projected ribbon viewport (px on the projector image)</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{num("x", "X")}{num("y", "Y")}{num("width", "Width")}{num("height", "Height")}{num("fontPx", "Font px")}{num("scrollPxPerSec", "Scroll px/s")}</div>
      <div className="mt-2 flex flex-wrap gap-4">
        <label className="text-xs text-mute">Mode<select className="ml-2 rounded-lg border border-line bg-panel2 p-1 text-sm text-fog" value={String(t.mode ?? "static")} onChange={(e) => set("mode", e.target.value)}><option value="static">static</option><option value="scroll">scroll</option></select></label>
        {bool("showClock", "clock")}{bool("showDownDistance", "down & distance")}{bool("showPossession", "possession")}{bool("redZoneAlert", "red-zone alert")}{bool("scoreFlash", "score flash")}
      </div>
      <p className="mt-2 text-xs text-mute">Everything outside the viewport renders true black. If the projector's black is not black enough, mask the lens or move the ribbon to a dark wall; the viewport math stays the same.</p>
    </div>
  );
}
