/**
 * Canonical symbol → display name across all market-data fetchers.
 * Multiple sources may write the same symbol (redundancy — the `source`
 * column on DailyBar records provenance); near-equivalent instruments from
 * different upstreams get distinct symbols (e.g. Brent futures vs. spot).
 */
export const SYMBOL_NAMES: Record<string, string> = {
  // Indian indices (Yahoo and NSE both write these)
  "^NSEI": "Nifty 50",
  "^NSEBANK": "Nifty Bank",
  "^BSESN": "Sensex",
  "^INDIAVIX": "India VIX",

  // Yahoo
  "INR=X": "USD/INR",
  "BZ=F": "Brent Crude (futures)",
  "^TNX": "US 10Y (×10)",

  // Frankfurter / FRED
  USDINR: "USD/INR (ECB ref)",
  "BRENT-SPOT": "Brent Crude (spot)",
  US10Y: "US 10Y yield",

  // NSE breadth + AMFI benchmark
  "^BREADTH": "NSE breadth (% advancers)",
  "NIFTYBEES-NAV": "NIFTYBEES NAV (benchmark)",

  // NSE indices (Exchange sections)
  NIFTYNXT50: "Nifty Next 50",
  NIFTY500: "Nifty 500",
  NIFTYMID100: "Nifty Midcap 100",
  NIFTYSML100: "Nifty Smallcap 100",
  NIFTYIT: "Nifty IT",
  NIFTYAUTO: "Nifty Auto",
  NIFTYFMCG: "Nifty FMCG",
  NIFTYMETAL: "Nifty Metal",
  NIFTYPHARMA: "Nifty Pharma",
  NIFTYPSUBANK: "Nifty PSU Bank",
  NIFTYFINSRV: "Nifty Financial Services",
  NIFTYREALTY: "Nifty Realty",

  // commodities complex (futures, USD)
  "GC=F": "Gold",
  "SI=F": "Silver",
  "HG=F": "Copper",
  "CL=F": "WTI Crude",
  "NG=F": "Nat Gas",
};
