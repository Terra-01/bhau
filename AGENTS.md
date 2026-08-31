# The Floor — Agent Context

A customizable India-market intelligence war room whose AI paper-trading agents prove its usefulness daily. Read these before touching anything:

- **[CONCEPT.md](CONCEPT.md)** — what we're building and why (product thesis, agents, honesty protocol, data pipeline, roadmap). Source of truth for scope.
- **[DESIGN.md](DESIGN.md)** — design language: light-only "morning broadsheet" (Dub base in `design/dub-reference.md` + market/agent extensions). No dark mode, no per-component color inventions.

## Status

**Phase 0** (pipeline + archive). No UI yet — the scaffold's default page is untouched on purpose. Exit criterion: a week of clean daily briefing packs.

## Stack

Next.js (App Router, Turbopack) · TypeScript · Tailwind v4 (tokens in `src/app/globals.css`) · Prisma 7 (`prisma-client` generator → `src/generated/prisma`, driver adapter `@prisma/adapter-pg`) → Neon Postgres · Inngest planned for the daily loop (plain scripts until deploy).

## Commands

```bash
npm run dev            # Next.js dev server
npm run typecheck      # tsc --noEmit (run prisma generate first on fresh clones)
npm run lint
npm run ingest -- --dry-run   # run all fetchers, no DB; writes data/briefing-<date>.json
npm run ingest         # same, persisting to Postgres (needs DATABASE_URL)
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
