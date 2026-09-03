// The single source for JS-side motion values — the numeric twin of
// --ease-out-strong in globals.css. Change them together or not at all.
export const EASE = [0.23, 1, 0.32, 1] as const;

export const DUR = {
  /** value/label rolls (SlideValue, FooterTicker, chart label) */
  enter: 0.18,
  exit: 0.12,
  /** split-flap panes (FlipView) */
  flip: 0.24,
  flipOut: 0.14,
} as const;
