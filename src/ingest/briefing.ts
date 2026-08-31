import type { RegimeResult } from "@/lib/regime";
import { SYMBOL_NAMES } from "./symbols";
import type { IngestBar, IngestEvent } from "./types";

export interface BriefingPack {
  date: string;
  generatedAt: string;
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
  const markets = Object.keys(barsBySymbol).flatMap((symbol) => {
    const name = SYMBOL_NAMES[symbol] ?? symbol;
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

  return { date, generatedAt: new Date().toISOString(), regime, markets, news };
}
