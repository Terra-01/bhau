# Real-time NSE plan (approved direction, pre-build)

> Decided 2026-09-01 with Terra: **NSE-direct + Yahoo fallback · ~30s cadence · live scope = strip/indices + watchlist + intraday stocks lists + commodities/forex · watchlist gains a 1D intraday tab.** The Floor (agents vs Nifty) stays EOD by design. Everything below is planning; nothing here is built yet.

## Empirical findings (2026-09-01, during market hours)

| Probe | Result |
| --- | --- |
| NSE `allIndices` from home IP | Real-time to the minute (NIFTY 23,967.55 @ 14:43 vs wall clock 14:43:16) |
| NSE `quote-equity?symbol=` | **403 even from home IP** — per-symbol endpoint is aggressively protected; never build on it |
| NSE `live-analysis-variations?index=gainers` | Works — intraday gainers/losers per index bucket + `allSec` |
| NSE from GitHub Actions (Azure datacenter) | Worked last night (`[nse-indices] ok` in CI log) — datacenter access is possible but never guaranteed |
| Yahoo NSE feed (yahoo-finance2 `quote`) | Prints 1–5s old ("Free Realtime Quote", 14:44:02 print delivered 14:44:07); reliable from cloud IPs. Metadata still says `exchangeDataDelayedBy: 15` — label Yahoo-sourced values `YAHOO · LIVE`, methodology page carries the nuance |
| Vercel egress → NSE | **Unknown until a probe deploy** — the fallback ladder makes either outcome safe |

Honesty note: real-time redistribution of NSE data without a data license sits outside NSE's terms of use. Personal-project risk posture, consistent with prior decisions (disclaimers, paper capital); recorded here so the decision is on the books.

## Architecture

- **The live layer is an enhancement over today's EOD render.** Pages stay server-rendered from Postgres exactly as now; a client hook hydrates live numbers over them. Any failure degrades to what exists today, with an honest chip. The ingest/agents pipeline is untouched.
- **Browsers never talk to NSE.** They poll our route handlers; each handler holds one shared upstream fetch per ~25s (module cache + `s-maxage=25, stale-while-revalidate` headers), so a thousand viewers cost the same as one.
- **Fallback ladder per endpoint:** NSE → Yahoo → last-good payload (STALE chip) → EOD render.

### Market clock — `src/lib/market-clock.ts`
States: `preopen` 09:00–09:15 IST · `open` 09:15–15:30 · `closing` 15:30–16:00 (prints settle) · `closed` (nights/weekends/holidays). Holidays from NSE `/api/holiday-master?type=trading` (cache daily; weekday-only fallback if unreachable). The clock decides: whether clients poll, which chip shows (LIVE pulsing / PRE-OPEN / CLOSING / CLOSED · as-of), and which stocks-list source is active. State computed from server time in payloads, not the client clock.

### Endpoints (route handlers)
1. `/api/live/indices` — NSE `allIndices` (strip + indices + breadth from advances/declines in one call). Fallback: Yahoo batch (`^NSEI ^NSEBANK ^BSESN ^INDIAVIX`).
2. `/api/live/quotes?symbols=` — NIFTY-100 names from one NSE `equity-stockIndices?index=NIFTY 100` batch; every other symbol via one Yahoo batch call. Merged, per-symbol source tags. (No NSE per-symbol calls, ever — see 403 above.)
3. `/api/live/movers` — NSE `live-analysis-variations` gainers/losers + most-active (exact most-active endpoint shape to verify at build time). No Yahoo equivalent → fallback is the EOD bhavcopy lists with their existing chip.
4. `/api/live/commodities-forex` — Yahoo batch (GC=F SI=F HG=F CL=F NG=F BZ=F INR=X + INR crosses; verify `EURINR=X`-style symbols, else compute crosses from USD legs). These were never NSE data; cadence 60s, polled whenever the tab is visible (these markets run ~24h).
5. `/api/live/chart/[symbol]` — 1D minute series via Yahoo `chart()` (interval 1m/2m; NSE's intraday chart API is fragile). Cache 60s.

NSE client (`src/lib/nse-live.ts`): warm-up cookie jar reused per serverless instance, one retry, then throw → caller falls through the ladder.

### Client
`useLive(endpoint)` hook: poll every ~30s only while market state is preopen/open/closing **and** the tab is visible; one fetch on load when closed. Values update in place (no layout shift); tile metas gain freshness chips: `LIVE · NSE · 14:43` / `LIVE · YAHOO` / `STALE` / `EOD · 31 AUG`.

### Panel map
| Panel | Live behaviour | Stays EOD |
| --- | --- | --- |
| Header strip | indices/breadth live | US10Y (FRED) |
| Watchlist | LTP + day% live; **1D tab** on the lightweight-chart during session | 1M/3M/1Y timeframes |
| Stocks | tabs read live movers during hours, bhavcopy full-universe after close (chip states which) ; ETF LTPs via Yahoo | ETF turnover ranking |
| Commodities / Forex | LTPs live via Yahoo | forex 30d ECB spark + 1M insight |
| City pulse, Rates & macro, Calendar, Intelligence, Off the tape | — | daily by nature |
| **The Floor** | — | **EOD forever (user decision)** |

### Edge cases
1. **Pre-open** auction prices flap → show with PRE-OPEN chip (verify allIndices carries them; else treat as closed until 09:15).
2. **Closing settle**: 15:30 LTP ≠ official close → CLOSING chip; the 17:00 ingest upserts the official close, reconciling history.
3. **Live vs EOD stitching**: the 1D chart's last point and the quote row must share one source per symbol; daily tabs keep DailyBar data; divergence is labeled, not hidden.
4. **NSE ban mid-session**: source tag flips to YAHOO seamlessly; both dead → last-good + STALE.
5. **Non-NIFTY100 watchlist adds** ride the Yahoo path automatically; dead symbols keep the existing "no data" state.
6. **Hidden tab** pauses polling; **holidays** never poll.
7. **Deploy reality**: ship `/api/live/health` first — it reports which upstreams the Vercel host can actually reach, so day one tells us the truth.

### Build order (each step shippable, EOD always the floor)
1. market-clock + holiday cache + freshness-chip component
2. NSE live client + `/api/live/indices` → strip/indices live
3. `/api/live/quotes` → watchlist live
4. `/api/live/movers` → stocks switching
5. Yahoo commodities/forex live
6. 1D intraday chart tab
7. Probe deploy + tune cadence/caching
