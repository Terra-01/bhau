import type { WarRoomData } from "@/lib/warroom";
import { crore, deltaClass } from "@/lib/format";
import { Tile } from "./tile";

export function FlowsTile({
  flows,
  streak,
}: {
  flows: WarRoomData["flows"];
  streak: WarRoomData["fiiStreak"];
}) {
  const dates = [...new Set(flows.map((f) => f.date))].sort().reverse().slice(0, 3);
  const maxAbs = Math.max(1, ...flows.map((f) => Math.abs(f.net)));
  return (
    <Tile
      title="FII / DII"
      meta={streak ? `FII ${streak.direction.toUpperCase()} · DAY ${streak.days}` : "₹ CR"}
    >
      <div className="flex h-full flex-col justify-center gap-2 px-3 py-1.5">
        {dates.length === 0 && <p className="text-[11.5px] text-fog">No flow data yet.</p>}
        {dates.map((date) => (
          <div key={date}>
            <div className="mb-0.5 font-mono text-[9px] text-silver">{date}</div>
            {["FII", "DII"].map((label) => {
              const row = flows.find((f) => f.date === date && (label === "FII" ? f.category.startsWith("FII") : f.category === "DII"));
              if (!row) return null;
              return (
                <div key={label} className="flex items-center gap-1.5 py-px">
                  <span className="w-6 text-[10px] font-semibold text-steel">{label}</span>
                  <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-paper">
                    <span
                      className="absolute top-0 h-full rounded-full opacity-75"
                      style={{
                        width: `${Math.max(2, (Math.abs(row.net) / maxAbs) * 50)}%`,
                        left: row.net >= 0 ? "50%" : undefined,
                        right: row.net < 0 ? "50%" : undefined,
                        background: row.net >= 0 ? "var(--color-gain)" : "var(--color-loss)",
                      }}
                    />
                    <span className="absolute left-1/2 top-0 h-full w-px bg-smoke" />
                  </div>
                  <span className={`w-[76px] text-right font-mono text-[10.5px] tabular-nums ${deltaClass(row.net)}`}>
                    {crore(row.net)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Tile>
  );
}
