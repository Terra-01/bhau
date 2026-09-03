import { loadEnv } from "@/lib/load-env";
import { GENESIS_HASH, chainEntries, type ChainEntryInput } from "./ledger";
import { PERSONAS, PROMPT_VERSION } from "./personas";

loadEnv();

// Logs the current strategy revision to the ledger, one NOTE per agent —
// CONCEPT.md §3: a prompt change is a logged strategy revision, on the
// same chain the decisions live on. Idempotent per PROMPT_VERSION.
//
//   npm run floor:revision

const NOTES: Record<string, string> = {
  "2.0":
    "Strategy revision v2.0 (2026-09-03): the briefing pack now carries the whole war room — FII/DII flows, the G-sec curve, " +
    "MMI mood, commodities, forex, breadth, sector heat, the street (fuel/bullion/monsoon), and the coming calendar — " +
    "serialized in this agent's own attention order. The agent gains a public identity (codename, voice), a self-mirror " +
    "(book P&L, drawdown, benchmark gap, tripwires), machine-checked invalidation levels on every BUY, an optional " +
    "published watchlist, and a Friday letter. Decisions now carry promptVersion. Prompt text in src/agents/personas.ts " +
    "at the commit tagged with this date.",
};

async function main() {
  const note = NOTES[PROMPT_VERSION];
  if (!note) throw new Error(`no revision note written for PROMPT_VERSION ${PROMPT_VERSION}`);
  const { prisma } = await import("@/lib/db");
  const existing = await prisma.ledgerEntry.findFirst({
    where: { kind: "NOTE", payload: { path: ["revision"], equals: `v${PROMPT_VERSION}` } },
  });
  if (existing) {
    console.log(`v${PROMPT_VERSION} revision notes already on the ledger — nothing to do`);
    await prisma.$disconnect();
    return;
  }
  const packDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const writes: ChainEntryInput[] = PERSONAS.map((p) => ({
    ts: new Date(),
    kind: "NOTE" as const,
    agentId: p.id,
    payload: { note, revision: `v${PROMPT_VERSION}`, packDate },
  }));
  const tip = await prisma.ledgerEntry.findFirst({ orderBy: { seq: "desc" } });
  const chained = chainEntries(tip?.hash ?? GENESIS_HASH, writes);
  await prisma.$transaction(async (tx) => {
    for (const entry of chained) {
      await tx.ledgerEntry.create({
        data: {
          ts: entry.ts,
          kind: entry.kind,
          agentId: entry.agentId,
          payload: JSON.parse(JSON.stringify(entry.payload)),
          prevHash: entry.prevHash,
          hash: entry.hash,
        },
      });
    }
  });
  console.log(`logged ${chained.length} v${PROMPT_VERSION} strategy-revision NOTEs`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
