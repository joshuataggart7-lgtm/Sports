import { useEffect, useRef, useState } from "react";
import type { Game } from "@room/core";

/** Big score block: two teams, clock, situation. The signature typography of the app. */
export function ScoreBlock({ game, size = "lg", favoriteSide }: { game: Game; size?: "md" | "lg" | "xl"; favoriteSide?: "home" | "away" }) {
  const scoreCls = { md: "text-5xl", lg: "text-7xl sm:text-8xl", xl: "text-[9rem] leading-none" }[size];
  const nameCls = { md: "text-sm", lg: "text-base sm:text-lg", xl: "text-3xl" }[size];
  const live = game.status === "live" || game.status === "halftime";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
      <Side game={game} side="away" scoreCls={scoreCls} nameCls={nameCls} fav={favoriteSide === "away"} />
      <div className="flex flex-col items-center gap-1 text-center">
        <div className={`font-bold tracking-wide ${size === "xl" ? "text-4xl" : "text-xl"}`}>{game.status === "scheduled" ? "" : game.periodLabel}</div>
        <div className={`tnum font-semibold text-mute ${size === "xl" ? "text-5xl" : "text-2xl"}`}>{game.status === "scheduled" ? new Date(game.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : game.status === "final" ? "" : game.clock}</div>
        {live && <span className="mt-1 rounded-md bg-alert/20 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-alert">LIVE</span>}
      </div>
      <Side game={game} side="home" scoreCls={scoreCls} nameCls={nameCls} fav={favoriteSide === "home"} />
    </div>
  );
}

function Side({ game, side, scoreCls, nameCls, fav }: { game: Game; side: "home" | "away"; scoreCls: string; nameCls: string; fav: boolean }) {
  const team = game[side];
  const score = side === "home" ? game.homeScore : game.awayScore;
  const poss = game.situation.possession === side;
  const flash = useFlash(score);
  return (
    <div className={`flex flex-col ${side === "home" ? "items-end text-right" : "items-start text-left"}`}>
      <div className={`flex items-center gap-2 font-semibold uppercase tracking-wider ${nameCls} ${fav ? "text-fog" : "text-mute"}`}>
        {side === "home" && poss && <Possession color={team.profile.primaryColor} />}
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: team.profile.primaryColor }} />
        {team.shortName}
        {side === "away" && poss && <Possession color={team.profile.primaryColor} />}
      </div>
      <div className={`tnum font-bold leading-none ${scoreCls} ${flash ? "score-flash" : ""}`} style={{ ["--flash" as string]: team.profile.primaryColor }}>{score}</div>
    </div>
  );
}

function Possession({ color }: { color: string }) { return <span className="text-xs" style={{ color }}>●</span>; }

export function useFlash(value: number): boolean {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) { prev.current = value; setFlash(true); const t = setTimeout(() => setFlash(false), 1300); return () => clearTimeout(t); }
  }, [value]);
  return flash;
}

export function Situation({ game, className = "" }: { game: Game; className?: string }) {
  const s = game.situation;
  if (game.sport !== "football" || game.status !== "live") return null;
  const dd = s.down ? `${ordinal(s.down)} & ${s.distance}` : "";
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute ${className}`}>
      {s.yardLineText && <span>BALL: <b className="text-fog">{s.yardLineText}</b></span>}
      {dd && <span className="text-fog font-semibold">{dd}</span>}
      {s.redZone && <span className="rounded-md bg-alert/20 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-alert">RED ZONE</span>}
      {s.lastPlay && <span className="w-full truncate text-xs text-dim">{s.lastPlay}</span>}
    </div>
  );
}

export function ordinal(n: number): string { const s = ["th", "st", "nd", "rd"]; const v = n % 100; return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`; }
