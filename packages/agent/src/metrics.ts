/**
 * Command timing. Every device command the DeviceManager dispatches lands here with how long
 * the driver took and whether it succeeded, so the Simulator can show exactly what fired and
 * which device is the slow one. Kept in memory, last 400 entries.
 */
import { uid, type CommandTiming, type MetricsSummary } from "@room/core";

export class Metrics {
  recent: CommandTiming[] = [];
  private runStarts = new Map<string, number>();

  /** Mark the start of a scene or automation run so commands can be shown as offsets from it. */
  startRun(runId: string): void { this.runStarts.set(runId, Date.now()); if (this.runStarts.size > 50) this.runStarts.delete(this.runStarts.keys().next().value as string); }

  record(t: Omit<CommandTiming, "id" | "offsetMs">): CommandTiming {
    const start = t.runId ? this.runStarts.get(t.runId) : undefined;
    const entry: CommandTiming = { id: uid("cmd"), ...t, offsetMs: start !== undefined ? t.ts - start : undefined };
    this.recent.push(entry);
    if (this.recent.length > 400) this.recent.shift();
    return entry;
  }

  summary(limit = 120): MetricsSummary {
    const byDriver: MetricsSummary["byDriver"] = {};
    const samples = new Map<string, number[]>();
    for (const t of this.recent) {
      const d = byDriver[t.driver] ?? (byDriver[t.driver] = { count: 0, avgMs: 0, p95Ms: 0, failures: 0 });
      d.count++; if (!t.ok) d.failures++;
      (samples.get(t.driver) ?? samples.set(t.driver, []).get(t.driver)!).push(t.durationMs);
    }
    for (const [driver, arr] of samples) {
      const sorted = [...arr].sort((a, b) => a - b);
      byDriver[driver].avgMs = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      byDriver[driver].p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    }
    return { recent: this.recent.slice(-limit).reverse(), byDriver };
  }
}
