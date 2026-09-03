"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { DUR, EASE } from "@/lib/motion";

/**
 * Split-flap view switch for the rotating panels — the incoming view
 * flips down from the top edge like a departure-board flap, which is
 * what makes an ambient rotation legible as "the board just turned".
 * Transform/opacity only, 240ms in / 140ms out on the house curve.
 * Reduced motion: crossfade.
 */
export function FlipView({
  id,
  children,
  className = "",
}: {
  /** Key of the visible view — a change triggers the flap. */
  id: string | number;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative min-h-0 overflow-hidden [perspective:1200px] ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={id}
          className="h-full min-h-0"
          style={{ transformOrigin: "50% 0%", backfaceVisibility: "hidden" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "rotateX(-62deg)" }}
          animate={{ opacity: 1, transform: "rotateX(0deg)", transition: { duration: DUR.flip, ease: EASE } }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: DUR.flipOut } }
              : { opacity: 0, transform: "rotateX(26deg)", transition: { duration: DUR.flipOut, ease: EASE } }
          }
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
