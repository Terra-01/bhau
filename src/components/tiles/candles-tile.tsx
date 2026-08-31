import { CandlestickChart } from "@/components/charts/candlestick-chart";
import { Candlestick } from "@/components/charts/candlestick";
import type { WarRoomData } from "@/lib/warroom";
import { Tile } from "./tile";

export function CandlesTile({ candles }: { candles: WarRoomData["candles"] }) {
  return (
    <Tile title="Nifty 50 — daily" meta={`${candles.length} SESSIONS`}>
      {candles.length >= 3 ? (
        <div className="h-full px-2 py-1">
          <CandlestickChart data={candles} className="h-full" aspectRatio={undefined}>
            <Candlestick positiveFill="var(--color-gain)" negativeFill="var(--color-loss)" />
          </CandlestickChart>
        </div>
      ) : (
        <p className="px-3 py-4 text-[11.5px] text-fog">Candles draw once a few sessions of OHLC accumulate.</p>
      )}
    </Tile>
  );
}
