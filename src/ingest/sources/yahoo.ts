import YahooFinance from "yahoo-finance2";
import type { Fetcher, IngestBar, SourceResult } from "../types";

// yahoo-finance2 handles Yahoo's cookie/crumb/session dance, which raw
// fetches fail (blanket HTTP 429). Kept behind the same Fetcher isolation:
// if Yahoo blocks anyway (some datacenter IPs), this source degrades alone.
const YAHOO_SYMBOLS = ["^NSEI", "^NSEBANK", "^BSESN", "^INDIAVIX", "INR=X", "BZ=F", "^TNX"];

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Market days keyed to IST so an NSE close and a late-UTC Brent close land
// on the trading date an Indian reader expects.
function istDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

async function fetchSymbol(symbol: string): Promise<IngestBar[]> {
  const chart = await yf.chart(symbol, {
    period1: new Date(Date.now() - 12 * 86_400_000),
    interval: "1d",
  });
  const bars: IngestBar[] = [];
  for (const quote of chart.quotes) {
    if (quote.close === null || quote.close === undefined) continue;
    bars.push({
      date: istDate(quote.date),
      symbol,
      open: quote.open ?? undefined,
      high: quote.high ?? undefined,
      low: quote.low ?? undefined,
      close: quote.close,
      volume: quote.volume ?? undefined,
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
    for (let i = 0; i < YAHOO_SYMBOLS.length; i++) {
      if (i > 0) await sleep(500);
      try {
        bars.push(...(await fetchSymbol(YAHOO_SYMBOLS[i])));
      } catch (err) {
        failures.push(`${YAHOO_SYMBOLS[i]}: ${err instanceof Error ? err.message : String(err)}`);
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
