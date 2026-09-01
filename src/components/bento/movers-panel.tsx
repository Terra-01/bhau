"use client";

import { useState } from "react";
import type { ExchangeData, StockRow } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { compactInr } from "@/lib/heat";
import { Tile } from "../tiles/tile";
import { HistoryChart } from "./history-chart";

const TABS = [
  { id: "mostTraded", label: "Most traded" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
] as const;

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Pill({ pct }: { pct: number }) {
  return (
    <span className="rounded-[6px] px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums text-white" style={{ background: pct >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}>
      {signedPct(pct)}
    </span>
  );
}

export function MoversPanel({ data }: { data: Pick<ExchangeData, "mostTraded" | "gainers" | "losers" | "asOf"> }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("mostTraded");
  const rows: StockRow[] = data[tab] ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const shown = selected ?? rows[0]?.symbol;

  return (
    <Tile
      title="Stocks"
      meta={
        <span className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setSelected(null);
              }}
              className={`rounded-full px-2 py-px font-sans text-[9.5px] font-semibold transition-colors duration-150 ${
                tab === id ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="h-[130px] shrink-0 border-b border-ash pt-0.5 xl:h-auto xl:min-h-0 xl:flex-[0.75]">
          {shown ? <HistoryChart symbol={shown} /> : <div className="flex h-full items-center justify-center text-[11px] text-fog">Accumulating sessions…</div>}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.symbol}>
              <button
                type="button"
                onClick={() => setSelected(row.symbol)}
                className={`flex w-full items-baseline gap-2 border-b border-ash px-2.5 py-[3px] text-left transition-colors duration-150 ${
                  shown === row.symbol ? "bg-paper" : "[@media(hover:hover)]:hover:bg-paper/60"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-charcoal">{row.symbol}</span>
                {tab === "mostTraded" && <span className="font-mono text-[9.5px] tabular-nums text-silver">{compactInr(row.turnover)}</span>}
                <span className="font-mono text-[11px] tabular-nums text-ink">₹{fmt.format(row.close)}</span>
                {tab === "mostTraded" ? (
                  <span className={`w-14 text-right font-mono text-[10px] tabular-nums ${deltaClass(row.changePct)}`}>{signedPct(row.changePct)}</span>
                ) : (
                  <Pill pct={row.changePct} />
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="shrink-0 border-t border-ash px-2.5 py-0.5 text-right font-mono text-[8.5px] text-silver">
          EOD · {data.asOf} · FULL NSE UNIVERSE
        </div>
      </div>
    </Tile>
  );
}
