import { useState } from "react";
import { fmtClock, useRoom } from "../app/store";
import { Card } from "../components/ui";
import { Connecting } from "./Home";

const KINDS = ["all", "mode", "event", "automation", "device", "display", "sync", "manual", "system"] as const;

export function Timeline() {
  const { snapshot: s } = useRoom();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  if (!s) return <Connecting />;
  const rows = s.timeline.filter((t) => kind === "all" || t.kind === kind);
  return (
    <div className="space-y-5 rise">
      <header><h1 className="text-3xl font-bold tracking-tight">Timeline</h1><p className="text-sm text-mute">Every automated action, logged. Useful when something fired that you did not expect.</p></header>
      <div className="flex flex-wrap gap-1.5">{KINDS.map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${kind === k ? "border-fog bg-panel2" : "border-line text-mute"}`}>{k}</button>)}</div>
      <Card>
        <ul className="divide-y divide-line text-sm">
          {rows.map((t) => (
            <li key={t.id} className="flex gap-3 py-2">
              <span className="tnum w-20 shrink-0 text-xs text-mute">{fmtClock(t.ts)}</span>
              <span className={`w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider ${color(t.kind)}`}>{t.kind}</span>
              <span className="min-w-0 flex-1 break-words">{t.text}</span>
            </li>
          ))}
          {rows.length === 0 && <li className="py-3 text-mute">Nothing logged yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

function color(kind: string): string { return { mode: "text-sky", event: "text-fog", automation: "text-live", device: "text-mute", display: "text-mute", sync: "text-warn", manual: "text-warn", system: "text-dim" }[kind] ?? "text-mute"; }
