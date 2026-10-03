import type { Source, SourceContext } from "../core/types.js";

const SYMBOLS: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", dogecoin: "DOGE", litecoin: "LTC", cardano: "ADA", ripple: "XRP" };

/**
 * Crypto prices from CoinGecko, no API key. Options:
 * { coins: ["bitcoin", "ethereum"], currency: "usd", movePct: 2, interval: 60000 }
 * Emits price_move when a coin moves movePct% from the last baseline (resets after firing).
 */
export const markets: Source = {
  id: "markets",
  start(ctx: SourceContext, opts) {
    const coins = (opts.coins as string[] | undefined) ?? ["bitcoin", "ethereum"];
    const cur = ((opts.currency as string | undefined) ?? "usd").toLowerCase();
    const movePct = Number(opts.movePct ?? 2);
    const baseline = new Map<string, number>();
    const poll = async () => {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(",")}&vs_currencies=${cur}&include_24hr_change=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as Record<string, Record<string, number>>;
        const cards = [];
        for (const id of coins) {
          const row = j[id];
          if (!row) continue;
          const price = row[cur], chg = row[`${cur}_24h_change`] ?? 0;
          const sym = SYMBOLS[id] ?? id.toUpperCase().slice(0, 4);
          const up = chg >= 0;
          const fmt = price >= 100 ? Math.round(price).toLocaleString("en-US") : price.toFixed(2);
          cards.push({ key: id, source: "markets", text: `${sym} ${fmt} ${up ? "↑" : "↓"}${Math.abs(chg).toFixed(1)}%`, color: up ? "#5ee37a" : "#ff6b6b", priority: 2, tags: [sym] });
          const base = baseline.get(id);
          if (base === undefined) baseline.set(id, price);
          else {
            const pct = ((price - base) / base) * 100;
            if (Math.abs(pct) >= movePct) {
              baseline.set(id, price);
              ctx.emit({ kind: "price_move", key: id, title: `${sym} ${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%`, text: `${fmt} ${cur.toUpperCase()}`, importance: Math.min(1, 0.4 + Math.abs(pct) / 10), tags: [sym, pct > 0 ? "up" : "down"], data: { symbol: sym, price, pct: Number(pct.toFixed(2)), direction: pct > 0 ? "up" : "down", change24h: chg } });
            }
          }
        }
        ctx.setCards(cards);
      } catch (e) {
        ctx.log(`markets fetch failed: ${(e as Error).message}`);
      }
    };
    poll();
    setInterval(poll, Number(opts.interval ?? 60_000));
  },
};
