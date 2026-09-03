# 002 — Give the detail layer the house motion: origin-true, interruptible, reduced-motion-aware

- **Status**: TODO
- **Commit**: 85e7692
- **Severity**: HIGH
- **Category**: Easing & duration / Physicality & origin / Accessibility
- **Estimated scope**: 3 files (popover.tsx, row-popover.tsx + its 3 consumers touched lightly), small-medium

## Problem

Every detail card on the board (AssetPopover, InfoPopover, RowPopover, the ADD form, the
agent record cards) routes through one popup whose motion is a foreign dialect:

```tsx
/* src/components/ui/popover.tsx:46 — current (abridged to the motion classes) */
"… origin-(--transform-origin) … duration-100 data-[side=bottom]:slide-in-from-top-2 …
 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
```

1. **Wrong curve, wrong duration.** tw-animate resolves with no `ease-*` utility to bare
   CSS `ease` (`cubic-bezier(0.25,0.1,0.25,1)`) — an entrance should be a strong
   ease-out — and `duration-100` is below the 125–200ms small-popover band, so
   `zoom-in-95` reads as a flicker. The repo's own curve
   `--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1)` (`src/app/globals.css:71`) is
   used by every hand-written motion *except* this, the most-triggered one.
2. **No reduced-motion handling at all.** `tw-animate-css@1.4.0` contains zero
   `prefers-reduced-motion` rules (verified), and the app's reduced-motion blocks
   (`globals.css:182-200`) cover only `.tile-in`/`.tick-*`/`.marquee-*`.
3. **Keyframes restart from zero.** Dismiss and immediately open another row: the 100ms
   exit doesn't hand off; the popup snaps to `scale(.95)/opacity:0` and replays.
4. **RowPopover closes as an empty shell.** `src/components/row-popover.tsx:23-28`
   derives `open={anchor !== null}` and every consumer nulls content and anchor together
   (`src/components/exchange/forex-rates.tsx:113-115`,
   `src/components/bento/commodities-panel.tsx:96-98`,
   `src/components/tiles/city-tile.tsx:161-169` — all
   `onClose={() => setDetail(null)}` with `{detail && <AssetCard …/>}`), so the exit
   animates a contentless `w-72` box with no anchor to shrink toward.
5. **Row-to-row teleport.** Clicking row B while row A's card is open only swaps the
   anchor; `data-open` never cycles, so the open animation never replays and the card
   jumps across the table.
6. **Origin drifts under zoom.** `popover.tsx:44-46` puts
   `style={{ zoom: "var(--board-zoom, 1)" }}` and `origin-(--transform-origin)` on the
   same element; Base UI writes the origin in unzoomed px on the Positioner, so inside
   the zoomed popup the origin point lands off the trigger on every sub-1280×860
   viewport.

## Target

```tsx
/* src/components/ui/popover.tsx — target Popup className (motion part) */
"… origin-(--transform-origin) transition-[transform,opacity]
 duration-[170ms] [transition-timing-function:var(--ease-out-strong)]
 data-[starting-style]:scale-95 data-[starting-style]:opacity-0
 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0
 motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100"
```

- Base UI popups support `data-starting-style` / `data-ending-style` with CSS
  **transitions** (retargetable — fixes 3) in place of tw-animate keyframes. Remove
  `animate-in/animate-out/fade-*/zoom-*/slide-in-from-*` and `duration-100` entirely.
- **170ms** enter and exit, `var(--ease-out-strong)` both ways (exit still ease-out —
  it starts fast, which is what a dismissal wants).
- Reduced motion: `motion-reduce:` variants pin scale to 100 so only opacity animates
  (AUDIT §6: keep opacity, drop movement). No JS needed.
- Drop the `slide-in-from-*-2` translations — scale-from-origin already encodes the
  spatial cue; the 8px slide is the flicker's other half.
