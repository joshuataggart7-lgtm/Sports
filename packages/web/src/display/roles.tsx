import { useEffect, useState } from "react";
import type { DisplayDevice, Game, RoomSnapshot } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { ScoreBlock, Situation } from "../components/Score";

export function MainGame({ s }: { s: RoomSnapshot }) {
  const g = primaryGame(s);
  if (!g) return <Idle text="No game selected" />;
  return (
    <div className="flex h-full flex-col justify-center px-[6vw]">
      <div className="mb-[2vh] text-center text-[1.6vw] uppercase tracking-[0.3em] text-mute">{g.leagueId} · {g.venue ?? ""}{g.broadcast ? ` · ${g.broadcast}` : ""}</div>
      <ScoreBlock game={g} size="xl" favoriteSide={favoriteSide(s, g)} />
      <Situation game={g} className="mt-[3vh] justify-center text-[1.6vw]" />
    </div>
  );
}

export function SecondGame({ s, display }: { s: RoomSnapshot; display: DisplayDevice }) {
  const wanted = String(display.roleOptions?.gameId ?? "");
  const primary = s.room.watchedGameIds[0];
  const g = s.games.find((x) => x.id === wanted) ?? s.games.find((x) => x.id === (s.suggestions.find((sg) => sg.gameId !== primary)?.gameId));
  if (!g) return <Idle text="No second game" />;
  return (
    <div className="flex h-full flex-col justify-center px-[6vw]">
      <div className="mb-[2vh] text-center text-[1.4vw] uppercase tracking-[0.3em] text-mute">{g.leagueId}{wanted ? "" : " · follow the action"}</div>
      <ScoreBlock game={g} size="xl" favoriteSide={favoriteSide(s, g)} />
      <Situation game={g} className="mt-[3vh] justify-center text-[1.6vw]" />
    </div>
  );
}

export function Scoreboard({ s }: { s: RoomSnapshot }) {
  const live = s.games.filter((g) => g.status !== "scheduled").sort((a, b) => (b.status === "live" ? 1 : 0) - (a.status === "live" ? 1 : 0));
  return (
    <div className="grid h-full grid-cols-1 content-center gap-[2vh] px-[5vw] md:grid-cols-2">
      {live.slice(0, 4).map((g) => <div key={g.id} className="rounded-2xl border border-line bg-panel/60 p-[2vw]"><ScoreBlock game={g} size="lg" favoriteSide={favoriteSide(s, g)} /></div>)}
    </div>
  );
}

