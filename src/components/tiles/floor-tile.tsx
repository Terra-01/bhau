"use client";

import { Bot } from "lucide-react";
import { InsightLine } from "@/components/insight-line";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WarRoomData } from "@/lib/warroom";
import { dateIST, deltaClass, inr, signedPct } from "@/lib/format";
import { RaceChart, type RaceSeriesDef } from "./race-chart";
import { Tile } from "./tile";

export const AGENT_COLOR: Record<string, string> = {
  macro: "var(--color-agent-macro)",
  momentum: "var(--color-agent-momentum)",
  value: "var(--color-agent-value)",
  contrarian: "var(--color-agent-contrarian)",
  benchmark: "var(--color-fog)",
};

/** Stable series defs for the race chart (read once per mount). */
const RACE_SERIES: RaceSeriesDef[] = [
  { id: "macro", colorVar: "--color-agent-macro" },
  { id: "momentum", colorVar: "--color-agent-momentum" },
  { id: "value", colorVar: "--color-agent-value" },
  { id: "contrarian", colorVar: "--color-agent-contrarian" },
  { id: "benchmark", colorVar: "--color-fog", benchmark: true },
];

type Thesis = WarRoomData["floor"]["theses"][number];
type LogEntry = WarRoomData["floor"]["log"][number];

function Badge({ action, accepted }: { action: string; accepted: boolean }) {
  if (!accepted) return <span className="rounded-full bg-warn-wash px-2 py-px text-[9px] font-semibold text-warn">REJECTED</span>;
  const style = action === "BUY" ? "bg-gain-wash text-gain" : action === "SELL" ? "bg-loss-wash text-loss" : "bg-paper text-fog";
  return <span className={`rounded-full px-2 py-px text-[9px] font-semibold ${style}`}>{action.replace("_", " ")}</span>;
}

/** The standings row's at-a-glance read of an agent's latest decision. */
function ActionChip({ latest }: { latest?: Thesis }) {
  if (!latest) return null;
  const cls = !latest.accepted
    ? "bg-warn-wash text-warn"
    : latest.action === "BUY"
      ? "bg-gain-wash text-gain"
      : latest.action === "SELL"
        ? "bg-loss-wash text-loss"
        : "bg-paper text-fog";
  const text = !latest.accepted
    ? "REJ"
    : latest.action === "NO_TRADE"
      ? "PASS"
      : `${latest.action === "BUY" ? "B" : "S"} ${latest.symbol ?? ""}`;
  return <span className={`shrink-0 rounded-full px-1.5 py-px font-mono text-[8px] font-semibold ${cls}`}>{text}</span>;
}

/** One entry of the public record: a decision, a fill, or a note. */
function LedgerRow({ e }: { e: LogEntry }) {
  return (
    <li className="border-b border-ash px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {e.kind === "FILL" ? (
          <span
            className={`rounded-full px-2 py-px text-[9px] font-semibold ${
              e.status === "FILLED" ? "bg-gain-wash text-gain" : "bg-warn-wash text-warn"
            }`}
          >
            {e.status === "FILLED" ? `FILLED ${e.action ?? ""}` : `FILL ${e.status ?? ""}`}
          </span>
        ) : e.kind === "NOTE" ? (
          <span className="rounded-full bg-paper px-2 py-px text-[9px] font-semibold text-fog">NOTE</span>
        ) : (
          <Badge action={e.action ?? ""} accepted={e.accepted ?? true} />
        )}
        {e.symbol && (
          <span className="font-mono text-[10.5px] text-charcoal">
            {e.symbol}
            {e.kind === "FILL" && e.qty !== undefined
              ? ` ${e.qty} @ ₹${e.price?.toFixed(2)}`
              : e.allocationPct
                ? ` ${e.allocationPct}%`
                : ""}
          </span>
        )}
        <span className="ml-auto font-mono text-[9.5px] tabular-nums text-silver">
          {e.packDate ?? dateIST(e.ts)}
        </span>
      </div>
      {e.kind === "FILL" && e.status === "FILLED" && e.costs !== undefined && (
        <p className="mt-0.5 font-mono text-[9.5px] text-fog">costs ₹{e.costs.toFixed(0)}</p>
      )}
      {e.kind === "FILL" && e.status !== "FILLED" && e.rejectReason && (
        <p className="mt-0.5 text-[10.5px] leading-snug text-warn">{e.rejectReason}</p>
      )}
      {e.thesis && (
        <p className="mt-1 text-[11px] leading-snug text-steel">
          {e.thesis}
          {e.kind === "DECISION" && e.rejectReason ? <span className="text-warn"> — rulebook: {e.rejectReason}</span> : null}
        </p>
      )}
      {e.trigger && (
        <p className="mt-0.5 text-[10px] leading-snug text-fog">
          Waiting for: <span className="text-charcoal">{e.trigger}</span>
        </p>
      )}
      {e.note && <p className="mt-1 text-[10.5px] leading-snug text-steel">{e.note}</p>}
    </li>
  );
}

