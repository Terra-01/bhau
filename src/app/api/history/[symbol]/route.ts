import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Daily EOD history for any watchlist symbol or index — powers the
// watchlist and movers charts. Indices pass through (^NSEI); NSE stocks
// get the .NS suffix.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 5 * 60 * 1000; // short: the last bar is today's forming session

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9^=.\-&]/g, "");
  if (!symbol) return NextResponse.json({ error: "bad symbol" }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.body);

  try {
    const yahooSymbol = symbol.startsWith("^") || symbol.includes("=") || symbol.includes(".") ? symbol : `${symbol}.NS`;
    const chart = await yf.chart(yahooSymbol, {
      period1: new Date(Date.now() - 370 * 86_400_000),
      interval: "1d",
    });
    const points = chart.quotes
      .filter((q) => q.close !== null && q.close !== undefined)
      .map((q) => ({ date: q.date.toISOString().slice(0, 10), close: q.close as number }));
    const body = { symbol, points };
    cache.set(symbol, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    return NextResponse.json(
      { symbol, error: err instanceof Error ? err.message : "lookup failed" },
      { status: 502 },
    );
  }
}
