"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Auto-rotating tab index for the terminal's panels: advances every
 * `intervalMs`, pauses while the reader hovers the panel or the tab is
 * hidden, and a manual selection holds rotation for three intervals.
 */
export function useCarousel(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const holdUntil = useRef(0);
  const hovering = useRef(false);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      if (document.hidden || hovering.current || Date.now() < holdUntil.current) return;
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  const select = useCallback(
    (i: number) => {
      holdUntil.current = Date.now() + intervalMs * 3;
      setIndex(i);
    },
    [intervalMs],
  );

  const pauseProps = {
    onMouseEnter: () => {
      hovering.current = true;
    },
    onMouseLeave: () => {
      hovering.current = false;
    },
  };

  return { index, select, pauseProps };
}
