"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deltaClass, signedPct } from "@/lib/format";

// Personal watchlist (max 20) persisted in localStorage; renders as a
// marquee band. Click a name for the company card; data is EOD bhavcopy
// via /api/quotes and yahoo fundamentals via /api/company.
const STORAGE_KEY = "bhau-watchlist";
const MAX = 20;
const DEFAULTS = ["RELIANCE", "HDFCBANK", "TCS", "INFY", "TATAMOTORS"];

interface Quote {
  symbol: string;
  found: boolean;
  close?: number;
  changePct?: number;
  dayHigh?: number | null;
  dayLow?: number | null;
}

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
  profitMargins?: number;
  sector?: string;
  industry?: string;
  about?: string;
  error?: string;
}

function loadList(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
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

function CompanyCard({ symbol, onRemove }: { symbol: string; onRemove: () => void }) {
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
          <div className="text-[9.5px] text-fog">
            {company?.sector ? `${company.sector} · ${company.industry ?? ""}` : "NSE"}
          </div>
        </div>
        <button type="button" onClick={onRemove} title="Remove from watchlist" className="rounded-full p-1 text-silver transition-colors [@media(hover:hover)]:hover:bg-paper [@media(hover:hover)]:hover:text-loss">
          <X size={12} />
        </button>
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
          {company.about && (
            <p className="border-t border-ash px-3 py-2 text-[10px] leading-snug text-steel">{company.about}…</p>
          )}
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

export function WatchlistMarquee() {
  const [list, setList] = useState<string[] | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [draft, setDraft] = useState("");

  useEffect(() => {
    // Deferred so the SSR placeholder and first client paint agree.
    const id = requestAnimationFrame(() => setList(loadList()));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!list) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* private mode etc. */
    }
    if (list.length === 0) return;
    fetch(`/api/quotes?symbols=${list.join(",")}`)
      .then((r) => r.json())
      .then((d: { quotes: Quote[] }) => setQuotes(new Map(d.quotes.map((q) => [q.symbol, q]))))
      .catch(() => {});
  }, [list]);

  const add = useCallback(() => {
    const symbol = draft.trim().toUpperCase();
    if (!symbol || !list) return;
    if (list.includes(symbol) || list.length >= MAX) return;
    setList([...list, symbol]);
    setDraft("");
  }, [draft, list]);

  if (!list) return <div className="h-[30px] rounded-card border border-ash bg-canvas" />;

  const items = list.map((symbol) => ({ symbol, quote: quotes.get(symbol) }));

  return (
    <div className="flex h-[30px] items-stretch overflow-hidden rounded-card border border-ash bg-canvas">
      <span className="flex shrink-0 items-center border-r border-ash px-2.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-silver">
        WATCH {list.length}/{MAX}
      </span>
      <div className="marquee-window relative min-w-0 flex-1">
        <div className={`marquee-track flex items-center ${items.length > 6 ? "marquee-animate" : ""}`}>
          {(items.length > 6 ? [...items, ...items] : items).map(({ symbol, quote }, i) => (
            <Popover key={`${symbol}-${i}`}>
              <PopoverTrigger className="flex shrink-0 items-baseline gap-1.5 px-3 py-1 text-[11px] transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper">
                <span className="font-mono font-medium text-charcoal">{symbol}</span>
                {quote?.found ? (
                  <>
                    <span className="font-mono text-[10.5px] tabular-nums text-ink">{quote.close?.toFixed(2)}</span>
                    {quote.changePct !== undefined && (
                      <span className={`font-mono text-[9.5px] tabular-nums ${deltaClass(quote.changePct)}`}>
                        {signedPct(quote.changePct, 1)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[9px] text-silver">{quote ? "no data" : "…"}</span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <CompanyCard
                  symbol={symbol}
                  onRemove={() => setList(list.filter((s) => s !== symbol))}
                />
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </div>
      <Popover>
        <PopoverTrigger
          title="Add to watchlist"
          className="flex shrink-0 items-center gap-1 border-l border-ash px-2.5 font-mono text-[9px] font-semibold text-steel transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper"
        >
          <Plus size={11} /> ADD
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="flex gap-1.5"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="NSE symbol, e.g. ITC"
              className="min-w-0 flex-1 rounded-input border border-pebble px-2 py-1 font-mono text-[11px] uppercase text-charcoal outline-none placeholder:normal-case placeholder:font-sans placeholder:text-silver focus:border-charcoal"
              maxLength={20}
            />
            <button
              type="submit"
              disabled={list.length >= MAX}
              className="rounded-button bg-charcoal px-2.5 text-[11px] font-medium text-canvas transition-transform duration-150 active:scale-[0.97] disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {list.length >= MAX && <p className="mt-1.5 text-[9.5px] text-warn">Watchlist is full (20).</p>}
        </PopoverContent>
      </Popover>
    </div>
  );
}
