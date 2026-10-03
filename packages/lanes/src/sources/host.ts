import os from "node:os";
import type { Source, SourceContext } from "../core/types.js";

/** The machine Lanes runs on: load, memory, uptime. Options: { cpuHigh: 85 } */
export const host: Source = {
  id: "host",
  start(ctx: SourceContext, opts) {
    const high = Number(opts.cpuHigh ?? 85);
    let wasHigh = false;
    let prev = os.cpus().map((c) => c.times);
    const update = () => {
      const cur = os.cpus().map((c) => c.times);
      let idle = 0, total = 0;
      cur.forEach((t, i) => {
        const p = prev[i] ?? t;
        idle += t.idle - p.idle;
        total += (t.user - p.user) + (t.nice - p.nice) + (t.sys - p.sys) + (t.idle - p.idle) + (t.irq - p.irq);
      });
      prev = cur;
      const cpu = total > 0 ? Math.round(100 * (1 - idle / total)) : 0;
      const mem = Math.round(100 * (1 - os.freemem() / os.totalmem()));
      const up = os.uptime();
      const upText = up > 86400 ? `${Math.floor(up / 86400)}d` : `${Math.floor(up / 3600)}h`;
      ctx.setCards([{ key: "stats", source: "host", text: `${os.hostname()} CPU ${cpu}% MEM ${mem}% UP ${upText}`, icon: "chip", color: cpu >= high ? "#ff6b6b" : "#8fd3c8", priority: 1 }]);
      if (cpu >= high && !wasHigh) ctx.emit({ kind: "cpu_high", key: "cpu", title: `CPU at ${cpu}%`, importance: 0.5, tags: ["host"], data: { cpu, mem } });
      wasHigh = cpu >= high;
    };
    setTimeout(update, 1000);
    setInterval(update, 10_000);
  },
};
