# The Floor v2 — the pack is the terminal, the agents are people

**Status: PLANNED (2026-09-03).** Direction agreed: no reset (the ledger and equity
curves continue; v2.0 lands as logged strategy-revision NOTEs, like v1.1), no model
diversity (gpt-5.6-luna for all four; personality lives in the prompt layer), no chassis
rebuild (ledger, rulebook, fills, cost model, universe are untouched). What changes:
**what the agents see** and **who the agents are**.

## Principle

The war room already curates everything an educated decision needs — news, flows, rates,
mood, commodities, forex, breadth, the street. The agents get almost none of it (v1.1
fixed prices; flows, the curve, MMI, sectors, the calendar are still invisible to them).
v2's rule: **every tile on the board becomes a section of the briefing pack.** What the
agents deliberate on is exactly what the reader sees — same evidence, timestamped, which
makes the transparency story literal. Curated aggregates, never raw dumps: the pack stays
~30KB (≈8K tokens) per deliberation.

## 1. Pack v2 — new sections (all from data we already have)

| Section | Content | Source |
|---|---|---|
| `flows` | FII + DII last 5 sessions (buy/sell/net) + the running streak | `FlowDaily` (in the DB today, never given to agents — the biggest gap) |
| `rates` | G-sec curve (3M–30Y), 10Y−repo / 10Y−1Y spreads, repo/CRR/SLR, 1-week curve change | same `DailyBar` rows `src/lib/rates.ts` reads — extract shared assembly so page and pack use one code path |
| `mood` | MMI value, zone, 1-day delta | **new `mmi` fetcher** (see §4 — also fixes the standing "MMI fetched outside the Fetcher pattern" finding) |
| `commodities` | gold/silver/copper/crude/natgas close + 1d + 5d | archive bars (yahoo-markets) |
| `forex` | INR crosses, 1d + 5d | archive bars (frankfurter/yahoo) |
| `breadth` | % advancers + 5-day trend, sector 1d heat leaders/laggards | `^BREADTH` bars + the sector computation in `src/lib/exchange.ts` (extract shared helper) |
| `street` | metro fuel avg + w/w change, IBJA gold/silver fix + d/d, `monsoonWatch` (rain likely in N of 7 metros) | goodreturns/ibja bars; weather fetched fresh at ingest via the existing helper (ephemeral context — explicitly exempt from the archive rule, noted in code) |
| `calendar` | next 5 sessions: earnings, IPOs, data releases | `Event` kind `calendar` (currently *excluded* from the pack) |
| `synthesis` | the desk's own evening read | already in the pack; v1 withheld it from deliberation — v2 includes it for everyone |

Prompt framing per section matters: fuel/weather are labelled slow, weak signals
(FMCG/agri/OMC channel), not trading triggers.

## 2. Personas v2 — voice + evidence hierarchy, same agentIds

Ledger continuity means `macro/momentum/value/contrarian` stay the agentIds. Each persona
gains (all public, all AI-fiction, labelled as such):

- **name + bio + voice** — a one-line backstory and explicit style directives so theses
  *sound* like a person. Draft for veto: **Meera Iyer** (macro — ex-rates desk, thinks in
  bps, measured), **Arjun Mehta** (momentum — tape-first, terse, all levels), **Vikram
  Rao** (value — annual-report romantic, margin-of-safety arithmetic in every thesis),
  **Kavya Nair** (contrarian — dry, quotes the consensus in order to disagree with it).
- **evidence hierarchy** — `diet` evolves from news-categories to an ordered section list
  with primary/secondary tiers. Serialization order = attention order: macro opens with
  rates+flows+forex, momentum with quant+breadth+sectors, value with quant
  drawdowns+corporate news+calendar, contrarian with mood+breadth+`colleagues`.
- **`colleagues`** (contrarian only): the other three agents' latest theses and books —
  the house view exists so someone can fade it.
- **`mirror`** (everyone, built per-agent in `agents/run.ts`, not the shared pack):
  positions with P&L vs cost and days held, equity vs benchmark gap, drawdown from peak,
  days since last fill, own open theses + invalidation status. Self-awareness is half of
  an educated decision.

Personality never touches risk: the rulebook remains the code-enforced risk officer.

## 3. Loop upgrades — accountability and life on quiet days

- **Structured invalidation** (BUY only): `invalidation: { level, direction }` in the
  decision schema — a machine-checkable tripwire, published with the thesis. The floor
  checks closes against open tripwires daily; a breach lands in that agent's `mirror`
  flagged INVALIDATION BREACHED, and the prompt requires the next thesis to address it.
- **Daily watchlist**: every decision (including NO_TRADE) may carry up to 3
  `{ symbol, trigger }` watch entries — "what I'd buy and the number that makes me do
  it." A pass becomes a testable prediction; stored inside the DECISION payload (no new
  ledger kinds), rendered in the record card ("Watching: TITAN > ₹3,900").
- **Weekly letter**: on the last trading day of the week, one extra model call per agent
  writes a short public review of its week → ledger NOTE, rendered in the record card.
  Four calls a week; the content flywheel.
- **`promptVersion` on every decision payload** ("2.0") — the review flagged personas as
  the one unversioned piece of published methodology; this stamps every row with the
  prompt generation that produced it, and a test locks the version constant to the
  mandate text (change one without the other → red).
- **v2.0 strategy-revision NOTEs** on the chain at deploy, one per agent, same as v1.1.

## 4. Housekeeping the plan absorbs

- **`mmi` fetcher** (`src/ingest/sources/mmi.ts`): Tickertape MMI → `DailyBar`
  (`^MMI`), registered in `run.ts` with `staleAfterMin`; `src/lib/rates.ts` reads
  archive-first with live fallback. Clears the standing conventions finding *and* starts
  archiving mood history (chartable later).
- **Shared assembly extraction**: flows+streak, sector heat, rates curve move from
  page-only code into helpers both `warroom/exchange/rates` and the pack builder call —
  one code path per fact, per the reuse rulings.

## 5. UI (small — the record card already exists)

Record card header gains the persona name + one-line bio; watchlist chips and weekly
letters render as entry types in the existing ledger list; the standings rows are
unchanged. Tile footprint identical.

## 6. Sequencing

- **A — evidence**: `mmi` fetcher · shared extractions · pack v2 sections + types +
  fixture tests (pack builder is pure — testable like `buildQuant`).
- **B — personas & loop**: personas v2 (names/voice/hierarchy) · deliberate v2 (section
  ordering, `mirror`, `colleagues`, schema: invalidation + watchlist, `promptVersion`) ·
  floor tripwire check + weekly letter · v2.0 chain NOTEs.
- **C — surface & docs**: record-card persona header, watchlist/letter rendering ·
  CONCEPT/AGENTS/README methodology notes (v2.0 dated, prompt-change logged).
- **D — verify & land**: tests + `FLOOR_MOCK` pipeline + browser pass → review → dev →
  main → deploy, ahead of an evening run so v2's first deliberation is a real one.

Est. one working session. Decisions already made and honored here: no reset, one model,
no chassis changes. Open for veto before build: the four persona names/bios (§2).
