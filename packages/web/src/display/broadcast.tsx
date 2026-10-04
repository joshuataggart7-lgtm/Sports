/**
 * Broadcast graphics: the pieces a telecast uses, built once and reused by every display.
 * Team blocks carry the team color and logo; the score bug is the familiar bottom bar.
 */
import { useState } from "react";
import type { Game } from "@room/core";
import { ordinal, useFlash } from "../components/Score";

const failedLogos = new Set<string>();

/** Team logo with a team-color badge fallback, so a missing image never shows a broken icon. */
export function Logo({ game, side, size = 40 }: { game: Game; side: "home" | "away"; size?: number }) {
  const t = game[side];
  const [failed, setFailed] = useState(!t.logoUrl || failedLogos.has(t.logoUrl));
  if (!failed && t.logoUrl) return <img src={t.logoUrl} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))" }} draggable={false} onError={() => { failedLogos.add(t.logoUrl!); setFailed(true); }} />;
  return <div className="bc flex items-center justify-center rounded-full font-black text-white" style={{ width: size, height: size, background: t.profile.primaryColor, fontSize: size * 0.34, boxShadow: "inset 0 0 0 2px rgba(255,255,255,.25)" }}>{t.abbreviation.slice(0, 3)}</div>;
}

/** The small triangle a broadcast puts next to the team with the ball. */
export function PossessionMark({ side, active, color = "#ffd60a" }: { side: "home" | "away"; active: boolean; color?: string }) {
  return <span style={{ opacity: active ? 1 : 0, color, fontSize: "0.55em", transform: side === "home" ? "scaleX(-1)" : undefined, display: "inline-block" }}>▶</span>;
}

/**
 * ESPN-style score bug. `h` is the bar height in px; everything scales from it so the same
 * component works at 56px on a TV corner and 140px on a wall-wide ribbon.
 */
export function ScoreBug({ game, h = 64, fav, showSituation = true, league = true, width }: { game: Game; h?: number; fav?: "home" | "away"; showSituation?: boolean; league?: boolean; width?: number | string }) {
  const s = game.situation;
  const live = game.status === "live";
  const baseball = game.sport === "baseball";
  const dd = live && s.down ? `${ordinal(s.down)} & ${s.distance}` : "";
  const sitText = game.status === "halftime" ? "HALFTIME" : game.status === "final" ? "FINAL" : game.status === "scheduled" ? new Date(game.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : baseball ? "" : [dd, s.yardLineText ? `${s.yardLineText}` : ""].filter(Boolean).join("  ·  ");
  return (
    <div className="bc bc-bar flex items-stretch overflow-hidden rounded-[0.18em] text-white" style={{ height: h, fontSize: h * 0.42, width, boxShadow: "0 10px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)" }}>
      {league && <div className="bc-shine flex items-center bg-[#0a0c10] px-[0.6em] text-[0.55em] font-bold uppercase tracking-[0.14em] text-white/80" style={{ borderRight: "1px solid rgba(255,255,255,.08)" }}>{game.leagueId}</div>}
      <TeamCell game={game} side="away" fav={fav === "away"} />
      <TeamCell game={game} side="home" fav={fav === "home"} />
      <div className="bc-shine flex items-center gap-[0.5em] bg-[#161a22] px-[0.7em]" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}>
        {live || game.status === "halftime" ? (
          <>
            {baseball ? <InningMark game={game} /> : <span className="text-[0.72em] font-bold text-white/90">{game.periodLabel}</span>}
            {live && !baseball && <span className="text-[0.82em] font-bold">{game.clock}</span>}
          </>
        ) : <span className="text-[0.72em] font-bold text-white/90">{game.status === "final" ? "FINAL" : sitText}</span>}
      </div>
      {showSituation && live && baseball && (
        <div className="bc-shine flex items-center gap-[0.6em] bg-[#10131a] px-[0.7em]" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}>
          <Bases s={s} size={0.95} />
          <span className="text-[0.62em] font-bold tabular-nums text-white/85">{s.balls ?? 0}-{s.strikes ?? 0}</span>
          <Outs n={s.outs ?? 0} />
        </div>
      )}
      {showSituation && (live || game.status === "halftime") && sitText && (
        <div className={`bc-shine flex items-center px-[0.7em] text-[0.62em] font-semibold uppercase ${s.redZone ? "text-white" : "text-white/85"}`} style={{ background: s.redZone ? "linear-gradient(180deg,#d7262c,#8f1217)" : "#10131a", borderLeft: "1px solid rgba(255,255,255,.08)" }}>
          {s.redZone && <span className="bc-pulse mr-[0.6em] text-[0.8em] font-black tracking-widest">RED ZONE</span>}
          {sitText}
        </div>
      )}
    </div>
  );
}

