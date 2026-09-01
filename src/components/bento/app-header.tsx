import { ThemeToggle } from "@/components/theme-toggle";
import type { WarRoomData } from "@/lib/warroom";
import { LiveTicker, type TickerItem } from "./live-ticker";

const REGIME_COLOR: Record<string, string> = {
  Calm: "var(--color-regime-calm)",
  Steady: "var(--color-regime-steady)",
  Watchful: "var(--color-regime-watchful)",
  Strained: "var(--color-regime-strained)",
  Stressed: "var(--color-regime-stressed)",
};

const TICKER: Array<{ symbol: string; label: string }> = [
  { symbol: "^NSEI", label: "Nifty" },
  { symbol: "^BSESN", label: "Sensex" },
  { symbol: "^NSEBANK", label: "Bank" },
  { symbol: "^INDIAVIX", label: "VIX" },
  { symbol: "INR=X", label: "USD" },
];

export function AppHeader({ data }: { data: WarRoomData }) {
  const headlines = Object.values(data.news)
    .flat()
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 10);
  const unhealthy = data.health.filter((h) => !h.healthy).length;
  const ticker: TickerItem[] = TICKER.flatMap(({ symbol, label }) => {
    const item = data.strip.find((s) => s.symbol === symbol || (symbol === "INR=X" && s.name === "USD/INR"));
    return item ? [{ symbol, label, close: item.close, changePct: item.change1dPct }] : [];
  });

  return (
    <header className="sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b border-charcoal bg-canvas py-1.5">
      <span className="flex shrink-0 items-baseline gap-1.5">
        <h1 className="text-[16px] font-semibold tracking-tight text-ink">Bhau</h1>
        <span className="font-mono text-[9px] text-fog">v1.1</span>
      </span>
      <LiveTicker items={ticker} />

      {/* Breaking strip — newest wire items, marquee, pause on hover */}
      <div className="marquee-window relative min-w-0 flex-1 overflow-hidden">
        <div className="marquee-track marquee-animate flex items-center">
          {[...headlines, ...headlines].map((item, i) => (
            <a
              key={`${item.title}-${i}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-baseline gap-1.5 px-3 text-[11px] text-charcoal [@media(hover:hover)]:hover:underline"
            >
              <span className="h-1 w-1 shrink-0 translate-y-[-1px] rounded-full bg-loss" />
              {item.title}
            </a>
          ))}
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-2.5 font-mono text-[10px] text-fog">
        {data.regime && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ash px-2 py-px" title="Bhau Regime Index — formula published">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: REGIME_COLOR[data.regime.band] }} />
            MOOD {data.regime.score.toFixed(1)}
            {data.regimeTrend.delta !== undefined && (
              <span className="text-silver">
                Δ{data.regimeTrend.delta > 0 ? "+" : ""}
                {data.regimeTrend.delta}
              </span>
            )}
            · {data.regime.band.toUpperCase()}
          </span>
        )}
        <span className={unhealthy > 0 ? "text-warn" : "text-silver"}>{unhealthy > 0 ? `${unhealthy} SRC DEGRADED` : "SOURCES OK"}</span>
        <ThemeToggle />
      </span>
    </header>
  );
}
