import { CalendarDays } from "lucide-react";
import type { ExchangeData } from "@/lib/exchange";
import { Avatar } from "./section";

function dayLabel(iso: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-ash bg-canvas">
      <div className="border-b border-ash px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">{title}</div>
      {children}
    </div>
  );
}

export function Calendars({ data }: { data: ExchangeData }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <Card title="Earnings & board meetings">
        <ul className="px-2.5 py-1">
          {data.earnings.length === 0 && <li className="py-3 text-[11.5px] text-fog">Nothing scheduled.</li>}
          {data.earnings.map((e) => (
            <li key={`${e.symbol}-${e.date}`} className="flex items-center gap-2 border-b border-ash py-[5px] last:border-b-0">
              <Avatar symbol={e.symbol} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11px] font-medium text-charcoal">{e.symbol}</span>
                <span className="block truncate text-[9.5px] text-fog">{e.isResults ? "Financial results" : (e.purpose ?? "Board meeting")}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] text-steel">{dayLabel(e.date)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="IPOs">
        <ul className="px-2.5 py-1">
          {data.ipos.length === 0 && <li className="py-3 text-[11.5px] text-fog">No open or upcoming issues.</li>}
          {data.ipos.map((ipo) => (
            <li key={`${ipo.symbol}-${ipo.date}`} className="border-b border-ash py-[5px] last:border-b-0">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-charcoal">{ipo.symbol}</span>
                {ipo.status && (
                  <span className={`rounded-full px-1.5 py-px text-[8.5px] font-semibold ${ipo.status === "Active" ? "bg-gain-wash text-gain" : "bg-paper text-fog"}`}>
                    {ipo.status.toUpperCase()}
                  </span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-steel">
                  {dayLabel(ipo.date)}{ipo.endDate ? `–${dayLabel(ipo.endDate)}` : ""}
                </span>
              </div>
              <div className="truncate text-[9.5px] text-fog">
                {ipo.company} {ipo.priceBand ? `· ${ipo.priceBand}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Economic releases">
        <ul className="px-2.5 py-1">
          {data.econCalendar.map((release) => (
            <li key={release.name} className="flex items-center gap-2 border-b border-ash py-[5px] last:border-b-0">
              <CalendarDays size={12} className="shrink-0 text-silver" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-charcoal">{release.name}</span>
                <span className="block text-[9.5px] text-fog">{release.source}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] text-steel">{dayLabel(release.date)}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-ash px-3 py-1.5 text-[9px] text-silver">Typical release days — publishers shift dates occasionally.</p>
      </Card>
    </div>
  );
}
