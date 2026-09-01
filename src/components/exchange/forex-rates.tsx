"use client";

import { ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import type { LiveMarket } from "@/app/api/live/market/route";
import { AssetCard } from "@/components/asset-card";
import { RowPopover } from "@/components/row-popover";
import { InsightLine } from "@/components/insight-line";
import { LiveChip } from "@/components/live-chip";
import { TickFlash } from "@/components/motion/tick-flash";
import type { ExchangeData } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { useLive } from "@/lib/use-live";
import { Sparkline } from "../sparkline";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Forex vs INR: ECB's daily reference draws the 30-day shape; Yahoo's
// live crosses overlay the ₹ column while FX venues trade (24/5). The 1M
// move is recomputed against the effective price so columns never argue.

interface Row {
  pair: string;
  price: number;
  spark: number[];
  m1: number | null;
  live: boolean;
}

function insight(rows: Row[]): string | null {
  const moved = rows.filter((r) => r.m1 !== null);
  if (moved.length < 2) return null;
  const weaker = moved.filter((r) => r.m1! > 0).length; // pair up = INR down
  const biggest = [...moved].sort((a, b) => Math.abs(b.m1!) - Math.abs(a.m1!))[0];
  const dir = biggest.m1! > 0 ? "weakest vs" : "strongest vs";
  return `1M: ₹ ${weaker > moved.length / 2 ? "softer" : "firmer"} vs ${
    weaker > moved.length / 2 ? weaker : moved.length - weaker
  }/${moved.length} majors · ${dir} ${biggest.pair} ${Math.abs(biggest.m1!).toFixed(1)}%`;
}

export function ForexRates({ forex }: { forex: ExchangeData["forex"] }) {
  const liveMkt = useLive<LiveMarket>("/api/live/market", { openMs: 60_000, closedMs: 120_000 });
  const [detail, setDetail] = useState<{ symbol: string; name: string; el: HTMLElement } | null>(null);

  const rows: Row[] = (forex ?? []).map((row) => {
    const q = liveMkt?.fx?.[row.pair];
    const price = q?.last ?? row.price;
    const base = row.spark[0];
    return {
      pair: row.pair,
      price,
      spark: row.spark,
      m1: base ? ((price - base) / base) * 100 : row.m1,
      live: q?.state === "REGULAR",
    };
  });
  const anyLive = rows.some((r) => r.live);

  return (
    <Tile
      title="Forex vs INR"
      icon={<ArrowRightLeft size={10} strokeWidth={2} className="text-lavender" />}
      meta={anyLive ? <LiveChip on source="yahoo" /> : "ECB"}
    >
      {rows.length === 0 ? (
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable.</p>
      ) : (
        <div className="flex h-full flex-col">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ash">
                <th className="px-2.5 py-0.5 text-left text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">Pair</th>
                <th className="px-1 py-0.5 text-left text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">30D</th>
                <th className="px-1 py-0.5 text-right text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">₹</th>
                <th className="px-2.5 py-0.5 text-right text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">1M</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const scale = row.pair === "JPY" ? 100 : 1;
                const openDetail = (el: HTMLElement) =>
                  setDetail({ symbol: row.pair === "USD" ? "INR=X" : `${row.pair}INR=X`, name: `${row.pair}/INR`, el });
                return (
                      <tr
                        key={row.pair}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => openDetail(e.currentTarget)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") openDetail(e.currentTarget);
                        }}
                        className="cursor-pointer border-b border-ash transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60"
                      >
                    <td className="px-2.5 py-[3px] font-mono text-[10px] font-semibold leading-none text-charcoal">
                      {row.pair}
                      {scale !== 1 && <span className="font-sans text-[7.5px] font-normal text-silver"> ×100</span>}
                    </td>
                    <td className="py-[3px]">
                      <Sparkline values={row.spark} width={40} height={15} />
                    </td>
                    <td className="px-1 py-[3px] text-right font-mono text-[10.5px] font-medium leading-none tabular-nums text-ink">
                      <TickFlash value={row.price}>{fmt.format(row.price * scale)}</TickFlash>
                    </td>
                    <td className={`px-2.5 py-[3px] text-right font-mono text-[9.5px] leading-none tabular-nums ${row.m1 !== null ? deltaClass(row.m1) : "text-fog"}`}>
                      {row.m1 !== null ? signedPct(row.m1, 1) : "—"}
                    </td>
                      </tr>
                );
              })}
            </tbody>
          </table>
          <RowPopover anchor={detail?.el ?? null} onClose={() => setDetail(null)}>
            {detail && <AssetCard symbol={detail.symbol} fallbackName={detail.name} />}
          </RowPopover>
          {insight(rows) && <InsightLine meta={anyLive ? "YAHOO · ECB" : "ECB"}>{insight(rows)}</InsightLine>}
        </div>
      )}
    </Tile>
  );
}
