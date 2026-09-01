import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// Metro pump prices (state taxes make these genuinely city-level, unlike
// bullion). OMCs revise at 06:00 IST daily — usually by ₹0.00 for months,
// which is itself the story. Scraped from goodreturns' city tables.

/** Page label → our city key (matches the weather cities). */
const CITY_MAP: Record<string, string> = {
  "New Delhi": "DELHI",
  Mumbai: "MUMBAI",
  Kolkata: "KOLKATA",
  Chennai: "CHENNAI",
  Bangalore: "BENGALURU",
  Hyderabad: "HYDERABAD",
};

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function fetchFuelPage(url: string, prefix: string, date: string): Promise<IngestBar[]> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const html = await res.text();
  const bars: IngestBar[] = [];
  const seen = new Set<string>();
  // <td><a ... title="Chennai">Chennai</a></td> <td> &#x20b9;107.77 </td>
  for (const m of html.matchAll(/title="([^"]+)">[^<]*<\/a><\/td>\s*<td>\s*&#x20b9;([\d.]+)/g)) {
    const city = CITY_MAP[m[1]];
    if (!city || seen.has(city)) continue;
    seen.add(city);
    bars.push({ date, symbol: `${prefix}:${city}`, close: Number(m[2]), source: "goodreturns" });
  }
  if (bars.length < 4) throw new Error(`only ${bars.length} cities parsed from ${url} — layout changed?`);
  return bars;
}

export const fuelCityFetcher: Fetcher = {
  id: "fuel-city",
  staleAfterMin: 48 * 60,

  async fetch(): Promise<SourceResult> {
    const date = todayIST();
    const [petrol, diesel] = await Promise.all([
      fetchFuelPage("https://www.goodreturns.in/petrol-price.html", "PETROL", date),
      fetchFuelPage("https://www.goodreturns.in/diesel-price.html", "DIESEL", date),
    ]);
    return { events: [], bars: [...petrol, ...diesel] };
  },
};
