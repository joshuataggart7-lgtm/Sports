import { useEffect, useState } from "react";
import type { DisplayDevice, Game, RoomSnapshot } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { BigTeam, Logo, ScoreBug } from "./broadcast";

/** A broadcast-style field: dark gradient with both team colors bleeding in from the edges. */
function Field({ g, children }: { g?: Game; children: React.ReactNode }) {
  const a = g?.away.profile.primaryColor ?? "#1b2430", h = g?.home.profile.primaryColor ?? "#1b2430";
  return <div className="relative h-full w-full overflow-hidden" style={{ background: `radial-gradient(ellipse 60% 80% at 0% 50%, ${a}66, transparent 60%), radial-gradient(ellipse 60% 80% at 100% 50%, ${h}66, transparent 60%), linear-gradient(180deg, #0c0f15 0%, #05060a 100%)` }}>{children}</div>;
}

function GameHeader({ g }: { g: Game }) {
  return (
    <div className="bc flex items-center justify-center gap-[1.2vw] text-[1.5vw] font-semibold uppercase tracking-[0.3em] text-white/55">
      <span className="rounded-[0.3em] bg-white/10 px-[0.6em] py-[0.15em] text-white/80">{g.leagueId}</span>
      {g.venue && <span>{g.venue}</span>}{g.broadcast && <span>· {g.broadcast}</span>}
      {g.status === "live" && <span className="flex items-center gap-[0.4em] text-alert"><span className="bc-pulse inline-block h-[0.5em] w-[0.5em] rounded-full bg-alert" /> LIVE</span>}
    </div>
  );
}

