import { createHash } from "node:crypto";

// The append-only chain (CONCEPT.md §3). Each entry's hash covers the
// previous hash + a canonical serialization of its own fields, so any
// retroactive edit breaks every later hash. There are no update/delete
// code paths anywhere in this repo — by design, forever.

export const GENESIS_HASH = "GENESIS";

export interface ChainEntryInput {
  ts: Date;
  kind: "DECISION" | "FILL" | "NOTE";
  agentId: string;
  payload: Record<string, unknown>;
}

export interface ChainEntry extends ChainEntryInput {
  prevHash: string;
  hash: string;
}

/** Deterministic serialization: sorted keys, no whitespace variance. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${entries.join(",")}}`;
}

export function entryHash(prevHash: string, entry: ChainEntryInput): string {
  const material = `${prevHash}|${entry.ts.toISOString()}|${entry.kind}|${entry.agentId}|${canonicalize(entry.payload)}`;
  return createHash("sha256").update(material).digest("hex");
}

/** Chain a batch of new entries onto the tip. Pure — persistence is the caller's job. */
export function chainEntries(tipHash: string, inputs: ChainEntryInput[]): ChainEntry[] {
  let prevHash = tipHash;
  return inputs.map((input) => {
    const hash = entryHash(prevHash, input);
    const entry: ChainEntry = { ...input, prevHash, hash };
    prevHash = hash;
    return entry;
  });
}

export interface StoredEntry {
  seq: number;
  ts: Date;
  kind: string;
  agentId: string;
  payload: unknown;
  prevHash: string;
  hash: string;
}

/** Recompute every hash from genesis; returns the first broken seq, or null if intact. */
export function verifyChain(entries: StoredEntry[]): number | null {
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== prevHash) return entry.seq;
    const expected = entryHash(prevHash, {
      ts: entry.ts,
      kind: entry.kind as ChainEntryInput["kind"],
      agentId: entry.agentId,
      payload: entry.payload as Record<string, unknown>,
    });
    if (entry.hash !== expected) return entry.seq;
    prevHash = entry.hash;
  }
  return null;
}
