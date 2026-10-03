import { useEffect } from "react";
import { api } from "../app/api";
import { connect, useRoom } from "../app/store";

/** Guest mode: four buttons. Nobody needs to understand the system. */
export function Guest() {
  const { snapshot: s } = useRoom();
  useEffect(() => connect({ role: "app" }), []);
  const mode = s?.room.mode;
  const B = ({ label, m, glyph }: { label: string; m: string; glyph: string }) => (
    <button type="button" onClick={() => api("/api/mode", { mode: m })} className={`flex flex-col items-center justify-center gap-3 rounded-3xl border text-3xl font-bold tracking-widest transition active:scale-[0.98] ${mode === m ? "border-fog bg-panel2" : "border-line bg-panel"}`}><span className="text-5xl">{glyph}</span>{label}</button>
  );
  return (
    <div className="grid h-full min-h-screen grid-cols-2 grid-rows-2 gap-4 p-4 safe-t safe-b">
      <B label="WATCH" m="SPORTS" glyph="🏈" />
      <B label="MOVIE" m="MOVIE" glyph="🎬" />
      <B label="MUSIC" m="PARTY" glyph="♫" />
      <B label="OFF" m="ALL_OFF" glyph="⏻" />
    </div>
  );
}
