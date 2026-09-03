# 006 — Discipline the animated icon family: house timing, no infinite loops, gated triggers

- **Status**: TODO
- **Commit**: 85e7692
- **Severity**: MEDIUM
- **Category**: Easing & duration / Accessibility / Cohesion
- **Estimated scope**: 9 files in src/components/ui/, mechanical

## Problem

The vendored lucide-animated glyphs run a slow, bouncy, ungated dialect inside a crisp
140–240ms board:

| file:line | current | violations |
|---|---|---|
| `src/components/ui/moon.tsx:28-31` | `duration: 1.2, ease: "easeInOut"` | 4× the 300ms ceiling; easeInOut front half is ease-in |
| `src/components/ui/cloud-rain.tsx:32-37` | `duration: 1, repeat: Number.POSITIVE_INFINITY` | infinite loop |
| `src/components/ui/cloud-lightning.tsx:81-86` | `duration: 1, repeat: Number.POSITIVE_INFINITY` | infinite loop |
| `src/components/ui/cloud-sun.tsx:25-30` | `duration: 1, ease: "easeInOut"` | over budget |
| `src/components/ui/play.tsx:25-31` / `pause.tsx:25-31` | `duration: 0.5` | 3× the 100–160ms press band |
| `src/components/ui/snowflake.tsx:15-19` | `duration: 0.4` | over budget |
| `src/components/ui/sun.tsx:21-24`, `cloud-sun.tsx:37-39` | `delay: i * 0.1, duration: 0.3` (8 rays) | ~800ms tail |
| `src/components/ui/plus.tsx:69` | `{ type: "spring", stiffness: 100, damping: 15 }` | the app's only spring, visibly bouncy |
| `src/components/ui/cloud-rain.tsx:22` | `staggerChildren: 0.2` | 2.5–6.7× the 30–80ms stagger band |

Triggering and a11y: all nine play on JS `onMouseEnter`/`onMouseLeave` (e.g.
`moon.tsx:71-72`, `cloud-rain.tsx:79-80`) — a touch tap fires `mouseenter` with no
`mouseleave`, so the two infinite loops run forever on phones; none of the nine imports
`useReducedMotion` (only `footer-ticker.tsx:19`, `slide-value.tsx:12`, `flip-view.tsx:23`
do). Live surfaces: 7 weather rows on the city tile (`city-tile.tsx:27-34` — hovering a
row to click its popover fires a 1s loop as noise), TV transport (`tv-tile.tsx:143`),
watchlist ADD (`watchlist-panel.tsx:179`), theme toggle.

## Target

One retiming pass over all nine files, three rules:

1. **Timing**: every `duration:` ≤ `0.3`; every string ease `"easeInOut"`/`"easeOut"`
   becomes the house array `[0.23, 1, 0.32, 1]` (import `EASE` from `src/lib/motion.ts`
   once plan 005 lands; else inline the array). Specifics:
   - moon 1.2 → 0.3; cloud-sun 1 → 0.3; snowflake 0.4 → 0.25; play/pause 0.5 → **0.15**
     (transport = press feedback band); sun/cloud-sun rays `delay: i * 0.1` →
     `i * 0.04` (8 rays ≈ 280ms tail), ray duration 0.3 → 0.2.
   - `cloud-rain.tsx:22` `staggerChildren: 0.2` → `0.05`.
2. **No infinite repeats**: `cloud-rain.tsx:35` and `cloud-lightning.tsx:84`
   `repeat: Number.POSITIVE_INFINITY` → `repeat: 1` (two cycles total, then rest).
3. **Gate the trigger** in each component's `handleMouseEnter` (the files share the
   controlled/uncontrolled pattern with `isControlledRef`):

```ts
/* target — top of each handleMouseEnter, before starting animation */
if (
  typeof window !== "undefined" &&
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches)
) return;
```

   (Static render is unaffected — the glyphs draw fine unanimated; this only suppresses
   the hover flourish for touch + reduced-motion users, matching the CSS-side
   `[@media(hover:hover)]` convention used in 18 files.)
4. **The plus spring** (`plus.tsx:69`): replace
   `{ type: "spring", stiffness: 100, damping: 15 }` with
   `{ type: "spring", duration: 0.35, bounce: 0.15 }` — AUDIT's Apple-style config,
   bounce inside the subtle 0.1–0.3 band, scaled to icon size.

## Repo conventions to follow

- These are vendored registry components (AGENTS.md notes the icon set is
  hover-triggered lucide-animated); keep their external API (`ref` handle with
  `startAnimation`/`stopAnimation`) untouched — `theme-toggle.tsx:41-42` drives it.
- House curve as JS array — exemplar `src/components/motion/flip-view.tsx:24`.

## Steps

1. Apply rule 1's retiming table file by file (9 files).
2. Apply rule 2 to the two infinite loops.
3. Insert the gate at the top of `handleMouseEnter` in all nine (skip components whose
   only trigger is the imperative ref — the gate still belongs in `startAnimation` so
   the theme toggle respects reduced motion too; put it in the shared start path).
4. `plus.tsx:69`: swap the spring config.

## Boundaries

- Do NOT change SVG paths, sizes, or exported types.
- Do NOT delete the animations — retime and gate only.
- Do NOT add `useReducedMotion` React imports — the matchMedia gate keeps these files
  dependency-light and works for imperative starts.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx eslint src --max-warnings 0`;
  `grep -rn "POSITIVE_INFINITY" src/components/ui` returns nothing;
  `grep -rn "easeInOut" src/components/ui` returns nothing.
- **Feel check**: hover a city weather row — the glyph plays one crisp ≤300ms gesture
  and stops; on touch emulation, tapping a row opens the popover with NO icon loop;
  reduced-motion emulation: icons stay static on hover; the TV play/pause responds in
  ~150ms; the ADD plus rotates with a barely-there settle, no wobble.
- **Done when**: both greps are clean and the city-tile hover reads as punctuation, not
  weather-channel B-roll.