function FullGame({ g, fav, tag }: { g: Game; fav?: "home" | "away"; tag?: string }) {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1920);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return (
    <Field g={g}>
      <div className="absolute inset-x-0 top-[4vh]"><GameHeader g={g} />{tag && <div className="bc mt-[1vh] text-center text-[1.2vw] uppercase tracking-[0.3em] text-white/40">{tag}</div>}</div>
      <div className="absolute inset-x-[5vw] top-1/2 grid -translate-y-1/2 grid-cols-[1fr_auto_1fr] items-center">
        <BigTeam game={g} side="away" fav={fav === "away"} align="left" />
        <div className="bc flex flex-col items-center px-[3vw] text-center">
          <div className="text-[3.2vw] font-bold uppercase tracking-[0.1em] text-white/90">{g.status === "scheduled" ? "TONIGHT" : g.periodLabel}</div>
          <div className="text-[5vw] font-black leading-none tabular-nums text-white">{g.status === "live" ? g.clock : g.status === "scheduled" ? new Date(g.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</div>
        </div>
        <BigTeam game={g} side="home" fav={fav === "home"} align="right" />
      </div>
      <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2"><ScoreBug game={g} h={Math.round(w * 0.045)} fav={fav} /></div>
      {g.situation.lastPlay && g.status === "live" && <div className="bc-body absolute bottom-[1.6vh] left-1/2 -translate-x-1/2 text-[1.3vw] text-white/50">{g.situation.lastPlay}</div>}
    </Field>
  );
}

export function MainGame({ s }: { s: RoomSnapshot }) {
  const g = primaryGame(s);
  if (!g) return <Idle text="No game selected" />;
  return <FullGame g={g} fav={favoriteSide(s, g)} />;
}

export function SecondGame({ s, display }: { s: RoomSnapshot; display: DisplayDevice }) {
  const wanted = String(display.roleOptions?.gameId ?? "");
  const primary = s.room.watchedGameIds[0];
  const g = s.games.find((x) => x.id === wanted) ?? s.games.find((x) => x.id === (s.suggestions.find((sg) => sg.gameId !== primary)?.gameId));
  if (!g) return <Idle text="No second game" />;
  return <FullGame g={g} fav={favoriteSide(s, g)} tag={wanted ? undefined : "Follow the action"} />;
}

export function Scoreboard({ s }: { s: RoomSnapshot }) {
  const games = s.games.filter((g) => g.status !== "scheduled").sort((a, b) => (b.status === "live" ? 1 : 0) - (a.status === "live" ? 1 : 0)).slice(0, 4);
  return (
    <Field>
      <div className="grid h-full grid-cols-2 content-center gap-[2vw] px-[4vw]">
        {games.map((g) => (
          <div key={g.id} className="rounded-[1vw] border border-white/10 bg-black/40 p-[1.5vw]">
            <div className="flex items-center justify-between">
              <Row g={g} side="away" />
              <div className="bc px-[1vw] text-center text-[1.4vw] font-bold uppercase text-white/60">{g.status === "live" ? <><div>{g.periodLabel}</div><div className="text-white">{g.clock}</div></> : g.status === "final" ? "FINAL" : "HALF"}</div>
              <Row g={g} side="home" right />
            </div>
            <div className="mt-[1vw]"><ScoreBug game={g} h={Math.round(window.innerWidth * 0.026)} league={false} /></div>
          </div>
        ))}
      </div>
    </Field>
  );
}

function Row({ g, side, right }: { g: Game; side: "home" | "away"; right?: boolean }) {
  const t = g[side];
  const score = side === "home" ? g.homeScore : g.awayScore;
  return (
    <div className={`bc flex items-center gap-[1vw] ${right ? "flex-row-reverse" : ""}`}>
      <Logo game={g} side={side} size={56} />
      <div className={right ? "text-right" : ""}><div className="text-[1.3vw] font-bold uppercase tracking-wider text-white/70">{t.shortName}</div><div className="text-[4vw] font-black leading-none text-white">{score}</div></div>
    </div>
  );
}

export function LeagueScores({ s }: { s: RoomSnapshot }) {
  const byLeague = new Map<string, Game[]>();
  for (const g of s.games) byLeague.set(g.leagueId, [...(byLeague.get(g.leagueId) ?? []), g]);
  return (
    <Field>
      <div className="flex h-full flex-col justify-center gap-[2.4vh] px-[5vw]">
        {[...byLeague.entries()].map(([league, games]) => (
          <div key={league}>
            <div className="bc mb-[0.8vh] flex items-center gap-[1vw] text-[1.5vw] font-bold uppercase tracking-[0.3em] text-white/60"><span className="rounded-[0.3em] bg-white/10 px-[0.6em] py-[0.1em] text-white/90">{league}</span><span className="h-px flex-1 bg-white/10" /></div>
            <div className="space-y-[0.8vh]">
              {games.map((g) => <ScoreBug key={g.id} game={g} h={Math.round(window.innerWidth * 0.038)} league={false} width="100%" fav={favoriteSide(s, g)} />)}
            </div>
          </div>
        ))}
      </div>
    </Field>
  );
}

export function RoomStatus({ s, connected }: { s: RoomSnapshot; connected: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const g = primaryGame(s);
  const next = s.games.filter((x) => x.status === "scheduled").sort((a, b) => a.startTime - b.startTime)[0];
  return (
    <Field g={g}>
      <div className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-[4vw] px-[6vw]">
        <div className="bc">
          <div className="text-[11vw] font-black leading-none tracking-tight text-white">{new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          <div className="mt-[1vh] text-[2.4vw] uppercase tracking-[0.2em] text-white/60">{new Date(now).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
          <div className="mt-[4vh] text-[1.6vw] uppercase tracking-[0.2em] text-white/40">{s.room.name} · {s.room.mode ? s.room.mode.replace("_", " ") : "idle"} · {connected ? "online" : "offline"}</div>
        </div>
        <div className="space-y-[2vh]">
          {g && <ScoreBug game={g} h={Math.round(window.innerWidth * 0.04)} fav={favoriteSide(s, g)} />}
          {next && next.id !== g?.id && <div className="bc text-[1.6vw] uppercase tracking-wider text-white/50">Next: {next.away.shortName} at {next.home.shortName} · {new Date(next.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
          <ul className="bc-body text-[1.4vw] text-white/60">
            {s.devices.filter((d) => ["tv_sony", "projector", "avr"].includes(d.id)).map((d) => <li key={d.id} className="flex justify-between border-b border-white/10 py-[0.4vh]"><span>{d.name}</span><span className={d.state.power === "on" ? "text-live" : ""}>{d.state.power === "on" ? "on" : "off"}</span></li>)}
          </ul>
        </div>
      </div>
    </Field>
  );
}

export function Ambient({ s }: { s: RoomSnapshot }) {
  const g = primaryGame(s);
  const fav = favoriteSide(s, g);
  const team = g && fav ? g[fav] : g?.home;
  const c1 = team?.profile.primaryColor ?? "#1b2430", c2 = team?.profile.secondaryColor ?? "#0b0d12";
  return (
    <div className="relative h-full w-full" style={{ background: `radial-gradient(ellipse at 30% 40%, ${c1}55 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, ${c2}66 0%, transparent 50%), #000` }}>
      {team?.logoUrl ? <img src={team.logoUrl} alt="" className="absolute left-1/2 top-1/2 h-[40vh] -translate-x-1/2 -translate-y-1/2 opacity-25" style={{ filter: "grayscale(30%)" }} /> : team && <div className="bc absolute inset-0 flex items-center justify-center text-[14vw] font-black tracking-[0.2em] text-white/10">{team.abbreviation}</div>}
    </div>
  );
}

export function MovieInfo({ s }: { s: RoomSnapshot }) {
  return <div className="flex h-full flex-col items-center justify-center text-mute"><div className="bc text-[3vw] uppercase tracking-[0.4em]">Movie</div><div className="mt-[1vh] text-[1.6vw]">{s.room.mode === "MOVIE" ? "Sports alerts are muted" : "Not in movie mode"}</div></div>;
}

export function CustomUrl({ url }: { url: string }) {
  if (!url) return <Idle text="Set a URL for this display in the app" />;
  return <iframe title="custom" src={url} className="h-full w-full border-0" />;
}

export function Placeholder({ role, s }: { role: string; s: RoomSnapshot }) {
  return <Field><div className="flex h-full flex-col items-center justify-center text-center"><div className="bc text-[3vw] font-semibold uppercase tracking-[0.3em] text-white/60">{role.replace(/_/g, " ")}</div><div className="mt-[1vh] text-[1.5vw] text-white/35">Content for this role arrives in a later milestone. {s.room.name} · {s.room.mode ?? "idle"}</div></div></Field>;
}

function Idle({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-[2.5vw] text-mute">{text}</div>; }
