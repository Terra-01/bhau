import { XMLParser } from "fast-xml-parser";
import type { BriefingPack } from "@/ingest/briefing";
import { SECTOR_OF } from "@/agents/universe";
import { BENCHMARK_AGENT_ID, PERSONAS } from "@/agents/personas";
import { FEEDS } from "@/ingest/feeds";
import { USER_AGENT } from "@/ingest/types";
import { prisma } from "./db";

// Server-side assembly for the war room. Everything is "latest available"
// — the page must render correctly at any hour, on holidays, and before
// the first ingest of a new day.

export interface StripItem {
  symbol: string;
  name: string;
  close: number;
  change1dPct?: number;
  spark: number[];
}

export interface WarRoomData {
  packDate: string;
  tradingDay: boolean;
  regime: BriefingPack["regime"];
  synthesis: BriefingPack["synthesis"] | null;
  /** Regime score history (asc) + delta vs previous session. */
  regimeTrend: { history: Array<{ date: string; score: number }>; delta?: number };
  strip: StripItem[];
  news: BriefingPack["news"];
  flows: Array<{ date: string; category: string; buy: number; sell: number; net: number }>;
  /** Consecutive sessions of FII net selling (+n) or buying (−n as buyStreak). */
  fiiStreak: { direction: "selling" | "buying"; days: number } | null;
  sectors: Array<{ sector: string; avgChangePct: number; count: number }>;
  movers: { gainers: Array<{ symbol: string; changePct: number }>; losers: Array<{ symbol: string; changePct: number }> };
  breadth: { latest?: number; history: Array<{ date: string; value: number }> };
  candles: Array<{ date: Date; open: number; high: number; low: number; close: number }>;
  race: Array<Record<string, unknown>>; // {date: Date, [agentId]: equity}
  commodities: StripItem[];
  weather: Array<{ city: string; tmax: number; tmin: number; code: number; rainProb: number }> | null;
  cityPulse: {
    cities: Array<{ city: string; petrol?: number; diesel?: number }>;
    metals: Array<{ name: string; unit: string; value: number; changePct?: number }>;
    metalsAsOf?: string;
  } | null;
  songs: Array<{ title: string; artist: string; art?: string; url?: string }> | null;
  songMood: { label: string; emoji: string; line: string } | null;
  floor: {
    date: string;
    scoreboard: Array<{
      agentId: string;
      name: string;
      equity: number;
      totalReturnPct: number;
      isBenchmark: boolean;
    }>;
    theses: Array<{
      seq: number;
      ts: Date;
      agentId: string;
      agentName: string;
      action: string;
      symbol?: string;
      allocationPct?: number;
      thesis: string;
      accepted: boolean;
      rejectReason?: string;
    }>;
  };
}

const COMMODITIES: Array<{ name: string; candidates: string[] }> = [
  { name: "Gold", candidates: ["GC=F"] },
  { name: "Silver", candidates: ["SI=F"] },
  { name: "Copper", candidates: ["HG=F"] },
  { name: "Brent", candidates: ["BZ=F", "BRENT-SPOT"] },
  { name: "WTI", candidates: ["CL=F"] },
  { name: "Nat Gas", candidates: ["NG=F"] },
];

// Weather for the subcontinent's market cities — Open-Meteo, keyless.
const CITIES = [
  { city: "Mumbai", lat: 19.076, lon: 72.877 },
  { city: "Delhi", lat: 28.613, lon: 77.209 },
  { city: "Bengaluru", lat: 12.972, lon: 77.594 },
  { city: "Chennai", lat: 13.083, lon: 80.27 },
  { city: "Kolkata", lat: 22.573, lon: 88.364 },
  { city: "Hyderabad", lat: 17.385, lon: 78.487 },
  { city: "Pune", lat: 18.52, lon: 73.856 },
  { city: "Ahmedabad", lat: 23.023, lon: 72.571 },
  { city: "Jaipur", lat: 26.912, lon: 75.787 },
  { city: "Surat", lat: 21.17, lon: 72.831 },
];

// Open-Meteo flakes occasionally from datacenter egress — retry once and
// keep the last good forecast (weather ages gracefully; a few-hours-old
// forecast beats an empty tile for a whole ISR window).
let lastWeather: { at: number; data: NonNullable<WarRoomData["weather"]> } | null = null;

