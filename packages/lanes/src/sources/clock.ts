import type { Source, SourceContext } from "../core/types.js";

/** Local time card. Options: { format: "12" | "24", timezone?: string } */
export const clock: Source = {
  id: "clock",
  start(ctx: SourceContext, opts) {
    const hour12 = opts.format !== "24";
    const tz = (opts.timezone as string | undefined) ?? ctx.config.timezone;
    let last = "";
    const update = () => {
      const now = new Date();
      const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12, timeZone: tz }).format(now);
      const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(now);
      const text = `${day} ${time}`;
      if (text !== last) {
        last = text;
        ctx.setCards([{ key: "now", source: "clock", text, icon: "clock", color: "#9ad1ff", priority: 1 }]);
      }
    };
    update();
    setInterval(update, 5000);
  },
};
