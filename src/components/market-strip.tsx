import type { StripItem } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Sparkline } from "./sparkline";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function MarketStrip({ items }: { items: StripItem[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <div
          key={item.symbol}
          className="flex min-w-[168px] flex-1 items-center justify-between gap-3 rounded-card border border-ash bg-canvas px-3.5 py-2.5"
        >
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-steel whitespace-nowrap">{item.name}</div>
            <div className="font-mono text-[16px] font-medium text-ink tabular-nums whitespace-nowrap">
              {item.symbol === "^BREADTH" ? `${item.close.toFixed(1)}%` : fmt.format(item.close)}
            </div>
            {item.change1dPct !== undefined && (
              <div className={`font-mono text-[11px] tabular-nums ${deltaClass(item.change1dPct)}`}>
                {signedPct(item.change1dPct)}
              </div>
            )}
          </div>
          <Sparkline values={item.spark} width={72} height={30} />
        </div>
      ))}
    </div>
  );
}
