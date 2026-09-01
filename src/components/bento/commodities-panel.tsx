"use client";

import { Flame } from "lucide-react";
import { useState } from "react";
import type { LiveMarket } from "@/app/api/live/market/route";
import { AssetCard } from "@/components/asset-card";
import { RowPopover } from "@/components/row-popover";
import { InsightLine } from "@/components/insight-line";
import { LiveChip } from "@/components/live-chip";
import { TickFlash } from "@/components/motion/tick-flash";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { useLive } from "@/lib/use-live";
import { Sparkline } from "../sparkline";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Futures & major commodities — EOD render, overlaid live from Yahoo
 *  (these venues run nearly 24/5, so "live" here ignores NSE hours). */
export function CommoditiesPanel({ items }: { items: WarRoomData["commodities"] }) {
  const live = useLive<LiveMarket>("/api/live/market", { openMs: 60_000, closedMs: 120_000 });
  const [detail, setDetail] = useState<{ symbol: string; name: string; el: HTMLElement } | null>(null);

  const rows = items.map((item) => {
    const q = live?.commodities?.[item.symbol];
    if (!q) return { ...item, change: item.spark.at(-2) !== undefined ? item.close - item.spark.at(-2)! : undefined };
    const changePct = q.changePct;
    const change = changePct !== undefined ? q.last - q.last / (1 + changePct / 100) : undefined;
    return { ...item, close: q.last, change1dPct: changePct, change, liveState: q.state };
  });
  const anyLive = rows.some((r) => "liveState" in r && r.liveState === "REGULAR");
  const moved = rows.filter((r) => r.change1dPct !== undefined);
  const best = [...moved].sort((a, b) => b.change1dPct! - a.change1dPct!)[0];
  const worst = [...moved].sort((a, b) => a.change1dPct! - b.change1dPct!)[0];

  return (
    <Tile
      title="Futures & commodities"
      icon={<Flame size={10} strokeWidth={2} className="text-loss" />}
      meta={
        <span className="flex items-center gap-1.5">
          <LiveChip on={anyLive} source="yahoo" />
          <span>COMEX · NYMEX · ICE · USD</span>
        </span>
      }
    >
      <div className="flex h-full flex-col">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ash">
              {["Name", "", "LTP", "Chg", "%"].map((h, i) => (
                <th key={h || i} className={`px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.07em] text-fog ${i >= 2 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
                  <tr
                    key={item.symbol}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => setDetail({ symbol: item.symbol, name: item.name, el: e.currentTarget })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setDetail({ symbol: item.symbol, name: item.name, el: e.currentTarget });
                    }}
                    className="cursor-pointer border-b border-ash transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60"
                  >
                <td className="px-2.5 py-[3px] text-[11px] font-medium text-charcoal">{item.name}</td>
                <td className="py-[5px]">
                  <Sparkline values={item.spark} width={44} height={16} />
                </td>
                <td className="px-1.5 py-[3px] text-right font-mono text-[11px] font-medium tabular-nums text-ink">
                  <TickFlash value={item.close}>${fmt.format(item.close)}</TickFlash>
                </td>
                <td className={`px-1.5 py-[3px] text-right font-mono text-[10.5px] tabular-nums ${item.change !== undefined ? deltaClass(item.change) : "text-fog"}`}>
                  {item.change !== undefined ? `${item.change > 0 ? "+" : item.change < 0 ? "−" : ""}${fmt.format(Math.abs(item.change))}` : "—"}
                </td>
                <td className={`px-2.5 py-[3px] text-right font-mono text-[10.5px] tabular-nums ${item.change1dPct !== undefined ? deltaClass(item.change1dPct) : "text-fog"}`}>
                  {item.change1dPct !== undefined ? signedPct(item.change1dPct) : "—"}
                </td>
                  </tr>
            ))}
          </tbody>
        </table>
        <RowPopover anchor={detail?.el ?? null} onClose={() => setDetail(null)}>
          {detail && <AssetCard symbol={detail.symbol} fallbackName={detail.name} />}
        </RowPopover>
        {best && worst && best !== worst && (
          <InsightLine meta="1D">
            {best.name} <span className={deltaClass(best.change1dPct!)}>{signedPct(best.change1dPct!, 1)}</span> leads ·{" "}
            {worst.name} <span className={deltaClass(worst.change1dPct!)}>{signedPct(worst.change1dPct!, 1)}</span> lags
          </InsightLine>
        )}
      </div>
    </Tile>
  );
}
