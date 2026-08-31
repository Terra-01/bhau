import { LineChart, Line } from "@/components/charts/line-chart";
import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, inr, signedPct } from "@/lib/format";
import { Tile } from "./tile";

export const AGENT_COLOR: Record<string, string> = {
  macro: "var(--color-agent-macro)",
  momentum: "var(--color-agent-momentum)",
  value: "var(--color-agent-value)",
  contrarian: "var(--color-agent-contrarian)",
  benchmark: "var(--color-fog)",
};

export function FloorTile({ floor, race }: { floor: WarRoomData["floor"]; race: WarRoomData["race"] }) {
  const agents = floor.scoreboard;
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
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-silver">The race begins</span>
              <span className="max-w-[300px] text-[12px] text-fog">
                Four agents, ₹10,00,000 each, against the index. The equity curves draw themselves here as sessions accumulate.
              </span>
            </div>
          )}
        </div>
        <table className="w-full shrink-0 border-t border-ash">
          <tbody>
            {agents.map((row, i) => (
              <tr key={row.agentId} className={`border-b border-ash last:border-b-0 ${row.isBenchmark ? "bg-paper" : ""}`}>
                <td className="w-8 py-1 pl-3 font-mono text-[10px] tabular-nums text-silver">
                  {row.isBenchmark ? "—" : String(i + 1).padStart(2, "0")}
                </td>
                <td className="py-1 pr-2">
                  <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${row.isBenchmark ? "text-fog" : "text-charcoal"}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AGENT_COLOR[row.agentId] }} />
                    {row.name}
                  </span>
                </td>
                <td className={`py-1 pr-2 text-right font-mono text-[12.5px] font-medium tabular-nums ${row.isBenchmark ? "text-steel" : "text-ink"}`}>
                  {inr(row.equity)}
                </td>
                <td className={`w-16 py-1 pr-3 text-right font-mono text-[11px] tabular-nums ${row.isBenchmark ? "text-fog" : deltaClass(row.totalReturnPct)}`}>
                  {signedPct(row.totalReturnPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tile>
  );
}
