# 005 — One motion vocabulary: tokens, shared press feedback, one roll, staggered flaps

- **Status**: DONE
- **Commit**: 85e7692
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens / Physicality
- **Estimated scope**: ~14 files (1 new module + mechanical swaps), medium

## Problem

The house has one curve but five hand-typed copies and three dialects:

- `[0.23, 1, 0.32, 1]` re-typed at `src/components/motion/flip-view.tsx:24`,
  `src/components/motion/slide-value.tsx:23`, `src/components/footer-ticker.tsx:27,:31`
  while the token `--ease-out-strong` lives at `src/app/globals.css:71`.
- FooterTicker re-implements SlideValue's roll 20ms off (`footer-ticker.tsx:26-32`
  enter 0.2 vs `slide-value.tsx:31-37` enter 0.18; same 0.7em, same exits).
- Press feedback splits: `theme-toggle.tsx:48` and `asset-card.tsx:195` ride
  `var(--ease-out-strong)`; `tv-tile.tsx:112,140,152` and `watchlist-panel.tsx:196`
  fall to Tailwind's default `cubic-bezier(0.4,0,0.2,1)`; scale targets drift across
  0.92/0.94/0.97/0.98; and the board's PRIMARY pressables — every instrument row
  (`watchlist-panel.tsx:157-160,230`, `floor-tile.tsx:203-205`,
  `city-tile.tsx:147,184,217`, `forex-rates.tsx:87-93`, `commodities-panel.tsx:76`,
  `insight-line.tsx:15,26`) plus the pager `‹ ›` (`watchlist-panel.tsx:271-295`), the
  timeframe pills (`market-chart.tsx:155-164`), city/TV tab pills — have **no press
  feedback at all** (touch users get zero acknowledgement).
- ~18 hover rows use `transition-colors duration-150` with Tailwind's default
  ease-in-out curve (lags the cursor); 3 sites omit the duration entirely
  (`app-header.tsx:74`, `fun-corner.tsx:99,109`).
- Six FlipView consumers flip their whole row list as one slab — AUDIT §7 prescribes a
  30–80ms child stagger for group entrances.
- `LiveChip`'s dot runs `animate-pulse` (2s ease-in-out, infinite) forever
  (`src/components/live-chip.tsx:18`) — constant motion on the header, purpose already
  carried by the adjacent text label.
- `tile-in` is 340ms (over the 300ms ceiling) with two 20ms gaps in its inline delay
  ladder (`page.tsx:59-99`; 80→100→120).

## Target

**1. A motion constants module** — `src/lib/motion.ts`:

```ts
/* target — the single source for JS-side motion values */
export const EASE = [0.23, 1, 0.32, 1] as const; // = --ease-out-strong
export const DUR = { enter: 0.18, exit: 0.12, flip: 0.24, flipOut: 0.14 } as const;
```

