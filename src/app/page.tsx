import { AppHeader } from "@/components/bento/app-header";
import { CalendarPanel } from "@/components/bento/calendar-panel";
import { CommoditiesPanel } from "@/components/bento/commodities-panel";
import { FunCorner } from "@/components/bento/fun-corner";
import { MoversPanel } from "@/components/bento/movers-panel";
import { WatchlistPanel } from "@/components/bento/watchlist-panel";
import { WhatMattersPanel } from "@/components/bento/what-matters-panel";
import { WorldView } from "@/components/bento/world-view";
import { ForexMatrix } from "@/components/exchange/forex-matrix";
import { Fresh } from "@/components/exchange/section";
import { FloorTile } from "@/components/tiles/floor-tile";
import { TvTile } from "@/components/tiles/tv-tile";
import { WeatherTile } from "@/components/tiles/weather-tile";
import { getExchangeData } from "@/lib/exchange";
import { getWarRoomData } from "@/lib/warroom";

export const revalidate = 300; // data changes once per trading day

// The v1.1 feed — the mockup's bento: fewer, larger, deeper panels.
export default async function Feed() {
  const [data, exchange] = await Promise.all([getWarRoomData(), getExchangeData()]);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
        <h1 className="text-[22px] font-medium tracking-tight text-ink">Bhau</h1>
        <p className="text-[14px] text-steel">The war room is empty — the ingestion pipeline hasn&apos;t produced a briefing pack yet.</p>
        <code className="font-mono text-[12px] text-fog">npm run ingest</code>
      </main>
    );
  }

  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const pinnedQuotes = data.strip
    .filter((s) => s.symbol === "^NSEI" || s.symbol === "^BSESN")
    .map((s) => ({ symbol: s.symbol, close: s.close, changePct: s.change1dPct }));

  return (
    <div className="flex w-full flex-1 flex-col px-3 pb-2">
      <AppHeader data={data} />

      <main className="mt-1.5 flex flex-col gap-1.5">
        {/* Row 1 — watchlist hero · stocks · weather + floor */}
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:h-[480px] xl:grid-cols-12">
          <div className="h-[420px] md:h-auto xl:col-span-5">
            <WatchlistPanel pinnedQuotes={pinnedQuotes} />
          </div>
          <div className="h-[420px] md:h-auto xl:col-span-4">
            <MoversPanel data={exchange} />
          </div>
          <div className="flex min-h-0 flex-col gap-1.5 md:col-span-2 xl:col-span-3">
            <div className="h-[170px] shrink-0">
              <WeatherTile weather={data.weather} />
            </div>
            <div className="min-h-[280px] flex-1">
              <FloorTile floor={data.floor} race={data.race} />
            </div>
          </div>
        </div>

        {/* Row 2 — world view · calendar · commodities */}
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:h-[360px] xl:grid-cols-12">
          <div className="h-[340px] md:h-auto xl:col-span-5">
            <WorldView />
          </div>
          <div className="h-[340px] md:h-auto xl:col-span-4">
            <CalendarPanel data={exchange} todayIso={todayIso} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <CommoditiesPanel items={data.commodities} />
          </div>
        </div>

        {/* Row 3 — fun corner · intelligence + forex · live TV */}
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-12">
          <div className="h-[360px] md:h-auto xl:col-span-3">
            <FunCorner songs={data.songs} baskets={exchange.funBaskets} />
          </div>
          <div className="flex flex-col gap-1.5 xl:col-span-6">
            <div className="h-[360px]">
              <WhatMattersPanel synthesis={data.synthesis} news={data.news} flows={data.flows} fiiStreak={data.fiiStreak} />
            </div>
            <div>
              <div className="mb-1 flex items-baseline gap-2 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">Forex vs INR</span>
                <Fresh label="ECB REFERENCE · DAILY" />
              </div>
              <ForexMatrix forex={exchange.forex} />
            </div>
          </div>
          <div className="h-[420px] md:col-span-2 md:h-[360px] xl:col-span-3 xl:h-auto">
            <TvTile />
          </div>
        </div>
      </main>

      <footer className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ash pt-2 font-mono text-[9.5px] tracking-wide text-silver">
        <span>BHAU · PAPER CAPITAL ONLY · NOT INVESTMENT ADVICE</span>
        <span>DATA DELAYED / EOD · EVERY DECISION ON A PUBLIC HASH-CHAINED LEDGER</span>
      </footer>
    </div>
  );
}
