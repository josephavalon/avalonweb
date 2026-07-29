# CLAUDE.md — agent notes for this repo

This file is loaded into agent context for every session in this workspace. Keep it short and link out for detail.

## Repo conventions

- **Page routing** uses a re-export shim pattern: every `src/pages/*.jsx` file is a 2-13 line shim that re-exports the real implementation from `app-modules/pages/*.jsx`. See [`docs/ROUTING_CONVENTION.md`](docs/ROUTING_CONVENTION.md) before "consolidating" what looks like duplication.
- **Launch readiness** is tracked in [`docs/GO_LIVE_STATUS.md`](docs/GO_LIVE_STATUS.md) (GL-001..018). Read it before answering questions about whether something is "ready to ship."
- **Deploy rule**: never `vercel deploy --prod` from this repo — including from `.context/coming-soon-main/` (same Vercel project id `prj_YHh0a9k...`, so `--prod` there clobbers prod too). The apex `avalonvitality.co` + `www` now serve the LIVE app (main-URL swap has been executed — see `docs/MAIN_URL_SWAP_RUNBOOK.md`), so a stray `--prod` will replace the live site with whatever prebuilt output is in the cwd. Deploy via preview alias: push branch → Vercel Preview → `vercel alias set <preview-url> beta.avalonvitality.co`. `snooches.avalonvitality.co` is retained as a legacy alias.
- **Never push to main.** Only push feature branches.

## Verify scripts

- `npm run verify:prod` — Vercel env coverage check
- `npm run verify:signup` — client signup → profile creation drill
- `npm run verify:booking-to-acuity` — paid checkout → Acuity scheduling drill
- `npm run verify:plan-billing` — $50 deposit + balance-after + recurring drill
- `npm run verify:welcome-email` — post-signup welcome email send (CP-4)
- `npm run verify:team-invite`, `verify:team-access`, `verify:password-reset`, `verify:oauth`
- `npm run test:launch-blockers` — bundled secret leakage scan + SW kill-switch invariant

## Tests

- Pure-logic Vitest checks live next to the file. Snapshot tests for admin shell.
- Integration tests use the `scripts/verify-*.mjs` runner.
- For Stripe / Acuity / Resend: use the existing mocks; do not hit live providers from local tests.

## Design System

Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
Events platform build plan: [`docs/EVENTS_BLUEPRINT_v1.5_AMENDMENTS.md`](docs/EVENTS_BLUEPRINT_v1.5_AMENDMENTS.md) (amendments over blueprint v1.4).
