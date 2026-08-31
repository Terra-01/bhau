import type { WarRoomData } from "@/lib/warroom";
import { crore, deltaClass } from "@/lib/format";
import { Panel } from "./panel";

export function FlowsPanel({ flows }: { flows: WarRoomData["flows"] }) {
  const dates = [...new Set(flows.map((f) => f.date))].sort().reverse().slice(0, 5);
  const maxAbs = Math.max(1, ...flows.map((f) => Math.abs(f.net)));

  return (
    <Panel title="FII / DII flows" meta="₹ CRORE · CASH, PROVISIONAL">
      {dates.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-fog">No flow data yet.</p>
      ) : (
        <ul>
          {dates.map((date) => {
            const fii = flows.find((f) => f.date === date && f.category.startsWith("FII"));
            const dii = flows.find((f) => f.date === date && f.category === "DII");
            return (
              <li key={date} className="border-b border-ash px-4 py-2.5 last:border-b-0">
                <div className="mb-1.5 font-mono text-[11px] text-fog">{date}</div>
                <div className="flex flex-col gap-1.5">
                  {[["FII", fii] as const, ["DII", dii] as const].map(([label, row]) =>
                    row ? (
                      <div key={label} className="flex items-center gap-2.5">
                        <span className="w-7 text-[11px] font-semibold text-steel">{label}</span>
                        <div className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-paper">
                          <span
                            className="absolute top-0 h-full rounded-full"
                            style={{
                              width: `${Math.max(2, (Math.abs(row.net) / maxAbs) * 50)}%`,
                              left: row.net >= 0 ? "50%" : undefined,
                              right: row.net < 0 ? "50%" : undefined,
                              background: row.net >= 0 ? "var(--color-gain)" : "var(--color-loss)",
                              opacity: 0.75,
                            }}
                          />
                          <span className="absolute left-1/2 top-0 h-full w-px bg-smoke" />
                        </div>
                        <span className={`w-[104px] text-right font-mono text-[12px] tabular-nums ${deltaClass(row.net)}`}>
                          {crore(row.net)}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
