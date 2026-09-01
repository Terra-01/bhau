import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Chart data for any watchlist symbol or index. Default: ~1Y of daily
// bars (the last bar is today's forming session). `?range=1d`: the most
// recent session's minute prints, for the live 1D tab. Indices pass
// through (^NSEI); NSE stocks get the .NS suffix.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_DAILY_MS = 5 * 60 * 1000;
const TTL_INTRADAY_MS = 60 * 1000;

const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9^=.\-&]/g, "");
  if (!symbol) return NextResponse.json({ error: "bad symbol" }, { status: 400 });
  const range = new URL(request.url).searchParams.get("range") === "1d" ? "1d" : "daily";

  const key = `${symbol}|${range}`;
  const ttl = range === "1d" ? TTL_INTRADAY_MS : TTL_DAILY_MS;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < ttl) return NextResponse.json(cached.body);

  try {
    const yahooSymbol = symbol.startsWith("^") || symbol.includes("=") || symbol.includes(".") ? symbol : `${symbol}.NS`;
    let body: unknown;
    if (range === "1d") {
      const chart = await yf.chart(yahooSymbol, {
        period1: new Date(Date.now() - 86_400_000),
        interval: "1m",
      });
      const raw = chart.quotes.filter((q) => q.close !== null && q.close !== undefined);
      // Keep only the latest session so weekends/holidays still show one
      // clean day instead of a stitched tail.
      const lastDay = raw.length > 0 ? istDay(raw[raw.length - 1].date) : undefined;
      const points = raw
        .filter((q) => istDay(q.date) === lastDay)
        .map((q) => ({ t: Math.floor(q.date.getTime() / 1000), close: q.close as number }));
      body = { symbol, range, session: lastDay, points };
    } else {
      const chart = await yf.chart(yahooSymbol, {
        period1: new Date(Date.now() - 370 * 86_400_000),
        interval: "1d",
      });
      const points = chart.quotes
        .filter((q) => q.close !== null && q.close !== undefined)
        .map((q) => ({ date: q.date.toISOString().slice(0, 10), close: q.close as number }));
      body = { symbol, range, points };
    }
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    return NextResponse.json(
      { symbol, error: err instanceof Error ? err.message : "lookup failed" },
      { status: 502 },
    );
  }
}
