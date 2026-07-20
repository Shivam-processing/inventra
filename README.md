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
- `/dashboard` — responsive workspace shell with static sample projects

Inventra is not a law firm and does not provide legal advice.
