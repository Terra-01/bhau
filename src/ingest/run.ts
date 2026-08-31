import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "@/lib/load-env";
import { computeRegime } from "@/lib/regime";
import { buildBriefingPack } from "./briefing";
import { amfiFetcher } from "./sources/amfi";
import { googleNewsFetcher } from "./sources/google-news";
import { macroRatesFetcher } from "./sources/macro-rates";
import { nseIndicesFetcher } from "./sources/nse-indices";
import { yahooMarketsFetcher } from "./sources/yahoo";
import type { Fetcher, IngestBar, IngestEvent } from "./types";

loadEnv();

const FETCHERS: Fetcher[] = [
  googleNewsFetcher,
  nseIndicesFetcher,
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

  for (const bar of bars) {
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
  const health: Record<string, SourceRun> = {};

  for (const fetcher of FETCHERS) {
    try {
      const result = await fetcher.fetch();
      events.push(...result.events);
      bars.push(...result.bars);
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

  if (dryRun) {
    mkdirSync("data", { recursive: true });
    const out = `data/briefing-${pack.date}.json`;
    writeFileSync(out, JSON.stringify(pack, null, 2));
    console.log(`[dry-run] no database write — briefing pack saved to ${out}`);
  } else {
    await persist(events, bars, health, pack.date, pack, regime);
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
