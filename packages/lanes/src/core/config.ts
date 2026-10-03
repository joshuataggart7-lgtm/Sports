import fs from "node:fs";
import YAML from "yaml";
import type { LanesConfig } from "./types.js";

export const DEFAULT_CONFIG: LanesConfig = {
  name: "Lanes",
  matrix: { width: 256, height: 64 },
  lanes: [
    { id: "top", height: 31, show: [{ source: "sports" }, { source: "markets" }], speed: 36, scale: 2, mode: "scroll" },
    { id: "bottom", height: 32, show: [{ source: "clock" }, { source: "weather" }, { source: "countdown" }, { source: "calendar" }, { source: "host" }], speed: 26, scale: 2, mode: "auto" },
  ],
  sources: {},
  rules: [],
  attention: { budgetPerHour: 20, alwaysPriority: 85 },
  port: 8787,
};

export function loadConfig(path: string): LanesConfig {
  if (!fs.existsSync(path)) return structuredClone(DEFAULT_CONFIG);
  const raw = YAML.parse(fs.readFileSync(path, "utf8")) ?? {};
  const cfg: LanesConfig = {
    ...structuredClone(DEFAULT_CONFIG),
    ...raw,
    matrix: { ...DEFAULT_CONFIG.matrix, ...(raw.matrix ?? {}) },
    attention: { ...DEFAULT_CONFIG.attention, ...(raw.attention ?? {}) },
    lanes: raw.lanes ?? DEFAULT_CONFIG.lanes,
    sources: raw.sources ?? {},
    rules: raw.rules ?? [],
  };
  validate(cfg);
  return cfg;
}

function validate(cfg: LanesConfig): void {
  const total = cfg.lanes.reduce((s, l) => s + l.height, 0) + Math.max(0, cfg.lanes.length - 1);
  if (total > cfg.matrix.height) throw new Error(`Lanes need ${total}px of height but the matrix is ${cfg.matrix.height}px tall`);
  const ids = new Set<string>();
  for (const l of cfg.lanes) {
    if (ids.has(l.id)) throw new Error(`Duplicate lane id ${l.id}`);
    ids.add(l.id);
  }
  const ruleIds = new Set<string>();
  for (const r of cfg.rules) {
    if (!r.id) throw new Error("Every rule needs an id");
    if (ruleIds.has(r.id)) throw new Error(`Duplicate rule id ${r.id}`);
    ruleIds.add(r.id);
  }
}
