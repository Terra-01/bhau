"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MarketChart } from "@/components/bento/market-chart";
import { deltaClass, signedPct } from "@/lib/format";

// The details view behind every clickable row — equities, indices,
// futures, FX crosses. Theme-token surfaces (dark-safe), a hard width,
// scroll-clamped description, stats that hide when absent, and a 52-week
// range bar instead of two raw numbers.
interface Asset {
  symbol: string;
  kind?: "equity" | "index" | "future" | "currency";
  name?: string;
  currency?: string;
  price?: number;
  changePct?: number; // fraction (yahoo quoteSummary convention)
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  trailingPE?: number;
  bookValue?: number;
  priceToBook?: number;
  dividendYield?: number;
  returnOnEquity?: number;
  sector?: string;
  industry?: string;
  about?: string;
  error?: string;
}

const KIND_LABEL: Record<string, string> = {
  equity: "NSE",
  index: "INDEX",
  future: "FUTURES",
  currency: "FX",
};

const compactCr = (n?: number) =>
  n === undefined ? "—" : n >= 1e12 ? `₹${(n / 1e12).toFixed(1)} L Cr` : `₹${(n / 1e7).toFixed(0)} Cr`;

function ccySign(currency?: string) {
  if (currency === "INR") return "₹";
  if (currency === "USD") return "$";
  return "";
}

const num = (n?: number | null, d = 2) => (n === undefined || n === null ? "—" : n.toFixed(d));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.06em] text-silver">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-charcoal">{value}</span>
    </div>
  );
}

/** 52-week position: a track with the current price marked on it. */
function RangeBar({ low, high, price }: { low: number; high: number; price: number }) {
  const pct = high > low ? Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100)) : 50;
  return (
    <div className="px-3 pb-2">
      <div className="mb-0.5 flex items-baseline justify-between text-[8.5px] font-semibold uppercase tracking-[0.06em] text-silver">
        <span>52W {num(low, low < 10 ? 2 : 0)}</span>
        <span className="text-fog">{pct.toFixed(0)}% of range</span>
        <span>{num(high, high < 10 ? 2 : 0)}</span>
      </div>
      <div className="relative h-[5px] rounded-full bg-paper">
        <div className="absolute inset-y-0 left-0 rounded-full bg-ash" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 h-[9px] w-[3px] -translate-y-1/2 rounded-full bg-blue" style={{ left: `calc(${pct}% - 1.5px)` }} />
      </div>
    </div>
  );
}

export function AssetCard({ symbol, fallbackName, onRemove }: { symbol: string; fallbackName?: string; onRemove?: () => void }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/company/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => alive && setAsset(d))
      .catch(() => alive && setAsset({ symbol, error: "lookup failed" }));
    return () => {
      alive = false;
    };
  }, [symbol]);

  const sign = ccySign(asset?.currency);
  const pct = asset?.changePct !== undefined ? asset.changePct * 100 : undefined;
  const stats: Array<[string, string]> = asset
    ? ([
        asset.marketCap !== undefined ? ["Mkt cap", compactCr(asset.marketCap)] : null,
        asset.trailingPE !== undefined ? ["P/E", num(asset.trailingPE, 1)] : null,
        asset.priceToBook !== undefined ? ["P/B", num(asset.priceToBook, 1)] : null,
        asset.bookValue !== undefined ? ["Book val", `₹${num(asset.bookValue)}`] : null,
        asset.dividendYield !== undefined ? ["Div yield", `${(asset.dividendYield * 100).toFixed(2)}%`] : null,
        asset.returnOnEquity !== undefined ? ["ROE", `${(asset.returnOnEquity * 100).toFixed(1)}%`] : null,
        asset.dayHigh !== undefined && asset.dayLow !== undefined
          ? ["Day H/L", `${num(asset.dayHigh, asset.dayHigh < 10 ? 3 : 2)} / ${num(asset.dayLow, asset.dayLow < 10 ? 3 : 2)}`]
          : null,
      ].filter(Boolean) as Array<[string, string]>)
    : [];

  return (
    <div className="w-[340px] overflow-hidden rounded-lg bg-canvas text-ink">
      <div className="border-b border-ash px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-ink">{asset?.name ?? fallbackName ?? symbol}</div>
            <div className="truncate text-[9.5px] text-fog">
              <span className="font-mono">{symbol}</span>
              {" · "}
              {asset?.sector ? `${asset.sector}${asset.industry ? ` · ${asset.industry}` : ""}` : (KIND_LABEL[asset?.kind ?? "equity"] ?? "NSE")}
            </div>
          </div>
          {asset?.price !== undefined && (
            <div className="shrink-0 text-right">
              <div className="font-mono text-[14px] font-semibold tabular-nums text-ink">
                {sign}
                {num(asset.price, asset.price < 10 ? 4 : 2)}
              </div>
              {pct !== undefined && (
                <div className={`font-mono text-[10px] tabular-nums ${deltaClass(pct)}`}>{signedPct(pct)}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* the same TradingView engine as the watchlist, scoped to this asset */}
      <div className="h-[130px] border-b border-ash">
        <MarketChart symbol={symbol} label={asset?.name ?? fallbackName ?? symbol} />
      </div>

      {!asset ? (
        <p className="px-3 py-4 text-[11px] text-fog">Loading…</p>
      ) : asset.error ? (
        <p className="px-3 py-4 text-[11px] text-fog">No details found for {symbol}.</p>
      ) : (
        <>
          {asset.fiftyTwoWeekLow !== undefined && asset.fiftyTwoWeekHigh !== undefined && asset.price !== undefined && (
            <div className="pt-2">
              <RangeBar low={asset.fiftyTwoWeekLow} high={asset.fiftyTwoWeekHigh} price={asset.price} />
            </div>
          )}
          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 border-t border-ash px-3 py-2">
              {stats.map(([label, value]) => (
                <Stat key={label} label={label} value={value} />
              ))}
            </div>
          )}
          {asset.about && (
            <p className="max-h-[88px] overflow-y-auto border-t border-ash px-3 py-2 text-[10px] leading-snug text-steel">
              {asset.about}…
            </p>
          )}
          {asset.kind === "equity" && (
            <div className="flex gap-2 border-t border-ash px-3 py-2">
              <a
                href={`https://www.screener.in/company/${symbol}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-ash px-2 py-px text-[9.5px] font-medium text-steel [@media(hover:hover)]:hover:bg-paper"
              >
                Screener ↗
              </a>
              <a
                href={`https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-ash px-2 py-px text-[9.5px] font-medium text-steel [@media(hover:hover)]:hover:bg-paper"
              >
                NSE ↗
              </a>
            </div>
          )}
        </>
      )}

      {onRemove && (
        <div className="border-t border-ash p-2">
          <button
            type="button"
            onClick={onRemove}
            className="flex w-full items-center justify-center gap-1.5 rounded-button bg-loss py-1.5 text-[11px] font-semibold text-white transition-transform duration-150 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.98]"
          >
            <Trash2 size={12} /> Remove from watchlist
          </button>
        </div>
      )}
    </div>
  );
}
