import type { Automation, AutomationStep } from "@room/core";
import { api } from "../app/api";
import { fmtClock, useRoom } from "../app/store";
import { Card } from "../components/ui";
import { Connecting } from "./Home";

export function Automations() {
  const { snapshot: s } = useRoom();
  if (!s) return <Connecting />;
  return (
    <div className="space-y-5 rise">
      <header><h1 className="text-3xl font-bold tracking-tight">Automations</h1><p className="text-sm text-mute">WHEN something happens · WAIT for the TV · DO the choreography · RESTORE. Editing arrives in a later milestone; toggles work now.</p></header>
      <div className="grid gap-4 md:grid-cols-2">
        {s.automations.map((a) => <AutomationCard key={a.id} a={a} />)}
      </div>
      <Card title="Recent runs">
        <ul className="divide-y divide-line text-sm">
          {s.recentRuns.map((r) => (
            <li key={r.id} className="py-2">
              <div className="flex items-center justify-between"><span className="font-medium">{r.automationName}</span><span className={`text-xs ${r.status === "done" ? "text-live" : r.status === "suppressed" || r.status === "cancelled" ? "text-warn" : r.status === "failed" ? "text-alert" : "text-sky"}`}>{r.status}{r.reason ? ` · ${r.reason}` : ""}</span></div>
              <div className="text-xs text-mute">{fmtClock(r.startedAt)}{r.log.length ? ` · ${r.log.map((l) => l.text).join(" → ")}` : ""}</div>
            </li>
          ))}
          {s.recentRuns.length === 0 && <li className="py-3 text-mute">No runs yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

function AutomationCard({ a }: { a: Automation }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div><div className="font-semibold">{a.name}</div><div className="mt-0.5 text-xs text-mute">WHEN {a.trigger.eventTypes.join(" / ")}{a.trigger.teams?.length ? ` · ${a.trigger.teams.join(", ")}` : ""}{a.cooldownMs ? ` · cooldown ${a.cooldownMs / 1000}s` : ""}</div></div>
        <label className="relative inline-flex cursor-pointer items-center"><input type="checkbox" className="peer sr-only" checked={a.enabled} onChange={(e) => api(`/api/automations/${a.id}`, { enabled: e.target.checked })} /><span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-live after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-fog after:transition peer-checked:after:translate-x-5" /></label>
      </div>
      <ol className="mt-3 space-y-1.5 border-l border-line pl-3 text-xs text-mute">{a.steps.map((st, i) => <li key={i}>{describeStep(st)}</li>)}</ol>
    </Card>
  );
}

function describeStep(st: AutomationStep): string {
  switch (st.kind) {
    case "wait": return st.ms === "broadcast_delay" ? "WAIT broadcast delay" : `WAIT ${st.ms / 1000}s`;
    case "do": return `DO ${st.label ?? ""} ${st.actions.map((a) => ("overlay" in a ? `${a.overlay.kind}${a.overlay.text ? ` "${a.overlay.text}"` : ""}` : `${"group" in a.target ? a.target.group : "device" in a.target ? a.target.device : "displayRole" in a.target ? a.target.displayRole : "…"} ${a.command.type.replace(/_/g, " ")}`) + (a.delayMs ? ` @${a.delayMs}ms` : "")).join(", ")}`;
    case "if": return `IF ${JSON.stringify(st.condition)} THEN ${st.then.length} step(s)${st.else ? ` ELSE ${st.else.length}` : ""}`;
    case "restore": return `RESTORE ${st.what ?? "all"}`;
    case "scene": return `SCENE ${st.sceneId}`;
  }
}
