"use client";

import type { ReactElement, ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface InfoCardProps {
  title: string;
  sub?: string;
  rows?: Array<[string, ReactNode]>;
  note?: string;
}

/** The card itself — also used by RowPopover for table rows. */
export function InfoCard({ title, sub, rows = [], note }: InfoCardProps) {
  return (
    <div className="w-[250px] overflow-hidden rounded-lg bg-canvas text-ink">
      <div className="border-b border-ash px-3 py-2">
        <div className="text-[12px] font-semibold leading-snug text-ink">{title}</div>
        {sub && <div className="text-[9.5px] text-fog">{sub}</div>}
      </div>
      {rows.length > 0 && (
        <ul className="px-3 py-1.5">
          {rows.map(([label, value]) => (
            <li key={label} className="flex items-baseline justify-between gap-3 py-[2px]">
              <span className="text-[9.5px] text-fog">{label}</span>
              <span className="text-right font-mono text-[10.5px] tabular-nums text-charcoal">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="border-t border-ash px-3 py-2 text-[9.5px] leading-snug text-steel">{note}</p>}
    </div>
  );
}

/**
 * Small details card for non-tradeable rows — calendar events, macro
 * metrics, city readings. The row element itself is the trigger. Only
 * for non-table rows (li/div): tbody children must stay pure tr.
 */
export function InfoPopover({
  render,
  ...card
}: InfoCardProps & {
  render: ReactElement<Record<string, unknown>>;
}) {
  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={render} />
      <PopoverContent align="start" className="p-0">
        <InfoCard {...card} />
      </PopoverContent>
    </Popover>
  );
}
