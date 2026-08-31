import { describe, expect, it } from "vitest";
import { fillBuy, fillSell, markToMarket } from "./fills";
import { GENESIS_HASH, chainEntries, verifyChain, type StoredEntry } from "./ledger";
import { RULEBOOK, validateDecisions, type AgentBook } from "./rulebook";

const emptyBook = (): AgentBook => ({ cash: RULEBOOK.startingCapital, positions: {} });

describe("ledger chain", () => {
  const inputs = [
    { ts: new Date("2026-08-31T12:30:00Z"), kind: "DECISION" as const, agentId: "macro", payload: { action: "BUY", symbol: "NIFTYBEES" } },
    { ts: new Date("2026-09-01T04:00:00Z"), kind: "FILL" as const, agentId: "macro", payload: { qty: 100, price: 275.5 } },
  ];

  it("chains and verifies", () => {
    const chained = chainEntries(GENESIS_HASH, inputs);
    expect(chained[0].prevHash).toBe(GENESIS_HASH);
    expect(chained[1].prevHash).toBe(chained[0].hash);
    const stored: StoredEntry[] = chained.map((e, i) => ({ ...e, seq: i + 1 }));
    expect(verifyChain(stored)).toBeNull();
  });

  it("detects payload tampering", () => {
    const chained = chainEntries(GENESIS_HASH, inputs);
    const stored: StoredEntry[] = chained.map((e, i) => ({ ...e, seq: i + 1 }));
    (stored[0].payload as { qty?: number; symbol?: string }).symbol = "GOLDBEES"; // retroactive edit
    expect(verifyChain(stored)).toBe(1);
  });

  it("detects splice tampering", () => {
    const chained = chainEntries(GENESIS_HASH, inputs);
    const stored: StoredEntry[] = chained.map((e, i) => ({ ...e, seq: i + 1 }));
    expect(verifyChain([stored[1]])).toBe(2); // dropping an entry breaks the link
  });

  it("hash is independent of payload key order", () => {
    const a = chainEntries(GENESIS_HASH, [{ ...inputs[0], payload: { x: 1, y: 2 } }]);
    const b = chainEntries(GENESIS_HASH, [{ ...inputs[0], payload: { y: 2, x: 1 } }]);
    expect(a[0].hash).toBe(b[0].hash);
  });
});

describe("rulebook", () => {
  it("rejects symbols outside the universe", () => {
    const [v] = validateDecisions(emptyBook(), [{ action: "BUY", symbol: "NOTREAL", allocationPct: 5, thesis: "t" }]);
    expect(v.accepted).toBe(false);
    expect(v.rejectReason).toContain("universe");
  });

  it("enforces the single-name cap and position count", () => {
    const [tooBig] = validateDecisions(emptyBook(), [{ action: "BUY", symbol: "RELIANCE", allocationPct: 25, thesis: "t" }]);
    expect(tooBig.accepted).toBe(false);

    const fullBook: AgentBook = {
      cash: 1000,
      positions: Object.fromEntries(
        ["ABB", "RELIANCE", "TCS", "INFY", "WIPRO", "SBIN", "AXISBANK", "ICICIBANK", "HDFCBANK", "ITC"].map((s) => [s, { qty: 1, avgCost: 1, adds: 0 }]),
      ),
    };
    const [eleventh] = validateDecisions(fullBook, [{ action: "BUY", symbol: "NIFTYBEES", allocationPct: 5, thesis: "t" }]);
    expect(eleventh.accepted).toBe(false);
    expect(eleventh.rejectReason).toContain("book full");
    // …but adding to an existing position is allowed on a full book
    const [add] = validateDecisions(fullBook, [{ action: "BUY", symbol: "TCS", allocationPct: 5, thesis: "t" }]);
    expect(add.accepted).toBe(true);
  });

  it("caps averaging down", () => {
    const book: AgentBook = { cash: 1000, positions: { TCS: { qty: 10, avgCost: 100, adds: 2 } } };
    const [v] = validateDecisions(book, [{ action: "BUY", symbol: "TCS", allocationPct: 5, thesis: "t" }]);
    expect(v.accepted).toBe(false);
  });

  it("rejects sells without a position and empty theses", () => {
    const [noPos] = validateDecisions(emptyBook(), [{ action: "SELL", symbol: "TCS", fraction: 1, thesis: "t" }]);
    expect(noPos.accepted).toBe(false);
    const [noThesis] = validateDecisions(emptyBook(), [{ action: "BUY", symbol: "TCS", allocationPct: 5, thesis: "  " }]);
    expect(noThesis.accepted).toBe(false);
  });
});

describe("fills", () => {
  it("buys at open with costs and updates the book", () => {
    const result = fillBuy(emptyBook(), "NIFTYBEES", 10, 250, RULEBOOK.startingCapital);
    expect(result.status).toBe("FILLED");
    expect(result.qty).toBe(400); // 10% of 10L = 1L / 250
    expect(result.costs).toBe(150); // 1L × 0.15%
    expect(result.book.cash).toBe(RULEBOOK.startingCapital - 100_000 - 150);
    expect(result.book.positions.NIFTYBEES).toEqual({ qty: 400, avgCost: 250, adds: 0 });
  });

  it("down-sizes to available cash instead of overdrawing", () => {
    const book: AgentBook = { cash: 10_000, positions: {} };
    const result = fillBuy(book, "TCS", 20, 100, 1_000_000); // wants 2L, has 10k
    expect(result.status).toBe("FILLED");
    expect(result.qty).toBe(99); // 99 × 100 × 1.0015 = 9,914.85 ≤ 10,000
    expect(result.book.cash).toBeGreaterThanOrEqual(0);
  });

  it("rejects a buy with no affordable share", () => {
    const result = fillBuy({ cash: 50, positions: {} }, "TCS", 5, 100, 1_000_000);
    expect(result.status).toBe("REJECTED");
  });

  it("sells a fraction, full exit removes the position", () => {
    const book: AgentBook = { cash: 0, positions: { TCS: { qty: 100, avgCost: 90, adds: 0 } } };
    const half = fillSell(book, "TCS", 0.5, 110);
    expect(half.status).toBe("FILLED");
    expect(half.qty).toBe(50);
    expect(half.book.positions.TCS.qty).toBe(50);
    expect(half.book.cash).toBe(50 * 110 * (1 - RULEBOOK.costRatePerSide));

    const full = fillSell(half.book, "TCS", 1, 110);
    expect(full.book.positions.TCS).toBeUndefined();
  });

  it("marks to market with fallback to cost for unpriced symbols", () => {
    const book: AgentBook = { cash: 100, positions: { A: { qty: 2, avgCost: 10, adds: 0 }, B: { qty: 3, avgCost: 5, adds: 0 } } };
    const { equity, unpriced } = markToMarket(book, (s) => (s === "A" ? 20 : undefined));
    expect(equity).toBe(100 + 40 + 15); // A at market, B at cost
    expect(unpriced).toEqual(["B"]);
  });
});
