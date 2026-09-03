import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "@/lib/load-env";
import { computeRegime } from "@/lib/regime";
import { buildBriefingPack } from "./briefing";
import { assembleEvidence, type Evidence } from "./evidence";
import { buildQuant, type QuantSheet } from "./quant";
import { amfiFetcher } from "./sources/amfi";
import { bhavcopyFetcher } from "./sources/bhavcopy";
import { fiiDiiFetcher } from "./sources/fii-dii";
import { fuelCityFetcher } from "./sources/fuel-city";
import { googleNewsFetcher } from "./sources/google-news";
import { ibjaFetcher } from "./sources/ibja";
import { macroRatesFetcher } from "./sources/macro-rates";
import { mmiFetcher } from "./sources/mmi";
import { nseCalendarsFetcher } from "./sources/nse-calendars";
import { nseIndicesFetcher } from "./sources/nse-indices";
import { rbiRatesFetcher } from "./sources/rbi-rates";
import { tvLiveFetcher } from "./sources/tv-live";
import { yahooMarketsFetcher } from "./sources/yahoo";
import type { Fetcher, IngestBar, IngestEvent, IngestFlow } from "./types";

loadEnv();

const FETCHERS: Fetcher[] = [
  googleNewsFetcher,
  nseIndicesFetcher,
  bhavcopyFetcher,
  fiiDiiFetcher,
  nseCalendarsFetcher,
  macroRatesFetcher,
  amfiFetcher,
  yahooMarketsFetcher,
  rbiRatesFetcher,
  ibjaFetcher,
  mmiFetcher,
  fuelCityFetcher,
  tvLiveFetcher,
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
        turnover: b.turnover ?? null,
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
      turnover: bar.turnover ?? null,
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
  const tvStreams: Array<{ channelId: string; videoId: string | null }> = [];
  const health: Record<string, SourceRun> = {};

  for (const fetcher of FETCHERS) {
    try {
      const result = await fetcher.fetch();
      events.push(...result.events);
      bars.push(...result.bars);
      if (result.flows) flows.push(...result.flows);
      if (result.tvStreams) tvStreams.push(...result.tvStreams);
      health[fetcher.id] = { ok: true, events: result.events.length, bars: result.bars.length };
    } catch (err) {
      health[fetcher.id] = { ok: false, error: err instanceof Error ? err.message : String(err), events: 0, bars: 0 };
    }
  }

  const barsBySymbol: Record<string, IngestBar[]> = {};
  for (const bar of bars) (barsBySymbol[bar.symbol] ??= []).push(bar);
  for (const list of Object.values(barsBySymbol)) list.sort((a, b) => a.date.localeCompare(b.date));

  const regime = computeRegime(barsBySymbol);
  // Quant sheet: archive history for the universe (backfilled + rolling
  // bhavcopy) merged with this run's bars. Absent without a DB — the
  // agents are told the sheet can be missing on degraded days.
  let quant: QuantSheet | undefined;
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db");
      const { NIFTY100, ETF_WHITELIST } = await import("@/agents/universe");
      const since = new Date(Date.now() - 450 * 86_400_000);
      const history = await prisma.dailyBar.findMany({
        where: { symbol: { in: [...NIFTY100, ...ETF_WHITELIST, "^NSEI"] }, date: { gte: since } },
        orderBy: { date: "asc" },
        select: { symbol: true, date: true, close: true, high: true, low: true },
      });
      quant = buildQuant(
        history.map((h) => ({ symbol: h.symbol, date: h.date.toISOString().slice(0, 10), close: h.close, high: h.high, low: h.low })),
        barsBySymbol,
        todayIST(),
      );
      console.log(`[quant] ${quant.rows.length} symbols, ${quant.historyDays} sessions of history`);
    } catch (err) {
      console.warn(`[quant] unavailable — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  let evidence: Evidence | undefined;
  if (process.env.DATABASE_URL) {
    try {
      evidence = await assembleEvidence(barsBySymbol, todayIST(), { flows, events });
      console.log(`[evidence] sections: ${Object.keys(evidence).join(", ") || "(none)"}`);
    } catch (err) {
      console.warn(`[evidence] unavailable — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const pack = buildBriefingPack(todayIST(), events, barsBySymbol, regime, quant, evidence);
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
    // TV ids are a convenience, not archive data — last, and never allowed
    // to take real persistence down with them.
    if (tvStreams.length > 0) {
      try {
        const { prisma } = await import("@/lib/db");
        const now = new Date();
        await prisma.$transaction(
          tvStreams.map((stream) =>
            prisma.tvStream.upsert({
              where: { channelId: stream.channelId },
              update: { videoId: stream.videoId, checkedAt: now },
              create: { channelId: stream.channelId, videoId: stream.videoId, checkedAt: now },
            }),
          ),
        );
        console.log(`[db] ${tvStreams.length} tv streams upserted`);
      } catch (err) {
        console.warn(`[tv-live] persist failed — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // tv-live is an auxiliary resolver — its success must not mask a night
  // where every real data source failed.
  const dataIds = Object.keys(health).filter((id) => id !== "tv-live");
  if (dataIds.length > 0 && dataIds.every((id) => !health[id].ok)) {
    console.error("all sources failed");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
