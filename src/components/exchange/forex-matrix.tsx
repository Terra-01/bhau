import type { ExchangeData } from "@/lib/exchange";
import { heatStyle } from "@/lib/heat";

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function ForexMatrix({ forex }: { forex: ExchangeData["forex"] }) {
  if (!forex) return <p className="text-[12px] text-fog">Rates unavailable right now.</p>;
  const horizonLabels = forex[0]?.horizons.map((h) => h.label) ?? [];
  return (
    <div className="overflow-x-auto rounded-card border border-ash bg-canvas">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-ash">
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">Pair</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">Price</th>
            {horizonLabels.map((label) => (
              <th key={label} className="px-2 py-2 text-center font-mono text-[10px] font-semibold text-steel">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {forex.map((row) => (
            <tr key={row.pair} className="border-b border-ash last:border-b-0">
              <td className="px-3 py-1.5 font-mono text-[11.5px] font-medium text-charcoal">{row.pair}</td>
              <td className="px-3 py-1.5 text-right font-mono text-[11.5px] tabular-nums text-ink">{fmt.format(row.price)}</td>
              {row.horizons.map((h) => {
                const style = heatStyle(h.pct ?? undefined);
                return (
                  <td key={h.label} className="px-1 py-1">
                    <span
                      className="block rounded-[4px] px-1.5 py-1 text-center font-mono text-[10.5px] tabular-nums"
                      style={{ backgroundColor: style.background, color: style.color }}
                    >
                      {h.pct === null ? "—" : `${h.pct > 0 ? "+" : h.pct < 0 ? "−" : ""}${Math.abs(h.pct).toFixed(2)}%`}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
