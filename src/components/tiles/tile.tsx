import type { ReactNode } from "react";

/** Mosaic tile: dense header, body fills the cell, overflow is the tile's
 *  problem (internal scroll), never the page's. */
export function Tile({
  title,
  meta,
  icon,
  children,
  scroll = false,
}: {
  title: string;
  meta?: ReactNode;
  /** Tiny glyph before the title (≈10px, inherits text-steel). */
  icon?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-ash bg-canvas">
      <header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-ash px-2.5 py-1">
        <h2 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-steel">
          {icon}
          {title}
        </h2>
        {meta ? <span className="font-mono text-[10px] text-fog whitespace-nowrap">{meta}</span> : null}
      </header>
      <div className={`min-h-0 flex-1 ${scroll ? "overflow-y-auto" : "overflow-hidden"}`}>{children}</div>
    </section>
  );
}
