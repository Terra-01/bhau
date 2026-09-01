"use client";

import { Cloud, CloudDrizzle, CloudFog, Coins, MapPin } from "lucide-react";
import { useState } from "react";
import { InfoCard, InfoPopover, type InfoCardProps } from "@/components/info-popover";
import { RowPopover } from "@/components/row-popover";
import { InsightLine } from "@/components/insight-line";
import { FlipView } from "@/components/motion/flip-view";
import { CloudLightningIcon } from "@/components/ui/cloud-lightning";
import { CloudRainIcon } from "@/components/ui/cloud-rain";
import { CloudSunIcon } from "@/components/ui/cloud-sun";
import { SnowflakeIcon } from "@/components/ui/snowflake";
import { SunIcon } from "@/components/ui/sun";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { useCarousel } from "@/lib/use-carousel";
import { Tile } from "./tile";

// City pulse: what's happening on Indian streets today — pump prices
// (genuinely city-level via state taxes), the IBJA bullion fix (national
// by construction), and the weather. One tile, two auto-rotating tabs.
// Weather glyphs are lucide-animated where the registry has them
// (hover-triggered); the rest stay static lucide.

function WeatherIcon({ code, size, className = "" }: { code: number; size: number; className?: string }) {
  // color follows the condition — amber sun, blue rain, violet storms
  if (code === 0) return <SunIcon size={size} className={`${className} text-warn`} />;
  if (code <= 2) return <CloudSunIcon size={size} className={`${className} text-warn`} />;
  if (code === 3) return <Cloud size={size} className={`${className} text-steel`} strokeWidth={1.75} />;
  if (code <= 48) return <CloudFog size={size} className={`${className} text-steel`} strokeWidth={1.75} />;
  if (code <= 57) return <CloudDrizzle size={size} className={`${className} text-blue`} strokeWidth={1.75} />;
  if (code <= 67 || (code > 77 && code <= 82)) return <CloudRainIcon size={size} className={`${className} text-blue`} />;
  if (code <= 86) return <SnowflakeIcon size={size} className={`${className} text-sapphire`} />;
  return <CloudLightningIcon size={size} className={`${className} text-lavender`} />;
}

function conditionOf(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
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
  const [detail, setDetail] = useState<{ card: InfoCardProps; el: HTMLElement } | null>(null);

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
      icon={<MapPin size={10} strokeWidth={2} className="text-tangerine" />}
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
        <FlipView id={showPrices ? "prices" : "weather"} className="flex-1">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
                  {pulse!.cities.map((c) => {
                    const card: InfoCardProps = {
                      title: `${c.city} pump prices`,
                      sub: "Revised daily at 06:00 IST",
                      rows: [
                        ["Petrol /L", c.petrol !== undefined ? `₹${inr2.format(c.petrol)}` : "—"],
                        ["Diesel /L", c.diesel !== undefined ? `₹${inr2.format(c.diesel)}` : "—"],
                      ],
                      note: "State VAT makes fuel genuinely city-level. Source: goodreturns city tables (Pune via its city page).",
                    };
                    return (
                        <tr
                          key={c.city}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => setDetail({ card, el: e.currentTarget })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setDetail({ card, el: e.currentTarget });
                          }}
                          className="cursor-pointer border-b border-ash transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60"
                        >
                          <td className="truncate px-2.5 py-[2px] text-[10px] leading-none text-charcoal">{c.city}</td>
                          <td className="px-1 py-[2px] text-right font-mono text-[10px] leading-none tabular-nums text-ink">
                            {c.petrol !== undefined ? inr2.format(c.petrol) : "—"}
                          </td>
                          <td className="px-2.5 py-[2px] text-right font-mono text-[10px] leading-none tabular-nums text-ink">
                            {c.diesel !== undefined ? inr2.format(c.diesel) : "—"}
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
              <RowPopover anchor={detail?.el ?? null} onClose={() => setDetail(null)}>
                {detail && <InfoCard {...detail.card} />}
              </RowPopover>
              {pulse!.metals.length > 0 && (
                <div className="mt-auto shrink-0 border-t border-ash px-2.5 py-px">
                  {pulse!.metals.map((m) => (
                    <InfoPopover
                      key={m.name}
                      title={`${m.name} · IBJA fix`}
                      sub={`National benchmark · ₹${m.unit}`}
                      rows={[
                        ["Latest fix", `₹${inr0.format(m.value)}`],
                        ["Day change", m.changePct !== undefined ? signedPct(m.changePct, 2) : "—"],
                      ]}
                      note="India Bullion & Jewellers Association AM/PM fix — the rate gold loans and jewellers reference. Bullion is national; city premia are retail noise."
                      render={
                    <div role="button" tabIndex={0} className="flex cursor-pointer items-baseline justify-between gap-1 leading-tight transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper/60">
                      <span className="flex items-center gap-1 whitespace-nowrap text-[8.5px] text-fog">
                        <Coins size={8} strokeWidth={2} className="text-silver" />
                        {m.name.split(" ")[0]} <span className="text-silver">{m.unit} · IBJA</span>
                      </span>
                      <span className="whitespace-nowrap font-mono text-[10px] font-medium tabular-nums text-ink">
                        ₹{inr0.format(m.value)}
                        {m.changePct !== undefined && (
                          <span className={`ml-1 text-[8.5px] ${deltaClass(m.changePct)}`}>{signedPct(m.changePct, 1)}</span>
                        )}
                      </span>
                    </div>
                      }
                    />
                  ))}
                </div>
              )}
            </>
          ) : weather ? (
            <ul className="px-2.5 py-0.5">
              {weather.slice(0, 7).map((w) => {
                return (
                  <InfoPopover
                    key={w.city}
                    title={`${w.city} · today`}
                    sub={conditionOf(w.code)}
                    rows={[
                      ["High / Low", `${w.tmax}° / ${w.tmin}°C`],
                      ["Rain chance", `${w.rainProb}%`],
                    ]}
                    note="Open-Meteo daily forecast, refreshed every 30 minutes."
                    render={
                      <li role="button" tabIndex={0} className="flex cursor-pointer items-center gap-1.5 border-b border-ash py-[2.5px] transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60">
                        <WeatherIcon code={w.code} size={12} className="flex shrink-0" />
                        <span className="min-w-0 truncate text-[10px] text-charcoal">{w.city}</span>
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-ink">
                          {w.tmax}°<span className="text-silver">/{w.tmin}°</span>
                        </span>
                        {w.rainProb >= 30 && <span className="font-mono text-[8.5px] tabular-nums text-blue">{w.rainProb}%</span>}
                      </li>
                    }
                  />
                );
              })}
            </ul>
          ) : (
            <p className="px-2.5 py-3 text-[11px] text-fog">City data unavailable.</p>
          )}
        </div>
        </FlipView>
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
