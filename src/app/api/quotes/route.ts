import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// EOD quotes for the watchlist marquee — straight from the bhavcopy archive.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
  if (symbols.length === 0) return NextResponse.json({ quotes: [] });

  const rows = await prisma.dailyBar.findMany({
    where: { symbol: { in: symbols }, source: "bhavcopy" },
    orderBy: { date: "desc" },
    take: symbols.length * 6,
  });
  const bySymbol = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySymbol.get(row.symbol) ?? [];
    if (list.length < 2) list.push(row);
    bySymbol.set(row.symbol, list);
  }

  const quotes = symbols.map((symbol) => {
    const [last, prev] = bySymbol.get(symbol) ?? [];
    if (!last) return { symbol, found: false as const };
    return {
      symbol,
      found: true as const,
      close: last.close,
      changePct: prev ? Number((((last.close - prev.close) / prev.close) * 100).toFixed(2)) : undefined,
      dayHigh: last.high,
      dayLow: last.low,
      date: last.date.toISOString().slice(0, 10),
    };
  });

  return NextResponse.json(
    { quotes },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
