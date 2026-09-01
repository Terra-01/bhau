import { InsightLine } from "@/components/insight-line";
import type { RatesData } from "@/lib/rates";
import { deltaClass } from "@/lib/format";
import { Tile } from "../tiles/tile";

// India rates & macro in the grammar TradingView/NSE use for this data:
// flat label | value | change rows, one section for the G-sec curve, one
// for the economy. Everything reads top-down in a single glance.

const SHOWN_TENORS = new Set(["3M", "1Y", "5Y", "10Y", "30Y"]);

const bp = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} bp`;

function SectionHeader({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between bg-paper/70 px-2.5 py-px">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">{left}</span>
      {right && <span className="font-mono text-[8px] uppercase text-silver">{right}</span>}
    </div>
  );
}

export function RatesPanel({ rates }: { rates: RatesData | null }) {
  if (!rates) {
    return (
      <Tile title="India rates & macro" meta="RBI">
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable — the RBI scrape hasn&apos;t produced a curve yet.</p>
      </Tile>
    );
  }
  const { curve, repo, y10, spreads, macro, asOf } = rates;
  const tenors = curve.filter((c) => SHOWN_TENORS.has(c.label));

  return (
    <Tile title="India rates & macro" meta={`RBI · ${asOf.slice(5).replace("-", "/")}`}>
      <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SectionHeader left="G-sec yields" right="Cut-off / EOD" />
        <ul>
          {tenors.map((t) => {
            const chg = t.prevYield !== undefined ? Math.round((t.yield - t.prevYield) * 100) : null;
            const is10 = t.label === "10Y";
            return (
              <li key={t.label} className="flex items-baseline gap-2 border-b border-ash px-2.5 py-[2.5px]">
                <span className={`w-8 font-mono text-[10.5px] ${is10 ? "font-semibold text-ink" : "font-medium text-charcoal"}`}>{t.label}</span>
                <span className={`ml-auto font-mono text-[10.5px] tabular-nums ${is10 ? "font-semibold text-ink" : "text-ink"}`}>
                  {t.yield.toFixed(3)}%
                </span>
                <span className={`w-12 text-right font-mono text-[9.5px] tabular-nums ${chg !== null && chg !== 0 ? deltaClass(chg) : "text-fog"}`}>
                  {chg !== null ? bp(chg) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
        {y10 && spreads.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-3 border-b border-ash px-2.5 py-[2.5px]">
            {spreads.map((s) => (
              <span key={s.id} className="whitespace-nowrap text-[9px] text-fog">
                {s.label}{" "}
                <span className={`font-mono text-[9.5px] font-medium tabular-nums ${s.bps < 0 ? "text-loss" : "text-charcoal"}`}>{bp(s.bps)}</span>
              </span>
            ))}
          </div>
        )}

        <SectionHeader left="Economy" right="Latest" />
        <ul>
          <li className="flex items-baseline gap-2 border-b border-ash px-2.5 py-[2.5px]">
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-charcoal">Repo rate</span>
            <span className="font-mono text-[10.5px] tabular-nums text-ink">{repo.value.toFixed(2)}%</span>
            <span className="w-12 text-right font-mono text-[8.5px] uppercase text-silver">RBI</span>
          </li>
          {macro?.map((m) => (
            <li key={m.label} className="flex items-baseline gap-2 border-b border-ash px-2.5 py-[2.5px] last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-charcoal">{m.label}</span>
              <span className="font-mono text-[10.5px] tabular-nums text-ink">{m.value}</span>
              <span className="w-12 whitespace-nowrap text-right font-mono text-[8.5px] uppercase text-silver">{m.sub}</span>
            </li>
          ))}
        </ul>
      </div>
      {y10 && (
        <InsightLine meta="RBI">
          {(() => {
            const oneY = curve.find((c) => c.label === "1Y");
            const inverted = oneY !== undefined && y10.value < oneY.yield;
            return (
              <>
                Curve {inverted ? <span className="text-loss">inverted</span> : "normal"} · 10Y {y10.value.toFixed(2)}% ·{" "}
                {Math.round((y10.value - repo.value) * 100)} bp over repo
              </>
            );
          })()}
        </InsightLine>
      )}
      </div>
    </Tile>
  );
}
