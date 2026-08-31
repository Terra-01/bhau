// Trading universe (CONCEPT.md §2): NIFTY 100 constituents + ETF whitelist.
// Constituents snapshot from nsearchives ind_nifty100list.csv on 2026-08-31;
// refresh quarterly (index reconstitutions) — a stale entry self-corrects:
// orders in delisted names reject at fill time for lack of price data.

export const NIFTY100 = [
  "ABB", "ADANIENSOL", "ADANIENT", "ADANIGREEN", "ADANIPORTS", "ADANIPOWER", "AMBUJACEM", "APOLLOHOSP",
  "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJAJHLDNG", "BAJFINANCE", "BANKBARODA", "BEL",
  "BHARTIARTL", "BOSCHLTD", "BPCL", "BRITANNIA", "CANBK", "CGPOWER", "CHOLAFIN", "CIPLA",
  "COALINDIA", "CUMMINSIND", "DIVISLAB", "DLF", "DMART", "DRREDDY", "EICHERMOT", "ENRIN",
  "ETERNAL", "GAIL", "GODREJCP", "GRASIM", "HAL", "HCLTECH", "HDFCAMC", "HDFCBANK",
  "HDFCLIFE", "HINDALCO", "HINDUNILVR", "HINDZINC", "HYUNDAI", "ICICIBANK", "INDHOTEL", "INDIGO",
  "INFY", "IOC", "IRFC", "ITC", "JINDALSTEL", "JIOFIN", "JSWSTEEL", "KOTAKBANK",
  "LODHA", "LT", "LTM", "M&M", "MARUTI", "MAXHEALTH", "MAZDOCK", "MOTHERSON",
  "MUTHOOTFIN", "NESTLEIND", "NTPC", "ONGC", "PFC", "PIDILITIND", "PNB", "POWERGRID",
  "RECLTD", "RELIANCE", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SOLARINDS",
  "SUNPHARMA", "TATACAP", "TATACONSUM", "TATAPOWER", "TATASTEEL", "TCS", "TECHM", "TITAN",
  "TMCV", "TMPV", "TORNTPHARM", "TRENT", "TVSMOTOR", "ULTRACEMCO", "UNIONBANK", "UNITDSPR",
  "VBL", "VEDL", "WIPRO", "ZYDUSLIFE",
] as const;

export const ETF_WHITELIST = [
  "NIFTYBEES", "JUNIORBEES", "BANKBEES", "GOLDBEES", "ITBEES",
] as const;

export const UNIVERSE: ReadonlySet<string> = new Set<string>([...NIFTY100, ...ETF_WHITELIST]);
