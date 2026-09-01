import { NextResponse } from "next/server";
import type { MarketPhase } from "@/lib/market-clock";
import { currentPhase, nseJson } from "@/lib/nse-live";

// Intraday stocks lists from NSE's own live-analysis endpoints. The
// client uses these only during the session; after close the EOD
// bhavcopy full-universe ranking (with its liquidity floor) is the
// better product and stays in charge. No Yahoo equivalent exists — on
// NSE failure the client simply keeps the EOD lists.

export const dynamic = "force-dynamic";

export interface LiveMoverRow {
  symbol: string;
  close: number;
  changePct: number;
  turnover: number; // ₹
}

export interface LiveMovers {
  phase: MarketPhase;
  source: "nse";
  asOf?: string; // NSE's own timestamp, verbatim
  mostTraded: LiveMoverRow[];
  gainers: LiveMoverRow[];
  losers: LiveMoverRow[];
}

const TTL_MS = 25_000;
let cache: { at: number; body: LiveMovers } | null = null;

interface VariationRow {
  symbol?: string;
  series?: string;
  ltp?: number;
  perChange?: number;
  turnover?: number; // ₹ lakhs
}

interface MostActiveRow {
  symbol?: string;
  lastPrice?: number;
  pChange?: number;
  totalTradedValue?: number; // ₹
}

const MIN_TURNOVER = 500_000; // same ₹5L floor as the EOD lists

function fromVariations(rows: VariationRow[] | undefined): LiveMoverRow[] {
  return (rows ?? [])
    .flatMap((r) =>
      r.series === "EQ" && r.symbol && typeof r.ltp === "number" && typeof r.perChange === "number"
        ? [{ symbol: r.symbol, close: r.ltp, changePct: r.perChange, turnover: (r.turnover ?? 0) * 1e5 }]
        : [],
    )
    .filter((r) => r.turnover >= MIN_TURNOVER)
    .slice(0, 6);
}

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=25, stale-while-revalidate=30" };
  if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json(cache.body, { headers });

  const phase = await currentPhase();
  try {
    const [gainers, losers, active] = await Promise.all([
      nseJson<{ allSec?: { data?: VariationRow[] } }>("/api/live-analysis-variations?index=gainers"),
      nseJson<{ allSec?: { data?: VariationRow[] } }>("/api/live-analysis-variations?index=loosers"),
      nseJson<{ data?: MostActiveRow[]; timestamp?: string }>("/api/live-analysis-most-active-securities?index=value"),
    ]);
    const body: LiveMovers = {
      phase,
      source: "nse",
      asOf: active.timestamp,
      mostTraded: (active.data ?? [])
        .flatMap((r) =>
          r.symbol && typeof r.lastPrice === "number" && typeof r.pChange === "number"
            ? [{ symbol: r.symbol, close: r.lastPrice, changePct: r.pChange, turnover: r.totalTradedValue ?? 0 }]
            : [],
        )
        .slice(0, 6),
      gainers: fromVariations(gainers.allSec?.data),
      losers: fromVariations(losers.allSec?.data),
    };
    if (body.mostTraded.length === 0 && body.gainers.length === 0) throw new Error("empty lists");
    cache = { at: Date.now(), body };
    return NextResponse.json(body, { headers });
  } catch {
    if (cache) return NextResponse.json({ ...cache.body, phase }, { headers });
    return NextResponse.json({ phase, source: "nse", mostTraded: [], gainers: [], losers: [] });
  }
}
