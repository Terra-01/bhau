"use client";

import { useCallback, useRef, useState } from "react";
import { useCadence } from "./cadence";

/**
 * Auto-rotating tab index for the terminal's panels, driven by the shared
 * cadence clock (see cadence.ts for the full choreography): each panel
 * owns a { periodMs, offsetMs } slot in the board's 36s bar, pauses while
 * the reader hovers it or the tab is hidden, and a manual selection holds
 * rotation for three periods.
 */
export function useCarousel(count: number, periodMs: number, offsetMs = 0) {
  const [index, setIndex] = useState(0);
  const holdUntil = useRef(0);
  const hovering = useRef(false);

  useCadence(periodMs, offsetMs, () => {
    if (count <= 1) return;
    if (document.hidden || hovering.current || Date.now() < holdUntil.current) return;
    setIndex((i) => (i + 1) % count);
  });

  const select = useCallback(
    (i: number) => {
      holdUntil.current = Date.now() + periodMs * 3;
      setIndex(i);
    },
    [periodMs],
  );

  /**
   * Freeze rotation for `ms` — wire a detail popover's open state to this
   * so an open card is never unmounted mid-read (hover can't cover touch,
   * or a pointer that wandered off the tile).
   */
  const hold = useCallback((ms: number) => {
    holdUntil.current = Math.max(holdUntil.current, Date.now() + ms);
  }, []);

  const pauseProps = {
    onMouseEnter: () => {
      hovering.current = true;
    },
    onMouseLeave: () => {
      hovering.current = false;
    },
  };

  return { index, select, pauseProps, hold };
}
