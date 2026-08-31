import type { IngestBar } from "@/ingest/types";

export type RegimeBand = "Calm" | "Steady" | "Watchful" | "Strained" | "Stressed";

export interface RegimeComponent {
  value: number; // raw input (level or % change)
  stress: number; // 0–100
  weight: number;
}

export interface RegimeResult {
  score: number; // 0–100, higher = more stressed
  band: RegimeBand;
  components: Record<string, RegimeComponent>;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function pctChange(bars: IngestBar[], span: number): number | undefined {
  if (bars.length < span + 1) return undefined;
  const last = bars[bars.length - 1].close;
  const prev = bars[bars.length - 1 - span].close;
  return ((last - prev) / prev) * 100;
}

/**
 * India Regime Index v1 — the published formula (CONCEPT.md §4 panel 8).
 *
 * Components (each mapped to 0–100 stress, then weighted):
 *   vix      India VIX level:        10 → 0, 35+ → 100
 *   nifty5d  Nifty 5-day return:     0% → 0, −5% or worse → 100
 *   inr5d    USD/INR 5-day change:   0% → 0, +2% (INR depreciation) → 100
 *   brent5d  Brent 5-day change:     0% → 0, +10% → 100
 *
 * Missing components are dropped and weights renormalized, so a dead
 * upstream degrades precision, not the panel. Breadth joins in v1.1 once
 * bhavcopy ingestion lands.
 *
 * Each component reads the first symbol with data from its candidate list —
 * redundant upstreams (Yahoo, NSE, ECB, FRED) write near-equivalent series
 * under different symbols.
 */
export function computeRegime(barsBySymbol: Record<string, IngestBar[]>): RegimeResult | null {
  const firstBars = (symbols: string[]): IngestBar[] => {
    for (const symbol of symbols) {
      const bars = barsBySymbol[symbol];
      if (bars && bars.length > 0) return bars;
    }
    return [];
  };

  const candidates: Record<string, { value: number | undefined; stress: (v: number) => number; weight: number }> = {
    vix: {
      value: firstBars(["^INDIAVIX"]).at(-1)?.close,
      stress: (v) => clamp01((v - 10) / 25) * 100,
      weight: 0.35,
    },
    nifty5d: {
      value: pctChange(firstBars(["^NSEI"]), 5),
      stress: (v) => clamp01(-v / 5) * 100,
      weight: 0.3,
    },
    inr5d: {
      value: pctChange(firstBars(["INR=X", "USDINR"]), 5),
      stress: (v) => clamp01(v / 2) * 100,
      weight: 0.2,
    },
    brent5d: {
      value: pctChange(firstBars(["BZ=F", "BRENT-SPOT"]), 5),
      stress: (v) => clamp01(v / 10) * 100,
      weight: 0.15,
    },
  };

  const components: Record<string, RegimeComponent> = {};
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, c] of Object.entries(candidates)) {
    if (c.value === undefined) continue;
    const stress = c.stress(c.value);
    components[key] = { value: Number(c.value.toFixed(2)), stress: Number(stress.toFixed(1)), weight: c.weight };
    weightedSum += stress * c.weight;
    totalWeight += c.weight;
  }
  if (totalWeight === 0) return null;

  const score = Number((weightedSum / totalWeight).toFixed(1));
  const band: RegimeBand =
    score < 20 ? "Calm" : score < 40 ? "Steady" : score < 60 ? "Watchful" : score < 80 ? "Strained" : "Stressed";
  return { score, band, components };
}
