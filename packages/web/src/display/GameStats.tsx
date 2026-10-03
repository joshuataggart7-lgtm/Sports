/**
 * The stats board: the screen that makes the room feel like a broadcast truck. Team comparison
 * with mirrored bars, leaders for each side, win probability, scoring summary and the last
 * drives. Fed by the provider's box score (ESPN for real games, the simulation for demos).
 */
import type { Game, GameStats, Leader, RoomSnapshot } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { Logo, ScoreBug } from "./broadcast";

export function GameStatsBoard({ s, gameId }: { s: RoomSnapshot; gameId?: string }) {
  const g = (gameId ? s.games.find((x) => x.id === gameId) : undefined) ?? primaryGame(s);
  const st = g ? s.stats?.[g.id] : undefined;
  if (!g) return <Idle text="No game selected" />;
  const fav = favoriteSide(s, g);
  const hc = g.home.profile.primaryColor, ac = g.away.profile.primaryColor;
  return (
    <div className="bc relative h-full w-full overflow-hidden text-white" style={{ background: `radial-gradient(ellipse 50% 70% at 0% 30%, ${ac}44, transparent 60%), radial-gradient(ellipse 50% 70% at 100% 30%, ${hc}44, transparent 60%), linear-gradient(180deg, #0c0f15, #05060a)` }}>
      {/* Header: logos, names, score bug */}
      <div className="absolute inset-x-[3vw] top-[3vh] flex items-center justify-between">
        <TeamHead g={g} side="away" fav={fav === "away"} />
        <ScoreBug game={g} h={Math.round(vw() * 0.04)} fav={fav} />
        <TeamHead g={g} side="home" fav={fav === "home"} right />
      </div>

      {!st ? <div className="absolute inset-x-0 top-[45%] text-center text-[2vw] uppercase tracking-[0.3em] text-white/40">Stats loading…</div> : (
        <>
          {/* Team comparison */}
          <div className="absolute left-[3vw] top-[19vh] w-[55vw]">
            <SectionTitle>Team stats</SectionTitle>
            <div className="space-y-[1.1vh]">
              {st.team.map((row) => (
                <div key={row.label} className="grid grid-cols-[6vw_1fr_11vw_1fr_6vw] items-center gap-[0.8vw]">
                  <span className="text-right text-[1.6vw] font-bold tabular-nums">{row.away}</span>
                  <Bar pct={row.awayPct ?? 0} color={ac} dir="left" />
                  <span className="text-center text-[1.05vw] font-semibold uppercase tracking-[0.18em] text-white/55">{row.label}</span>
                  <Bar pct={row.homePct ?? 0} color={hc} dir="right" />
                  <span className="text-left text-[1.6vw] font-bold tabular-nums">{row.home}</span>
                </div>
              ))}
            </div>
            {typeof st.winProbabilityHome === "number" && (
              <div className="mt-[2.4vh]">
                <SectionTitle>Win probability</SectionTitle>
                <div className="flex items-center gap-[1vw]">
                  <span className="w-[6vw] text-right text-[1.6vw] font-black tabular-nums">{Math.round((1 - st.winProbabilityHome) * 100)}%</span>
                  <div className="relative h-[1.6vh] flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-700" style={{ width: `${(1 - st.winProbabilityHome) * 100}%`, background: ac }} />
                    <div className="absolute inset-y-0 right-0 rounded-r-full transition-[width] duration-700" style={{ width: `${st.winProbabilityHome * 100}%`, background: hc }} />
                  </div>
                  <span className="w-[6vw] text-left text-[1.6vw] font-black tabular-nums">{Math.round(st.winProbabilityHome * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Leaders */}
          <div className="absolute right-[3vw] top-[19vh] w-[35vw]">
            <SectionTitle>Leaders</SectionTitle>
            <div className="grid grid-cols-2 gap-[1vw]">
              <LeaderColumn g={g} side="away" leaders={st.leaders.away} />
              <LeaderColumn g={g} side="home" leaders={st.leaders.home} />
            </div>
          </div>

          {/* Scoring summary and drives */}
          <div className="absolute inset-x-[3vw] bottom-[3vh] grid grid-cols-[1.4fr_1fr] gap-[2vw]">
            <div>
              <SectionTitle>Scoring</SectionTitle>
              <div className="divide-y divide-white/10 rounded-[0.6vw] border border-white/10 bg-black/35">
                {st.scoringPlays.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center gap-[0.8vw] px-[1vw] py-[0.6vh] text-[1.15vw]">
                    <span className="w-[0.35vw] self-stretch rounded-sm" style={{ background: g[p.side].profile.primaryColor }} />
                    <Logo game={g} side={p.side} size={Math.round(vw() * 0.018)} />
                    <span className="w-[5vw] text-white/50">{periodLabel(p.period)} {p.clock}</span>
                    <span className="flex-1 truncate text-white/85">{p.text}</span>
                    <span className="tabular-nums font-bold">{p.awayScore}–{p.homeScore}</span>
                  </div>
                ))}
                {st.scoringPlays.length === 0 && <div className="px-[1vw] py-[0.8vh] text-[1.1vw] text-white/40">No scoring yet</div>}
              </div>
            </div>
            <div>
              <SectionTitle>Drives</SectionTitle>
              <div className="divide-y divide-white/10 rounded-[0.6vw] border border-white/10 bg-black/35">
                {(st.drives ?? []).slice(0, 4).map((d, i) => <div key={i} className="px-[1vw] py-[0.6vh] text-[1.15vw] text-white/80">{d}</div>)}
                {!st.drives?.length && <div className="px-[1vw] py-[0.8vh] text-[1.1vw] text-white/40">—</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function vw(): number { return typeof window !== "undefined" ? window.innerWidth : 1920; }
function periodLabel(p: number): string { return ["1ST", "2ND", "3RD", "4TH"][p - 1] ?? `OT${p - 4 > 1 ? p - 4 : ""}`; }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-[1vh] flex items-center gap-[0.8vw] text-[1.05vw] font-bold uppercase tracking-[0.3em] text-white/50"><span>{children}</span><span className="h-px flex-1 bg-white/10" /></div>;
}

function Bar({ pct, color, dir }: { pct: number; color: string; dir: "left" | "right" }) {
  return (
    <div className={`relative h-[1.3vh] overflow-hidden rounded-full bg-white/8 ${dir === "left" ? "" : ""}`}>
      <div className={`absolute inset-y-0 rounded-full transition-[width] duration-700 ${dir === "left" ? "right-0" : "left-0"}`} style={{ width: `${Math.round(pct * 100)}%`, background: `linear-gradient(${dir === "left" ? "270deg" : "90deg"}, ${color}, ${color}aa)` }} />
    </div>
  );
}

function TeamHead({ g, side, fav, right }: { g: Game; side: "home" | "away"; fav: boolean; right?: boolean }) {
  const t = g[side];
  return (
    <div className={`flex items-center gap-[1vw] ${right ? "flex-row-reverse text-right" : ""}`}>
      <Logo game={g} side={side} size={Math.round(vw() * 0.05)} />
      <div>
        <div className={`text-[1.9vw] font-extrabold uppercase tracking-[0.08em] ${fav ? "text-white" : "text-white/75"}`}>{t.shortName}</div>
        <div className="text-[1vw] uppercase tracking-[0.2em] text-white/45">{t.record ?? ""}</div>
      </div>
    </div>
  );
}

function LeaderColumn({ g, side, leaders }: { g: Game; side: "home" | "away"; leaders: Leader[] }) {
  const t = g[side];
  return (
    <div className="space-y-[1vh]">
      {leaders.slice(0, 4).map((l) => (
        <div key={l.category} className="flex items-center gap-[0.7vw] rounded-[0.5vw] border border-white/10 bg-black/35 px-[0.8vw] py-[0.7vh]" style={{ borderLeft: `0.3vw solid ${t.profile.primaryColor}` }}>
          {l.headshotUrl ? <img src={l.headshotUrl} alt="" className="h-[3.2vw] w-[3.2vw] rounded-full bg-white/10 object-cover object-top" /> : <div className="flex h-[3.2vw] w-[3.2vw] items-center justify-center rounded-full text-[1.1vw] font-black text-white/90" style={{ background: `${t.profile.primaryColor}66` }}>{l.number ?? ""}</div>}
          <div className="min-w-0">
            <div className="text-[0.85vw] font-semibold uppercase tracking-[0.2em] text-white/45">{l.category}</div>
            <div className="truncate text-[1.25vw] font-bold">{l.name}{l.position ? <span className="ml-[0.4em] text-[0.8em] font-semibold text-white/50">{l.position}</span> : null}</div>
            <div className="truncate text-[1vw] text-white/70">{l.line}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Idle({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-[2.5vw] text-mute">{text}</div>; }

export type { GameStats };
