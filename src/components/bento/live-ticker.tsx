"use client";

import type { LiveMarket } from "@/app/api/live/market/route";
import { LiveChip } from "@/components/live-chip";
import { SlideValue } from "@/components/motion/slide-value";
import { deltaClass, signedPct } from "@/lib/format";
import { useLive } from "@/lib/use-live";

// The header tape: NIFTY · SENSEX · BANK · VIX · USD/INR, server-rendered
// from the evening pack and overlaid with the shared live snapshot. The
// session chip replaces the old static LIVE·EOD badge.

export interface TickerItem {
  symbol: string;
  label: string;
  close: number;
  changePct?: number;
}

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LiveTicker({ items }: { items: TickerItem[] }) {
  const live = useLive<LiveMarket>("/api/live/market");

  const resolved = items.map((item) => {
    const q =
      item.symbol === "INR=X" || item.symbol === "USDINR"
        ? live?.fx?.USD
        : live?.indices?.quotes[item.symbol];
    return q ? { ...item, close: q.last, changePct: q.changePct ?? item.changePct } : item;
  });

  return (
    <span className="flex min-w-0 shrink-0 items-center gap-2.5">
      {live?.phase && live.phase !== "closed" ? (
        <LiveChip phase={live.phase} />
      ) : (
        <span className="font-mono text-[8px] font-semibold text-silver">EOD</span>
      )}
      <span className="flex items-baseline gap-2.5 overflow-hidden">
        {resolved.map((item) => (
          <span key={item.symbol} className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.05em] text-fog">{item.label}</span>
            <SlideValue n={item.close} text={fmt.format(item.close)} className="font-mono text-[10.5px] font-medium tabular-nums text-ink" />
            {item.changePct !== undefined && (
              <span className={`font-mono text-[9px] tabular-nums ${deltaClass(item.changePct)} max-[1450px]:hidden`}>
                {signedPct(item.changePct)}
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
}
