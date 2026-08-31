import { parseNseDate } from "./nse-indices";
import { USER_AGENT, type Fetcher, type IngestFlow, type SourceResult } from "../types";

// NSE's provisional FII/DII cash-market flows (₹ crore) — same cookie
// dance as the indices endpoints, same brittle-by-design isolation.
interface FlowRow {
  category?: string;
  date?: string; // "31-Aug-2026"
  buyValue?: string;
  sellValue?: string;
  netValue?: string;
}

const HEADERS = {
  "user-agent": USER_AGENT,
  accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

export const fiiDiiFetcher: Fetcher = {
  id: "fii-dii",
  staleAfterMin: 30 * 60,

  async fetch(): Promise<SourceResult> {
    const warmup = await fetch("https://www.nseindia.com", {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    const cookies = warmup.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    const res = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
      headers: { ...HEADERS, cookie: cookies, referer: "https://www.nseindia.com/" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as FlowRow[];
    if (!Array.isArray(rows)) throw new Error("unexpected fiidiiTradeReact shape");

    const flows: IngestFlow[] = [];
    for (const row of rows) {
      const date = row.date ? parseNseDate(row.date) : undefined;
      const [buy, sell, net] = [Number(row.buyValue), Number(row.sellValue), Number(row.netValue)];
      if (!date || !row.category || [buy, sell, net].some(Number.isNaN)) continue;
      flows.push({ date, category: row.category, buy, sell, net });
    }
    if (flows.length === 0) throw new Error("no parseable flow rows");
    return { events: [], bars: [], flows };
  },
};
