import { ColorType } from "lightweight-charts";

// Shared theming for every lightweight-charts instance: resolve the
// terminal's CSS tokens to concrete colors (canvas can't read vars) and
// build the house chart options. Components re-apply on data-theme flips.

export function themeTokens() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    canvas: v("--color-canvas"),
    ash: v("--color-ash"),
    fog: v("--color-fog"),
    charcoal: v("--color-charcoal"),
    mono: v("--font-mono") || "monospace",
  };
}

/** Resolve any CSS custom property to its concrete value. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** #rrggbb → #rrggbbAA (canvas needs concrete colors, not CSS vars). */
export const alpha = (hex: string, a: number) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : hex;

export function baseChartOptions(t: ReturnType<typeof themeTokens>) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: t.canvas },
      textColor: t.fog,
      fontSize: 9,
      fontFamily: `${t.mono}, monospace`,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: alpha(t.ash, 0.55) },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    crosshair: {
      horzLine: { labelBackgroundColor: t.charcoal, color: t.fog },
      vertLine: { labelBackgroundColor: t.charcoal, color: t.fog },
    },
  };
}