export function FloorTile({
  floor,
  race,
}: {
  floor: WarRoomData["floor"];
  race: WarRoomData["race"];
}) {
  const agents = floor.scoreboard.filter((r) => !r.isBenchmark);
  const benchmark = floor.scoreboard.find((r) => r.isBenchmark);
  const latestOf = (agentId: string) => floor.theses.find((t) => t.agentId === agentId);
  const logOf = (agentId: string) => floor.log.filter((e) => e.agentId === agentId);

  // The mark lags the market by design (crons 17:17–23:17 IST, with
  // GitHub-scheduler jitter) — say so instead of looking frozen.
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const markPending = floor.date < todayIst;
  const todays = floor.theses.filter((t) => t.packDate === floor.date);
  const trades = todays.filter((t) => t.action !== "NO_TRADE" && t.accepted);
  const activity =
    todays.length === 0
      ? null
      : trades.length === 0
        ? `${todays.length}× no trade`
        : trades
            .map((t) => `${t.agentName.replace("The ", "")} ${t.action === "BUY" ? "bought" : "sold"} ${t.symbol}`)
            .join(" · ");

  return (
    <Tile
      title="Agents vs Nifty"
      icon={<Bot size={10} strokeWidth={2} className="text-lavender" />}
      meta={`MARKED ${floor.date}${markPending ? " · NEXT TONIGHT" : ""}`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          {race.length >= 2 ? (
            <RaceChart race={race} series={RACE_SERIES} />
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <span className="max-w-[320px] text-[11.5px] text-fog">
                Four agents, ₹10,00,000 each, against the index — equity curves draw here as sessions accumulate.
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-ash px-1.5 py-1">
          <ul className="min-w-0">
            {agents.map((row, i) => {
              const book = floor.books[row.agentId];
              const entries = logOf(row.agentId);
              return (
                <Popover key={row.agentId}>
                  <PopoverTrigger
                    nativeButton={false}
                    render={
                      <li
                        role="button"
                        tabIndex={0}
                        className="flex cursor-pointer items-baseline gap-1.5 rounded-[4px] px-1.5 py-[2px] transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper"
                      >
                        <span className="w-4 font-mono text-[9.5px] tabular-nums text-silver">{String(i + 1).padStart(2, "0")}</span>
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[11.5px] font-medium text-charcoal">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AGENT_COLOR[row.agentId] }} />
                          {row.name}
                        </span>
                        <ActionChip latest={latestOf(row.agentId)} />
                        <span className="ml-auto font-mono text-[11.5px] font-medium tabular-nums text-ink">{inr(row.equity)}</span>
                        <span className={`w-14 text-right font-mono text-[10.5px] tabular-nums ${deltaClass(row.totalReturnPct)}`}>
                          {signedPct(row.totalReturnPct)}
                        </span>
                      </li>
                    }
                  />
                  <PopoverContent align="start" className="w-[340px] p-0">
                    <div className="border-b border-ash px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[12px] font-semibold text-charcoal">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AGENT_COLOR[row.agentId] }} />
                          {row.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">
                          {inr(row.equity)}{" "}
                          <span className={deltaClass(row.totalReturnPct)}>{signedPct(row.totalReturnPct)}</span>
                        </span>
                      </div>
                      {book && (
                        <div className="mt-0.5 truncate font-mono text-[9.5px] text-fog">
                          {inr(book.cash)} cash
                          {book.positions.map((p) => ` · ${p.symbol} ${Math.round(p.qty)} @ ${p.avgCost.toFixed(2)}`).join("")}
                        </div>
                      )}
                    </div>
                    <ul className="max-h-[300px] overflow-y-auto">
                      {entries.length === 0 && (
                        <li className="px-3 py-3 text-[11.5px] text-fog">No entries on the ledger yet.</li>
                      )}
                      {entries.map((e) => (
                        <LedgerRow key={e.seq} e={e} />
                      ))}
                    </ul>
                    <div className="border-t border-ash px-3 py-1.5 text-[8.5px] uppercase tracking-[0.06em] text-silver">
                      Append-only hash-chained ledger · decisions publish before outcomes
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
            {benchmark && (
              <li className="flex items-baseline gap-1.5 rounded-[4px] bg-paper px-1.5 py-[2px]">
                <span className="w-4 font-mono text-[9.5px] text-silver">—</span>
                <span className="min-w-0 truncate text-[11.5px] font-medium text-fog">{benchmark.name}</span>
                <span className="ml-auto font-mono text-[11.5px] tabular-nums text-steel">{inr(benchmark.equity)}</span>
                <span className="w-14 text-right font-mono text-[10.5px] tabular-nums text-fog">{signedPct(benchmark.totalReturnPct)}</span>
              </li>
            )}
          </ul>
        </div>
        {agents.length > 0 && benchmark && (
          <InsightLine meta="PAPER · EOD">
            Leader {agents[0].name.replace("The ", "")}{" "}
            <span className={deltaClass(agents[0].totalReturnPct)}>{signedPct(agents[0].totalReturnPct)}</span> ·{" "}
            {agents[0].totalReturnPct >= benchmark.totalReturnPct ? "ahead of" : "behind"} the Nifty by{" "}
            {Math.abs(agents[0].totalReturnPct - benchmark.totalReturnPct).toFixed(2)} pp
            {activity && <> · {activity}</>}
            {markPending && <> · today&apos;s mark lands by ~23:30 IST</>}
          </InsightLine>
        )}
      </div>
    </Tile>
  );
}
