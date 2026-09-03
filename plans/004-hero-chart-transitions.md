# 004 — Let the hero chart travel: crossfade the tour, roll the label, fade the scrim

- **Status**: DONE
- **Commit**: 85e7692
- **Severity**: MEDIUM (HIGH visibility — largest element on the board)
- **Category**: Missed opportunities / Purpose & frequency
- **Estimated scope**: 2 files, small-medium

## Problem

The watchlist hero chart is the largest thing on the board (`flex-[1.42]`,
`src/app/page.tsx:59`) and the most frequently changing — and it is the only recurring
change with **no transition at all**:

```ts
/* src/components/bento/market-chart.tsx:131-132 — current */
inst.area.setData(data);
inst.chart.timeScale().fitContent();
```

- Every tour step (cadence set by plan 001; 5s today) the curve, the axis range, and the
  top-left label (`market-chart.tsx:142-144`, a plain text swap) all cut instantly,
  while the ten rows beneath flip through a 240ms split-flap and the header numbers roll
  through SlideValue — three treatments for the same data class, and the biggest surface
  gets none.
- The loading scrim is a bare conditional (`market-chart.tsx:145-151`): a 60%-opaque
  cover that pops on/off with no fade, firing on cache-missed tour steps and on every
  AssetCard open.

(lightweight-charts has no built-in series-morph animation; the honest, cheap move is a
container-level crossfade, not a data tween.)

## Target

**Crossfade the canvas on symbol change** — fade the chart container down and up around
the data swap, using the house curve:

```tsx
/* market-chart.tsx — target: a fade driven by symbol identity */
// containerRef wraps the chart div (the absolute inset-0 element at :139)
// On key change (new symbol|mode), before setData:
el.style.transition = "opacity 120ms var(--ease-out-strong)";
el.style.opacity = "0";
// after setData + fitContent (next frame):
requestAnimationFrame(() => { el.style.opacity = "1"; });
```

Implement it declaratively: add a `fading` state derived from `points`-key mismatch (the
component already tracks `loaded.key !== key` as `loading`, `market-chart.tsx:41-46`) —
apply `opacity-0` while `loading`, `opacity-100` otherwise, with
`transition-opacity duration-[140ms] [transition-timing-function:var(--ease-out-strong)]`
on the chart wrapper div (`:139`). Because plan 003/001 keep the outgoing series mounted
during load, the sequence reads: dip to 0 over 140ms → data swaps → rise over 140ms.
Under `prefers-reduced-motion` this is opacity-only already — compliant by construction.

**Roll the label** — replace the plain text at `market-chart.tsx:142-144` with the
existing `SlideValue`-style roll: wrap the label in the `FooterTicker`/`SlideValue`
grammar via a keyed `AnimatePresence` (import `SlideValue` is numeric-oriented; instead
reuse its exact transition values inline):

```tsx
<AnimatePresence mode="popLayout" initial={false}>
  <motion.span key={label ?? symbol} className="block"
    initial={{ opacity: 0, transform: "translateY(0.7em)" }}
    animate={{ opacity: 1, transform: "translateY(0em)", transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
    exit={{ opacity: 0, transform: "translateY(-0.7em)", transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
  >{label ?? symbol}</motion.span>
</AnimatePresence>
```

Gate with `useReducedMotion()` exactly as `src/components/footer-ticker.tsx:19,26-31`
does (fade-only branch).

**Fade the scrim**: give the Loading/empty overlays
`transition-opacity duration-[140ms]` and render them via opacity toggling rather than
mount/unmount where trivially possible; at minimum the Loading scrim (`:145-147`)
becomes always-mounted with `opacity-0 pointer-events-none` when idle.

## Repo conventions to follow

- The translateY-roll values (0.7em / 180ms in / 120ms out / `[0.23,1,0.32,1]`) are the
  established value-change grammar — exemplar `src/components/footer-ticker.tsx:22-35`.
- Charts restyle via `applyOptions` on theme flips (`market-chart.tsx:108-118`) — the
  crossfade must not touch chart creation/teardown.

## Steps

1. `market-chart.tsx`: add the `transition-opacity` classes + `loading`-driven opacity
   to the chart wrapper div at `:139`; confirm the outgoing series stays mounted during
   `loading` (it does — `:127-129` keeps it).
2. `market-chart.tsx:142-144`: replace the static label span's content with the keyed
   roll above (imports: `AnimatePresence, motion, useReducedMotion` from "motion/react").
3. `market-chart.tsx:145-151`: make the Loading scrim opacity-transitioned.
4. Feel-check inside an AssetCard popover too (`src/components/asset-card.tsx:151-153`
   renders MarketChart at h-[130px]) — same behavior, no layout shift.

## Boundaries

- Do NOT tween chart data or animate the price scale — container opacity only.
- Do NOT change tour cadence here (that's plan 001).
- Do NOT introduce new easing values — only `[0.23,1,0.32,1]` / `var(--ease-out-strong)`.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src --max-warnings 0`, `npm run build`.
- **Feel check**: watch three tour steps — the curve dips and rises (~280ms round trip)
  instead of teleporting; the symbol label rolls up like the footer; a cache-missed step
  shows the scrim fading in, not popping; DevTools Animations at 10% confirms the label
  exit starts immediately (ease-out, no lag); reduced-motion emulation: label crossfades
  without vertical travel, chart still dips/rises (opacity-only is permitted).
- **Done when**: no instant cut is visible on symbol change at 60fps recording, and all
  three surfaces (canvas, label, scrim) share the house curve.
