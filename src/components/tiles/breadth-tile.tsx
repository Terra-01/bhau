import type { WarRoomData } from "@/lib/warroom";
import { Sparkline } from "../sparkline";
import { Tile } from "./tile";

export function BreadthTile({ breadth }: { breadth: WarRoomData["breadth"] }) {
  const latest = breadth.latest;
  return (
    <Tile title="Breadth" meta="% ADVANCERS">
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3 py-1.5">
        {latest === undefined ? (
          <p className="text-[11.5px] text-fog">No breadth data yet.</p>
        ) : (
          <>
            <span
              className="font-mono text-[26px] font-medium tabular-nums leading-none"
              style={{ color: latest >= 50 ? "var(--color-gain)" : "var(--color-loss)" }}
            >
              {latest.toFixed(0)}%
            </span>
            <span className="text-[10px] text-fog">of NSE names advanced</span>
            {breadth.history.length >= 2 && (
              <Sparkline values={breadth.history.map((h) => h.value)} width={110} height={20} />
            )}
          </>
        )}
      </div>
    </Tile>
  );
}
