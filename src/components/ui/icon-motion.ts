// Shared gate for the animated icon family: the hover flourish is skipped
// for reduced-motion users and on coarse pointers (a touch tap fires
// mouseenter with no mouseleave, which used to leave looping glyphs
// running forever on phones). Static render is unaffected.
export function iconMotionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}
