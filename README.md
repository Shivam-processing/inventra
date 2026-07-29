# Inventra

Inventra is a responsive patent-assistance workspace that helps inventors organize an idea, review extracted features, understand prior-art overlap, and prepare an editable draft.

This repository currently contains the Phase 1 interface foundation: a responsive landing page, a static dashboard shell, shared UI primitives, design tokens, and a small browser smoke test. Product workflows and backend services are intentionally not implemented yet.

## Development

Requires Node.js 20.9 or newer.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run typecheck
npm run test:e2e
npm run build
```

The first Playwright run may require installing Chromium:

```bash
npx playwright install chromium
```

## Routes

- `/` — marketing landing page
- `/dashboard` — private invention workspace
- `/dashboard/grants` — authenticated Indian government grants and schemes finder
- `/dashboard/manufacturing` — authenticated manufacturing, cost and supplier planning
- `/dashboard/trademarks` — authenticated preliminary trademark similarity and conflict screening

## Government grants finder

The grants finder always ranks a conservative, typed set of curated Indian government programmes locally. Set `GRANT_SEARCH_PROVIDER=curated` for this no-API mode.

Set `GRANT_SEARCH_PROVIDER=openai_web` to add one user-triggered OpenAI Responses API web-search request. Live mode reuses `OPENAI_API_KEY` and `OPENAI_MODEL`, searches only allowed official government/programme domains, and validates returned source URLs before displaying them. Live API usage occurs only after the user clicks **Find matching schemes**; it is never called during page rendering.

No database migration is required. Search results and optional applicant details are not persisted.

## Manufacturing and supplier planning

Apply `supabase/migrations/202607270001_create_manufacturing_analyses.sql` with `npx supabase db push` before using saved manufacturing plans. The table stores owned, versioned analysis snapshots and optional supplier-search results with ownership-safe RLS.

`MANUFACTURING_ANALYSIS_PROVIDER=mock` provides deterministic local and demo output. Set it to `openai` to use one explicit user-triggered Responses API request with the existing `OPENAI_API_KEY` and `OPENAI_MODEL`.

`MANUFACTURING_SUPPLIER_SEARCH_PROVIDER=curated` displays validated curated supplier links without an API call. Set it to `openai_web` to enable the separate, explicit current-listing search. Live results remain unverified sourcing leads and are marked stale after 14 days.

Inventra is not a law firm and does not provide legal advice.

## Trademark screening

Apply `supabase/migrations/202607280001_create_trademark_searches.sql` with `npx supabase db push`. The migration creates owned search history with RLS and adds the nullable proposed brand-name field to invention cases.

`TRADEMARK_ANALYSIS_PROVIDER=mock` uses deterministic local/demo analysis. Set it to `openai` to use one explicit Responses API request with `OPENAI_API_KEY` and `OPENAI_MODEL`. `TRADEMARK_DISCOVERY_PROVIDER=manual_official` provides manual IP India, WIPO Global Brand Database and Nice Classification actions without scraping. Optional `openai_web` discovery checks supplementary official sources only and is not a complete registry search.

Inventra does not scrape registries, bypass CAPTCHA, estimate domain or social availability, or confirm trademark availability, registrability, ownership or freedom to use a name.
