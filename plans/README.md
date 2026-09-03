# Motion plans — Bhau board choreography

Written by the `improve-animations` audit at commit `85e7692` (2026-09-03). Each plan is
self-contained: an executor needs no other context. Source audit: four category passes
(purpose/easing, physicality/interruptibility, performance/accessibility,
cohesion/missed-opportunities) over the full `src/` motion surface.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Conduct the idle loop](001-conduct-the-idle-loop.md) — one clock, deliberate beats, no collisions | HIGH | TODO |
| 002 | [Detail-layer motion](002-detail-layer-motion.md) — origin-true, interruptible, reduced-motion popovers | HIGH | TODO |
| 003 | [Calm the tick](003-calm-the-tick.md) — batched flashes, 280ms, reduced-motion keeps color | HIGH | TODO |
| 004 | [Hero chart transitions](004-hero-chart-transitions.md) — tour crossfade, label roll, scrim fade | MEDIUM | TODO |
| 005 | [One motion vocabulary](005-one-motion-vocabulary.md) — tokens, press feedback, row stagger, tile-in retime | MEDIUM | TODO |
| 006 | [Icon family discipline](006-icon-family-discipline.md) — house timing, no loops, gated triggers | MEDIUM | TODO |

## Recommended order & dependencies

1. **005 first** — it creates `src/lib/motion.ts` (EASE/DUR) that 004 and 006 import,
   and the `.pressable`/stagger utilities that make everything after it feel coherent.
2. **003** (independent, small) and **006** (imports EASE from 005) next.
3. **002** — the detail layer; independent of the others but feel-check it after 005 so
   press feedback + popover motion are judged together.
4. **001** — the cadence conductor; land last so the retimed loop is judged with the
   final per-element motion in place.
5. **004** — after 001, since the tour cadence (9s) it choreographs against comes from 001.

## Not planned (audit findings deliberately left)

- `transition-all` in `ui/button.tsx:7` / `ui/tabs.tsx:61` — shadcn scaffold with zero
  importers; fix on first real use.
- `aria-live` on rotating panels — real screen-reader gap, out of the motion rubric;
  belongs in an a11y pass.
- Marquee reduced-motion fallback: scrollable strip lacks `tabindex` and shows doubled
  headlines (`app-header.tsx:40`) — same a11y pass.
- Theme-flip crossfade + standings-reorder FLIP animation + mood/range marker travel —
  good missed-opportunity candidates once 001–006 settle the base layer; ask for plans
  007–009 if wanted.
