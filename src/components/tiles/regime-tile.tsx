import { Gauge } from "@/components/charts/gauge";
import type { WarRoomData } from "@/lib/warroom";
import { Sparkline } from "../sparkline";
import { Tile } from "./tile";

const BAND_COLOR: Record<string, string> = {
  Calm: "var(--color-regime-calm)",
  Steady: "var(--color-regime-steady)",
  Watchful: "var(--color-regime-watchful)",
  Strained: "var(--color-regime-strained)",
  Stressed: "var(--color-regime-stressed)",
};

export function RegimeTile({
  regime,
  trend,
}: {
  regime: WarRoomData["regime"];
  trend: WarRoomData["regimeTrend"];
}) {
  if (!regime) {
    return (
      <Tile title="Regime">
        <p className="px-3 py-4 text-[11.5px] text-fog">Insufficient data.</p>
      </Tile>
    );
  }
  return (
    <Tile
      title="Regime"
      meta={trend.delta !== undefined ? `Δ ${trend.delta > 0 ? "+" : ""}${trend.delta}` : undefined}
    >
      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-2 py-1">
        <div className="w-full max-w-[150px]">
          <Gauge
            value={regime.score}
            centerValue={regime.score}
            defaultLabel={regime.band}
            activeFill={BAND_COLOR[regime.band]}
            totalNotches={30}
            formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
          />
        </div>
        {trend.history.length >= 2 && (
          <Sparkline values={trend.history.map((h) => h.score)} width={110} height={18} />
        )}
      </div>
    </Tile>
  );
}
