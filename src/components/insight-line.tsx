"use client";

import { type ReactNode, useState } from "react";

/**
 * One-line computed takeaway pinned to a tile's bottom edge. Narrow
 * tiles truncate it — clicking toggles the full text in place (wrapping
 * to as many lines as it needs, overlaying nothing since tiles keep
 * their own overflow).
 */
export function InsightLine({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((e) => !e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded((x) => !x);
      }}
      title={expanded ? undefined : "Show full line"}
      className="mt-auto flex shrink-0 cursor-pointer items-baseline justify-between gap-2 border-t border-ash px-2.5 py-[3px] text-[8.5px] leading-tight text-fog transition-colors duration-150 [@media(hover:hover)]:hover:bg-paper/60"
    >
      <span className={expanded ? "min-w-0 whitespace-normal" : "min-w-0 truncate"}>{children}</span>
      {meta && <span className="shrink-0 font-mono text-[8px] uppercase text-silver">{meta}</span>}
    </div>
  );
}
