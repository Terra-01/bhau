"use client";

import { useEffect, useState, type ReactNode } from "react";

// One composition, every screen: at ≥1280px the grid breathes fluidly
// (its native range); below that the full 1280×860 terminal scales down
// to fit — CSS zoom keeps layout math intact — letterboxed when the
// aspect differs. Nothing reflows, nothing scrolls, nothing hides.
const DESIGN_W = 1280;
const DESIGN_H = 860;

export function ViewportFit({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setZoom(w >= DESIGN_W ? null : Math.min(w / DESIGN_W, h / DESIGN_H));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="flex justify-center overflow-hidden bg-canvas" style={{ height: "100dvh" }}>
      <div
        className="min-h-0 shrink-0"
        style={zoom ? { zoom, width: DESIGN_W, height: DESIGN_H } : { width: "100%", height: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}
