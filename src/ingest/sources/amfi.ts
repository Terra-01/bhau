import { parseNseDate } from "./nse-indices";
import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// AMFI's official daily NAV dump — free, keyless, and it blocks nobody.
// v1 use: NIFTYBEES (growth ETF, dividends reinvested) as the scoreboard
// benchmark — NAV total-return tracks Nifty 50 TRI minus ~4bp expenses,
// and it's an *investable* benchmark: what buying the index actually pays.
// TRI itself is not freely machine-readable (niftyindices.com is walled,
// NSE's API has no TRI series) — methodology page states this trade-off.
const NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

// Nippon India ETF Nifty 50 BeES — AMFI scheme code (stable), ISIN as check.
const SCHEME_CODE = "140084";
const ISIN = "INF204KB14I2";

export const amfiFetcher: Fetcher = {
  id: "amfi-nav",
  staleAfterMin: 48 * 60,

  async fetch(): Promise<SourceResult> {
    const res = await fetch(NAV_URL, {
      headers: { "user-agent": USER_AGENT, accept: "text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000), // ~1.5MB text file
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // Line format: Scheme Code;ISIN Growth;ISIN Reinv;Scheme Name;Plan;Option;NAV;Date
    const line = text.split("\n").find((l) => l.startsWith(`${SCHEME_CODE};`));
    if (!line) throw new Error(`scheme ${SCHEME_CODE} (NIFTYBEES) not in NAV dump`);
    const fields = line.split(";");
    if (!fields[1]?.includes(ISIN)) {
      throw new Error(`scheme ${SCHEME_CODE} ISIN mismatch — AMFI row layout may have changed`);
    }
    const nav = Number(fields[6]);
    const date = fields[7] ? parseNseDate(fields[7]) : undefined;
    if (Number.isNaN(nav) || !date) throw new Error(`unparseable NAV row: ${line.slice(0, 80)}`);

    const bars: IngestBar[] = [
      { date, symbol: "NIFTYBEES-NAV", close: nav, source: "amfi" },
    ];
    return { events: [], bars };
  },
};
