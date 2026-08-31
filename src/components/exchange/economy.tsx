"use client";

import { AreaChart, Area } from "@/components/charts/area-chart";
import type { ExchangeData } from "@/lib/exchange";

export function Economy({ economy }: { economy: ExchangeData["economy"] }) {
  if (!economy) return <p className="text-[12px] text-fog">Economy data unavailable right now.</p>;
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
      <div className="grid grid-cols-2 gap-2 lg:col-span-2">
        {economy.tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col justify-center rounded-card border border-ash bg-canvas px-3 py-2.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-fog">{tile.label}</span>
            <span className="font-mono text-[19px] font-medium tabular-nums text-ink">{tile.value}</span>
            {tile.sub && <span className="font-mono text-[9px] text-silver">{tile.sub}</span>}
          </div>
        ))}
      </div>
      <div className="rounded-card border border-ash bg-canvas lg:col-span-3">
        <div className="flex items-baseline justify-between border-b border-ash px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">GDP — current US$ trillions</span>
          <span className="font-mono text-[9.5px] text-silver">WORLD BANK · ANNUAL</span>
        </div>
        <div className="h-[210px] px-2 py-1.5">
          {economy.gdpSeries.length >= 2 && (
            <AreaChart data={economy.gdpSeries} className="h-full" aspectRatio={undefined}>
              <Area dataKey="value" stroke="var(--color-gain)" fill="var(--color-gain)" fillOpacity={0.1} />
            </AreaChart>
          )}
        </div>
      </div>
    </div>
  );
}
