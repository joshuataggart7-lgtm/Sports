/**
 * The stats board: the screen that makes the room feel like a broadcast truck. Team comparison
 * with mirrored bars, leaders for each side, win probability, scoring summary and the last
 * drives. Fed by the provider's box score (ESPN for real games, the simulation for demos).
 */
import type { Game, GameStats, Leader, RoomSnapshot } from "@room/core";
import { favoriteSide, primaryGame } from "../app/store";
import { Logo, ScoreBug } from "./broadcast";
import { isPortrait, longSide } from "./viewport";

export function GameStatsBoard({ s, gameId }: { s: RoomSnapshot; gameId?: string }) {
  const g = (gameId ? s.games.find((x) => x.id === gameId) : undefined) ?? primaryGame(s);
  const st = g ? s.stats?.[g.id] : undefined;
  if (!g) return <Idle text="No game selected" />;
  const fav = favoriteSide(s, g);
  const hc = g.home.profile.primaryColor, ac = g.away.profile.primaryColor;
  const portrait = isPortrait();
  return (
    <div className="bc relative h-full w-full overflow-hidden text-white" style={{ background: `radial-gradient(ellipse 50% 70% at 0% 30%, ${ac}44, transparent 60%), radial-gradient(ellipse 50% 70% at 100% 30%, ${hc}44, transparent 60%), linear-gradient(180deg, #0c0f15, #05060a)` }}>
      {/* Header: logos, names, score bug. Portrait stacks the bug under the names so nothing overlaps. */}
      {portrait ? (
        <div className="absolute inset-x-[4%] top-[1.5%] flex flex-col gap-[1.2%]">
          <div className="flex items-center justify-between">
            <TeamHead g={g} side="away" fav={fav === "away"} />
            <TeamHead g={g} side="home" fav={fav === "home"} right />
          </div>
          <ScoreBug game={g} h={Math.round(vw() * 0.034)} fav={fav} width="100%" />
        </div>
      ) : (
        <div className="absolute inset-x-[calc(3*var(--u))] top-[calc(3*var(--v))] flex items-center justify-between">
          <TeamHead g={g} side="away" fav={fav === "away"} />
          <ScoreBug game={g} h={Math.round(vw() * 0.04)} fav={fav} />
          <TeamHead g={g} side="home" fav={fav === "home"} right />
        </div>
      )}

      {!st ? <div className="absolute inset-x-0 top-[45%] text-center text-[calc(2*var(--u))] uppercase tracking-[0.3em] text-white/40">Stats loading…</div> : (
        <>
          {/* Team comparison */}
          <div className={portrait ? "absolute left-[4%] top-[13%] w-[92%]" : "absolute left-[calc(3*var(--u))] top-[calc(19*var(--v))] w-[calc(55*var(--u))]"}>
            <SectionTitle>Team stats</SectionTitle>
            <div className="space-y-[calc(1.1*var(--v))]">
              {st.team.map((row) => (
                <div key={row.label} className={portrait ? "grid grid-cols-[11%_1fr_22%_1fr_11%] items-center gap-[2%]" : "grid grid-cols-[calc(6*var(--u))_1fr_calc(11*var(--u))_1fr_calc(6*var(--u))] items-center gap-[calc(0.8*var(--u))]"}>
                  <span className="text-right text-[calc(1.6*var(--u))] font-bold tabular-nums">{row.away}</span>
                  <Bar pct={row.awayPct ?? 0} color={ac} dir="left" />
                  <span className="text-center text-[calc(1.05*var(--u))] font-semibold uppercase tracking-[0.18em] text-white/55">{row.label}</span>
                  <Bar pct={row.homePct ?? 0} color={hc} dir="right" />
                  <span className="text-left text-[calc(1.6*var(--u))] font-bold tabular-nums">{row.home}</span>
                </div>
              ))}
            </div>
            {typeof st.winProbabilityHome === "number" && (
              <div className="mt-[calc(2.4*var(--v))]">
                <SectionTitle>Win probability</SectionTitle>
                <div className="flex items-center gap-[calc(1*var(--u))]">
                  <span className="w-[calc(6*var(--u))] text-right text-[calc(1.6*var(--u))] font-black tabular-nums">{Math.round((1 - st.winProbabilityHome) * 100)}%</span>
                  <div className="relative h-[calc(1.6*var(--v))] flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-700" style={{ width: `${(1 - st.winProbabilityHome) * 100}%`, background: ac }} />
                    <div className="absolute inset-y-0 right-0 rounded-r-full transition-[width] duration-700" style={{ width: `${st.winProbabilityHome * 100}%`, background: hc }} />
                  </div>
                  <span className="w-[calc(6*var(--u))] text-left text-[calc(1.6*var(--u))] font-black tabular-nums">{Math.round(st.winProbabilityHome * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Leaders */}
          <div className={portrait ? "absolute left-[4%] top-[50%] w-[92%]" : "absolute right-[calc(3*var(--u))] top-[calc(19*var(--v))] w-[calc(35*var(--u))]"}>
            <SectionTitle>Leaders</SectionTitle>
            <div className="grid grid-cols-2 gap-[calc(1*var(--u))]">
              <LeaderColumn g={g} side="away" leaders={st.leaders.away} />
              <LeaderColumn g={g} side="home" leaders={st.leaders.home} />
            </div>
          </div>

          {/* Scoring summary and drives */}
          <div className={portrait ? "absolute inset-x-[4%] bottom-[2%] grid grid-cols-1" : "absolute inset-x-[calc(3*var(--u))] bottom-[calc(3*var(--v))] grid grid-cols-[1.4fr_1fr] gap-[calc(2*var(--u))]"}>
            <div>
              <SectionTitle>Scoring</SectionTitle>
              <div className="divide-y divide-white/10 rounded-[calc(0.6*var(--u))] border border-white/10 bg-black/35">
                {st.scoringPlays.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center gap-[calc(0.8*var(--u))] px-[calc(1*var(--u))] py-[calc(0.6*var(--v))] text-[calc(1.15*var(--u))]">
                    <span className="w-[calc(0.35*var(--u))] self-stretch rounded-sm" style={{ background: g[p.side].profile.primaryColor }} />
                    <Logo game={g} side={p.side} size={Math.round(vw() * 0.018)} />
                    <span className="w-[calc(5*var(--u))] text-white/50">{periodLabel(p.period)} {p.clock}</span>
                    <span className="flex-1 truncate text-white/85">{p.text}</span>
                    <span className="tabular-nums font-bold">{p.awayScore}–{p.homeScore}</span>
                  </div>
                ))}
                {st.scoringPlays.length === 0 && <div className="px-[calc(1*var(--u))] py-[calc(0.8*var(--v))] text-[calc(1.1*var(--u))] text-white/40">No scoring yet</div>}
              </div>
            </div>
            <div className={portrait ? "hidden" : ""}>
              <SectionTitle>Drives</SectionTitle>
              <div className="divide-y divide-white/10 rounded-[calc(0.6*var(--u))] border border-white/10 bg-black/35">
                {(st.drives ?? []).slice(0, 4).map((d, i) => <div key={i} className="px-[calc(1*var(--u))] py-[calc(0.6*var(--v))] text-[calc(1.15*var(--u))] text-white/80">{d}</div>)}
                {!st.drives?.length && <div className="px-[calc(1*var(--u))] py-[calc(0.8*var(--v))] text-[calc(1.1*var(--u))] text-white/40">—</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function vw(): number { return longSide(); }
function periodLabel(p: number): string { return ["1ST", "2ND", "3RD", "4TH"][p - 1] ?? `OT${p - 4 > 1 ? p - 4 : ""}`; }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-[calc(1*var(--v))] flex items-center gap-[calc(0.8*var(--u))] text-[calc(1.05*var(--u))] font-bold uppercase tracking-[0.3em] text-white/50"><span>{children}</span><span className="h-px flex-1 bg-white/10" /></div>;
}

function Bar({ pct, color, dir }: { pct: number; color: string; dir: "left" | "right" }) {
  return (
    <div className={`relative h-[calc(1.3*var(--v))] overflow-hidden rounded-full bg-white/8 ${dir === "left" ? "" : ""}`}>
      <div className={`absolute inset-y-0 rounded-full transition-[width] duration-700 ${dir === "left" ? "right-0" : "left-0"}`} style={{ width: `${Math.round(pct * 100)}%`, background: `linear-gradient(${dir === "left" ? "270deg" : "90deg"}, ${color}, ${color}aa)` }} />
    </div>
  );
}

function TeamHead({ g, side, fav, right }: { g: Game; side: "home" | "away"; fav: boolean; right?: boolean }) {
  const t = g[side];
  return (
    <div className={`flex items-center gap-[calc(1*var(--u))] ${right ? "flex-row-reverse text-right" : ""}`}>
      <Logo game={g} side={side} size={Math.round(vw() * 0.05)} />
      <div>
        <div className={`text-[calc(1.9*var(--u))] font-extrabold uppercase tracking-[0.08em] ${fav ? "text-white" : "text-white/75"}`}>{t.shortName}</div>
        <div className="text-[calc(1*var(--u))] uppercase tracking-[0.2em] text-white/45">{t.record ?? ""}</div>
      </div>
    </div>
  );
}

function LeaderColumn({ g, side, leaders }: { g: Game; side: "home" | "away"; leaders: Leader[] }) {
  const t = g[side];
  return (
    <div className="space-y-[calc(1*var(--v))]">
      {leaders.slice(0, 4).map((l) => (
        <div key={l.category} className="flex items-center gap-[calc(0.7*var(--u))] rounded-[calc(0.5*var(--u))] border border-white/10 bg-black/35 px-[calc(0.8*var(--u))] py-[calc(0.7*var(--v))]" style={{ borderLeft: `calc(0.3*var(--u)) solid ${t.profile.primaryColor}` }}>
          {l.headshotUrl ? <img src={l.headshotUrl} alt="" className="h-[calc(3.2*var(--u))] w-[calc(3.2*var(--u))] rounded-full bg-white/10 object-cover object-top" /> : <div className="flex h-[calc(3.2*var(--u))] w-[calc(3.2*var(--u))] items-center justify-center rounded-full text-[calc(1.1*var(--u))] font-black text-white/90" style={{ background: `${t.profile.primaryColor}66` }}>{l.number ?? ""}</div>}
          <div className="min-w-0">
            <div className="text-[calc(0.85*var(--u))] font-semibold uppercase tracking-[0.2em] text-white/45">{l.category}</div>
            <div className="truncate text-[calc(1.25*var(--u))] font-bold">{l.name}{l.position ? <span className="ml-[0.4em] text-[0.8em] font-semibold text-white/50">{l.position}</span> : null}</div>
            <div className="truncate text-[calc(1*var(--u))] text-white/70">{l.line}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Idle({ text }: { text: string }) { return <div className="flex h-full items-center justify-center text-[calc(2.5*var(--u))] text-mute">{text}</div>; }

export type { GameStats };
