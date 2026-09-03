// Weather for the subcontinent's market cities — Open-Meteo, keyless.
// Standalone (no db import) so the ingest evidence layer can use it
// without dragging the page data layer into its module graph; ephemeral
// context, deliberately exempt from the archive-is-the-moat rule.

export interface CityWeather {
  city: string;
  tmax: number;
  tmin: number;
  code: number;
  rainProb: number;
}

const CITIES = [
  { city: "Mumbai", lat: 19.076, lon: 72.877 },
  { city: "Delhi", lat: 28.613, lon: 77.209 },
  { city: "Bengaluru", lat: 12.972, lon: 77.594 },
  { city: "Chennai", lat: 13.083, lon: 80.27 },
  { city: "Kolkata", lat: 22.573, lon: 88.364 },
  { city: "Hyderabad", lat: 17.385, lon: 78.487 },
  { city: "Pune", lat: 18.52, lon: 73.856 },
  { city: "Ahmedabad", lat: 23.023, lon: 72.571 },
  { city: "Jaipur", lat: 26.912, lon: 75.787 },
  { city: "Surat", lat: 21.17, lon: 72.831 },
];

// Open-Meteo flakes occasionally from datacenter egress — retry once and
// keep the last good forecast (weather ages gracefully; a few-hours-old
// forecast beats an empty tile for a whole ISR window).
let lastWeather: { at: number; data: CityWeather[] } | null = null;

export async function fetchWeather(): Promise<CityWeather[] | null> {
  const lats = CITIES.map((c) => c.lat).join(",");
  const lons = CITIES.map((c) => c.lon).join(",");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=1`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{
        daily?: { weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
      }>;
      const list = Array.isArray(data) ? data : [data];
      const out: CityWeather[] = [];
      for (const [i, { city }] of CITIES.entries()) {
        const daily = list[i]?.daily;
        const code = daily?.weather_code?.[0];
        const tmax = daily?.temperature_2m_max?.[0];
        const tmin = daily?.temperature_2m_min?.[0];
        if (typeof code !== "number" || typeof tmax !== "number" || typeof tmin !== "number") continue;
        out.push({ city, code, tmax: Math.round(tmax), tmin: Math.round(tmin), rainProb: daily?.precipitation_probability_max?.[0] ?? 0 });
      }
      // A malformed 200 must never become "Clear sky 0°/0°" — treat it as
      // a failed attempt rather than caching fabricated readings.
      if (out.length < CITIES.length) continue;
      lastWeather = { at: Date.now(), data: out };
      return out;
    } catch {
      /* retry once, then fall through to last-good */
    }
  }
  return lastWeather && Date.now() - lastWeather.at < 12 * 60 * 60 * 1000 ? lastWeather.data : null;
}
