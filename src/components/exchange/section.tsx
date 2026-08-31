import type { ReactNode } from "react";

/** Per-section freshness disclosure — TradingView's "D" badge, our way. */
export function Fresh({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-ash px-2 py-px font-mono text-[9px] font-medium tracking-[0.06em] text-fog">
      {label}
    </span>
  );
}

export function Section({
  id,
  title,
  fresh,
  seeAll,
  children,
}: {
  id: string;
  title: string;
  fresh?: string;
  seeAll?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-14 pt-8">
      <header className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {fresh && <Fresh label={fresh} />}
        {seeAll && (
          <a
            href={seeAll.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[11px] font-medium text-blue [@media(hover:hover)]:hover:underline"
          >
            {seeAll.label} ↗
          </a>
        )}
      </header>
      {children}
    </section>
  );
}

/** Letter avatar — no free logo source, so we own the constraint. */
export function Avatar({ symbol }: { symbol: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-[9px] font-semibold text-steel">
      {symbol.slice(0, 2)}
    </span>
  );
}
