"use client";

import { createChart, LineSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { baseChartOptions, cssVar, themeTokens } from "@/lib/lw-theme";

// The equity race on the same TradingView engine as the watchlist chart:
// one line per agent plus a thin benchmark, ₹-lakh price scale,
// crosshair inspection, theme-reactive.
export interface RaceSeriesDef {
  id: string;
  colorVar: string; // CSS custom property carrying the agent color
  benchmark?: boolean;
}

export function RaceChart({
  race,
  series,
}: {
  race: Array<Record<string, unknown>>;
  /** Must be referentially stable (module const) — read once per mount. */
  series: RaceSeriesDef[];
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const instance = useRef<{ chart: IChartApi; lines: Array<ISeriesApi<"Line">> } | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const t = themeTokens();
    const chart = createChart(el, { autoSize: true, handleScroll: false, handleScale: false, ...baseChartOptions(t) });
    const lines = series.map((def) =>
      chart.addSeries(LineSeries, {
        color: cssVar(def.colorVar) || t.fog,
        lineWidth: def.benchmark ? 1 : 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 2.5,
        priceFormat: {
          type: "custom" as const,
          minMove: 0.01,
          formatter: (v: number) => `${(v / 100_000).toFixed(2)}L`,
        },
      }),
    );
    instance.current = { chart, lines };
    const observer = new MutationObserver(() => {
      const next = themeTokens();
      chart.applyOptions(baseChartOptions(next));
      for (const [i, def] of series.entries()) {
        lines[i].applyOptions({ color: cssVar(def.colorVar) || next.fog });
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      chart.remove();
      instance.current = null;
    };
  }, [series]);

  useEffect(() => {
    const inst = instance.current;
    if (!inst) return;
    for (const [i, def] of series.entries()) {
      const data = race
        .flatMap((row) => {
          const value = row[def.id];
          const date = row.date;
          if (typeof value !== "number" || !(date instanceof Date || typeof date === "string")) return [];
          const iso = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
          return [{ time: iso, value }];
        })
        .sort((a, b) => a.time.localeCompare(b.time));
      inst.lines[i].setData(data);
    }
    inst.chart.timeScale().fitContent();
  }, [race, series]);

  return <div ref={container} className="h-full w-full" />;
}
