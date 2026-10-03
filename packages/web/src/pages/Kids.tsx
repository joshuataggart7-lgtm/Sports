import { useEffect } from "react";
import { api } from "../app/api";
import { connect, useRoom } from "../app/store";

/** Kids mode: movies, music, dance lights, off. No sports controls, nothing to break. */
export function Kids() {
  const { snapshot: s } = useRoom();
  useEffect(() => connect({ role: "app" }), []);
  const mode = s?.room.mode;
  const dance = () => api("/api/devices/room_leds/command", { command: { type: "effect", effect: "chase", colors: ["#ff2d55", "#ffd60a", "#5ac8fa", "#34c759"], durationMs: 0 } }).then(() => api("/api/devices/bias_lights/command", { command: { type: "effect", effect: "breathe", colors: ["#ff2d55", "#5ac8fa"], durationMs: 0 } }));
  const B = ({ label, onClick, glyph, active, color }: { label: string; onClick: () => void; glyph: string; active?: boolean; color: string }) => (
    <button type="button" onClick={onClick} className={`flex flex-col items-center justify-center gap-4 rounded-[2rem] border-4 text-4xl font-black tracking-widest text-white transition active:scale-[0.97] ${active ? "border-white" : "border-transparent"}`} style={{ background: color }}><span className="text-7xl">{glyph}</span>{label}</button>
  );
  return (
    <div className="grid h-full min-h-screen grid-cols-2 grid-rows-2 gap-4 bg-ink p-4 safe-t safe-b">
      <B label="MOVIE" glyph="🎬" color="#5856d6" active={mode === "MOVIE"} onClick={() => api("/api/mode", { mode: "MOVIE" })} />
      <B label="MUSIC" glyph="🎵" color="#ff9f0a" active={mode === "PARTY"} onClick={() => api("/api/mode", { mode: "PARTY" })} />
      <B label="DANCE" glyph="✨" color="#ff2d55" onClick={dance} />
      <B label="OFF" glyph="😴" color="#3a3f4b" active={mode === "ALL_OFF"} onClick={() => api("/api/mode", { mode: "ALL_OFF" })} />
    </div>
  );
}
