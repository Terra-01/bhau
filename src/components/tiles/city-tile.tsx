"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react";
import { InsightLine } from "@/components/insight-line";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { useCarousel } from "@/lib/use-carousel";
import { Tile } from "./tile";

// City pulse: what's happening on Indian streets today — pump prices
// (genuinely city-level via state taxes), the IBJA bullion fix (national
// by construction), and the weather. One tile, two auto-rotating tabs.

function iconFor(code: number) {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return Snowflake;
  if (code <= 82) return CloudRain;
  if (code <= 86) return Snowflake;
  return CloudLightning;
}

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = ["prices", "weather"] as const;

export function CityTile({
  weather,
  pulse,
}: {
  weather: WarRoomData["weather"];
  pulse: WarRoomData["cityPulse"];
}) {
  const { index, select, pauseProps } = useCarousel(TABS.length, 19_000);
  const showPrices = TABS[index] === "prices" && pulse !== null;

  const priciest = pulse?.cities.reduce<{ city: string; petrol: number } | null>(
    (best, c) => (c.petrol !== undefined && (!best || c.petrol > best.petrol) ? { city: c.city, petrol: c.petrol } : best),
    null,
  );
  const gold = pulse?.metals.find((m) => m.name.startsWith("Gold"));
  const hottest = weather?.slice(0, 7).reduce<{ city: string; tmax: number } | null>(
    (best, w) => (!best || w.tmax > best.tmax ? { city: w.city, tmax: w.tmax } : best),
    null,
  );

  return (
    <Tile
      title="City pulse"
      meta={
        <span className="flex items-center gap-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => select(i)}
              className={`rounded-full px-1.5 py-px font-sans text-[8.5px] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
                TABS[index] === t ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:text-charcoal"
              }`}
            >
              {t === "prices" ? "₹" : "°C"}
            </button>
          ))}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col" {...pauseProps}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showPrices ? (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-ash">
                    <th className="px-2.5 py-0.5 text-left text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">City</th>
                    <th className="px-1 py-0.5 text-right text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">Petrol</th>
                    <th className="px-2.5 py-0.5 text-right text-[8px] font-semibold uppercase tracking-[0.07em] text-fog">Diesel</th>
                  </tr>
                </thead>
                <tbody>
                  {pulse!.cities.map((c) => (
                    <tr key={c.city} className="border-b border-ash last:border-b-0">
                      <td className="truncate px-2.5 py-[2px] text-[10px] leading-none text-charcoal">{c.city}</td>
                      <td className="px-1 py-[2px] text-right font-mono text-[10px] leading-none tabular-nums text-ink">
                        {c.petrol !== undefined ? inr2.format(c.petrol) : "—"}
                      </td>
                      <td className="px-2.5 py-[2px] text-right font-mono text-[10px] leading-none tabular-nums text-ink">
                        {c.diesel !== undefined ? inr2.format(c.diesel) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pulse!.metals.length > 0 && (
                <div className="mt-auto shrink-0 border-t border-ash px-2.5 py-[2px]">
                  {pulse!.metals.map((m) => (
                    <div key={m.name} className="flex items-baseline justify-between gap-1 leading-tight">
                      <span className="whitespace-nowrap text-[8.5px] text-fog">
                        {m.name.split(" ")[0]} <span className="text-silver">{m.unit} · IBJA</span>
                      </span>
                      <span className="whitespace-nowrap font-mono text-[10px] font-medium tabular-nums text-ink">
                        ₹{inr0.format(m.value)}
                        {m.changePct !== undefined && (
                          <span className={`ml-1 text-[8.5px] ${deltaClass(m.changePct)}`}>{signedPct(m.changePct, 1)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : weather ? (
            <ul className="px-2.5 py-0.5">
              {weather.slice(0, 7).map((w) => {
                const Icon = iconFor(w.code);
                return (
                  <li key={w.city} className="flex items-center gap-1.5 border-b border-ash py-[2.5px] last:border-b-0">
                    <Icon size={12} className="shrink-0 text-steel" strokeWidth={1.75} />
                    <span className="min-w-0 truncate text-[10px] text-charcoal">{w.city}</span>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-ink">
                      {w.tmax}°<span className="text-silver">/{w.tmin}°</span>
                    </span>
                    {w.rainProb >= 30 && <span className="font-mono text-[8.5px] tabular-nums text-blue">{w.rainProb}%</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2.5 py-3 text-[11px] text-fog">City data unavailable.</p>
          )}
        </div>
        {showPrices && priciest ? (
          <InsightLine meta="₹/L · DAILY">
            Petrol top {priciest.city} {inr2.format(priciest.petrol)}
            {gold?.changePct !== undefined && (
              <>
                {" "}· gold <span className={deltaClass(gold.changePct)}>{signedPct(gold.changePct, 1)}</span> d/d
              </>
            )}
          </InsightLine>
        ) : !showPrices && hottest ? (
          <InsightLine meta="OPEN-METEO">
            Hottest {hottest.city} {hottest.tmax}°
            {(() => {
              const wet = weather?.slice(0, 7).filter((w) => w.rainProb >= 50).length ?? 0;
              return wet > 0 ? ` · rain likely in ${wet} of 7` : " · no heavy rain signals";
            })()}
          </InsightLine>
        ) : null}
      </div>
    </Tile>
  );
}
