import type { CSSProperties, ReactNode } from "react";
import { WatchlistMarquee } from "@/components/watchlist-marquee";
import { BriefTile } from "@/components/tiles/brief-tile";
import { CandlesTile } from "@/components/tiles/candles-tile";
import { CommoditiesTile } from "@/components/tiles/commodities-tile";
import { FloorTile } from "@/components/tiles/floor-tile";
import { FlowsTile } from "@/components/tiles/flows-tile";
import { MoversTile } from "@/components/tiles/movers-tile";
import { NewsTile } from "@/components/tiles/news-tile";
import { RegimeTile } from "@/components/tiles/regime-tile";
import { SectorsTile } from "@/components/tiles/sectors-tile";
import { SongTile } from "@/components/tiles/song-tile";
import { Ticker } from "@/components/tiles/ticker";
import { TvTile } from "@/components/tiles/tv-tile";
import { WeatherTile } from "@/components/tiles/weather-tile";
import { WAR_ROOM_TILES } from "@/config/panels";
import { getWarRoomData, type WarRoomData } from "@/lib/warroom";

export const revalidate = 300; // data changes once per trading day

const REGIME_COLOR: Record<string, string> = {
  Calm: "var(--color-regime-calm)",
  Steady: "var(--color-regime-steady)",
  Watchful: "var(--color-regime-watchful)",
  Strained: "var(--color-regime-strained)",
  Stressed: "var(--color-regime-stressed)",
};

function renderTile(id: string, data: WarRoomData): ReactNode {
  switch (id) {
    case "floor":
      return <FloorTile floor={data.floor} race={data.race} />;
    case "brief":
      return <BriefTile synthesis={data.synthesis} />;
    case "news":
      return <NewsTile news={data.news} />;
    case "candles":
      return <CandlesTile candles={data.candles} />;
    case "sectors":
      return <SectorsTile sectors={data.sectors} />;
    case "commodities":
      return <CommoditiesTile items={data.commodities} />;
    case "weather":
      return <WeatherTile weather={data.weather} />;
    case "song":
      return <SongTile songs={data.songs} />;
    case "regime":
      return <RegimeTile regime={data.regime} trend={data.regimeTrend} />;
    case "flows":
      return <FlowsTile flows={data.flows} streak={data.fiiStreak} />;
    case "movers":
      return <MoversTile movers={data.movers} />;
    case "tv":
      return <TvTile />;
    default:
      return null;
  }
}

export default async function WarRoom() {
  const data = await getWarRoomData();

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
        <h1 className="text-[22px] font-medium tracking-tight text-ink">Bhau</h1>
        <p className="text-[14px] text-steel">The war room is empty — the ingestion pipeline hasn&apos;t produced a briefing pack yet.</p>
        <code className="font-mono text-[12px] text-fog">npm run ingest</code>
      </main>
    );
  }

  const unhealthy = data.health.filter((h) => !h.healthy);
  const tiles = WAR_ROOM_TILES.filter((t) => t.enabled).sort((a, b) => a.order - b.order);

  return (
    <div className="war-room-shell flex w-full flex-1 flex-col px-3 pb-2">
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-charcoal py-2">
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">Bhau</h1>
        <span className="text-[11px] text-fog">the Indian market war room</span>
        <span className="ml-auto flex flex-wrap items-center gap-2.5 font-mono text-[10px] text-fog">
          <span>
            EDITION {data.packDate} · {data.tradingDay ? "TRADING DAY" : "AWAITING SESSION"}
          </span>
          {data.regime && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ash px-2 py-px">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: REGIME_COLOR[data.regime.band] }} />
              REGIME {data.regime.score.toFixed(1)}
              {data.regimeTrend.delta !== undefined && (
                <span className="text-silver">Δ{data.regimeTrend.delta > 0 ? "+" : ""}{data.regimeTrend.delta}</span>
              )}
              · {data.regime.band.toUpperCase()}
            </span>
          )}
          <span className={unhealthy.length > 0 ? "text-warn" : "text-silver"}>
            {unhealthy.length > 0 ? `${unhealthy.length} SRC DEGRADED` : "SOURCES OK"}
          </span>
        </span>
      </header>

      <div className="flex shrink-0 flex-col gap-1.5 pt-1.5">
        <Ticker items={data.strip} />
        <WatchlistMarquee />
      </div>

      <main className="mt-1.5 grid min-h-0 flex-1 grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-12 xl:grid-rows-4">
        {tiles.map((tile) => {
          const [colStart, colSpan, rowStart, rowSpan] = tile.grid;
          const style: CSSProperties = {
            ["--tile-col" as string]: `${colStart} / span ${colSpan}`,
            ["--tile-row" as string]: `${rowStart} / span ${rowSpan}`,
          };
          return (
            <div
              key={tile.id}
              style={style}
              className={`min-h-0 ${tile.flowHeight} xl:[grid-column:var(--tile-col)] xl:[grid-row:var(--tile-row)]`}
            >
              {renderTile(tile.id, data)}
            </div>
          );
        })}
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 pt-1.5 font-mono text-[9.5px] tracking-wide text-silver">
        <span>BHAU · PAPER CAPITAL ONLY · NOT INVESTMENT ADVICE</span>
        <span>DATA DELAYED / EOD · EVERY DECISION ON A PUBLIC HASH-CHAINED LEDGER</span>
      </footer>
    </div>
  );
}
