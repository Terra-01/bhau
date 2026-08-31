import { strFromU8, unzipSync } from "fflate";
import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// NSE's daily bhavcopy (UDiFF format) from the archives host — no cookies
// needed. One file carries every listed security's OHLCV: this is how the
// agents get per-stock opening prices for next-open fills. On holidays the
// file for today 404s; we walk back to the latest available session and
// the idempotent upsert re-writes it harmlessly.
const SERIES_KEPT = new Set(["EQ", "BE"]);
const MAX_LOOKBACK_DAYS = 6;

function yyyymmdd(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).replaceAll("-", "");
}

async function fetchZip(daysAgo: number): Promise<Uint8Array | null> {
  const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${yyyymmdd(daysAgo)}_F_0000.csv.zip`;
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export function parseBhavcopy(csv: string): IngestBar[] {
  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const col = (name: string) => header.indexOf(name);
  const [iDate, iSym, iSrs, iOpen, iHigh, iLow, iClose, iVol] = [
    col("TradDt"), col("TckrSymb"), col("SctySrs"),
    col("OpnPric"), col("HghPric"), col("LwPric"), col("ClsPric"), col("TtlTradgVol"),
  ];
  if ([iDate, iSym, iSrs, iClose].some((i) => i === -1)) {
    throw new Error("bhavcopy column layout changed — update parseBhavcopy");
  }
  const bars: IngestBar[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    if (!SERIES_KEPT.has(f[iSrs])) continue;
    const close = Number(f[iClose]);
    if (!f[iSym] || Number.isNaN(close)) continue;
    bars.push({
      date: f[iDate], // already ISO YYYY-MM-DD in UDiFF
      symbol: f[iSym],
      open: Number(f[iOpen]) || undefined,
      high: Number(f[iHigh]) || undefined,
      low: Number(f[iLow]) || undefined,
      close,
      volume: Number(f[iVol]) || undefined,
      source: "bhavcopy",
    });
  }
  return bars;
}

export const bhavcopyFetcher: Fetcher = {
  id: "bhavcopy",
  staleAfterMin: 30 * 60, // tolerates long weekends

  async fetch(): Promise<SourceResult> {
    for (let daysAgo = 0; daysAgo <= MAX_LOOKBACK_DAYS; daysAgo++) {
      const zip = await fetchZip(daysAgo);
      if (!zip) continue;
      const files = unzipSync(zip);
      const csvName = Object.keys(files).find((n) => n.endsWith(".csv"));
      if (!csvName) throw new Error("zip contained no csv");
      const bars = parseBhavcopy(strFromU8(files[csvName]));
      if (bars.length === 0) throw new Error("bhavcopy parsed to zero bars");
      return { events: [], bars };
    }
    throw new Error(`no bhavcopy found in the last ${MAX_LOOKBACK_DAYS + 1} days`);
  },
};
