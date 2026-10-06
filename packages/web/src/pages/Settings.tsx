import { useState } from "react";
import { api, pin as getPin, setPin } from "../app/api";
import { reconnectNow, useRoom } from "../app/store";
import { Button, Card, StatusTag } from "../components/ui";
import type { RoomDevice } from "@room/core";
import { Connecting } from "./Home";

export function Settings() {
  const { snapshot: s } = useRoom();
  const [pinValue, setPinValue] = useState(getPin() ?? "");
  const [newProfile, setNewProfile] = useState({ name: "", delayMs: 20000 });
  if (!s) return <Connecting />;
  const watched = s.room.watchedGameIds[0] ?? "";
  return (
    <div className="space-y-5 rise">
      <header><h1 className="text-3xl font-bold tracking-tight">Settings</h1></header>

      <Card title="Game">
        <label className="block text-sm">Watched game<select className="mt-1 w-full rounded-lg border border-line bg-panel2 p-2" value={watched} onChange={(e) => api("/api/room", { watchedGameIds: e.target.value ? [e.target.value] : [] })}>
          <option value="">Auto (best game for my teams)</option>
          {s.games.map((g) => <option key={g.id} value={g.id}>{g.away.abbreviation} @ {g.home.abbreviation} · {g.leagueId.toUpperCase()} · {g.status}</option>)}
        </select></label>
        <label className="mt-3 block text-sm">Rivals (abbreviations; a game against one runs hotter)<input className="mt-1 w-full rounded-lg border border-line bg-panel2 p-2" defaultValue={(s.room.rivals ?? []).join(", ")} onBlur={(e) => api("/api/room", { rivals: e.target.value.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) })} /></label>
        <label className="mt-3 block text-sm">Favorite teams (abbreviations, comma separated)<input className="mt-1 w-full rounded-lg border border-line bg-panel2 p-2" defaultValue={s.room.favoriteTeams.join(", ")} onBlur={(e) => api("/api/room", { favoriteTeams: e.target.value.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) })} /></label>
        {s.suggestions.length > 0 && <div className="mt-3 text-xs text-mute">Suggested: {s.suggestions.slice(0, 3).map((x) => { const g = s.games.find((y) => y.id === x.gameId); return g ? `${g.away.abbreviation}@${g.home.abbreviation} (${x.reasons.join(", ")})` : x.gameId; }).join(" · ")}</div>}
      </Card>

      <Card title="Broadcast delay profiles" right={<span className="text-xs text-mute">per source, app or device</span>}>
        <ul className="divide-y divide-line">
          {s.delayProfiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="profile" checked={s.room.activeDelayProfileId === p.id} onChange={() => api("/api/room", { activeDelayProfileId: p.id })} /><span>{p.name}</span>{p.calibratedAt && <span className="text-xs text-mute">synced {new Date(p.calibratedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}</label>
              <span className="flex items-center gap-1 text-mute"><input type="number" className="tnum w-20 rounded-lg border border-line bg-panel2 p-1 text-right text-fog" defaultValue={(p.delayMs / 1000).toFixed(1)} step={0.5} onBlur={(e) => api(`/api/delay-profiles/${p.id}`, { delayMs: Math.round(Number(e.target.value) * 1000) }, "PUT")} /> s</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input className="flex-1 rounded-lg border border-line bg-panel2 p-2 text-sm" placeholder="New profile (e.g. Hulu on Roku)" value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} />
          <Button disabled={!newProfile.name.trim()} onClick={() => { api("/api/delay-profiles", newProfile); setNewProfile({ name: "", delayMs: 20000 }); }}>Add</Button>
        </div>
      </Card>

      <Card title="Devices" right={<Button onClick={() => api("/api/devices/reconnect", {})}>Re-probe all</Button>}>
        <p className="mb-3 text-xs text-mute">Point each device at real hardware. A device shows CONNECTED only after its driver reaches it. Drivers: <b>mock</b> (SIMULATED), <b>homeassistant</b> {"{ entityId }"}, <b>pjlink</b> {"{ host, password? }"} for projectors, <b>bravia</b> {"{ host, psk }"} for Sony TVs, <b>wled</b> {"{ host }"} for LED strips, <b>onkyo</b> {"{ host }"} for Onkyo receivers, <b>roku</b> {"{ host }"} for Roku TVs, <b>androidtv</b> {"{ host }"} for XGIMI projectors and other Android TVs (needs adb on the agent machine), <b>shelly</b> {"{ host, gen? }"} relays for fog machine, goal light or screen trigger, <b>govee</b> {"{ host }"} for Govee strips and lamps with LAN Control on, <b>wiz</b> {"{ host }"} or {"{ hosts: [...] }"} for WiZ bulbs (several bulbs as one light), <b>kasa</b> {"{ host }"} for Kasa plugs (Tapo needs username and password; the newest Tapo TP15 is not supported locally yet), <b>shortcuts</b> {"{ on: \"Name On\", off: \"Name Off\" }"} runs macOS Shortcuts, which can switch any Matter plug paired to Apple Home, <b>localaudio</b> plays clips from the agent machine.</p>
        <ul className="divide-y divide-line">
          {s.devices.map((d) => <DeviceRow key={d.id} d={d} drivers={s.agent.availableDrivers ?? ["mock"]} />)}
        </ul>
      </Card>

      <Card title="Room Agent">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Version</span><span className="text-mute">{s.agent.version}</span></li>
          <li className="flex justify-between"><span>Sports provider</span><span className="flex items-center gap-2 text-mute">{s.agent.provider.id} <StatusTag status={s.agent.provider.status} /></span></li>
          {Object.entries(s.agent.drivers).map(([k, v]) => <li key={k} className="flex justify-between"><span>Driver {k}</span><StatusTag status={v} /></li>)}
          <li className="flex justify-between"><span>Auth</span><span className="text-mute">{s.agent.auth === "NONE" ? "open on this network (set ROOM_PIN to require a PIN)" : s.agent.auth === "LOCAL_PIN" ? "household PIN (LOCAL)" : s.agent.auth}</span></li>
          <li className="flex justify-between"><span>Storage</span><span className="text-mute">local JSON on the agent (Supabase schema ready, not wired)</span></li>
        </ul>
        <div className="mt-3 flex gap-2">
          <input className="w-40 rounded-lg border border-line bg-panel2 p-2 text-sm" placeholder="Household PIN" value={pinValue} onChange={(e) => setPinValue(e.target.value)} />
          <Button onClick={() => { setPin(pinValue || null); reconnectNow(); }}>Save PIN on this device</Button>
        </div>
      </Card>
    </div>
  );
}

