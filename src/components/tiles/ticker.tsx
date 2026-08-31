import type { StripItem } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Sparkline } from "../sparkline";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Single-line terminal ticker — every instrument visible, no cards. */
export function Ticker({ items }: { items: StripItem[] }) {
  return (
    <div className="flex items-stretch overflow-x-auto rounded-card border border-ash bg-canvas">
      {items.map((item, i) => (
        <div
          key={item.symbol}
          className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 ${i > 0 ? "border-l border-ash" : ""}`}
        >
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium leading-tight text-fog">{item.name}</div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-mono text-[13px] font-medium tabular-nums text-ink">
                {item.symbol === "^BREADTH" ? `${item.close.toFixed(0)}%` : fmt.format(item.close)}
              </span>
              {item.change1dPct !== undefined && (
                <span className={`font-mono text-[10px] tabular-nums ${deltaClass(item.change1dPct)}`}>
                  {signedPct(item.change1dPct, 1)}
                </span>
              )}
            </div>
          </div>
          <Sparkline values={item.spark} width={44} height={20} />
        </div>
      ))}
    </div>
  );
}
