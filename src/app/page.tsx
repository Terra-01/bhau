import { AppHeader } from "@/components/bento/app-header";
import { CalendarPanel } from "@/components/bento/calendar-panel";
import { CommoditiesPanel } from "@/components/bento/commodities-panel";
import { EtfPanel } from "@/components/bento/etf-panel";
import { FunCorner } from "@/components/bento/fun-corner";
import { MoversPanel } from "@/components/bento/movers-panel";
import { RatesPanel } from "@/components/bento/rates-panel";
import { WatchlistPanel } from "@/components/bento/watchlist-panel";
import { WhatMattersPanel } from "@/components/bento/what-matters-panel";
import { ForexRates } from "@/components/exchange/forex-rates";
import { FooterTicker } from "@/components/footer-ticker";
import { CityTile } from "@/components/tiles/city-tile";
import { FloorTile } from "@/components/tiles/floor-tile";
import { TvTile } from "@/components/tiles/tv-tile";
import { ViewportFit } from "@/components/viewport-fit";
import { getExchangeData } from "@/lib/exchange";
import { getRatesData } from "@/lib/rates";
import { getWarRoomData } from "@/lib/warroom";

export const revalidate = 300; // data changes once per trading day

// The terminal: the screen IS the workspace — one composition at every
// size. ≥1280px the grid breathes fluidly; below, ViewportFit scales the
// whole 1280×860 board down. The document never scrolls.
export default async function Feed() {
  // The build must never require the database (Vercel's builder may not
  // reach Neon); a failed fetch renders the fallback and the first ISR
  // revalidation at runtime replaces it. Sources settle independently so
  // one hiccup degrades one panel instead of blanking the board.
  const [d, e, r] = await Promise.allSettled([getWarRoomData(), getExchangeData(), getRatesData()]);
  for (const s of [d, e, r]) {
    if (s.status === "rejected")
      console.error("[page] data source failed:", s.reason instanceof Error ? s.reason.message : s.reason);
  }
  const data = d.status === "fulfilled" ? d.value : null;
  const exchange = e.status === "fulfilled" ? e.value : null;
  const rates = r.status === "fulfilled" ? r.value : null;

  if (!data || !exchange) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
        <h1 className="text-[22px] font-medium tracking-tight text-ink">Bhau</h1>
        <p className="text-[14px] text-steel">The war room is warming up — no briefing pack reachable right now.</p>
        <code className="font-mono text-[12px] text-fog">npm run ingest · retrying automatically</code>
      </main>
    );
  }

  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  return (
    <ViewportFit>
    <div className="flex h-full w-full flex-col overflow-hidden px-2 pb-1">
      <AppHeader data={data} />

      <main className="mt-1 grid min-h-0 flex-1 grid-cols-[minmax(0,4fr)_minmax(0,4.5fr)_minmax(0,3.5fr)] gap-1">
        {/* Left stack — watchlist · rates & macro · off the tape */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="tile-in min-h-0 flex-[1.42]">
            <WatchlistPanel />
          </div>
          <div className="tile-in min-h-0 flex-[0.82]" style={{ animationDelay: "120ms" }}>
            <RatesPanel rates={rates} />
          </div>
          <div className="tile-in min-h-0 flex-[0.6]" style={{ animationDelay: "240ms" }}>
            <FunCorner songs={data.songs} mood={data.songMood} baskets={exchange.funBaskets} />
          </div>
        </div>

        {/* Center stack — stocks · etfs · agents vs nifty (hero) · intelligence */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="tile-in min-h-0 flex-[0.78]" style={{ animationDelay: "40ms" }}>
            <MoversPanel data={exchange} sectors={data.sectors} />
          </div>
          <div className="tile-in min-h-0 flex-[0.62]" style={{ animationDelay: "100ms" }}>
            <EtfPanel etfs={exchange.etfs} asOf={exchange.asOf} />
          </div>
          <div className="tile-in min-h-0 flex-[1.03]" style={{ animationDelay: "160ms" }}>
            <FloorTile floor={data.floor} race={data.race} />
          </div>
          <div className="tile-in min-h-0 flex-[1.0]" style={{ animationDelay: "280ms" }}>
            <WhatMattersPanel synthesis={data.synthesis} news={data.news} flows={data.flows} fiiStreak={data.fiiStreak} />
          </div>
        </div>

        {/* Right stack — (city pulse | forex) · calendar · commodities · live TV */}
        <div className="flex min-h-0 flex-col gap-1">
          {/* Fixed height: the city tabs must not re-flow the rail below */}
          <div className="tile-in grid h-[198px] shrink-0 grid-cols-2 gap-1" style={{ animationDelay: "80ms" }}>
            <CityTile weather={data.weather} pulse={data.cityPulse} />
            <ForexRates forex={exchange.forex} />
          </div>
          <div className="tile-in min-h-0 flex-[0.8]" style={{ animationDelay: "200ms" }}>
            <CalendarPanel data={exchange} todayIso={todayIso} />
          </div>
          <div className="tile-in min-h-0 shrink-0" style={{ animationDelay: "320ms" }}>
            <CommoditiesPanel items={data.commodities} />
          </div>
          <div className="tile-in min-h-0 flex-[1.2]" style={{ animationDelay: "360ms" }}>
            <TvTile />
          </div>
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-3 pt-1 font-mono text-[9px] tracking-wide text-silver">
        <FooterTicker />
        <span className="shrink-0">EVERY DECISION ON A PUBLIC HASH-CHAINED LEDGER</span>
      </footer>
    </div>
    </ViewportFit>
  );
}
