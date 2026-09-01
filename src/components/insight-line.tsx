import type { ReactNode } from "react";

/** One-line computed takeaway pinned to a tile's bottom edge. */
export function InsightLine({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mt-auto flex shrink-0 items-baseline justify-between gap-2 border-t border-ash px-2.5 py-[3px] text-[8.5px] leading-tight text-fog">
      <span className="min-w-0 truncate">{children}</span>
      {meta && <span className="shrink-0 font-mono text-[8px] uppercase text-silver">{meta}</span>}
    </div>
  );
}
