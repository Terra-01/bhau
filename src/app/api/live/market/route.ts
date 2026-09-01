import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { INDEX_MAP } from "@/ingest/sources/nse-indices";
import type { MarketPhase } from "@/lib/market-clock";
import { currentPhase, nseJson } from "@/lib/nse-live";

// One shared snapshot for the page's live layer — strip indices, forex
// crosses, commodity futures. Every viewer polls this route; the route
// hits NSE + Yahoo at most once per TTL. Ladder: NSE → Yahoo → last-good.

export const dynamic = "force-dynamic";

interface LiveQuote {
  last: number;
  changePct?: number;
  /** Yahoo marketState for that instrument ("REGULAR" = its venue is open). */
  state?: string;
}

export interface LiveMarket {
  phase: MarketPhase;
  at: string;
  indices: {
    source: "nse" | "yahoo";
    asOf?: string; // NSE session timestamp, verbatim
    quotes: Record<string, LiveQuote>;
    breadth?: { advances: number; declines: number };
  } | null;
  fx: Record<string, LiveQuote> | null; // keyed by ccy code, INR per unit
  commodities: Record<string, LiveQuote> | null; // keyed by Yahoo symbol
  stale?: boolean;
}

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const FX_SYMBOLS: Record<string, string> = {
  "INR=X": "USD", "EURINR=X": "EUR", "GBPINR=X": "GBP",
  "JPYINR=X": "JPY", "CHFINR=X": "CHF", "CNYINR=X": "CNY",
};
const COMMODITY_SYMBOLS = ["GC=F", "SI=F", "HG=F", "CL=F", "NG=F", "BZ=F"];
const YAHOO_INDICES = ["^NSEI", "^NSEBANK", "^BSESN", "^INDIAVIX"];

const TTL_MS = 25_000;
const STALE_KEEP_MS = 10 * 60 * 1000;
let cache: { at: number; body: LiveMarket } | null = null;

interface NseAllIndices {
  timestamp?: string;
  advances?: number;
  declines?: number;
  data?: Array<{ index?: string; last?: number; percentChange?: number }>;
}

async function build(phase: MarketPhase): Promise<LiveMarket> {
  const [nse, yahoo] = await Promise.allSettled([
    nseJson<NseAllIndices>("/api/allIndices"),
    yf.quote([...YAHOO_INDICES, ...Object.keys(FX_SYMBOLS), ...COMMODITY_SYMBOLS]),
  ]);

  const yq = new Map(
    yahoo.status === "fulfilled" ? yahoo.value.map((q) => [q.symbol, q]) : [],
  );
  const fromYahoo = (symbol: string): LiveQuote | undefined => {
    const q = yq.get(symbol);
    if (!q || typeof q.regularMarketPrice !== "number") return undefined;
    return {
      last: q.regularMarketPrice,
      changePct: typeof q.regularMarketChangePercent === "number" ? q.regularMarketChangePercent : undefined,
      state: q.marketState,
    };
  };

  // Indices: NSE-direct preferred, Yahoo fills the gaps (SENSEX always).
  let indices: LiveMarket["indices"] = null;
  const quotes: Record<string, LiveQuote> = {};
  for (const symbol of YAHOO_INDICES) {
    const q = fromYahoo(symbol);
    if (q) quotes[symbol] = q;
  }
  if (nse.status === "fulfilled" && Array.isArray(nse.value.data)) {
    for (const row of nse.value.data) {
      const symbol = row.index && INDEX_MAP[row.index];
      if (!symbol || typeof row.last !== "number") continue;
      quotes[symbol] = { last: row.last, changePct: row.percentChange };
    }
    const { advances = 0, declines = 0 } = nse.value;
    indices = {
      source: "nse",
      asOf: nse.value.timestamp,
      quotes,
      breadth: advances + declines > 0 ? { advances, declines } : undefined,
    };
  } else if (Object.keys(quotes).length > 0) {
    indices = { source: "yahoo", quotes };
  }

  const fx: Record<string, LiveQuote> = {};
  for (const [symbol, ccy] of Object.entries(FX_SYMBOLS)) {
    const q = fromYahoo(symbol);
    if (q) fx[ccy] = q;
  }
  const commodities: Record<string, LiveQuote> = {};
  for (const symbol of COMMODITY_SYMBOLS) {
    const q = fromYahoo(symbol);
    if (q) commodities[symbol] = q;
  }

  return {
    phase,
    at: new Date().toISOString(),
    indices,
    fx: Object.keys(fx).length > 0 ? fx : null,
    commodities: Object.keys(commodities).length > 0 ? commodities : null,
  };
}

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=25, stale-while-revalidate=30" };
  if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json(cache.body, { headers });

  const phase = await currentPhase();
  try {
    const body = await build(phase);
    if (body.indices || body.fx || body.commodities) {
      cache = { at: Date.now(), body };
      return NextResponse.json(body, { headers });
    }
    throw new Error("all upstreams empty");
  } catch {
    if (cache && Date.now() - cache.at < STALE_KEEP_MS) {
      return NextResponse.json({ ...cache.body, phase, stale: true }, { headers });
    }
    return NextResponse.json({ phase, at: new Date().toISOString(), indices: null, fx: null, commodities: null });
  }
}
