"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CompanyCard } from "@/components/company-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deltaClass, signedPct } from "@/lib/format";
import { Tile } from "../tiles/tile";
import { HistoryChart } from "./history-chart";

// The mockup's hero watchlist: chart of the selected row on top, quote
// rows below. NIFTY 50 and SENSEX are pinned; the rest is the user's
// list (localStorage, max 20).
const STORAGE_KEY = "bhau-watchlist";
const MAX = 20;
const DEFAULTS = ["RELIANCE", "HDFCBANK", "TCS", "INFY", "TATAMOTORS"];
const PINNED = [
  { symbol: "^NSEI", label: "NIFTY 50" },
  { symbol: "^BSESN", label: "SENSEX" },
] as const;

interface Quote {
  symbol: string;
  found: boolean;
  close?: number;
  changePct?: number;
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

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function WatchlistPanel({
  pinnedQuotes,
}: {
  /** Server-provided quotes for the pinned indices: [nifty, sensex]. */
  pinnedQuotes: Array<{ symbol: string; close: number; changePct?: number }>;
}) {
  const [list, setList] = useState<string[] | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [selected, setSelected] = useState<string>("^NSEI");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6;
  const pages = Math.max(1, Math.ceil((list?.length ?? 0) / PAGE_SIZE));
  const visible = list?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  useEffect(() => {
    const id = requestAnimationFrame(() => setList(loadList()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!list) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* private mode */
    }
    if (list.length === 0) return;
    fetch(`/api/quotes?symbols=${list.join(",")}`)
      .then((r) => r.json())
      .then((d: { quotes: Quote[] }) => setQuotes(new Map(d.quotes.map((q) => [q.symbol, q]))))
      .catch(() => {});
  }, [list]);

  const add = useCallback(() => {
    const symbol = draft.trim().toUpperCase();
    if (!symbol || !list || list.includes(symbol) || list.length >= MAX) return;
    setList([...list, symbol]);
    setDraft("");
  }, [draft, list]);

  const rowClass = (symbol: string) =>
    `flex w-full items-baseline gap-2 border-b border-ash px-2.5 py-[3px] text-left transition-colors duration-150 last:border-b-0 ${
      selected === symbol ? "bg-paper" : "[@media(hover:hover)]:hover:bg-paper/60"
    }`;

  return (
    <Tile
      title="Watchlist"
      meta={
        <span className="flex items-center gap-2">
          <span>{list ? `${list.length}/${MAX}` : ""}</span>
          <Popover>
            <PopoverTrigger
              title="Add to watchlist"
              className="flex items-center gap-0.5 rounded-full border border-ash px-1.5 py-px font-sans text-[9px] font-semibold text-steel transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper"
            >
              <Plus size={9} /> ADD
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
                  className="min-w-0 flex-1 rounded-input border border-pebble bg-canvas px-2 py-1 font-mono text-[11px] uppercase text-charcoal outline-none placeholder:font-sans placeholder:normal-case placeholder:text-silver focus:border-charcoal"
                  maxLength={20}
                />
                <button type="submit" disabled={!list || list.length >= MAX} className="rounded-button bg-charcoal px-2.5 text-[11px] font-medium text-canvas transition-transform duration-150 active:scale-[0.97] disabled:opacity-40">
                  Add
                </button>
              </form>
            </PopoverContent>
          </Popover>
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="h-[160px] shrink-0 border-b border-ash pt-0.5 xl:h-auto xl:min-h-0 xl:flex-[0.85]">
          <HistoryChart symbol={selected} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {PINNED.map((pin) => {
            const quote = pinnedQuotes.find((q) => q.symbol === pin.symbol);
            return (
              <button key={pin.symbol} type="button" onClick={() => setSelected(pin.symbol)} className={rowClass(pin.symbol)}>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-charcoal">{pin.label}</span>
                {quote && (
                  <>
                    <span className="font-mono text-[12px] font-medium tabular-nums text-ink">{fmt.format(quote.close)}</span>
                    {quote.changePct !== undefined && (
                      <span className={`w-16 text-right font-mono text-[10.5px] tabular-nums ${deltaClass(quote.changePct)}`}>
                        {signedPct(quote.changePct)}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
          {visible.map((symbol) => {
            const quote = quotes.get(symbol);
            return (
              <div key={symbol} className={rowClass(symbol)}>
                <button type="button" onClick={() => setSelected(symbol)} className="min-w-0 flex-1 truncate text-left font-mono text-[11.5px] font-medium text-charcoal">
                  {symbol}
                </button>
                {quote?.found ? (
                  <>
                    <span className="font-mono text-[11.5px] tabular-nums text-ink">{fmt.format(quote.close!)}</span>
                    {quote.changePct !== undefined && (
                      <span className={`w-16 text-right font-mono text-[10.5px] tabular-nums ${deltaClass(quote.changePct)}`}>
                        {signedPct(quote.changePct)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[9px] text-silver">{quote ? "no data" : "…"}</span>
                )}
                <Popover>
                  <PopoverTrigger className="rounded-full px-1 font-mono text-[10px] text-silver transition-colors [@media(hover:hover)]:hover:bg-paper [@media(hover:hover)]:hover:text-charcoal">
                    ⓘ
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <CompanyCard symbol={symbol} onRemove={() => list && setList(list.filter((s) => s !== symbol))} />
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>
        {pages > 1 && (
          <div className="flex shrink-0 items-center justify-end gap-1 border-t border-ash px-2.5 py-0.5 font-mono text-[9.5px] text-fog">
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-1 disabled:opacity-30 [@media(hover:hover)]:hover:text-ink">
              ‹
            </button>
            <span className="tabular-nums">
              {page + 1}/{pages}
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} className="px-1 disabled:opacity-30 [@media(hover:hover)]:hover:text-ink">
              ›
            </button>
          </div>
        )}
      </div>
    </Tile>
  );
}
