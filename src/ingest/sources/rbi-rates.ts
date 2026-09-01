import { USER_AGENT, type Fetcher, type IngestBar, type SourceResult } from "../types";

// RBI's homepage "Current Rates" widget is the authority's own daily
// snapshot: the policy corridor, T-bill auction cut-offs, and benchmark
// G-sec yields ("as on" the last session). No API — we parse the
// tag-stripped text. Benchmark securities rotate, so G-sec yields are
// stored under conventional tenor buckets (the 2036 bond IS "the 10Y").

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

// "August 31, 2026" → "2026-08-31"
function parseLongDate(raw: string): string | undefined {
  const match = raw.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return undefined;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return undefined;
  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

/** Conventional tenor buckets for the rotating benchmark securities. */
const GSEC_BUCKETS = [2, 3, 5, 10, 15, 30] as const;

export const rbiRatesFetcher: Fetcher = {
  id: "rbi-rates",
  staleAfterMin: 48 * 60,

  async fetch(): Promise<SourceResult> {
    const res = await fetch("https://www.rbi.org.in", {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

    const gsecBlock = text.match(/Government Securities Market(.*?)Capital Market/)?.[1];
    if (!gsecBlock) throw new Error("G-sec block not found on homepage");
    const asOnRaw = gsecBlock.match(/as on ([A-Za-z]+ \d{1,2}, \d{4})/)?.[1];
    const sessionDate = asOnRaw ? parseLongDate(asOnRaw) : undefined;
    if (!sessionDate) throw new Error(`unparseable as-on date: ${asOnRaw}`);
    const sessionYear = Number(sessionDate.slice(0, 4));

    const bars: IngestBar[] = [];
    const push = (symbol: string, close: number) =>
      bars.push({ date: sessionDate, symbol, close, source: "rbi" });

    // Benchmark G-secs: "6.94% GS 2036 : 6.9497% #" → tenor bucket by
    // remaining maturity; on a collision the closer security wins.
    const byBucket = new Map<number, { yield: number; distance: number }>();
    for (const m of gsecBlock.matchAll(/(\d+\.\d+)%\s*GS\s*(\d{4})\s*:\s*(\d+\.\d+)%/g)) {
      const tenor = Number(m[2]) - sessionYear;
      const yld = Number(m[3]);
      let best: number = GSEC_BUCKETS[0];
      for (const b of GSEC_BUCKETS) if (Math.abs(tenor - b) < Math.abs(tenor - best)) best = b;
      const distance = Math.abs(tenor - best);
      const existing = byBucket.get(best);
      if (!existing || distance < existing.distance) byBucket.set(best, { yield: yld, distance });
    }
    for (const [bucket, { yield: yld }] of byBucket) push(`GSEC${bucket}Y`, yld);

    // T-bill cut-offs at the last weekly auction.
    for (const m of gsecBlock.matchAll(/(91|182|364) day T-bills\s*:\s*(\d+\.\d+)%/g)) {
      push(`TBILL${m[1]}D`, Number(m[2]));
    }

    // Policy corridor + reserve ratios (valid on any date; stored under the
    // same session date so the whole snapshot stays coherent).
    const policy: Array<[RegExp, string]> = [
      [/Policy Repo Rate\s*:\s*(\d+\.\d+)%/, "RBIREPO"],
      [/Standing Deposit Facility Rate\s*:\s*(\d+\.\d+)%/, "RBISDF"],
      [/Marginal Standing Facility Rate\s*:\s*(\d+\.\d+)%/, "RBIMSF"],
      [/CRR\s*:\s*(\d+\.\d+)%/, "RBICRR"],
      [/SLR\s*:\s*(\d+\.\d+)%/, "RBISLR"],
    ];
    for (const [re, symbol] of policy) {
      const m = text.match(re);
      if (m) push(symbol, Number(m[1]));
    }

    if (bars.length < 6) throw new Error(`only ${bars.length} rates parsed — page layout changed?`);
    return { events: [], bars };
  },
};
