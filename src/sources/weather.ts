import type { Source, SourceContext } from "../core/types.js";

/** WMO weather code -> label, icon, and a coarse category used for change events. */
function describe(code: number): { label: string; icon: string; cat: string } {
  if (code === 0) return { label: "Clear", icon: "sun", cat: "clear" };
  if (code <= 2) return { label: "Partly cloudy", icon: "sun", cat: "clear" };
  if (code === 3) return { label: "Overcast", icon: "cloud", cat: "cloud" };
  if (code <= 48) return { label: "Fog", icon: "cloud", cat: "cloud" };
  if (code <= 57) return { label: "Drizzle", icon: "rain", cat: "rain" };
  if (code <= 67) return { label: "Rain", icon: "rain", cat: "rain" };
  if (code <= 77) return { label: "Snow", icon: "snow", cat: "snow" };
  if (code <= 82) return { label: "Showers", icon: "rain", cat: "rain" };
  if (code <= 86) return { label: "Snow showers", icon: "snow", cat: "snow" };
  return { label: "Thunderstorm", icon: "bolt", cat: "storm" };
}

/**
 * Open-Meteo, no API key. Options: { lat, lon, units: "f" | "c", label?: string, interval?: ms }
 * Emits weather_change when the coarse category flips (clear -> rain, rain -> storm...).
 */
export const weather: Source = {
  id: "weather",
  start(ctx: SourceContext, opts) {
    const lat = Number(opts.lat ?? 40.71), lon = Number(opts.lon ?? -74.01);
    const f = (opts.units ?? "f") === "f";
    const label = (opts.label as string | undefined) ?? "";
    let lastCat: string | null = null;
    const poll = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto&temperature_unit=${f ? "fahrenheit" : "celsius"}&wind_speed_unit=mph`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { current: { temperature_2m: number; weather_code: number; wind_speed_10m: number }; daily: { temperature_2m_max: number[]; temperature_2m_min: number[] } };
        const cur = j.current;
        const d = describe(cur.weather_code);
        const temp = Math.round(cur.temperature_2m);
        const hi = Math.round(j.daily.temperature_2m_max[0]), lo = Math.round(j.daily.temperature_2m_min[0]);
        const unit = f ? "°F" : "°C";
        ctx.setCards([
          { key: "now", source: "weather", text: `${label ? label + " " : ""}${temp}${unit} ${d.label}`, icon: d.icon, color: d.cat === "storm" ? "#ff8c42" : d.cat === "rain" ? "#6fb7ff" : "#ffe08a", priority: 3, tags: [d.cat] },
          { key: "range", source: "weather", text: `H ${hi}° L ${lo}°`, color: "#bbbbbb", priority: 2 },
        ]);
        if (lastCat !== null && lastCat !== d.cat) {
          const kind = d.cat === "storm" ? "storm_start" : d.cat === "rain" ? "rain_start" : d.cat === "snow" ? "snow_start" : lastCat === "rain" || lastCat === "storm" || lastCat === "snow" ? "clearing" : "weather_change";
          ctx.emit({ kind, key: "now", title: `${d.label} ${label ? "in " + label : "now"}`, text: `${temp}${unit}`, importance: d.cat === "storm" ? 0.8 : 0.5, tags: [d.cat, lastCat], data: { from: lastCat, to: d.cat, temp, code: cur.weather_code, wind: cur.wind_speed_10m } });
        }
        lastCat = d.cat;
      } catch (e) {
        ctx.log(`weather fetch failed: ${(e as Error).message}`);
      }
    };
    poll();
    setInterval(poll, Number(opts.interval ?? 10 * 60_000));
  },
};
