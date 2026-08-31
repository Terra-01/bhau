"use client";

import { useMemo, useState } from "react";
import type { WarRoomData } from "@/lib/warroom";
import { timeIST } from "@/lib/format";
import { Tile } from "./tile";

const TABS = [
  { id: "all", label: "All" },
  { id: "markets", label: "Markets" },
  { id: "policy", label: "Policy" },
  { id: "economy", label: "Economy" },
  { id: "corporate", label: "Corporate" },
] as const;

const CATEGORY_DOT: Record<string, string> = {
  markets: "var(--color-blue)",
  policy: "var(--color-lavender)",
  economy: "var(--color-tangerine)",
  corporate: "var(--color-gain)",
};

export function NewsTile({ news }: { news: WarRoomData["news"] }) {
  const [tab, setTab] = useState<string>("all");
  const items = useMemo(() => {
    const merged = Object.entries(news).flatMap(([category, list]) =>
      (tab === "all" || tab === category ? list : []).map((item) => ({ ...item, category })),
    );
    return merged.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [news, tab]);

  return (
    <Tile
      title="Wire"
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
      scroll
    >
      <ul>
        {items.map((item) => (
          <li key={`${item.source}-${item.title}`} className="border-b border-ash last:border-b-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-1.5 px-3 py-[5px] transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper"
            >
              <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: CATEGORY_DOT[item.category] ?? "var(--color-silver)" }} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] leading-snug text-charcoal">{item.title}</span>
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-silver">{timeIST(new Date(item.ts))}</span>
            </a>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
