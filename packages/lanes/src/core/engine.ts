import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Card, DisplayState, LaneItem, LanesConfig, LanesEvent, Moment, Rule, SourceContext } from "./types.js";
import { matches, template, templateDeep } from "./rules.js";

interface TimedItem { item: LaneItem; expiresAt: number; createdAt: number }

export interface FiredRecord { ts: number; ruleId: string; eventId: string; action: string; note?: string }

/**
 * The Engine owns all live state: cards per source, rule-pushed lane items, the
 * active moment and its queue, and the attention ledger. Sources feed it, rules
 * shape it, displays read `state()`.
 */
export class Engine extends EventEmitter {
  readonly config: LanesConfig;
  rules: Rule[];
  private cards = new Map<string, Map<string, Card>>();
  private laneItems = new Map<string, TimedItem[]>();
  private moment: Moment | null = null;
  private queue: Moment[] = [];
  private ledger: Array<{ ts: number; cost: number }> = [];
  private lastFired = new Map<string, number>();
  readonly eventLog: LanesEvent[] = [];
  readonly firedLog: FiredRecord[] = [];
  private timer: NodeJS.Timeout | null = null;
  private dirty = true;

  constructor(config: LanesConfig) {
    super();
    this.config = config;
    this.rules = [...config.rules];
    for (const lane of config.lanes) this.laneItems.set(lane.id, []);
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), 200);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  contextFor(sourceId: string): SourceContext {
    return {
      config: this.config,
      log: (msg) => this.emit("log", `[${sourceId}] ${msg}`),
      setCards: (cards) => this.setCards(sourceId, cards),
      emit: (partial) => this.handleEvent({
        id: randomUUID(),
        ts: partial.ts ?? Date.now(),
        source: sourceId,
        kind: partial.kind,
        key: partial.key,
        title: partial.title,
        text: partial.text,
        importance: partial.importance ?? 0.5,
        tags: partial.tags ?? [],
        data: partial.data ?? {},
      }),
    };
  }

  // -------------------------------------------------------------- cards

  setCards(source: string, cards: Card[]): void {
    const map = new Map<string, Card>();
    for (const c of cards) map.set(c.key, { ...c, source });
    this.cards.set(source, map);
    this.dirty = true;
  }

  // -------------------------------------------------------------- events

  handleEvent(ev: LanesEvent): void {
    this.eventLog.push(ev);
    if (this.eventLog.length > 300) this.eventLog.shift();
    this.emit("event", ev);
    for (const rule of this.rules) {
      if (!matches(rule, ev)) continue;
      const last = this.lastFired.get(rule.id) ?? 0;
      if (rule.cooldown && ev.ts - last < rule.cooldown) {
        this.record(rule.id, ev.id, "skipped", "cooldown");
        continue;
      }
      this.lastFired.set(rule.id, ev.ts);
      this.apply(rule, ev);
      if (rule.stop) break;
    }
  }

  private apply(rule: Rule, ev: LanesEvent): void {
    const t = rule.then ?? {};
    if (t.log) this.emit("log", `[rule ${rule.id}] ${template(t.log, ev)}`);
    if (t.lane) {
      const laneId = t.lane.id ?? this.config.lanes[0]?.id;
      if (laneId) {
        this.pushLaneItem(laneId, {
          key: `rule:${rule.id}:${ev.key}`,
          text: template(t.lane.text, ev),
          color: t.lane.color,
          chip: t.lane.chip ? template(t.lane.chip, ev) : undefined,
          icon: t.lane.icon,
        }, t.lane.ttl ?? 5 * 60_000);
        this.record(rule.id, ev.id, "lane", laneId);
      }
    }
    if (t.moment) {
      const priority = t.moment.priority ?? Math.round(ev.importance * 100);
      const m: Moment = {
        id: randomUUID(),
        kind: t.moment.kind ?? "flash",
        title: template(t.moment.title ?? ev.title, ev),
        subtitle: t.moment.subtitle ? template(t.moment.subtitle, ev) : ev.text,
        color: t.moment.color ? template(t.moment.color, ev) : "#ffcc00",
        color2: t.moment.color2 ? template(t.moment.color2, ev) : undefined,
        durationMs: t.moment.duration ?? 6000,
        priority,
        cost: t.moment.cost ?? Math.max(1, Math.round(priority / 20)),
        startedAt: 0,
        ruleId: rule.id,
        eventId: ev.id,
      };
      const outcome = this.fireMoment(m);
      this.record(rule.id, ev.id, "moment", outcome);
    }
    if (t.webhook) {
      const hook = templateDeep(t.webhook, ev);
      const method = hook.method ?? "POST";
      const headers: Record<string, string> = { "content-type": "application/json", ...(hook.headers ?? {}) };
      const body = method === "GET" ? undefined : JSON.stringify(hook.body ?? { event: ev });
      fetch(hook.url, { method, headers, body })
        .then((r) => this.record(rule.id, ev.id, "webhook", `${method} ${hook.url} -> ${r.status}`))
        .catch((e) => this.record(rule.id, ev.id, "webhook", `${hook.url} failed: ${(e as Error).message}`));
    }
  }

  private record(ruleId: string, eventId: string, action: string, note?: string): void {
    const rec = { ts: Date.now(), ruleId, eventId, action, note };
    this.firedLog.push(rec);
    if (this.firedLog.length > 300) this.firedLog.shift();
    this.emit("fired", rec);
  }

  // -------------------------------------------------------------- lane items

  pushLaneItem(laneId: string, item: LaneItem, ttl: number): void {
    const list = this.laneItems.get(laneId);
    if (!list) return;
    const now = Date.now();
    const idx = list.findIndex((t) => t.item.key === item.key);
    const entry = { item, expiresAt: now + ttl, createdAt: now };
    if (idx >= 0) list[idx] = entry; else list.unshift(entry);
    if (list.length > 20) list.pop();
    this.dirty = true;
  }

  // -------------------------------------------------------------- moments

  /**
   * Attention budget: every moment costs points; the display may only spend
   * `budgetPerHour` points per rolling hour. Over budget or inside quiet hours,
   * a moment below `alwaysPriority` is demoted to a lane item instead of a takeover.
   * The display stays calm by default and loud only for what matters.
   */
  fireMoment(m: Moment): string {
    const now = Date.now();
    const a = this.config.attention;
    const spent = this.spent(now);
    const quiet = this.isQuiet(now);
    const protectedMoment = m.priority >= a.alwaysPriority;
    if (!protectedMoment && (quiet || spent + m.cost > a.budgetPerHour)) {
      const laneId = this.config.lanes[0]?.id;
      if (laneId) this.pushLaneItem(laneId, { key: `demoted:${m.id}`, text: m.subtitle ? `${m.title} ${m.subtitle}` : m.title, color: m.color, icon: "bell" }, 3 * 60_000);
      return quiet ? "demoted:quiet-hours" : "demoted:over-budget";
    }
    this.ledger.push({ ts: now, cost: m.cost });
    if (this.moment && now - this.moment.startedAt < this.moment.durationMs) {
      if (m.priority >= this.moment.priority) {
        this.queue.unshift(this.moment); // let the preempted one come back if it still matters
        this.setMoment(m, now);
        return "preempted";
      }
      this.queue.push(m);
      this.queue.sort((x, y) => y.priority - x.priority);
      if (this.queue.length > 6) this.queue.length = 6;
      return "queued";
    }
    this.setMoment(m, now);
    return "shown";
  }

  private setMoment(m: Moment, now: number): void {
    this.moment = { ...m, startedAt: now };
    this.dirty = true;
    this.emit("moment", this.moment);
  }

  private spent(now: number): number {
    const cutoff = now - 3_600_000;
    this.ledger = this.ledger.filter((l) => l.ts >= cutoff);
    return this.ledger.reduce((s, l) => s + l.cost, 0);
  }

  isQuiet(now: number): boolean {
    const q = this.config.attention.quietHours;
    if (!q) return false;
    const fmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: this.config.timezone });
    const [h, mi] = fmt.format(new Date(now)).split(":").map(Number);
    const cur = h * 60 + mi;
    const toMin = (s: string) => { const [hh, mm] = s.split(":").map(Number); return hh * 60 + (mm || 0); };
    const start = toMin(q.start), end = toMin(q.end);
    return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
  }

  // -------------------------------------------------------------- tick

  private tick(): void {
    const now = Date.now();
    if (this.moment && now - this.moment.startedAt >= this.moment.durationMs) {
      this.moment = null;
      this.dirty = true;
      // Promote the next queued moment if it is still fresh.
      while (this.queue.length) {
        const next = this.queue.shift()!;
        const age = next.startedAt ? now - next.startedAt : 0;
        if (age < 45_000) { this.setMoment(next, now); break; }
      }
    }
    for (const [, list] of this.laneItems) {
      const before = list.length;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].expiresAt <= now) list.splice(i, 1);
      if (list.length !== before) this.dirty = true;
    }
    for (const [, map] of this.cards) {
      for (const [k, c] of map) if (c.expiresAt && c.expiresAt <= now) { map.delete(k); this.dirty = true; }
    }
    if (this.dirty) {
      this.dirty = false;
      this.emit("state", this.state());
    }
  }

  // -------------------------------------------------------------- state

  state(): DisplayState {
    const now = Date.now();
    let y = 0;
    const lanes = this.config.lanes.map((lane) => {
      const items: LaneItem[] = [];
      for (const t of this.laneItems.get(lane.id) ?? []) items.push(t.item);
      for (const show of lane.show) {
        const map = this.cards.get(show.source);
        if (!map) continue;
        let cards = [...map.values()];
        if (show.tags?.length) cards = cards.filter((c) => show.tags!.every((t) => c.tags?.map((x) => x.toLowerCase()).includes(t.toLowerCase())));
        cards.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        if (show.limit) cards = cards.slice(0, show.limit);
        for (const c of cards) items.push({ key: `${c.source}:${c.key}`, text: c.text, color: c.color, chip: c.chip, icon: c.icon });
      }
      const out = {
        id: lane.id,
        y,
        height: lane.height,
        speed: lane.speed ?? 30,
        scale: lane.scale ?? 1,
        mode: lane.mode ?? "auto",
        separator: lane.separator ?? "•",
        color: lane.color ?? "#ffffff",
        items,
      };
      y += lane.height + 1;
      return out;
    });
    return {
      v: 1,
      serverTime: now,
      matrix: this.config.matrix,
      lanes,
      moment: this.moment && now - this.moment.startedAt < this.moment.durationMs ? this.moment : null,
      attention: { spent: this.spent(now), budget: this.config.attention.budgetPerHour, quiet: this.isQuiet(now) },
    };
  }

  // -------------------------------------------------------------- rules

  addRule(rule: Rule): void {
    this.rules = this.rules.filter((r) => r.id !== rule.id);
    this.rules.push(rule);
    this.emit("rules", this.rules);
  }

  removeRule(id: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== id);
    if (this.rules.length !== before) this.emit("rules", this.rules);
    return this.rules.length !== before;
  }

  cardsFor(source: string): Card[] {
    return [...(this.cards.get(source)?.values() ?? [])];
  }
}
