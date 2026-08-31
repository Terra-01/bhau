import { describe, expect, it } from "vitest";
import type { IngestBar } from "@/ingest/types";
import { computeRegime } from "./regime";

// The regime formula is published methodology (CONCEPT.md §4) — these tests
// lock its behavior. A change here is a versioned strategy revision.

function mkBars(symbol: string, closes: number[]): IngestBar[] {
  return closes.map((close, i) => ({
    date: `2026-08-${String(10 + i).padStart(2, "0")}`,
    symbol,
    close,
    source: "test",
  }));
}

describe("computeRegime", () => {
  it("returns null with no data", () => {
    expect(computeRegime({})).toBeNull();
  });

  it("computes all four components when data is present", () => {
    const result = computeRegime({
      "^INDIAVIX": mkBars("^INDIAVIX", [20]),
      "^NSEI": mkBars("^NSEI", [100, 100, 100, 100, 100, 95]), // −5% over 5d
      "INR=X": mkBars("INR=X", [88, 88, 88, 88, 88, 88.88]), // +1% over 5d
      "BZ=F": mkBars("BZ=F", [80, 80, 80, 80, 80, 84]), // +5% over 5d
    });
    expect(result).not.toBeNull();
    expect(Object.keys(result!.components).sort()).toEqual(["brent5d", "inr5d", "nifty5d", "vix"]);
    // vix 20 → (20−10)/25 = 40; nifty −5% → 100; inr +1% → 50; brent +5% → 50
    expect(result!.components.vix.stress).toBe(40);
    expect(result!.components.nifty5d.stress).toBe(100);
    expect(result!.components.inr5d.stress).toBe(50);
    expect(result!.components.brent5d.stress).toBe(50);
    // 40·.35 + 100·.3 + 50·.2 + 50·.15 = 14 + 30 + 10 + 7.5 = 61.5
    expect(result!.score).toBe(61.5);
    expect(result!.band).toBe("Strained");
  });

  it("renormalizes weights when components are missing", () => {
    // Only VIX available → score must equal the VIX stress alone.
    const result = computeRegime({ "^INDIAVIX": mkBars("^INDIAVIX", [22.5]) });
    expect(result!.components.vix.stress).toBe(50);
    expect(result!.score).toBe(50);
    expect(result!.band).toBe("Watchful");
  });

  it("clamps stresses to 0–100", () => {
    const calm = computeRegime({ "^INDIAVIX": mkBars("^INDIAVIX", [5]) });
    expect(calm!.components.vix.stress).toBe(0);
    const panic = computeRegime({ "^INDIAVIX": mkBars("^INDIAVIX", [80]) });
    expect(panic!.components.vix.stress).toBe(100);
  });

  it("ignores 5d components without enough history", () => {
    const result = computeRegime({
      "^INDIAVIX": mkBars("^INDIAVIX", [15]),
      "^NSEI": mkBars("^NSEI", [100, 99]), // only 2 bars — no 5d change
    });
    expect(result!.components.nifty5d).toBeUndefined();
    expect(result!.components.vix).toBeDefined();
  });

  it("falls back through candidate symbols for a component", () => {
    // No INR=X; USDINR should feed the inr5d component instead.
    const result = computeRegime({
      USDINR: mkBars("USDINR", [88, 88, 88, 88, 88, 89.76]), // +2% → 100
    });
    expect(result!.components.inr5d.stress).toBe(100);
  });

  it("maps scores to the five published bands", () => {
    const vixForStress = (stress: number) => 10 + (stress / 100) * 25;
    const bandOf = (stress: number) =>
      computeRegime({ "^INDIAVIX": mkBars("^INDIAVIX", [vixForStress(stress)]) })!.band;
    expect(bandOf(10)).toBe("Calm");
    expect(bandOf(30)).toBe("Steady");
    expect(bandOf(50)).toBe("Watchful");
    expect(bandOf(70)).toBe("Strained");
    expect(bandOf(90)).toBe("Stressed");
  });
});
