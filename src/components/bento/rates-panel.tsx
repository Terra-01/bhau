import { Landmark } from "lucide-react";
import { InfoPopover } from "@/components/info-popover";
import { InsightLine } from "@/components/insight-line";
import { MoodSpectrum } from "@/components/mood-spectrum";
import type { RatesData } from "@/lib/rates";
import { deltaClass } from "@/lib/format";
import { Tile } from "../tiles/tile";

// India rates & macro, two columns so nothing scrolls: the G-sec curve
// with its spreads on the left, the economy on the right, and the
// fear/greed spectrum across the bottom.

const SHOWN_TENORS = new Set(["3M", "1Y", "5Y", "10Y", "30Y"]);

const bp = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} bp`;

const TENOR_NOTE: Record<string, string> = {
  "3M": "91-day T-bill cut-off yield at the last weekly RBI auction.",
  "6M": "182-day T-bill cut-off yield at the last weekly RBI auction.",
  "1Y": "364-day T-bill cut-off yield at the last weekly RBI auction.",
};
const GSEC_NOTE = "End-of-day yield of the benchmark government security closest to this tenor, as published on RBI's own board.";

const ECON_NOTE: Record<string, string> = {
  "Repo rate": "The rate at which RBI lends overnight against G-secs — the policy anchor every other Indian rate keys off.",
  "GDP growth": "Real GDP growth. World Bank annual series — quarterly prints reach the wire in Intelligence first.",
  "CPI inflation": "Consumer price inflation, annual average. World Bank; monthly MOSPI CPI has no keyless feed.",
  Unemployment: "ILO-modelled unemployment estimate. World Bank annual series.",
  GDP: "Nominal GDP in US dollars. World Bank.",
  CRR: "Cash reserve ratio — the share of deposits banks must park with RBI, interest-free.",
  SLR: "Statutory liquidity ratio — the share of deposits banks must hold in liquid assets such as G-secs.",
};

function SectionHeader({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between bg-paper/70 px-2 py-px">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">{left}</span>
      {right && <span className="font-mono text-[8px] uppercase text-silver">{right}</span>}
    </div>
  );
}

export function RatesPanel({ rates }: { rates: RatesData | null }) {
  if (!rates) {
    return (
      <Tile title="India rates & macro" icon={<Landmark size={10} strokeWidth={2} className="text-sapphire" />} meta="RBI">
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable — the RBI scrape hasn&apos;t produced a curve yet.</p>
      </Tile>
    );
  }
  const { curve, repo, ratios, y10, spreads, macro, asOf, mmi } = rates;
  const tenors = curve.filter((c) => SHOWN_TENORS.has(c.label));

  const economy: Array<{ label: string; value: string; sub: string }> = [
    { label: "Repo rate", value: `${repo.value.toFixed(2)}%`, sub: "RBI" },
    ...(macro ?? []),
    ...(ratios.crr !== undefined ? [{ label: "CRR", value: `${ratios.crr.toFixed(2)}%`, sub: "RBI" }] : []),
    ...(ratios.slr !== undefined ? [{ label: "SLR", value: `${ratios.slr.toFixed(2)}%`, sub: "RBI" }] : []),
  ];

  return (
    <Tile title="India rates & macro" icon={<Landmark size={10} strokeWidth={2} className="text-sapphire" />} meta={`RBI · ${asOf.slice(5).replace("-", "/")}`}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-2">
          <div className="flex min-h-0 flex-col border-r border-ash">
            <SectionHeader left="G-sec yields" right="EOD" />
            <ul>
              {tenors.map((t) => {
                const chg = t.prevYield !== undefined ? Math.round((t.yield - t.prevYield) * 100) : null;
                const is10 = t.label === "10Y";
                return (
                  <InfoPopover
                    key={t.label}
                    title={`${t.label} G-sec yield`}
                    sub="RBI · end of day"
                    rows={[
                      ["Yield", `${t.yield.toFixed(3)}%`],
                      ["1D change", chg !== null ? bp(chg) : "—"],
                    ]}
                    note={TENOR_NOTE[t.label] ?? GSEC_NOTE}
                    render={
                      <li
                        role="button"
                        tabIndex={0}
                        className="flex cursor-pointer items-baseline gap-1 border-b border-ash px-2 py-[2px] transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper/60"
                      >
                        <span className={`w-7 font-mono text-[10px] leading-tight ${is10 ? "font-semibold text-ink" : "font-medium text-charcoal"}`}>
                          {t.label}
                        </span>
                        <span className={`ml-auto font-mono text-[10px] leading-tight tabular-nums ${is10 ? "font-semibold" : ""} text-ink`}>
                          {t.yield.toFixed(2)}%
                        </span>
                        <span className={`w-10 text-right font-mono text-[8.5px] leading-tight tabular-nums ${chg !== null && chg !== 0 ? deltaClass(chg) : "text-fog"}`}>
                          {chg !== null ? bp(chg) : "—"}
                        </span>
                      </li>
                    }
                  />
                );
              })}
            </ul>
            {y10 && spreads.length > 0 && (
              <ul className="mt-auto">
                {spreads.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between border-t border-ash px-2 py-[2px]">
                    <span className="text-[8.5px] leading-tight text-fog">{s.label}</span>
                    <span className={`font-mono text-[9px] font-medium leading-tight tabular-nums ${s.bps < 0 ? "text-loss" : "text-charcoal"}`}>
                      {bp(s.bps)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            <SectionHeader left="Economy" right="Latest" />
            <ul>
              {economy.map((m) => (
                <InfoPopover
                  key={m.label}
                  title={m.label}
                  sub={m.sub.toUpperCase()}
                  rows={[["Latest", m.value]]}
                  note={ECON_NOTE[m.label]}
                  render={
                    <li
                      role="button"
                      tabIndex={0}
                      className="flex cursor-pointer items-baseline gap-1 border-b border-ash px-2 py-[2px] transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60"
                    >
                      <span className="min-w-0 flex-1 truncate text-[9.5px] leading-tight text-charcoal">{m.label}</span>
                      <span className="font-mono text-[10px] leading-tight tabular-nums text-ink">{m.value}</span>
                      <span className="w-9 whitespace-nowrap text-right font-mono text-[7.5px] uppercase leading-tight text-silver">{m.sub}</span>
                    </li>
                  }
                />
              ))}
            </ul>
          </div>
        </div>

        <MoodSpectrum mmi={mmi} />

        {y10 && (
          <InsightLine meta="RBI · MMI">
            {(() => {
              const oneY = curve.find((c) => c.label === "1Y");
              const inverted = oneY !== undefined && y10.value < oneY.yield;
              return (
                <>
                  Curve {inverted ? <span className="text-loss">inverted</span> : "normal"} · 10Y {y10.value.toFixed(2)}%
                  {mmi && (
                    <>
                      {" "}· mood <span className={mmi.value < 50 ? "text-loss" : "text-gain"}>{mmi.zone.toLowerCase()}</span>
                    </>
                  )}
                </>
              );
            })()}
          </InsightLine>
        )}
      </div>
    </Tile>
  );
}
