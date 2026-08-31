import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { FEEDS } from "../feeds";
import { USER_AGENT, type Fetcher, type IngestEvent, type SourceResult } from "../types";

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: { "#text"?: string } | string;
}

const parser = new XMLParser({ ignoreAttributes: false });

function itemsOf(xml: string): RssItem[] {
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

export const googleNewsFetcher: Fetcher = {
  id: "news-rss",
  staleAfterMin: 6 * 60,

  async fetch(): Promise<SourceResult> {
    const events: IngestEvent[] = [];
    const failures: string[] = [];

    // Feeds fetched sequentially on purpose: gentle on Google News rate limits.
    for (const feed of FEEDS) {
      try {
        const res = await fetch(feed.url, {
          headers: { "user-agent": USER_AGENT },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const item of itemsOf(await res.text())) {
          const title = item.title?.toString().trim();
          if (!title) continue;
          const url = item.link?.toString().trim();
          const ts = item.pubDate ? new Date(item.pubDate) : new Date();
          const source = `gnews:${feed.id}`;
          events.push({
            ts: Number.isNaN(ts.getTime()) ? new Date() : ts,
            source,
            kind: feed.kind,
            title,
            url,
            entities: [],
            payload: { category: feed.category, feedName: feed.name },
            hash: createHash("sha256").update(`${source}|${title}|${url ?? ""}`).digest("hex"),
          });
        }
      } catch (err) {
        failures.push(`${feed.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // All feeds down means the source itself is down; partial failure is normal.
    if (events.length === 0 && failures.length > 0) {
      throw new Error(`all feeds failed — ${failures.join("; ")}`);
    }
    if (failures.length > 0) {
      console.warn(`[news-rss] ${failures.length}/${FEEDS.length} feeds failed: ${failures.join("; ")}`);
    }
    return { events, bars: [] };
  },
};
