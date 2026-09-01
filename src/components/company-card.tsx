"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

// The watchlist's company essentials card (yahoo fundamentals via
// /api/company) with Screener/NSE deep links.
interface Company {
  symbol: string;
  name?: string;
  price?: number;
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

const compactCr = (n?: number) =>
  n === undefined ? "—" : n >= 1e12 ? `₹${(n / 1e12).toFixed(1)} L Cr` : `₹${(n / 1e7).toFixed(0)} Cr`;
const num = (n?: number | null, d = 2) => (n === undefined || n === null ? "—" : n.toFixed(d));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.06em] text-silver">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-charcoal">{value}</span>
    </div>
  );
}

export function CompanyCard({ symbol, onRemove }: { symbol: string; onRemove?: () => void }) {
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/company/${symbol}`)
      .then((r) => r.json())
      .then((d) => alive && setCompany(d))
      .catch(() => alive && setCompany({ symbol, error: "lookup failed" }));
    return () => {
      alive = false;
    };
  }, [symbol]);

  return (
    <div className="w-[360px]">
      <div className="flex items-start justify-between gap-2 border-b border-ash px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-ink">{company?.name ?? symbol}</div>
          <div className="text-[9.5px] text-fog">{company?.sector ? `${company.sector} · ${company.industry ?? ""}` : "NSE"}</div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} title="Remove from watchlist" className="rounded-full p-1 text-silver transition-colors [@media(hover:hover)]:hover:bg-paper [@media(hover:hover)]:hover:text-loss">
            <X size={12} />
          </button>
        )}
      </div>
      {!company ? (
        <p className="px-3 py-4 text-[11px] text-fog">Loading…</p>
      ) : company.error ? (
        <p className="px-3 py-4 text-[11px] text-fog">No fundamentals found for {symbol}.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 px-3 py-2.5">
            <Stat label="Price" value={`₹${num(company.price)}`} />
            <Stat label="Mkt cap" value={compactCr(company.marketCap)} />
            <Stat label="P/E" value={num(company.trailingPE, 1)} />
            <Stat label="Day H/L" value={`${num(company.dayHigh)} / ${num(company.dayLow)}`} />
            <Stat label="52w H/L" value={`${num(company.fiftyTwoWeekHigh, 0)} / ${num(company.fiftyTwoWeekLow, 0)}`} />
            <Stat label="Book val" value={`₹${num(company.bookValue)}`} />
            <Stat label="P/B" value={num(company.priceToBook, 1)} />
            <Stat label="Div yield" value={company.dividendYield !== undefined ? `${(company.dividendYield * 100).toFixed(2)}%` : "—"} />
            <Stat label="ROE" value={company.returnOnEquity !== undefined ? `${(company.returnOnEquity * 100).toFixed(1)}%` : "—"} />
          </div>
          {company.about && <p className="border-t border-ash px-3 py-2 text-[10px] leading-snug text-steel">{company.about}…</p>}
          <div className="flex gap-2 border-t border-ash px-3 py-2">
            <a href={`https://www.screener.in/company/${symbol}/`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ash px-2 py-px text-[9.5px] font-medium text-steel">
              Screener ↗
            </a>
            <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ash px-2 py-px text-[9.5px] font-medium text-steel">
              NSE ↗
            </a>
          </div>
        </>
      )}
    </div>
  );
}
