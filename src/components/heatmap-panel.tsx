import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Panel } from "./panel";

// Wash intensity by magnitude; the signed number carries the meaning
// (color is never the only encoding — DESIGN.md).
function washFor(change: number): string {
  const alpha = Math.min(Math.abs(change) / 2.5, 1) * 0.16;
  return change >= 0 ? `rgba(22, 163, 74, ${alpha})` : `rgba(220, 38, 38, ${alpha})`;
}

export function HeatmapPanel({ sectors }: { sectors: WarRoomData["sectors"] }) {
  return (
    <Panel title="Sector heatmap" meta="NIFTY 100 · 1D AVG">
      {sectors.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-fog">Needs two bhavcopy sessions — accumulating.</p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-ash sm:grid-cols-3">
          {sectors.map((s) => (
            <div
              key={s.sector}
              title={`${s.sector} — ${s.count} stocks`}
              className="flex min-h-[64px] flex-col justify-between bg-canvas p-2.5"
              style={{ background: `linear-gradient(${washFor(s.avgChangePct)}, ${washFor(s.avgChangePct)}), var(--color-canvas)` }}
            >
              <span className="text-[10.5px] leading-tight text-steel">{s.sector}</span>
              <span className={`font-mono text-[13px] font-medium tabular-nums ${deltaClass(s.avgChangePct)}`}>
                {signedPct(s.avgChangePct)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
