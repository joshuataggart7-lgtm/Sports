import { useEffect, useRef, useState } from "react";
import { DEFAULT_EXPERIENCE, FX_CATEGORIES, FX_CATEGORY_LABELS, INTENSITY_MODES, INTENSITY_MODE_LABELS, type CommandTiming, type ExperienceSettings, type FxCategory, type IntensityMode, type MetricsSummary, type RoomSnapshot, type Scene, type SportsEventType } from "@room/core";
import { api } from "../app/api";
import { favoriteSide, primaryGame } from "../app/store";
import { Button, Card } from "../components/ui";

/**
 * The Experience panel on the Live page: one master switch, an intensity mode, the big
 * buttons, and the per-category dials behind "Advanced". Everything it fires is a scene the
 * agent already knows, so the same buttons work with or without a game on.
 */
export function EffectsPanel({ s }: { s: RoomSnapshot }) {
  const e = s.room.experience ?? DEFAULT_EXPERIENCE;
  const game = primaryGame(s);
  const fav = favoriteSide(s, game);
  const team = game ? game[fav ?? "home"] : undefined;
  const buttons = s.scenes.filter((x) => x.button?.group === "celebrate");
  const [advanced, setAdvanced] = useState(false);
  const [firing, setFiring] = useState<string | null>(null);
  const put = (patch: Partial<ExperienceSettings> | { categories: Partial<Record<FxCategory, Partial<ExperienceSettings["categories"][FxCategory]>>> }) => api("/api/experience", patch, "PUT");
  const fire = async (sc: Scene) => { setFiring(sc.id); try { await api(`/api/scenes/${sc.id}`, {}); } finally { setTimeout(() => setFiring(null), 600); } };
  const off = !e.master;

  return (
    <Card title="Experience" right={<MasterSwitch on={e.master} onChange={(master) => put({ master })} />}>
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex rounded-xl border border-line bg-panel2 p-0.5 ${off ? "opacity-40" : ""}`}>
          {INTENSITY_MODES.map((m) => (
            <button key={m} type="button" disabled={off} onClick={() => put({ mode: m })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition ${e.mode === m ? (m === "INSANE" ? "bg-alert text-white" : m === "QUIET" ? "bg-sky/80 text-ink" : "bg-fog text-ink") : "text-mute hover:text-fog"}`}>{INTENSITY_MODE_LABELS[m].toUpperCase()}</button>
          ))}
        </div>
        <span className="text-xs text-mute">{off ? "Effects are off. Modes and screens still work." : modeHint(e.mode)}</span>
      </div>

      <div className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 ${off ? "opacity-40" : ""}`}>
        {buttons.map((sc) => {
          const label = sc.button!.label;
          const hot = label === "CELEBRATE" || label === "BOOM";
          const quiet = label === "BLACKOUT" || label === "RESET ROOM";
          return (
            <Button key={sc.id} big disabled={off} variant={quiet ? "ghost" : "default"} onClick={() => fire(sc)}
              className={`${quiet ? "border border-dashed border-line" : ""} ${firing === sc.id ? "ring-2 ring-fog" : ""}`}
              style={hot && team ? { borderColor: team.profile.primaryColor, boxShadow: `inset 0 -3px 0 ${team.profile.primaryColor}` } : undefined}>
              {label}
            </Button>
          );
        })}
      </div>

      <button type="button" onClick={() => setAdvanced((v) => !v)} className="mt-4 text-xs font-semibold uppercase tracking-wider text-mute hover:text-fog">{advanced ? "▾ Advanced" : "▸ Advanced"}</button>
      {advanced && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FX_CATEGORIES.map((c) => <CategoryDial key={c} category={c} settings={e.categories[c] ?? DEFAULT_EXPERIENCE.categories[c]} mode={e.mode} disabled={off} onChange={(v) => put({ categories: { [c]: v } })} />)}
        </div>
      )}
    </Card>
  );
}

function modeHint(m: IntensityMode): string {
  return { NORMAL: "Tasteful. Big moments get the full room, small ones a glow.", BIG_GAME: "Stronger lights, louder horn, harder couch hits.", INSANE: "Everything at the top of its range. Neighbors optional.", QUIET: "Late night: screens and lights work, horn and couch stay low." }[m];
}

function MasterSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 text-xs font-semibold tracking-wider text-mute">
      <span>{on ? "EFFECTS ON" : "EFFECTS OFF"}</span>
      <span className={`relative inline-block h-6 w-11 rounded-full transition ${on ? "bg-live" : "bg-line"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-[22px]" : "left-0.5"}`} /></span>
    </button>
  );
}

