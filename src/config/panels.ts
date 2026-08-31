// The war room panel registry (CONCEPT.md §4): config-driven composition —
// World Monitor's best idea. Rendering maps ids to components in
// src/app/page.tsx; per-user toggling/reordering persists on top of these
// defaults when customization lands (Phase 2b).
export interface PanelDef {
  id: string;
  order: number;
  enabled: boolean;
  /** Grid columns to span on xl screens (grid is 3 wide). */
  span: 1 | 2 | 3;
}

export const WAR_ROOM_PANELS: PanelDef[] = [
  { id: "floor", order: 1, enabled: true, span: 2 },
  { id: "regime", order: 2, enabled: true, span: 1 },
  { id: "flows", order: 3, enabled: true, span: 1 },
  { id: "sectors", order: 4, enabled: true, span: 1 },
  { id: "tv", order: 5, enabled: true, span: 1 },
  { id: "news-markets", order: 6, enabled: true, span: 1 },
  { id: "news-policy", order: 7, enabled: true, span: 1 },
  { id: "news-corporate", order: 8, enabled: true, span: 1 },
];
