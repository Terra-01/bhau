import { loadEnv } from "@/lib/load-env";
import { verifyChain } from "./ledger";

loadEnv();

// Public trust primitive: recompute every hash from genesis. Anyone with
// read access can run this; a methodology page will explain how.
async function main() {
  const { prisma } = await import("@/lib/db");
  const entries = await prisma.ledgerEntry.findMany({ orderBy: { seq: "asc" } });
  const broken = verifyChain(entries);
  if (broken === null) {
    console.log(`[verify] chain intact — ${entries.length} entries, tip ${entries.at(-1)?.hash.slice(0, 12) ?? "GENESIS"}`);
  } else {
    console.error(`[verify] CHAIN BROKEN at seq ${broken}`);
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
