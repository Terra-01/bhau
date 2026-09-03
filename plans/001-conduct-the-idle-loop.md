# 001 — Conduct the idle loop: one clock, deliberate beats, no collisions

- **Status**: TODO
- **Commit**: 85e7692
- **Severity**: HIGH
- **Category**: Purpose & frequency / Cohesion
- **Estimated scope**: 9 files (~1 new module + 8 consumers), medium

## Problem

The board's idle motion is seven independent `setInterval`s with hardcoded periods,
each phase-anchored to its own mount time — noise, not a loop:

| Surface | file:line | period |
|---|---|---|
| Watchlist chart tour | `src/components/bento/watchlist-panel.tsx:31` `ROTATE_MS = 5_000` | 5s |
| FooterTicker | `src/components/footer-ticker.tsx:18` `useCarousel(MESSAGES.length, 7_000)` | 7s |
| MoversPanel | `src/components/bento/movers-panel.tsx:40` | 14s |
| WhatMattersPanel | `src/components/bento/what-matters-panel.tsx:39` | 15s |
| CalendarPanel | `src/components/bento/calendar-panel.tsx:40` | 17s |
| CityTile | `src/components/tiles/city-tile.tsx:62` | 19s |
| FunCorner | `src/components/bento/fun-corner.tsx:36` | 23s |

Three concrete defects:

1. **Phase-locked harmonics.** 7s footer vs 14s movers: every second footer line lands
   with a movers flip, for the whole session. 5s tour vs 15s intelligence: every third
   chart swap coincides with a panel flip.
2. **Random collision phase.** Each interval starts at its component's mount, so nothing
   prevents three split-flaps firing inside the same 240ms — and on some loads they do,
   all session.
3. **No composition.** ~38 unrequested motion events/min (something moves every ~1.6s),
   while three tiles (RatesPanel, EtfPanel, FloorTile) have zero idle motion after
   `tile-in` — a wall of churn next to dead zones. The owner's brief is "different
   pacing… a harmonious loop"; today it is neither harmonious nor a loop.

## Target

One conductor, explicit beats, guaranteed spacing. The board breathes on a **72-second
bar**; each rotating surface owns a fixed slot offset inside it, so flips arrive as a
deliberate round-robin sweep and two flips are never closer than **4 seconds**:

| Surface | new period | slot offset within the bar |
|---|---|---|
| Watchlist chart tour | **9s** (8 steps/bar) | 0s |
| FooterTicker | **12s** (6 steps/bar) | 2s |
| MoversPanel | 18s (4 steps/bar) | 4s |
| WhatMattersPanel | 24s (3 steps/bar) | 8s |
| CalendarPanel | 24s (3 steps/bar) | 16s |
| CityTile | 36s (2 steps/bar) | 12s |
| FunCorner | 36s (2 steps/bar) | 30s |

All periods divide 72, so the pattern repeats exactly once per bar (a true loop), and the
offsets are chosen so no two events share a second (verify: watchlist fires at 0,9,18…;
footer at 2,14,26…; movers at 4,22,40,58; whatmatters at 8,32,56; calendar at 16,40 —
**collision at 40s with movers → shift calendar offset to 17s** (17,41,65); city at
12,48; fun at 30,66. Recheck the full 72 grid after implementing; adjust any colliding
offset by +1s until the min-gap ≥ 4s holds).

Mechanism: a new `src/lib/cadence.ts` with a single shared clock:

```ts
// src/lib/cadence.ts — the board's metronome. One 250ms clock; subscribers
// declare { periodMs, offsetMs } and fire when (now - epoch) crosses their
// beat. The epoch is module-load time, shared by every subscriber, so the
// choreography is identical on every visit and phase can never drift.
export function useCadence(periodMs: number, offsetMs: number, onBeat: () => void, paused: () => boolean): void
```

`useCarousel` keeps its API (`index, select, pauseProps, hold`) but takes
`(count, periodMs, offsetMs)` and drives `setIndex` from `useCadence` instead of its own
`setInterval`. The existing pause semantics are unchanged and per-surface: on a beat,
`if (document.hidden || hovering.current || Date.now() < holdUntil.current) return;` —
a skipped beat skips, it does not reschedule (the bar structure survives holds).

The watchlist tour keeps its own effect (it advances a selection, not a tab) but
subscribes via `useCadence(9_000, 0, …)` with its current guard body from
`src/components/bento/watchlist-panel.tsx:127-136` unchanged.

Dead-zone note (explicitly OUT of scope for this plan): Rates/ETF/Floor stillness is
acceptable as the bass line once the churn drops — do not add decoration to them here.

## Repo conventions to follow

- Hooks live in `src/lib/` (`use-carousel.ts`, `use-live.ts`) — put `cadence.ts` there.
- Comment style: short "why" headers (see `src/lib/use-carousel.ts:5-9`).
- All timer consumers already guard `document.hidden`; keep that inside the beat guard,
  not the clock.

## Steps

1. Create `src/lib/cadence.ts`: module-level `const EPOCH = Date.now()`, one shared
   250ms `setInterval` started lazily on first subscriber, unsubscribed on last; each
   subscriber stores `lastBeat` and fires when
   `Math.floor((now - EPOCH - offsetMs) / periodMs)` increments (skip negative).
2. Rewrite `src/lib/use-carousel.ts` to accept `(count, periodMs, offsetMs = 0)` and
   replace its `setInterval` (`use-carousel.ts:15-22`) with `useCadence(periodMs,
   offsetMs, beat, …)` where `beat` runs the existing guard + `setIndex`.
3. Update the seven call sites to the table above:
   `movers-panel.tsx:40` → `useCarousel(TABS.length, 18_000, 4_000)`;
   `what-matters-panel.tsx:39` → `(…, 24_000, 8_000)`; `calendar-panel.tsx:40` →
   `(…, 24_000, 17_000)`; `city-tile.tsx:62` → `(…, 36_000, 12_000)`;
   `fun-corner.tsx:36` → `(…, 36_000, 30_000)`; `footer-ticker.tsx:18` →
   `(MESSAGES.length, 12_000, 2_000)`.
4. Watchlist: change `ROTATE_MS = 5_000` (`watchlist-panel.tsx:31`) to `9_000` and move
   the rotation effect body (`:127-136`) into a `useCadence(9_000, 0, …)` subscription;
   delete the local `setInterval`.
5. Grep for any doc/comment stating the old intervals (`AGENTS.md`, panel headers) and
   update the numbers.

## Boundaries

- Do NOT change FlipView/SlideValue/TickFlash internals, easings, or durations.
- Do NOT add motion to RatesPanel/EtfPanel/FloorTile.
- Do NOT alter hold/hover/hidden semantics — a paused surface skips beats.
- If the rotation-effect code at the cited lines has drifted, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` and `npx eslint src --max-warnings 0` pass;
  `npm run build` succeeds.
- **Feel check**: load the board and watch two full bars (144s): flips arrive as a
  calm clockwise-ish sweep, never two at once; the footer line never lands on a movers
  flip; with the cursor parked on one tile, that tile stays put while the sweep
  continues elsewhere; reload — the choreography is identical (shared epoch).
- **Console probe**: temporarily
  `console.log(Date.now() % 72000, name)` in the beat callback and confirm min gap
  between any two fires ≥ 4000ms over a bar; remove the probe.
- **Done when**: no `setInterval` remains in `use-carousel.ts`/`watchlist-panel.tsx`
  rotation paths, all seven surfaces subscribe with the table's period+offset, and the
  two-bar observation shows zero simultaneous flips.