export function LeagueScores({ s }: { s: RoomSnapshot }) {
  const byLeague = new Map<string, Game[]>();
  for (const g of s.games) byLeague.set(g.leagueId, [...(byLeague.get(g.leagueId) ?? []), g]);
  return (
    <div className="flex h-full flex-col justify-center gap-[3vh] px-[5vw]">
      {[...byLeague.entries()].map(([league, games]) => (
        <div key={league}>
          <div className="mb-[1vh] text-[1.4vw] font-semibold uppercase tracking-[0.3em] text-mute">{league}</div>
          <div className="divide-y divide-line">
            {games.map((g) => (
              <div key={g.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-[2vw] py-[1vh] text-[2.4vw]">
                <span className={`font-semibold ${g.awayScore > g.homeScore ? "text-fog" : "text-mute"}`}><Mark c={g.away.profile.primaryColor} />{g.away.abbreviation}</span>
                <span className="tnum font-bold">{g.status === "scheduled" ? "" : g.awayScore}</span>
                <span className={`font-semibold ${g.homeScore > g.awayScore ? "text-fog" : "text-mute"}`}><Mark c={g.home.profile.primaryColor} />{g.home.abbreviation}</span>
                <span className="tnum text-right text-[1.6vw] text-mute">{g.status === "scheduled" ? new Date(g.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : g.status === "final" ? "FINAL" : <><span className="text-alert">●</span> {g.periodLabel} {g.clock}</>}{g.status === "scheduled" ? "" : <span className="tnum ml-3">{g.awayScore}–{g.homeScore}</span>}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Mark({ c }: { c: string }) { return <span className="mr-[0.8vw] inline-block h-[1.2vw] w-[1.2vw] rounded-full align-middle" style={{ background: c }} />; }

export function RoomStatus({ s, connected }: { s: RoomSnapshot; connected: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const g = primaryGame(s);
  const next = s.games.filter((x) => x.status === "scheduled").sort((a, b) => a.startTime - b.startTime)[0];
  return (
    <div className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-[4vw] px-[6vw]">
      <div>
        <div className="tnum text-[11vw] font-bold leading-none tracking-tight">{new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
        <div className="mt-[1vh] text-[2.4vw] text-mute">{new Date(now).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
        <div className="mt-[4vh] text-[1.8vw] text-mute">{s.room.name} · {s.room.mode ? s.room.mode.replace("_", " ") : "idle"} · {connected ? "online" : "offline"}</div>
      </div>
      <div className="space-y-[2vh] text-[1.9vw]">
        {g && <div className="rounded-2xl border border-line bg-panel/60 p-[1.5vw]"><div className="text-[1.2vw] uppercase tracking-[0.3em] text-mute">{g.status === "live" ? "Live now" : g.status === "final" ? "Final" : "Tonight"}</div><div className="mt-1 font-semibold">{g.away.abbreviation} {g.status !== "scheduled" ? g.awayScore : ""} @ {g.home.abbreviation} {g.status !== "scheduled" ? g.homeScore : ""}</div><div className="text-mute">{g.status === "scheduled" ? new Date(g.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : `${g.periodLabel} ${g.clock}`}</div></div>}
        {next && next.id !== g?.id && <div className="text-mute">Next: {next.away.abbreviation} @ {next.home.abbreviation} · {new Date(next.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
        <ul className="text-[1.5vw] text-mute">
          {s.devices.filter((d) => ["tv_sony", "projector", "avr"].includes(d.id)).map((d) => <li key={d.id} className="flex justify-between"><span>{d.name}</span><span className={d.state.power === "on" ? "text-live" : ""}>{d.state.power === "on" ? "on" : "off"}</span></li>)}
        </ul>
      </div>
    </div>
  );
}

export function Ambient({ s }: { s: RoomSnapshot }) {
  const g = primaryGame(s);
  const fav = favoriteSide(s, g);
  const team = g && fav ? g[fav] : g?.home;
  const c1 = team?.profile.primaryColor ?? "#1b2430", c2 = team?.profile.secondaryColor ?? "#0b0d12";
  return (
    <div className="relative h-full w-full" style={{ background: `radial-gradient(ellipse at 30% 40%, ${c1}55 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, ${c2}66 0%, transparent 50%), #000` }}>
      {team && <div className="absolute inset-0 flex items-center justify-center text-[14vw] font-black tracking-[0.2em] text-white/10">{team.abbreviation}</div>}
    </div>
  );
}

export function MovieInfo({ s }: { s: RoomSnapshot }) {
  return <div className="flex h-full flex-col items-center justify-center text-mute"><div className="text-[3vw] uppercase tracking-[0.4em]">Movie</div><div className="mt-[1vh] text-[1.6vw]">{s.room.mode === "MOVIE" ? "Sports alerts are muted" : "Not in movie mode"}</div></div>;
}

export function CustomUrl({ url }: { url: string }) {
  if (!url) return <Idle text="Set a URL for this display in the app" />;
  return <iframe title="custom" src={url} className="h-full w-full border-0" />;
}

export function Placeholder({ role, s }: { role: string; s: RoomSnapshot }) {
  return <div className="flex h-full flex-col items-center justify-center text-center"><div className="text-[3vw] font-semibold uppercase tracking-[0.3em] text-mute">{role.replace(/_/g, " ")}</div><div className="mt-[1vh] text-[1.5vw] text-dim">Content for this role arrives in a later milestone. {s.room.name} · {s.room.mode ?? "idle"}</div></div>;
}

function Idle({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-[2.5vw] text-mute">{text}</div>; }
