import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/db";
import { currentPhase } from "@/lib/nse-live";

// Watchlist quotes — Yahoo's NSE feed (measured seconds-fresh; the same
// source as the chart's last bar, so rows and chart always agree), with
// the bhavcopy archive as the fallback when Yahoo is unreachable.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const toYahoo = (s: string) => (s.startsWith("^") || s.includes("=") || s.includes(".") ? s : `${s}.NS`);

interface QuoteOut {
  symbol: string;
  found: boolean;
  close?: number;
  changePct?: number;
  date?: string;
}

async function fromYahoo(symbols: string[]): Promise<QuoteOut[]> {
  const rows = await yf.quote(symbols.map(toYahoo));
  const byYahoo = new Map(rows.map((r) => [r.symbol, r]));
  return symbols.map((symbol) => {
    const q = byYahoo.get(toYahoo(symbol));
    if (!q || typeof q.regularMarketPrice !== "number") return { symbol, found: false };
    return {
      symbol,
      found: true,
      close: q.regularMarketPrice,
      changePct:
        typeof q.regularMarketChangePercent === "number"
          ? Number(q.regularMarketChangePercent.toFixed(2))
          : undefined,
      date: q.regularMarketTime?.toISOString(),
    };
  });
}

async function fromArchive(symbols: string[]): Promise<QuoteOut[]> {
  // Any source: equities live in bhavcopy rows, but the indices are only
  // written by the nse/yahoo ingests — filtering to bhavcopy would leave
  // ^NSEI/^BSESN with no EOD fallback at all.
  const rows = await prisma.dailyBar.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { date: "desc" },
    take: symbols.length * 8,
  });
  const bySymbol = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySymbol.get(row.symbol) ?? [];
    const day = row.date.toISOString().slice(0, 10);
    // one bar per day — two sources can both cover an index date
    if (list.length < 2 && !list.some((r) => r.date.toISOString().slice(0, 10) === day)) list.push(row);
    bySymbol.set(row.symbol, list);
  }
  return symbols.map((symbol) => {
    const [last, prev] = bySymbol.get(symbol) ?? [];
    if (!last) return { symbol, found: false };
    return {
      symbol,
      found: true,
      close: last.close,
      changePct: prev ? Number((((last.close - prev.close) / prev.close) * 100).toFixed(2)) : undefined,
      date: last.date.toISOString().slice(0, 10),
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 24);
  if (symbols.length === 0) return NextResponse.json({ quotes: [] });

  let quotes: QuoteOut[];
  let source: "yahoo" | "eod" = "yahoo";
  try {
    quotes = await fromYahoo(symbols);
  } catch {
    quotes = await fromArchive(symbols);
    source = "eod";
  }
  const phase = await currentPhase();

  return NextResponse.json(
    { quotes, source, phase },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
