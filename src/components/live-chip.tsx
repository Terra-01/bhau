import type { MarketPhase } from "@/lib/market-clock";

/** Session-state chip: renders only while something is genuinely live. */
export function LiveChip({
  phase,
  source,
  on = phase !== undefined && phase !== "closed",
}: {
  phase?: MarketPhase;
  source?: string;
  /** Override for instruments whose venue ignores NSE hours (commodities, FX). */
  on?: boolean;
}) {
  if (!on) return null;
  const label = phase === "preopen" ? "PRE-OPEN" : phase === "closing" ? "CLOSING" : "LIVE";
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[8px] font-semibold text-gain">
      <span className="h-1 w-1 animate-pulse rounded-full bg-gain" />
      {label}
      {source ? ` · ${source.toUpperCase()}` : ""}
    </span>
  );
}
