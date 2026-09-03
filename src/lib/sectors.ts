import { SECTOR_OF } from "@/agents/universe";

// Sector heat from two sessions of NIFTY 100 closes — the one computation
// behind both the movers panel and the agents' evidence pack.

export interface SectorHeat {
  sector: string;
  avgChangePct: number;
  count: number;
}

export function sectorHeat(
  latestClose: Map<string, number>,
  prevClose: Map<string, number>,
): SectorHeat[] {
  const bySector = new Map<string, number[]>();
  for (const [symbol, sector] of Object.entries(SECTOR_OF)) {
    const l = latestClose.get(symbol);
    const p = prevClose.get(symbol);
    if (l === undefined || p === undefined || p === 0) continue;
    const list = bySector.get(sector) ?? [];
    list.push(((l - p) / p) * 100);
    bySector.set(sector, list);
  }
  return [...bySector.entries()]
    .map(([sector, changes]) => ({
      sector,
      avgChangePct: Number((changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2)),
      count: changes.length,
    }))
    .sort((a, b) => b.avgChangePct - a.avgChangePct);
}