function DeviceRow({ d, drivers }: { d: RoomDevice; drivers: string[] }) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(JSON.stringify(d.driverConfig ?? {}));
  const [inputs, setInputs] = useState(JSON.stringify(d.inputs ?? {}));
  const [err, setErr] = useState<string | null>(null);
  const save = async (patch: Record<string, unknown>) => { try { setErr(null); await api(`/api/devices/${d.id}`, patch, "PUT"); } catch (e) { setErr((e as Error).message); } };
  const parse = (v: string) => { try { return JSON.parse(v || "{}"); } catch { setErr("not valid JSON"); return undefined; } };
  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="text-left font-medium" onClick={() => setOpen(!open)}>{d.name} <span className="text-xs text-mute">· {d.type.replace("_", " ")} · {d.driver}</span></button>
        <div className="flex items-center gap-2"><StatusTag status={d.status} /><select className="rounded-lg border border-line bg-panel2 p-1 text-xs" value={d.driver} onChange={(e) => save({ driver: e.target.value })}>{drivers.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-mute">Driver config (JSON)<input className="mt-1 w-full rounded-lg border border-line bg-panel2 p-1.5 font-mono text-xs text-fog" value={cfg} onChange={(e) => setCfg(e.target.value)} onBlur={() => { const v = parse(cfg); if (v) save({ driverConfig: v }); }} /></label>
          <label className="text-xs text-mute">Inputs (logical → device input, JSON)<input className="mt-1 w-full rounded-lg border border-line bg-panel2 p-1.5 font-mono text-xs text-fog" value={inputs} onChange={(e) => setInputs(e.target.value)} onBlur={() => { const v = parse(inputs); if (v) save({ inputs: v }); }} /></label>
          {err && <div className="text-xs text-alert sm:col-span-2">{err}</div>}
        </div>
      )}
    </li>
  );
}
