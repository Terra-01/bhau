import type { ReactNode } from "react";
import { FloorPanel } from "@/components/floor-panel";
import { FlowsPanel } from "@/components/flows-panel";
import { HeatmapPanel } from "@/components/heatmap-panel";
import { MarketStrip } from "@/components/market-strip";
import { NewsPanel } from "@/components/news-panel";
import { RegimePanel } from "@/components/regime-panel";
import { TvPanel } from "@/components/tv-panel";
import { WAR_ROOM_PANELS } from "@/config/panels";
import { getWarRoomData, type WarRoomData } from "@/lib/warroom";

export const revalidate = 300; // data changes once per trading day

const REGIME_COLOR: Record<string, string> = {
  Calm: "var(--color-regime-calm)",
  Steady: "var(--color-regime-steady)",
  Watchful: "var(--color-regime-watchful)",
  Strained: "var(--color-regime-strained)",
  Stressed: "var(--color-regime-stressed)",
};

function renderPanel(id: string, data: WarRoomData): ReactNode {
  switch (id) {
    case "floor":
      return <FloorPanel floor={data.floor} />;
    case "regime":
      return <RegimePanel regime={data.regime} />;
    case "flows":
      return <FlowsPanel flows={data.flows} />;
    case "sectors":
      return <HeatmapPanel sectors={data.sectors} />;
    case "tv":
      return <TvPanel />;
    case "news-markets":
      return <NewsPanel title="Markets" items={data.news.markets ?? []} />;
    case "news-policy":
      return (
        <NewsPanel
          title="Policy & macro"
          meta="RBI · SEBI · MOSPI"
          items={[...(data.news.policy ?? []), ...(data.news.economy ?? [])].slice(0, 10)}
        />
      );
    case "news-corporate":
      return <NewsPanel title="Corporate" items={data.news.corporate ?? []} />;
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

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 pb-10 sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-charcoal py-4">
        <h1 className="text-[21px] font-medium tracking-tight text-ink">Bhau</h1>
        <span className="text-[12.5px] text-fog">the Indian market war room</span>
        <span className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[11px] text-fog">
          <span>
            EDITION {data.packDate} · {data.tradingDay ? "TRADING DAY" : "AWAITING SESSION"}
          </span>
          {data.regime && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ash px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: REGIME_COLOR[data.regime.band] }} />
              REGIME {data.regime.score.toFixed(1)} · {data.regime.band.toUpperCase()}
            </span>
          )}
        </span>
      </header>

      <main className="flex flex-col gap-2 pt-3">
        <MarketStrip items={data.strip} />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {WAR_ROOM_PANELS.filter((p) => p.enabled)
            .sort((a, b) => a.order - b.order)
            .map((panel) => (
              <div key={panel.id} className={panel.span === 2 ? "md:col-span-2" : panel.span === 3 ? "md:col-span-2 xl:col-span-3" : ""}>
                {renderPanel(panel.id, data)}
              </div>
            ))}
        </div>
      </main>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-ash pt-3 font-mono text-[10.5px] tracking-wide text-fog">
        <span>BHAU · PAPER CAPITAL ONLY · NOT INVESTMENT ADVICE</span>
        <span>
          DATA DELAYED / EOD
          {unhealthy.length > 0 ? ` · ${unhealthy.length} SOURCE${unhealthy.length > 1 ? "S" : ""} DEGRADED` : " · ALL SOURCES HEALTHY"}
        </span>
      </footer>
    </div>
  );
}
