"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Tile } from "./tile";

// City pulse: what's happening on Indian streets today — pump prices
// (genuinely city-level via state taxes), the IBJA bullion fix (national
// by construction), and the weather. One tile, two tabs.

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

export function CityTile({
  weather,
  pulse,
}: {
  weather: WarRoomData["weather"];
  pulse: WarRoomData["cityPulse"];
}) {
  const [tab, setTab] = useState<"prices" | "weather">("prices");
  const showPrices = tab === "prices" && pulse !== null;

  return (
    <Tile
      title="City pulse"
      meta={
        <span className="flex items-center gap-1">
          {(["prices", "weather"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-1.5 py-px font-sans text-[8.5px] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
                tab === t ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:text-charcoal"
              }`}
            >
              {t === "prices" ? "₹" : "°C"}
            </button>
          ))}
        </span>
      }
    >
      {showPrices ? (
        <div className="flex h-full flex-col">
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
                  <td className="truncate px-2.5 py-[2.5px] text-[10px] text-charcoal">{c.city}</td>
                  <td className="px-1 py-[2.5px] text-right font-mono text-[10px] tabular-nums text-ink">
                    {c.petrol !== undefined ? inr2.format(c.petrol) : "—"}
                  </td>
                  <td className="px-2.5 py-[2.5px] text-right font-mono text-[10px] tabular-nums text-ink">
                    {c.diesel !== undefined ? inr2.format(c.diesel) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pulse!.metals.length > 0 && (
            <div className="mt-auto shrink-0 border-t border-ash px-2.5 py-1">
              {pulse!.metals.map((m) => (
                <div key={m.name} className="flex items-baseline justify-between gap-1">
                  <span className="text-[9px] text-fog">
                    {m.name} <span className="text-silver">{m.unit}</span>
                  </span>
                  <span className="font-mono text-[10px] font-medium tabular-nums text-ink">
                    ₹{inr0.format(m.value)}
                    {m.changePct !== undefined && (
                      <span className={`ml-1 text-[8.5px] ${deltaClass(m.changePct)}`}>{signedPct(m.changePct, 1)}</span>
                    )}
                  </span>
                </div>
              ))}
              <div className="text-[7.5px] text-silver">IBJA fix · pump ₹/L</div>
            </div>
          )}
        </div>
      ) : weather ? (
        <ul className="px-2.5 py-0.5">
          {weather.slice(0, 6).map((w) => {
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
    </Tile>
  );
}
