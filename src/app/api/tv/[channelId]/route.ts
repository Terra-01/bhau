import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveLiveVideoId } from "@/lib/tv";

// Resolve a channel's CURRENT live video id. Primary: scrape the
// channel's /live page (works from residential IPs; YouTube blocks it
// from some datacenters, Vercel included). Fallback: the id the ingest
// run persisted from a non-blocked host — these 24×7 news streams keep
// one id for days, so a daily resolution stays playable.
const cache = new Map<string, { at: number; body: { videoId: string | null; source?: string } }>();
const TTL_MS = 10 * 60 * 1000;
const DB_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId: raw } = await params;
  const channelId = raw.replace(/[^A-Za-z0-9_-]/g, "");
  if (!channelId.startsWith("UC")) return NextResponse.json({ error: "bad channel" }, { status: 400 });

  const cached = cache.get(channelId);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.body);

  const live = await resolveLiveVideoId(channelId);
  let body: { videoId: string | null; source?: string };
  if (live.ok) {
    body = { videoId: live.videoId, source: "live" };
  } else {
    try {
      const row = await prisma.tvStream.findUnique({ where: { channelId } });
      body =
        row && row.videoId && Date.now() - row.checkedAt.getTime() < DB_MAX_AGE_MS
          ? { videoId: row.videoId, source: "ingest" }
          : { videoId: null };
    } catch {
      body = { videoId: null };
    }
  }
  cache.set(channelId, { at: Date.now(), body });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=600" } });
}
