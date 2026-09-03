import { UNIVERSE } from "./universe";

// The shared rulebook (CONCEPT.md §2) — the "risk officer" enforced in
// code, outside the LLM. Constants are published methodology.
export const RULEBOOK = {
  startingCapital: 1_000_000, // ₹10,00,000 paper per agent
  maxPositions: 10,
  maxSingleNamePct: 20, // of equity, checked at decision time
  maxAdds: 2, // no averaging down past two adds
  /**
   * v1 published cost model: 0.15% per side, flat — approximates STT +
   * exchange charges + stamp duty + slippage for delivery trades. Applied
   * to every fill. A change here is a versioned methodology revision.
   */
  costRatePerSide: 0.0015,
} as const;

export interface Position {
  qty: number;
  avgCost: number;
  adds: number;
}

export type Positions = Record<string, Position>;

export interface AgentBook {
  cash: number;
  positions: Positions;
}

export interface ProposedDecision {
  action: "BUY" | "SELL";
  symbol: string;
  /** BUY: % of current equity to deploy (≤ maxSingleNamePct). */
  allocationPct?: number;
  /** SELL: fraction of the position to exit, (0, 1]. */
  fraction?: number;
  /** BUY: the published, machine-checked tripwire that falsifies the thesis. */
  invalidation?: { level: number; direction: "below" | "above" };
  thesis: string;
}

export interface ValidatedDecision extends ProposedDecision {
  accepted: boolean;
  rejectReason?: string;
}

/** The risk officer: every agent proposal passes through here before the ledger. */
export function validateDecisions(book: AgentBook, proposals: ProposedDecision[]): ValidatedDecision[] {
  const held = new Set(Object.keys(book.positions));
  let openPositions = held.size;

  return proposals.map((p): ValidatedDecision => {
    const reject = (rejectReason: string): ValidatedDecision => ({ ...p, accepted: false, rejectReason });

    if (!UNIVERSE.has(p.symbol)) return reject(`symbol ${p.symbol} outside the universe`);
    if (!p.thesis?.trim()) return reject("no thesis — every decision publishes its reasoning");

    if (p.action === "BUY") {
      if (!p.allocationPct || p.allocationPct <= 0) return reject("BUY needs allocationPct > 0");
      // The published promise: every BUY carries a machine-checkable tripwire.
      if (!p.invalidation || !(p.invalidation.level > 0)) return reject("BUY needs an invalidation tripwire with level > 0");
      if (p.invalidation.direction !== "below") return reject('long-only book — invalidation direction must be "below"');
      if (p.allocationPct > RULEBOOK.maxSingleNamePct) {
        return reject(`allocationPct ${p.allocationPct} exceeds ${RULEBOOK.maxSingleNamePct}% single-name cap`);
      }
      const existing = book.positions[p.symbol];
      if (existing) {
        if (existing.adds >= RULEBOOK.maxAdds) return reject(`already added ${existing.adds}× — no averaging past ${RULEBOOK.maxAdds} adds`);
      } else {
        if (openPositions >= RULEBOOK.maxPositions) return reject(`book full — ${RULEBOOK.maxPositions} open positions max`);
        openPositions += 1;
      }
      return { ...p, accepted: true };
    }

    // SELL
    if (p.invalidation) return reject("SELL carries no tripwire — invalidation belongs to BUYs");
    if (!book.positions[p.symbol]) return reject(`no position in ${p.symbol} to sell`);
    if (!p.fraction || p.fraction <= 0 || p.fraction > 1) return reject("SELL needs fraction in (0, 1]");
    return { ...p, accepted: true };
  });
}
