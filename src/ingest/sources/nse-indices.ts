import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// NSE is the authoritative source for Indian indices but actively fights
// non-browser clients: it needs a cookie warm-up against the homepage and
// is known to block some client types. Treat as brittle by design — it
// degrades alone, and Yahoo writes the same symbols when it's healthy.
export const INDEX_MAP: Record<string, string> = {
  "NIFTY 50": "^NSEI",
  "NIFTY BANK": "^NSEBANK",
  "INDIA VIX": "^INDIAVIX",
  // Breadth of the market (TradingView-style indices row)
  "NIFTY NEXT 50": "NIFTYNXT50",
  "NIFTY 500": "NIFTY500",
  "NIFTY MIDCAP 100": "NIFTYMID100",
  "NIFTY SMALLCAP 100": "NIFTYSML100",
  // Sector indices — NSE's own sector readings
  "NIFTY IT": "NIFTYIT",
  "NIFTY AUTO": "NIFTYAUTO",
  "NIFTY FMCG": "NIFTYFMCG",
  "NIFTY METAL": "NIFTYMETAL",
  "NIFTY PHARMA": "NIFTYPHARMA",
  "NIFTY PSU BANK": "NIFTYPSUBANK",
  "NIFTY FINANCIAL SERVICES": "NIFTYFINSRV",
  "NIFTY REALTY": "NIFTYREALTY",
};

/** Indices whose daily history we maintain for the hero chart. */
export const HISTORY_INDICES: Record<string, string> = {
  "NIFTY 50": "^NSEI",
  "NIFTY BANK": "^NSEBANK",
  "NIFTY 500": "NIFTY500",
  "NIFTY MIDCAP 100": "NIFTYMID100",
  "NIFTY IT": "NIFTYIT",
};

interface NseIndexRow {
  index?: string;
  last?: number;
  open?: number;
  high?: number;
  low?: number;
}

interface NseAllIndices {
  data?: NseIndexRow[];
  timestamp?: string; // "31-Aug-2026 15:30" — the session NSE is reporting
  advances?: number;
  declines?: number;
  unchanged?: number;
}

interface NseHistoryRecord {
  EOD_CLOSE_INDEX_VAL?: number;
  EOD_OPEN_INDEX_VAL?: number;
  EOD_HIGH_INDEX_VAL?: number;
  EOD_LOW_INDEX_VAL?: number;
  EOD_TIMESTAMP?: string; // "31-AUG-2026"
}

const HEADERS = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

// "31-Aug-2026" or "31-AUG-2026 15:30" → "2026-08-31"
export function parseNseDate(raw: string): string | undefined {
  const match = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!match) return undefined;
  const month = MONTHS[match[2].toUpperCase()];
  if (!month) return undefined;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

const ddmmyyyy = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  return `${day}-${m}-${y}`;
};

async function nseGet(path: string, cookies: string): Promise<unknown> {
  const res = await fetch(`https://www.nseindia.com${path}`, {
    headers: { ...HEADERS, cookie: cookies, referer: "https://www.nseindia.com/" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

export const nseIndicesFetcher: Fetcher = {
  id: "nse-indices",
  staleAfterMin: 24 * 60,

  async fetch(): Promise<SourceResult> {
    // Warm-up: the homepage sets the cookies /api/* requires.
    const warmup = await fetch("https://www.nseindia.com", {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    const cookies = warmup.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    const all = (await nseGet("/api/allIndices", cookies)) as NseAllIndices;
    if (!Array.isArray(all.data)) throw new Error("unexpected allIndices shape");

    // Holiday guard: bars are dated by NSE's own session timestamp, never by
    // the wall clock — a run on a market holiday re-writes the last session
    // (idempotent upsert) instead of minting a bogus bar for a non-trading day.
    const sessionDate = all.timestamp ? parseNseDate(all.timestamp) : undefined;
    if (!sessionDate) throw new Error(`unparseable session timestamp: ${all.timestamp}`);

    const bars: IngestBar[] = [];
    for (const row of all.data) {
      const symbol = row.index && INDEX_MAP[row.index];
      if (!symbol || typeof row.last !== "number") continue;
      bars.push({
        date: sessionDate,
        symbol,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.last,
        source: "nse",
      });
    }
    if (bars.length === 0) throw new Error("no mapped indices in response");

    // Market breadth (% advancers) — archived now; joins the regime formula
    // only as a versioned v1.1 change (DESIGN/CONCEPT treat weights as published).
    const { advances = 0, declines = 0 } = all;
    if (advances + declines > 0) {
      bars.push({
        date: sessionDate,
        symbol: "^BREADTH",
        close: Number(((advances / (advances + declines)) * 100).toFixed(1)),
        source: "nse",
      });
    }

    // Daily history for the hero-chart indices (last ~12 sessions per run;
    // deep history comes from the one-time backfill script). Per-index
    // failure degrades gracefully.
    for (const [indexName, symbol] of Object.entries(HISTORY_INDICES)) {
      try {
        const history = (await nseGet(
          `/api/historicalOR/indicesHistory?indexType=${encodeURIComponent(indexName)}&from=${ddmmyyyy(12)}&to=${ddmmyyyy(0)}`,
          cookies,
        )) as { data?: NseHistoryRecord[] };
        for (const rec of history.data ?? []) {
          const date = rec.EOD_TIMESTAMP ? parseNseDate(rec.EOD_TIMESTAMP) : undefined;
          if (!date || typeof rec.EOD_CLOSE_INDEX_VAL !== "number") continue;
          bars.push({
            date,
            symbol,
            open: rec.EOD_OPEN_INDEX_VAL,
            high: rec.EOD_HIGH_INDEX_VAL,
            low: rec.EOD_LOW_INDEX_VAL,
            close: rec.EOD_CLOSE_INDEX_VAL,
            source: "nse",
          });
        }
      } catch (err) {
        console.warn(`[nse-indices] ${indexName} history failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { events: [], bars };
  },
};
