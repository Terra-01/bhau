import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Company essentials for the watchlist popover — yahoo quoteSummary for
// NSE tickers. Deep fundamentals (statements, peers, shareholding) are a
// dedicated future phase; this serves the at-a-glance card + deep links.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 6 * 60 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9\-&]/g, "");
  if (!symbol) return NextResponse.json({ error: "bad symbol" }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.body);

  try {
    const q = await yf.quoteSummary(`${symbol}.NS`, {
      modules: ["price", "summaryDetail", "summaryProfile", "defaultKeyStatistics", "financialData"],
    });
    const body = {
      symbol,
      name: q.price?.longName ?? q.price?.shortName ?? symbol,
      currency: q.price?.currency,
      price: q.price?.regularMarketPrice,
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
      profitMargins: q.financialData?.profitMargins,
      sector: q.summaryProfile?.sector,
      industry: q.summaryProfile?.industry,
      about: q.summaryProfile?.longBusinessSummary?.slice(0, 420),
      website: q.summaryProfile?.website,
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
