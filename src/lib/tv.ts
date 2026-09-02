// Shared TV channel registry + the live-videoId resolver. YouTube blocks
// the /live scrape from some datacenter IPs (Vercel), so the ingest run
// (home IP / CI) persists resolved ids for the API route to fall back on
// — these are 24×7 news streams, so a daily id stays valid for days.

export const TV_CHANNELS = [
  { id: "cnbc-awaaz", name: "CNBC Awaaz", channelId: "UCQIycDaLsBpMKjOCeaKUYVg" },
  { id: "ndtv-profit", name: "NDTV Profit", channelId: "UCZFMm1mMw0F81Z37aaEzTUA" },
  { id: "india-today", name: "India Today", channelId: "UCYPvAwZP8pZhSMW8qs7cVCw" },
  { id: "aaj-tak", name: "Aaj Tak", channelId: "UCt4t-jeY85JegMlZ-E5UWtA" },
  { id: "abp-news", name: "ABP News", channelId: "UCRWFSbif-RFENbBrSiez1DA" },
] as const;

export interface LiveResolution {
  /** false = the scrape itself failed (blocked/timeout) — keep old data. */
  ok: boolean;
  videoId: string | null;
}

export async function resolveLiveVideoId(channelId: string): Promise<LiveResolution> {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, videoId: null };
    const html = await res.text();
    const canonical = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
    const isLive = html.includes('"isLiveNow":true') || html.includes('"isLive":true');
    return { ok: true, videoId: canonical && isLive ? canonical[1] : null };
  } catch {
    return { ok: false, videoId: null };
  }
}
