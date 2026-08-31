"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area } from "@/components/charts/area-chart";
import type { ExchangeData } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TIMEFRAMES = [
  { label: "1M", days: 31 },
  { label: "3M", days: 93 },
  { label: "1Y", days: 370 },
] as const;

export function IndicesHero({
  indices,
  history,
}: {
  indices: ExchangeData["indices"];
  history: ExchangeData["indicesHistory"];
}) {
  const heroDefault = indices.find((i) => i.hasHistory)?.symbol ?? indices[0]?.symbol;
  const [selected, setSelected] = useState(heroDefault);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[1]);

  const series = useMemo(() => {
    const full = history[selected ?? ""] ?? [];
    if (full.length === 0) return [];
    // Anchor the window to the latest session, not the wall clock — correct
    // for EOD data and keeps render pure.
    const anchor = full[full.length - 1].date.getTime();
    const since = anchor - timeframe.days * 86_400_000;
    return full.filter((p) => p.date.getTime() >= since).map((p) => ({ date: p.date, value: p.value }));
  }, [history, selected, timeframe]);

  return (
    <div className="rounded-card border border-ash bg-canvas">
      <div className="flex gap-1 overflow-x-auto border-b border-ash px-2 py-2">
        {indices.map((index) => {
          const active = index.symbol === selected;
          const clickable = index.hasHistory;
          return (
            <button
              key={index.symbol}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setSelected(index.symbol)}
              className={`flex shrink-0 flex-col rounded-button px-2.5 py-1 text-left transition-colors duration-150 ${
                active ? "bg-paper" : clickable ? "[@media(hover:hover)]:hover:bg-paper/60" : "cursor-default opacity-80"
              }`}
              title={clickable ? "Show chart" : "Chart history accumulating"}
            >
              <span className="whitespace-nowrap text-[10.5px] font-medium text-steel">{index.name}</span>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="font-mono text-[12.5px] font-medium tabular-nums text-ink">{fmt.format(index.close)}</span>
                {index.changePct !== undefined && (
                  <span className={`font-mono text-[10px] tabular-nums ${deltaClass(index.changePct)}`}>
                    {signedPct(index.changePct, 2)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-[260px] px-2 pt-2">
        {series.length >= 2 ? (
          <AreaChart data={series} className="h-full" aspectRatio={undefined}>
            <Area dataKey="value" stroke="var(--color-charcoal)" fill="var(--color-charcoal)" fillOpacity={0.08} />
          </AreaChart>
        ) : (
          <div className="flex h-full items-center justify-center text-[11.5px] text-fog">
            History accumulating for this index.
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-3 pb-2 pt-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.label}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded-button px-2.5 py-0.5 font-mono text-[10.5px] font-medium transition-colors duration-150 ${
              timeframe.label === tf.label ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
            }`}
          >
            {tf.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[9.5px] text-silver">EOD CLOSES · NSE</span>
      </div>
    </div>
  );
}
