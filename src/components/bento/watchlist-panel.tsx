"use client";

import { Eye } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssetPopover } from "@/components/asset-popover";
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
// Everything is one editable list (localStorage) — the indices are just
// rows like any stock, removable and re-addable. Defaults: NIFTY, SENSEX
// and the top-20 NSE names. The chart tours the list on its own.
const STORAGE_KEY = "bhau-watchlist-v2";
const MAX = 20;
const DEFAULTS = [
  "^NSEI", "^BSESN",
  "RELIANCE", "HDFCBANK", "TCS", "BHARTIARTL", "ICICIBANK",
  "SBIN", "INFY", "HINDUNILVR", "BAJFINANCE", "ITC",
  "LT", "HCLTECH", "KOTAKBANK", "SUNPHARMA", "MARUTI",
  "AXISBANK", "ULTRACEMCO", "NTPC",
];
const NAME_OF: Record<string, string> = { "^NSEI": "NIFTY 50", "^BSESN": "SENSEX" };
const ROTATE_MS = 5_000;
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

export function WatchlistPanel() {
  const [list, setList] = useState<string[] | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  // Selection and page travel together so auto-rotation can keep the
  // selected row in view with a single pure state update.
  const [view, setView] = useState<{ selected: string; page: number }>({ selected: "^NSEI", page: 0 });
  const [draft, setDraft] = useState("");
  const holdUntil = useRef(0);
  const hovering = useRef(false);
  const PAGE_SIZE = 10;
  const { selected, page } = view;
  const pages = Math.max(1, Math.ceil((list?.length ?? 0) / PAGE_SIZE));
  // Full windows: the last page slides back so every page shows PAGE_SIZE
  // rows — no dead space under a short final page.
  const start = list ? (page === pages - 1 ? Math.max(0, list.length - PAGE_SIZE) : page * PAGE_SIZE) : 0;
  const visible = list?.slice(start, start + PAGE_SIZE) ?? [];

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
    const symbols = list;
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
        const next = list[(list.indexOf(current.selected) + 1) % list.length] ?? list[0];
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
      icon={<Eye size={10} strokeWidth={2} className="text-blue" />}
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
        <div className="min-h-0 flex-[0.8] border-b border-ash pt-0.5">
          <MarketChart symbol={selected} label={NAME_OF[selected] ?? selected} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FlipView id={page}>
          {visible.map((symbol) => {
            const quote = quotes.get(symbol);
            const isIndex = symbol.startsWith("^");
            return (
              <AssetPopover
                key={symbol}
                symbol={symbol}
                name={NAME_OF[symbol]}
                onOpen={() => selectSymbol(symbol)}
                onRemove={() => list && setList(list.filter((s) => s !== symbol))}
                render={
                  <div role="button" tabIndex={0} className={`cursor-pointer ${rowClass(symbol)}`}>
                    <span
                      className={`min-w-0 flex-1 truncate text-left ${
                        isIndex ? "text-[12px] font-semibold text-charcoal" : "font-mono text-[11.5px] font-medium text-charcoal"
                      }`}
                    >
                      {NAME_OF[symbol] ?? symbol}
                    </span>
                    {quote?.found ? (
                      <>
                        <TickFlash value={quote.close} className="font-mono text-[11.5px] tabular-nums text-ink">
                          {isIndex ? "" : "₹"}
                          {fmt.format(quote.close!)}
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
                  </div>
                }
              />
            );
          })}
          </FlipView>
        </div>

        {(
          <InsightLine
            meta={
              <span className="flex items-center gap-1.5">
                {liveMeta.phase && liveMeta.phase !== "closed" ? (
                  <LiveChip phase={liveMeta.phase} source={liveMeta.source} />
                ) : (
                  (liveMeta.source ?? "yahoo").toUpperCase()
                )}
                {pages > 1 && (
                  <span className="flex items-center gap-0.5 font-mono text-[9px] text-fog">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goPage(-1);
                      }}
                      disabled={page === 0}
                      className="px-0.5 disabled:opacity-30 [@media(hover:hover)]:hover:text-ink"
                    >
                      ‹
                    </button>
                    <span className="tabular-nums">
                      {page + 1}/{pages}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goPage(1);
                      }}
                      disabled={page === pages - 1}
                      className="px-0.5 disabled:opacity-30 [@media(hover:hover)]:hover:text-ink"
                    >
                      ›
                    </button>
                  </span>
                )}
              </span>
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
