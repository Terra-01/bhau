import { resolveLiveVideoId, TV_CHANNELS } from "@/lib/tv";
import type { Fetcher, SourceResult } from "../types";

// Resolves each channel's current live videoId from wherever ingest runs
// (home IP or CI — hosts YouTube doesn't block). run.ts persists them to
// TvStream; the /api/tv route falls back to those rows on Vercel, where
// the scrape is blocked. Only real ids are persisted: a consent/bot
// interstitial is HTTP 200 with no canonical (ok:true, videoId:null), and
// writing that null would wipe the very fallback row the route needs —
// so a blocked or off-air scrape keeps the previous id (48h TTL-guarded).

export const tvLiveFetcher: Fetcher = {
  id: "tv-live",
  staleAfterMin: 48 * 60,

  async fetch(): Promise<SourceResult> {
    const results = await Promise.all(
      TV_CHANNELS.map(async (channel) => ({ channel, res: await resolveLiveVideoId(channel.channelId) })),
    );
    const tvStreams: NonNullable<SourceResult["tvStreams"]> = results
      .filter(({ res }) => res.ok && res.videoId)
      .map(({ channel, res }) => ({ channelId: channel.channelId, videoId: res.videoId }));
    if (tvStreams.length === 0) throw new Error("no channel resolved a live id — host likely blocked");
    return { events: [], bars: [], tvStreams };
  },
};
