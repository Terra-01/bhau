import type { WarRoomData } from "@/lib/warroom";
import { deltaClass, signedPct } from "@/lib/format";
import { Tile } from "./tile";

function Column({ rows }: { rows: Array<{ symbol: string; changePct: number }> }) {
  return (
    <ul className="min-w-0 flex-1">
      {rows.map((r) => (
        <li key={r.symbol} className="flex items-baseline justify-between gap-1 py-[2px]">
          <span className="truncate font-mono text-[10px] text-charcoal">{r.symbol}</span>
          <span className={`font-mono text-[10px] tabular-nums ${deltaClass(r.changePct)}`}>{signedPct(r.changePct, 1)}</span>
        </li>
      ))}
    </ul>
  );
}

export function MoversTile({ movers }: { movers: WarRoomData["movers"] }) {
  return (
    <Tile title="Movers" meta="NIFTY 100 · 1D">
      {movers.gainers.length === 0 ? (
        <p className="px-3 py-4 text-[11.5px] text-fog">Accumulating sessions…</p>
      ) : (
        <div className="flex h-full gap-3 px-3 py-1.5">
          <Column rows={movers.gainers} />
          <div className="w-px bg-ash" />
          <Column rows={movers.losers} />
        </div>
      )}
    </Tile>
  );
}
