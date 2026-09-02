"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCarousel } from "@/lib/use-carousel";

// The footer carries the honesty protocol in rotation: disclaimers, the
// data supply chain, cadences, and the no-intraday-signals rule.
const MESSAGES = [
  "BHAU · PAPER CAPITAL ONLY · NOT INVESTMENT ADVICE",
  "LIVE QUOTES REFRESH ~30S DURING NSE HOURS · NSE + YAHOO SOURCES, EOD ARCHIVE WHEN OFFLINE",
  "AGENT DECISIONS PUBLISH AFTER MARKET CLOSE — NEVER INTRADAY, NEVER A SIGNAL",
  "DATA: NSE · YAHOO · RBI · IBJA · ECB · WORLD BANK · TICKERTAPE MMI · OPEN-METEO · GOODRETURNS · ITUNES",
  "FOUR AI AGENTS TRADE PAPER CAPITAL DAILY — THE SCOREBOARD SETTLES AT THE CLOSE",
  "FUEL & BULLION DAILY · G-SEC YIELDS EOD FROM RBI · MACRO ANNUAL, YEAR-LABELLED",
];

export function FooterTicker() {
  const { index, pauseProps } = useCarousel(MESSAGES.length, 7_000);
  const reduce = useReducedMotion();
  return (
    <span className="relative min-w-0 flex-1 overflow-hidden" {...pauseProps}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          className="block truncate"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(0.7em)" }}
          animate={{ opacity: 1, transform: "translateY(0em)", transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, transform: "translateY(-0.7em)", transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }
          }
        >
          {MESSAGES[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
