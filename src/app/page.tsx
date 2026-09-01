import { AppHeader } from "@/components/bento/app-header";
import { CalendarPanel } from "@/components/bento/calendar-panel";
import { CommoditiesPanel } from "@/components/bento/commodities-panel";
import { FunCorner } from "@/components/bento/fun-corner";
import { MoversPanel } from "@/components/bento/movers-panel";
import { WatchlistPanel } from "@/components/bento/watchlist-panel";
import { WhatMattersPanel } from "@/components/bento/what-matters-panel";
import { WorldView } from "@/components/bento/world-view";
import { ForexMatrix } from "@/components/exchange/forex-matrix";
import { FloorTile } from "@/components/tiles/floor-tile";
import { TvTile } from "@/components/tiles/tv-tile";
import { WeatherTile } from "@/components/tiles/weather-tile";
import { getExchangeData } from "@/lib/exchange";
import { getWarRoomData } from "@/lib/warroom";

export const revalidate = 300; // data changes once per trading day

// The v1.1 terminal: on desktop the screen IS the workspace — the working
// area (viewport − header − footer) is distributed across three column
// stacks; the document never scrolls at xl. Below xl it flows normally.
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
    <div className="flex w-full flex-1 flex-col px-2 pb-1 xl:h-dvh xl:overflow-hidden">
      <AppHeader data={data} />

      <main className="mt-1 grid min-h-0 flex-1 grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
        {/* Left stack — watchlist · world view · off the tape */}
        <div className="flex min-h-0 flex-col gap-1 md:col-span-2 xl:col-span-1">
          <div className="max-xl:h-[420px] min-h-0 xl:h-auto xl:flex-[1.1]">
            <WatchlistPanel pinnedQuotes={pinnedQuotes} />
          </div>
          <div className="max-xl:h-[360px] min-h-0 xl:h-auto xl:flex-1">
            <WorldView />
          </div>
          <div className="max-xl:h-[240px] min-h-0 xl:h-auto xl:flex-[0.55]">
            <FunCorner songs={data.songs} baskets={exchange.funBaskets} />
          </div>
        </div>

        {/* Center stack — stocks · calendar · forex · intelligence */}
        <div className="flex min-h-0 flex-col gap-1 xl:col-span-1">
          <div className="max-xl:h-[420px] min-h-0 xl:h-auto xl:flex-[1.1]">
            <MoversPanel data={exchange} />
          </div>
          <div className="max-xl:h-[300px] min-h-0 xl:h-auto xl:flex-[0.8]">
            <CalendarPanel data={exchange} todayIso={todayIso} />
          </div>
          <div className="min-h-0 shrink-0">
            <ForexMatrix forex={exchange.forex} />
          </div>
          <div className="max-xl:h-[360px] min-h-0 xl:h-auto xl:flex-[1.05]">
            <WhatMattersPanel synthesis={data.synthesis} news={data.news} flows={data.flows} fiiStreak={data.fiiStreak} />
          </div>
        </div>

        {/* Right stack — weather · floor · commodities · live TV */}
        <div className="flex min-h-0 flex-col gap-1 xl:col-span-1">
          <div className="shrink-0">
            <WeatherTile weather={data.weather} />
          </div>
          <div className="max-xl:h-[300px] min-h-0 xl:h-auto xl:flex-1">
            <FloorTile floor={data.floor} race={data.race} />
          </div>
          <div className="min-h-0 shrink-0">
            <CommoditiesPanel items={data.commodities} />
          </div>
          <div className="max-xl:h-[360px] min-h-0 xl:h-auto xl:flex-1">
            <TvTile />
          </div>
        </div>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[9px] tracking-wide text-silver">
        <span>BHAU · PAPER CAPITAL ONLY · NOT INVESTMENT ADVICE</span>
        <span>DATA DELAYED / EOD · EVERY DECISION ON A PUBLIC HASH-CHAINED LEDGER</span>
      </footer>
    </div>
  );
}
