import { SECTOR_OF } from "@/agents/universe";
import { sectorHeat, type SectorHeat } from "@/lib/sectors";
import { fetchWeather } from "@/lib/weather";
import { mmiZone } from "./sources/mmi";
import type { IngestBar, IngestEvent, IngestFlow } from "./types";

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
    /** Today's city weather — one day, metro cities; NOT a seasonal rainfall signal. */
    weatherToday?: { citiesRainLikely: number; ofCities: number; hottest?: { city: string; tmax: number } };
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
  // This runs BEFORE persist(), so today's flows/events/bhavcopy exist only
  // in memory — merge them or the pack runs one session behind the board.
  run: { flows: IngestFlow[]; events: IngestEvent[] },
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
    const rows = await prisma.flowDaily.findMany({ orderBy: { date: "desc" }, take: 40 });
    const byDate = new Map<string, { fiiNet?: number; diiNet?: number }>();
    const put = (d: string, category: string, net: number) => {
      const entry = byDate.get(d) ?? {};
      if (category.startsWith("FII")) entry.fiiNet = round2(net);
      else entry.diiNet = round2(net);
      byDate.set(d, entry);
    };
    for (const r of rows) put(r.date.toISOString().slice(0, 10), r.category, r.net);
    for (const f of run.flows) put(f.date, f.category, f.net);
    const all = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    if (all.length === 0) return;
    // streak over the full pull — a 15-session run must not read as 5
    const fiiNets = all.flatMap(([, v]) => (v.fiiNet !== undefined ? [v.fiiNet] : []));
    const sessions = all.slice(-5).map(([date, v]) => ({ date, ...v }));
    evidence.flows = { sessions, fiiStreak: fiiStreakOf(fiiNets) };
  });

  await section("rates", async () => {
    const symbols = [...CURVE_LABELS.map((c) => c.symbol), "RBIREPO", "RBICRR", "RBISLR", "US10Y"];
    // 45 days: repo/CRR/SLR move rarely — a short window would silently
    // drop the whole section during an RBI-scrape outage.
    const map = await closesFor(prisma, symbols, todayBars, runDate, 45);
    const last = (s: string) => map.get(s)?.closes.at(-1);
    const curve = CURVE_LABELS.flatMap(({ symbol, label }) => {
      const series = map.get(symbol);
      const y = series?.closes.at(-1);
      if (series === undefined || y === undefined) return [];
      const prev = series.closes.at(-2);
      // a "1-day change" across a data gap is a lie — gate on real adjacency
      const adjacent =
        prev !== undefined &&
        new Date(series.dates.at(-1)!).getTime() - new Date(series.dates.at(-2)!).getTime() <= 5 * 86_400_000;
      return [{ label, yieldPct: y, chg1dBp: adjacent ? Math.round((y - prev) * 100) : undefined }];
    });
    if (curve.length < 4) return; // same floor as the rates panel — no 1-point "curve" for the agents
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
    // Today's bhavcopy lives in todayBars (not yet persisted) — when it's
    // there, today vs the archive's latest; otherwise archive's last two.
    const todaysBhav = Object.values(todayBars)
      .flat()
      .filter((b) => b.source === "bhavcopy" && b.date === runDate && SECTOR_OF[b.symbol]);
    const dates = await prisma.dailyBar.findMany({
      where: { source: "bhavcopy", date: { lt: new Date(runDate) } },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
      take: 2,
    });
    const latest = new Map<string, number>();
    const prev = new Map<string, number>();
    if (todaysBhav.length > 0 && dates.length >= 1) {
      for (const b of todaysBhav) latest.set(b.symbol, b.close);
      const rows = await prisma.dailyBar.findMany({
        where: { source: "bhavcopy", date: dates[0].date, symbol: { in: Object.keys(SECTOR_OF) } },
        select: { symbol: true, close: true },
      });
      for (const r of rows) prev.set(r.symbol, r.close);
    } else if (dates.length >= 2) {
      const rows = await prisma.dailyBar.findMany({
        where: { source: "bhavcopy", date: { in: dates.map((d) => d.date) }, symbol: { in: Object.keys(SECTOR_OF) } },
        select: { symbol: true, date: true, close: true },
      });
      for (const r of rows) (r.date.getTime() === dates[0].date.getTime() ? latest : prev).set(r.symbol, r.close);
    } else {
      return;
    }
    const heat = sectorHeat(latest, prev);
    if (heat.length > 0) evidence.sectors = { leaders: heat.slice(0, 4), laggards: heat.slice(-4).reverse() };
  });

  await section("street", async () => {
    const fuelSymbols = ["PETROL", "DIESEL"].flatMap((f) =>
      ["MUMBAI", "DELHI", "BENGALURU", "CHENNAI", "KOLKATA", "HYDERABAD", "PUNE"].map((c) => `${f}:${c}`),
    );
    const map = await closesFor(prisma, [...fuelSymbols, "GOLD999", "SILVER999"], todayBars, runDate, 12);
    // Date-anchored: cities publish independently, so positional indexing
    // would mix dates and change the average's composition. Only cities
    // current at the fuel data's latest date count, and week-ago compares
    // the SAME cities at the same anchor date.
    const fuelDates = fuelSymbols.flatMap((s) => map.get(s)?.dates.at(-1) ?? []);
    const anchor = fuelDates.sort().at(-1);
    const weekAgo = anchor ? new Date(new Date(anchor).getTime() - 6 * 86_400_000).toISOString().slice(0, 10) : undefined;
    const closeAt = (s: string, date: string) => {
      const series = map.get(s);
      if (!series) return undefined;
      for (let i = series.dates.length - 1; i >= 0; i -= 1) if (series.dates[i] <= date) return series.closes[i];
      return undefined;
    };
    const avgOf = (fuel: string, date?: string) => {
      if (!anchor || !date) return undefined;
      const current = fuelSymbols.filter((s) => s.startsWith(fuel) && map.get(s)?.dates.at(-1) === anchor);
      const vals = current.flatMap((s) => closeAt(s, date) ?? []);
      return vals.length === current.length && vals.length > 0
        ? round2(vals.reduce((a, b) => a + b, 0) / vals.length)
        : undefined;
    };
    const petrol = avgOf("PETROL", anchor);
    const diesel = avgOf("DIESEL", anchor);
    const petrolWeekAgo = avgOf("PETROL", weekAgo);
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
    if (weather && weather.length > 0) {
      const hottest = weather.reduce<{ city: string; tmax: number } | undefined>(
        (best, w) => (!best || w.tmax > best.tmax ? { city: w.city, tmax: w.tmax } : best),
        undefined,
      );
      street.weatherToday = {
        citiesRainLikely: weather.filter((w) => w.rainProb >= 50).length,
        ofCities: weather.length,
        hottest,
      };
    }
    if (Object.keys(street).length > 0) evidence.street = street;
  });

  await section("calendar", async () => {
    const horizon = new Date(new Date(runDate).getTime() + 7 * 86_400_000);
    const stored = await prisma.event.findMany({
      where: { kind: "calendar", ts: { gte: new Date(runDate), lte: horizon } },
      orderBy: { ts: "asc" },
      take: 20,
    });
    const fresh = run.events.filter((e) => e.kind === "calendar" && e.ts >= new Date(runDate) && e.ts <= horizon);
    const seen = new Set<string>();
    const merged = [...stored, ...fresh]
      .filter((e) => (seen.has(`${e.ts.toISOString().slice(0, 10)}|${e.title}`) ? false : (seen.add(`${e.ts.toISOString().slice(0, 10)}|${e.title}`), true)))
      .sort((a, b) => a.ts.getTime() - b.ts.getTime())
      .slice(0, 14);
    if (merged.length === 0) return;
    evidence.calendar = merged.map((e) => ({
      date: e.ts.toISOString().slice(0, 10),
      title: e.title,
      type: (e.payload as { calType?: string } | null)?.calType,
    }));
  });

  return evidence;
}
