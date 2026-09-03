# 003 — Calm the tick: batch the flash restarts, shorten the wash, keep it under reduced motion

- **Status**: TODO
- **Commit**: 85e7692
- **Severity**: HIGH
- **Category**: Performance / Easing & duration / Accessibility
- **Estimated scope**: 2 files, small

## Problem

```tsx
/* src/components/motion/tick-flash.tsx:22-30 — current */
node.classList.remove("tick-up", "tick-down");
void node.offsetWidth; // restart the animation
node.classList.add(value > prev.current ? "tick-up" : "tick-down");
```

```css
/* src/app/globals.css:176,179 — current */
.tick-up   { animation: tick-up-kf 700ms var(--ease-out-strong); }
.tick-down { animation: tick-down-kf 700ms var(--ease-out-strong); }
```

```css
/* src/app/globals.css:196-199 — current (inside @media (prefers-reduced-motion: reduce)) */
.tick-up,
.tick-down {
  animation: none;
}
```

1. **A reflow storm every poll.** Each cell's `useEffect` does write → `offsetWidth`
   read → write. A 30s quote poll moves ~25 cells (watchlist 10 @30s, forex + commodities
   @60s) whose effects flush sequentially in one commit → ~25 forced synchronous layouts
   of the full board per burst, inside a CSS-`zoom` container where each reflow is
   full-subtree.
2. **700ms is 2.3× the UI budget** (AUDIT §2: UI stays under 300ms) on the most frequent
   event on the board, at loud opacities (26%/24% washes, `globals.css:161-174`).
3. **Reduced motion deletes it entirely** — but the wash is *pure color*, exactly what
   AUDIT §6 says to KEEP ("keep opacity/color, drop movement"; "reduced-motion
   implementations that nuke all feedback"). A reduced-motion reader gets no price-change
   signal at all.

## Target

```tsx
/* src/components/motion/tick-flash.tsx — target restart (batched, no per-cell reflow) */
node.classList.remove("tick-up", "tick-down");
const cls = value > prev.current ? "tick-up" : "tick-down";
requestAnimationFrame(() => {
  requestAnimationFrame(() => node.classList.add(cls));
});
```

The double-rAF replaces the synchronous `void offsetWidth` restart: frame N removes the
class (styles flush once for ALL cells together), frame N+1 re-adds it — zero forced
layouts, and simultaneous cells restart in the same frame, which also makes the burst
read as one coordinated pulse instead of a ragged flush.

```css
/* globals.css — target durations */
.tick-up   { animation: tick-up-kf 280ms var(--ease-out-strong); }
.tick-down { animation: tick-down-kf 280ms var(--ease-out-strong); }
```

280ms sits inside the sub-300ms budget; keep the existing keyframes and wash colors
(intensity is acceptable once the duration drops).

```css
/* globals.css — target reduced-motion block: REPLACE the animation:none rule */
@media (prefers-reduced-motion: reduce) {
  .tick-up,
  .tick-down {
    animation-duration: 200ms; /* pure-color feedback stays; nothing moves anyway */
  }
}
```

## Repo conventions to follow

- Reduced-motion philosophy is already stated at `globals.css:183`: "fade stays for
  comprehension; movement and choreography go" — this plan makes the tick obey it.
- The imperative-classList design of TickFlash (zero re-renders) is deliberate
  (`tick-flash.tsx:1-13` header) — keep it; only the restart mechanism changes.

## Steps

1. `src/components/motion/tick-flash.tsx`: replace the `void offsetWidth` restart with
   the double-rAF pattern above; cancel the pending rAF in the effect cleanup
   (`const id = requestAnimationFrame(…); return () => cancelAnimationFrame(id)` for the
   outer handle, and track the inner one likewise).
2. `src/app/globals.css:176,179`: `700ms` → `280ms` (both rules).
3. `src/app/globals.css:196-199`: replace `animation: none;` with
   `animation-duration: 200ms;`.

## Boundaries

- Do NOT change the keyframes' colors or the oklab color-mix values.
- Do NOT convert TickFlash to React state — it must stay render-free.
- Do NOT touch the polling cadences.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src --max-warnings 0`.
- **Feel check**: with the dev server open during a poll (or force one by toggling a
  quote in devtools), all changed cells flash as ONE simultaneous 280ms pulse; DevTools
  Performance panel over a poll burst shows no purple "Layout" blocks attributed to
  tick-flash effects; emulate `prefers-reduced-motion` and confirm the flash still
  appears, shorter.
- **Done when**: no `offsetWidth` read remains in tick-flash.tsx, durations read 280ms,
  and the reduced-motion block shortens rather than removes the flash.
