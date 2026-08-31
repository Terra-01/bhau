# Bhau — Concept Document

> Named 2026-08-31: **Bhau** — Marathi elder brother / Mumbai boss, and the built-in pun on *bhav* (price): *"Bhav? Poocho Bhau se."* Web-checked clear in [design/naming-exploration.md](design/naming-exploration.md). **"The Floor" lives on as the name of the war room's hero panel — Bhau's trading floor.** Domain deferred to deploy (`bhau.market` and `askbhau.com` available at last check; `bhau.in` taken).

**One-liner:** A public experiment where AI agents read the entire Indian market every day and paper-trade it against the Nifty — and the intelligence war room they trade from is open to everyone.

**Status:** Concept locked · Solo project (AI-assisted) · 2026-08-31

---

## 1. Product thesis: one war room, with the agents as its living proof

One product, one pipeline:

- **The War Room (the product):** one interactive, customizable page — panel grid + map, World Monitor-style — surfacing everything that moves Indian markets: asset/stock prices, clustered news, live TV streams, FII/DII flows, macro, community sentiment, valuation and risk views, trading fundamentals. Every panel is independently toggleable, orderable, and resizable via the config registry; the user composes their own war room.
- **The Floor (the proof and the story):** 3–4 real paper-trading AI agents with distinct strategies and personas, surfaced *inside* the war room as its hero panel — scoreboard, equity trend lines, P&L reports, daily theses. They deliberate daily after close, publish theses *before* outcomes exist, and race each other and the Nifty — demonstrating every day that the war room's information is good enough to trade from. The Floor is also the launch narrative and the content engine: every trading day auto-generates shareable material (evening theses, scoreboard moves, agent disagreements, drawdown drama).

Why this shape survived the roast:

- A dashboard alone has no retention loop and competes with Moneycontrol/TradingView on their turf with slower data. A daily race has a narrative.
- "Can an AI that reads everything beat the Nifty?" is a story people follow and argue about. Utilities churn; stories retain.
- The agents dogfood our own data API every day — a live demo of the long-term asset (India-market context for AI agents).
- Drawdowns are content, not failure. Radical transparency is the brand.

**The one non-negotiable:** the agents are **real**. Real model calls, really reading the real feeds, really logged at real timestamps. "Paper" means *unfunded*, never *scripted*. If it's ever theater, the project is dead the day someone notices.

---

## 2. The agents

Four archetypes (personas/names TBD — see Open Decisions):

| Agent | Mandate | Information diet |
|---|---|---|
| **The Macro Trader** | Top-down. Trades index/sector ETFs off RBI, crude, INR, FII flows, global cues | Macro panels, RBI feed, flows, commodities, global markets |
| **The Momentum Trader** | Trend-following on liquid large caps. Rides breadth, sector rotation, 52-week highs | Price/volume history, sector heatmap, delivery data |
| **The Value Investor** | Slow. Buys quality on bad-news selloffs, holds weeks. Low turnover | Fundamentals, corporate announcements, results calendar, news clusters |
| **The Contrarian** | Fades crowded sentiment. Positions against extremes in the regime index and news euphoria/panic | Regime index, news sentiment, F&O positioning (PCR), mood extremes |

**Shared rules:**

