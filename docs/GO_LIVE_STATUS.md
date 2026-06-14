# Avalon Go-Live Status

Internal launch-readiness ledger. This file tracks the final gap between the
repo-local launch blockers and the credentialed staging/production actions that
Joseph must execute or explicitly waive. Do not paste secrets or real client PHI
into this file.

## Current Repo-Local Evidence

As of 2026-06-13, the current workspace has passing evidence for:

- `npm run test:release`
- `npm run typecheck:strict`
- `npm run test:scorecard`
- `npm run test:revenue-matrix`
- `npm run test:launch-blockers`
- `npm run test:privacy`
- `npm run test:security`

The release evidence is recorded in `.context/enterprise-audit-log.md` as
`ENT-080`. The tracked staging procedure is
`docs/GO_LIVE_STAGING_DRILLS.md`.

## Launch Decision

Status: **not production-go** until every item below is `pass` or Joseph records
an explicit deferral/waiver in `.context/enterprise-audit-log.md`.

| ID | Area | Required evidence | Status |
| --- | --- | --- | --- |
| GL-001 | Vercel env | Production/staging envs set from `.env.example`, including `VITE_AVALON_ENABLE_LIVE_API=true`, `AVALON_ENABLE_LIVE_API=true`, `APPOINTMENT_SUMMARY_TOKEN_SECRET`, Supabase service role, Stripe, Acuity, Resend, Attio, internal API secret, and KV rate-limit values. | pending user action |
| GL-002 | Supabase migrations | Production/staging Supabase has migrations applied through `supabase/migrations/011_launch_messaging_roles.sql`. | pending user action |
| GL-003 | Supabase Auth redirects | Staging and production login/admin-login redirect URLs are configured in Supabase Auth. | pending user action |
| GL-004 | Key rotation | Exposed Acuity API key and Gemini image-MCP key are rotated and only the new values are set in vendor/Vercel environments. | pending user action |
| GL-005 | Stripe live mode | Stripe live mode, webhook secret, wallet/domain readiness, and price/amount behavior are confirmed. | pending user action |
| GL-006 | MFA policy | Production MFA decision is recorded: implemented/enforced or explicitly deferred by Joseph. | pending user action |
| GL-007 | BAAs | BAAs are signed before real PHI flows: Supabase, Acuity, Resend, Sentry if enabled, and hosting if PHI transits it. | pending user action |
| GL-008 | Stripe metadata drill | `docs/GO_LIVE_STAGING_DRILLS.md` Drill 1 passes with redacted evidence. | pending staging drill |
| GL-009 | Appointment-summary auth drill | Drill 2 passes: valid session ID alone cannot return identifiable appointment details. | pending staging drill |
| GL-010 | Acuity failure drill | Drill 3 passes: paid Stripe checkout plus forced Acuity failure creates reconciliation, ops alert, customer-safe email, and pending confirmation UI. | pending staging drill |
| GL-011 | Webhook/verify race drill | Drill 4 passes: repeated verify/refresh plus webhook processing creates exactly one Acuity appointment. | pending staging drill |
| GL-012 | Balance charge audit drill | Drill 5 passes: over-balance override rejects and all attempts write `audit_events` with no PHI. | pending staging drill |
| GL-013 | Email/CRM failure drill | Drill 6 passes: Resend and Attio failures create reconciliation cases with safe payloads. | pending staging drill |
| GL-014 | Post-deploy revenue matrix | Drill 7 passes against staging and production deploy URLs with `REVENUE_MATRIX_BASE_URL`. | pending staging drill |
| GL-015 | Rate-limit backend | `KV_REST_API_URL` and `KV_REST_API_TOKEN` are configured in staging/production so order lookup, SMS auth, and internal charge throttles persist across serverless instances. | pending user action |

## Evidence Rules

- Use test-mode vendor records for staging drills.
- Record only operational IDs, result codes, and redacted snippets.
- Do not record names, email addresses, phone numbers, DOB, address, emergency
  contact, clinical notes, raw vendor errors, tokens, or secret values.
- If Joseph waives a P0/P1 item, record who waived it, when, why, and the
  compensating control in `.context/enterprise-audit-log.md`.

## Status Update Procedure

1. Run the relevant drill or complete the user action.
2. Record evidence in `.context/enterprise-audit-log.md`.
3. Change only the status cell above to `pass` or `waived by Joseph`.
4. Re-run `npm run test:launch-blockers` before committing status changes.
