import { ETF_WHITELIST, NIFTY100, SECTOR_OF } from "@/agents/universe";
import type { IngestBar } from "./types";

// The quant sheet: per-symbol price evidence for the tradeable universe,
// computed from the DailyBar archive at pack-build time. This is what
// makes the momentum/value mandates decidable — without it the agents can
// only see headlines and index closes (the 2026-09-03 diagnosis: three of
// four agents rationally NO_TRADE'd forever for lack of evidence).
//
// Honesty rules, in order of application:
// - Every series is truncated to the latest date the EQUITY universe
//   shares (`asOf`) — at ~17:17 IST bhavcopy hasn't published, so indices
//   would otherwise run one session ahead and bias every rs20.
// - A symbol whose series ends more than 3 sessions before asOf is
//   omitted entirely — a stale row is worse than an absent one.
// - 52-week fields need ≥60 sessions of history, else they're omitted
//   (a "52-week high" computed over four days is a lie).
// - A >30% single-session step in the window is treated as a corporate
//   action (splits/bonuses aren't adjusted in the archive): recent step →
//   the whole row is omitted; older step → only close/r1/r5 survive.

export interface QuantRow {
  symbol: string;
  sector?: string;
  close: number;
  /** % returns over 1/5/20/60 sessions — absent when history is shorter. */
  r1?: number;
  r5?: number;
  r20?: number;
  r60?: number;
  /** % distance from the window's intraday high/low (≤250 sessions ≈ 52 weeks). */
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

const WINDOW_52W = 250; // NSE trades ~246 sessions/year
const MIN_SESSIONS_52W = 60;
const MAX_STALE_SESSIONS = 3;
const CA_STEP = 0.3; // adjacent-session move beyond this reads as a split/bonus

const round2 = (n: number) => Number(n.toFixed(2));

const retOver = (closes: number[], sessions: number): number | undefined => {
  if (closes.length <= sessions) return undefined;
  const then = closes[closes.length - 1 - sessions];
  return then > 0 ? round2(((closes[closes.length - 1] - then) / then) * 100) : undefined;
};

export interface QuantBarIn {
  symbol: string;
  date: string;
  close: number;
  high?: number | null;
  low?: number | null;
}

interface Series {
  dates: string[];
  closes: number[];
  highs: number[];
  lows: number[];
}

/**
 * Build the sheet from archive bars (ascending by date) merged with the
 * run's own freshly fetched bars — today's bhavcopy isn't persisted yet
 * when the pack builds. The date-dedup is load-bearing: on a re-run the
 * same session arrives via both the archive and todayBars.
 */
export function buildQuant(
  history: QuantBarIn[],
  todayBars: Record<string, IngestBar[]>,
  runDate: string,
): QuantSheet {
  const series = new Map<string, Series>();
  const push = (symbol: string, date: string, close: number, high?: number | null, low?: number | null) => {
    const s = series.get(symbol) ?? { dates: [], closes: [], highs: [], lows: [] };
    // rows arrive date-ascending (PK-unique), so the last-element check is
    // the whole dedup — it catches a re-run pushing today twice
    if (s.dates[s.dates.length - 1] !== date) {
      s.dates.push(date);
      s.closes.push(close);
      s.highs.push(high ?? close);
      s.lows.push(low ?? close);
    }
    series.set(symbol, s);
  };
  for (const bar of history) push(bar.symbol, bar.date, bar.close, bar.high, bar.low);
  const universe = [...NIFTY100, ...ETF_WHITELIST];
  for (const symbol of [...universe, "^NSEI"]) {
    const today = todayBars[symbol]?.find((b) => b.date === runDate);
    if (today) push(symbol, runDate, today.close, today.high, today.low);
  }

  // asOf = the latest session the equity universe actually has; cutoff =
  // three sessions earlier (symbols ending before it are dropped as stale).
  const universeDates = [...new Set(universe.flatMap((sym) => series.get(sym)?.dates ?? []))].sort();
  const asOf = universeDates[universeDates.length - 1];
  if (!asOf) return { asOf: runDate, historyDays: 0, rows: [] };
  const cutoff = universeDates[Math.max(0, universeDates.length - 1 - MAX_STALE_SESSIONS)];

  const truncated = (symbol: string): Series | null => {
    const s = series.get(symbol);
    if (!s) return null;
    let end = s.dates.length;
    while (end > 0 && s.dates[end - 1] > asOf) end -= 1;
    if (end === 0 || s.dates[end - 1] < cutoff) return null;
    return { dates: s.dates.slice(0, end), closes: s.closes.slice(0, end), highs: s.highs.slice(0, end), lows: s.lows.slice(0, end) };
  };

  const nifty = truncated("^NSEI");
  const niftyR20 = retOver(nifty?.closes ?? [], 20);

  const rows: QuantRow[] = [];
  for (const symbol of universe) {
    const s = truncated(symbol);
    if (!s || s.closes.length === 0) continue;
    const closes = s.closes;
    const last = closes[closes.length - 1];
    const start = Math.max(0, closes.length - WINDOW_52W);

    // Corporate-action detector: the archive stores as-traded prices, so a
    // split/bonus shows up as a giant fake single-session step.
    let caStepAt = -1;
    for (let i = start + 1; i < closes.length; i += 1) {
      if (closes[i - 1] > 0 && Math.abs(closes[i] / closes[i - 1] - 1) > CA_STEP) caStepAt = i;
    }
    if (caStepAt >= 0 && caStepAt >= closes.length - 5) continue; // recent step — nothing on the row is trustworthy
    const longFieldsOk = caStepAt === -1 && closes.length - start >= MIN_SESSIONS_52W;

    const high = Math.max(...s.highs.slice(start));
    const low = Math.min(...s.lows.slice(start));
    const r20 = retOver(closes, 20);
    rows.push({
      symbol,
      sector: SECTOR_OF[symbol],
      close: round2(last),
      r1: retOver(closes, 1),
      r5: retOver(closes, 5),
      ...(caStepAt === -1
        ? {
            r20,
            r60: retOver(closes, 60),
            rs20: r20 !== undefined && niftyR20 !== undefined ? round2(r20 - niftyR20) : undefined,
          }
        : {}),
      ...(longFieldsOk && high > 0 && low > 0
        ? { from52wHigh: round2(((last - high) / high) * 100), from52wLow: round2(((last - low) / low) * 100) }
        : {}),
    });
  }

  return { asOf, historyDays: Math.min(WINDOW_52W, nifty?.closes.length ?? 0), rows };
}
