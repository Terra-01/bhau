"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DUR, EASE } from "@/lib/motion";

/**
 * Board-style rolling number: on a tick the old value rolls out and the
 * new one rolls in, in the direction of the move (up-tick rolls upward).
 * For the hero tape only — table cells get the cheaper TickFlash.
 */
export function SlideValue({ n, text, className = "" }: { n: number; text: string; className?: string }) {
  const reduce = useReducedMotion();
  // React's "storing information from previous renders" pattern — the
  // direction of the move must be known while rendering the new value.
  const [prevN, setPrevN] = useState(n);
  const [direction, setDirection] = useState(0);
  if (prevN !== n) {
    setPrevN(n);
    setDirection(n > prevN ? 1 : -1);
  }
  const enterY = direction >= 0 ? "0.7em" : "-0.7em";
  const exitY = direction >= 0 ? "-0.7em" : "0.7em";

  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={className}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${enterY})` }}
          animate={{ opacity: 1, transform: "translateY(0em)", transition: { duration: DUR.enter, ease: EASE } }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: DUR.exit } }
              : { opacity: 0, transform: `translateY(${exitY})`, transition: { duration: DUR.exit, ease: EASE } }
          }
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
