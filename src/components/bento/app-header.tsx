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
  { symbol: "INR=X", label: "USD" },
];

export function AppHeader({ data }: { data: WarRoomData }) {
  const headlines = Object.values(data.news)
    .flat()
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 10);
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
        <a
          href="https://github.com/Terra-01/bhau"
          target="_blank"
          rel="noopener noreferrer"
          title="Bhau on GitHub — every decision on a public hash-chained ledger"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-ash text-steel transition-colors [@media(hover:hover)]:hover:bg-paper [@media(hover:hover)]:hover:text-ink"
        >
          {/* lucide removed brand icons — the GitHub mark, inlined */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
        </a>
        <ThemeToggle />
      </span>
    </header>
  );
}
