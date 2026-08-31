import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// Boring, keyless, reliable: ECB reference rates via Frankfurter for
// USD/INR, and FRED CSV downloads for Brent spot and the US 10Y yield.
// A day or two of publication lag is fine at daily cadence.

const daysAgoISO = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function fetchFrankfurterUsdInr(): Promise<IngestBar[]> {
  const url = `https://api.frankfurter.app/${daysAgoISO(20)}..?from=USD&to=INR`;
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, { INR?: number }> };
  return Object.entries(data.rates ?? {}).flatMap(([date, rate]) =>
    typeof rate.INR === "number"
      ? [{ date, symbol: "USDINR", close: rate.INR, source: "frankfurter" }]
      : [],
  );
}

// FRED is slow from datacenter IPs (observed timeouts on GitHub runners):
// generous timeout plus one retry.
async function fetchFredSeries(seriesId: string, symbol: string, attempt = 0): Promise<IngestBar[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${daysAgoISO(30)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/csv" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (attempt < 1) return fetchFredSeries(seriesId, symbol, attempt + 1);
    throw err;
  }
  if (!res.ok) throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  const lines = (await res.text()).trim().split("\n").slice(1); // drop header
  const bars: IngestBar[] = [];
  for (const line of lines) {
    const [date, value] = line.split(",");
    const close = Number(value);
    if (!date || Number.isNaN(close)) continue; // FRED marks holidays "."
    bars.push({ date, symbol, close, source: "fred" });
  }
  return bars;
}

export const macroRatesFetcher: Fetcher = {
  id: "macro-rates",
  staleAfterMin: 48 * 60,

  async fetch(): Promise<SourceResult> {
    const bars: IngestBar[] = [];
    const failures: string[] = [];
    const jobs: Array<[string, () => Promise<IngestBar[]>]> = [
      ["frankfurter USDINR", fetchFrankfurterUsdInr],
      ["fred BRENT-SPOT", () => fetchFredSeries("DCOILBRENTEU", "BRENT-SPOT")],
      ["fred US10Y", () => fetchFredSeries("DGS10", "US10Y")],
    ];
    for (const [label, job] of jobs) {
      try {
        bars.push(...(await job()));
      } catch (err) {
        failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (bars.length === 0 && failures.length > 0) {
      throw new Error(`all upstreams failed — ${failures.join("; ")}`);
    }
    if (failures.length > 0) {
      console.warn(`[macro-rates] partial failure: ${failures.join("; ")}`);
    }
    return { events: [], bars };
  },
};
