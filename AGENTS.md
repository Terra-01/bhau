# Bhau — Agent Context

**Bhau** (pun on *bhav*, the price): a customizable India-market intelligence war room whose AI paper-trading agents prove its usefulness daily. "The Floor" is the war room's hero panel — Bhau's trading floor. Read these before touching anything:

- **[CONCEPT.md](CONCEPT.md)** — what we're building and why (product thesis, agents, honesty protocol, data pipeline, roadmap). Source of truth for scope.
- **[DESIGN.md](DESIGN.md)** — design language: light-only "morning broadsheet" (Dub base in `design/dub-reference.md` + market/agent extensions). No dark mode, no per-component color inventions.

## Status

**Phase 1** (agent loop, headless). The daily loop in `src/agents/` runs after ingest: fill yesterday's decisions at today's open → mark to market → deliberate for tomorrow (OpenAI Responses API, structured outputs, `gpt-5.6-luna`; the provider is isolated to `src/agents/deliberate.ts`, key in `OPENAI_KEY`). Everything lands on the append-only hash-chained ledger (`LedgerEntry`) — **there are no update/delete paths for ledger rows anywhere, ever**. No UI yet. Exit criterion: the loop runs unattended for a week.

## Stack

Next.js (App Router, Turbopack) · TypeScript · Tailwind v4 (tokens in `src/app/globals.css`) · Prisma 7 (`prisma-client` generator → `src/generated/prisma`, driver adapter `@prisma/adapter-pg`) → Neon Postgres · Inngest planned for the daily loop (plain scripts until deploy).

## Commands

```bash
npm run dev            # Next.js dev server
npm run typecheck      # tsc --noEmit (run prisma generate first on fresh clones)
npm run lint
npm run ingest -- --dry-run   # run all fetchers, no DB; writes data/briefing-<date>.json
npm run ingest         # same, persisting to Postgres (needs DATABASE_URL)
npm run floor          # daily agent loop: fills → MTM → deliberation (needs ANTHROPIC_API_KEY)
npm run floor -- --dry-run    # compute everything, persist nothing
FLOOR_MOCK=1 npm run floor    # pipeline test without model calls (forces dry-run)
npm run floor:verify   # recompute the full hash chain from genesis
npx prisma generate    # regenerate client after schema changes
npx prisma migrate dev # apply schema to the database (needs DATABASE_URL in .env.local)
```

## Conventions

- Work on `dev`, never `main`. Conventional commit messages.
- **Ingestion isolation**: every upstream is one `Fetcher` in `src/ingest/sources/`; a fetcher may fail loudly but must never take down the run. Register new sources in `src/ingest/run.ts` and give them a `staleAfterMin`.
- **The archive is the moat**: everything ingested lands in Postgres normalized (`Event`, `DailyBar`). Never make ingestion fire-and-forget.
- The regime formula (`src/lib/regime.ts`) is public-facing — any change to weights or mappings is a documented, versioned decision, not a tweak.
- Phase 1 will add the agent decision log: **append-only, hash-chained; no update/delete paths, ever** (CONCEPT.md §3).
- No per-project CLAUDE.md — this file is the project context.
