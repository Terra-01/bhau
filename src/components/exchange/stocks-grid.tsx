import type { ExchangeData, StockRow } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { compactInr } from "@/lib/heat";
import { Avatar } from "./section";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Δ as a filled pill — reserved for the extremes lists (TradingView's own restraint). */
function DeltaPill({ pct }: { pct: number }) {
  return (
    <span
      className="rounded-[6px] px-1.5 py-px font-mono text-[10.5px] font-semibold tabular-nums text-white"
      style={{ background: pct >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
    >
      {signedPct(pct)}
    </span>
  );
}

function List({
  title,
  rows,
  pills = false,
  showTurnover = false,
}: {
  title: string;
  rows: StockRow[];
  pills?: boolean;
  showTurnover?: boolean;
}) {
  return (
    <div className="rounded-card border border-ash bg-canvas">
      <div className="border-b border-ash px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">
        {title}
      </div>
      <ul className="px-2.5 py-1">
        {rows.length === 0 && <li className="py-3 text-[11.5px] text-fog">Accumulating sessions…</li>}
        {rows.map((row) => (
          <li key={row.symbol} className="flex items-center gap-2 border-b border-ash py-[5px] last:border-b-0">
            <Avatar symbol={row.symbol} />
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-charcoal">{row.symbol}</span>
            {showTurnover && <span className="font-mono text-[9.5px] tabular-nums text-silver">{compactInr(row.turnover)}</span>}
            <span className="font-mono text-[11px] tabular-nums text-ink">{fmt.format(row.close)}</span>
            {pills ? (
              <DeltaPill pct={row.changePct} />
            ) : (
              <span className={`w-14 text-right font-mono text-[10.5px] tabular-nums ${deltaClass(row.changePct)}`}>
                {signedPct(row.changePct)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StocksGrid({ data }: { data: ExchangeData }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
      <List title="Most traded — ₹ value" rows={data.mostTraded} showTurnover />
      <List title="Most volatile" rows={data.volatile} pills />
      <List title="Gainers" rows={data.gainers} pills />
      <List title="Losers" rows={data.losers} pills />
    </div>
  );
}

export function EtfRow({ etfs }: { etfs: StockRow[] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {etfs.length === 0 && <span className="py-2 text-[11.5px] text-fog">Accumulating sessions…</span>}
      {etfs.map((etf) => (
        <div key={etf.symbol} className="flex shrink-0 items-baseline gap-1.5 rounded-card border border-ash bg-canvas px-2.5 py-1.5">
          <span className="font-mono text-[11px] font-medium text-charcoal">{etf.symbol}</span>
          <span className="font-mono text-[11px] tabular-nums text-ink">{fmt.format(etf.close)}</span>
          <span className={`font-mono text-[10px] tabular-nums ${deltaClass(etf.changePct)}`}>{signedPct(etf.changePct)}</span>
        </div>
      ))}
    </div>
  );
}
