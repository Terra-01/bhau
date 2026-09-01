import { ECON_RELEASES, ETF_LIST, FUN_BASKETS, HERO_INDICES, INDEX_ROW, POLICY_RATE } from "@/config/exchange";
import { SYMBOL_NAMES } from "@/ingest/symbols";
import { prisma } from "./db";

// Server-side assembly for the Exchange sections (below the Deck).
// Everything is EOD/latest-available; freshness is displayed, not hidden.

export interface IndexChip {
  symbol: string;
  name: string;
  close: number;
  changePct?: number;
  hasHistory: boolean;
}

export interface StockRow {
  symbol: string;
  changePct: number;
  close: number;
  turnover: number;
}

export interface ExchangeData {
  asOf: string; // latest bhavcopy session date
  indices: IndexChip[];
  indicesHistory: Record<string, Array<{ date: Date; value: number }>>;
  mostTraded: StockRow[];
  gainers: StockRow[];
  losers: StockRow[];
  etfs: StockRow[];
  forex: Array<{ pair: string; price: number; horizons: Array<{ label: string; pct: number | null }> }> | null;
  earnings: Array<{ symbol: string; company?: string; purpose?: string; date: string; isResults: boolean }>;
  ipos: Array<{ symbol: string; company?: string; date: string; endDate?: string; priceBand?: string; status?: string }>;
  econCalendar: Array<{ name: string; source: string; date: string }>;
  economy: {
    tiles: Array<{ label: string; value: string; sub?: string }>;
    gdpSeries: Array<{ date: Date; value: number }>;
  } | null;
  funBaskets: Array<{
    id: string;
    name: string;
    blurb: string;
    changePct: number;
    constituents: Array<{ symbol: string; changePct: number }>;
  }>;
}

const MIN_TURNOVER = 500_000; // ₹5L floor keeps zero-liquidity noise out of the lists

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function fetchForex(): Promise<ExchangeData["forex"]> {
  try {
    const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    const horizons: Array<{ label: string; daysAgo: number }> = [
      { label: "1D", daysAgo: 1 },
      { label: "1W", daysAgo: 7 },
      { label: "1M", daysAgo: 30 },
      { label: "6M", daysAgo: 182 },
      { label: "1Y", daysAgo: 365 },
      { label: "5Y", daysAgo: 1826 },
    ];
    const get = async (path: string) => {
      const res = await fetch(`https://api.frankfurter.dev/v1/${path}&base=INR&symbols=USD,EUR,JPY,GBP,CHF,CNY`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`frankfurter ${res.status}`);
      return (await res.json()) as { rates: Record<string, number> };
    };
    const [latest, ...past] = await Promise.all([
      get("latest?"),
      ...horizons.map((h) => get(`${iso(h.daysAgo)}?`)),
    ]);
    const pairs = ["USD", "EUR", "JPY", "GBP", "CHF", "CNY"];
    return pairs.map((ccy) => {
      const now = 1 / latest.rates[ccy]; // INR per unit of ccy
      return {
        pair: `${ccy}/INR`,
        price: now,
        horizons: horizons.map((h, i) => {
          const then = past[i]?.rates?.[ccy] ? 1 / past[i].rates[ccy] : null;
          return { label: h.label, pct: then ? ((now - then) / then) * 100 : null };
        }),
      };
    });
  } catch {
    return null;
  }
}

interface WorldBankRow {
  date: string;
  value: number | null;
}