- Paper capital: ₹10,00,000 each. Long-only cash equities + index ETFs (v1; F&O maybe never).
- Universe: Nifty 100 constituents + a whitelist of index/sector ETFs.
- Max 10 open positions; max 20% of book in one name; no averaging down past 2 adds.
- Costs modeled on every fill: brokerage-equivalent + STT + a published slippage assumption.
- Benchmark: **NIFTYBEES NAV** (Nifty 50 ETF, growth — dividends reinvested, so it tracks the Nifty 50 TRI minus ~4bp expenses). Chosen over raw TRI for two honest reasons: TRI is not freely machine-readable (niftyindices.com is walled; NSE's API carries no TRI series), and an ETF NAV is an *investable* benchmark — what buying the index actually returns. The price index alone would flatter the agents by the dividend yield; this is stated on the methodology page.
- One shared "risk officer" rule set (position limits, circuit-breaker halts) enforced in code, outside the LLM.

**Daily rhythm (all times IST):**

1. **~16:30 — Ingest:** EOD pipeline pulls bhavcopy, FII/DII, announcements, news clusters, macro updates into the day's briefing pack.
2. **~17:30 — Deliberation:** each agent gets its briefing pack (filtered to its diet) + current portfolio, and produces: market read, decisions (or explicit "no trade"), and a thesis for each decision.
3. **~18:00 — Publication:** decisions + theses land in the public log, timestamped. This is the shareable "evening edition."
4. **Next day 09:15 — Fills:** orders fill at the opening price (never same-day close — that would be lookahead). Fills posted with costs.
5. **~16:00 — Scoreboard:** marked-to-market on close. P&L race updated, OG images regenerated.

---

## 3. The honesty protocol

The audit-proofness *is* the marketing. Finance Twitter will try to shred this; the methodology page should read like we shredded it first.

- **Append-only decision log.** Every decision row is immutable, timestamped, and hash-chained to the previous row (tamper-evidence anyone can verify). No edits, no deletes, no retroactive anything.
- **Thesis before outcome.** Reasoning is published the evening before the fill. Never backfilled.
- **Honest fills.** Decisions on close data → fills at next open. Delay of underlying data disclosed on every panel.
- **Costs always on.** Published cost model applied to every trade.
- **No cherry-picking.** The scoreboard shows max drawdown, hit rate, and full history — not just the equity curve when it's pretty.
- **Public methodology page** covering all of the above, plus model versions and prompt-change dates (a prompt change is a logged "strategy revision" event).

**Compliance posture (short version):** hypothetical-portfolio disclaimers on every surface, "not investment advice" framing, no paid calls/subscription-for-tips ever, and an index-ETF tilt in the flagship agent. One honest caveat on record: a public feed of named-stock entries can attract SEBI attention regardless of project size if the audience grows — the mitigations above keep the risk posture low, and we revisit if traction makes it real.

---

## 4. The War Room (dashboard v1)

**Panels (v1 — exactly what the agents read, nothing more):**

1. Indices + GIFT Nifty + global cues (delayed/EOD)
2. FII/DII daily flows (the #1 retail ritual)
3. Sector heatmap (EOD)
4. News — markets (clustered, entity-tagged)
5. News — RBI / policy / macro (incl. RBI + SEBI press feeds)
6. Corporate announcements + results calendar
7. USD/INR · Brent · US 10Y strip
8. **India Regime Index** — composite dial (VIX, flows, INR, crude, breadth, event risk) with published formula
9. **The Floor panel (hero)** — agent scoreboard, equity-race trend lines, per-agent P&L reports, latest theses
10. **Live TV** — embedded live streams (CNBC-TV18 / ET Now / NDTV Profit official YouTube channels); cheap to build, high dwell time, proven by World Monitor's webcam/live-news panels

**Panel backlog (v1.1 — needs data work, not launch-gated):**

- **Community sentiment** — retail chatter aggregation (X/Reddit r/IndianStreetBets etc.); source access and noise-filtering are the hard part, scope carefully
- **Valuation screens** — PE/PB vs. own 5-yr median and sector median, earnings yield vs. 10Y. Framed as *transparent screens* ("trades at 34× vs 5-yr median 22×"), never as "overvalued/undervalued" verdicts — labels like that are the closest thing on the page to advice, so the data speaks and the user concludes
- **Company risk cards** — pledged-promoter %, debt/equity, auditor flags, related-party noise, big client concentration
- **Trading fundamentals** — delivery %, 52-week high/low distance, volume spikes, bulk/block deal flags per stock

**Map (v1 — the poster, budgeted like marketing):** India-centric deck.gl + MapLibre with 2–3 layers that are genuinely geospatial: monsoon rainfall departure (IMD), major ports + crude chokepoints, state-level layer (GST/elections) later. Regime index as subtle national mood tint. No globe in v1.

**Customization:** config-driven panel registry (World Monitor's best idea) — every panel declared in one registry with enable/order/size persisted per user (localStorage first, DB when accounts exist). The war room is one *variant*; future variants (commodity-India, macro-India) are just alternate registries.

**Mobile:** the phone surface is the **feed**, not the grid — agent decisions, briefs, scoreboard, regime changes. Grid stays desktop.

---

## 5. Data pipeline (v1 sources — all free)

| Data | Source | Method |
|---|---|---|
| EOD prices/volumes | NSE bhavcopy (+ BSE) | Daily file download |
| Delayed quotes | Yahoo Finance (.NS) | Polled, cached hard |
| FII/DII flows | NSE daily report / NSDL | Daily scrape |
| Corporate announcements | NSE/BSE feeds | Polled |
| Mutual fund NAVs | AMFI | Free feed |
| RBI | Press-release RSS + DBIE | RSS + scheduled pulls |
| Macro calendar (CPI/WPI/IIP/GDP) | MOSPI release calendar | Curated + scraped |
| News | Google News RSS site/topic queries (ET, Moneycontrol, Mint, NDTV Profit, BusinessLine…) + native RSS | RSS proxy + cache |
| Monsoon | IMD rainfall data | Scheduled pull |
| Global (crude, DXY, yields) | Yahoo/FRED | Polled |

Rules learned from World Monitor: every upstream goes through our own proxy/cache layer (Redis) so a million viewers cost the same as one; every source has a freshness monitor; every scraper is assumed to break monthly and is isolated so one failure degrades one panel, not the site.

**The archive is the moat.** From day one, everything ingested is written to Postgres in a normalized event schema: `(timestamp, source, entities[], event_type, payload, market_reaction_refs)`. Twelve months in, we own an event→reaction dataset for Indian markets that nobody can backfill. Live feeds are commodity; the archive compounds.

---

## 6. Architecture

Default stack, boring on purpose:

- **App:** Next.js (App Router) on Vercel — one app, three surfaces (`/` the Floor, `/war-room`, `/m` feed).
- **API layer:** route handlers as proxy + cache in front of every upstream; Upstash Redis for cache + rate limiting.
- **DB:** Postgres (Neon) via Prisma — decision log (append-only, hash-chained), portfolios, event archive, panel configs.
- **Jobs:** Inngest for the daily pipeline (ingest → deliberate → publish → fill → scoreboard) — cron-triggered, step-isolated, retryable. Perfect first real use of it.
- **Agents:** Claude API. One deliberation call per agent per day (+ one synthesis call for the daily brief) — a few dozen calls/day total, negligible cost. Guardrails (position limits, universe checks) in code, not prompts.
- **Map:** deck.gl + MapLibre. **UI:** shadcn/ui; design language in `DESIGN.md` — light "morning broadsheet" system adapted from Dub (deliberately not another dark terminal). **Charts:** lightweight (sparklines + one real chart lib, chosen via `/pick-ui-library` when we get there).
- **Share engine:** OG image generation (Vercel OG) for daily scoreboard + agent theses — every day produces linkable, screenshot-ready cards.
- **Analytics:** PostHog. **Auth:** none in v1 (public read-only); Clerk when customization needs accounts.

---

## 7. Roadmap (solo-realistic; agents accumulate receipts while the war room is built)

**Phase 0 — Pipeline + archive (foundation):** ingestion jobs for the v1 sources, event archive schema, freshness monitoring, regime index v1. *No UI yet.* Exit: a week of clean daily briefing packs.

**Phase 1 — Agent loop, running silently:** the loop headless — deliberation, hash-chained decision log, next-open fills, scoreboard computation. No public UI. It runs daily via Inngest and accumulates the track record *while the war room is being built*. Exit: the loop runs unattended for a week.

**Phase 2 — The War Room (launchable):** panel registry + the ten v1 panels (the Floor hero panel among them), India map with monsoon layer, mobile feed, methodology page, OG cards. Launch with **4–6 weeks of agent receipts already on the books**, via a build-in-public thread. Exit: launched.

**Phase 3 — Compounding:** panel customization (accounts), more layers/panels by demand, public API/MCP endpoint ("plug your own agent into the same feeds"), maybe an open agent leaderboard — other people's agents on our data, which is both moat and community.

**Ruthless cuts (not in v1):** real-time anything, F&O analytics, screeners, portfolios, alerts, 3D globe, desktop app, accounts, monetization.

---

## 8. Risks (post-roast residuals)

| Risk | Mitigation |
|---|---|
| Scrapers rot (NSE especially) | Isolation per source, freshness monitors, degrade-one-panel design; bhavcopy files > HTML scraping wherever possible |
| Google kills News RSS | News backbone abstracted behind our proxy; native RSS fallbacks curated per publication |
| Agents look dumb / lose money publicly | That's content, if the honesty protocol holds. The story is the experiment, not the alpha |
| AI hallucinates causality in briefs | Briefs cite source items inline; correlation-not-causation language enforced in prompt + review |
| SEBI attention at scale | Posture in §3; revisit with a lawyer if traction is real |
| Solo burnout | Phase gates above; the daily loop must run unattended by end of Phase 1 |

---

## Open decisions

1. **Name — resolved: Bhau** (2026-08-31). Persona-name route won over place/time candidates (The Ring, Dalal, Nine-Fifteen); full exploration and web-check in `design/naming-exploration.md`. Bhau doubles as the house character — the host persona who runs the war room and signs the daily brief; the four agents work on *his* floor. Register caution on record: never resemble Hindustani Bhau's tone; the broadsheet design language is the differentiator.
2. **Agent count at launch:** 3 vs 4 (fewer = cheaper narrative to follow; 4 gives better disagreement dynamics). Leaning 4.
3. **Agent personas:** archetype names above vs. characters with voices. Characters are stickier; needs taste to avoid cringe. Decide during Phase 1.
4. **Deliberation transparency:** publish full agent reasoning vs. summaries. Leaning full (on-brand), with prompt-injection-safe rendering.
