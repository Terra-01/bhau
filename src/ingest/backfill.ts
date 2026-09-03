import YahooFinance from "yahoo-finance2";
import { loadEnv } from "@/lib/load-env";
import { ETF_WHITELIST, NIFTY100 } from "@/agents/universe";

loadEnv();

// One-time (rerunnable) history backfill for the tradeable universe: the
// quant sheet in the briefing pack needs 20d/60d/52w context, and the
// bhavcopy archive only reaches back to first ingest. Pulls ~400 calendar
// days of daily bars per symbol from Yahoo and inserts with
// skipDuplicates, so real bhavcopy rows are never overwritten (the PK is
// date+symbol). Rerun after quarterly universe refreshes.
//
//   npx tsx src/ingest/backfill.ts

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const DAYS = 400;
const CONCURRENCY = 4;

const istDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function fetchHistory(symbol: string) {
  const chart = await yf.chart(`${symbol}.NS`, {
    period1: new Date(Date.now() - DAYS * 86_400_000),
    interval: "1d",
  });
  // Exclude today's bar: it may still be forming, and tonight's bhavcopy
  // must land as the official row (skipDuplicates would never replace us).
  const today = istDate(new Date());
  return chart.quotes
    .filter((q) => q.close !== null && q.close !== undefined && istDate(q.date) < today)
    .map((q) => ({
      date: new Date(istDate(q.date)),
      symbol,
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      close: q.close as number,
      volume: q.volume ?? null,
      source: "yahoo",
    }));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[backfill] DATABASE_URL not set — nothing to backfill into");
    process.exit(1);
  }
  const { prisma } = await import("@/lib/db");
  const symbols = [...NIFTY100, ...ETF_WHITELIST];
  let inserted = 0;
  const failed: string[] = [];

  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fetchHistory));
    for (const [j, result] of results.entries()) {
      const symbol = batch[j];
      if (result.status === "rejected") {
        failed.push(symbol);
        console.warn(`[backfill] ${symbol} FAILED — ${result.reason instanceof Error ? result.reason.message : result.reason}`);
        continue;
      }
      const { count } = await prisma.dailyBar.createMany({ data: result.value, skipDuplicates: true });
      inserted += count;
      console.log(`[backfill] ${symbol} — ${result.value.length} bars, ${count} new`);
    }
  }

  console.log(`[backfill] done: ${inserted} rows inserted, ${failed.length} symbols failed${failed.length ? ` (${failed.join(", ")})` : ""}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
