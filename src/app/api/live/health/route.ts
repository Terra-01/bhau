import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/db";
import { currentPhase, nseJson } from "@/lib/nse-live";

// Deploy-day truth serum: which live upstreams can THIS host actually
// reach? (The plan's open question — NSE may block cloud egress.)

export const dynamic = "force-dynamic";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.body);
  const [nse, yahoo, db, phase] = await Promise.all([
    nseJson<{ timestamp?: string }>("/api/allIndices").then(
      (d) => ({ ok: true as const, asOf: d.timestamp }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
    ),
    yf.quote("^NSEI").then(
      (q) => ({ ok: true as const, asOf: q.regularMarketTime?.toISOString() }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
    ),
    prisma.briefingPack.count().then(
      (packs) => ({ ok: true as const, packs }),
      (e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 220) : String(e),
        // host only — never credentials; tells us what URL the runtime saw
        host: (() => {
          try {
            return new URL(process.env.DATABASE_URL ?? "").host || "(unparseable)";
          } catch {
            return `(invalid url, len ${process.env.DATABASE_URL?.length ?? 0})`;
          }
        })(),
      }),
    ),
    currentPhase(),
  ]);
  const body = { phase, nse, yahoo, db, at: new Date().toISOString() };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
