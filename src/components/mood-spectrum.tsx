import type { RatesData } from "@/lib/rates";

// Fear & greed as a spectrum bar (CFGI-style visual), honest to the
// underlying gauge: Tickertape's Market Mood Index and its four real
// zones (<30 extreme fear · 30–50 fear · 50–70 greed · >70 extreme
// greed), with the current reading marked on the band.
const ZONES = [
  { label: "Extreme Fear", width: 30, color: "var(--color-loss)" },
  { label: "Fear", width: 20, color: "var(--color-warn)" },
  { label: "Greed", width: 20, color: "var(--color-gain)" },
  { label: "Extreme Greed", width: 30, color: "color-mix(in oklab, var(--color-gain) 65%, black)" },
] as const;

const TICKS = [0, 30, 50, 70, 100];

export function MoodSpectrum({ mmi }: { mmi: RatesData["mmi"] }) {
  if (!mmi) return null;
  return (
    <div className="shrink-0 border-t border-ash px-2.5 pb-0.5 pt-0.5">
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">Fear &amp; greed</span>
        <span className="font-mono text-[9px] tabular-nums text-fog">
          <span className="font-semibold text-ink">{mmi.value}</span> · {mmi.zone.toUpperCase()}
          <span className="text-silver"> · MMI</span>
        </span>
      </div>
      <div className="relative">
        <div className="flex h-[8px] gap-[2px]">
          {ZONES.map((zone) => (
            <div
              key={zone.label}
              title={zone.label}
              className="h-full rounded-[3px]"
              style={{ width: `${zone.width}%`, background: zone.color }}
            />
          ))}
        </div>
        {/* current reading */}
        <div
          className="absolute -top-[2px] h-[12px] w-[2px] rounded-full bg-ink shadow-[0_0_0_1.5px_var(--color-canvas)]"
          style={{ left: `calc(${Math.min(100, Math.max(0, mmi.value))}% - 1px)` }}
        />
      </div>
      <div className="relative mt-0.5 h-[9px] font-mono text-[7.5px] text-silver">
        {TICKS.map((t) => (
          <span
            key={t}
            className="absolute"
            style={t === 0 ? { left: 0 } : t === 100 ? { right: 0 } : { left: `${t}%`, transform: "translateX(-50%)" }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
