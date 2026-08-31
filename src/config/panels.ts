// The war room mosaic registry (CONCEPT.md §4): config-driven composition.
// Explicit 12-col × 4-row placement on xl screens; below xl the tiles flow
// in `order` with natural heights. Per-user overrides land on top of these
// defaults when customization ships.
export interface TileDef {
  id: string;
  order: number;
  enabled: boolean;
  /** xl placement: [colStart, colSpan, rowStart, rowSpan] on a 12×4 grid. */
  grid: [number, number, number, number];
  /** Height class below xl, where the mosaic flows as a column. */
  flowHeight: string;
}

export const WAR_ROOM_TILES: TileDef[] = [
  { id: "floor", order: 1, enabled: true, grid: [1, 5, 1, 2], flowHeight: "max-xl:min-h-[380px]" },
  { id: "theses", order: 2, enabled: true, grid: [6, 3, 1, 2], flowHeight: "max-xl:h-[360px]" },
  { id: "brief", order: 3, enabled: true, grid: [9, 4, 1, 1], flowHeight: "max-xl:min-h-[150px]" },
  { id: "news", order: 4, enabled: true, grid: [9, 4, 2, 2], flowHeight: "max-xl:h-[360px]" },
  { id: "candles", order: 5, enabled: true, grid: [1, 4, 3, 1], flowHeight: "max-xl:h-[240px]" },
  { id: "sectors", order: 6, enabled: true, grid: [5, 4, 3, 1], flowHeight: "max-xl:h-[280px]" },
  { id: "regime", order: 7, enabled: true, grid: [1, 2, 4, 1], flowHeight: "max-xl:h-[200px]" },
  { id: "flows", order: 8, enabled: true, grid: [3, 2, 4, 1], flowHeight: "max-xl:h-[200px]" },
  { id: "movers", order: 9, enabled: true, grid: [5, 2, 4, 1], flowHeight: "max-xl:h-[200px]" },
  { id: "breadth", order: 10, enabled: true, grid: [7, 2, 4, 1], flowHeight: "max-xl:h-[180px]" },
  { id: "tv", order: 11, enabled: true, grid: [9, 4, 4, 1], flowHeight: "max-xl:h-[260px]" },
];
