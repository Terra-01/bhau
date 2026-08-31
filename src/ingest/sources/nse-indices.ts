import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// NSE is the authoritative source for Indian indices but actively fights
// non-browser clients: it needs a cookie warm-up against the homepage and
// is known to block cloud IPs. Treat as brittle by design — it degrades
// alone, and Yahoo writes the same symbols when it's healthy.
const INDEX_MAP: Record<string, string> = {
  "NIFTY 50": "^NSEI",
  "NIFTY BANK": "^NSEBANK",
  "INDIA VIX": "^INDIAVIX",
};

interface NseIndexRow {
  index?: string;
  last?: number;
  open?: number;
  high?: number;
  low?: number;
}

const HEADERS = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

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

    const res = await fetch("https://www.nseindia.com/api/allIndices", {
      headers: { ...HEADERS, cookie: cookies, referer: "https://www.nseindia.com/" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: NseIndexRow[] };
    if (!Array.isArray(data.data)) throw new Error("unexpected allIndices shape");

    const date = todayIST();
    const bars: IngestBar[] = [];
    for (const row of data.data) {
      const symbol = row.index && INDEX_MAP[row.index];
      if (!symbol || typeof row.last !== "number") continue;
      bars.push({
        date,
        symbol,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.last,
        source: "nse",
      });
    }
    if (bars.length === 0) throw new Error("no mapped indices in response");
    return { events: [], bars };
  },
};
