"use client";

import { LineChart, Line } from "@/components/charts/line-chart";
import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import { InsightLine } from "@/components/insight-line";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WarRoomData } from "@/lib/warroom";
import { dateIST, deltaClass, inr, signedPct, timeIST } from "@/lib/format";
import { Tile } from "./tile";

export const AGENT_COLOR: Record<string, string> = {
  macro: "var(--color-agent-macro)",
  momentum: "var(--color-agent-momentum)",
  value: "var(--color-agent-value)",
  contrarian: "var(--color-agent-contrarian)",
  benchmark: "var(--color-fog)",
};

function Badge({ action, accepted }: { action: string; accepted: boolean }) {
  if (!accepted) return <span className="rounded-full bg-warn-wash px-2 py-px text-[9px] font-semibold text-warn">REJECTED</span>;
  const style = action === "BUY" ? "bg-gain-wash text-gain" : action === "SELL" ? "bg-loss-wash text-loss" : "bg-paper text-fog";
  return <span className={`rounded-full px-2 py-px text-[9px] font-semibold ${style}`}>{action.replace("_", " ")}</span>;
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

  // Ring fill: returns on a symmetric domain — all rings sit at 50% when the
  // race is level and visibly diverge as P&L separates.
  const domain = Math.max(1, ...floor.scoreboard.map((r) => Math.abs(r.totalReturnPct))) * 1.2;
  const rings = agents.map((r) => ({
    label: r.name.replace("The ", ""),
    value: r.totalReturnPct + domain,
    maxValue: 2 * domain,
    color: AGENT_COLOR[r.agentId],
  }));

  const thesesOf = (agentId: string) => floor.theses.filter((t) => t.agentId === agentId).slice(0, 2);

  return (
    <Tile title="The Floor — agents vs. the Nifty" meta={`MARKED ${floor.date}`}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 px-2 pt-1">
          {race.length >= 2 ? (
            <LineChart data={race} className="h-full" aspectRatio={undefined}>
              {Object.entries(AGENT_COLOR).map(([id, color]) => (
                <Line key={id} dataKey={id} stroke={color} strokeWidth={id === "benchmark" ? 1.5 : 2} />
              ))}
            </LineChart>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <span className="max-w-[320px] text-[11.5px] text-fog">
                Four agents, ₹10,00,000 each, against the index — equity curves draw here as sessions accumulate.
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 border-t border-ash px-1.5 py-1">
          <div className="hidden h-[92px] w-[92px] shrink-0 sm:block">
            <RingChart data={rings} size={92} strokeWidth={7} ringGap={3} baseInnerRadius={18}>
              {rings.map((ring, i) => (
                <Ring key={ring.label} index={i} color={ring.color} />
              ))}
            </RingChart>
          </div>
          <ul className="min-w-0 flex-1">
            {agents.map((row, i) => (
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
                      <span className="ml-auto font-mono text-[11.5px] font-medium tabular-nums text-ink">{inr(row.equity)}</span>
                      <span className={`w-14 text-right font-mono text-[10.5px] tabular-nums ${deltaClass(row.totalReturnPct)}`}>
                        {signedPct(row.totalReturnPct)}
                      </span>
                    </li>
                  }
                />
                <PopoverContent align="start" className="w-[340px] p-0">
                  <div className="border-b border-ash px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-charcoal">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: AGENT_COLOR[row.agentId] }} />
                      {row.name} — latest theses
                    </span>
                  </div>
                  <ul className="max-h-[260px] overflow-y-auto">
                    {thesesOf(row.agentId).length === 0 && (
                      <li className="px-3 py-3 text-[11.5px] text-fog">No decisions on the ledger yet.</li>
                    )}
                    {thesesOf(row.agentId).map((t) => (
                      <li key={t.seq} className="border-b border-ash px-3 py-2 last:border-b-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge action={t.action} accepted={t.accepted} />
                          {t.symbol && (
                            <span className="font-mono text-[10.5px] text-charcoal">
                              {t.symbol}
                              {t.allocationPct ? ` ${t.allocationPct}%` : ""}
                            </span>
                          )}
                          <span className="ml-auto font-mono text-[9.5px] tabular-nums text-silver">
                            {dateIST(t.ts).slice(0, 6)} {timeIST(t.ts)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-snug text-steel">
                          {t.thesis}
                          {t.rejectReason ? <span className="text-warn"> — rulebook: {t.rejectReason}</span> : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            ))}
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
          </InsightLine>
        )}
      </div>
    </Tile>
  );
}
