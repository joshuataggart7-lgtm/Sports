/**
 * The rule composer: turn a sentence like "when the Astros score, flash orange confetti
 * and tell Home Assistant" into a Rule. Uses Claude with a structured output schema so
 * the result is always a valid rule, never free text to parse.
 *
 * Credentials come from the environment (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
 * `ant auth login` profile). When none are present the admin page falls back to the
 * JSON editor and says so.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { LanesConfig, Rule, RuleWhen, Cond } from "../core/types.js";

const MODEL = "claude-opus-5-5";

export function composerAvailable(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
  try { return fs.existsSync(path.join(os.homedir(), ".config", "anthropic")); } catch { return false; }
}

const FieldCond = z.object({
  name: z.string().describe("Event field: source, kind, key, title, text, importance, or a data field name"),
  op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "regex", "has"]),
  value: z.string().describe("Compare value as a string; numbers are parsed"),
});

const RuleOut = z.object({
  id: z.string().describe("short-kebab-case id"),
  description: z.string(),
  when: z.object({
    source: z.string().nullable(),
    kind: z.string().nullable(),
    tags: z.array(z.string()).describe("Every tag listed must be present on the event; team abbreviations, league, symbol"),
    fields: z.array(FieldCond),
  }),
  then: z.object({
    moment: z.object({
      kind: z.enum(["flash", "confetti", "pulse", "rain", "wipe"]),
      title: z.string(),
      subtitle: z.string().nullable(),
      color: z.string().describe("hex color or a {{template}}"),
      color2: z.string().nullable(),
      durationMs: z.number().int(),
      priority: z.number().int().describe("0-100; 85+ ignores quiet hours and budget"),
    }).nullable(),
    lane: z.object({
      id: z.string().nullable(),
      text: z.string(),
      color: z.string().nullable(),
      ttlMs: z.number().int(),
    }).nullable(),
    webhook: z.object({
      url: z.string(),
      method: z.enum(["POST", "PUT", "GET"]),
      bodyJson: z.string().describe("JSON object as a string; string values may contain {{templates}}"),
    }).nullable(),
  }),
  cooldownMs: z.number().int().nullable(),
  notes: z.string().nullable().describe("Anything the person should double check"),
});

export const EVENT_CATALOG = `
Sources, event kinds, tags and data fields available in rule conditions and {{templates}}:

sports  kinds: game_start, score, period, game_end
        tags: league (nfl, mlb, nba, nhl, mls, epl...), home abbreviation, away abbreviation, and on score the scoring team
        data: league, game, home, away, homeName, awayName, homeScore, awayScore, homeColor, awayColor, detail,
              on score: team, teamName, teamColor, points, summary; on game_end: winner
weather kinds: rain_start, storm_start, snow_start, clearing, weather_change
        tags: category now and before (clear, cloud, rain, snow, storm)
        data: from, to, temp, code, wind
markets kinds: price_move     tags: symbol (BTC, ETH...), up/down
        data: symbol, price, pct, direction, change24h
countdown kinds: milestone, zero   tags: the countdown name   data: name, remaining, color
calendar kinds: event_soon, event_start   tags: calendar   data: summary, minutes
host    kinds: cpu_high   data: cpu, mem
webhook kinds: whatever the caller sends (doorbell, package, laundry_done...)   data: whatever the caller sends
Every event also has: title, text, importance (0..1), key.
`;

function systemPrompt(config: LanesConfig): string {
  const lanes = config.lanes.map((l) => l.id).join(", ");
  const sources = Object.entries(config.sources).filter(([, v]) => v !== false).map(([k]) => k).join(", ");
  return `You write rules for Lanes, an ambient LED ticker. A rule has a WHEN (which event) and a THEN (what to show or do).
${EVENT_CATALOG}
Configured lanes: ${lanes}. Enabled sources: ${sources}.

Guidance:
- Match as narrowly as the person asked. Team names become abbreviations in tags (Astros -> HOU, Cowboys -> DAL, Yankees -> NYY, Lakers -> LAL).
- Prefer tags for teams/symbols, fields for numeric thresholds (e.g. pct gte 3).
- Moment kinds: flash (urgent), confetti (celebration), pulse (attention), rain (weather), wipe (announcement).
- Titles are short: the matrix is ${config.matrix.width}px wide, about 12 big characters. Use {{templates}} from the event data.
- Use the event's own color when it exists ({{teamColor}}); otherwise choose a hex that fits the mood.
- Priority: trivial 30, nice to know 50, I care 70, interrupt me 85+, emergency 95. Duration 4000-8000 ms.
- Cooldown prevents spam; 15000 ms for scores, 300000 for prices.
- Webhooks are for the outside world (Home Assistant, Slack, a speaker). Only add one when asked.`;
}

export async function composeRule(text: string, config: LanesConfig): Promise<{ rule: Rule; notes?: string }> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(RuleOut) },
    system: [{ type: "text", text: systemPrompt(config), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Write the rule for: ${text}` }],
  });
  if (response.stop_reason === "refusal") throw new Error("The composer declined this request");
  const out = response.parsed_output;
  if (!out) throw new Error("The composer returned something that was not a rule");
  return { rule: toRule(out), notes: out.notes ?? undefined };
}

function toRule(o: z.infer<typeof RuleOut>): Rule {
  const when: RuleWhen = {};
  if (o.when.source) when.source = o.when.source;
  if (o.when.kind) when.kind = o.when.kind;
  if (o.when.tags.length === 1) when.tags = o.when.tags[0];
  else if (o.when.tags.length > 1) when.tags = { in: o.when.tags }; // see note below
  for (const f of o.when.fields) {
    const num = Number(f.value);
    const v: unknown = f.op === "regex" || f.op === "has" || f.op === "eq" || f.op === "ne" ? (Number.isFinite(num) && f.value.trim() !== "" ? num : f.value) : num;
    const cond: Cond = f.op === "eq" ? (typeof v === "string" ? v : { eq: v }) : ({ [f.op]: v } as Cond);
    when[f.name] = cond;
  }
  const rule: Rule = { id: o.id || `rule-${Date.now()}`, description: o.description, when, then: {} };
  if (o.then.moment) {
    const m = o.then.moment;
    rule.then.moment = { kind: m.kind, title: m.title, subtitle: m.subtitle ?? undefined, color: m.color, color2: m.color2 ?? undefined, duration: m.durationMs, priority: m.priority };
  }
  if (o.then.lane) rule.then.lane = { id: o.then.lane.id ?? undefined, text: o.then.lane.text, color: o.then.lane.color ?? undefined, ttl: o.then.lane.ttlMs };
  if (o.then.webhook) {
    let body: unknown = undefined;
    try { body = JSON.parse(o.then.webhook.bodyJson); } catch { body = { text: o.then.webhook.bodyJson }; }
    rule.then.webhook = { url: o.then.webhook.url, method: o.then.webhook.method, body };
  }
  if (o.cooldownMs) rule.cooldown = o.cooldownMs;
  return rule;
}
