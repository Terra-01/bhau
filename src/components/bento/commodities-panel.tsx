import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Sparkline } from "../sparkline";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Futures & major commodities — Name / LTP / Δ / Δ% (USD, labeled honestly). */
export function CommoditiesPanel({ items }: { items: WarRoomData["commodities"] }) {
  return (
    <Tile title="Futures & commodities" meta="COMEX · NYMEX · ICE · USD">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ash">
            {["Name", "", "LTP", "Chg", "%"].map((h, i) => (
              <th key={h || i} className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.07em] text-fog ${i >= 2 ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const prev = item.spark.at(-2);
            const change = prev !== undefined ? item.close - prev : undefined;
            return (
              <tr key={item.symbol} className="border-b border-ash last:border-b-0">
                <td className="px-3 py-[5px] text-[11px] font-medium text-charcoal">{item.name}</td>
                <td className="py-[5px]">
                  <Sparkline values={item.spark} width={44} height={16} />
                </td>
                <td className="px-2 py-[5px] text-right font-mono text-[11px] font-medium tabular-nums text-ink">{fmt.format(item.close)}</td>
                <td className={`px-2 py-[5px] text-right font-mono text-[10.5px] tabular-nums ${change !== undefined ? deltaClass(change) : "text-fog"}`}>
                  {change !== undefined ? `${change > 0 ? "+" : change < 0 ? "−" : ""}${fmt.format(Math.abs(change))}` : "—"}
                </td>
                <td className={`px-3 py-[5px] text-right font-mono text-[10.5px] tabular-nums ${item.change1dPct !== undefined ? deltaClass(item.change1dPct) : "text-fog"}`}>
                  {item.change1dPct !== undefined ? signedPct(item.change1dPct) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Tile>
  );
}
