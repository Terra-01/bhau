"use client";

import { useMemo } from "react";
import { InsightLine } from "@/components/insight-line";
import type { ExchangeData } from "@/lib/exchange";
import { useCarousel } from "@/lib/use-carousel";
import { Tile } from "../tiles/tile";

// Flat chronological rows with an inline date column — no week strip, no
// group headers. Today's rows are tinted; results outrank AGM noise.
const TABS = [
  { id: "earnings", label: "Earnings" },
  { id: "ipos", label: "IPOs" },
  { id: "econ", label: "Releases" },
] as const;

interface CalItem {
  date: string;
  primary: string;
  secondary?: string;
  badge?: string;
  badgeTone?: "gain" | "neutral";
  emphasized: boolean;
}

// "2026-09-04" → ["FRI", "4 SEP"]
function dateCol(iso: string): [string, string] {
  const d = new Date(`${iso}T00:00:00`);
  return [
    d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase(),
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }).toUpperCase(),
  ];
}

export function CalendarPanel({ data, todayIso }: { data: ExchangeData; todayIso: string }) {
  const { index, select, pauseProps } = useCarousel(TABS.length, 17_000);
  const tab = TABS[index].id;

  const items: CalItem[] = useMemo(() => {
    const list: CalItem[] =
      tab === "earnings"
        ? data.earnings.map((e) => ({
            date: e.date,
            primary: e.symbol,
            secondary: e.isResults ? "Financial results" : (e.purpose ?? "Board meeting"),
            badge: e.isResults ? "RESULTS" : undefined,
            badgeTone: "neutral" as const,
            emphasized: e.isResults,
          }))
        : tab === "ipos"
          ? data.ipos.map((ipo) => ({
              date: ipo.date,
              primary: `${ipo.symbol} IPO`,
              secondary: `${ipo.company ?? ""}${ipo.priceBand ? ` · ${ipo.priceBand}` : ""}`,
              badge: ipo.status?.toUpperCase(),
              badgeTone: ipo.status === "Active" ? ("gain" as const) : ("neutral" as const),
              emphasized: true,
            }))
          : data.econCalendar.map((release) => ({
              date: release.date,
              primary: release.name,
              secondary: release.source,
              emphasized: true,
            }));
    return list.sort((a, b) => a.date.localeCompare(b.date) || Number(b.emphasized) - Number(a.emphasized));
  }, [data, tab]);

  return (
    <Tile
      title="Calendar"
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
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && <li className="px-3 py-4 text-[11.5px] text-fog">Nothing scheduled.</li>}
        {items.map((item, i) => {
          const [weekday, dayMonth] = dateCol(item.date);
          const firstOfDay = i === 0 || items[i - 1].date !== item.date;
          const isToday = item.date === todayIso;
          return (
            <li
              key={`${item.primary}-${item.date}`}
              className={`flex items-center gap-2 border-b border-ash px-2.5 py-[3px] last:border-b-0 ${isToday ? "bg-paper/60" : ""}`}
            >
              {/* date column only on a day's first row — the blank repeats read as grouping */}
              <span className="w-11 shrink-0 font-mono text-[8.5px] leading-tight text-fog">
                {firstOfDay && (
                  <>
                    {weekday} <span className={isToday ? "font-semibold text-ink" : "text-silver"}>{dayMonth}</span>
                  </>
                )}
              </span>
              <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${item.emphasized ? "text-charcoal" : "text-steel"}`}>
                {item.primary}
              </span>
              {item.badge && (
                <span className={`rounded-full px-1.5 py-px text-[8.5px] font-semibold ${item.badgeTone === "gain" ? "bg-gain-wash text-gain" : "bg-paper text-fog"}`}>
                  {item.badge}
                </span>
              )}
              <span className="max-w-[40%] truncate text-[9.5px] text-fog">{item.secondary}</span>
            </li>
          );
        })}
      </ul>
      <InsightLine meta="NSE">
        {(() => {
          const nextResults = data.earnings.find((e) => e.isResults);
          const openIpos = data.ipos.filter((ipo) => ipo.status === "Active").length;
          if (!nextResults && openIpos === 0) return "Quiet week — nothing market-moving scheduled";
          const [wd, dm] = nextResults ? dateCol(nextResults.date) : ["", ""];
          return (
            <>
              {nextResults && (
                <>
                  Next results {nextResults.symbol} · {wd} {dm}
                </>
              )}
              {nextResults && openIpos > 0 && " · "}
              {openIpos > 0 && `${openIpos} IPO${openIpos > 1 ? "s" : ""} open`}
            </>
          );
        })()}
      </InsightLine>
      </div>
    </Tile>
  );
}
