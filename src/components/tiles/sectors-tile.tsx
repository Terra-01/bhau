import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Tile } from "./tile";

/** Dense diverging bars — rotation reads top-to-bottom at a glance. */
export function SectorsTile({ sectors }: { sectors: WarRoomData["sectors"] }) {
  const maxAbs = Math.max(0.5, ...sectors.map((s) => Math.abs(s.avgChangePct)));
  return (
    <Tile title="Sector rotation" meta="NIFTY 100 · 1D" scroll>
      <ul className="px-3 py-1.5">
        {sectors.length === 0 && <li className="py-3 text-[11.5px] text-fog">Accumulating sessions…</li>}
        {sectors.map((s) => (
          <li key={s.sector} className="flex items-center gap-2 py-[3px]" title={`${s.count} stocks`}>
            <span className="w-[108px] shrink-0 truncate text-[10.5px] leading-tight text-steel">{s.sector}</span>
            <div className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-paper">
              <span
                className="absolute top-0 h-full rounded-full opacity-80"
                style={{
                  width: `${Math.max(2, (Math.abs(s.avgChangePct) / maxAbs) * 50)}%`,
                  left: s.avgChangePct >= 0 ? "50%" : undefined,
                  right: s.avgChangePct < 0 ? "50%" : undefined,
                  background: s.avgChangePct >= 0 ? "var(--color-gain)" : "var(--color-loss)",
                }}
              />
              <span className="absolute left-1/2 top-0 h-full w-px bg-smoke" />
            </div>
            <span className={`w-14 shrink-0 text-right font-mono text-[10.5px] tabular-nums ${deltaClass(s.avgChangePct)}`}>
              {signedPct(s.avgChangePct)}
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
