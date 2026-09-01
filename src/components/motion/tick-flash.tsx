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
    if (node && prev.current !== undefined && value !== undefined && value !== prev.current) {
      node.classList.remove("tick-up", "tick-down");
      void node.offsetWidth; // restart the animation
      node.classList.add(value > prev.current ? "tick-up" : "tick-down");
    }
    prev.current = value;
  }, [value]);

  return (
    <span ref={el} className={`rounded-[3px] ${className}`}>
      {children}
    </span>
  );
}
