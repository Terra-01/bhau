import { describe, expect, it } from "vitest";
import { sectorHeat } from "@/lib/sectors";
import { fiiStreakOf } from "./evidence";

describe("fiiStreakOf", () => {
  it("counts a buying streak from the latest session backwards", () => {
    expect(fiiStreakOf([-100, 200, 300])).toEqual({ direction: "buying", days: 2 });
    expect(fiiStreakOf([100, -50, -20])).toEqual({ direction: "selling", days: 2 });
    expect(fiiStreakOf([500])).toEqual({ direction: "buying", days: 1 });
    expect(fiiStreakOf([])).toBeUndefined();
  });
});

describe("sectorHeat", () => {
  it("averages per sector and sorts leaders first", () => {
    const latest = new Map([
      ["RELIANCE", 110],
      ["ONGC", 99],
      ["TCS", 100],
    ]);
    const prev = new Map([
      ["RELIANCE", 100],
      ["ONGC", 100],
      ["TCS", 100],
    ]);
    const heat = sectorHeat(latest, prev);
    // RELIANCE (+10) and ONGC (−1) share Oil Gas & Consumable Fuels → +4.5
    const oil = heat.find((h) => h.sector.startsWith("Oil"));
    expect(oil?.avgChangePct).toBe(4.5);
    expect(oil?.count).toBe(2);
    expect(heat[0].avgChangePct).toBeGreaterThanOrEqual(heat[heat.length - 1].avgChangePct);
  });

  it("skips symbols missing either session", () => {
    const heat = sectorHeat(new Map([["RELIANCE", 100]]), new Map());
    expect(heat).toHaveLength(0);
  });
});
