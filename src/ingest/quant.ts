import { ETF_WHITELIST, NIFTY100, SECTOR_OF } from "@/agents/universe";
import type { IngestBar } from "./types";

// The quant sheet: per-symbol price evidence for the tradeable universe,
// computed from the DailyBar archive at pack-build time. This is what
// makes the momentum/value mandates decidable — without it the agents can
// only see headlines and index closes (the 2026-09-03 diagnosis: three of
// four agents rationally NO_TRADE'd forever for lack of evidence).

export interface QuantRow {
  symbol: string;
  sector?: string;
  close: number;
  /** % returns over 1/5/20/60 sessions — absent when history is shorter. */
  r1?: number;
  r5?: number;
  r20?: number;
  r60?: number;
  /** % distance from the window's high/low (≤260 sessions ≈ 52 weeks). */
  from52wHigh?: number;
  from52wLow?: number;
  /** 20-session relative strength: r20 minus ^NSEI r20. */
  rs20?: number;
}

export interface QuantSheet {
  asOf: string;
  /** Sessions of history behind the sheet (from the ^NSEI series). */
  historyDays: number;
  rows: QuantRow[];
}

const WINDOW_52W = 260;

const round2 = (n: number) => Number(n.toFixed(2));

const retOver = (closes: number[], sessions: number): number | undefined => {
  if (closes.length <= sessions) return undefined;
  const then = closes[closes.length - 1 - sessions];
  return then > 0 ? round2(((closes[closes.length - 1] - then) / then) * 100) : undefined;
};

/**
 * Build the sheet from archive closes (ascending by date) merged with the
 * run's own freshly fetched bars — today's bhavcopy isn't persisted yet
 * when the pack builds.
 */
export function buildQuant(
  history: Array<{ symbol: string; date: string; close: number }>,
  todayBars: Record<string, IngestBar[]>,
  asOf: string,
): QuantSheet {
  const closesBySymbol = new Map<string, { dates: Set<string>; closes: number[] }>();
  for (const row of history) {
    const entry = closesBySymbol.get(row.symbol) ?? { dates: new Set<string>(), closes: [] };
    if (!entry.dates.has(row.date)) {
      entry.dates.add(row.date);
      entry.closes.push(row.close);
    }
    closesBySymbol.set(row.symbol, entry);
  }
  const universe = [...NIFTY100, ...ETF_WHITELIST, "^NSEI"];
  for (const symbol of universe) {
    const today = todayBars[symbol]?.find((b) => b.date === asOf);
    if (!today) continue;
    const entry = closesBySymbol.get(symbol) ?? { dates: new Set<string>(), closes: [] };
    if (!entry.dates.has(asOf)) {
      entry.dates.add(asOf);
      entry.closes.push(today.close);
    }
    closesBySymbol.set(symbol, entry);
  }

  const niftyR20 = retOver(closesBySymbol.get("^NSEI")?.closes ?? [], 20);

  const rows: QuantRow[] = [];
  for (const symbol of [...NIFTY100, ...ETF_WHITELIST]) {
    const closes = closesBySymbol.get(symbol)?.closes;
    if (!closes || closes.length === 0) continue;
    const last = closes[closes.length - 1];
    const window = closes.slice(-WINDOW_52W);
    const high = Math.max(...window);
    const low = Math.min(...window);
    const r20 = retOver(closes, 20);
    rows.push({
      symbol,
      sector: SECTOR_OF[symbol],
      close: round2(last),
      r1: retOver(closes, 1),
      r5: retOver(closes, 5),
      r20,
      r60: retOver(closes, 60),
      from52wHigh: high > 0 ? round2(((last - high) / high) * 100) : undefined,
      from52wLow: low > 0 ? round2(((last - low) / low) * 100) : undefined,
      rs20: r20 !== undefined && niftyR20 !== undefined ? round2(r20 - niftyR20) : undefined,
    });
  }

  return { asOf, historyDays: Math.min(WINDOW_52W, closesBySymbol.get("^NSEI")?.closes.length ?? 0), rows };
}
