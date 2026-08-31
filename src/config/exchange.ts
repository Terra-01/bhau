// Exchange-section configuration: curated, versioned, honest.

/** Liquid NSE ETFs shown in the ETF row (ranked live by turnover). */
export const ETF_LIST = [
  "NIFTYBEES", "GOLDBEES", "SILVERBEES", "LIQUIDBEES", "LIQUIDCASE",
  "JUNIORBEES", "BANKBEES", "ITBEES", "MON100", "CPSEETF",
  "GOLDIETF", "SILVERIETF", "HDFCSILVER", "TATAGOLD", "INFRAIETF",
] as const;

/** Indices hero-chart set (must match HISTORY_INDICES in nse-indices.ts). */
export const HERO_INDICES = ["^NSEI", "^NSEBANK", "NIFTY500", "NIFTYMID100", "NIFTYIT"] as const;

/** Chip-row order for the indices section. */
export const INDEX_ROW = [
  "^NSEI", "^BSESN", "^NSEBANK", "NIFTY500", "NIFTYMID100", "NIFTYSML100",
  "NIFTYNXT50", "^INDIAVIX", "NIFTYIT", "NIFTYFINSRV", "NIFTYAUTO",
  "NIFTYFMCG", "NIFTYPHARMA", "NIFTYMETAL", "NIFTYPSUBANK", "NIFTYREALTY",
] as const;

/**
 * Curated recurring Indian data releases. Day-of-month approximations from
 * the publishers' own patterns; no fabricated forecasts, no invented MPC
 * dates (RBI's schedule gets added explicitly when known).
 */
export const ECON_RELEASES: Array<{ name: string; source: string; rule: { dayOfMonth: number } | { weekday: number } }> = [
  { name: "CPI inflation (YoY)", source: "MOSPI", rule: { dayOfMonth: 12 } },
  { name: "WPI inflation", source: "DPIIT", rule: { dayOfMonth: 14 } },
  { name: "Trade balance", source: "Min. of Commerce", rule: { dayOfMonth: 15 } },
  { name: "IIP — industrial production", source: "MOSPI", rule: { dayOfMonth: 28 } },
  { name: "Manufacturing PMI", source: "HSBC/S&P", rule: { dayOfMonth: 1 } },
  { name: "Services PMI", source: "HSBC/S&P", rule: { dayOfMonth: 3 } },
  { name: "FX reserves (weekly)", source: "RBI", rule: { weekday: 5 } }, // Friday
];

/**
 * Policy rate — curated because no keyless live source exists. Update on
 * MPC decision days (the policy news stream will carry it).
 */
export const POLICY_RATE = { value: 5.25, label: "RBI repo rate", asOf: "2026-08" };
