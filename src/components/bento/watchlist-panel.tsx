"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CompanyCard } from "@/components/company-card";
import { InsightLine } from "@/components/insight-line";
import { LiveChip } from "@/components/live-chip";
import { FlipView } from "@/components/motion/flip-view";
import { TickFlash } from "@/components/motion/tick-flash";
import { PlusIcon } from "@/components/ui/plus";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deltaClass, signedPct } from "@/lib/format";
import { isLive, phaseAt, type MarketPhase } from "@/lib/market-clock";
import { Tile } from "../tiles/tile";
import { MarketChart } from "./market-chart";

// The hero watchlist: chart of the selected row on top, quote rows below.
// NIFTY 50 and SENSEX are pinned; the rest is the user's list
// (localStorage, max 20). Rows and chart share one Yahoo source, refreshed
// every minute, and the chart rotates through the list on its own.
const STORAGE_KEY = "bhau-watchlist";
const MAX = 20;
const DEFAULTS = [
  "RELIANCE", "HDFCBANK", "TCS", "INFY", "ICICIBANK",
  "SBIN", "BHARTIARTL", "ITC", "LT", "HINDUNILVR",
];
const PINNED = [
  { symbol: "^NSEI", label: "NIFTY 50" },
  { symbol: "^BSESN", label: "SENSEX" },
] as const;
const ROTATE_MS = 12_000;
const HOLD_MS = 45_000;

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
  /** Server-rendered EOD fallback for the pinned indices: [nifty, sensex]. */
  pinnedQuotes: Array<{ symbol: string; close: number; changePct?: number }>;
}) {
  const [list, setList] = useState<string[] | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  // Selection and page travel together so auto-rotation can keep the
  // selected row in view with a single pure state update.
  const [view, setView] = useState<{ selected: string; page: number }>({ selected: "^NSEI", page: 0 });
  const [draft, setDraft] = useState("");
  const holdUntil = useRef(0);
  const hovering = useRef(false);
  const PAGE_SIZE = 6;
  const { selected, page } = view;
  const pages = Math.max(1, Math.ceil((list?.length ?? 0) / PAGE_SIZE));
  const visible = list?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  useEffect(() => {
    const id = requestAnimationFrame(() => setList(loadList()));
    return () => cancelAnimationFrame(id);
  }, []);

  // Quotes for pinned + list in one call — every 30s during the session,
  // every 5 min otherwise; hidden tabs skip fetches.
  const [liveMeta, setLiveMeta] = useState<{ source?: string; phase?: MarketPhase }>({});
  useEffect(() => {
    if (!list) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* private mode */
    }
    const symbols = [...PINNED.map((p) => p.symbol), ...list];
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      if (!document.hidden) {
        try {
          const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
          const d = (await res.json()) as { quotes: Quote[]; source?: string; phase?: MarketPhase };
          if (alive) {
            setQuotes(new Map(d.quotes.map((q) => [q.symbol, q])));
            setLiveMeta({ source: d.source, phase: d.phase });
          }
        } catch {
          /* keep last quotes */
        }
      }
      if (!alive) return;
      timer = window.setTimeout(load, isLive(phaseAt(new Date())) ? 30_000 : 300_000);
    };
    load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [list]);

  // The chart tours the list on its own; interacting holds it.
  useEffect(() => {
    if (!list || list.length === 0) return;
    const id = setInterval(() => {
      if (document.hidden || hovering.current || Date.now() < holdUntil.current) return;
      setView((current) => {
        const all = [...PINNED.map((p) => p.symbol), ...list];
        const next = all[(all.indexOf(current.selected) + 1) % all.length] ?? all[0];
        const listIndex = list.indexOf(next);
        return { selected: next, page: listIndex >= 0 ? Math.floor(listIndex / PAGE_SIZE) : current.page };
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [list]);

  const selectSymbol = useCallback((symbol: string) => {
    holdUntil.current = Date.now() + HOLD_MS;
    setView((v) => ({ ...v, selected: symbol }));
  }, []);
  const goPage = useCallback(
    (delta: number) => {
      holdUntil.current = Date.now() + HOLD_MS;
      setView((v) => ({ ...v, page: Math.min(pages - 1, Math.max(0, v.page + delta)) }));
    },
    [pages],
  );

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

  // One-line insight from the loaded quotes.
  const listQuotes = (list ?? []).map((s) => quotes.get(s)).filter((q): q is Quote => Boolean(q?.found));
  const up = listQuotes.filter((q) => (q.changePct ?? 0) > 0).length;
  const best = [...listQuotes].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];

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
              <PlusIcon size={9} className="flex" /> ADD
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
      <div
        className="flex h-full min-h-0 flex-col"
        onMouseEnter={() => {
          hovering.current = true;
        }}
        onMouseLeave={() => {
          hovering.current = false;
        }}
      >
        <div className="h-[160px] shrink-0 border-b border-ash pt-0.5 xl:h-auto xl:min-h-0 xl:flex-[0.85]">
          <MarketChart symbol={selected} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {PINNED.map((pin) => {
            const live = quotes.get(pin.symbol);
            const quote = live?.found
              ? { close: live.close!, changePct: live.changePct }
              : pinnedQuotes.find((q) => q.symbol === pin.symbol);
            return (
              <button key={pin.symbol} type="button" onClick={() => selectSymbol(pin.symbol)} className={rowClass(pin.symbol)}>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-charcoal">{pin.label}</span>
                {quote && (
                  <>
                    <TickFlash value={quote.close} className="font-mono text-[12px] font-medium tabular-nums text-ink">
                      {fmt.format(quote.close)}
                    </TickFlash>
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
          <FlipView id={page}>
          {visible.map((symbol) => {
            const quote = quotes.get(symbol);
            return (
              <div key={symbol} className={rowClass(symbol)}>
                <button
                  type="button"
                  onClick={() => selectSymbol(symbol)}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[11.5px] font-medium text-charcoal"
                >
                  {symbol}
                </button>
                {quote?.found ? (
                  <>
                    <TickFlash value={quote.close} className="font-mono text-[11.5px] tabular-nums text-ink">
                      ₹{fmt.format(quote.close!)}
                    </TickFlash>
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
          </FlipView>
        </div>
        {pages > 1 && (
          <div className="flex shrink-0 items-center justify-end gap-1 border-t border-ash px-2.5 py-0.5 font-mono text-[9.5px] text-fog">
            <button type="button" onClick={() => goPage(-1)} disabled={page === 0} className="px-1 disabled:opacity-30 [@media(hover:hover)]:hover:text-ink">
              ‹
            </button>
            <span className="tabular-nums">
              {page + 1}/{pages}
            </span>
            <button type="button" onClick={() => goPage(1)} disabled={page === pages - 1} className="px-1 disabled:opacity-30 [@media(hover:hover)]:hover:text-ink">
              ›
            </button>
          </div>
        )}
        {listQuotes.length > 0 && (
          <InsightLine
            meta={
              liveMeta.phase && liveMeta.phase !== "closed" ? (
                <LiveChip phase={liveMeta.phase} source={liveMeta.source} />
              ) : (
                (liveMeta.source ?? "yahoo").toUpperCase()
              )
            }
          >
            {up}/{listQuotes.length} watched up
            {best && best.changePct !== undefined && (
              <>
                {" "}· best {best.symbol} <span className={deltaClass(best.changePct)}>{signedPct(best.changePct)}</span>
              </>
            )}
          </InsightLine>
        )}
      </div>
    </Tile>
  );
}
