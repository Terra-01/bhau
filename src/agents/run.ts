import { loadEnv } from "@/lib/load-env";
import type { BriefingPack } from "@/ingest/briefing";
import { deliberate, hasModelKey, isMockMode, weeklyLetter, type WatchEntry } from "./deliberate";
import { fillBuy, fillSell, markToMarket } from "./fills";
import { GENESIS_HASH, chainEntries, type ChainEntryInput } from "./ledger";
import { BENCHMARK_AGENT_ID, PERSONAS, PROMPT_VERSION } from "./personas";
import { RULEBOOK, validateDecisions, type AgentBook, type Positions } from "./rulebook";

loadEnv();

// The Floor's daily loop (CONCEPT.md §2), run right after ingest:
//   1. FILL yesterday's accepted decisions at TODAY'S OPEN (never same-day
//      close — that would be lookahead).
//   2. MARK every book to market at today's close → equity snapshots.
//   3. DELIBERATE on today's briefing pack → publish tomorrow's decisions
//      (validated by the code rulebook; rejections are logged publicly too).
// Everything lands on the append-only hash chain. No updates, no deletes.

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

interface DecisionPayload {
  packDate: string;
  action: "BUY" | "SELL" | "NO_TRADE";
  symbol?: string;
  allocationPct?: number;
  fraction?: number;
  thesis: string;
  /** NO_TRADE only: the published condition that would flip it. */
  trigger?: string;
  /** BUY only: the machine-checked tripwire. */
  invalidation?: { level: number; direction: "below" | "above" };
  /** Up to 3 published watch entries — a pass with a watchlist is a prediction. */
  watchlist?: WatchEntry[];
  marketRead: string;
  accepted: boolean;
  rejectReason?: string;
  /** Which prompt generation produced this row (personas.PROMPT_VERSION). */
  promptVersion?: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || isMockMode();
  const date = todayIST();
  const { prisma } = await import("@/lib/db");
  const writes: ChainEntryInput[] = [];
  const summary: string[] = [];

  const packRow = await prisma.briefingPack.findUnique({ where: { date: new Date(date) } });
  if (!packRow) {
    console.error(`[floor] no briefing pack for ${date} — run ingest first`);
    process.exit(1);
  }
  const pack = packRow.pack as unknown as BriefingPack;
  if (!pack.tradingDay) {
    console.log(`[floor] ${date} is not a trading day — sitting out`);
    return;
  }

  // --- price maps for today (per-symbol source preference: bhavcopy > nse > amfi > yahoo)
  const priority: Record<string, number> = { bhavcopy: 0, nse: 1, amfi: 2, yahoo: 3 };
  const todayBars = await prisma.dailyBar.findMany({ where: { date: new Date(date) } });
  const openBy = new Map<string, { price: number; rank: number }>();
  const closeBy = new Map<string, { price: number; rank: number }>();
  for (const bar of todayBars) {
    const rank = priority[bar.source] ?? 9;
    if (bar.open !== null && (openBy.get(bar.symbol)?.rank ?? 99) > rank) {
      openBy.set(bar.symbol, { price: bar.open, rank });
    }
    if ((closeBy.get(bar.symbol)?.rank ?? 99) > rank) {
      closeBy.set(bar.symbol, { price: bar.close, rank });
    }
  }
  const openOf = (s: string) => openBy.get(s)?.price;
  const closeOf = (s: string) => closeBy.get(s)?.price;

  // --- load or initialize agent books
  const books = new Map<string, AgentBook>();
  for (const persona of PERSONAS) {
    const row = await prisma.agentState.findUnique({ where: { id: persona.id } });
    books.set(persona.id, row
      ? { cash: row.cash, positions: row.positions as unknown as Positions }
      : { cash: RULEBOOK.startingCapital, positions: {} });
  }
  // Benchmark: buys NIFTYBEES-NAV units (fractional) with full capital on day one.
  const benchmark = await prisma.agentState.findUnique({ where: { id: BENCHMARK_AGENT_ID } });
  let benchmarkBook: AgentBook | null = benchmark
    ? { cash: benchmark.cash, positions: benchmark.positions as unknown as Positions }
    : null;
  if (!benchmarkBook) {
    const nav = closeOf("NIFTYBEES-NAV");
    if (nav) {
      benchmarkBook = {
        cash: 0,
        positions: { "NIFTYBEES-NAV": { qty: RULEBOOK.startingCapital / nav, avgCost: nav, adds: 0 } },
      };
      writes.push({
        ts: new Date(), kind: "NOTE", agentId: BENCHMARK_AGENT_ID,
        payload: { note: `benchmark initialized: ₹${RULEBOOK.startingCapital} of NIFTYBEES-NAV at ${nav}`, packDate: date },
      });
      summary.push(`[benchmark] initialized at NAV ${nav}`);
    } else {
      summary.push("[benchmark] no NIFTYBEES-NAV price yet — init deferred");
    }
  }

