"use client";

import { Layers } from "lucide-react";
import { AssetPopover } from "@/components/asset-popover";
import { InsightLine } from "@/components/insight-line";
import type { ExchangeData, StockRow } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { compactInr } from "@/lib/heat";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Liquid NSE ETFs, turnover-ranked from the daily bhavcopy. */
export function EtfPanel({ etfs, asOf }: { etfs: StockRow[]; asOf: ExchangeData["asOf"] }) {
  const best = [...etfs].sort((a, b) => b.changePct - a.changePct)[0];
  const top = etfs[0];
  return (
    <Tile title="ETFs" icon={<Layers size={10} strokeWidth={2} className="text-gain" />} meta="BY TURNOVER">
      <div className="flex h-full min-h-0 flex-col">
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {etfs.map((etf) => (
            <AssetPopover
              key={etf.symbol}
              symbol={etf.symbol}
              render={
                <li
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-baseline gap-2 border-b border-ash px-2.5 py-[3px] transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-charcoal">{etf.symbol}</span>
                  <span className="font-mono text-[9.5px] tabular-nums text-silver">{compactInr(etf.turnover)}</span>
                  <span className="font-mono text-[11px] tabular-nums text-ink">₹{fmt.format(etf.close)}</span>
                  <span className={`w-14 text-right font-mono text-[10px] tabular-nums ${deltaClass(etf.changePct)}`}>{signedPct(etf.changePct)}</span>
                </li>
              }
            />
          ))}
          {etfs.length === 0 && <li className="px-2.5 py-3 text-[11px] text-fog">Accumulating sessions…</li>}
        </ul>
        <InsightLine meta={`EOD · ${asOf.slice(5).replace("-", "/")}`}>
          {top && best ? (
            <>
              {top.symbol} leads turnover · best {best.symbol}{" "}
              <span className={deltaClass(best.changePct)}>{signedPct(best.changePct, 1)}</span>
            </>
          ) : (
            "Liquid NSE ETFs, ranked from the daily bhavcopy"
          )}
        </InsightLine>
      </div>
    </Tile>
  );
}
