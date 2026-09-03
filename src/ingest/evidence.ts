import { SECTOR_OF } from "@/agents/universe";
import { sectorHeat, type SectorHeat } from "@/lib/sectors";
import { fetchWeather } from "@/lib/weather";
import { mmiZone } from "./sources/mmi";
import type { IngestBar } from "./types";

// The rest of the war room, serialized for the agents (Floor v2): every
// section here mirrors a tile on the board, so the agents deliberate on
// exactly the evidence a reader sees. Each section assembles under its own
// try/catch — a broken upstream degrades one section, never the pack.
// Aggregates only, never raw dumps; the whole envelope stays a few KB.

export interface Evidence {
  /** FII + DII, last 5 sessions (₹ Cr net) + the running FII streak. */
  flows?: {
    sessions: Array<{ date: string; fiiNet?: number; diiNet?: number }>;
    fiiStreak?: { direction: "buying" | "selling"; days: number };
  };
  /** G-sec curve + policy anchors — the price of money. */
  rates?: {
    curve: Array<{ label: string; yieldPct: number; chg1dBp?: number }>;
    spreadsBp: { tenMinusRepo?: number; tenMinusOneY?: number; vsUs10y?: number };
    repo?: number;
    crr?: number;
    slr?: number;
  };
  /** Tickertape MMI — the crowd's temperature. */
  mood?: { value: number; zone: string; d1?: number };
  commodities?: Array<{ symbol: string; name: string; close: number; r1?: number; r5?: number }>;
  forex?: { usdinr?: { close: number; r1?: number; r5?: number } };
  breadth?: { pctAdvancers: number; avg5?: number };
  sectors?: { leaders: SectorHeat[]; laggards: SectorHeat[] };
  /** The street: slow, real-economy reads — context, not triggers. */
  street?: {
    fuel?: { petrolMetroAvg: number; dieselMetroAvg: number; petrolWowPct?: number };
    bullion?: Array<{ name: string; fix: number; d1Pct?: number }>;
    monsoon?: { rainLikely: number; of: number; hottest?: { city: string; tmax: number } };
  };
  /** Next sessions' earnings/IPO/data events — what's scheduled to move prices. */
  calendar?: Array<{ date: string; title: string; type?: string }>;
}

const COMMODITY_NAMES: Record<string, string> = {
  "GC=F": "Gold",
  "SI=F": "Silver",
  "HG=F": "Copper",
  "CL=F": "WTI crude",
  "BZ=F": "Brent crude",
  "NG=F": "Natural gas",
};

const CURVE_LABELS: Array<{ symbol: string; label: string }> = [
  { symbol: "TBILL91D", label: "3M" },
  { symbol: "TBILL364D", label: "1Y" },
  { symbol: "GSEC2Y", label: "2Y" },
  { symbol: "GSEC5Y", label: "5Y" },
  { symbol: "GSEC10Y", label: "10Y" },
  { symbol: "GSEC30Y", label: "30Y" },
];

const round2 = (n: number) => Number(n.toFixed(2));
const pctOver = (closes: number[], back: number): number | undefined => {
  if (closes.length <= back) return undefined;
  const then = closes[closes.length - 1 - back];
  return then > 0 ? round2(((closes[closes.length - 1] - then) / then) * 100) : undefined;
};

/** Pure: FII streak from nets ordered oldest→newest. */
export function fiiStreakOf(nets: number[]): { direction: "buying" | "selling"; days: number } | undefined {
  const last = nets[nets.length - 1];
  if (last === undefined || last === 0) return undefined;
  const direction = last > 0 ? "buying" : "selling";
  let days = 0;
  for (let i = nets.length - 1; i >= 0; i -= 1) {
    if ((nets[i] > 0) !== (last > 0) || nets[i] === 0) break;
    days += 1;
  }
  return { direction, days };
}

type Db = (typeof import("@/lib/db"))["prisma"];

