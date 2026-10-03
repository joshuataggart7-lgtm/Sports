import { useState } from "react";
import type { SportsEventType } from "@room/core";
import { api } from "../app/api";
import { favoriteSide, primaryGame, useRoom } from "../app/store";
import { Button, Card, Dot } from "../components/ui";
import { ScoreBlock, Situation } from "../components/Score";
import { Connecting } from "./Home";

export function LiveGame() {
  const { snapshot: s } = useRoom();
  const [syncing, setSyncing] = useState<string | null>(null);
  if (!s) return <Connecting />;
  const game = primaryGame(s);
  const fav = favoriteSide(s, game);
  const profile = s.delayProfiles.find((p) => p.id === s.room.activeDelayProfileId);
  const delay = (profile?.delayMs ?? 0) / 1000;
  const pending = s.pendingEvents.filter((e) => e.gameId === game?.id);
  const paused = !!s.room.automationsPausedUntil && s.room.automationsPausedUntil > Date.now();
  const suppressed = s.scenes.find((x) => x.mode === s.room.mode)?.suppressSportsAutomations;

  const manual = (type: SportsEventType) => api("/api/events/manual", { type, side: fav ?? "home", gameId: game?.id });
  const sync = async () => { setSyncing("…"); try { const r = await api<{ delayMs: number; anchor?: { text: string } }>("/api/sync", {}); setSyncing(r.anchor ? `Synced: ${(r.delayMs / 1000).toFixed(1)}s (${r.anchor.text})` : "No recent play to sync against"); } catch (e) { setSyncing((e as Error).message); } setTimeout(() => setSyncing(null), 4000); };

  return (
    <div className="space-y-5 rise">
      {game ? (
        <Card>
          <ScoreBlock game={game} favoriteSide={fav} />
          <Situation game={game} className="mt-5 justify-center" />
        </Card>
      ) : <Card><div className="py-6 text-center text-mute">No game watched. Choose one in Settings.</div></Card>}

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Broadcast sync" right={profile && <span className="text-xs text-mute">{profile.name}</span>}>
          <div className="flex items-end justify-between">
            <div><div className="tnum text-4xl font-bold">+{delay.toFixed(1)}<span className="text-lg text-mute"> sec</span></div><div className="mt-1 text-xs text-mute">{pending.length ? `${pending.length} event${pending.length > 1 ? "s" : ""} waiting for the TV` : "Room reacts this long after the feed"}</div></div>
            <Button big variant="primary" onClick={sync}>SYNC TO TV</Button>
          </div>
          <p className="mt-3 text-xs text-mute">Tap the moment you see the latest play on screen. {syncing && <b className="text-fog">{syncing}</b>}</p>
          {pending.length > 0 && <ul className="mt-3 space-y-1 text-xs text-mute">{pending.map((e) => <li key={e.id} className="flex justify-between"><span>{e.text}</span><Countdown at={e.releaseAt ?? e.ts} /></li>)}</ul>}
        </Card>

        <Card title="Manual" right={<span className="text-xs text-mute">Always available, fires now</span>}>
          <div className="grid grid-cols-2 gap-2">
            <Button big onClick={() => manual("TOUCHDOWN")} style={{ borderColor: game?.[fav ?? "home"].profile.primaryColor }}>TOUCHDOWN</Button>
            <Button big onClick={() => manual("FIELD_GOAL")}>FIELD GOAL</Button>
            <Button big onClick={() => manual("DEFENSE")}>DEFENSE</Button>
            <Button big onClick={() => manual("CELEBRATION")}>CELEBRATION</Button>
            <Button className="col-span-2" variant="ghost" onClick={() => manual("RESET")}>RESET ROOM</Button>
          </div>
          {(paused || suppressed) && <p className="mt-3 text-xs text-warn">Automations are {suppressed ? `suppressed by ${s.room.mode?.replace("_", " ")} mode` : "paused"}; manual buttons still log but do nothing.</p>}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Displays">
          <ul className="divide-y divide-line text-sm">
            {s.displays.map((d) => <li key={d.id} className="flex items-center justify-between py-2"><span className="flex items-center gap-2"><Dot on={d.paired} /> {d.name}</span><span className="text-mute">{roleLabel(d.role)}</span></li>)}
          </ul>
        </Card>
        <Card title="Status">
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between"><span>Lights</span><Dot on={s.devices.some((d) => d.type === "light" && d.state.power === "on")} /></li>
            <li className="flex justify-between"><span>Audio</span><Dot on={s.devices.find((d) => d.id === "avr")?.state.power === "on"} /></li>
            <li className="flex justify-between"><span>Automations</span><span className="flex items-center gap-2 text-xs text-mute">{suppressed ? "suppressed" : paused ? "paused" : "armed"} <Dot on={!suppressed && !paused} /></span></li>
            <li className="flex justify-between"><span>Feed</span><span className="text-xs text-mute">{s.agent.provider.id} · {s.agent.provider.status}</span></li>
          </ul>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => api("/api/room", { automationsPausedUntil: paused ? null : Date.now() + 3600_000 })}>{paused ? "Resume automations" : "Pause automations 1h"}</Button>
          </div>
        </Card>
      </div>

      <Card title="Recent events">
        <ul className="divide-y divide-line text-sm">
          {s.recentEvents.slice(0, 12).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <span className={e.state === "reversed" ? "line-through text-dim" : ""}>{e.text}</span>
              <span className="shrink-0 text-xs text-mute">{e.source === "manual" ? "manual" : e.state === "pending" ? "waiting" : e.state}</span>
            </li>
          ))}
          {s.recentEvents.length === 0 && <li className="py-3 text-mute">Nothing yet.</li>}
        </ul>
      </Card>

      {s.agent.provider.id === "simulated" && (
        <Card title="Simulation" right={<span className="rounded-md border border-warn/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-warn">SIMULATED</span>}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => api("/api/sim", { action: "play", kind: "touchdown", side: fav ?? "home" })}>Feed: touchdown</Button>
            <Button onClick={() => api("/api/sim", { action: "play", kind: "field_goal", side: fav ?? "home" })}>Feed: field goal</Button>
            <Button onClick={() => api("/api/sim", { action: "play", kind: "touchdown", side: fav === "home" ? "away" : "home" })}>Feed: opponent TD</Button>
            <Button onClick={() => api("/api/sim", { action: "play", kind: "turnover", side: fav === "home" ? "away" : "home" })}>Feed: turnover</Button>
            <Button variant="danger" onClick={() => api("/api/sim", { action: "overturn" })}>Overturn last score</Button>
          </div>
          <p className="mt-2 text-xs text-mute">Feed plays arrive in the room after the broadcast delay. Overturn tests the reversal path: a queued celebration is withdrawn before it fires.</p>
        </Card>
      )}
    </div>
  );
}

function Countdown({ at }: { at: number }) {
  const left = Math.max(0, at - Date.now());
  return <span className="tnum">{(left / 1000).toFixed(0)}s</span>;
}

export function roleLabel(r: string): string { return r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }
