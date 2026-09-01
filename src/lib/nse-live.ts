import { parseNseDate } from "@/ingest/sources/nse-indices";
import { USER_AGENT } from "@/ingest/types";
import { phaseAt, type MarketPhase } from "./market-clock";

// Server-side NSE client for the live layer: one warmed cookie jar per
// process (reused ~10 min), a single re-warm on rejection, and the
// trading-holiday lookup that completes the market clock. Callers treat
// any throw as "fall down the ladder" (Yahoo → last-good → EOD render).

const HEADERS = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

let jar: { cookies: string; at: number } | null = null;
const JAR_TTL = 10 * 60 * 1000;

async function warmup(force = false): Promise<string> {
  if (!force && jar && Date.now() - jar.at < JAR_TTL) return jar.cookies;
  const res = await fetch("https://www.nseindia.com", { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  jar = { cookies, at: Date.now() };
  return cookies;
}

export async function nseJson<T>(path: string): Promise<T> {
  const attempt = async (force: boolean) => {
    const cookies = await warmup(force);
    const res = await fetch(`https://www.nseindia.com${path}`, {
      headers: { ...HEADERS, cookie: cookies, referer: "https://www.nseindia.com/" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`NSE ${res.status} on ${path}`);
    return (await res.json()) as T;
  };
  try {
    return await attempt(false);
  } catch {
    return attempt(true); // stale jar is the common failure — one re-warm
  }
}

// --- trading holidays (CM segment), cached for a day; weekday-only
// fallback keeps the clock working when NSE is unreachable.
let holidays: { dates: Set<string>; at: number } | null = null;

async function holidaySet(): Promise<Set<string>> {
  if (holidays && Date.now() - holidays.at < 24 * 60 * 60 * 1000) return holidays.dates;
  try {
    const data = await nseJson<{ CM?: Array<{ tradingDate?: string }> }>("/api/holiday-master?type=trading");
    const dates = new Set<string>();
    for (const row of data.CM ?? []) {
      const iso = row.tradingDate ? parseNseDate(row.tradingDate) : undefined;
      if (iso) dates.add(iso);
    }
    if (dates.size > 0) holidays = { dates, at: Date.now() };
    return holidays?.dates ?? dates;
  } catch {
    return holidays?.dates ?? new Set();
  }
}

/** Current session phase, holiday-aware (server only). */
export async function currentPhase(): Promise<MarketPhase> {
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dates = await holidaySet();
  return phaseAt(new Date(), dates.has(todayIST));
}
