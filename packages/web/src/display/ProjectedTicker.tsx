/**
 * The projected ribbon. The projector throws a full 16:9 image; we paint it true black
 * and light only a narrow viewport (x, y, width, height from the display's ticker
 * config). Sparse by design: the watched game, then one line of other scores.
 */
import { useEffect, useRef, useState } from "react";
import { DEFAULT_TICKER, type DisplayDevice, type DisplayOverlay, type Game, type RoomSnapshot, type TickerConfig } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { ordinal, useFlash } from "../components/Score";

export function ProjectedTicker({ s, display, overlay }: { s: RoomSnapshot; display: DisplayDevice; overlay?: DisplayOverlay }) {
  const cfg: TickerConfig = { ...DEFAULT_TICKER, ...((display.roleOptions?.ticker as Partial<TickerConfig>) ?? {}) };
  const g = primaryGame(s);
  const others = s.games.filter((x) => x.id !== g?.id && x.status !== "scheduled" && (cfg.leagues.length === 0 || cfg.leagues.includes(x.leagueId)));
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  const active = overlay && overlay.until > Date.now() && overlay.kind !== "clear" ? overlay : undefined;
  // Scale the configured pixel viewport to the actual screen so a 1920-wide config fits any projector resolution.
  const scale = typeof window !== "undefined" ? window.innerWidth / cfg.canvasWidth : 1;
  const box = { left: cfg.x * scale, top: cfg.y * scale, width: cfg.width * scale, height: cfg.height * scale };
  const font = cfg.fontPx * scale;

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <div className="absolute overflow-hidden" style={{ ...box, fontSize: font, lineHeight: 1 }}>
        {active ? <Takeover o={active} h={box.height} /> : g ? <Ribbon g={g} others={others} cfg={cfg} fav={favoriteSide(s, g)} h={box.height} /> : <div className="flex h-full items-center px-[1em] text-[0.6em] text-mute">ROOM OS</div>}
      </div>
    </div>
  );
}

function Ribbon({ g, others, cfg, fav, h }: { g: Game; others: Game[]; cfg: TickerConfig; fav?: "home" | "away"; h: number }) {
  const s = g.situation;
  const dd = cfg.showDownDistance && s.down ? `${ordinal(s.down)} & ${s.distance}` : "";
  const red = cfg.redZoneAlert && s.redZone;
  const main = (
    <div className="flex h-full items-center gap-[0.8em] whitespace-nowrap px-[0.6em] font-bold tracking-wide">
      <Team g={g} side="away" fav={fav === "away"} cfg={cfg} />
      <Score g={g} side="away" cfg={cfg} />
      <span className="text-[0.55em] text-mute">|</span>
      <Team g={g} side="home" fav={fav === "home"} cfg={cfg} />
      <Score g={g} side="home" cfg={cfg} />
      {g.status === "live" && <><Sep /><span className="text-[0.75em] text-fog/85">{g.periodLabel}</span>{cfg.showClock && <span className="tnum text-[0.75em] text-fog/85">{g.clock}</span>}</>}
      {g.status === "final" && <><Sep /><span className="text-[0.7em] text-mute">FINAL</span></>}
      {g.status === "halftime" && <><Sep /><span className="text-[0.7em] text-mute">HALF</span></>}
      {s.yardLineText && g.status === "live" && <><Sep /><span className="text-[0.6em] text-mute">BALL</span><span className="text-[0.7em] text-fog/85">{s.yardLineText}</span></>}
      {dd && g.status === "live" && <span className="text-[0.7em] text-fog/85">{dd}</span>}
      {red && <span className="rounded-[0.2em] bg-alert px-[0.35em] py-[0.1em] text-[0.5em] font-black tracking-widest text-white">RED ZONE</span>}
    </div>
  );
  const second = others.length > 0 && (
    <div className="flex h-full items-center gap-[1.2em] whitespace-nowrap px-[0.6em] text-[0.62em] font-semibold text-fog/75">
      {others.map((o) => <span key={o.id} className="flex items-center gap-[0.5em]"><span className="text-[0.75em] uppercase tracking-widest text-mute">{o.leagueId}:</span><span>{o.away.abbreviation} <span className="tnum">{o.awayScore}</span></span><span>{o.home.abbreviation} <span className="tnum">{o.homeScore}</span></span>{o.status === "live" && <span className="text-[0.8em] text-mute">{o.periodLabel}</span>}</span>)}
    </div>
  );
  const twoRows = h >= 2.2 * cfg.fontPx * (typeof window !== "undefined" ? window.innerWidth / cfg.canvasWidth : 1);
  if (cfg.mode === "scroll") {
    return <div className="flex h-full items-center"><div className="flex whitespace-nowrap" style={{ animation: `ticker ${Math.max(10, 40000 / cfg.scrollPxPerSec)}s linear infinite` }}>{main}{second}</div></div>;
  }
  if (twoRows) return <div className="grid h-full grid-rows-[1.5fr_1fr]"><div className="min-h-0">{main}</div><div className="min-h-0 border-t border-line/60">{second}</div></div>;
  return <Cycle a={main} b={second || null} />;
}

function Cycle({ a, b }: { a: React.ReactNode; b: React.ReactNode }) {
  const [showB, setShowB] = useState(false);
  useEffect(() => { if (!b) return; const t = setInterval(() => setShowB((x) => !x), 8000); return () => clearInterval(t); }, [b]);
  return <div className="h-full" key={showB ? "b" : "a"} style={{ animation: "rise .4s ease-out" }}>{showB && b ? b : a}</div>;
}

function Team({ g, side, fav, cfg }: { g: Game; side: "home" | "away"; fav: boolean; cfg: TickerConfig }) {
  const t = g[side];
  const poss = cfg.showPossession && g.situation.possession === side && g.status === "live";
  return <span className={`flex items-center gap-[0.35em] uppercase ${fav ? "text-white" : "text-fog/85"}`}><span className="inline-block h-[0.55em] w-[0.18em] rounded-sm" style={{ background: t.profile.primaryColor }} />{t.shortName}{poss && <span className="text-[0.45em]" style={{ color: t.profile.primaryColor }}>●</span>}</span>;
}

function Score({ g, side, cfg }: { g: Game; side: "home" | "away"; cfg: TickerConfig }) {
  const v = side === "home" ? g.homeScore : g.awayScore;
  const flash = useFlash(v);
  const ref = useRef<HTMLSpanElement>(null);
  if (g.status === "scheduled") return null;
  return <span ref={ref} className={`tnum rounded-[0.15em] px-[0.15em] ${cfg.scoreFlash && flash ? "score-flash" : ""}`} style={{ ["--flash" as string]: g[side].profile.primaryColor }}>{v}</span>;
}

function Sep() { return <span className="text-[0.55em] text-mute">|</span>; }

function Takeover({ o, h }: { o: DisplayOverlay; h: number }) {
  const color = o.color ?? "#fff";
  return (
    <div className="flex h-full items-center gap-[0.8em] whitespace-nowrap px-[0.6em]" style={{ background: o.kind === "celebration" ? `linear-gradient(90deg, ${color} 0%, ${color}cc 60%, #000 100%)` : "#000", borderLeft: o.kind === "celebration" ? "none" : `0.25em solid ${color}`, animation: "rise .35s ease-out" }}>
      <span className="font-black tracking-wider" style={{ color: o.kind === "celebration" ? "#fff" : color, fontSize: h > 0 ? undefined : undefined }}>{o.text}</span>
      {o.subtext && <span className="text-[0.65em] font-semibold text-fog/85">{o.subtext}</span>}
    </div>
  );
}
