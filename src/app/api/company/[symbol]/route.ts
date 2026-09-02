import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Asset essentials for the details popover — yahoo quoteSummary. NSE
// equities get the .NS suffix; indices (^NSEI), futures (GC=F) and FX
// crosses (EURINR=X) pass through and gracefully skip the fundamentals
// modules they don't have. Deep fundamentals remain a future phase.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 30 * 60 * 1000;

const EQUITY_MODULES = ["price", "summaryDetail", "summaryProfile", "defaultKeyStatistics", "financialData"] as const;
const PRICE_MODULES = ["price", "summaryDetail"] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  // params arrive percent-decoded already — a second decode throws on "%"
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9^=.\-&]/g, "");
  if (!symbol) return NextResponse.json({ error: "bad symbol" }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.body);

  const isEquity = !symbol.startsWith("^") && !symbol.includes("=") && !symbol.includes(".");
  const yahooSymbol = isEquity ? `${symbol}.NS` : symbol;

  try {
    let q;
    if (isEquity) {
      try {
        q = await yf.quoteSummary(yahooSymbol, { modules: [...EQUITY_MODULES] });
      } catch {
        q = await yf.quoteSummary(yahooSymbol, { modules: [...PRICE_MODULES] });
      }
    } else {
      // indices/FX/futures never carry fundamentals — skip the doomed call
      q = await yf.quoteSummary(yahooSymbol, { modules: [...PRICE_MODULES] });
    }
    const body = {
      symbol,
      kind: isEquity ? "equity" : symbol.includes("=X") ? "currency" : symbol.startsWith("^") ? "index" : "future",
      name: q.price?.longName ?? q.price?.shortName ?? symbol,
      currency: q.price?.currency,
      price: q.price?.regularMarketPrice,
      changePct: q.price?.regularMarketChangePercent,
      dayHigh: q.summaryDetail?.dayHigh,
      dayLow: q.summaryDetail?.dayLow,
      fiftyTwoWeekHigh: q.summaryDetail?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q.summaryDetail?.fiftyTwoWeekLow,
      marketCap: q.price?.marketCap ?? q.summaryDetail?.marketCap,
      trailingPE: q.summaryDetail?.trailingPE,
      bookValue: q.defaultKeyStatistics?.bookValue,
      priceToBook: q.defaultKeyStatistics?.priceToBook,
      dividendYield: q.summaryDetail?.dividendYield,
      returnOnEquity: q.financialData?.returnOnEquity,
      sector: q.summaryProfile?.sector,
      industry: q.summaryProfile?.industry,
      about: q.summaryProfile?.longBusinessSummary?.slice(0, 500),
    };
    cache.set(symbol, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { symbol, error: err instanceof Error ? err.message : "lookup failed" },
      { status: 502 },
    );
  }
}
