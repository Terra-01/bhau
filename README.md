# Bhau — the Indian market war room

**[bhau-one.vercel.app](https://bhau-one.vercel.app)** · one screen, the whole Indian market, and four AI agents proving daily whether any of it is useful.

*Bhau* is a pun on **bhav** — the price. It's a single-viewport market terminal for India: no scrolling, no navigation, every panel visible at once, from a 4K monitor down to a phone (the full 1280×860 composition scales, nothing reflows or hides). The look is a morning broadsheet printed on a pure-black terminal — hairline borders, split-flap panel rotations, and a computed one-line insight pinned to every tile.

## Agents vs Nifty

The hero panel is a daily experiment. Four AI paper-trading agents — **the Momentum Trader, the Value Investor, the Contrarian, and the Macro Trader** — each run ₹10,00,000 of paper capital against the same benchmark (NIFTYBEES), racing since September 1, 2026.

- Decisions are made **after market close** from the day's briefing pack, filled at the next open, and marked to market daily. Never intraday, never a signal.
- Every decision lands on an **append-only, hash-chained ledger** — there are no update or delete paths for ledger rows anywhere in the codebase, and `npm run floor:verify` recomputes the full chain from genesis.
- The scoreboard is the product's honesty test: if the terminal's data can't help even its own agents, that shows on screen.

## The honesty protocol

The footer rotates through it, and the code enforces it:

- **Paper capital only. Not investment advice.**
- **No fabricated data** — when an upstream is unavailable, the tile says so instead of guessing.
- Live quotes refresh ~30s during NSE hours; everything else is labelled with its real cadence (EOD, daily, annual).
- Data sources are named on the board: NSE · Yahoo · RBI · IBJA · ECB · World Bank · Tickertape MMI · Open-Meteo · goodreturns · iTunes.

## What's on the board

| Panel | What it shows |
|---|---|
| **Watchlist** | Editable list (20 defaults incl. NIFTY/SENSEX), live quotes, hero chart that auto-tours the list — 1D minute prints during the session, 1M/3M/1Y daily |
| **Stocks & ETFs** | Most traded / gainers / losers (live during the session) and the ETF turnover leaders |
| **Agents vs Nifty** | The race chart, standings, and each agent's current thesis |
| **Intelligence** | LLM desk synthesis of the day's briefing pack + a fresh news wire |
| **India rates & macro** | G-sec curve with spreads, repo/CRR/SLR, World Bank macro, and the MMI fear/greed spectrum |
| **City pulse** | Metro pump prices (state taxes make fuel genuinely city-level), IBJA bullion fix, weather |
| **Forex vs INR** | Major crosses with 30-day sparklines |
| **Calendar** | Earnings, IPOs, and data releases as flat dated rows |
| **Commodities** | Gold, silver, crude, and friends — live futures during the session |
| **Live TV** | Indian business news streams, paused-by-default facade, always joins the live edge |

Every instrument on the board is clickable — a details card with an embedded chart, 52-week range, and fundamentals.

## How it works

```
ingest (nightly, GitHub Actions) ──► Postgres archive (Event · DailyBar · BriefingPack)
                                          │
agents (nightly, after ingest)  ──► LedgerEntry (append-only, hash-chained)
                                          │
Next.js ISR page + live API routes ◄──────┘
   └─ /api/live/* · /api/quotes · /api/history — NSE-direct with Yahoo
      fallback, phase-aware polling (30s open / 5min closed), EOD archive
      as the floor when both are unreachable
```

- **Ingestion isolation**: every upstream is one `Fetcher` in `src/ingest/sources/` — a fetcher may fail loudly but never takes down the run. The archive is the moat; nothing is fire-and-forget.
- **"Latest available" semantics**: the page must render at any hour from whatever the archive holds.
- The market clock (`src/lib/market-clock.ts`) drives everything phase-aware: pre-open, session, closing auction, closed, holidays.

## Stack

Next.js (App Router, Turbopack) · TypeScript · Tailwind v4 · Prisma 7 → Neon Postgres · [lightweight-charts](https://github.com/tradingview/lightweight-charts) (TradingView, Apache-2.0) · motion.dev · Base UI · OpenAI structured outputs for agent deliberation · Vercel.

## Running it

```bash
npm install
cp .env.example .env.local   # DATABASE_URL (Neon) + OPENAI_KEY — both optional to start
npx prisma migrate dev       # apply the schema (needs DATABASE_URL)
npm run ingest               # fill the archive (-- --dry-run works with no DB at all)
npm run dev                  # http://localhost:3000
```

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run ingest` | run all fetchers, persist to Postgres (`-- --dry-run` writes `data/briefing-<date>.json` instead) |
| `npm run floor` | the daily agent loop: fills → mark-to-market → deliberation (`FLOOR_MOCK=1` tests the pipeline without model calls) |
| `npm run floor:verify` | recompute the ledger's hash chain from genesis |
| `npm run typecheck` / `lint` / `test` | the usual gates |

The nightly loop runs on GitHub Actions (`.github/workflows/daily-ingest.yml`) on weekday evenings IST: ingest → agents → chain verification.

## Repo map

```
src/app/            the terminal (one page) + API routes (live, quotes, history, company, tv, health)
src/ingest/         fetchers, briefing-pack builder, LLM synthesis, the nightly run
src/agents/         the daily agent loop + ledger verification
src/lib/            data assembly (warroom/exchange/rates), market clock, NSE client, chart theming
src/components/     the tiles, the motion system, the popover/details layer
prisma/             schema + migrations (Neon Postgres)
CONCEPT.md          product thesis — scope's source of truth
DESIGN.md           the design language (broadsheet identity, dark default, token system)
AGENTS.md           context file for AI coding agents working on this repo
```

## Disclaimers

Bhau trades **paper capital only** and is **not investment advice**. It is not affiliated with NSE, BSE, or any data provider named above; quotes can lag and upstreams can fail — the board says so when they do. Charting by TradingView's Lightweight Charts under Apache-2.0.

Licensed under [MIT](LICENSE).
