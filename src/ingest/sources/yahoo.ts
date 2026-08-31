import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

export const MARKET_SYMBOLS: Record<string, string> = {
  "^NSEI": "Nifty 50",
  "^NSEBANK": "Nifty Bank",
  "^BSESN": "Sensex",
  "^INDIAVIX": "India VIX",
  "INR=X": "USD/INR",
  "BZ=F": "Brent Crude",
  "^TNX": "US 10Y (×10)",
};

interface YahooChart {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

// Market days keyed to IST so an NSE close and a late-UTC Brent close land
// on the trading date an Indian reader expects.
function istDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Yahoo 429s bursts aggressively; the daily cadence only needs one polite
// pass, so space requests out and back off once on a rate limit.
export const REQUEST_SPACING_MS = 2_500;
const RETRY_BACKOFF_MS = 30_000;

async function fetchSymbol(symbol: string, attempt = 0): Promise<IngestBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d`;
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429 && attempt < 1) {
    await sleep(RETRY_BACKOFF_MS);
    return fetchSymbol(symbol, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as YahooChart;
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(data.chart?.error?.description ?? "empty chart result");

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const bars: IngestBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close?.[i];
    if (close === null || close === undefined) continue;
    bars.push({
      date: istDate(timestamps[i]),
      symbol,
      open: quote.open?.[i] ?? undefined,
      high: quote.high?.[i] ?? undefined,
      low: quote.low?.[i] ?? undefined,
      close,
      volume: quote.volume?.[i] ?? undefined,
      source: "yahoo",
    });
  }
  return bars;
}

export const yahooMarketsFetcher: Fetcher = {
  id: "yahoo-markets",
  staleAfterMin: 24 * 60,

  async fetch(): Promise<SourceResult> {
    const bars: IngestBar[] = [];
    const failures: string[] = [];
    const symbols = Object.keys(MARKET_SYMBOLS);
    for (let i = 0; i < symbols.length; i++) {
      if (i > 0) await sleep(REQUEST_SPACING_MS);
      try {
        bars.push(...(await fetchSymbol(symbols[i])));
      } catch (err) {
        failures.push(`${symbols[i]}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (bars.length === 0 && failures.length > 0) {
      throw new Error(`all symbols failed — ${failures.join("; ")}`);
    }
    if (failures.length > 0) {
      console.warn(`[yahoo-markets] some symbols failed: ${failures.join("; ")}`);
    }
    return { events: [], bars };
  },
};
