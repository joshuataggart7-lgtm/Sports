import type { ReactNode } from "react";
import type { IntegrationStatus } from "@room/core";

export function Dot({ on, color }: { on: boolean | "warn"; color?: string }) {
  const c = color ?? (on === "warn" ? "var(--color-warn)" : on ? "var(--color-live)" : "var(--color-dim)");
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${on === true ? "live-dot" : ""}`} style={{ background: c, boxShadow: on ? `0 0 10px ${c}` : "none" }} />;
}

export function StatusTag({ status }: { status: IntegrationStatus }) {
  const map: Record<IntegrationStatus, string> = { CONNECTED: "text-live border-live/40", SIMULATED: "text-warn border-warn/40", UNVERIFIED: "text-sky border-sky/40", OFFLINE: "text-mute border-line" };
  return <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${map[status]}`}>{status}</span>;
}

export function Card({ children, className = "", title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-xl2 border border-line bg-panel p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">{title}</h2>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ children, onClick, variant = "default", className = "", disabled, big, style }: { children: ReactNode; onClick?: () => void; variant?: "default" | "primary" | "ghost" | "danger"; className?: string; disabled?: boolean; big?: boolean; style?: React.CSSProperties }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 select-none";
  const size = big ? "px-6 py-4 text-lg" : "px-4 py-2.5 text-sm";
  const v = { default: "bg-panel2 border border-line text-fog hover:border-mute/60", primary: "bg-fog text-ink hover:bg-white", ghost: "text-mute hover:text-fog", danger: "bg-alert/15 text-alert border border-alert/30 hover:bg-alert/25" }[variant];
  return <button type="button" disabled={disabled} onClick={onClick} style={style} className={`${base} ${size} ${v} ${className}`}>{children}</button>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-mute">{children}</div>; }

export function TeamMark({ abbr, color, size = 40 }: { abbr: string; color: string; size?: number }) {
  return <div className="flex items-center justify-center rounded-full font-bold tracking-wide text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.3, boxShadow: `0 0 0 2px ${color}33` }}>{abbr.slice(0, 4)}</div>;
}