  // --- 1. fills: accepted decisions from EARLIER sessions, not yet closed out
  const decisionEntries = await prisma.ledgerEntry.findMany({ where: { kind: "DECISION" }, orderBy: { seq: "asc" } });
  const fillEntries = await prisma.ledgerEntry.findMany({ where: { kind: "FILL" } });
  const closedDecisionHashes = new Set(fillEntries.map((f) => (f.payload as { decisionHash?: string }).decisionHash));
  const pending = decisionEntries.filter((d) => {
    const p = d.payload as unknown as DecisionPayload;
    return p.accepted && p.action !== "NO_TRADE" && p.packDate < date && !closedDecisionHashes.has(d.hash);
  });

  for (const decision of pending) {
    const p = decision.payload as unknown as DecisionPayload;
    const book = books.get(decision.agentId);
    if (!book || !p.symbol) continue;
    const price = openOf(p.symbol);
    let result;
    if (!price) {
      // Missing data is not a rejection — the decision stays pending and
      // fills on the next session that actually has an opening print.
      summary.push(`[fill:${decision.agentId}] ${p.action} ${p.symbol} — no open for ${date}, stays pending`);
      continue;
    } else if (p.action === "BUY") {
      const { equity } = markToMarket(book, openOf);
      result = fillBuy(book, p.symbol, p.allocationPct ?? 0, price, equity);
    } else {
      result = fillSell(book, p.symbol, p.fraction ?? 1, price);
    }
    books.set(decision.agentId, result.book);
    writes.push({
      ts: new Date(), kind: "FILL", agentId: decision.agentId,
      payload: {
        decisionHash: decision.hash, fillDate: date, status: result.status,
        ...(result.status === "FILLED"
          ? { symbol: p.symbol, action: p.action, qty: result.qty, price: result.price, costs: result.costs }
          : { symbol: p.symbol, action: p.action, reason: result.reason }),
      },
    });
    summary.push(`[fill:${decision.agentId}] ${p.action} ${p.symbol} → ${result.status}${result.status === "FILLED" ? ` ${result.qty} @ ₹${result.price}` : ` (${result.reason})`}`);
  }

  // --- 2. mark to market at today's close
  const snapshots: Array<{ agentId: string; equity: number; cash: number; positionsValue: number }> = [];
  const equities = new Map<string, number>();
  const allBooks: Array<[string, AgentBook]> = [...books.entries()];
  if (benchmarkBook) allBooks.push([BENCHMARK_AGENT_ID, benchmarkBook]);
  for (const [agentId, book] of allBooks) {
    const { equity, positionsValue, unpriced } = markToMarket(book, closeOf);
    equities.set(agentId, equity);
    snapshots.push({ agentId, equity, cash: book.cash, positionsValue });
    if (unpriced.length > 0) summary.push(`[mtm:${agentId}] no close for ${unpriced.join(",")} — valued at cost`);
    summary.push(`[equity:${agentId}] ₹${equity.toLocaleString("en-IN")} (${(((equity - RULEBOOK.startingCapital) / RULEBOOK.startingCapital) * 100).toFixed(2)}%)`);
  }

  // --- 3. deliberation → tomorrow's decisions
  // The mirror: each agent's view of itself — book P&L, benchmark gap,
  // drawdown, staleness, and its open tripwires (machine-checked here;
  // a breach is flagged and the prompt requires the agent to address it).
  const peaks = await prisma.equitySnapshot.groupBy({ by: ["agentId"], _max: { equity: true } });
  const peakOf = new Map(peaks.map((p) => [p.agentId, p._max.equity ?? RULEBOOK.startingCapital]));
  const benchmarkReturnPct = benchmarkBook
    ? ((equities.get(BENCHMARK_AGENT_ID)! - RULEBOOK.startingCapital) / RULEBOOK.startingCapital) * 100
    : undefined;
  const latestDecisionOf = (agentId: string) =>
    decisionEntries.filter((d) => d.agentId === agentId).at(-1)?.payload as DecisionPayload | undefined;

