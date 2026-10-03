/**
 * DelayScheduler: the feed knows before the TV does. Every event waits broadcast_delay_ms
 * before the room reacts. SYNC TO TV measures that delay from a real event.
 */
import type { BroadcastDelayProfile, SportsEvent } from "@room/core";

export interface ScheduledRelease { event: SportsEvent; releaseAt: number }

export class DelayScheduler {
  private pending: ScheduledRelease[] = [];
  private released: SportsEvent[] = [];
  private listeners: Array<(e: SportsEvent) => void> = [];
  private cancelListeners: Array<(e: SportsEvent, reason: string) => void> = [];
  private now: () => number;

  constructor(now: () => number = () => Date.now()) { this.now = now; }

  onRelease(cb: (e: SportsEvent) => void): void { this.listeners.push(cb); }
  onCancel(cb: (e: SportsEvent, reason: string) => void): void { this.cancelListeners.push(cb); }

  schedule(event: SportsEvent, delayMs: number): SportsEvent {
    const releaseAt = event.ts + Math.max(0, delayMs);
    event.releaseAt = releaseAt;
    this.pending.push({ event, releaseAt });
    this.pending.sort((a, b) => a.releaseAt - b.releaseAt);
    return event;
  }

  /** Release everything that is due. Call often; tests call it with a fake clock. */
  pump(): SportsEvent[] {
    const now = this.now();
    const due: SportsEvent[] = [];
    while (this.pending.length && this.pending[0].releaseAt <= now) {
      const { event } = this.pending.shift()!;
      event.state = "released";
      this.released.push(event);
      if (this.released.length > 200) this.released.shift();
      due.push(event);
      for (const l of this.listeners) l(event);
    }
    return due;
  }

  cancel(id: string, reason = "cancelled"): boolean {
    const i = this.pending.findIndex((p) => p.event.id === id);
    if (i < 0) return false;
    const [{ event }] = this.pending.splice(i, 1);
    event.state = reason === "reversed" ? "reversed" : "cancelled";
    for (const l of this.cancelListeners) l(event, reason);
    return true;
  }

  cancelWhere(pred: (e: SportsEvent) => boolean, reason = "cancelled"): number {
    let n = 0;
    for (const p of [...this.pending]) if (pred(p.event)) { this.cancel(p.event.id, reason); n++; }
    return n;
  }

  pendingEvents(): SportsEvent[] { return this.pending.map((p) => p.event); }
  recentReleased(): SportsEvent[] { return [...this.released].reverse(); }

  /**
   * SYNC TO TV. The person taps the moment they see the play on screen. The delay is the
   * time between the feed's timestamp for the latest salient event and now. Scoring plays
   * are the anchor; if none exists we use the most recent event of any kind.
   */
  syncToTv(profile: BroadcastDelayProfile, anchorEventId?: string): { delayMs: number; anchor?: SportsEvent } {
    const now = this.now();
    const candidates = [...this.pending.map((p) => p.event), ...this.released].filter((e) => e.source === "provider");
    const salient = ["TOUCHDOWN", "FIELD_GOAL", "SCORE_CHANGE", "GOAL", "THREE_POINTER", "TURNOVER", "BIG_PLAY"];
    let anchor = anchorEventId ? candidates.find((e) => e.id === anchorEventId) : undefined;
    if (!anchor) anchor = candidates.filter((e) => salient.includes(e.type)).sort((a, b) => b.ts - a.ts)[0] ?? candidates.sort((a, b) => b.ts - a.ts)[0];
    if (!anchor) return { delayMs: profile.delayMs };
    const measured = Math.max(0, now - anchor.ts);
    const samples = [...(profile.samples ?? []), measured].slice(-5);
    // Median of recent samples: one mis-tap must not wreck the profile.
    const sorted = [...samples].sort((a, b) => a - b);
    const delayMs = sorted[Math.floor(sorted.length / 2)];
    profile.samples = samples;
    profile.delayMs = delayMs;
    profile.calibratedAt = now;
    // Re-time anything still waiting so it lands with the new delay.
    for (const p of this.pending) { p.releaseAt = p.event.ts + delayMs; p.event.releaseAt = p.releaseAt; }
    this.pending.sort((a, b) => a.releaseAt - b.releaseAt);
    return { delayMs, anchor };
  }
}
