/**
 * /display/:id — what a TV, monitor or projector shows. The id is a display id or a
 * pairing code; "projector" resolves to the projected-ribbon display. The page pairs
 * itself with the room, then renders whatever role the room assigns it. Changing the
 * role from the app changes this screen live.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import type { DisplayDevice, DisplayOverlay } from "@room/core";
import { api } from "../app/api";
import { connect, useRoom } from "../app/store";
import { MainGame, SecondGame, Scoreboard, LeagueScores, RoomStatus, Ambient, MovieInfo, Placeholder, CustomUrl } from "./roles";
import { ProjectedTicker } from "./ProjectedTicker";
import { GameStatsBoard } from "./GameStats";

export function DisplayPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { snapshot: s, overlays, connected } = useRoom();
  const [paired, setPaired] = useState<DisplayDevice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve the display: by id, by pairing code, or "projector".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (id.toLowerCase() === "projector") {
          const snap = await api<{ displays: DisplayDevice[] }>("/api/snapshot");
          const d = snap.displays.find((x) => x.role === "PROJECTED_TICKER") ?? snap.displays.find((x) => x.kind === "projector");
          if (!d) throw new Error("No projector display in this room");
          if (!cancelled) setPaired(d);
        } else if (/^[A-Z]{4}$/i.test(id)) {
          const d = await api<DisplayDevice>("/api/displays/pair", { code: id });
          if (!cancelled) setPaired(d);
        } else {
          const snap = await api<{ displays: DisplayDevice[] }>("/api/snapshot");
          const d = snap.displays.find((x) => x.id === id);
          if (!d) throw new Error(`Unknown display ${id}`);
          if (!cancelled) setPaired(d);
        }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => { if (paired) connect({ role: "display", displayId: paired.id }); }, [paired?.id]);

  const display = useMemo(() => s?.displays.find((d) => d.id === paired?.id) ?? paired, [s, paired]);
  const overlay: DisplayOverlay | undefined = display ? (overlays[display.id] ?? overlays.all) : undefined;
  const role = params.get("mode") === "ticker" ? "PROJECTED_TICKER" : display?.role;

  if (error) return <Center><div className="text-2xl text-mute">{error}</div><div className="mt-2 text-sm text-dim">Open /display/&lt;pairing code&gt; from the Displays page.</div></Center>;
  if (!display || !s) return <Center><div className="text-xl text-mute">{connected ? "Pairing…" : "Connecting to the room…"}</div></Center>;
  if (!display.paired && role !== "PROJECTED_TICKER") return <Center><div className="text-[10vw] font-bold tracking-widest tnum">{display.pairingCode}</div><div className="mt-4 text-xl text-mute">Enter this code in the app to pair <b className="text-fog">{display.name}</b></div></Center>;

  const body = (() => {
    switch (role) {
      case "MAIN_GAME": return <MainGame s={s} />;
      case "SECOND_GAME": return <SecondGame s={s} display={display} />;
      case "SCOREBOARD": return <Scoreboard s={s} />;
      case "PLAYER_STATS": return <GameStatsBoard s={s} gameId={display.roleOptions?.gameId ? String(display.roleOptions.gameId) : undefined} />;
      case "LEAGUE_SCORES": return <LeagueScores s={s} />;
      case "ROOM_STATUS": return <RoomStatus s={s} connected={connected} />;
      case "PROJECTED_TICKER": return <ProjectedTicker s={s} display={display} overlay={overlay} />;
      case "AMBIENT": return <Ambient s={s} />;
      case "MOVIE_INFO": return <MovieInfo s={s} />;
      case "CUSTOM": return <CustomUrl url={String(display.roleOptions?.url ?? "")} />;
      case "OFF": return <div className="h-screen w-screen bg-black" />;
      default: return <Placeholder role={role ?? "CUSTOM"} s={s} />;
    }
  })();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-fog">
      {body}
      {role !== "PROJECTED_TICKER" && overlay && overlay.until > Date.now() && <OverlayLayer o={overlay} />}
      {role !== "PROJECTED_TICKER" && <div className="absolute bottom-1.5 right-3 text-[10px] uppercase tracking-widest text-white/20">{display.name} · {role?.replace(/_/g, " ")}{!connected ? " · reconnecting" : ""}</div>}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) { return <div className="flex h-screen w-screen flex-col items-center justify-center bg-black p-8 text-center text-fog">{children}</div>; }

export function OverlayLayer({ o }: { o: DisplayOverlay }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  if (o.until <= Date.now()) return null;
  const color = o.color ?? "#ffffff";
  const color2 = o.color2 ?? "#ffffff";
  const secs = Math.max(1, (o.until - Date.now()) / 1000);
  if (o.kind === "celebration") return (
    <div className="bc absolute inset-0 overflow-hidden" style={{ animation: `celebrate ${secs}s ease-out forwards` }}>
      {/* Field: team color with animated secondary-color stripes, the way a stadium board bursts on a score. */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 45%, ${color} 0%, ${color} 35%, #05060a 100%)` }} />
      <div className="absolute inset-[-50%]" style={{ background: `repeating-linear-gradient(115deg, transparent 0 7vw, ${color2}26 7vw 9vw)`, animation: "stripes 2.2s linear infinite" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,.55) 100%)" }} />
      <div className="absolute inset-y-0 left-0 w-[1.2vw]" style={{ background: color2 }} />
      <div className="absolute inset-y-0 right-0 w-[1.2vw]" style={{ background: color2 }} />
      <div className="relative flex h-full flex-col items-center justify-center">
        {o.logoUrl && <img src={o.logoUrl} alt="" className="bc-pop h-[30vh] w-auto" style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,.6))" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
        <div className="bc-pop text-[12vw] font-black uppercase leading-none tracking-[0.04em] text-white" style={{ textShadow: "0 10px 40px rgba(0,0,0,.6)", animationDelay: ".08s" }}>{o.text}</div>
        {o.subtext && <div className="bc-pop mt-[1.5vh] rounded-[0.4em] bg-black/45 px-[1em] py-[0.2em] text-[3.2vw] font-bold uppercase tracking-[0.12em] text-white/95" style={{ animationDelay: ".18s" }}>{o.subtext}</div>}
      </div>
    </div>
  );
  if (o.kind === "alert") return <div className="bc bc-slide absolute inset-x-0 top-0 flex items-center justify-center gap-6 py-[1.2vh]" style={{ background: `linear-gradient(180deg, ${color}, ${color}bb)` }}><span className="bc-pulse text-[3vw] font-black uppercase tracking-[0.2em] text-white">{o.text}</span>{o.subtext && <span className="text-[2vw] font-bold text-white/85">{o.subtext}</span>}</div>;
  return (
    <div className="bc bc-slide absolute inset-x-[6vw] bottom-[5vh] flex items-center gap-[1.2vw] overflow-hidden rounded-[0.5vw] bc-bar px-[1.5vw] py-[1vh]" style={{ borderLeft: `0.9vw solid ${color}` }}>
      {o.logoUrl && <img src={o.logoUrl} alt="" className="h-[5vw] w-[5vw] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
      <span className="text-[3.2vw] font-black uppercase tracking-[0.06em] text-white">{o.text}</span>{o.subtext && <span className="text-[2vw] font-bold text-white/70">{o.subtext}</span>}
    </div>
  );
}
