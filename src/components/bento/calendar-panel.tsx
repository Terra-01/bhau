"use client";

import { useMemo, useState } from "react";
import type { ExchangeData } from "@/lib/exchange";
import { Tile } from "../tiles/tile";

// Tabbed calendar with a week strip (TradingView's widget grammar):
// day cells up top with event counts, grouped list below.
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
}

function dayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
}

export function CalendarPanel({ data, todayIso }: { data: ExchangeData; todayIso: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("earnings");

  const items: CalItem[] = useMemo(() => {
    if (tab === "earnings") {
      return data.earnings.map((e) => ({
        date: e.date,
        primary: e.symbol,
        secondary: e.isResults ? "Financial results" : (e.purpose ?? "Board meeting"),
        badge: e.isResults ? "RESULTS" : undefined,
        badgeTone: "neutral" as const,
      }));
    }
    if (tab === "ipos") {
      return data.ipos.map((ipo) => ({
        date: ipo.date,
        primary: `${ipo.symbol} IPO`,
        secondary: `${ipo.company ?? ""}${ipo.priceBand ? ` · ${ipo.priceBand}` : ""}`,
        badge: ipo.status?.toUpperCase(),
        badgeTone: ipo.status === "Active" ? ("gain" as const) : ("neutral" as const),
      }));
    }
    return data.econCalendar.map((release) => ({
      date: release.date,
      primary: release.name,
      secondary: release.source,
    }));
  }, [data, tab]);

  const week = useMemo(() => {
    const days: Array<{ iso: string; count: number }> = [];
    const start = new Date(`${todayIso}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, count: items.filter((it) => it.date === iso).length });
    }
    return days;
  }, [items, todayIso]);

  const byDate = useMemo(() => {
    const grouped = new Map<string, CalItem[]>();
    for (const item of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
      (grouped.get(item.date) ?? grouped.set(item.date, []).get(item.date)!).push(item);
    }
    return [...grouped.entries()];
  }, [items]);

  return (
    <Tile
      title="Calendar"
      meta={
        <span className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
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
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid shrink-0 grid-cols-7 border-b border-ash">
          {week.map((day) => (
            <div key={day.iso} className={`flex flex-col items-center border-r border-ash py-1 last:border-r-0 ${day.iso === todayIso ? "bg-paper" : ""}`}>
              <span className="text-[8.5px] font-semibold uppercase text-fog">{dayLabel(day.iso, todayIso)}</span>
              <span className={`font-mono text-[10.5px] tabular-nums ${day.count > 0 ? "text-ink" : "text-silver"}`}>{day.count || "·"}</span>
            </div>
          ))}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {byDate.length === 0 && <li className="px-3 py-4 text-[11.5px] text-fog">Nothing scheduled.</li>}
          {byDate.map(([date, dayItems]) => (
            <li key={date}>
              <div className="bg-paper/70 px-3 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-fog">
                {dayLabel(date, todayIso)} · {date}
              </div>
              {dayItems.map((item) => (
                <div key={`${item.primary}-${item.date}`} className="flex items-baseline gap-2 border-b border-ash px-3 py-[4.5px] last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-charcoal">{item.primary}</span>
                  {item.badge && (
                    <span className={`rounded-full px-1.5 py-px text-[8.5px] font-semibold ${item.badgeTone === "gain" ? "bg-gain-wash text-gain" : "bg-paper text-fog"}`}>
                      {item.badge}
                    </span>
                  )}
                  <span className="max-w-[45%] truncate text-[9.5px] text-fog">{item.secondary}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </Tile>
  );
}
