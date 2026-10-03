import fs from "node:fs";
import type { Source, SourceContext } from "../core/types.js";

interface VEvent { summary: string; start: number; end?: number; allDay: boolean }

/** Minimal ICS parser: SUMMARY, DTSTART, DTEND. Recurrence rules are ignored on purpose. */
export function parseIcs(text: string): VEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
  const out: VEvent[] = [];
  let cur: Partial<VEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") { if (cur?.summary && cur.start) out.push(cur as VEvent); cur = null; }
    else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const [name, ...params] = line.slice(0, idx).split(";");
      const value = line.slice(idx + 1);
      if (name === "SUMMARY") cur.summary = value;
      if (name === "DTSTART" || name === "DTEND") {
        const allDay = params.includes("VALUE=DATE") || /^\d{8}$/.test(value);
        const ms = parseIcsDate(value);
        if (name === "DTSTART") { cur.start = ms; cur.allDay = allDay; } else cur.end = ms;
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function parseIcsDate(v: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return NaN;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  return z ? Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) : new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
}

/**
 * Next things on your calendar. Options: { url: "https://.../basic.ics" or a file path,
 * lookaheadHours: 24, remindMinutes: [10], interval: ms }
 * Emits event_soon at each reminder and event_start when it begins.
 */
export const calendar: Source = {
  id: "calendar",
  start(ctx: SourceContext, opts) {
    const url = opts.url as string | undefined;
    if (!url) { ctx.log("calendar: no url configured"); return; }
    const lookahead = Number(opts.lookaheadHours ?? 24) * 3600_000;
    const reminders = ((opts.remindMinutes as number[] | undefined) ?? [10]).map(Number);
    const fired = new Set<string>();
    let events: VEvent[] = [];
    const load = async () => {
      try {
        const text = /^https?:/.test(url) ? await (await fetch(url)).text() : fs.readFileSync(url, "utf8");
        events = parseIcs(text);
      } catch (e) { ctx.log(`calendar load failed: ${(e as Error).message}`); }
    };
    const tick = () => {
      const now = Date.now();
      const upcoming = events.filter((e) => e.start >= now - 5 * 60_000 && e.start <= now + lookahead).slice(0, 3);
      ctx.setCards(upcoming.map((e, i) => ({
        key: `${e.start}:${e.summary}`, source: "calendar", icon: "cal", priority: 6 - i, color: "#c3b1ff",
        text: e.allDay ? `${e.summary} today` : `${e.summary} ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: ctx.config.timezone }).format(e.start)}`,
      })));
      for (const e of events) {
        if (e.allDay) continue;
        const id = `${e.start}:${e.summary}`;
        for (const min of reminders) {
          const at = e.start - min * 60_000;
          if (now >= at && now < at + 60_000 && !fired.has(`${id}:${min}`)) {
            fired.add(`${id}:${min}`);
            ctx.emit({ kind: "event_soon", key: id, title: `${e.summary} in ${min} min`, importance: 0.6, tags: ["calendar"], data: { summary: e.summary, minutes: min } });
          }
        }
        if (now >= e.start && now < e.start + 60_000 && !fired.has(`${id}:start`)) {
          fired.add(`${id}:start`);
          ctx.emit({ kind: "event_start", key: id, title: `${e.summary} starting`, importance: 0.6, tags: ["calendar"], data: { summary: e.summary } });
        }
      }
    };
    load().then(tick);
    setInterval(load, Number(opts.interval ?? 5 * 60_000));
    setInterval(tick, 20_000);
  },
};
