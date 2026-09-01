import type { ExchangeData } from "@/lib/exchange";
import { heatStyle } from "@/lib/heat";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Compact heat matrix: pair + price stacked in the lead cell, four
// horizons of banded heat. Sized to sit beside Off the Tape.
const SHOWN_HORIZONS = ["1D", "1M", "1Y", "5Y"];

export function ForexMatrix({ forex }: { forex: ExchangeData["forex"] }) {
  return (
    <Tile title="Forex vs INR" meta="ECB · DAILY">
      {!forex ? (
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable right now.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ash">
              <th className="px-2.5 py-0.5 text-left text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">Pair</th>
              {SHOWN_HORIZONS.map((label) => (
                <th key={label} className="px-1 py-0.5 text-center font-mono text-[8.5px] font-semibold text-fog">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forex.map((row) => (
              <tr key={row.pair} className="border-b border-ash last:border-b-0">
                <td className="px-2.5 py-[2px]">
                  <span className="block font-mono text-[10.5px] font-medium leading-tight text-charcoal">{row.pair}</span>
                  <span className="block font-mono text-[8.5px] leading-tight tabular-nums text-silver">{fmt.format(row.price)}</span>
                </td>
                {row.horizons
                  .filter((h) => SHOWN_HORIZONS.includes(h.label))
                  .map((h) => {
                    const style = heatStyle(h.pct ?? undefined);
                    return (
                      <td key={h.label} className="px-[3px] py-[2px]">
                        <span
                          className="block rounded-[3px] px-0.5 py-[3px] text-center font-mono text-[9px] tabular-nums"
                          style={{ backgroundColor: style.background, color: style.color }}
                        >
                          {h.pct === null ? "—" : `${h.pct > 0 ? "+" : h.pct < 0 ? "−" : ""}${Math.abs(h.pct).toFixed(1)}%`}
                        </span>
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Tile>
  );
}
