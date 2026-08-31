import type { WarRoomData } from "@/lib/warroom";
import { dateIST, deltaClass, inr, signedPct, timeIST } from "@/lib/format";
import { Panel } from "./panel";

// Agent identity colors (DESIGN.md): identity elements only — dots,
// keylines — never the P&L numbers.
const AGENT_COLOR: Record<string, string> = {
  macro: "var(--color-agent-macro)",
  momentum: "var(--color-agent-momentum)",
  value: "var(--color-agent-value)",
  contrarian: "var(--color-agent-contrarian)",
};

function ActionBadge({ action, accepted }: { action: string; accepted: boolean }) {
  if (!accepted) {
    return <span className="rounded-full bg-warn-wash px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-warn">REJECTED</span>;
  }
  const style =
    action === "BUY"
      ? "bg-gain-wash text-gain"
      : action === "SELL"
        ? "bg-loss-wash text-loss"
        : "bg-paper text-fog";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${style}`}>{action.replace("_", " ")}</span>;
}

export function FloorPanel({ floor }: { floor: WarRoomData["floor"] }) {
  return (
    <Panel title="The Floor — agents vs. the Nifty" meta={`MARKED ${floor.date}`} className="xl:col-span-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <tbody>
            {floor.scoreboard.map((row, i) => (
              <tr
                key={row.agentId}
                className={`border-b border-ash last:border-b-0 ${row.isBenchmark ? "bg-paper" : ""}`}
              >
                <td className="w-10 px-4 py-2.5 font-mono text-[11px] tabular-nums text-silver">
                  {row.isBenchmark ? "—" : String(i + 1).padStart(2, "0")}
                </td>
                <td className="py-2.5 pr-3">
                  <span className={`inline-flex items-center gap-2 text-[13.5px] font-medium ${row.isBenchmark ? "text-fog" : "text-charcoal"}`}>
                    {!row.isBenchmark && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: AGENT_COLOR[row.agentId] ?? "var(--color-silver)" }}
                      />
                    )}
                    {row.name}
                  </span>
                </td>
                <td className={`py-2.5 pr-3 text-right font-mono text-[15px] font-medium tabular-nums ${row.isBenchmark ? "text-steel" : "text-ink"}`}>
                  {inr(row.equity)}
                </td>
                <td className={`py-2.5 pr-4 text-right font-mono text-[12px] tabular-nums ${row.isBenchmark ? "text-fog" : deltaClass(row.totalReturnPct)}`}>
                  {signedPct(row.totalReturnPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-ash">
        <div className="px-4 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fog">
          Latest theses — published before the outcome
        </div>
        <ul>
          {floor.theses.map((t) => (
            <li key={t.seq} className="border-b border-ash px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-fog tabular-nums">
                  {dateIST(t.ts)} {timeIST(t.ts)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-charcoal">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: AGENT_COLOR[t.agentId] ?? "var(--color-silver)" }} />
                  {t.agentName}
                </span>
                <ActionBadge action={t.action} accepted={t.accepted} />
                {t.symbol && (
                  <span className="font-mono text-[12px] text-charcoal">
                    {t.symbol}
                    {t.allocationPct ? ` · ${t.allocationPct}%` : ""}
                  </span>
                )}
              </div>
              <p
                className="mt-1.5 border-l-2 pl-3 text-[13.5px] leading-relaxed text-steel"
                style={{ borderColor: AGENT_COLOR[t.agentId] ?? "var(--color-ash)" }}
              >
                {t.thesis}
                {t.rejectReason ? <span className="text-warn"> — rejected by the rulebook: {t.rejectReason}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
