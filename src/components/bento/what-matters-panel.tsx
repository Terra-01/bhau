"use client";

import { ArrowDownRight, ArrowUpRight, Newspaper } from "lucide-react";
import { useMemo } from "react";
import { FlipView } from "@/components/motion/flip-view";
import type { WarRoomData } from "@/lib/warroom";
import { crore, deltaClass, timeIST } from "@/lib/format";
import { useCarousel } from "@/lib/use-carousel";
import { Tile } from "../tiles/tile";

// The intelligence panel: desk synthesis first, the wire behind tabs,
// with FII/DII as a single always-visible strip (the daily ritual).
const TABS = [
  { id: "synthesis", label: "What matters" },
  { id: "all", label: "All" },
  { id: "markets", label: "Markets" },
  { id: "policy", label: "Policy" },
  { id: "economy", label: "Economy" },
  { id: "corporate", label: "Corporate" },
] as const;

const TONE_COLOR: Record<string, string> = {
  risk: "var(--color-loss)",
  constructive: "var(--color-gain)",
  neutral: "var(--color-silver)",
};

export function WhatMattersPanel({
  synthesis,
  news,
  flows,
  fiiStreak,
}: {
  synthesis: WarRoomData["synthesis"];
  news: WarRoomData["news"];
  flows: WarRoomData["flows"];
  fiiStreak: WarRoomData["fiiStreak"];
}) {
  const { index, select, pauseProps } = useCarousel(TABS.length, 15_000);
  const tab = TABS[index].id;

  const items = useMemo(() => {
    if (tab === "synthesis") return [];
    const merged = Object.entries(news).flatMap(([category, list]) =>
      (tab === "all" || tab === category ? list : []).map((item) => ({ ...item, category })),
    );
    return merged.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [news, tab]);

  const latestFlowDate = flows[0]?.date;
  const fii = flows.find((f) => f.date === latestFlowDate && f.category.startsWith("FII"));
  const dii = flows.find((f) => f.date === latestFlowDate && f.category === "DII");

  return (
    <Tile
      title="Intelligence"
      icon={<Newspaper size={10} strokeWidth={2} />}
      meta={
        <span className="flex gap-1">
          {TABS.map(({ id, label }, i) => (
            <button
              key={id}
              type="button"
              onClick={() => select(i)}
              className={`rounded-full px-2 py-px font-sans text-[9.5px] font-semibold transition-colors duration-150 ${
                tab === id ? "bg-charcoal text-canvas" : "text-fog [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col" {...pauseProps}>
        {/* FII/DII — the ritual, one row, always visible */}
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-ash bg-paper/60 px-2.5 py-1">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-fog">
            Flows {latestFlowDate ?? ""}
          </span>
          {fii && (
            <span className="flex items-center gap-0.5 text-[10.5px] text-fog">
              FII <span className={`font-mono text-[11px] font-medium tabular-nums ${deltaClass(fii.net)}`}>{crore(fii.net)}</span>
              {fii.net < 0 ? <ArrowDownRight size={10} className="text-loss" /> : <ArrowUpRight size={10} className="text-gain" />}
            </span>
          )}
          {dii && (
            <span className="flex items-center gap-0.5 text-[10.5px] text-fog">
              DII <span className={`font-mono text-[11px] font-medium tabular-nums ${deltaClass(dii.net)}`}>{crore(dii.net)}</span>
              {dii.net < 0 ? <ArrowDownRight size={10} className="text-loss" /> : <ArrowUpRight size={10} className="text-gain" />}
            </span>
          )}
          {fiiStreak && (
            <span className="font-mono text-[9.5px] uppercase text-silver">
              FII {fiiStreak.direction} · day {fiiStreak.days}
            </span>
          )}
        </div>

        <FlipView id={tab} className="flex-1">
        <div className="h-full overflow-y-auto">
          {tab === "synthesis" ? (
            synthesis ? (
              <div className="px-2.5 py-1.5">
                <p className="text-[13px] font-medium leading-snug text-ink">{synthesis.headline}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {synthesis.bullets.map((bullet) => (
                    <li key={bullet.text} className="flex gap-2 text-[11.5px] leading-relaxed text-steel">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[bullet.tone] }} />
                      {bullet.text}
                    </li>
                  ))}
                </ul>
                <p className="pt-2 text-[9px] text-silver">DESK SYNTHESIS · GENERATED WITH THE EVENING PACK · NOT ADVICE</p>
              </div>
            ) : (
              <p className="px-3 py-4 text-[11.5px] text-fog">Synthesis lands with the evening pipeline run.</p>
            )
          ) : (
            <ul>
              {items.map((item) => (
                <li key={`${item.source}-${item.title}`} className="border-b border-ash last:border-b-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-baseline gap-1.5 px-3 py-[5px] transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11.5px] leading-snug text-charcoal">{item.title}</span>
                    <span className="shrink-0 font-mono text-[9px] tabular-nums text-silver">{timeIST(new Date(item.ts))}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        </FlipView>
      </div>
    </Tile>
  );
}
