import type { Card, Source, SourceContext } from "../core/types.js";

export interface WebhookBody {
  kind?: string;
  key?: string;
  title: string;
  text?: string;
  importance?: number;
  tags?: string[];
  data?: Record<string, unknown>;
  /** Optionally also show a card in lanes for `ttl` ms. */
  card?: { text?: string; color?: string; icon?: string; chip?: string; ttl?: number };
}

/**
 * Anything can push an event: Home Assistant, IFTTT, a cron job, a kid's scoreboard app,
 * a doorbell. POST /api/events with a JSON body shaped like WebhookBody.
 */
class WebhookSource implements Source {
  id = "webhook";
  private ctx: SourceContext | null = null;
  private cards = new Map<string, Card>();

  start(ctx: SourceContext) {
    this.ctx = ctx;
  }

  handle(body: WebhookBody): { ok: boolean; error?: string } {
    if (!this.ctx) return { ok: false, error: "webhook source not started" };
    if (!body || typeof body.title !== "string") return { ok: false, error: "title is required" };
    const key = body.key ?? body.kind ?? "event";
    if (body.card) {
      const ttl = body.card.ttl ?? 10 * 60_000;
      this.cards.set(key, { key, source: "webhook", text: body.card.text ?? body.title, color: body.card.color, icon: body.card.icon, chip: body.card.chip, priority: 5, expiresAt: Date.now() + ttl });
      this.ctx.setCards([...this.cards.values()]);
    }
    this.ctx.emit({
      kind: body.kind ?? "event",
      key,
      title: body.title,
      text: body.text,
      importance: typeof body.importance === "number" ? Math.max(0, Math.min(1, body.importance)) : 0.5,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      data: body.data ?? {},
    });
    return { ok: true };
  }
}

export const webhook = new WebhookSource();
