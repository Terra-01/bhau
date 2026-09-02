"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

// One composition, every screen: at ≥1280×860 the grid breathes fluidly
// (its native range); anything smaller scales the full 1280×860 terminal
// down to fit — CSS zoom keeps layout math intact — letterboxed when the
// aspect differs. Popovers portal to <body>, outside this subtree, so the
// scale is mirrored to them through the --board-zoom custom property
// (consumed by ui/popover.tsx).
const DESIGN_W = 1280;
const DESIGN_H = 860;

// SSR can't know the viewport; measure before the first client paint.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ViewportFit({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      const next = scale >= 1 || scale <= 0 ? null : Math.round(scale * 1e4) / 1e4;
      setZoom(next);
      document.documentElement.style.setProperty("--board-zoom", String(next ?? 1));
    };
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="flex items-center justify-center overflow-hidden bg-canvas" style={{ height: "100dvh" }}>
      <div
        className="min-h-0 shrink-0"
        style={zoom !== null ? { zoom, width: DESIGN_W, height: DESIGN_H } : { width: "100%", height: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}