  const mirrorOf = (persona: (typeof PERSONAS)[number]) => {
    const book = books.get(persona.id)!;
    const equity = equities.get(persona.id)!;
    const returnPct = ((equity - RULEBOOK.startingCapital) / RULEBOOK.startingCapital) * 100;
    const peak = Math.max(peakOf.get(persona.id) ?? equity, equity);
    const lastFill = fillEntries
      .filter((f) => f.agentId === persona.id && (f.payload as { status?: string }).status === "FILLED")
      .at(-1);
    // Open tripwires: the latest accepted BUY per still-open symbol.
    const tripwires = Object.keys(book.positions).flatMap((symbol) => {
      const buys = decisionEntries.filter((d) => {
        const p = d.payload as unknown as DecisionPayload;
        return d.agentId === persona.id && p.accepted && p.action === "BUY" && p.symbol === symbol && p.invalidation;
      });
      const inv = (buys.at(-1)?.payload as unknown as DecisionPayload | undefined)?.invalidation;
      if (!inv) return [];
      const close = closeOf(symbol);
      const breached =
        close !== undefined && (inv.direction === "below" ? close < inv.level : close > inv.level);
      if (breached) summary.push(`[tripwire:${persona.id}] ${symbol} BREACHED — close ${close} ${inv.direction} ${inv.level}`);
      return [{ symbol, level: inv.level, direction: inv.direction, close, breached }];
    });
    return {
      equityInr: Math.round(equity),
      totalReturnPct: Number(returnPct.toFixed(2)),
      vsBenchmarkPp: benchmarkReturnPct !== undefined ? Number((returnPct - benchmarkReturnPct).toFixed(2)) : undefined,
      drawdownFromPeakPct: Number((((equity - peak) / peak) * 100).toFixed(2)),
      positions: Object.entries(book.positions).map(([symbol, pos]) => {
        const close = closeOf(symbol);
        return {
          symbol,
          qty: pos.qty,
          avgCost: pos.avgCost,
          last: close,
          plPct: close !== undefined ? Number((((close - pos.avgCost) / pos.avgCost) * 100).toFixed(2)) : undefined,
        };
      }),
      daysSinceLastFill: lastFill ? Math.round((Date.now() - lastFill.ts.getTime()) / 86_400_000) : null,
      openTripwires: tripwires,
    };
  };

