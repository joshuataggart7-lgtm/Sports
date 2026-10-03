import type { LanesConfig, Source } from "../core/types.js";
import { clock } from "./clock.js";
import { countdown } from "./countdown.js";
import { weather } from "./weather.js";
import { markets } from "./markets.js";
import { sports } from "./sports.js";
import { calendar } from "./calendar.js";
import { host } from "./host.js";
import { webhook } from "./webhook.js";
import { demo } from "./demo.js";

export const ALL_SOURCES: Record<string, Source> = { clock, countdown, weather, markets, sports, calendar, host, webhook };

/** Builds the list of (source, options) to start from config. `demo` swaps the live sports feed for a synthetic one. */
export function selectSources(config: LanesConfig, demoMode: boolean): Array<{ source: Source; options: Record<string, unknown> }> {
  const out: Array<{ source: Source; options: Record<string, unknown> }> = [];
  const configured: Record<string, Record<string, unknown> | false> = Object.keys(config.sources).length ? config.sources : { clock: {}, host: {} };
  for (const [id, opts] of Object.entries(configured)) {
    if (opts === false) continue;
    const src = ALL_SOURCES[id];
    if (!src) { console.warn(`[lanes] unknown source "${id}" in config, skipping`); continue; }
    if (id === "sports" && demoMode) out.push({ source: demo, options: opts });
    else out.push({ source: src, options: opts });
  }
  if (!configured.webhook) out.push({ source: webhook, options: {} });
  if (demoMode && !configured.sports) out.push({ source: demo, options: {} });
  return out;
}

export { webhook };
