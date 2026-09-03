# Floor activation plan — waking the agents up

**Status: BUILT (2026-09-03).** The diagnosis (2026-09-03): the loop is healthy — 11 of 12
deliberations were genuine `NO_TRADE`s because (a) the mandates demand evidence the pack
doesn't contain (momentum needs per-stock prices, value needs drawdowns; the pack ships
only index/macro closes + headlines), (b) the prompt makes cash-sitting free ("'No trade'
is… often correct", no deployment posture), and (c) GitHub's cron fires 3–6h late, so the
mark lags the market. Macro — the one persona whose evidence *is* in the pack — is the one
agent that traded. This plan fixes the evidence, the posture, the cadence, and makes the
record visible.

## 1. Quant sheet in the briefing pack

**Backfill first** (`src/ingest/backfill.ts`, one-time, rerunnable): the equity archive is
4 days deep (bhavcopy since 2026-08-28) — 20d/60d/52w math needs history. Pull ~400
calendar days of daily bars from Yahoo for NIFTY100 + ETF_WHITELIST (105 symbols),
`createMany({ skipDuplicates: true })` so existing bhavcopy rows are never overwritten
(PK is `(date, symbol)`). Per-symbol failures log and skip (fetcher spirit — new listings
may not resolve). Rerun after quarterly universe refreshes.

**Pack field** `quant` (built by `src/ingest/quant.ts`, wired in `src/ingest/run.ts` when
`DATABASE_URL` is present; dry-run packs omit it):

```
quant: {
  asOf, historyDays,          // honesty: how deep the window really is
  rows: [{ symbol, sector, close,
           r1, r5, r20, r60,           // % returns over 1/5/20/60 sessions (where history allows)
           from52wHigh, from52wLow,    // % distance from window high/low (≤260 sessions)
           rs20 }]                     // r20 minus ^NSEI r20 — relative strength
}
```

History query: `DailyBar` closes for universe + `^NSEI`, last 450 days, merged with the
run's own fetched bars (today's bhavcopy isn't persisted when the pack builds). All
personas receive `quant` — the diet filters news, not market data.

## 2. Posture recalibration (published methodology v1.1)

`src/agents/personas.ts`:
- The "'No trade' is always available and often correct" line becomes: cash is a position
  you must defend; you're judged against the Nifty; a pass must publish the specific
  falsifiable trigger that would put you in the market.
- Each mandate gains a deployment doctrine: macro targets 40–80% deployed via ETFs in a
  normal regime; momentum hunts names within ~5% of 52w highs with positive rs20 and is
  expected to engage when several qualify; value shortlists 15%+ drawdowns with
  recoverable news and names its entry number; contrarian may hold cash only while
  publishing the numeric extreme it awaits.
- New prompt line describing the quant sheet: price evidence beats narrative.

`src/agents/deliberate.ts`: schema gains `noTradeTrigger` (nullable) — persisted on
NO_TRADE ledger payloads as `trigger`, rendered in the UI. Mandate text is published
methodology: the change is versioned in CONCEPT/AGENTS notes, not silently tweaked.

## 4. Cadence

- Third cron `47 17 * * 1-5` (23:17 IST) in `daily-ingest.yml` as the safety net — the
  floor is idempotent (per-day deliberation guard, fill dedupe via `decisionHash`,
  snapshot upserts), so a redundant run no-ops.
- The tile stops looking frozen: when the marked date is behind today (IST), the insight
  line says today's mark lands this evening (crons 17:17 / 19:47 / 23:17 IST, observed
  jitter up to ~6h).

## 5. Activity + the public record

`src/lib/warroom.ts` floor payload gains:
- `agents`: each agent's current book from `AgentState` (cash + positions with qty/avg).
- `log`: **every FILL ever** (the actual trades — rare by design) + the last 40
  DECISION/NOTE entries, so the full trade record ships to the page while decisions stay
  capped. Revisit the cap when the ledger is months long.

`src/components/tiles/floor-tile.tsx`:
- Standings rows get a latest-action chip (BUY sym alloc% / SELL / NO TRADE / REJECTED).
- The row popover becomes the agent's record: header (equity/return) → book line (cash +
  positions) → scrollable ledger (decisions with thesis + "waiting for:" trigger, fills as
  `qty @ price · costs`, notes), newest first.
- Insight line reports today's decisions ("4× no trade" / "Macro bought NIFTYBEES") and
  the pending-mark hint.

## Rollout order

plan doc → backfill script → quant module → briefing/run wiring → personas/deliberate →
warroom → floor tile → workflow cron → docs → tests (`npm test`, `FLOOR_MOCK` dry-run,
ingest dry-run) → run backfill against prod → browser verify → review → land main →
deploy. Tonight's run (from main) is the first with the new methodology; if the scheduler
skips again: `gh workflow run daily-ingest.yml --ref main`.
