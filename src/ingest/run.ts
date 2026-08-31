import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "@/lib/load-env";
import { computeRegime } from "@/lib/regime";
import { buildBriefingPack } from "./briefing";
import { amfiFetcher } from "./sources/amfi";
import { bhavcopyFetcher } from "./sources/bhavcopy";
import { fiiDiiFetcher } from "./sources/fii-dii";
import { googleNewsFetcher } from "./sources/google-news";
import { macroRatesFetcher } from "./sources/macro-rates";
import { nseIndicesFetcher } from "./sources/nse-indices";
import { yahooMarketsFetcher } from "./sources/yahoo";
import type { Fetcher, IngestBar, IngestEvent, IngestFlow } from "./types";

loadEnv();

const FETCHERS: Fetcher[] = [
  googleNewsFetcher,
  nseIndicesFetcher,
  bhavcopyFetcher,
  fiiDiiFetcher,
  macroRatesFetcher,
  amfiFetcher,
  yahooMarketsFetcher,
];

interface SourceRun {
  ok: boolean;
  error?: string;
  events: number;
  bars: number;
}

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function persist(
  events: IngestEvent[],
  bars: IngestBar[],
  health: Record<string, SourceRun>,
  packDate: string,
  pack: unknown,
  regime: ReturnType<typeof computeRegime>,
) {
  const { prisma } = await import("@/lib/db");
  type JsonIn = import("@/generated/prisma/client").Prisma.InputJsonValue;
  const now = new Date();

  const inserted = await prisma.event.createMany({
    data: events.map((e) => ({
      ts: e.ts,
      source: e.source,
      kind: e.kind,
      title: e.title,
      url: e.url ?? null,
      entities: e.entities,
      payload: (e.payload ?? undefined) as JsonIn | undefined,
      hash: e.hash,
    })),
    skipDuplicates: true,
  });

  // Bhavcopy is ~2,900 final (immutable) rows — bulk insert with dedup.
  // Everything else is small and may revise intra-series — upsert.
  const [bhavBars, liveBars] = [
    bars.filter((b) => b.source === "bhavcopy"),
    bars.filter((b) => b.source !== "bhavcopy"),
  ];
  if (bhavBars.length > 0) {
    await prisma.dailyBar.createMany({
      data: bhavBars.map((b) => ({
        date: new Date(b.date),
        symbol: b.symbol,
        open: b.open ?? null,
        high: b.high ?? null,
        low: b.low ?? null,
        close: b.close,
        volume: b.volume ?? null,
        source: b.source,
      })),
      skipDuplicates: true,
    });
  }
  for (const bar of liveBars) {
    const data = {
      open: bar.open ?? null,
      high: bar.high ?? null,
      low: bar.low ?? null,
      close: bar.close,
      volume: bar.volume ?? null,
      source: bar.source,
    };
    await prisma.dailyBar.upsert({
      where: { date_symbol: { date: new Date(bar.date), symbol: bar.symbol } },
      update: data,
      create: { date: new Date(bar.date), symbol: bar.symbol, ...data },
    });
  }

  for (const fetcher of FETCHERS) {
    const run = health[fetcher.id];
    await prisma.sourceHealth.upsert({
      where: { id: fetcher.id },
      update: run.ok
        ? { lastSuccessAt: now, staleAfterMin: fetcher.staleAfterMin }
        : { lastErrorAt: now, lastError: run.error, staleAfterMin: fetcher.staleAfterMin },
      create: {
        id: fetcher.id,
        staleAfterMin: fetcher.staleAfterMin,
        ...(run.ok ? { lastSuccessAt: now } : { lastErrorAt: now, lastError: run.error }),
      },
    });
  }

  const date = new Date(packDate);
  if (regime) {
    const components = regime.components as unknown as JsonIn;
    await prisma.regimeSnapshot.upsert({
      where: { date },
      update: { score: regime.score, band: regime.band, components },
      create: { date, score: regime.score, band: regime.band, components },
    });
  }
  const packJson = JSON.parse(JSON.stringify(pack));
  await prisma.briefingPack.upsert({
    where: { date },
    update: { pack: packJson },
    create: { date, pack: packJson },
  });

  console.log(`[db] ${inserted.count} new events, ${bars.length} bars upserted, briefing pack stored for ${packDate}`);
  await prisma.$disconnect();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || !process.env.DATABASE_URL;
  const events: IngestEvent[] = [];
  const bars: IngestBar[] = [];
  const flows: IngestFlow[] = [];
  const health: Record<string, SourceRun> = {};

  for (const fetcher of FETCHERS) {
    try {
      const result = await fetcher.fetch();
      events.push(...result.events);
      bars.push(...result.bars);
      if (result.flows) flows.push(...result.flows);
      health[fetcher.id] = { ok: true, events: result.events.length, bars: result.bars.length };
    } catch (err) {
      health[fetcher.id] = { ok: false, error: err instanceof Error ? err.message : String(err), events: 0, bars: 0 };
    }
  }

  const barsBySymbol: Record<string, IngestBar[]> = {};
  for (const bar of bars) (barsBySymbol[bar.symbol] ??= []).push(bar);
  for (const list of Object.values(barsBySymbol)) list.sort((a, b) => a.date.localeCompare(b.date));

  const regime = computeRegime(barsBySymbol);
  const pack = buildBriefingPack(todayIST(), events, barsBySymbol, regime);
  try {
    const { synthesize } = await import("./synthesize");
    const synthesis = await synthesize(pack);
    if (synthesis) {
      pack.synthesis = synthesis;
      console.log(`[synthesis] ${synthesis.headline}`);
    } else {
      console.log("[synthesis] skipped — OPENAI_KEY not set");
    }
  } catch (err) {
    console.warn(`[synthesis] failed — ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const [id, run] of Object.entries(health)) {
    console.log(
      run.ok
        ? `[${id}] ok — ${run.events} events, ${run.bars} bars`
        : `[${id}] FAILED — ${run.error}`,
    );
  }
  if (regime) {
    const parts = Object.entries(regime.components)
      .map(([k, c]) => `${k}=${c.value} (stress ${c.stress})`)
      .join(", ");
    console.log(`[regime] ${regime.score} · ${regime.band} — ${parts}`);
  } else {
    console.log("[regime] insufficient data");
  }
  console.log(`[pack] ${pack.date} · tradingDay=${pack.tradingDay}`);

  if (flows.length > 0) console.log(`[flows] ${flows.map((f) => `${f.category} net ₹${f.net}Cr`).join(" · ")}`);

  if (dryRun) {
    mkdirSync("data", { recursive: true });
    const out = `data/briefing-${pack.date}.json`;
    writeFileSync(out, JSON.stringify(pack, null, 2));
    console.log(`[dry-run] no database write — briefing pack saved to ${out}`);
  } else {
    await persist(events, bars, health, pack.date, pack, regime);
    if (flows.length > 0) {
      const { prisma } = await import("@/lib/db");
      for (const flow of flows) {
        await prisma.flowDaily.upsert({
          where: { date_category: { date: new Date(flow.date), category: flow.category } },
          update: { buy: flow.buy, sell: flow.sell, net: flow.net },
          create: { date: new Date(flow.date), category: flow.category, buy: flow.buy, sell: flow.sell, net: flow.net },
        });
      }
      console.log(`[db] ${flows.length} flow rows upserted`);
    }
  }

  const failures = Object.values(health).filter((run) => !run.ok).length;
  if (failures === FETCHERS.length) {
    console.error("all sources failed");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
