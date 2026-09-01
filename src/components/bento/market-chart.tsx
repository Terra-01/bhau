"use client";

import { AreaSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { alpha, baseChartOptions, themeTokens } from "@/lib/lw-theme";
import { isLive, phaseAt } from "@/lib/market-clock";

// The watchlist hero chart on TradingView's open-source Lightweight
// Charts (Apache-2.0; the small attribution logo is the license's ask).
// 1D = the latest session's minute prints (~1 min lag, timestamps
// shifted so the axis reads IST); 1M/3M/1Y = daily bars where the last
// bar is today's forming session.
const TIMEFRAMES = [
  { label: "1D", days: 0 },
  { label: "1M", days: 31 },
  { label: "3M", days: 93 },
  { label: "1Y", days: 370 },
] as const;

const IST_OFFSET_S = 19_800; // lightweight-charts draws UTC; shift so labels read IST

const seriesOptions = (t: ReturnType<typeof themeTokens>) => ({
  lineColor: t.charcoal,
  topColor: alpha(t.charcoal, 0.14),
  bottomColor: alpha(t.charcoal, 0.01),
  lineWidth: 2 as const,
});

interface HistoryPoint {
  date?: string; // daily
  t?: number; // intraday unix seconds
  close: number;
}

export function MarketChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement | null>(null);
  const instance = useRef<{ chart: IChartApi; area: ISeriesApi<"Area"> } | null>(null);

  // State carries which symbol+mode it belongs to — "loading" is derived
  // from the mismatch, no synchronous resets in effects.
  const [loaded, setLoaded] = useState<{ key: string; points: HistoryPoint[] | null } | null>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[2]);
  const intraday = timeframe.label === "1D";
  const key = `${symbol}|${intraday ? "1d" : "daily"}`;
  const points = loaded?.key === key ? loaded.points : undefined; // undefined = loading, null = failed
  const failed = points === null;

  // During the session the 1D tab is the natural default.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (isLive(phaseAt(new Date()))) setTimeframe(TIMEFRAMES[0]);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const url = `/api/history/${encodeURIComponent(symbol)}${intraday ? "?range=1d" : ""}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setLoaded({ key, points: d.points ?? [] }))
      .catch(() => alive && setLoaded({ key, points: null }));
    return () => {
      alive = false;
    };
  }, [symbol, intraday, key]);

  const data = useMemo(() => {
    if (!points || points.length === 0) return [];
    if (intraday) {
      return points.flatMap((p) =>
        p.t !== undefined ? [{ time: (p.t + IST_OFFSET_S) as UTCTimestamp, value: p.close }] : [],
      );
    }
    const daily = points.filter((p) => p.date !== undefined);
    if (daily.length === 0) return [];
    const anchor = new Date(daily[daily.length - 1].date!).getTime();
    const since = anchor - timeframe.days * 86_400_000;
    return daily
      .filter((p) => new Date(p.date!).getTime() >= since)
      .map((p) => ({ time: p.date!.slice(0, 10), value: p.close }));
  }, [points, timeframe, intraday]);

  // One chart per mount; theme changes restyle it in place.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const t = themeTokens();
    const chart = createChart(el, { autoSize: true, handleScroll: false, handleScale: false, ...baseChartOptions(t) });
    const area = chart.addSeries(AreaSeries, seriesOptions(t));
    instance.current = { chart, area };
    const observer = new MutationObserver(() => {
      const next = themeTokens();
      chart.applyOptions(baseChartOptions(next));
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
    if (!inst || loading) return; // keep the outgoing series while the next load runs
    inst.chart.applyOptions({ timeScale: { timeVisible: intraday, secondsVisible: false } });
    inst.area.setData(data);
    inst.chart.timeScale().fitContent();
  }, [data, loading, intraday]);

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
        <span className="ml-auto font-mono text-[9px] text-silver">
          {symbol} · {intraday ? "1D · IST" : "DAILY"}
        </span>
      </div>
    </div>
  );
}
