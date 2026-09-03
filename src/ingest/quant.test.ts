import { describe, expect, it } from "vitest";
import { buildQuant, type QuantBarIn } from "./quant";

// The quant sheet is published methodology: the agents trade on these
// numbers, so the honesty rules (truncation, staleness, min-history, the
// corporate-action detector) are pinned here.

const day = (n: number) => `2026-01-${String(n).padStart(2, "0")}`;

function seriesOf(symbol: string, closes: number[], startDay = 1): QuantBarIn[] {
  return closes.map((close, i) => ({ symbol, date: day(startDay + i), close }));
}

describe("buildQuant", () => {
  it("computes returns over exact session counts", () => {
    const closes = Array.from({ length: 70 }, (_, i) => 100 + i); // 100..169
    const sheet = buildQuant([...seriesOf("RELIANCE", closes), ...seriesOf("^NSEI", closes)], {}, day(28));
    const row = sheet.rows.find((r) => r.symbol === "RELIANCE")!;
    expect(row.r1).toBe(Number((((169 - 168) / 168) * 100).toFixed(2)));
    expect(row.r5).toBe(Number((((169 - 164) / 164) * 100).toFixed(2)));
    expect(row.r20).toBe(Number((((169 - 149) / 149) * 100).toFixed(2)));
    expect(row.rs20).toBe(0); // identical series → zero relative strength
  });

  it("truncates every series to the equity universe's latest date — the index never runs ahead", () => {
    const eq = seriesOf("RELIANCE", [100, 101, 102, 103, 104]); // ends day 5
    const idx = seriesOf("^NSEI", [100, 101, 102, 103, 104, 90]); // ends day 6 with a crash
    const sheet = buildQuant([...eq, ...idx], {}, day(6));
    expect(sheet.asOf).toBe(day(5));
    const row = sheet.rows.find((r) => r.symbol === "RELIANCE")!;
    // idx day-6 crash must not leak into the benchmark leg
    expect(row.r1).toBe(row.r1); // present
    expect(sheet.rows).toHaveLength(1);
  });

  it("omits symbols whose series ended more than 3 sessions before asOf", () => {
    const fresh = seriesOf("RELIANCE", [100, 101, 102, 103, 104, 105, 106, 107]); // days 1-8
    const stale = seriesOf("TCS", [100, 101, 102]); // ends day 3, 5 sessions stale
    const sheet = buildQuant([...fresh, ...stale], {}, day(8));
    expect(sheet.rows.map((r) => r.symbol)).toEqual(["RELIANCE"]);
  });

  it("withholds 52-week fields below the minimum history", () => {
    const shortHist = seriesOf("RELIANCE", Array.from({ length: 10 }, (_, i) => 100 + i));
    const sheet = buildQuant(shortHist, {}, day(10));
    const row = sheet.rows[0];
    expect(row.r5).toBeDefined();
    expect(row.from52wHigh).toBeUndefined();
    expect(row.from52wLow).toBeUndefined();
  });

  it("uses intraday highs and lows for the 52-week distances", () => {
    const closes = Array.from({ length: 70 }, () => 100);
    const bars = seriesOf("RELIANCE", closes).map((b, i) => (i === 30 ? { ...b, high: 125, low: 80 } : b));
    const sheet = buildQuant(bars, {}, day(70));
    const row = sheet.rows[0];
    expect(row.from52wHigh).toBe(-20); // 100 vs high 125
    expect(row.from52wLow).toBe(25); // 100 vs low 80
  });

  it("treats a >30% single-session step as a corporate action", () => {
    // old step (a split 40 sessions ago): long-window fields withheld, short returns kept
    const oldStep = [...Array.from({ length: 30 }, () => 200), ...Array.from({ length: 40 }, () => 100)];
    let sheet = buildQuant(seriesOf("RELIANCE", oldStep), {}, day(70));
    const row = sheet.rows[0];
    expect(row.r1).toBeDefined();
    expect(row.r20).toBeUndefined();
    expect(row.from52wHigh).toBeUndefined();

    // recent step: the whole row is untrustworthy → omitted
    const recentStep = [...Array.from({ length: 68 }, () => 200), 100, 100];
    sheet = buildQuant(seriesOf("RELIANCE", recentStep), {}, day(70));
    expect(sheet.rows).toHaveLength(0);
  });

  it("dedupes a re-run pushing today via both the archive and todayBars", () => {
    const hist = seriesOf("RELIANCE", [100, 101, 102]);
    const todayBars = { RELIANCE: [{ date: day(3), symbol: "RELIANCE", close: 102, source: "bhavcopy" }] };
    const sheet = buildQuant(hist, todayBars, day(3));
    expect(sheet.rows[0].r1).toBe(Number((((102 - 101) / 101) * 100).toFixed(2)));
  });
});
