/**
 * The projected ribbon, styled like a telecast's bottom line. The projector throws a full
 * image; everything outside the configured viewport is true black. Sparse by design: the
 * watched game as a score bug, then one line of other scores that cycles or scrolls.
 */
import { useEffect, useState } from "react";
import { DEFAULT_TICKER, type DisplayDevice, type DisplayOverlay, type Game, type Leader, type LowerBandConfig, type RoomSnapshot, type TickerConfig } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { Logo, ScoreBug } from "./broadcast";

export function ProjectedTicker({ s, display, overlay }: { s: RoomSnapshot; display: DisplayDevice; overlay?: DisplayOverlay }) {
  const cfg: TickerConfig = { ...DEFAULT_TICKER, ...((display.roleOptions?.ticker as Partial<TickerConfig>) ?? {}) };
  const g = primaryGame(s);
  const others = s.games.filter((x) => x.id !== g?.id && x.status !== "scheduled" && (cfg.leagues.length === 0 || cfg.leagues.includes(x.leagueId)));
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  const active = overlay && overlay.until > Date.now() && overlay.kind !== "clear" ? overlay : undefined;
  const scale = typeof window !== "undefined" ? window.innerWidth / cfg.canvasWidth : 1;
  const box = { left: cfg.x * scale, top: cfg.y * scale, width: cfg.width * scale, height: cfg.height * scale };
  const lower = cfg.lower?.enabled ? cfg.lower : undefined;
  const lowerBox = lower ? { left: (lower.x ?? cfg.x) * scale, top: lower.y * scale, width: (lower.width ?? cfg.width) * scale, height: lower.height * scale } : undefined;
  // With a lower band the upper one is a single row: the other scores crawl below instead.
  const twoRows = !lower && box.height >= 1.9 * cfg.fontPx * scale;
  const mainH = twoRows ? Math.round(box.height * 0.58) : box.height;

  return (
    <div className="h-full w-full overflow-hidden bg-black">
      <div className="absolute flex flex-col overflow-hidden" style={box}>
        {active ? <Takeover o={active} h={box.height} g={g} /> : g ? (
          <>
            <div className="flex items-center" style={{ height: mainH }}>
              <ScoreBug game={g} h={Math.round(mainH * 0.86)} fav={favoriteSide(s, g)} showSituation={cfg.showDownDistance} />
              {cfg.redZoneAlert && g.situation.redZone && g.status === "live" && <div className="bc bc-pulse ml-[1em] text-[0.7em] font-black tracking-[0.2em] text-alert" style={{ fontSize: mainH * 0.36 }}>RED ZONE</div>}
            </div>
            {twoRows && others.length > 0 && <OthersLine others={others} h={box.height - mainH} cfg={cfg} s={s} />}
          </>
        ) : <div className="bc flex h-full items-center px-[1em] text-[0.6em] text-white/40">ROOM OS</div>}
      </div>
      {lower && lowerBox && (
        <div className="absolute overflow-hidden" style={lowerBox}>
          {active ? <TakeoverCrawl o={active} h={lowerBox.height} /> : <LowerBand lower={lower} h={lowerBox.height} g={g} others={others} s={s} />}
        </div>
      )}
      {cfg.ruler && <Ruler canvasHeight={cfg.canvasHeight} scale={scale} />}
    </div>
  );
}

/** Calibration lines: read the number at the top and bottom edge of the surface, then set the bands' Y and Height. */
function Ruler({ canvasHeight, scale }: { canvasHeight: number; scale: number }) {
  const lines: number[] = [];
  for (let y = 0; y <= canvasHeight; y += 60) lines.push(y);
  return (
    <div className="pointer-events-none absolute inset-0">
      {lines.map((y) => (
        <div key={y} className="absolute left-0 right-0 flex items-center" style={{ top: y * scale, height: 0 }}>
          <div className="h-px w-full" style={{ background: y % 300 === 0 ? "#ffffff" : "rgba(255,255,255,0.35)" }} />
          <span className="absolute left-[2%] -translate-y-1/2 rounded bg-black/70 px-[0.4em] font-mono font-bold text-white" style={{ fontSize: 22 * scale }}>{y}</span>
          <span className="absolute right-[2%] -translate-y-1/2 rounded bg-black/70 px-[0.4em] font-mono font-bold text-white" style={{ fontSize: 22 * scale }}>{y}</span>
        </div>
      ))}
    </div>
  );
}

/** The second band: a continuous crawl, like the bottom line under a studio show. */
function LowerBand({ lower, h, g, others, s }: { lower: LowerBandConfig; h: number; g?: Game; others: Game[]; s: RoomSnapshot }) {
  const stats = g ? s.stats?.[g.id] : undefined;
  const items: React.ReactNode[] = lower.content === "leaders" && stats
    ? [...stats.leaders.home.map((l, i) => <Leader key={`h${i}`} l={l} abbr={g!.home.abbreviation} color={g!.home.profile.primaryColor} h={h} />), ...stats.leaders.away.map((l, i) => <Leader key={`a${i}`} l={l} abbr={g!.away.abbreviation} color={g!.away.profile.primaryColor} h={h} />)]
    : others.map((o) => <ScoreBug key={o.id} game={o} h={Math.round(h * 0.72)} showSituation={false} fav={favoriteSide(s, o)} />);
  if (items.length === 0) return <div className="bc flex h-full items-center px-[1em] text-white/40" style={{ fontSize: h * 0.4 }}>{lower.content === "leaders" ? "LEADERS" : "SCORES"}</div>;
  // The row is rendered twice and slides by half its width, so the crawl is seamless and visible from the first frame.
  const seconds = Math.max(12, Math.round((items.length * 700) / lower.scrollPxPerSec));
  return (
    <div className="relative flex h-full items-center overflow-hidden border-t border-white/10 bg-[#0a0c10]">
      <div className="bc absolute left-0 top-0 z-10 flex h-full items-center bg-[#0a0c10] px-[0.8em] font-black tracking-[0.2em] text-white/60" style={{ fontSize: h * 0.34, boxShadow: "12px 0 24px #0a0c10" }}>{lower.content === "leaders" ? "LEADERS" : "SCORES"}</div>
      <div className="flex items-center whitespace-nowrap pl-[6em]" style={{ fontSize: h * 0.4, animation: `crawl ${seconds}s linear infinite` }}>
        <div className="flex items-center gap-[1.4em] pr-[1.4em]">{items}</div>
        <div className="flex items-center gap-[1.4em] pr-[1.4em]" aria-hidden>{items}</div>
      </div>
    </div>
  );
}