async function fetchEconomy(): Promise<ExchangeData["economy"]> {
  try {
    const get = async (indicator: string): Promise<WorldBankRow[]> => {
      const res = await fetch(
        `https://api.worldbank.org/v2/country/IND/indicator/${indicator}?format=json&per_page=20`,
        { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) },
      );
      if (!res.ok) throw new Error(`worldbank ${res.status}`);
      const data = (await res.json()) as [unknown, WorldBankRow[]];
      return (data[1] ?? []).filter((r) => r.value !== null);
    };
    const [gdp, growth, inflation, unemployment] = await Promise.all([
      get("NY.GDP.MKTP.CD"),
      get("NY.GDP.MKTP.KD.ZG"),
      get("FP.CPI.TOTL.ZG"),
      get("SL.UEM.TOTL.ZS"),
    ]);
    const latest = (rows: WorldBankRow[]) => rows[0];
    const tiles = [
      { label: "GDP", value: `$${(latest(gdp).value! / 1e12).toFixed(2)} T`, sub: latest(gdp).date },
      { label: "GDP growth", value: `${latest(growth).value!.toFixed(1)}%`, sub: latest(growth).date },
      { label: "CPI inflation", value: `${latest(inflation).value!.toFixed(1)}%`, sub: `${latest(inflation).date} avg` },
      { label: "Unemployment", value: `${latest(unemployment).value!.toFixed(1)}%`, sub: latest(unemployment).date },
      { label: POLICY_RATE.label, value: `${POLICY_RATE.value.toFixed(2)}%`, sub: POLICY_RATE.asOf },
    ];
    const gdpSeries = [...gdp]
      .reverse()
      .slice(-15)
      .map((r) => ({ date: new Date(`${r.date}-12-31`), value: r.value! / 1e12 }));
    return { tiles, gdpSeries };
  } catch {
    return null;
  }
}

