/**
 * The projected ribbon, styled like a telecast's bottom line. The projector throws a full
 * image; everything outside the configured viewport is true black. Sparse by design: the
 * watched game as a score bug, then one line of other scores that cycles or scrolls.
 */
import { useEffect, useState } from "react";
import { DEFAULT_TICKER, type DisplayDevice, type DisplayOverlay, type Game, type RoomSnapshot, type TickerConfig } from "@room/core";
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
  const twoRows = box.height >= 1.9 * cfg.fontPx * scale;
  const mainH = twoRows ? Math.round(box.height * 0.58) : box.height;

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
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
