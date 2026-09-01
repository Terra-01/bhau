import { NextResponse } from "next/server";

// Resolve a channel's CURRENT live video id. The youtube.com/embed/
// live_stream?channel= endpoint is unreliable ("video unavailable" even
// mid-broadcast), so we read the channel's /live page server-side and
// hand the client a direct watch id instead.
const cache = new Map<string, { at: number; body: { videoId: string | null } }>();
const TTL_MS = 10 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId: raw } = await params;
  const channelId = raw.replace(/[^A-Za-z0-9_-]/g, "");
  if (!channelId.startsWith("UC")) return NextResponse.json({ error: "bad channel" }, { status: 400 });

  const cached = cache.get(channelId);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.body);

  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const html = await res.text();
    // A live broadcast page carries a canonical watch URL + isLiveNow.
    const canonical = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
    const isLive = html.includes('"isLiveNow":true') || html.includes('"isLive":true');
    const body = { videoId: canonical && isLive ? canonical[1] : null };
    cache.set(channelId, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=600" } });
  } catch {
    return NextResponse.json({ videoId: null }, { status: 200 });
  }
}
