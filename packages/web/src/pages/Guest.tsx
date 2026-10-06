import { useEffect, useState } from "react";
import { api } from "../app/api";
import { connect, favoriteSide, primaryGame, useRoom } from "../app/store";

/**
 * Guest mode: a visitor can watch, see the show, celebrate, and quiet the room. Nothing here
 * blows the horn directly or fires fog; those live behind the main app.
 */
export function Guest() {
  const { snapshot: s } = useRoom();
  useEffect(() => connect({ role: "app" }), []);
  const [busy, setBusy] = useState<string | null>(null);
  const mode = s?.room.mode;
  const quiet = s?.room.experience?.mode === "QUIET";
  const game = s ? primaryGame(s) : undefined;
  const team = game ? game[favoriteSide(s, game) ?? "home"] : undefined;
  const run = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); try { await fn(); } finally { setTimeout(() => setBusy(null), 800); } };
  const Tile = ({ label, glyph, onClick, active, accent, k }: { label: string; glyph: string; onClick: () => void; active?: boolean; accent?: string; k: string }) => (
    <button type="button" onClick={onClick} style={accent ? { borderColor: accent, boxShadow: `inset 0 -4px 0 ${accent}` } : undefined} className={`flex flex-col items-center justify-center gap-2 rounded-3xl border p-3 text-center text-xl font-bold tracking-widest transition active:scale-[0.98] sm:text-2xl ${active || busy === k ? "border-fog bg-panel2" : "border-line bg-panel"}`}><span className="text-4xl sm:text-5xl">{glyph}</span>{label}</button>
  );
  return (
    <div className="flex h-full min-h-screen flex-col gap-3 p-4 safe-t safe-b">
      <div className="flex items-center justify-between px-1 text-xs text-mute">
        <span>{s?.room.name ?? "Room"}{game ? ` · ${game.away.abbreviation} @ ${game.home.abbreviation}` : ""}</span>
        <span>{quiet ? "Quiet mode" : mode ? mode.replace("_", " ") : ""}</span>
      </div>
      <div className="grid flex-1 grid-cols-2 grid-rows-4 gap-3 sm:grid-rows-3 sm:grid-cols-3">
        <Tile k="watch" label="WATCH LIVE" glyph="🏈" active={mode === "GAME_DAY" || mode === "SPORTS"} onClick={() => run("watch", () => api("/api/mode", { mode: "GAME_DAY" }))} />
        <Tile k="demo" label="SHOW ME ROOM OS" glyph="✨" accent={team?.profile.primaryColor} onClick={() => run("demo", () => api("/api/demo", {}))} />
        <Tile k="cel" label="CELEBRATE" glyph="🎉" accent={team?.profile.primaryColor} onClick={() => run("cel", () => api("/api/scenes/fx_celebrate", {}))} />
        <Tile k="colors" label="TEAM COLORS" glyph="🎨" onClick={() => run("colors", () => api("/api/scenes/fx_team_colors", {}))} />
        <Tile k="movie" label="MOVIE" glyph="🎬" active={mode === "MOVIE"} onClick={() => run("movie", () => api("/api/mode", { mode: "MOVIE" }))} />
        <Tile k="quiet" label={quiet ? "QUIET ON" : "QUIET"} glyph="🌙" active={quiet} onClick={() => run("quiet", () => api("/api/experience", { mode: quiet ? "NORMAL" : "QUIET" }, "PUT"))} />
        <Tile k="reset" label="RESET" glyph="↺" onClick={() => run("reset", async () => { await api("/api/demo", undefined, "DELETE"); await api("/api/scenes/fx_reset_room", {}); })} />
        <Tile k="off" label="ALL OFF" glyph="⏻" active={mode === "ALL_OFF"} onClick={() => run("off", () => api("/api/mode", { mode: "ALL_OFF" }))} />
      </div>
    </div>
  );
}