  // Idempotency: an agent deliberates once per session, no matter how many
  // times the job runs (local + CI on the same evening must not double-decide).
  const decidedToday = new Set(
    decisionEntries
      .filter((d) => (d.payload as unknown as DecisionPayload).packDate === date)
      .map((d) => d.agentId),
  );
  if (!hasModelKey() && !isMockMode()) {
    summary.push("[deliberate] OPENAI_KEY not set — fills/MTM done, deliberation skipped");
  } else {
    for (const persona of PERSONAS) {
      if (decidedToday.has(persona.id)) {
        summary.push(`[decide:${persona.id}] already decided for ${date} — skipping`);
        continue;
      }
      const book = books.get(persona.id)!;
      const recent = decisionEntries
        .filter((d) => d.agentId === persona.id)
        .slice(-10)
        .map((d) => d.payload);
      // The contrarian reads the house view: a unanimous floor is itself a
      // sentiment reading it may fade.
      const colleagues =
        persona.id === "contrarian"
          ? PERSONAS.filter((p) => p.id !== persona.id).map((p) => {
              const latest = latestDecisionOf(p.id);
              return {
                codename: p.codename,
                positions: Object.keys(books.get(p.id)!.positions),
                latest: latest
                  ? { action: latest.action, symbol: latest.symbol, thesis: latest.thesis?.slice(0, 240) }
                  : undefined,
              };
            })
          : undefined;
      try {
        const result = await deliberate(persona, pack, book, equities.get(persona.id)!, recent, mirrorOf(persona), colleagues);
        const validated = validateDecisions(book, result.proposals);
        const base = { packDate: date, marketRead: result.marketRead, promptVersion: PROMPT_VERSION, watchlist: result.watchlist };
        if (validated.length === 0) {
          writes.push({
            ts: new Date(), kind: "DECISION", agentId: persona.id,
            payload: {
              ...base,
              action: "NO_TRADE",
              accepted: true,
              thesis: result.noTradeReason ?? result.marketRead,
              trigger: result.noTradeTrigger,
            } satisfies DecisionPayload,
          });
          summary.push(`[decide:${persona.id}] NO_TRADE${result.watchlist?.length ? ` (watching ${result.watchlist.map((w) => w.symbol).join(",")})` : ""}`);
        }
        for (const v of validated) {
          writes.push({
            ts: new Date(), kind: "DECISION", agentId: persona.id,
            payload: {
              ...base, action: v.action, symbol: v.symbol, allocationPct: v.allocationPct,
              fraction: v.fraction, invalidation: v.invalidation, thesis: v.thesis,
              accepted: v.accepted, rejectReason: v.rejectReason,
            } satisfies DecisionPayload,
          });
          summary.push(`[decide:${persona.id}] ${v.action} ${v.symbol} ${v.accepted ? "accepted" : `REJECTED (${v.rejectReason})`}`);
        }
      } catch (err) {
        // A failed deliberation must not block the others or the fills.
        summary.push(`[decide:${persona.id}] ERROR — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- 3b. the Friday letter: each agent reviews its week in public.
    const weekday = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
    if (weekday === "Fri" && !isMockMode() && hasModelKey()) {
      const letterEntries = await prisma.ledgerEntry.findMany({ where: { kind: "NOTE" } });
      const wrote = new Set(
        letterEntries
          .filter((e) => (e.payload as { week?: string }).week === date)
          .map((e) => e.agentId),
      );
      for (const persona of PERSONAS) {
        if (wrote.has(persona.id)) continue;
        const weekDecisions = decisionEntries
          .filter((d) => d.agentId === persona.id)
          .slice(-6)
          .map((d) => d.payload);
        try {
          const letter = await weeklyLetter(persona, mirrorOf(persona), weekDecisions);
          if (letter) {
            writes.push({
              ts: new Date(), kind: "NOTE", agentId: persona.id,
              payload: { note: letter, week: date, packDate: date },
            });
            summary.push(`[letter:${persona.id}] published`);
          }
        } catch (err) {
          summary.push(`[letter:${persona.id}] failed — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  // --- persist: chain the entries, save books + snapshots, all-or-nothing
  for (const line of summary) console.log(line);
  if (dryRun) {
    console.log(`[floor] DRY RUN — ${writes.length} ledger entries computed, nothing persisted`);
    await prisma.$disconnect();
    return;
  }

  const tip = await prisma.ledgerEntry.findFirst({ orderBy: { seq: "desc" } });
  const chained = chainEntries(tip?.hash ?? GENESIS_HASH, writes);
  await prisma.$transaction(async (tx) => {
    for (const entry of chained) {
      await tx.ledgerEntry.create({
        data: {
          ts: entry.ts, kind: entry.kind, agentId: entry.agentId,
          payload: JSON.parse(JSON.stringify(entry.payload)),
          prevHash: entry.prevHash, hash: entry.hash,
        },
      });
    }
    for (const [agentId, book] of allBooks) {
      const positions = book.positions as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue;
      await tx.agentState.upsert({
        where: { id: agentId },
        update: { cash: book.cash, positions },
        create: { id: agentId, cash: book.cash, positions },
      });
    }
    for (const snap of snapshots) {
      const totalReturnPct = Number((((snap.equity - RULEBOOK.startingCapital) / RULEBOOK.startingCapital) * 100).toFixed(4));
      await tx.equitySnapshot.upsert({
        where: { date_agentId: { date: new Date(date), agentId: snap.agentId } },
        update: { equity: snap.equity, cash: snap.cash, positionsValue: snap.positionsValue, totalReturnPct },
        create: { date: new Date(date), agentId: snap.agentId, equity: snap.equity, cash: snap.cash, positionsValue: snap.positionsValue, totalReturnPct },
      });
    }
  });
  console.log(`[floor] persisted ${chained.length} ledger entries, ${snapshots.length} equity snapshots for ${date}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