async function fetchWeather(): Promise<WarRoomData["weather"]> {
  const lats = CITIES.map((c) => c.lat).join(",");
  const lons = CITIES.map((c) => c.lon).join(",");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=1`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{
        daily?: { weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
      }>;
      const list = Array.isArray(data) ? data : [data];
      const out: NonNullable<WarRoomData["weather"]> = [];
      for (const [i, { city }] of CITIES.entries()) {
        const daily = list[i]?.daily;
        const code = daily?.weather_code?.[0];
        const tmax = daily?.temperature_2m_max?.[0];
        const tmin = daily?.temperature_2m_min?.[0];
        if (typeof code !== "number" || typeof tmax !== "number" || typeof tmin !== "number") continue;
        out.push({ city, code, tmax: Math.round(tmax), tmin: Math.round(tmin), rainProb: daily?.precipitation_probability_max?.[0] ?? 0 });
      }
      // A malformed 200 must never become "Clear sky 0°/0°" — treat it as
      // a failed attempt rather than caching fabricated readings.
      if (out.length < CITIES.length) continue;
      lastWeather = { at: Date.now(), data: out };
      return out;
    } catch {
      /* retry once, then fall through to last-good */
    }
  }
  return lastWeather && Date.now() - lastWeather.at < 12 * 60 * 60 * 1000 ? lastWeather.data : null;
}

// Fuel is city-level (state taxes); bullion is IBJA's national fix.
const PULSE_CITIES = ["MUMBAI", "DELHI", "BENGALURU", "CHENNAI", "KOLKATA", "HYDERABAD", "PUNE"];
const CITY_LABEL: Record<string, string> = {
  MUMBAI: "Mumbai", DELHI: "Delhi", BENGALURU: "Bengaluru",
  CHENNAI: "Chennai", KOLKATA: "Kolkata", HYDERABAD: "Hyderabad", PUNE: "Pune",
};

async function fetchCityPulse(): Promise<WarRoomData["cityPulse"]> {
  const symbols = [
    ...PULSE_CITIES.flatMap((c) => [`PETROL:${c}`, `DIESEL:${c}`]),
    "GOLD999", "SILVER999",
  ];
  const rows = await prisma.dailyBar.findMany({
    where: { symbol: { in: symbols }, date: { gte: new Date(Date.now() - 15 * 86_400_000) } },
    orderBy: { date: "asc" },
  });
  if (rows.length === 0) return null;
  const bySymbol = new Map<string, Array<{ date: string; close: number }>>();
  for (const row of rows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push({ date: row.date.toISOString().slice(0, 10), close: row.close });
    bySymbol.set(row.symbol, list);
  }
  const cities = PULSE_CITIES.flatMap((key) => {
    const petrol = bySymbol.get(`PETROL:${key}`)?.at(-1)?.close;
    const diesel = bySymbol.get(`DIESEL:${key}`)?.at(-1)?.close;
    return petrol === undefined && diesel === undefined ? [] : [{ city: CITY_LABEL[key], petrol, diesel }];
  });
  const metals: NonNullable<WarRoomData["cityPulse"]>["metals"] = [];
  let metalsAsOf: string | undefined;
  for (const [symbol, name, unit] of [
    ["GOLD999", "Gold 999", "/10g"],
    ["SILVER999", "Silver 999", "/kg"],
  ] as const) {
    const bars = bySymbol.get(symbol);
    const last = bars?.at(-1);
    if (!last) continue;
    const prev = bars!.at(-2);
    metals.push({
      name, unit, value: last.close,
      changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : undefined,
    });
    metalsAsOf = last.date;
  }
  if (cities.length === 0 && metals.length === 0) return null;
  return { cities, metals, metalsAsOf };
}

// The wire stays current all day: the same RSS feeds the nightly ingest
// archives, fetched here with a 15-minute cache. The evening pack is the
// fallback when every feed is down.
const rssParser = new XMLParser({ ignoreAttributes: false });
const TOP_PER_CATEGORY = 14;

async function fetchFreshNews(): Promise<BriefingPack["news"] | null> {
  const perFeed = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "user-agent": USER_AGENT },
          next: { revalidate: 900 },
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return [];
        const doc = rssParser.parse(await res.text()) as {
          rss?: { channel?: { item?: Array<{ title?: unknown; link?: unknown; pubDate?: unknown }> | { title?: unknown } } };
        };
        const raw = doc?.rss?.channel?.item;
        const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return items.flatMap((item: { title?: unknown; link?: unknown; pubDate?: unknown }) => {
          const title = String(item.title ?? "").trim();
          if (!title) return [];
          const ts = item.pubDate ? new Date(String(item.pubDate)) : new Date();
          return [{
            category: feed.category,
            ts: (Number.isNaN(ts.getTime()) ? new Date() : ts).toISOString(),
            source: feed.name,
            title,
            url: item.link ? String(item.link) : undefined,
          }];
        });
      } catch {
        return [];
      }
    }),
  );
  const all = perFeed.flat().sort((a, b) => (a.ts < b.ts ? 1 : -1));
  if (all.length === 0) return null;
  const news: BriefingPack["news"] = {};
  const seenTitles = new Set<string>();
  for (const item of all) {
    if (seenTitles.has(item.title)) continue;
    seenTitles.add(item.title);
    const list = (news[item.category] ??= []);
    if (list.length >= TOP_PER_CATEGORY) continue;
    list.push({ ts: item.ts, source: item.source, title: item.title, url: item.url });
  }
  return news;
}

// Trending songs, India — iTunes RSS, keyless. Pure gen-z garnish.
async function fetchSongs(): Promise<WarRoomData["songs"]> {
  try {
    const res = await fetch("https://itunes.apple.com/in/rss/topsongs/limit=3/json", {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      feed?: { entry?: Array<{ "im:name"?: { label?: string }; "im:artist"?: { label?: string }; "im:image"?: Array<{ label?: string }>; link?: { attributes?: { href?: string } } }> };
    };
    const entries = data.feed?.entry ?? [];
    return entries.slice(0, 3).map((e) => ({
      title: e["im:name"]?.label ?? "—",
      artist: e["im:artist"]?.label ?? "",
      art: e["im:image"]?.at(-1)?.label,
      url: e.link?.attributes?.href,
    }));
  } catch {
    return null;
  }
}

// Display order; later entries are fallbacks for the same concept.
const STRIP: Array<{ name: string; candidates: string[] }> = [
  { name: "Nifty 50", candidates: ["^NSEI"] },
  { name: "Nifty Bank", candidates: ["^NSEBANK"] },
  { name: "Sensex", candidates: ["^BSESN"] },
  { name: "India VIX", candidates: ["^INDIAVIX"] },
  { name: "USD/INR", candidates: ["INR=X", "USDINR"] },
  { name: "Brent", candidates: ["BZ=F", "BRENT-SPOT"] },
  { name: "US 10Y", candidates: ["US10Y"] },
  { name: "Breadth", candidates: ["^BREADTH"] },
];

const AGENT_NAMES: Record<string, string> = Object.fromEntries([
  ...PERSONAS.map((p) => [p.id, p.name]),
  [BENCHMARK_AGENT_ID, "Nifty (NIFTYBEES)"],
]);

export async function getWarRoomData(): Promise<WarRoomData | null> {
  const packRow = await prisma.briefingPack.findFirst({ orderBy: { date: "desc" } });
  if (!packRow) return null;
  const pack = packRow.pack as unknown as BriefingPack;

  const [weather, songs, cityPulse, freshNews] = await Promise.all([
    fetchWeather(),
    fetchSongs(),
    fetchCityPulse(),
    fetchFreshNews(),
  ]);
  const { readSongMood } = await import("./song-mood");
  const songMood = songs ? await readSongMood(songs.map((s) => ({ title: s.title, artist: s.artist }))) : null;

  // --- market strip + commodities with ~12-session sparklines
  const stripSymbols = [...STRIP, ...COMMODITIES].flatMap((s) => s.candidates);
  const since = new Date(Date.now() - 20 * 86_400_000);
  const history = await prisma.dailyBar.findMany({
    where: { symbol: { in: stripSymbols }, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  const bySymbol = new Map<string, { date: string; close: number }[]>();
  for (const bar of history) {
    const key = bar.symbol;
    const list = bySymbol.get(key) ?? [];
    const iso = bar.date.toISOString().slice(0, 10);
    // multiple sources may write the same (date, concept) — last write wins per date
    const existing = list.find((b) => b.date === iso);
    if (existing) existing.close = bar.close;
    else list.push({ date: iso, close: bar.close });
    bySymbol.set(key, list);
  }
  const toItems = (defs: Array<{ name: string; candidates: string[] }>): StripItem[] =>
    defs.flatMap(({ name, candidates }) => {
      const symbol = candidates.find((c) => (bySymbol.get(c)?.length ?? 0) > 0);
      if (!symbol) return [];
      const bars = bySymbol.get(symbol)!;
      const last = bars.at(-1)!;
      const prev = bars.at(-2);
      return [{
        symbol,
        name,
        close: last.close,
        change1dPct: prev ? ((last.close - prev.close) / prev.close) * 100 : undefined,
        spark: bars.slice(-12).map((b) => b.close),
      }];
    });
  const strip = toItems(STRIP);
  const commodities = toItems(COMMODITIES);

  // --- FII/DII flows, newest first, up to 5 sessions × 2 categories
  const flowRows = await prisma.flowDaily.findMany({ orderBy: { date: "desc" }, take: 10 });
  const flows = flowRows.map((f) => ({
    date: f.date.toISOString().slice(0, 10),
    category: f.category,
    buy: f.buy,
    sell: f.sell,
    net: f.net,
  }));

  // --- sector heatmap from the two latest bhavcopy sessions
  const bhavDates = await prisma.dailyBar.findMany({
    where: { source: "bhavcopy" },
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: 2,
    select: { date: true },
  });
  const sectors: WarRoomData["sectors"] = [];
  if (bhavDates.length === 2) {
    const [latest, previous] = bhavDates.map((d) => d.date);
    const universeSymbols = Object.keys(SECTOR_OF);
    const rows = await prisma.dailyBar.findMany({
      where: { source: "bhavcopy", date: { in: [latest, previous] }, symbol: { in: universeSymbols } },
    });
    const closes = new Map<string, { latest?: number; previous?: number }>();
    for (const row of rows) {
      const entry = closes.get(row.symbol) ?? {};
      if (row.date.getTime() === latest.getTime()) entry.latest = row.close;
      else entry.previous = row.close;
      closes.set(row.symbol, entry);
    }
    const bySector = new Map<string, number[]>();
    for (const [symbol, { latest: l, previous: p }] of closes) {
      if (l === undefined || p === undefined || p === 0) continue;
      const sector = SECTOR_OF[symbol];
      const list = bySector.get(sector) ?? [];
      list.push(((l - p) / p) * 100);
      bySector.set(sector, list);
    }
    for (const [sector, changes] of bySector) {
      sectors.push({
        sector,
        avgChangePct: changes.reduce((a, b) => a + b, 0) / changes.length,
        count: changes.length,
      });
    }
    sectors.sort((a, b) => b.avgChangePct - a.avgChangePct);
  }

  // --- the Floor
  const latestSnapDate = await prisma.equitySnapshot.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  const snaps = latestSnapDate
    ? await prisma.equitySnapshot.findMany({ where: { date: latestSnapDate.date } })
    : [];
  const scoreboard = snaps
    .map((s) => ({
      agentId: s.agentId,
      name: AGENT_NAMES[s.agentId] ?? s.agentId,
      equity: s.equity,
      totalReturnPct: s.totalReturnPct,
      isBenchmark: s.agentId === BENCHMARK_AGENT_ID,
    }))
    .sort((a, b) => b.equity - a.equity);
  const decisionRows = await prisma.ledgerEntry.findMany({
    where: { kind: "DECISION" },
    orderBy: { seq: "desc" },
    take: 8,
  });
  const theses = decisionRows.map((d) => {
    const p = d.payload as Record<string, unknown>;
    return {
      seq: d.seq,
      ts: d.ts,
      agentId: d.agentId,
      agentName: AGENT_NAMES[d.agentId] ?? d.agentId,
      action: String(p.action ?? ""),
      symbol: p.symbol as string | undefined,
      allocationPct: p.allocationPct as number | undefined,
      thesis: String(p.thesis ?? ""),
      accepted: Boolean(p.accepted),
      rejectReason: p.rejectReason as string | undefined,
    };
  });

  // --- movers: best/worst NIFTY 100 names across the two latest sessions
  const movers: WarRoomData["movers"] = { gainers: [], losers: [] };
  if (bhavDates.length === 2) {
    const [latest, previous] = bhavDates.map((d) => d.date);
    const rows = await prisma.dailyBar.findMany({
      where: { source: "bhavcopy", date: { in: [latest, previous] }, symbol: { in: Object.keys(SECTOR_OF) } },
      select: { symbol: true, date: true, close: true },
    });
    const closes = new Map<string, { l?: number; p?: number }>();
    for (const row of rows) {
      const entry = closes.get(row.symbol) ?? {};
      if (row.date.getTime() === latest.getTime()) entry.l = row.close;
      else entry.p = row.close;
      closes.set(row.symbol, entry);
    }
    const changes = [...closes.entries()]
      .flatMap(([symbol, { l, p }]) => (l !== undefined && p ? [{ symbol, changePct: ((l - p) / p) * 100 }] : []))
      .sort((a, b) => b.changePct - a.changePct);
    movers.gainers = changes.slice(0, 5);
    movers.losers = changes.slice(-5).reverse();
  }

  // --- breadth history (% advancers)
  const breadthBars = await prisma.dailyBar.findMany({
    where: { symbol: "^BREADTH" },
    orderBy: { date: "asc" },
    take: 20,
  });
  const breadth: WarRoomData["breadth"] = {
    latest: breadthBars.at(-1)?.close,
    history: breadthBars.map((b) => ({ date: b.date.toISOString().slice(0, 10), value: b.close })),
  };

  // --- Nifty candles (sessions with real OHLC)
  const candleRows = await prisma.dailyBar.findMany({
    where: { symbol: "^NSEI", open: { not: null }, high: { not: null }, low: { not: null } },
    orderBy: { date: "asc" },
    take: 30,
  });
  const candleBy = new Map<string, (typeof candleRows)[number]>();
  for (const row of candleRows) candleBy.set(row.date.toISOString().slice(0, 10), row); // last source wins per date
  const candles = [...candleBy.values()].map((r) => ({
    date: r.date,
    open: r.open!,
    high: r.high!,
    low: r.low!,
    close: r.close,
  }));

  // --- equity race series (grows daily; benchmark included)
  const allSnaps = await prisma.equitySnapshot.findMany({ orderBy: { date: "asc" } });
  const raceByDate = new Map<string, Record<string, unknown>>();
  for (const snap of allSnaps) {
    const key = snap.date.toISOString().slice(0, 10);
    const row = raceByDate.get(key) ?? { date: snap.date };
    row[snap.agentId] = snap.equity;
    raceByDate.set(key, row);
  }
  const race = [...raceByDate.values()];

  // --- regime trend
  const regimeRows = await prisma.regimeSnapshot.findMany({ orderBy: { date: "asc" }, take: 30 });
  const regimeTrend: WarRoomData["regimeTrend"] = {
    history: regimeRows.map((r) => ({ date: r.date.toISOString().slice(0, 10), score: r.score })),
    delta:
      regimeRows.length >= 2
        ? Number((regimeRows.at(-1)!.score - regimeRows.at(-2)!.score).toFixed(1))
        : undefined,
  };

  // --- FII streak (consecutive sessions same direction)
  const fiiRows = flowRows
    .filter((f) => f.category.startsWith("FII"))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  let fiiStreak: WarRoomData["fiiStreak"] = null;
  if (fiiRows.length > 0) {
    const direction = fiiRows[0].net < 0 ? "selling" : "buying";
    let days = 0;
    for (const row of fiiRows) {
      if ((row.net < 0) === (direction === "selling")) days += 1;
      else break;
    }
    fiiStreak = { direction, days };
  }

  return {
    packDate: pack.date,
    tradingDay: pack.tradingDay,
    regime: pack.regime,
    synthesis: pack.synthesis ?? null,
    regimeTrend,
    strip,
    news: freshNews ?? pack.news,
    flows,
    fiiStreak,
    sectors,
    movers,
    breadth,
    candles,
    race,
    commodities,
    weather,
    cityPulse,
    songs,
    songMood,
    floor: {
      date: latestSnapDate?.date.toISOString().slice(0, 10) ?? pack.date,
      scoreboard,
      theses,
    },
  };
}