function Leader({ l, abbr, color, h }: { l: Leader; abbr: string; color: string; h: number }) {
  return (
    <span className="bc inline-flex items-center gap-[0.4em] whitespace-nowrap" style={{ fontSize: h * 0.4 }}>
      <span className="inline-block h-[1.1em] w-[0.22em] rounded-sm" style={{ background: color }} />
      <span className="font-black text-white/70">{abbr}</span>
      <span className="font-bold uppercase tracking-[0.08em] text-white">{l.name}</span>
      <span className="text-white/60">{l.line}</span>
    </span>
  );
}

/** During a takeover the lower band crawls the same message in the team color. */
function TakeoverCrawl({ o, h }: { o: DisplayOverlay; h: number }) {
  const color = o.color ?? "#fff";
  const msg = [o.text, o.subtext].filter(Boolean).join("   ·   ");
  return (
    <div className="bc bc-wipe flex h-full items-center overflow-hidden" style={{ background: `linear-gradient(90deg, #0a0c10 0%, ${color} 18%, ${color} 82%, #0a0c10 100%)` }}>
      <div className="flex whitespace-nowrap font-black uppercase tracking-[0.1em] text-white" style={{ fontSize: h * 0.5, animation: "crawl 8s linear infinite", textShadow: "0 3px 12px rgba(0,0,0,.5)" }}>
        <div className="flex gap-[2em] pr-[2em]">{[0, 1, 2].map((i) => <span key={i}>{msg}</span>)}</div>
        <div className="flex gap-[2em] pr-[2em]" aria-hidden>{[0, 1, 2].map((i) => <span key={i}>{msg}</span>)}</div>
      </div>
    </div>
  );
}

function OthersLine({ others, h, cfg, s }: { others: Game[]; h: number; cfg: TickerConfig; s: RoomSnapshot }) {
  const bugs = others.map((o) => <ScoreBug key={o.id} game={o} h={Math.round(h * 0.78)} showSituation={false} fav={favoriteSide(s, o)} />);
  if (cfg.mode === "scroll") {
    return <div className="flex items-center overflow-hidden" style={{ height: h }}><div className="flex gap-[1.2em] whitespace-nowrap pl-[100%]" style={{ fontSize: h * 0.4, animation: `ticker ${Math.max(12, (others.length * 600) / cfg.scrollPxPerSec * 10)}s linear infinite` }}>{bugs}</div></div>;
  }
  return <Cycle items={bugs} h={h} />;
}

function Cycle({ items, h }: { items: React.ReactNode[]; h: number }) {
  const [i, setI] = useState(0);
  const perPage = 3;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  useEffect(() => { if (pages <= 1) return; const t = setInterval(() => setI((x) => (x + 1) % pages), 8000); return () => clearInterval(t); }, [pages]);
  return <div key={i} className="bc-slide flex items-center gap-[0.6em]" style={{ height: h, fontSize: h * 0.4 }}>{items.slice(i * perPage, i * perPage + perPage)}</div>;
}

/** Takeover: a full-width team-color bar with the logo, the way a network cuts to a scoring graphic. */
function Takeover({ o, h, g }: { o: DisplayOverlay; h: number; g?: Game }) {
  const color = o.color ?? "#fff";
  const side = g && o.text ? (o.text.includes(g.home.abbreviation) ? "home" : o.text.includes(g.away.abbreviation) ? "away" : undefined) : undefined;
  const celebrate = o.kind === "celebration";
  return (
    <div className="bc bc-wipe relative flex h-full items-center gap-[0.5em] overflow-hidden whitespace-nowrap px-[0.5em]" style={{ fontSize: h * 0.52, background: celebrate ? `linear-gradient(90deg, ${color} 0%, ${color} 55%, #0a0c10 100%)` : "linear-gradient(90deg,#1c2029,#0f1218)", borderLeft: celebrate ? "none" : `0.25em solid ${color}` }}>
      {celebrate && <div className="bc-shine absolute inset-0" />}
      {o.logoUrl ? <img src={o.logoUrl} alt="" style={{ height: h * 0.8, width: h * 0.8, objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : g && side && <Logo game={g} side={side} size={h * 0.8} />}
      <span className="relative font-black uppercase tracking-[0.06em]" style={{ color: celebrate ? "#fff" : color, textShadow: celebrate ? "0 3px 12px rgba(0,0,0,.5)" : "none" }}>{o.text}</span>
      {o.subtext && <span className="relative text-[0.62em] font-bold text-white/85">{o.subtext}</span>}
    </div>
  );
}
