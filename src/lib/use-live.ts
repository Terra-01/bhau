"use client";

import { useEffect, useState } from "react";
import { isLive, phaseAt } from "./market-clock";

/**
 * Polls a live endpoint on a phase-aware cadence: fast while the NSE
 * session runs (per the local IST clock), slow otherwise. Hidden tabs
 * skip fetches entirely and refresh the moment they return. Errors keep
 * the last payload — the caller's EOD render is always the floor.
 */
export function useLive<T>(url: string, { openMs = 30_000, closedMs = 300_000 } = {}) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      if (!document.hidden) {
        try {
          const res = await fetch(url);
          if (res.ok && alive) setData((await res.json()) as T);
        } catch {
          /* keep last payload */
        }
      }
      if (!alive) return;
      timer = window.setTimeout(tick, isLive(phaseAt(new Date())) ? openMs : closedMs);
    };
    tick();
    const onVisible = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, openMs, closedMs]);

  return data;
}
