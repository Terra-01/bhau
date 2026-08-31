// TradingView-style 5-band heat scale, mapped onto our gain/loss family.
// Discrete bands read faster than continuous gradients; white text only on
// the strongest bands. Thresholds: ±0.05 neutral · <1% light · <5% mid ·
// ≥5% strong.
export interface HeatStyle {
  background: string;
  color: string;
}

export function heatStyle(pct: number | undefined): HeatStyle {
  if (pct === undefined || Math.abs(pct) < 0.05) {
    return { background: "var(--color-paper)", color: "var(--color-steel)" };
  }
  const gain = pct > 0;
  const abs = Math.abs(pct);
  if (abs < 1) {
    return { background: gain ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.12)", color: "var(--color-charcoal)" };
  }
  if (abs < 5) {
    return { background: gain ? "rgba(22,163,74,0.32)" : "rgba(220,38,38,0.28)", color: "var(--color-ink)" };
  }
  return { background: gain ? "var(--color-gain)" : "var(--color-loss)", color: "#ffffff" };
}

/** Compact Indian-market notation: 1.2 L Cr / 845 Cr / 62 L. */
export function compactInr(n: number): string {
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(1)} L Cr`;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(0)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(0)} L`;
  return `₹${Math.round(n)}`;
}
