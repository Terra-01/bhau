"use client";

import type { LiveMovers } from "@/app/api/live/movers/route";
import { InsightLine } from "@/components/insight-line";
import { LiveChip } from "@/components/live-chip";
import { FlipView } from "@/components/motion/flip-view";
import type { ExchangeData, StockRow } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { compactInr } from "@/lib/heat";
import { useCarousel } from "@/lib/use-carousel";
import { useLive } from "@/lib/use-live";
import type { WarRoomData } from "@/lib/warroom";
import { Tile } from "../tiles/tile";

const TABS = [
  { id: "mostTraded", label: "Most traded" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
] as const;

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Pill({ pct }: { pct: number }) {
  return (
    <span className="rounded-[6px] px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums text-white" style={{ background: pct >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}>
      {signedPct(pct)}
    </span>
  );
}

export function MoversPanel({
  data,
  sectors,
}: {
  data: Pick<ExchangeData, "mostTraded" | "gainers" | "losers" | "etfs" | "asOf">;
  sectors: WarRoomData["sectors"];
}) {
  const { index, select, pauseProps } = useCarousel(TABS.length, 14_000);
  const tab = TABS[index].id;
  // Intraday: NSE's live lists take over; after close the full-universe
  // bhavcopy ranking (with its liquidity floor) is the better product.
  const live = useLive<LiveMovers>("/api/live/movers", { openMs: 30_000, closedMs: 600_000 });
  const liveOn = live !== null && live.phase !== "closed" && live[tab].length > 0;
  const rows: StockRow[] = liveOn ? live[tab] : (data[tab] ?? []);
  const lead = sectors[0];
  const lag = sectors.at(-1);

  return (
    <Tile
      title="Stocks"
      meta={
        <span className="flex gap-1">
          {TABS.map(({ id, label }, i) => (
            <button
              key={id}
              type="button"
              onClick={() => select(i)}
              className={`rounded-full px-2 py-px font-sans text-[9.5px] font-semibold transition-colors duration-150 ${
                tab === id ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col" {...pauseProps}>
        <FlipView id={tab} className="flex-1">
        <ul className="h-full overflow-y-auto">
          {rows.map((row) => (
            <li key={row.symbol} className="flex items-baseline gap-2 border-b border-ash px-2.5 py-[3px]">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-charcoal">{row.symbol}</span>
              {tab === "mostTraded" && <span className="font-mono text-[9.5px] tabular-nums text-silver">{compactInr(row.turnover)}</span>}
              <span className="font-mono text-[11px] tabular-nums text-ink">₹{fmt.format(row.close)}</span>
              {tab === "mostTraded" ? (
                <span className={`w-14 text-right font-mono text-[10px] tabular-nums ${deltaClass(row.changePct)}`}>{signedPct(row.changePct)}</span>
              ) : (
                <Pill pct={row.changePct} />
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="px-2.5 py-3 text-[11px] text-fog">Accumulating sessions…</li>}
        </ul>
        </FlipView>

        {data.etfs.length > 0 && (
          <div className="shrink-0 border-t border-ash">
            <div className="flex items-baseline justify-between bg-paper/70 px-2.5 py-px">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">ETFs</span>
              <span className="font-mono text-[8px] uppercase text-silver">By turnover</span>
            </div>
            <ul>
              {data.etfs.map((etf) => (
                <li key={etf.symbol} className="flex items-baseline gap-2 border-b border-ash px-2.5 py-[2.5px] last:border-b-0">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-medium text-charcoal">{etf.symbol}</span>
                  <span className="font-mono text-[9px] tabular-nums text-silver">{compactInr(etf.turnover)}</span>
                  <span className="font-mono text-[10.5px] tabular-nums text-ink">₹{fmt.format(etf.close)}</span>
                  <span className={`w-14 text-right font-mono text-[9.5px] tabular-nums ${deltaClass(etf.changePct)}`}>{signedPct(etf.changePct)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <InsightLine meta={liveOn ? <LiveChip phase={live!.phase} source="nse" /> : `EOD · ${data.asOf.slice(5).replace("-", "/")}`}>
          {lead && lag ? (
            <>
              Sectors: {lead.sector} <span className={deltaClass(lead.avgChangePct)}>{signedPct(lead.avgChangePct, 1)}</span> leads ·{" "}
              {lag.sector} <span className={deltaClass(lag.avgChangePct)}>{signedPct(lag.avgChangePct, 1)}</span> lags
            </>
          ) : (
            "Full NSE universe, ranked from the daily bhavcopy"
          )}
        </InsightLine>
      </div>
    </Tile>
  );
}
