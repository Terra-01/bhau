"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Terminal-standard tick flash: when the wrapped value changes, wash the
 * cell in gain/loss color and decay. Imperative classes — zero renders,
 * restarts cleanly on rapid ticks.
 */
export function TickFlash({
  value,
  children,
  className = "",
}: {
  value: number | undefined;
  children: ReactNode;
  className?: string;
}) {
  const el = useRef<HTMLSpanElement | null>(null);
  const prev = useRef<number | undefined>(undefined);

  useEffect(() => {
    const node = el.current;
    if (!node || prev.current === undefined || value === undefined || value === prev.current) {
      prev.current = value;
      return;
    }
    // Double-rAF restart instead of the `void offsetWidth` idiom: a poll
    // moves ~25 cells in one commit, and a per-cell forced layout would
    // reflow the whole zoomed board 25 times in a frame. This way every
    // cell's class removal flushes in one frame and the re-adds land
    // together in the next — zero forced layouts, one coordinated pulse.
    const cls = value > prev.current ? "tick-up" : "tick-down";
    prev.current = value;
    node.classList.remove("tick-up", "tick-down");
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => node.classList.add(cls));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [value]);

  return (
    <span ref={el} className={`rounded-[3px] ${className}`}>
      {children}
    </span>
  );
}
