// The NSE session clock — pure and universal (client bundles import it
// for polling cadence; live routes pass the holiday flag they fetch
// server-side). All boundaries in IST.

export type MarketPhase = "preopen" | "open" | "closing" | "closed";

const IST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function phaseAt(now: Date, isHoliday = false): MarketPhase {
  if (isHoliday) return "closed";
  const parts = Object.fromEntries(IST.formatToParts(now).map((p) => [p.type, p.value]));
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return "closed";
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (minutes >= 540 && minutes < 555) return "preopen"; // 09:00–09:15
  if (minutes >= 555 && minutes < 930) return "open"; // 09:15–15:30
  if (minutes >= 930 && minutes < 960) return "closing"; // prints settle to 16:00
  return "closed";
}

export const isLive = (phase: MarketPhase) => phase !== "closed";
