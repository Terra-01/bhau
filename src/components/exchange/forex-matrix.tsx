import type { ExchangeData } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Forex vs INR as a plain rates table — same grammar as Futures & Commodities. */
export function ForexRates({ forex }: { forex: ExchangeData["forex"] }) {
  return (
    <Tile title="Forex vs INR" meta="ECB · DAILY">
      {!forex ? (
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ash">
              <th className="px-2.5 py-0.5 text-left text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">Pair</th>
              <th className="px-1.5 py-0.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">LTP</th>
              <th className="px-1.5 py-0.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">Chg</th>
              <th className="px-2.5 py-0.5 text-right text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">%</th>
            </tr>
          </thead>
          <tbody>
            {forex.map((row) => {
              const pct = row.horizons.find((h) => h.label === "1D")?.pct ?? null;
              const chg = pct !== null ? row.price - row.price / (1 + pct / 100) : null;
              return (
                <tr key={row.pair} className="border-b border-ash last:border-b-0">
                  <td className="px-2.5 py-[3px] font-mono text-[10.5px] font-medium text-charcoal">{row.pair}</td>
                  <td className="px-1.5 py-[3px] text-right font-mono text-[10.5px] tabular-nums text-ink">₹{fmt.format(row.price)}</td>
                  <td className={`px-1.5 py-[3px] text-right font-mono text-[9.5px] tabular-nums ${chg !== null ? deltaClass(chg) : "text-fog"}`}>
                    {chg === null ? "—" : `${chg > 0 ? "+" : chg < 0 ? "−" : ""}${Math.abs(chg).toFixed(row.price < 5 ? 4 : 2)}`}
                  </td>
                  <td className={`px-2.5 py-[3px] text-right font-mono text-[9.5px] tabular-nums ${pct !== null ? deltaClass(pct) : "text-fog"}`}>
                    {pct === null ? "—" : signedPct(pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Tile>
  );
}
