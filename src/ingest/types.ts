export type EventKind = "news" | "announcement" | "macro" | "policy" | "calendar";

export interface IngestEvent {
  ts: Date;
  source: string;
  kind: EventKind;
  title: string;
  url?: string;
  entities: string[];
  payload?: Record<string, unknown>;
  hash: string;
}

export interface IngestBar {
  date: string; // YYYY-MM-DD in Asia/Kolkata
  symbol: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  turnover?: number; // traded value ₹
  source: string;
}

export interface IngestFlow {
  date: string; // YYYY-MM-DD
  category: string; // FII/FPI | DII
  buy: number;
  sell: number;
  net: number;
}

export interface SourceResult {
  events: IngestEvent[];
  bars: IngestBar[];
  flows?: IngestFlow[];
  /** Live TV videoIds resolved from a non-blocked host (see tv-live). */
  tvStreams?: Array<{ channelId: string; videoId: string | null }>;
}

/**
 * One fetcher per upstream. Fetchers are isolated by the runner: a throw
 * here marks this source unhealthy and degrades one panel — it never
 * takes down the run (CONCEPT.md §5).
 */
export interface Fetcher {
  id: string;
  staleAfterMin: number;
  fetch(): Promise<SourceResult>;
}

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