function CategoryDial({ category, settings, mode, disabled, onChange }: { category: FxCategory; settings: { enabled: boolean; intensity: number }; mode: IntensityMode; disabled: boolean; onChange: (v: { enabled?: boolean; intensity?: number }) => void }) {
  const [val, setVal] = useState(settings.intensity);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setVal(settings.intensity), [settings.intensity]);
  const slide = (n: number) => { setVal(n); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => onChange({ intensity: n }), 250); };
  const dim = disabled || !settings.enabled;
  return (
    <div className={`rounded-xl border border-line bg-panel2 p-3 ${dim ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={disabled} checked={settings.enabled} onChange={(ev) => onChange({ enabled: ev.target.checked })} />{FX_CATEGORY_LABELS[category]}</label>
        <span className="tnum text-xs text-mute">{val}%{mode !== "NORMAL" && <span className="ml-1 text-[10px]">· {INTENSITY_MODE_LABELS[mode]}</span>}</span>
      </div>
      <input type="range" min={0} max={100} value={val} disabled={dim} onChange={(ev) => slide(Number(ev.target.value))} className="mt-2 w-full accent-white" />
    </div>
  );
}

/**
 * Simulator: fire the real pipeline (event → automation → scene → devices) without a game, and
 * see every command with its offset from the scene start and how long the device took.
 */
export function SimulatorPanel({ s }: { s: RoomSnapshot }) {
  const game = primaryGame(s);
  const fav = favoriteSide(s, game) ?? "home";
  const opp = fav === "home" ? "away" : "home";
  const moments = s.scenes.filter((x) => x.fx && x.forEvents?.length && !x.button);
  const [debug, setDebug] = useState(false);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  useEffect(() => {
    if (!debug) return;
    let alive = true;
    const tick = () => api<MetricsSummary>("/api/metrics?limit=60").then((m) => { if (alive) setMetrics(m); }).catch(() => undefined);
    tick(); const t = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(t); };
  }, [debug]);
  const event = (type: SportsEventType, side: "home" | "away" = fav) => api("/api/events/manual", { type, side, gameId: game?.id });
  const scene = (id: string) => api(`/api/scenes/${id}`, {});
  const paused = !!s.room.automationsPausedUntil && s.room.automationsPausedUntil > Date.now();
  const suppressed = s.scenes.find((x) => x.mode === s.room.mode)?.suppressSportsAutomations;

  return (
    <Card title="Simulator" right={<span className="text-xs text-mute">{game ? `${game.away.abbreviation} @ ${game.home.abbreviation}` : "no game watched: scenes use your favorite team"}</span>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Button big onClick={() => event("TOUCHDOWN")}>Touchdown</Button>
        <Button big onClick={() => event("TURNOVER")}>Turnover</Button>
        <Button big onClick={() => event("BIG_PLAY")}>Big Play</Button>
        <Button big onClick={() => event("TOUCHDOWN", opp)}>Opp. Score</Button>
        <Button big onClick={() => event("HALFTIME")}>Halftime</Button>
        <Button big onClick={() => (game ? event("WIN") : scene("fx_game_win"))}>Win</Button>
      </div>
      {(paused || suppressed) && <p className="mt-2 text-xs text-warn">Automations are {suppressed ? `suppressed by ${s.room.mode?.replace("_", " ")} mode` : "paused"}: these buttons log the event but nothing fires. The Moments below run their scene directly.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {moments.map((m) => <button key={m.id} type="button" onClick={() => scene(m.id)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-mute hover:border-mute/60 hover:text-fog">{m.name}</button>)}
      </div>
      <button type="button" onClick={() => setDebug((v) => !v)} className="mt-4 text-xs font-semibold uppercase tracking-wider text-mute hover:text-fog">{debug ? "▾ Debug: what fired, and how fast" : "▸ Debug: what fired, and how fast"}</button>
      {debug && metrics && <DebugTable m={metrics} devices={s.devices} />}
    </Card>
  );
}

function DebugTable({ m, devices }: { m: MetricsSummary; devices: RoomSnapshot["devices"] }) {
  const drivers = Object.entries(m.byDriver).sort((a, b) => b[1].count - a[1].count);
  const byRun = new Map<string, CommandTiming[]>();
  for (const t of m.recent) { const k = t.runId ?? "manual"; (byRun.get(k) ?? byRun.set(k, []).get(k)!).push(t); }
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {drivers.map(([d, v]) => <span key={d} className={`rounded-md border px-2 py-0.5 ${v.failures ? "border-warn/40 text-warn" : "border-line text-mute"}`}>{d} · avg {v.avgMs} ms · p95 {v.p95Ms} ms{v.failures ? ` · ${v.failures} failed` : ""}</span>)}
        {drivers.length === 0 && <span className="text-mute">Nothing has fired yet. Press a button above.</span>}
      </div>
      {[...byRun.entries()].slice(0, 6).map(([run, rows]) => (
        <div key={run} className="rounded-xl border border-line bg-panel2 p-2">
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-mute">{run === "manual" ? "Direct commands" : run.startsWith("scene") ? "Scene run" : "Automation run"} · {rows.length} command{rows.length === 1 ? "" : "s"}</div>
          <table className="w-full text-xs">
            <tbody>
              {[...rows].sort((a, b) => (a.offsetMs ?? 0) - (b.offsetMs ?? 0)).map((t) => {
                const dev = devices.find((d) => d.id === t.deviceId);
                return (
                  <tr key={t.id} className="border-t border-line/60">
                    <td className="tnum w-16 py-1 pr-2 text-mute">{t.offsetMs !== undefined ? `+${(t.offsetMs / 1000).toFixed(2)}s` : ""}</td>
                    <td className="py-1 pr-2">{t.deviceName}{dev?.status === "SIMULATED" ? <span className="ml-1 text-[9px] text-warn">SIM</span> : null}</td>
                    <td className="py-1 pr-2 text-mute">{t.command}</td>
                    <td className="tnum w-16 py-1 pr-2 text-right text-mute">{t.durationMs} ms</td>
                    <td title={t.reason} className={`w-28 max-w-[7rem] truncate py-1 text-right ${t.ok ? "text-live" : t.reason?.endsWith(" off") ? "text-mute" : "text-warn"}`}>{t.ok ? "ok" : t.reason ?? "failed"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