/** Closes per symbol (asc), archive merged with this run's bars for runDate. */
async function closesFor(prisma: Db, symbols: string[], todayBars: Record<string, IngestBar[]>, runDate: string, days = 20) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.dailyBar.findMany({
    where: { symbol: { in: symbols }, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { symbol: true, date: true, close: true },
  });
  const map = new Map<string, { dates: string[]; closes: number[] }>();
  for (const r of rows) {
    const s = map.get(r.symbol) ?? { dates: [], closes: [] };
    const d = r.date.toISOString().slice(0, 10);
    if (s.dates[s.dates.length - 1] !== d) {
      s.dates.push(d);
      s.closes.push(r.close);
    }
    map.set(r.symbol, s);
  }
  for (const symbol of symbols) {
    const today = todayBars[symbol]?.find((b) => b.date === runDate);
    if (!today) continue;
    const s = map.get(symbol) ?? { dates: [], closes: [] };
    if (s.dates[s.dates.length - 1] !== runDate) {
      s.dates.push(runDate);
      s.closes.push(today.close);
    }
    map.set(symbol, s);
  }
  return map;
}

export async function assembleEvidence(
  todayBars: Record<string, IngestBar[]>,
  runDate: string,
): Promise<Evidence> {
  const { prisma } = await import("@/lib/db");
  const evidence: Evidence = {};
  const section = async (name: string, build: () => Promise<void>) => {
    try {
      await build();
    } catch (err) {
      console.warn(`[evidence:${name}] omitted — ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  await section("flows", async () => {
    const rows = await prisma.flowDaily.findMany({ orderBy: { date: "desc" }, take: 24 });
    const byDate = new Map<string, { fiiNet?: number; diiNet?: number }>();
    for (const r of rows) {
      const d = r.date.toISOString().slice(0, 10);
      const entry = byDate.get(d) ?? {};
      if (r.category.startsWith("FII")) entry.fiiNet = round2(r.net);
      else entry.diiNet = round2(r.net);
      byDate.set(d, entry);
    }
    const sessions = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-5)
      .map(([date, v]) => ({ date, ...v }));
    if (sessions.length === 0) return;
    const fiiNets = sessions.flatMap((s) => (s.fiiNet !== undefined ? [s.fiiNet] : []));
    evidence.flows = { sessions, fiiStreak: fiiStreakOf(fiiNets) };
  });

  await section("rates", async () => {
    const symbols = [...CURVE_LABELS.map((c) => c.symbol), "RBIREPO", "RBICRR", "RBISLR", "US10Y"];
    const map = await closesFor(prisma, symbols, todayBars, runDate, 14);
    const last = (s: string) => map.get(s)?.closes.at(-1);
    const curve = CURVE_LABELS.flatMap(({ symbol, label }) => {
      const closes = map.get(symbol)?.closes ?? [];
      const y = closes.at(-1);
      if (y === undefined) return [];
      const prev = closes.at(-2);
      return [{ label, yieldPct: y, chg1dBp: prev !== undefined ? Math.round((y - prev) * 100) : undefined }];
    });
    if (curve.length === 0) return;
    const y10 = last("GSEC10Y");
    const y1 = last("TBILL364D");
    const repo = last("RBIREPO");
    const us10 = last("US10Y");
    evidence.rates = {
      curve,
      spreadsBp: {
        tenMinusRepo: y10 !== undefined && repo !== undefined ? Math.round((y10 - repo) * 100) : undefined,
        tenMinusOneY: y10 !== undefined && y1 !== undefined ? Math.round((y10 - y1) * 100) : undefined,
        vsUs10y: y10 !== undefined && us10 !== undefined ? Math.round((y10 - us10) * 100) : undefined,
      },
      repo,
      crr: last("RBICRR"),
      slr: last("RBISLR"),
    };
  });

  await section("mood", async () => {
    const closes = (await closesFor(prisma, ["^MMI"], todayBars, runDate, 10)).get("^MMI")?.closes ?? [];
    const value = closes.at(-1);
    if (value === undefined) return;
    const prev = closes.at(-2);
    evidence.mood = { value, zone: mmiZone(value), d1: prev !== undefined ? round2(value - prev) : undefined };
  });

  await section("commodities", async () => {
    const symbols = Object.keys(COMMODITY_NAMES);
    const map = await closesFor(prisma, symbols, todayBars, runDate);
    const rows = symbols.flatMap((symbol) => {
      const closes = map.get(symbol)?.closes ?? [];
      const close = closes.at(-1);
      if (close === undefined) return [];
      return [{ symbol, name: COMMODITY_NAMES[symbol], close: round2(close), r1: pctOver(closes, 1), r5: pctOver(closes, 5) }];
    });
    if (rows.length > 0) evidence.commodities = rows;
  });

  await section("forex", async () => {
    const map = await closesFor(prisma, ["USDINR", "INR=X"], todayBars, runDate);
    const closes = map.get("USDINR")?.closes.length ? map.get("USDINR")!.closes : (map.get("INR=X")?.closes ?? []);
    const close = closes.at(-1);
    if (close === undefined) return;
    evidence.forex = { usdinr: { close: round2(close), r1: pctOver(closes, 1), r5: pctOver(closes, 5) } };
  });

  await section("breadth", async () => {
    const closes = (await closesFor(prisma, ["^BREADTH"], todayBars, runDate)).get("^BREADTH")?.closes ?? [];
    const today = closes.at(-1);
    if (today === undefined) return;
    const five = closes.slice(-5);
    evidence.breadth = { pctAdvancers: round2(today), avg5: five.length ? round2(five.reduce((a, b) => a + b, 0) / five.length) : undefined };
  });

  await section("sectors", async () => {
    const dates = await prisma.dailyBar.findMany({
      where: { source: "bhavcopy" },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
      take: 2,
    });
    if (dates.length < 2) return;
    const rows = await prisma.dailyBar.findMany({
      where: { source: "bhavcopy", date: { in: dates.map((d) => d.date) }, symbol: { in: Object.keys(SECTOR_OF) } },
      select: { symbol: true, date: true, close: true },
    });
    const latest = new Map<string, number>();
    const prev = new Map<string, number>();
    for (const r of rows) (r.date.getTime() === dates[0].date.getTime() ? latest : prev).set(r.symbol, r.close);
    const heat = sectorHeat(latest, prev);
    if (heat.length > 0) evidence.sectors = { leaders: heat.slice(0, 4), laggards: heat.slice(-4).reverse() };
  });

  await section("street", async () => {
    const fuelSymbols = ["PETROL", "DIESEL"].flatMap((f) =>
      ["MUMBAI", "DELHI", "BENGALURU", "CHENNAI", "KOLKATA", "HYDERABAD", "PUNE"].map((c) => `${f}:${c}`),
    );
    const map = await closesFor(prisma, [...fuelSymbols, "GOLD999", "SILVER999"], todayBars, runDate, 12);
    const avgOf = (fuel: string, back = 0) => {
      const vals = fuelSymbols
        .filter((s) => s.startsWith(fuel))
        .flatMap((s) => {
          const closes = map.get(s)?.closes ?? [];
          const v = closes[closes.length - 1 - back];
          return v !== undefined ? [v] : [];
        });
      return vals.length > 0 ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined;
    };
    const petrol = avgOf("PETROL");
    const diesel = avgOf("DIESEL");
    const petrolWeekAgo = avgOf("PETROL", 6);
    const bullion = (["GOLD999", "SILVER999"] as const).flatMap((s) => {
      const closes = map.get(s)?.closes ?? [];
      const fix = closes.at(-1);
      if (fix === undefined) return [];
      return [{ name: s === "GOLD999" ? "Gold 999 (₹/10g)" : "Silver 999 (₹/kg)", fix, d1Pct: pctOver(closes, 1) }];
    });
    const street: NonNullable<Evidence["street"]> = {};
    if (petrol !== undefined && diesel !== undefined) {
      street.fuel = {
        petrolMetroAvg: petrol,
        dieselMetroAvg: diesel,
        petrolWowPct: petrolWeekAgo ? round2(((petrol - petrolWeekAgo) / petrolWeekAgo) * 100) : undefined,
      };
    }
    if (bullion.length > 0) street.bullion = bullion;
    const weather = await fetchWeather();
    if (weather) {
      const seven = weather.slice(0, 7);
      const hottest = seven.reduce<{ city: string; tmax: number } | undefined>(
        (best, w) => (!best || w.tmax > best.tmax ? { city: w.city, tmax: w.tmax } : best),
        undefined,
      );
      street.monsoon = { rainLikely: seven.filter((w) => w.rainProb >= 50).length, of: seven.length, hottest };
    }
    if (Object.keys(street).length > 0) evidence.street = street;
  });

  await section("calendar", async () => {
    const horizon = new Date(new Date(runDate).getTime() + 7 * 86_400_000);
    const events = await prisma.event.findMany({
      where: { kind: "calendar", ts: { gte: new Date(runDate), lte: horizon } },
      orderBy: { ts: "asc" },
      take: 14,
    });
    if (events.length === 0) return;
    evidence.calendar = events.map((e) => ({
      date: e.ts.toISOString().slice(0, 10),
      title: e.title,
      type: (e.payload as { calType?: string } | null)?.calType,
    }));
  });

  return evidence;
}
