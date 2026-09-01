import type { ExchangeData } from "@/lib/exchange";
import { deltaClass, signedPct } from "@/lib/format";
import { Sparkline } from "../sparkline";
import { Tile } from "../tiles/tile";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Forex vs INR: where INR sits (₹ per unit), the 30-day shape, and the
// 1-month move — the horizon on which ECB reference rates are actually
// informative. JPY follows market convention (per ¥100).
export function ForexRates({ forex }: { forex: ExchangeData["forex"] }) {
  return (
    <Tile title="Forex vs INR" meta="ECB REF">
      {!forex ? (
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ash">
              <th className="px-2.5 py-0.5 text-left text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">Pair</th>
              <th className="px-1 py-0.5 text-left text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">30D</th>
              <th className="px-1 py-0.5 text-right text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">₹</th>
              <th className="px-2.5 py-0.5 text-right text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">1M</th>
            </tr>
          </thead>
          <tbody>
            {forex.map((row) => {
              const scale = row.pair === "JPY" ? 100 : 1;
              return (
                <tr key={row.pair} className="border-b border-ash last:border-b-0">
                  <td className="px-2.5 py-[2.5px] font-mono text-[10px] font-semibold leading-none text-charcoal">
                    {row.pair}
                    {scale !== 1 && <span className="font-sans text-[7.5px] font-normal text-silver"> ×100</span>}
                  </td>
                  <td className="py-[2.5px]">
                    <Sparkline values={row.spark} width={40} height={13} />
                  </td>
                  <td className="px-1 py-[2.5px] text-right font-mono text-[10.5px] font-medium leading-none tabular-nums text-ink">
                    {fmt.format(row.price * scale)}
                  </td>
                  <td className={`px-2.5 py-[2.5px] text-right font-mono text-[9.5px] leading-none tabular-nums ${row.m1 !== null ? deltaClass(row.m1) : "text-fog"}`}>
                    {row.m1 !== null ? signedPct(row.m1, 1) : "—"}
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
