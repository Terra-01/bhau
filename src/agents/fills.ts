import { RULEBOOK, type AgentBook } from "./rulebook";

// Fill math — pure functions, exhaustively tested. Decisions made on
// yesterday's close fill at today's OPEN (never same-day close: lookahead).

export interface FillResult {
  status: "FILLED" | "REJECTED";
  reason?: string;
  qty?: number;
  price?: number;
  costs?: number;
  /** Book after the fill (unchanged on rejection). */
  book: AgentBook;
}

export function fillBuy(book: AgentBook, symbol: string, allocationPct: number, openPrice: number, equity: number): FillResult {
  const targetValue = (allocationPct / 100) * equity;
  let qty = Math.floor(targetValue / openPrice);
  // Down-size to available cash rather than rejecting outright…
  const costOf = (q: number) => q * openPrice * (1 + RULEBOOK.costRatePerSide);
  while (qty > 0 && costOf(qty) > book.cash) qty -= 1;
  if (qty <= 0) {
    return { status: "REJECTED", reason: `insufficient cash for ${symbol} at ₹${openPrice}`, book };
  }
  const gross = qty * openPrice;
  const costs = gross * RULEBOOK.costRatePerSide;
  const existing = book.positions[symbol];
  const positions = {
    ...book.positions,
    [symbol]: existing
      ? {
          qty: existing.qty + qty,
          avgCost: (existing.qty * existing.avgCost + gross) / (existing.qty + qty),
          adds: existing.adds + 1,
        }
      : { qty, avgCost: openPrice, adds: 0 },
  };
  return {
    status: "FILLED",
    qty,
    price: openPrice,
    costs: round2(costs),
    book: { cash: round2(book.cash - gross - costs), positions },
  };
}

export function fillSell(book: AgentBook, symbol: string, fraction: number, openPrice: number): FillResult {
  const position = book.positions[symbol];
  if (!position) return { status: "REJECTED", reason: `no position in ${symbol}`, book };
  const qty = fraction >= 1 ? position.qty : Math.floor(position.qty * fraction);
  if (qty <= 0) return { status: "REJECTED", reason: `fraction ${fraction} rounds to zero shares`, book };
  const gross = qty * openPrice;
  const costs = gross * RULEBOOK.costRatePerSide;
  const remaining = position.qty - qty;
  const positions = { ...book.positions };
  if (remaining === 0) delete positions[symbol];
  else positions[symbol] = { ...position, qty: remaining };
  return {
    status: "FILLED",
    qty,
    price: openPrice,
    costs: round2(costs),
    book: { cash: round2(book.cash + gross - costs), positions },
  };
}

/** Mark a book to market: cash + Σ qty·price, using the freshest price per symbol. */
export function markToMarket(book: AgentBook, priceOf: (symbol: string) => number | undefined): {
  equity: number;
  positionsValue: number;
  unpriced: string[];
} {
  let positionsValue = 0;
  const unpriced: string[] = [];
  for (const [symbol, position] of Object.entries(book.positions)) {
    const price = priceOf(symbol);
    if (price === undefined) {
      unpriced.push(symbol);
      positionsValue += position.qty * position.avgCost; // conservative fallback
    } else {
      positionsValue += position.qty * price;
    }
  }
  return { equity: round2(book.cash + positionsValue), positionsValue: round2(positionsValue), unpriced };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
