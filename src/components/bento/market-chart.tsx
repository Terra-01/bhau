"use client";

import { AreaSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DUR, EASE } from "@/lib/motion";
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

// Session cache: the watchlist chart tours 20 symbols every 5s — a
// revisit inside the server's own TTL window must not refetch.
const historyCache = new Map<string, { at: number; points: HistoryPoint[] }>();
const clientTtl = (intraday: boolean) => (intraday ? 60_000 : 5 * 60_000);
const freshCached = (key: string, intraday: boolean) => {
  const hit = historyCache.get(key);
  return hit && Date.now() - hit.at < clientTtl(intraday) ? hit.points : null;
};

export function MarketChart({ symbol, label }: { symbol: string; label?: string }) {
  const reduce = useReducedMotion();
  const container = useRef<HTMLDivElement | null>(null);
  const instance = useRef<{ chart: IChartApi; area: ISeriesApi<"Area"> } | null>(null);

  // State carries which symbol+mode it belongs to — "loading" is derived
  // from the mismatch, no synchronous resets in effects.
  const [loaded, setLoaded] = useState<{ key: string; points: HistoryPoint[] | null } | null>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[2]);
  const intraday = timeframe.label === "1D";
  const key = `${symbol}|${intraday ? "1d" : "daily"}`;
  // Serve a fresh cache hit during render (guarded set — settles in one
  // pass) so symbol revisits never flash "Loading…" or refetch.
  if (loaded?.key !== key) {
    const hit = freshCached(key, intraday);
    if (hit) setLoaded({ key, points: hit });
  }
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
    if (freshCached(key, intraday)) return; // served during render
    let alive = true;
    const url = `/api/history/${encodeURIComponent(symbol)}${intraday ? "?range=1d" : ""}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const points: HistoryPoint[] = d.points ?? [];
        historyCache.set(key, { at: Date.now(), points });
        if (alive) setLoaded({ key, points });
      })
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
    // The largest element on the board must not teleport: dip the canvas,
    // swap the series, rise on the house curve (opacity-only, so it also
    // satisfies reduced motion by construction).
    const el = container.current;
    if (el) el.style.opacity = "0";
    inst.chart.applyOptions({ timeScale: { timeVisible: intraday, secondsVisible: false } });
    inst.area.setData(data);
    inst.chart.timeScale().fitContent();
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (el) el.style.opacity = "1";
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      if (el) el.style.opacity = "1";
    };
  }, [data, loading, intraday]);

  const empty = failed || (!loading && data.length < 2);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={container} className="absolute inset-0 transition-opacity duration-[70ms] [transition-timing-function:var(--ease-out-strong)]" />
        {/* the instrument, where every trading terminal puts it — rolls on
            symbol change like every other value on the board */}
        <div className="pointer-events-none absolute left-2 top-1 z-10 overflow-hidden text-[10.5px] font-semibold tracking-tight text-ink/80">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label ?? symbol}
              className="block"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(0.7em)" }}
              animate={{ opacity: 1, transform: "translateY(0em)", transition: { duration: DUR.enter, ease: EASE } }}
              exit={
                reduce
                  ? { opacity: 0, transition: { duration: DUR.exit } }
                  : { opacity: 0, transform: "translateY(-0.7em)", transition: { duration: DUR.exit, ease: EASE } }
              }
            >
              {label ?? symbol}
            </motion.span>
          </AnimatePresence>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center bg-canvas/60 text-[10px] text-fog transition-opacity duration-[70ms] [transition-timing-function:var(--ease-out-strong)] ${
            loading ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          Loading…
        </div>
        {!loading && empty ? (
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
            className={`pressable rounded-button px-2 py-px font-mono text-[10px] font-medium transition-colors duration-150 ${
              timeframe.label === tf.label ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
            }`}
          >
            {tf.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[9px] text-silver">{intraday ? "1D · IST" : "DAILY"}</span>
      </div>
    </div>
  );
}
