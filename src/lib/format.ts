// Number formatting per DESIGN.md: Indian digit grouping for ₹, signed
// deltas with a true minus, color never the only encoding.

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2Fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const inr = (n: number) => `₹${inrFmt.format(n)}`;
export const inr2 = (n: number) => `₹${inr2Fmt.format(n)}`;

export function signedPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

export function level(n: number): string {
  return inr2Fmt.format(n).replace(/^/, "");
}

/** ₹ crore, signed, for flow numbers. */
export function crore(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}₹${inrFmt.format(Math.abs(Math.round(n)))} Cr`;
}

export const deltaClass = (n: number) => (n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-fog");

export function timeIST(ts: Date): string {
  return ts.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function dateIST(ts: Date): string {
  return ts.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}
