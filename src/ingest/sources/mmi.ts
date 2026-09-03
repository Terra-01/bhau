import type { Fetcher, SourceResult } from "../types";

// Tickertape's Market Mood Index — the market's fear/greed gauge, archived
// as a daily bar (^MMI) so the pack and the rates panel read the same
// number and mood history accrues for later charting. Moves the MMI
// upstream into the Fetcher pattern (it was a page-side fetch before).

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const mmiFetcher: Fetcher = {
  id: "mmi",
  staleAfterMin: 36 * 60,

  async fetch(): Promise<SourceResult> {
    const res = await fetch("https://api.tickertape.in/mmi/now", { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`tickertape mmi HTTP ${res.status}`);
    const d = (await res.json()) as { data?: { indicator?: number } };
    const value = d.data?.indicator;
    if (typeof value !== "number") throw new Error("tickertape mmi: no indicator in payload");
    return {
      events: [],
      bars: [{ date: todayIST(), symbol: "^MMI", close: Number(value.toFixed(1)), source: "tickertape" }],
    };
  },
};

/** The published zone thresholds (<30 / <50 / <70 / else). */
export function mmiZone(value: number): string {
  return value < 30 ? "Extreme Fear" : value < 50 ? "Fear" : value < 70 ? "Greed" : "Extreme Greed";
}