- **Fix the zoom/origin conflict** by moving the zoom to the Positioner (which owns
  positioning but not the scale animation): `className="isolate z-50"` gains
  `style={{ zoom: "var(--board-zoom, 1)" }}` on the **Positioner**, and the Popup loses
  it. Base UI computes position from measured rects after zoom applies to layout, and
  `--transform-origin` px then live in the same (zoomed) coordinate space as the popup.
  Feel-check this on a 1024px window (see Verification) — if Base UI's collision math
  fights the zoomed positioner, fall back to: keep zoom on the Popup and add
  `transform-origin` override `[transform-origin:calc(var(--transform-origin-x,50%))]`
  is NOT available — instead divide via a wrapper: zoom on an inner content wrapper div
  inside the Popup, origin classes stay on the Popup (unzoomed). The inner-wrapper
  fallback is the safe one; prefer it if the first approach misbehaves at all.
- **RowPopover shell fix** in `src/components/row-popover.tsx`: hold the last
  non-null children through the exit —

```tsx
/* target: inside RowPopover */
const lastChildren = useRef<ReactNode>(null);
if (children) lastChildren.current = children;
// render {children ?? lastChildren.current} inside PopoverContent
```

  and keep the last anchor for the exit by not clearing the position reference until
  fully closed: derive `open` from a state pair `{anchor, closing}` — on `onOpenChange(false)`
  call `onClose()` but retain the previous `anchor` element in a ref passed to
  `PopoverContent anchor={anchorRef.current}` while Base UI runs `data-ending-style`.
- **Row-to-row re-origin**: in the three RowPopover consumers, when a click lands while
  `detail` is non-null and targets a different row, set `detail` to null and re-set it
  on the next frame (`requestAnimationFrame`) so `data-starting-style` replays from the
  new trigger:

```tsx
/* target pattern, e.g. forex-rates.tsx onClick */
const openDetail = (next: Detail) => {
  if (detail && detail.el !== next.el) {
    setDetail(null);
    requestAnimationFrame(() => setDetail(next));
  } else setDetail(next);
};
```

## Repo conventions to follow

- The house curve is consumed as
  `[transition-timing-function:var(--ease-out-strong)]` — exemplar:
  `src/components/theme-toggle.tsx:48`.
- Popover structure (Portal → Positioner → Popup) must not change;
  `collisionPadding={8}` stays (`popover.tsx:41`).
- `city-tile.tsx` already clears `detail` on tab flips via a guarded render-phase reset
  (`city-tile.tsx:66-77`) — don't disturb it.

## Steps

1. `src/components/ui/popover.tsx`: replace the tw-animate motion classes on the Popup
   with the target transition classes; move `zoom` to the Positioner (or the
   inner-wrapper fallback); leave all non-motion classes untouched.
2. `src/components/row-popover.tsx`: implement last-children + retained-anchor exit.
3. Add the `openDetail` next-frame re-origin pattern to `forex-rates.tsx`,
   `commodities-panel.tsx`, `city-tile.tsx` row `onClick`/`onKeyDown` handlers.
4. Check `src/components/ui/tooltip.tsx:53` (same dialect, currently unimported): apply
   the same class change so the seed isn't copied later.

## Boundaries

- Do NOT touch AssetCard/InfoCard content markup.
- Do NOT change trigger semantics (`nativeButton={false}` render-prop pattern).
- Do NOT add framer-motion to the popover layer — CSS transitions only.
- If Base UI's `data-starting-style`/`data-ending-style` attributes don't appear in the
  rendered DOM (version drift), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src --max-warnings 0`, `npm run build`.
- **Feel check** (dev server):
  - Click a watchlist row: the card grows from the row, 170ms, no flicker; DevTools
    Animations panel at 10% shows scale 0.95→1 easing out from the trigger side.
  - Escape then immediately click another row: the exit retargets — no snap-to-zero
    replay; the new card originates from the NEW row (next-frame re-origin).
  - Close a forex card and watch the exit: content stays visible while it shrinks
    toward its row (no empty shell, no top-left jump).
  - Resize to 1024×700: open cards still scale from their trigger (origin correct under
    `--board-zoom`).
  - Rendering panel → emulate `prefers-reduced-motion`: cards fade only (no scale/slide),
    still 170ms.
- **Done when**: no `animate-in`/`tw-animate` classes remain in popover.tsx/tooltip.tsx,
  and all five feel checks pass.
