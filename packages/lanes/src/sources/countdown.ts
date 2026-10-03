import type { Source, SourceContext } from "../core/types.js";

interface Item { name: string; at: string; color?: string }

const MILESTONES: Array<[number, string]> = [
  [7 * 86400_000, "1 week"], [86400_000, "1 day"], [3600_000, "1 hour"], [600_000, "10 minutes"], [60_000, "1 minute"],
];

function human(ms: number): string {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86400_000), h = Math.floor((ms % 86400_000) / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Countdowns to things you care about. Options: { items: [{ name, at: ISO date, color? }] } */
export const countdown: Source = {
  id: "countdown",
  start(ctx: SourceContext, opts) {
    const items = ((opts.items as Item[] | undefined) ?? []).map((i) => ({ ...i, atMs: Date.parse(i.at), fired: new Set<string>() }));
    const update = () => {
      const now = Date.now();
      const cards = [];
      for (const it of items) {
        const rem = it.atMs - now;
        if (rem < -3600_000) continue;
        cards.push({ key: it.name, source: "countdown", text: `${it.name} in ${human(rem)}`, color: it.color ?? "#ffd166", icon: "flag", priority: rem < 3600_000 ? 8 : 2 });
        for (const [ms, label] of MILESTONES) {
          if (rem <= ms && rem > ms - 30_000 && !it.fired.has(label)) {
            it.fired.add(label);
            ctx.emit({ kind: "milestone", key: it.name, title: `${it.name} in ${label}`, importance: ms <= 600_000 ? 0.7 : 0.4, tags: [it.name], data: { name: it.name, remaining: label, color: it.color } });
          }
        }
        if (rem <= 0 && !it.fired.has("zero")) {
          it.fired.add("zero");
          ctx.emit({ kind: "zero", key: it.name, title: `${it.name}!`, text: "It's time", importance: 0.9, tags: [it.name], data: { name: it.name, color: it.color } });
        }
      }
      ctx.setCards(cards);
    };
    update();
    setInterval(update, 15_000);
  },
};
