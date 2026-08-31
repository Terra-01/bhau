import { describe, expect, it } from "vitest";
import { buildBriefingPack } from "./briefing";
import type { IngestBar, IngestEvent } from "./types";

const DATE = "2026-08-31";

function mkEvent(title: string, category: string, minutesAgo: number): IngestEvent {
  return {
    ts: new Date(Date.parse("2026-08-31T12:00:00Z") - minutesAgo * 60_000),
    source: "gnews:test",
    kind: "news",
    title,
    entities: [],
    payload: { category },
    hash: `hash-${category}-${title}`,
  };
}

function mkBar(symbol: string, date: string, close: number, source = "nse"): IngestBar {
  return { date, symbol, close, source };
}

describe("buildBriefingPack", () => {
  it("computes 1-day change from the last two bars", () => {
    const pack = buildBriefingPack(DATE, [], {
      "^NSEI": [mkBar("^NSEI", "2026-08-28", 100), mkBar("^NSEI", DATE, 102)],
    }, null);
    expect(pack.markets).toEqual([
      { symbol: "^NSEI", name: "Nifty 50", close: 102, change1dPct: 2 },
    ]);
  });

  it("omits change1dPct with a single bar", () => {
    const pack = buildBriefingPack(DATE, [], { "^NSEI": [mkBar("^NSEI", DATE, 102)] }, null);
    expect(pack.markets[0].change1dPct).toBeUndefined();
  });

  it("caps news at 8 per category, newest first", () => {
    const events = Array.from({ length: 12 }, (_, i) => mkEvent(`story ${i}`, "markets", i));
    const pack = buildBriefingPack(DATE, events, {}, null);
    expect(pack.news.markets).toHaveLength(8);
    expect(pack.news.markets[0].title).toBe("story 0"); // most recent
  });

  it("marks a trading day when an Indian source has a bar dated today", () => {
    const pack = buildBriefingPack(DATE, [], { "^NSEI": [mkBar("^NSEI", DATE, 100)] }, null);
    expect(pack.tradingDay).toBe(true);
  });

  it("marks a holiday when Indian bars are stale (NSE reporting last session)", () => {
    const pack = buildBriefingPack(DATE, [], {
      "^NSEI": [mkBar("^NSEI", "2026-08-28", 100)],
      USDINR: [mkBar("USDINR", DATE, 88, "frankfurter")], // global sources don't count
    }, null);
    expect(pack.tradingDay).toBe(false);
  });

  it("ignores global yahoo bars that roll into today's IST date", () => {
    // Brent's late-US close lands on tomorrow's IST date — not an Indian session.
    const pack = buildBriefingPack(DATE, [], { "BZ=F": [mkBar("BZ=F", DATE, 88, "yahoo")] }, null);
    expect(pack.tradingDay).toBe(false);
    const packIndian = buildBriefingPack(DATE, [], { "^NSEI": [mkBar("^NSEI", DATE, 24000, "yahoo")] }, null);
    expect(packIndian.tradingDay).toBe(true);
  });
});