Swap the five hand-typed arrays and the primitive durations to read from it
(FooterTicker adopts SlideValue's 0.18 enter — one roll, one timing).

**2. A pressable utility** — add to `globals.css` (near `.tile-in`):

```css
/* Press feedback — the one press grammar (AUDIT: scale 0.95–0.98, ~160ms, ease-out) */
.pressable {
  transition: transform 160ms var(--ease-out-strong);
}
.pressable:active {
  transform: scale(0.97);
  transition-duration: 80ms; /* asymmetric: the press snaps, the release breathes */
}
```

Apply `className="pressable"` to: all row triggers listed above, pager buttons,
timeframe pills, city/TV tab pills, ADD trigger. Normalize the five existing
`active:scale-*` sites to the utility (delete their inline `active:scale-[…]` +
`transition-transform` classes). Keep the Remove button at `asset-card.tsx:195` on the
utility too.

**3. Hover curve**: add to `globals.css` `@theme` (or a plain rule):

```css
--ease-hover: ease; /* AUDIT §2: hover/color change → ease */
```

Mechanical swap on the ~18 `transition-colors duration-150` sites: append
`[transition-timing-function:var(--ease-hover)]` (or `ease-[var(--ease-hover)]` if the
Tailwind version supports arbitrary ease utilities — match existing arbitrary-property
style used at `theme-toggle.tsx:48`). Add `duration-150` to the 3 sites missing it.

**4. FlipView child stagger** — in `src/components/motion/flip-view.tsx`, pass a
`stagger?: boolean` prop; when set, wrap children mapping is NOT available (children are
opaque), so implement via CSS on the incoming pane instead:

```css
/* globals.css — rows inside a flipping pane cascade in */
.flip-stagger > * {
  animation: flip-row-in 200ms var(--ease-out-strong) backwards;
}
.flip-stagger > *:nth-child(1) { animation-delay: 0ms; }
.flip-stagger > *:nth-child(2) { animation-delay: 40ms; }
/* … step 40ms through :nth-child(10) { animation-delay: 360ms } */
@keyframes flip-row-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .flip-stagger > * { animation-duration: 150ms; animation-delay: 0ms !important; transform: none; }
}
```

Apply `flip-stagger` to the row-list containers inside FlipView consumers (the `<ul>` in
`movers-panel.tsx:73`, watchlist `FlipView` list, calendar list, city table body wrapper,
fun-corner list, what-matters list). 40ms sits inside AUDIT's 30–80ms band; delays are
decorative and never block interaction (rows are clickable immediately).

**5. LiveChip**: delete `animate-pulse` from `src/components/live-chip.tsx:18` — the dot
stays, static. (AUDIT §1: constant-motion element whose meaning the text already
carries; "the strongest fix is often delete the animation".)

**6. tile-in**: `globals.css:155` 340ms → **260ms**; replace the eleven inline
`animationDelay` strings in `page.tsx` with a uniform 40ms ladder (0,40,80,…,400) in
document order — no 20ms gaps.

## Repo conventions to follow

- Arbitrary-property Tailwind for timing functions — exemplar `theme-toggle.tsx:48`.
- Keyframes + reduced-motion overrides co-located in `globals.css` (see
  `.tile-in` at `:144-156` and its reduced block at `:184-195`).
- JS motion imports come from `"motion/react"`.

## Steps

1. Create `src/lib/motion.ts`; swap EASE/DUR into `flip-view.tsx`, `slide-value.tsx`,
   `footer-ticker.tsx` (footer enter becomes 0.18).
2. Add `.pressable` + `--ease-hover` + `.flip-stagger` CSS to `globals.css`.
3. Mechanical class application per the lists above (rows, pills, pagers, existing
   active-scale sites).
4. `live-chip.tsx`: remove `animate-pulse`.
5. `globals.css` tile-in 260ms; `page.tsx` delay ladder 0–400ms by 40s.
6. Update the reduced-motion `.tile-in` block only if its duration reference (200ms)
   now exceeds the base (it won't at 260ms — leave it).

## Boundaries

- Do NOT alter FlipView's flap transform values or AnimatePresence mode (006/001 own
  behavior changes).
- Do NOT restyle hover colors — timing function only.
- Do NOT touch the lucide-animated icon files (plan 006).
- If a listed class string doesn't match at the cited line, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src --max-warnings 0`, `npm run build`;
  `grep -rn "0.23, 1, 0.32" src` returns only `src/lib/motion.ts` and `globals.css`.
- **Feel check**: press-and-hold any watchlist row on a touch device/emulation — it
  dips to 0.97 fast and releases slower; a panel flip cascades its rows top-to-bottom
  (~40ms steps) while remaining clickable mid-cascade; the footer and header rolls are
  indistinguishable in timing; the LIVE dot no longer throbs; page load reads as one
  even 0→400ms sweep.
- **Done when**: the greps pass, all six FlipView surfaces cascade, and every pressable
  on the board responds to :active.
