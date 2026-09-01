import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react";
import type { WarRoomData } from "@/lib/warroom";
import { Tile } from "./tile";

// WMO weather codes → icon
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

export function WeatherTile({ weather }: { weather: WarRoomData["weather"] }) {
  return (
    <Tile title="Weather" meta="TODAY · °C" scroll>
      {!weather ? (
        <p className="px-3 py-3 text-[11.5px] text-fog">Forecast unavailable.</p>
      ) : (
        <ul className="px-2.5 py-0.5">
          {weather.slice(0, 5).map((w) => {
            const Icon = iconFor(w.code);
            return (
              <li key={w.city} className="flex items-center gap-1.5 border-b border-ash py-[3px] last:border-b-0">
                <Icon size={13} className="shrink-0 text-steel" strokeWidth={1.75} />
                <span className="min-w-0 truncate text-[10.5px] text-charcoal">{w.city}</span>
                <span className="ml-auto font-mono text-[10.5px] tabular-nums text-ink">
                  {w.tmax}°<span className="text-silver">/{w.tmin}°</span>
                </span>
                {w.rainProb >= 30 && (
                  <span className="font-mono text-[9px] tabular-nums text-blue">{w.rainProb}%</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}
