import { isPortrait, longSide } from "./viewport";
import { useEffect, useState } from "react";
import type { DisplayDevice, Game, RoomSnapshot } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { BigTeam, Logo, ScoreBug, Bases, Outs, InningMark } from "./broadcast";

/** A broadcast-style field: dark gradient with both team colors bleeding in from the edges. */
function Field({ g, children }: { g?: Game; children: React.ReactNode }) {
  const a = g?.away.profile.primaryColor ?? "#1b2430", h = g?.home.profile.primaryColor ?? "#1b2430";
  return <div className="relative h-full w-full overflow-hidden" style={{ background: `radial-gradient(ellipse 60% 80% at 0% 50%, ${a}66, transparent 60%), radial-gradient(ellipse 60% 80% at 100% 50%, ${h}66, transparent 60%), linear-gradient(180deg, #0c0f15 0%, #05060a 100%)` }}>{children}</div>;
}

function GameHeader({ g }: { g: Game }) {
  return (
    <div className="bc flex items-center justify-center gap-[calc(1.2*var(--u))] text-[calc(1.5*var(--u))] font-semibold uppercase tracking-[0.3em] text-white/55">
      <span className="rounded-[0.3em] bg-white/10 px-[0.6em] py-[0.15em] text-white/80">{g.leagueId}</span>
      {g.venue && <span>{g.venue}</span>}{g.broadcast && <span>· {g.broadcast}</span>}
      {g.status === "live" && <span className="flex items-center gap-[0.4em] text-alert"><span className="bc-pulse inline-block h-[0.5em] w-[0.5em] rounded-full bg-alert" /> LIVE</span>}
    </div>
  );
}