function TeamCell({ game, side, fav }: { game: Game; side: "home" | "away"; fav: boolean }) {
  const t = game[side];
  const score = side === "home" ? game.homeScore : game.awayScore;
  const flash = useFlash(score);
  const poss = game.situation.possession === side && game.status === "live";
  const leading = (side === "home" ? game.homeScore > game.awayScore : game.awayScore > game.homeScore) && game.status !== "scheduled";
  return (
    <div className="bc-shine relative flex items-center gap-[0.45em] pl-[0.55em] pr-[0.6em]" style={{ background: `linear-gradient(90deg, ${t.profile.primaryColor} 0%, ${t.profile.primaryColor} 0.42em, #141821 0.42em, #141821 100%)`, borderLeft: "1px solid rgba(255,255,255,.08)" }}>
      <Logo game={game} side={side} size={Math.round(0.9 * 16)} />
      <span className={`whitespace-nowrap text-[0.82em] font-extrabold uppercase ${leading || fav ? "text-white" : "text-white/70"}`} style={{ paddingLeft: "0.1em" }}>{t.abbreviation}</span>
      <PossessionMark side={side} active={poss} />
      {game.status !== "scheduled" && <span className={`min-w-[1.4em] text-right text-[1.05em] font-black tabular-nums ${flash ? "score-flash" : ""}`} style={{ ["--flash" as string]: "#fff" }}>{score}</span>}
    </div>
  );
}

/** Logo cells scale with the bar: override the fixed 16px above via font-size on wrapper. */
export function BigTeam({ game, side, fav, align }: { game: Game; side: "home" | "away"; fav?: boolean; align: "left" | "right" }) {
  const t = game[side];
  const score = side === "home" ? game.homeScore : game.awayScore;
  const flash = useFlash(score);
  const poss = game.situation.possession === side && game.status === "live";
  return (
    <div className={`bc flex items-center gap-[2.5vw] ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className="relative flex items-center justify-center rounded-[1.2vw]" style={{ width: "16vw", height: "16vw", background: `radial-gradient(circle at 50% 40%, ${t.profile.primaryColor}cc, ${t.profile.primaryColor}55 60%, transparent 75%)` }}>
        <LogoFill game={game} side={side} />
      </div>
      <div>
        <div className={`whitespace-nowrap text-[2.4vw] font-bold uppercase tracking-[0.12em] ${fav ? "text-white" : "text-white/70"}`}>{t.shortName}{t.record ? <span className="ml-[0.6em] text-[0.7em] tracking-normal text-white/50">{t.record}</span> : null}</div>
        <div className={`flex items-center gap-[1vw] ${align === "right" ? "flex-row-reverse" : ""}`}>
          <div className={`text-[11vw] font-black leading-[0.9] ${flash ? "score-flash" : ""}`} style={{ ["--flash" as string]: t.profile.primaryColor }}>{game.status === "scheduled" ? "" : score}</div>
          <PossessionMark side={side} active={poss} />
        </div>
      </div>
    </div>
  );
}

function LogoFill({ game, side }: { game: Game; side: "home" | "away" }) {
  const t = game[side];
  const [failed, setFailed] = useState(!t.logoUrl || failedLogos.has(t.logoUrl));
  if (failed) return <div className="bc text-[5vw] font-black text-white" style={{ textShadow: "0 6px 16px rgba(0,0,0,.7)" }}>{t.abbreviation}</div>;
  return <img src={t.logoUrl} alt="" className="absolute inset-[12%] h-[76%] w-[76%] object-contain" style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,.7))" }} draggable={false} onError={() => { failedLogos.add(t.logoUrl!); setFailed(true); }} />;
}

/** "▲ 5" for the top of the 5th, "▼ 5" for the bottom; mid-inning shows the half that is coming. */
export function InningMark({ game }: { game: Game }) {
  const s = game.situation;
  const n = game.period;
  const up = s.half === "top" || s.half === "end";
  return <span className="flex items-center gap-[0.25em] text-[0.72em] font-bold text-white/90"><span className="text-[0.75em]" style={{ color: "#ffd60a" }}>{up ? "▲" : "▼"}</span>{n}{s.half === "middle" || s.half === "end" ? <span className="text-[0.75em] text-white/50">{s.half === "middle" ? "MID" : "END"}</span> : null}</span>;
}

/** Three-base diamond; occupied bases light up. `size` is in em of the parent font. */
export function Bases({ s, size = 1 }: { s: Game["situation"]; size?: number }) {
  const on = (b?: boolean) => (b ? "#ffd60a" : "rgba(255,255,255,.18)");
  const d = `${size}em`;
  return (
    <span className="relative inline-block" style={{ width: d, height: d }}>
      <span className="absolute" style={{ left: "50%", top: "0", width: "40%", height: "40%", transform: "translateX(-50%) rotate(45deg)", background: on(s.onSecond), borderRadius: "12%" }} />
      <span className="absolute" style={{ left: "0", top: "40%", width: "40%", height: "40%", transform: "rotate(45deg)", background: on(s.onThird), borderRadius: "12%" }} />
      <span className="absolute" style={{ right: "0", top: "40%", width: "40%", height: "40%", transform: "rotate(45deg)", background: on(s.onFirst), borderRadius: "12%" }} />
    </span>
  );
}

export function Outs({ n }: { n: number }) {
  return <span className="flex items-center gap-[0.18em]">{[0, 1, 2].map((i) => <span key={i} className="inline-block rounded-full" style={{ width: "0.36em", height: "0.36em", background: i < n ? "#ffd60a" : "rgba(255,255,255,.18)" }} />)}<span className="ml-[0.2em] text-[0.5em] font-semibold uppercase text-white/50">out{n === 1 ? "" : "s"}</span></span>;
}
