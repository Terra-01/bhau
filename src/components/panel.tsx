import type { ReactNode } from "react";

export function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-canvas border border-ash rounded-card overflow-hidden ${className}`}>
      <header className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2 border-b border-ash">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-steel">{title}</h2>
        {meta ? <span className="font-mono text-[11px] text-fog whitespace-nowrap">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}
