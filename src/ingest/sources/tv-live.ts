import { resolveLiveVideoId, TV_CHANNELS } from "@/lib/tv";
import type { Fetcher, SourceResult } from "../types";

// Resolves each channel's current live videoId from wherever ingest runs
// (home IP or CI — hosts YouTube doesn't block). run.ts persists them to
// TvStream; the /api/tv route falls back to those rows on Vercel, where
// the scrape is blocked. A failed scrape keeps the previous id.

export const tvLiveFetcher: Fetcher = {
  id: "tv-live",
  staleAfterMin: 48 * 60,

  async fetch(): Promise<SourceResult> {
    const tvStreams: NonNullable<SourceResult["tvStreams"]> = [];
    for (const channel of TV_CHANNELS) {
      const res = await resolveLiveVideoId(channel.channelId);
      if (res.ok) tvStreams.push({ channelId: channel.channelId, videoId: res.videoId });
    }
    if (tvStreams.length === 0) throw new Error("all channel scrapes failed — host likely blocked");
    return { events: [], bars: [], tvStreams };
  },
};
