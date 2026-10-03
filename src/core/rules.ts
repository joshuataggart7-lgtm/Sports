import type { Cond, LanesEvent, Rule, RuleWhen } from "./types.js";

/**
 * Tiny matching language for rule `when` clauses.
 *
 *   when: { source: sports, kind: score, tags: HOU }
 *   when: { source: markets, kind: price_cross, symbol: BTC, pct: { gte: 3 } }
 *   when: { source: webhook, title: { regex: "doorbell" } }
 *
 * A plain value means equality, except on `tags` where it means "has".
 */
export function matchCond(actual: unknown, cond: Cond | undefined, field: string): boolean {
  if (cond === undefined) return true;
  if (typeof cond !== "object" || cond === null) {
    if (field === "tags" && Array.isArray(actual)) return actual.map(norm).includes(norm(cond));
    if (typeof actual === "string" && typeof cond === "string") return norm(actual) === norm(cond);
    return actual === cond;
  }
  if ("eq" in cond && cond.eq !== undefined) {
    if (typeof actual === "string" && typeof cond.eq === "string") { if (norm(actual) !== norm(cond.eq)) return false; }
    else if (actual !== cond.eq) return false;
  }
  if ("ne" in cond && cond.ne !== undefined) {
    if (Array.isArray(actual)) { if (actual.map(norm).includes(norm(cond.ne))) return false; }
    else if (typeof actual === "string" && typeof cond.ne === "string") { if (norm(actual) === norm(cond.ne)) return false; }
    else if (actual === cond.ne) return false;
  }
  const num = typeof actual === "number" ? actual : Number(actual);
  if (cond.gt !== undefined && !(num > cond.gt)) return false;
  if (cond.gte !== undefined && !(num >= cond.gte)) return false;
  if (cond.lt !== undefined && !(num < cond.lt)) return false;
  if (cond.lte !== undefined && !(num <= cond.lte)) return false;
  if (cond.in !== undefined) {
    const list = cond.in.map((v) => (typeof v === "string" ? norm(v) : v));
    const a = typeof actual === "string" ? norm(actual) : actual;
    if (Array.isArray(actual)) { if (!actual.some((v) => list.includes(typeof v === "string" ? norm(v) : v))) return false; }
    else if (!list.includes(a)) return false;
  }
  if (cond.has !== undefined) {
    if (!Array.isArray(actual) || !actual.map(norm).includes(norm(cond.has))) return false;
  }
  if (cond.regex !== undefined) {
    if (typeof actual !== "string" || !new RegExp(cond.regex, "i").test(actual)) return false;
  }
  return true;
}

function norm(v: unknown): string {
  return String(v).trim().toLowerCase();
}

export function matches(rule: Rule, ev: LanesEvent): boolean {
  if (rule.enabled === false) return false;
  const when: RuleWhen = rule.when ?? {};
  for (const [field, cond] of Object.entries(when)) {
    if (cond === undefined) continue;
    let actual: unknown;
    switch (field) {
      case "source": actual = ev.source; break;
      case "kind": actual = ev.kind; break;
      case "key": actual = ev.key; break;
      case "title": actual = ev.title; break;
      case "text": actual = ev.text; break;
      case "tags": actual = ev.tags; break;
      case "importance": actual = ev.importance; break;
      default: actual = ev.data?.[field];
    }
    if (!matchCond(actual, cond, field)) return false;
  }
  return true;
}

/**
 * Templates: "{{title}}", "{{data.team}}" or just "{{team}}" (data fields are flattened).
 * Unknown fields render as empty strings so a typo never crashes a rule.
 */
export function template(str: string, ev: LanesEvent): string {
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = lookup(ev, path);
    return v === undefined || v === null ? "" : String(v);
  });
}

export function templateDeep<T>(value: T, ev: LanesEvent): T {
  if (typeof value === "string") return template(value, ev) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => templateDeep(v, ev)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = templateDeep(v, ev);
    return out as T;
  }
  return value;
}

function lookup(ev: LanesEvent, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ev;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
    else if (cur === ev && ev.data && p in ev.data) cur = ev.data[p];
    else return undefined;
  }
  return cur;
}