function FullGame({ g, fav, tag }: { g: Game; fav?: "home" | "away"; tag?: string }) {
  const w = longSide();
  return (
    <Field g={g}>
      <div className="absolute inset-x-0 top-[calc(4*var(--v))]"><GameHeader g={g} />{tag && <div className="bc mt-[calc(1*var(--v))] text-center text-[calc(1.2*var(--u))] uppercase tracking-[0.3em] text-white/40">{tag}</div>}</div>
      <div className="absolute inset-x-[calc(5*var(--u))] top-1/2 grid -translate-y-1/2 grid-cols-[1fr_auto_1fr] items-center">
        <BigTeam game={g} side="away" fav={fav === "away"} align="left" />
        <div className="bc flex flex-col items-center px-[calc(3*var(--u))] text-center">
          {g.sport === "baseball" && g.status === "live" ? (
            <>
              <div className="text-[calc(3.2*var(--u))] font-bold uppercase tracking-[0.1em] text-white/90"><InningMark game={g} /></div>
              <div className="mt-[calc(1.5*var(--v))] text-[calc(4.5*var(--u))]"><Bases s={g.situation} size={1.6} /></div>
              <div className="mt-[calc(1.5*var(--v))] flex items-center gap-[calc(1.2*var(--u))] text-[calc(2.4*var(--u))] font-bold tabular-nums text-white/90"><span>{g.situation.balls ?? 0}-{g.situation.strikes ?? 0}</span><Outs n={g.situation.outs ?? 0} /></div>
            </>
          ) : (
            <>
              <div className="text-[calc(3.2*var(--u))] font-bold uppercase tracking-[0.1em] text-white/90">{g.status === "scheduled" ? "TONIGHT" : g.periodLabel}</div>
              <div className="text-[calc(5*var(--u))] font-black leading-none tabular-nums text-white">{g.status === "live" ? g.clock : g.status === "scheduled" ? new Date(g.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</div>
            </>
          )}
        </div>
        <BigTeam game={g} side="home" fav={fav === "home"} align="right" />
      </div>
      {g.sport === "baseball" && g.status !== "scheduled" && <LineScore g={g} />}
      <div className="absolute bottom-[calc(5*var(--v))] left-1/2 -translate-x-1/2"><ScoreBug game={g} h={Math.round(w * 0.045)} fav={fav} /></div>
      {g.situation.lastPlay && g.status === "live" && <div className="bc-body absolute bottom-[calc(1.6*var(--v))] left-1/2 -translate-x-1/2 max-w-[calc(80*var(--u))] truncate text-[calc(1.3*var(--u))] text-white/50">{g.situation.batter ? `AB: ${g.situation.batter}  ·  P: ${g.situation.pitcher ?? ""}  ·  ` : ""}{g.situation.lastPlay}</div>}
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
      <div className={`grid h-full content-center gap-[calc(2*var(--u))] px-[calc(4*var(--u))] ${isPortrait() ? "grid-cols-1" : "grid-cols-2"}`}>
        {games.map((g) => (
          <div key={g.id} className="rounded-[calc(1*var(--u))] border border-white/10 bg-black/40 p-[calc(1.5*var(--u))]">
            <div className="flex items-center justify-between">
              <Row g={g} side="away" />
              <div className="bc px-[calc(1*var(--u))] text-center text-[calc(1.4*var(--u))] font-bold uppercase text-white/60">{g.status === "live" ? <><div>{g.periodLabel}</div><div className="text-white">{g.clock}</div></> : g.status === "final" ? "FINAL" : "HALF"}</div>
              <Row g={g} side="home" right />
            </div>
            <div className="mt-[calc(1*var(--u))]"><ScoreBug game={g} h={Math.round(longSide() * 0.026)} league={false} /></div>
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
    <div className={`bc flex items-center gap-[calc(1*var(--u))] ${right ? "flex-row-reverse" : ""}`}>
      <Logo game={g} side={side} size={56} />
      <div className={right ? "text-right" : ""}><div className="text-[calc(1.3*var(--u))] font-bold uppercase tracking-wider text-white/70">{t.shortName}</div><div className="text-[calc(4*var(--u))] font-black leading-none text-white">{score}</div></div>
    </div>
  );
}

export function LeagueScores({ s }: { s: RoomSnapshot }) {
  const byLeague = new Map<string, Game[]>();
  for (const g of s.games) byLeague.set(g.leagueId, [...(byLeague.get(g.leagueId) ?? []), g]);
  return (
    <Field>
      <div className="flex h-full flex-col justify-center gap-[calc(2.4*var(--v))] px-[calc(5*var(--u))]">
        {[...byLeague.entries()].map(([league, games]) => (
          <div key={league}>
            <div className="bc mb-[calc(0.8*var(--v))] flex items-center gap-[calc(1*var(--u))] text-[calc(1.5*var(--u))] font-bold uppercase tracking-[0.3em] text-white/60"><span className="rounded-[0.3em] bg-white/10 px-[0.6em] py-[0.1em] text-white/90">{league}</span><span className="h-px flex-1 bg-white/10" /></div>
            <div className="space-y-[calc(0.8*var(--v))]">
              {games.map((g) => <ScoreBug key={g.id} game={g} h={Math.round(longSide() * 0.038)} league={false} width="100%" fav={favoriteSide(s, g)} />)}
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
      <div className={`grid h-full items-center gap-[calc(4*var(--u))] px-[calc(6*var(--u))] ${isPortrait() ? "grid-cols-1 content-center" : "grid-cols-[1.2fr_1fr]"}`}>
        <div className="bc">
          <div className="text-[calc(11*var(--u))] font-black leading-none tracking-tight text-white">{new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          <div className="mt-[calc(1*var(--v))] text-[calc(2.4*var(--u))] uppercase tracking-[0.2em] text-white/60">{new Date(now).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
          <div className="mt-[calc(4*var(--v))] text-[calc(1.6*var(--u))] uppercase tracking-[0.2em] text-white/40">{s.room.name} · {s.room.mode ? s.room.mode.replace("_", " ") : "idle"} · {connected ? "online" : "offline"}</div>
        </div>
        <div className="space-y-[calc(2*var(--v))]">
          {g && <ScoreBug game={g} h={Math.round(longSide() * 0.04)} fav={favoriteSide(s, g)} />}
          {next && next.id !== g?.id && <div className="bc text-[calc(1.6*var(--u))] uppercase tracking-wider text-white/50">Next: {next.away.shortName} at {next.home.shortName} · {new Date(next.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
          <ul className="bc-body text-[calc(1.4*var(--u))] text-white/60">
            {s.devices.filter((d) => ["tv_sony", "projector", "avr"].includes(d.id)).map((d) => <li key={d.id} className="flex justify-between border-b border-white/10 py-[calc(0.4*var(--v))]"><span>{d.name}</span><span className={d.state.power === "on" ? "text-live" : ""}>{d.state.power === "on" ? "on" : "off"}</span></li>)}
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
      {team?.logoUrl ? <img src={team.logoUrl} alt="" className="absolute left-1/2 top-1/2 h-[calc(40*var(--v))] -translate-x-1/2 -translate-y-1/2 opacity-25" style={{ filter: "grayscale(30%)" }} /> : team && <div className="bc absolute inset-0 flex items-center justify-center text-[calc(14*var(--u))] font-black tracking-[0.2em] text-white/10">{team.abbreviation}</div>}
    </div>
  );
}

/** Concert ambient: warm stage haze with slow sweeping beams, no team anything. Audio-reactive version lands with the shakers. */
export function ConcertAmbient() {
  const beams = [0, 1, 2, 3, 4].map((i) => ({ left: `${8 + i * 20}%`, delay: `${i * 1.7}s`, dur: `${9 + i * 1.3}s`, hue: i % 2 ? "#ff9f43" : "#ffd9a0" }));
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 110%, #5a2a0a 0%, #1a0d05 45%, #000 80%)" }}>
      {beams.map((b, i) => (
        <div key={i} className="absolute bottom-[-10%] h-[150%] w-[6%] origin-bottom opacity-60" style={{ left: b.left, background: `linear-gradient(180deg, transparent 0%, ${b.hue}66 40%, ${b.hue}22 100%)`, filter: "blur(10px)", animation: `beamSweep ${b.dur} ease-in-out ${b.delay} infinite alternate` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: "linear-gradient(0deg, #ff9f4333, transparent)" }} />
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.12) 3px 4px)" }} />
      <div className="bc absolute bottom-[6%] left-1/2 -translate-x-1/2 text-[calc(1.6*var(--u))] uppercase tracking-[0.5em] text-white/25">Live</div>
    </div>
  );
}

export function MovieInfo({ s }: { s: RoomSnapshot }) {
  return <div className="flex h-full flex-col items-center justify-center text-mute"><div className="bc text-[calc(3*var(--u))] uppercase tracking-[0.4em]">Movie</div><div className="mt-[calc(1*var(--v))] text-[calc(1.6*var(--u))]">{s.room.mode === "MOVIE" ? "Sports alerts are muted" : "Not in movie mode"}</div></div>;
}

export function CustomUrl({ url }: { url: string }) {
  if (!url) return <Idle text="Set a URL for this display in the app" />;
  return <iframe title="custom" src={url} className="h-full w-full border-0" />;
}

export function Placeholder({ role, s }: { role: string; s: RoomSnapshot }) {
  return <Field><div className="flex h-full flex-col items-center justify-center text-center"><div className="bc text-[calc(3*var(--u))] font-semibold uppercase tracking-[0.3em] text-white/60">{role.replace(/_/g, " ")}</div><div className="mt-[calc(1*var(--v))] text-[calc(1.5*var(--u))] text-white/35">Content for this role arrives in a later milestone. {s.room.name} · {s.room.mode ?? "idle"}</div></div></Field>;
}

function Idle({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-[calc(2.5*var(--u))] text-mute">{text}</div>; }

/** Baseball line score: innings across, R H E on the right. */
function LineScore({ g }: { g: Game }) {
  const innings = Math.max(9, g.homeLine?.length ?? 0, g.awayLine?.length ?? 0);
  const row = (side: "home" | "away") => {
    const line = side === "home" ? g.homeLine ?? [] : g.awayLine ?? [];
    const t = g[side];
    return (
      <tr className="bc text-[calc(1.3*var(--u))]">
        <td className="pr-[calc(1*var(--u))] text-left font-bold uppercase" style={{ color: t.profile.primaryColor === "#000000" ? "#fff" : undefined }}><span className="mr-[calc(0.5*var(--u))] inline-block h-[0.8em] w-[0.25em] rounded-sm align-middle" style={{ background: t.profile.primaryColor }} />{t.abbreviation}</td>
        {Array.from({ length: innings }, (_, i) => <td key={i} className="w-[calc(2.4*var(--u))] text-center tabular-nums text-white/75">{line[i] ?? ""}</td>)}
        <td className="w-[calc(2.8*var(--u))] text-center text-[1.15em] font-black tabular-nums">{side === "home" ? g.homeScore : g.awayScore}</td>
        <td className="w-[calc(2.8*var(--u))] text-center tabular-nums text-white/80">{side === "home" ? g.homeHits ?? "" : g.awayHits ?? ""}</td>
        <td className="w-[calc(2.8*var(--u))] text-center tabular-nums text-white/80">{side === "home" ? g.homeErrors ?? "" : g.awayErrors ?? ""}</td>
      </tr>
    );
  };
  return (
    <div className="absolute left-1/2 top-[calc(70*var(--v))] -translate-x-1/2 rounded-[calc(0.6*var(--u))] border border-white/10 bg-black/40 px-[calc(1.2*var(--u))] py-[calc(0.8*var(--v))]">
      <table className="border-collapse">
        <thead><tr className="bc text-[calc(0.9*var(--u))] uppercase tracking-[0.2em] text-white/40"><th></th>{Array.from({ length: innings }, (_, i) => <th key={i} className="w-[calc(2.4*var(--u))] font-semibold">{i + 1}</th>)}<th className="w-[calc(2.8*var(--u))] text-white/70">R</th><th className="w-[calc(2.8*var(--u))]">H</th><th className="w-[calc(2.8*var(--u))]">E</th></tr></thead>
        <tbody>{row("away")}{row("home")}</tbody>
      </table>
      {g.seriesText && <div className="bc mt-[calc(0.4*var(--v))] text-center text-[calc(0.9*var(--u))] uppercase tracking-[0.2em] text-white/45">{g.seriesText}</div>}
    </div>
  );
}
