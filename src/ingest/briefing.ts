import type { RegimeResult } from "@/lib/regime";
import { SYMBOL_NAMES } from "./symbols";
import type { IngestBar, IngestEvent } from "./types";

export interface BriefingPack {
  date: string;
  generatedAt: string;
  /** False on market holidays — agents must not deliberate on a stale pack. */
  tradingDay: boolean;
  /** Daily desk synthesis — attached after assembly by src/ingest/synthesize.ts. */
  synthesis?: { headline: string; bullets: Array<{ text: string; tone: "risk" | "constructive" | "neutral" }> };
  regime: RegimeResult | null;
  markets: Array<{
    symbol: string;
    name: string;
    close: number;
    change1dPct?: number;
  }>;
  news: Record<string, Array<{ ts: string; source: string; title: string; url?: string }>>;
}

const TOP_PER_CATEGORY = 8;

/**
 * The daily briefing pack: the one JSON the agents deliberate on and the
 * Phase 0 exit artifact ("a week of clean daily briefing packs").
 */
export function buildBriefingPack(
  date: string,
  events: IngestEvent[],
  barsBySymbol: Record<string, IngestBar[]>,
  regime: RegimeResult | null,
): BriefingPack {
  // Trading-day heuristic: an INDIAN instrument has a bar dated today.
  // Global symbols are excluded — a late-US Brent close rolls into
  // tomorrow's IST date and must not fake an Indian session. Fails safe —
  // if Indian sources are down, agents sit out rather than trade stale data.
  const INDIA_SYMBOLS = new Set(["^NSEI", "^NSEBANK", "^BSESN", "^INDIAVIX", "^BREADTH"]);
  const tradingDay = Object.values(barsBySymbol).some((bars) =>
    bars.some(
      (b) =>
        b.date === date &&
        (b.source === "nse" || b.source === "bhavcopy" || (b.source === "yahoo" && INDIA_SYMBOLS.has(b.symbol))),
    ),
  );
  // Only the named macro/index series — per-stock bhavcopy bars (thousands)
  // stay out of the pack; agents reach stocks through news + the universe.
  const markets = Object.keys(SYMBOL_NAMES).flatMap((symbol) => {
    const name = SYMBOL_NAMES[symbol];
    const bars = barsBySymbol[symbol];
    const last = bars?.at(-1);
    if (!last) return [];
    const prev = bars.at(-2);
    return [
      {
        symbol,
        name,
        close: Number(last.close.toFixed(2)),
        change1dPct: prev ? Number((((last.close - prev.close) / prev.close) * 100).toFixed(2)) : undefined,
      },
    ];
  });

  const news: BriefingPack["news"] = {};
  const sorted = [...events].sort((a, b) => b.ts.getTime() - a.ts.getTime());
  for (const event of sorted) {
    const category = (event.payload?.category as string) ?? "other";
    news[category] ??= [];
    if (news[category].length >= TOP_PER_CATEGORY) continue;
    news[category].push({
      ts: event.ts.toISOString(),
      source: event.source,
      title: event.title,
      url: event.url,
    });
  }

  return { date, generatedAt: new Date().toISOString(), tradingDay, regime, markets, news };
}