function nextOccurrences(): ExchangeData["econCalendar"] {
  const out: ExchangeData["econCalendar"] = [];
  const now = new Date();
  for (const release of ECON_RELEASES) {
    const candidate = new Date(now);
    if ("dayOfMonth" in release.rule) {
      candidate.setDate(release.rule.dayOfMonth);
      if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
    } else {
      const delta = (release.rule.weekday - candidate.getDay() + 7) % 7 || 7;
      candidate.setDate(candidate.getDate() + delta);
    }
    out.push({ name: release.name, source: release.source, date: candidate.toISOString().slice(0, 10) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
}

export async function getExchangeData(): Promise<ExchangeData> {
  const [forex, economy] = await Promise.all([fetchForex(), fetchEconomy()]);

  // --- indices: latest two nse closes per symbol
  const indexSymbols = [...INDEX_ROW];
  const indexRows = await prisma.dailyBar.findMany({
    where: { symbol: { in: indexSymbols } },
    orderBy: { date: "desc" },
    take: indexSymbols.length * 8,
  });
  const perIndex = new Map<string, Array<{ date: string; close: number }>>();
  for (const row of indexRows) {
    const list = perIndex.get(row.symbol) ?? [];
    const iso = row.date.toISOString().slice(0, 10);
    if (!list.some((r) => r.date === iso)) list.push({ date: iso, close: row.close });
    perIndex.set(row.symbol, list);
  }
  const heroSet = new Set<string>(HERO_INDICES);
  const indices: IndexChip[] = indexSymbols.flatMap((symbol) => {
    const bars = perIndex.get(symbol);
    if (!bars || bars.length === 0) return [];
    return [{
      symbol,
      name: SYMBOL_NAMES[symbol] ?? symbol,
      close: bars[0].close,
      changePct: bars[1] ? ((bars[0].close - bars[1].close) / bars[1].close) * 100 : undefined,
      hasHistory: heroSet.has(symbol),
    }];
  });

  // --- hero index history (1Y)
  const since = new Date(Date.now() - 370 * 86_400_000);
  const historyRows = await prisma.dailyBar.findMany({
    where: { symbol: { in: [...HERO_INDICES] }, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  const indicesHistory: ExchangeData["indicesHistory"] = {};
  for (const row of historyRows) {
    (indicesHistory[row.symbol] ??= []).push({ date: row.date, value: row.close });
  }
  for (const key of Object.keys(indicesHistory)) {
    // dedupe by date (nse snapshot + history rows share dates)
    const seen = new Set<string>();
    indicesHistory[key] = indicesHistory[key].filter((p) => {
      const iso = p.date.toISOString().slice(0, 10);
      if (seen.has(iso)) return false;
      seen.add(iso);
      return true;
    });
  }

  // --- full-universe stock lists from the two latest bhavcopy sessions
  const bhavDates = await prisma.dailyBar.findMany({
    where: { source: "bhavcopy" },
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: 2,
    select: { date: true },
  });
  let mostTraded: StockRow[] = [];
  let gainers: StockRow[] = [];
  let losers: StockRow[] = [];
  let etfs: StockRow[] = [];
  const asOf = bhavDates[0]?.date.toISOString().slice(0, 10) ?? todayIST();
  if (bhavDates.length === 2) {
    const [latest, previous] = bhavDates.map((d) => d.date);
    const rows = await prisma.dailyBar.findMany({
      where: { source: "bhavcopy", date: { in: [latest, previous] } },
      select: { symbol: true, date: true, close: true, turnover: true },
    });
    const per = new Map<string, { l?: number; p?: number; turnover: number }>();
    for (const row of rows) {
      const entry = per.get(row.symbol) ?? { turnover: 0 };
      if (row.date.getTime() === latest.getTime()) {
        entry.l = row.close;
        entry.turnover = row.turnover ?? 0;
      } else entry.p = row.close;
      per.set(row.symbol, entry);
    }
    const all: StockRow[] = [...per.entries()].flatMap(([symbol, { l, p, turnover }]) =>
      l !== undefined && p ? [{ symbol, close: l, changePct: ((l - p) / p) * 100, turnover }] : [],
    );
    const liquid = all.filter((r) => r.turnover >= MIN_TURNOVER);
    mostTraded = [...all].sort((a, b) => b.turnover - a.turnover).slice(0, 6);
    gainers = [...liquid].sort((a, b) => b.changePct - a.changePct).slice(0, 6);
    losers = [...liquid].sort((a, b) => a.changePct - b.changePct).slice(0, 6);
    const etfSet = new Set<string>(ETF_LIST);
    etfs = all.filter((r) => etfSet.has(r.symbol)).sort((a, b) => b.turnover - a.turnover).slice(0, 10);
  }

  // --- NSE calendars (upcoming only)
  const today = todayIST();
  const calRows = await prisma.event.findMany({
    where: { kind: "calendar" },
    orderBy: { ts: "asc" },
    take: 400,
  });
  const earnings: ExchangeData["earnings"] = [];
  const ipos: ExchangeData["ipos"] = [];
  for (const row of calRows) {
    const p = row.payload as Record<string, unknown>;
    const date = String(p.date ?? "");
    if (date < today) continue;
    if (p.calType === "earnings") {
      earnings.push({
        symbol: String(p.symbol), company: p.company as string | undefined,
        purpose: p.purpose as string | undefined, date, isResults: Boolean(p.isResults),
      });
    } else if (p.calType === "ipo") {
      ipos.push({
        symbol: String(p.symbol), company: p.company as string | undefined, date,
        endDate: p.endDate as string | undefined, priceBand: p.priceBand as string | undefined,
        status: p.status as string | undefined,
      });
    }
  }
  earnings.sort((a, b) => Number(b.isResults) - Number(a.isResults) || a.date.localeCompare(b.date));

  // --- fun baskets: equal-weight daily change of curated real names
  const basketRows =
    bhavDates.length === 2
      ? await prisma.dailyBar.findMany({
          where: {
            source: "bhavcopy",
            date: { in: bhavDates.map((d) => d.date) },
            symbol: { in: FUN_BASKETS.flatMap((b) => b.symbols) },
          },
          select: { symbol: true, date: true, close: true },
        })
      : [];
  const basketCloses = new Map<string, { l?: number; p?: number }>();
  const latestDate = bhavDates[0]?.date.getTime();
  for (const row of basketRows) {
    const entry = basketCloses.get(row.symbol) ?? {};
    if (row.date.getTime() === latestDate) entry.l = row.close;
    else entry.p = row.close;
    basketCloses.set(row.symbol, entry);
  }
  const funBaskets: ExchangeData["funBaskets"] = FUN_BASKETS.map((basket) => {
    const constituents = basket.symbols.flatMap((symbol) => {
      const { l, p } = basketCloses.get(symbol) ?? {};
      return l !== undefined && p ? [{ symbol, changePct: ((l - p) / p) * 100 }] : [];
    });
    const changePct =
      constituents.length > 0 ? constituents.reduce((a, c) => a + c.changePct, 0) / constituents.length : 0;
    return { id: basket.id, name: basket.name, blurb: basket.blurb, changePct, constituents };
  });

  return {
    asOf,
    indices,
    indicesHistory,
    mostTraded,
    gainers,
    losers,
    etfs,
    forex,
    earnings: earnings.slice(0, 6),
    ipos: ipos.slice(0, 6),
    econCalendar: nextOccurrences(),
    economy,
    funBaskets,
  };
}
