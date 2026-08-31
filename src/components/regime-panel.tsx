import type { WarRoomData } from "@/lib/warroom";
import { Panel } from "./panel";

const SEGMENTS = [
  ["Calm", "var(--color-regime-calm)"],
  ["Steady", "var(--color-regime-steady)"],
  ["Watchful", "var(--color-regime-watchful)"],
  ["Strained", "var(--color-regime-strained)"],
  ["Stressed", "var(--color-regime-stressed)"],
] as const;

const COMPONENT_LABEL: Record<string, string> = {
  vix: "India VIX",
  nifty5d: "Nifty 5d",
  inr5d: "INR 5d",
  brent5d: "Brent 5d",
};

export function RegimePanel({ regime }: { regime: WarRoomData["regime"] }) {
  return (
    <Panel title="India Regime Index" meta="FORMULA PUBLISHED">
      {regime ? (
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[28px] font-medium tabular-nums text-ink">{regime.score.toFixed(1)}</span>
            <span className="text-[13px] font-semibold text-charcoal">{regime.band}</span>
          </div>
          <div className="relative">
            <div className="flex h-2.5 gap-[3px]">
              {SEGMENTS.map(([label, color]) => (
                <span key={label} className="flex-1 rounded-full" style={{ background: color }} />
              ))}
            </div>
            <span
              className="absolute -top-[7px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent"
              style={{ left: `${Math.min(99, Math.max(1, regime.score))}%`, borderTopColor: "var(--color-ink)" }}
            />
          </div>
          <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-[0.06em] text-silver">
            {SEGMENTS.map(([label]) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ash pt-3">
            {Object.entries(regime.components).map(([key, c]) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-fog">{COMPONENT_LABEL[key] ?? key}</dt>
                <dd className="font-mono text-[11.5px] tabular-nums text-charcoal">
                  {c.value}
                  <span className="text-silver"> · s{c.stress}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="px-4 py-6 text-[13px] text-fog">Insufficient data to compute the regime.</p>
      )}
    </Panel>
  );
}
