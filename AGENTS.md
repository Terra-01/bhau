# Bhau — Agent Context

**Bhau** (pun on *bhav*, the price): a customizable India-market intelligence war room whose AI paper-trading agents prove its usefulness daily. "The Floor" is the war room's hero panel — Bhau's trading floor. Read these before touching anything:

- **[CONCEPT.md](CONCEPT.md)** — what we're building and why (product thesis, agents, honesty protocol, data pipeline, roadmap). Source of truth for scope.
- **[DESIGN.md](DESIGN.md)** — design language: light "morning broadsheet" default (Dub base in `design/dub-reference.md` + market/agent extensions) with a designed dark variant behind the header toggle (`[data-theme="dark"]` token overrides in `globals.css`). No per-component color inventions.

## Status

**Phase 2 in progress** (war room UI). `/` is a single-viewport terminal (desktop-first, the document never scrolls at xl; each tile owns its overflow): three column stacks composed directly in `src/app/page.tsx` with `minmax(0,·fr)` grid columns and `min-h-0` flex fractions. Data assembly: `src/lib/warroom.ts` + `src/lib/exchange.ts` + `src/lib/rates.ts` ("latest available" semantics — must render at any hour). Panels: watchlist (localStorage, 10 defaults; hero chart on TradingView's lightweight-charts, Apache-2.0; quotes via `/api/quotes` — Yahoo live batch, bhavcopy fallback — refreshed each minute; the chart auto-tours the list), India rates & macro (G-sec yield table + spreads + economy rows, TradingView table grammar), off the tape, stocks (most traded/gainers/losers + ETF section) in center with **the Floor** below it (hero, center column), intelligence (desk synthesis from `src/ingest/synthesize.ts`, needs OPENAI_KEY; wire refreshed at request time from the same RSS feeds, 15-min cache, pack fallback), right rail: city pulse (fuel incl. Pune / IBJA metals ⇄ weather) · forex vs INR (30d sparklines) · compact calendar (flat dated rows) · commodities · live TV (paused-by-default facade; chrome-less pointer-events-none embed always joins the live edge). Tabbed panels auto-rotate on staggered intervals via `src/lib/use-carousel.ts` (hover/hidden-tab/manual-hold aware); every data tile carries a computed one-line `InsightLine` (`src/components/insight-line.tsx`). **Live layer** (design/realtime-plan.md, built): `src/lib/market-clock.ts` + `src/lib/nse-live.ts` + `/api/live/{market,movers,health}` — NSE-direct with Yahoo fallback, 25s shared server caches, clients poll via `src/lib/use-live.ts` on a phase-aware cadence; `LiveChip` labels what's live; header `LiveTicker`; intraday stocks lists during the session; 1D minute chart via `/api/history/[symbol]?range=1d`. The Floor stays EOD by design. Charts are vendored bklit-ui components (`src/components/charts/`, lint-ignored; visx + motion) plus small custom SVGs. Still to come (Phase 2b): `/m` mobile feed, panel customization UI, methodology page, OG cards.

**Phase 1** (agent loop, headless — running nightly). The daily loop in `src/agents/` runs after ingest: fill yesterday's decisions at today's open → mark to market → deliberate for tomorrow (OpenAI Responses API, structured outputs, `gpt-5.6-luna`; the provider is isolated to `src/agents/deliberate.ts`, key in `OPENAI_KEY`). Everything lands on the append-only hash-chained ledger (`LedgerEntry`) — **there are no update/delete paths for ledger rows anywhere, ever**. No UI yet. Exit criterion: the loop runs unattended for a week.

## Stack

Next.js (App Router, Turbopack) · TypeScript · Tailwind v4 (tokens in `src/app/globals.css`) · Prisma 7 (`prisma-client` generator → `src/generated/prisma`, driver adapter `@prisma/adapter-pg`) → Neon Postgres · Inngest planned for the daily loop (plain scripts until deploy).

## Commands

```bash
npm run dev            # Next.js dev server
npm run typecheck      # tsc --noEmit (run prisma generate first on fresh clones)
npm run lint
npm run ingest -- --dry-run   # run all fetchers, no DB; writes data/briefing-<date>.json
npm run ingest         # same, persisting to Postgres (needs DATABASE_URL)
npm run floor          # daily agent loop: fills → MTM → deliberation (needs OPENAI_KEY)
npm run floor -- --dry-run    # compute everything, persist nothing
FLOOR_MOCK=1 npm run floor    # pipeline test without model calls (forces dry-run)
npm run floor:verify   # recompute the full hash chain from genesis
npx prisma generate    # regenerate client after schema changes
npx prisma migrate dev # apply schema to the database (needs DATABASE_URL in .env.local)
```

## Conventions

- Work on `dev`, never `main`. Conventional commit messages.
- **Ingestion isolation**: every upstream is one `Fetcher` in `src/ingest/sources/`; a fetcher may fail loudly but must never take down the run. Register new sources in `src/ingest/run.ts` and give them a `staleAfterMin`. Current scraped sources beyond the APIs: RBI homepage (`rbi-rates` — G-sec curve, T-bill cut-offs, policy corridor), IBJA (`ibja` — national bullion fixes, ₹/10g and ₹/kg), goodreturns (`fuel-city` — metro petrol/diesel). All may be blocked from datacenter IPs — like FRED, they degrade alone if CI can't reach them.
- **The archive is the moat**: everything ingested lands in Postgres normalized (`Event`, `DailyBar`). Never make ingestion fire-and-forget.
- The regime formula (`src/lib/regime.ts`) is public-facing — any change to weights or mappings is a documented, versioned decision, not a tweak.
- Phase 1 will add the agent decision log: **append-only, hash-chained; no update/delete paths, ever** (CONCEPT.md §3).
- No per-project CLAUDE.md — this file is the project context.
