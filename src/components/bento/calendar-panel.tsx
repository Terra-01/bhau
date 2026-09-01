"use client";

import { CalendarDays, FileText, Megaphone, Rocket } from "lucide-react";
import { useMemo } from "react";
import { AssetPopover } from "@/components/asset-popover";
import { InfoPopover } from "@/components/info-popover";
import { InsightLine } from "@/components/insight-line";
import { FlipView } from "@/components/motion/flip-view";
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
      icon={<CalendarDays size={10} strokeWidth={2} className="text-warn" />}
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
      <FlipView id={tab} className="flex-1">
      <ul className="h-full overflow-y-auto">
        {items.length === 0 && <li className="px-3 py-4 text-[11.5px] text-fog">Nothing scheduled.</li>}
        {items.map((item, i) => {
          const [weekday, dayMonth] = dateCol(item.date);
          const firstOfDay = i === 0 || items[i - 1].date !== item.date;
          const isToday = item.date === todayIso;
          const RowIcon = tab === "ipos" ? Rocket : tab === "econ" ? Megaphone : item.badge ? FileText : null;
          const iconTone = tab === "ipos" ? "text-lavender" : tab === "econ" ? "text-warn" : "text-blue";
          const row = (
            <li
              className={`flex cursor-pointer items-center gap-2 border-b border-ash px-2.5 py-[3px] transition-colors duration-150 last:border-b-0 [@media(hover:hover)]:hover:bg-paper/60 ${isToday ? "bg-paper/60" : ""}`}
            >
              {/* date column only on a day's first row — the blank repeats read as grouping */}
              <span className="w-11 shrink-0 font-mono text-[8.5px] leading-tight text-fog">
                {firstOfDay && (
                  <>
                    {weekday} <span className={isToday ? "font-semibold text-ink" : "text-silver"}>{dayMonth}</span>
                  </>
                )}
              </span>
              {RowIcon && <RowIcon size={9} strokeWidth={2} className={`shrink-0 ${iconTone}`} />}
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
          const key = `${item.primary}-${item.date}`;
          // Earnings rows open the company card; IPOs and releases carry
          // their own event details.
          if (tab === "earnings") {
            return <AssetPopover key={key} symbol={item.primary} render={row} />;
          }
          if (tab === "ipos") {
            const ipo = data.ipos.find((p) => `${p.symbol} IPO` === item.primary && p.date === item.date);
            return (
              <InfoPopover
                key={key}
                title={ipo?.company ?? item.primary}
                sub="Public issue · NSE"
                rows={[
                  ["Symbol", ipo?.symbol ?? "—"],
                  ["Opens", item.date],
                  ...(ipo?.endDate ? ([["Closes", ipo.endDate]] as Array<[string, string]>) : []),
                  ...(ipo?.priceBand ? ([["Price band", ipo.priceBand]] as Array<[string, string]>) : []),
                  ["Status", ipo?.status ?? "—"],
                ]}
                note="From NSE's public-issues calendar. Listing-day symbols become clickable once they trade."
                render={row}
              />
            );
          }
          return (
            <InfoPopover
              key={key}
              title={item.primary}
              sub={`Data release · ${item.secondary ?? ""}`}
              rows={[["Expected", item.date]]}
              note="Recurring Indian data release; dates follow the publisher's usual pattern and can shift by a day or two."
              render={row}
            />
          );
        })}
      </ul>
      </FlipView>
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
