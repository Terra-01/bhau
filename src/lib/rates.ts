import { POLICY_RATE } from "@/config/exchange";
import { prisma } from "./db";

// Server-side assembly for the India rates & macro panel: the RBI-sourced
// G-sec curve with spreads, and slow-moving macro vitals (World Bank,
// annual — labeled with their year, never passed off as fresh).

/** Curve tenors in display order: DailyBar symbol → x position + label. */
const CURVE = [
  { symbol: "TBILL91D", tenor: 0.25, label: "3M" },
  { symbol: "TBILL182D", tenor: 0.5, label: "6M" },
  { symbol: "TBILL364D", tenor: 1, label: "1Y" },
  { symbol: "GSEC2Y", tenor: 2, label: "2Y" },
  { symbol: "GSEC3Y", tenor: 3, label: "3Y" },
  { symbol: "GSEC5Y", tenor: 5, label: "5Y" },
  { symbol: "GSEC10Y", tenor: 10, label: "10Y" },
  { symbol: "GSEC15Y", tenor: 15, label: "15Y" },
  { symbol: "GSEC30Y", tenor: 30, label: "30Y" },
] as const;

export interface RatesData {
  asOf: string;
  curve: Array<{ tenor: number; label: string; yield: number; prevYield?: number }>;
  y10: { value: number; changeBps?: number; history: Array<{ date: string; value: number }> } | null;
  repo: { value: number; label: string };
  ratios: { crr?: number; slr?: number };
  spreads: Array<{ id: string; label: string; bps: number }>;
  macro: Array<{ label: string; value: string; sub: string }> | null;
  /** Tickertape Market Mood Index — India's fear/greed gauge, 0–100. */
  mmi: { value: number; zone: string } | null;
}

interface WorldBankRow {
  date: string;
  value: number | null;
}

async function fetchMacro(): Promise<RatesData["macro"]> {
  try {
    const get = async (indicator: string): Promise<WorldBankRow[]> => {
      const res = await fetch(
        `https://api.worldbank.org/v2/country/IND/indicator/${indicator}?format=json&per_page=20`,
        { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) },
      );
      if (!res.ok) throw new Error(`worldbank ${res.status}`);
      const data = (await res.json()) as [unknown, WorldBankRow[]];
      return (data[1] ?? []).filter((r) => r.value !== null);
    };
    const [gdp, growth, inflation, unemployment] = await Promise.all([
      get("NY.GDP.MKTP.CD"),
      get("NY.GDP.MKTP.KD.ZG"),
      get("FP.CPI.TOTL.ZG"),
      get("SL.UEM.TOTL.ZS"),
    ]);
    const latest = (rows: WorldBankRow[]) => rows[0];
    const yr = (rows: WorldBankRow[]) => `'${latest(rows).date.slice(2)}`;
    return [
      { label: "GDP growth", value: `${latest(growth).value!.toFixed(1)}%`, sub: yr(growth) },
      { label: "CPI inflation", value: `${latest(inflation).value!.toFixed(1)}%`, sub: `${yr(inflation)} avg` },
      { label: "Unemployment", value: `${latest(unemployment).value!.toFixed(1)}%`, sub: yr(unemployment) },
      { label: "GDP", value: `$${(latest(gdp).value! / 1e12).toFixed(2)}T`, sub: yr(gdp) },
    ];
  } catch {
    return null;
  }
}

async function fetchMmi(): Promise<RatesData["mmi"]> {
  try {
    const res = await fetch("https://api.tickertape.in/mmi/now", {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { data?: { indicator?: number } };
    const v = d.data?.indicator;
    if (typeof v !== "number") return null;
    const zone = v < 30 ? "Extreme Fear" : v < 50 ? "Fear" : v < 70 ? "Greed" : "Extreme Greed";
    return { value: Number(v.toFixed(1)), zone };
  } catch {
    return null;
  }
}

export async function getRatesData(): Promise<RatesData | null> {
  const symbols = [...CURVE.map((c) => c.symbol), "RBIREPO", "RBICRR", "RBISLR", "US10Y"];
  const since = new Date(Date.now() - 120 * 86_400_000);
  const [rows, macro, mmi] = await Promise.all([
    prisma.dailyBar.findMany({
      where: { symbol: { in: symbols }, date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    fetchMacro(),
    fetchMmi(),
  ]);

  const bySymbol = new Map<string, Array<{ date: string; close: number }>>();
  for (const row of rows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push({ date: row.date.toISOString().slice(0, 10), close: row.close });
    bySymbol.set(row.symbol, list);
  }

  const curve: RatesData["curve"] = [];
  let asOf = "";
  for (const { symbol, tenor, label } of CURVE) {
    const bars = bySymbol.get(symbol);
    if (!bars || bars.length === 0) continue;
    const last = bars.at(-1)!;
    curve.push({ tenor, label, yield: last.close, prevYield: bars.at(-2)?.close });
    if (last.date > asOf) asOf = last.date;
  }
  if (curve.length < 4) return null; // not enough points for a curve

  const y10Bars = bySymbol.get("GSEC10Y") ?? [];
  const y10Last = y10Bars.at(-1);
  const y10Prev = y10Bars.at(-2);
  const y10 = y10Last
    ? {
        value: y10Last.close,
        changeBps: y10Prev ? Math.round((y10Last.close - y10Prev.close) * 100) : undefined,
        history: y10Bars.map((b) => ({ date: b.date, value: b.close })),
      }
    : null;

  const repoBar = bySymbol.get("RBIREPO")?.at(-1);
  const repo = { value: repoBar?.close ?? POLICY_RATE.value, label: "RBI repo" };
  const ratios = {
    crr: bySymbol.get("RBICRR")?.at(-1)?.close,
    slr: bySymbol.get("RBISLR")?.at(-1)?.close,
  };

  const spreads: RatesData["spreads"] = [];
  const oneY = curve.find((c) => c.label === "1Y");
  if (y10) {
    spreads.push({ id: "term", label: "10Y − repo", bps: Math.round((y10.value - repo.value) * 100) });
    if (oneY) spreads.push({ id: "slope", label: "10Y − 1Y", bps: Math.round((y10.value - oneY.yield) * 100) });
    const us10 = bySymbol.get("US10Y")?.at(-1);
    if (us10) spreads.push({ id: "inus", label: "vs US 10Y", bps: Math.round((y10.value - us10.close) * 100) });
  }

  return { asOf, curve, y10, repo, ratios, spreads, macro, mmi };
}
