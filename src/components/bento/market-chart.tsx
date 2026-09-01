"use client";

import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

// The watchlist hero chart on TradingView's open-source Lightweight
// Charts (Apache-2.0; the small attribution logo is the license's ask).
// EOD daily data via /api/history — crosshair, price scale and time
// scale come from the library instead of a hand-rolled sparkline.
const TIMEFRAMES = [
  { label: "1M", days: 31 },
  { label: "3M", days: 93 },
  { label: "1Y", days: 370 },
] as const;

function themeTokens() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    canvas: v("--color-canvas"),
    ash: v("--color-ash"),
    fog: v("--color-fog"),
    charcoal: v("--color-charcoal"),
    mono: v("--font-mono") || "monospace",
  };
}

/** #rrggbb → #rrggbbAA (canvas needs concrete colors, not CSS vars). */
const alpha = (hex: string, a: number) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : hex;

function chartOptions(t: ReturnType<typeof themeTokens>) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: t.canvas },
      textColor: t.fog,
      fontSize: 9,
      fontFamily: `${t.mono}, monospace`,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: alpha(t.ash, 0.55) },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    crosshair: {
      horzLine: { labelBackgroundColor: t.charcoal, color: t.fog },
      vertLine: { labelBackgroundColor: t.charcoal, color: t.fog },
    },
  };
}

const seriesOptions = (t: ReturnType<typeof themeTokens>) => ({
  lineColor: t.charcoal,
  topColor: alpha(t.charcoal, 0.14),
  bottomColor: alpha(t.charcoal, 0.01),
  lineWidth: 2 as const,
});

export function MarketChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement | null>(null);
  const instance = useRef<{ chart: IChartApi; area: ISeriesApi<"Area"> } | null>(null);

  // State carries which symbol it belongs to — "loading" is derived from
  // the mismatch, no synchronous resets in effects.
  const [loaded, setLoaded] = useState<{ symbol: string; points: Array<{ date: string; close: number }> | null } | null>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[1]);
  const points = loaded?.symbol === symbol ? loaded.points : undefined; // undefined = loading, null = failed
  const failed = points === null;

  useEffect(() => {
    let alive = true;
    fetch(`/api/history/${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setLoaded({ symbol, points: d.points ?? [] }))
      .catch(() => alive && setLoaded({ symbol, points: null }));
    return () => {
      alive = false;
    };
  }, [symbol]);

  const data = useMemo(() => {
    if (!points || points.length === 0) return [];
    const anchor = new Date(points[points.length - 1].date).getTime();
    const since = anchor - timeframe.days * 86_400_000;
    return points
      .filter((p) => new Date(p.date).getTime() >= since)
      .map((p) => ({ time: p.date.slice(0, 10), value: p.close }));
  }, [points, timeframe]);

  // One chart per mount; theme changes restyle it in place.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const t = themeTokens();
    const chart = createChart(el, { autoSize: true, handleScroll: false, handleScale: false, ...chartOptions(t) });
    const area = chart.addSeries(AreaSeries, seriesOptions(t));
    instance.current = { chart, area };
    const observer = new MutationObserver(() => {
      const next = themeTokens();
      chart.applyOptions(chartOptions(next));
      area.applyOptions(seriesOptions(next));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      chart.remove();
      instance.current = null;
    };
  }, []);

  const loading = points === undefined;

  useEffect(() => {
    const inst = instance.current;
    if (!inst || loading) return; // keep the outgoing series while the next symbol loads
    inst.area.setData(data);
    inst.chart.timeScale().fitContent();
  }, [data, loading]);

  const empty = failed || (!loading && data.length < 2);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={container} className="absolute inset-0" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/60 text-[10px] text-fog">Loading…</div>
        ) : empty ? (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas text-[11px] text-fog">
            {failed ? `No chart data for ${symbol}.` : "Not enough history yet."}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1 pt-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.label}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded-button px-2 py-px font-mono text-[10px] font-medium transition-colors duration-150 ${
              timeframe.label === tf.label ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
            }`}
          >
            {tf.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[9px] text-silver">{symbol} · DAILY</span>
      </div>
    </div>
  );
}
