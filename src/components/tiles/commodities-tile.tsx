import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Sparkline } from "../sparkline";
import { Tile } from "./tile";

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CommoditiesTile({ items }: { items: WarRoomData["commodities"] }) {
  return (
    <Tile title="Commodities" meta="FUTURES · USD" scroll>
      <ul className="px-2.5 py-1">
        {items.length === 0 && <li className="py-3 text-[11.5px] text-fog">Accumulating quotes…</li>}
        {items.map((item) => (
          <li key={item.symbol} className="flex items-center gap-2 border-b border-ash py-[4px] last:border-b-0">
            <span className="w-14 shrink-0 text-[10.5px] font-medium text-steel">{item.name}</span>
            <Sparkline values={item.spark} width={52} height={16} />
            <span className="ml-auto font-mono text-[11.5px] font-medium tabular-nums text-ink">{fmt.format(item.close)}</span>
            {item.change1dPct !== undefined && (
              <span className={`w-12 text-right font-mono text-[10px] tabular-nums ${deltaClass(item.change1dPct)}`}>
                {signedPct(item.change1dPct, 1)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Tile>
  );
}
