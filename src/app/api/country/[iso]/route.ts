import { NextResponse } from "next/server";

// World View: key vitals for any country, straight from the World Bank
// (keyless, annual). India additionally carries the curated repo rate.
import { POLICY_RATE } from "@/config/exchange";

const INDICATORS: Array<{ id: string; key: string; label: string }> = [
  { id: "NY.GDP.MKTP.CD", key: "gdp", label: "GDP" },
  { id: "NY.GDP.MKTP.KD.ZG", key: "growth", label: "GDP growth" },
  { id: "FP.CPI.TOTL.ZG", key: "inflation", label: "Inflation" },
  { id: "SL.UEM.TOTL.ZS", key: "unemployment", label: "Unemployment" },
];

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso: raw } = await params;
  const iso = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  if (iso.length !== 3) return NextResponse.json({ error: "iso3 required" }, { status: 400 });

  const cached = cache.get(iso);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.body);

  try {
    const results = await Promise.all(
      INDICATORS.map(async ({ id }) => {
        const res = await fetch(
          `https://api.worldbank.org/v2/country/${iso}/indicator/${id}?format=json&per_page=8`,
          { signal: AbortSignal.timeout(12_000) },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as [unknown, Array<{ date: string; value: number | null }> | null];
        return data[1]?.find((r) => r.value !== null) ?? null;
      }),
    );
    const stats: Record<string, { value: number; year: string } | null> = {};
    INDICATORS.forEach(({ key }, i) => {
      stats[key] = results[i] ? { value: results[i]!.value!, year: results[i]!.date } : null;
    });
    const body = {
      iso,
      stats,
      policyRate: iso === "IND" ? POLICY_RATE : null,
    };
    cache.set(iso, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (err) {
    return NextResponse.json({ iso, error: err instanceof Error ? err.message : "lookup failed" }, { status: 502 });
  }
}
