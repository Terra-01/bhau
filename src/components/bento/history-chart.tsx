"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area } from "@/components/charts/area-chart";

// EOD daily line for any symbol via /api/history — the honest version of
// the mockup's intraday chart (our data is end-of-day, and says so).
const TIMEFRAMES = [
  { label: "1M", days: 31 },
  { label: "3M", days: 93 },
  { label: "1Y", days: 370 },
] as const;

export function HistoryChart({ symbol, accent = "var(--color-charcoal)" }: { symbol: string; accent?: string }) {
  // State carries which symbol it belongs to — no synchronous resets in
  // effects; "loading" is derived from the mismatch.
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

  const series = useMemo(() => {
    if (!points || points.length === 0) return [];
    const anchor = new Date(points[points.length - 1].date).getTime();
    const since = anchor - timeframe.days * 86_400_000;
    return points
      .filter((p) => new Date(p.date).getTime() >= since)
      .map((p) => ({ date: new Date(p.date), value: p.close }));
  }, [points, timeframe]);

  const stillLoading = points === undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 px-1">
        {failed ? (
          <div className="flex h-full items-center justify-center text-[11px] text-fog">No chart data for {symbol}.</div>
        ) : series.length >= 2 ? (
          <AreaChart data={series} className="h-full" aspectRatio={undefined}>
            <Area dataKey="value" stroke={accent} fill={accent} fillOpacity={0.09} />
          </AreaChart>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-fog">{stillLoading ? "Loading…" : "Not enough history yet."}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1.5 pt-0.5">
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
        <span className="ml-auto font-mono text-[9px] text-silver">{symbol} · EOD</span>
      </div>
    </div>
  );
}
