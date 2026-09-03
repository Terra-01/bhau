"use client";

import { useEffect, useRef } from "react";

// The board's metronome. Every ambient rotation subscribes with a
// { periodMs, offsetMs } slot against ONE shared epoch, so the idle loop
// is a composed bar instead of seven drifting timers: all panel flips sit
// on a 6s comb (36s bar), the footer takes the 3s half-beat, the chart
// tour the 4.5s quarter-beat — no two flips can ever collide, and the
// choreography is identical on every visit.
//
//   surface        period  offset   beats in the 36s bar
//   movers           18s     0s     0, 18
//   what-matters     36s     6s     6
//   calendar         36s    12s     12
//   city             36s    24s     24
//   fun corner       36s    30s     30
//   footer           12s     3s     3, 15, 27
//   watchlist tour    9s   4.5s     4.5, 13.5, 22.5, 31.5
//
// A paused surface (hover/hold/hidden) skips its beat — the bar plays on.

const EPOCH = Date.now();
const TICK_MS = 250;

type Subscriber = { periodMs: number; offsetMs: number; last: number; fire: () => void };

const subscribers = new Set<Subscriber>();
let clock: ReturnType<typeof setInterval> | undefined;

function tick() {
  const now = Date.now();
  for (const sub of subscribers) {
    const k = Math.floor((now - EPOCH - sub.offsetMs) / sub.periodMs);
    if (k > sub.last && k >= 0) {
      sub.last = k;
      sub.fire();
    }
  }
}

export function useCadence(periodMs: number, offsetMs: number, onBeat: () => void): void {
  const beat = useRef(onBeat);
  beat.current = onBeat;

  useEffect(() => {
    const sub: Subscriber = {
      periodMs,
      offsetMs,
      // start counting from now — no burst of missed beats on mount
      last: Math.floor((Date.now() - EPOCH - offsetMs) / periodMs),
      fire: () => beat.current(),
    };
    subscribers.add(sub);
    if (!clock) clock = setInterval(tick, TICK_MS);
    return () => {
      subscribers.delete(sub);
      if (subscribers.size === 0 && clock) {
        clearInterval(clock);
        clock = undefined;
      }
    };
  }, [periodMs, offsetMs]);
}
