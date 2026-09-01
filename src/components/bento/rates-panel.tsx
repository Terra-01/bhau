import type { RatesData } from "@/lib/rates";
import { deltaClass } from "@/lib/format";
import { Tile } from "../tiles/tile";

// India rates & macro: the G-sec yield curve drawn as a curve (RBI's own
// benchmark yields), the 10Y as the anchor number, spreads that answer
// "is anything unusual?", and slow macro vitals labeled with their year.

const W = 264;
const H = 116;
const PAD = { top: 10, right: 12, bottom: 16, left: 26 };

/** sqrt-x keeps the money end (3M–5Y) readable without crushing 30Y. */
const xOf = (tenor: number, maxTenor: number) =>
  PAD.left + (Math.sqrt(tenor) / Math.sqrt(maxTenor)) * (W - PAD.left - PAD.right);

const LABELED = new Set(["3M", "1Y", "3Y", "5Y", "10Y", "15Y", "30Y"]);

function YieldCurve({ curve, repo }: { curve: RatesData["curve"]; repo: number }) {
  const maxTenor = curve.at(-1)!.tenor;
  const yields = curve.map((c) => c.yield);
  const lo = Math.min(...yields, repo) - 0.2;
  const hi = Math.max(...yields, repo) + 0.2;
  const yOf = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const pts = curve.map((c) => ({ ...c, x: xOf(c.tenor, maxTenor), y: yOf(c.yield) }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const prevPts = curve.every((c) => c.prevYield !== undefined && c.prevYield !== c.yield)
    ? curve.map((c) => `${xOf(c.tenor, maxTenor).toFixed(1)},${yOf(c.prevYield!).toFixed(1)}`)
    : null;
  const y10 = pts.find((p) => p.label === "10Y");
  const repoY = yOf(repo);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-label="G-sec yield curve">
      {/* repo reference */}
      <line x1={PAD.left} x2={W - PAD.right} y1={repoY} y2={repoY} stroke="var(--color-pebble)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={W - PAD.right} y={repoY - 3} textAnchor="end" fontSize={7} fill="var(--color-fog)" className="font-mono">
        repo {repo.toFixed(2)}
      </text>
      {/* previous session ghost */}
      {prevPts && <polyline points={prevPts.join(" ")} fill="none" stroke="var(--color-smoke)" strokeWidth={1} strokeDasharray="2 3" />}
      {/* the curve */}
      <path d={path} fill="none" stroke="var(--color-charcoal)" strokeWidth={1.6} strokeLinejoin="round" />
      {pts.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={p.label === "10Y" ? 3 : 1.8} fill={p.label === "10Y" ? "var(--color-blue)" : "var(--color-charcoal)"} />
      ))}
      {/* endpoints + 10Y carry their values; tenors label the axis */}
      <text x={pts[0].x} y={pts[0].y - 5} textAnchor="start" fontSize={8} fill="var(--color-steel)" className="font-mono">
        {pts[0].yield.toFixed(2)}
      </text>
      {y10 && (
        <text x={y10.x} y={y10.y - 6} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="var(--color-blue)" className="font-mono">
          {y10.yield.toFixed(2)}
        </text>
      )}
      <text x={pts.at(-1)!.x} y={pts.at(-1)!.y - 5} textAnchor="end" fontSize={8} fill="var(--color-steel)" className="font-mono">
        {pts.at(-1)!.yield.toFixed(2)}
      </text>
      {pts
        .filter((p) => LABELED.has(p.label))
        .map((p) => (
          <text key={p.label} x={p.x} y={H - 4} textAnchor="middle" fontSize={7.5} fill="var(--color-fog)" className="font-mono">
            {p.label}
          </text>
        ))}
      {/* y-axis bounds */}
      <text x={2} y={yOf(hi - 0.2) + 3} fontSize={7} fill="var(--color-silver)" className="font-mono">
        {(hi - 0.2).toFixed(1)}
      </text>
      <text x={2} y={yOf(lo + 0.2) + 3} fontSize={7} fill="var(--color-silver)" className="font-mono">
        {(lo + 0.2).toFixed(1)}
      </text>
    </svg>
  );
}

const bp = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} bp`;

export function RatesPanel({ rates }: { rates: RatesData | null }) {
  if (!rates) {
    return (
      <Tile title="India rates & macro" meta="RBI">
        <p className="px-2.5 py-3 text-[11px] text-fog">Rates unavailable — the RBI scrape hasn&apos;t produced a curve yet.</p>
      </Tile>
    );
  }
  const { curve, repo, y10, spreads, macro, asOf } = rates;
  return (
    <Tile title="India rates & macro" meta={`G-SEC CURVE · RBI · ${asOf.slice(5).replace("-", "/")}`}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_1fr]">
          <div className="min-h-0 p-1">
            <YieldCurve curve={curve} repo={repo.value} />
          </div>
          <div className="flex min-h-0 flex-col justify-center gap-1 border-l border-ash px-2.5 py-1">
            {y10 && (
              <div>
                <div className="text-[8.5px] font-semibold uppercase tracking-[0.07em] text-fog">10Y G-sec</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[17px] font-semibold tabular-nums text-ink">{y10.value.toFixed(2)}%</span>
                  {y10.changeBps !== undefined && (
                    <span className={`font-mono text-[9.5px] tabular-nums ${deltaClass(y10.changeBps)}`}>{bp(y10.changeBps)}</span>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-px">
              {spreads.map((s) => (
                <div key={s.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-[9px] text-fog">{s.label}</span>
                  <span className={`font-mono text-[10px] font-medium tabular-nums ${s.bps < 0 ? "text-loss" : "text-charcoal"}`}>{bp(s.bps)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {macro && (
          <div className="flex shrink-0 items-baseline justify-between gap-2 border-t border-ash px-2.5 py-1">
            {macro.map((m) => (
              <span key={m.label} className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[8.5px] text-fog">{m.label}</span>
                <span className="font-mono text-[10.5px] font-medium tabular-nums text-ink">{m.value}</span>
                <span className="font-mono text-[7.5px] text-silver">{m.sub.slice(2)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </Tile>
  );
}
