# Go-Live Status Ledger

This ledger tracks launch blockers, required user actions, and staging evidence. Status values are intentionally conservative until the listed drill evidence exists.

| ID | Area | Status | Evidence / Next Action |
| --- | --- | --- | --- |
| GL-001 | Live API flags | verified on snooches | `npx vercel env ls production` on June 17, 2026 shows `VITE_AVALON_ENABLE_LIVE_API=true` and `AVALON_ENABLE_LIVE_API=true` in Production; live harmless checkout probe returns validation errors instead of the pre-API hard-wall payload. |
| GL-002 | Supabase Auth providers | pending user action | Google, Apple, and Phone provider secrets must be pasted in Supabase Studio, then `npm run test:oauth-config` must pass. |
| GL-003 | Profile trigger | pending staging drill | Run `npm run verify:signup`; confirm OAuth and email users become active client profiles. |
| GL-004 | Appointment-summary auth drill | pending staging drill | Run the unauthenticated summary probe; expected `summary_auth_required` and signed access through `APPOINTMENT_SUMMARY_TOKEN_SECRET`. |
| GL-005 | Stripe metadata drill | pending staging drill | Inspect Stripe metadata drill output for PHI-free payloads. |
| GL-006 | Acuity failure drill | pending staging drill | Force Acuity failure after paid checkout and confirm `stripe_succeeded_acuity_failed`. |
| GL-007 | Webhook/verify race drill | pending staging drill | Confirm only one Acuity appointment is created during webhook/verify race. |
| GL-008 | Balance charge audit drill | pending staging drill | Confirm balance override rejection and accepted charge `audit_events`. |
| GL-009 | Email/CRM failure drill | pending staging drill | Confirm `operations_email_failed`, `customer_email_failed`, and `crm_sync_failed` reconciliation cases. |
| GL-010 | Post-deploy revenue matrix | pending staging drill | Run revenue matrix with `REVENUE_MATRIX_BASE_URL` after snooches deploy. |
| GL-011 | Messaging roles | pending staging drill | Confirm `supabase/migrations/011_launch_messaging_roles.sql` is applied. |
| GL-012 | BAAs | pending user action | **Sign BAAs** (self-serve): Supabase (Team + HIPAA add-on), Acuity (Powerhouse/Premium in-app link), Vercel (click-through on Pro), Sentry (Business tier → Legal & Compliance). **Confirm BAA availability with vendor** (or migrate): Resend, Attio. **No BAA, route-around in place**: Stripe (`safeStripeMetadata` whitelist + CI guard `npm run test:no-phi-in-stripe`), Quo SMS (OTP-only body + PHI deny patterns). Attio sync is killed by default until BAA decision (`ATTIO_SYNC_ENABLED=false`). Resend ops email is link-only. See `docs/PHI_DATA_FLOW.md` for the full data flow + control map. |
| GL-013 | MFA | pending user action | Require MFA or passkey policy for admin/staff accounts before launch. |
| GL-014 | key rotation | pending user action | Rotate any key exposed outside provider dashboards or Vercel secrets. The ignored local `.env.local` Acuity key was blanked in this workspace; replace it only with a rotated value. |
| GL-015 | Rate-limit backend | verified on snooches | `npx vercel env ls production` on June 17, 2026 shows `KV_REST_API_URL` and `KV_REST_API_TOKEN` in Production, so `/api` rate limiting can use the persistent backend instead of the memory fallback. |
| GL-016 | P1 Acuity reverse webhook | known launch limitation | If `ACUITY_WEBHOOK_SECRET` is unset or webhook delivery is not verified, Acuity-side reschedules/cancellations require manual ops reconciliation for v1. |
| GL-017 | P1 plan recurrence extension | known launch limitation | Plan appointments are prebooked inline with a 6-month cap; annual auto-extension past month 6 needs a scheduled job after v1. |
| GL-018 | Vercel production env names | partial evidence | `npx vercel env ls production` on June 17, 2026 shows Production entries for the core launch names: `PUBLIC_SITE_URL`, both live API flags, Supabase URL/anon/service-role keys, Stripe secret/publishable/webhook keys, `APPOINTMENT_SUMMARY_TOKEN_SECRET`, Acuity user/API/default type IDs, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and KV rate-limit vars. It does not prove provider credentials are rotated, test-mode-safe for drills, or that GitHub-only `VERIFY_EMAIL_ROOT` exists. `verify:prod` still must pass before launch clearance. |

Do not promote beyond snooches until every `pending user action` and `pending staging drill` has evidence attached.

June 17, 2026 snooches evidence: `npm run verify:hosted-admin-endpoints`
passes against `https://snooches.avalonvitality.co`, proving
`/api/admin/finance/summary` is deployed and fails closed with 401
unauthenticated, and `/api/admin/bookings/retry-acuity` is deployed and rejects
GET with 405 instead of Vercel 404. The constrained live mobile QA also passes
45/45 checks across `/`, `/book`, `/subscription`, `/login`, `/signup`,
`/admin/login`, legal pages, and the CBD product route at widths 320, 375, 390,
430, and 768 after increasing the auth-logo home link hit target to 44px.

Local build evidence now covers the production-smoke guardrails: `verify:signup`,
`verify:team-invite`, and `verify:password-reset` all require
`VERIFY_EMAIL_ROOT` on hosted targets, and admin Acuity retry releases the
scheduling lock after success or failure so ops can retry immediately after a
configuration fix. The smoke suite also guards first-load static shells for
`/auth/callback` and `/account/new-password`, plus customer-safe admin finance
error copy. The password-reset verifier also enforces `/account/new-password`
as the only recovery target and discloses that hosted email delivery must be
confirmed in the mailbox or provider logs. Paid checkout fulfillment now fails
closed if Acuity returns no appointment id, so the webhook and `/api/checkout/verify`
cannot mark a paid booking successful without a scheduled appointment. Plan
checkout also requires the first appointment time, adult DOB, and emergency
contact before live Stripe payment. `/api/admin/finance/summary` now writes a
PHI-touched audit event with count-only payload metadata when staff/admin load
the live finance view. Admin Acuity retry attempts also write PHI-touched audit
events with result codes only, and checkout pending-record failures log
sanitized database context. The go-live GitHub Actions workflow runs
`test:launch-blockers` after `build` so the prebuilt artifact is scanned before
snooches deployment. The plan-subscription helper is now shared by the Stripe
webhook and `/api/checkout/verify`, so whichever path wins the Acuity scheduling
lock for a paid plan also creates the deferred recurring subscription
idempotently; `verify:booking-to-acuity` includes a plan webhook/verify race
case for that invariant. `test:launch-blockers` now also scans browser build
artifacts for secret-valued key prefixes (`sk_live_`, `sk_test_`,
`sb_secret_`, and Resend `re_...`) so generated assets cannot quietly carry
server-side credentials. It also verifies `public/sw.js` remains a cache-clearing
kill switch with no fetch handler and that local package/GitHub automation does
not run `vercel deploy --prod`.
`verify:prod` now also preflights launch-critical names that are not consumed by
the smoke scripts themselves, including `PUBLIC_SITE_URL`, both live API flags,
`VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`APPOINTMENT_SUMMARY_TOKEN_SECRET`; the manual GitHub workflow passes those
values into the verification step before build.

June 18, 2026 snooches evidence: full local release QA passed end to end with
`npm run test:release` after hardening the mobile and stability browser probes
against silent Chrome/CDP hangs. Coverage included build, launch blockers,
booking, login, interaction, mobile 290/290 route/viewport checks, stability
40/40 checks, visual screenshots, and translation QA. Deployed preview
`avalonweb-33w03siz4-joseph-8775s-projects.vercel.app` and aliased
`snooches.avalonvitality.co`; `npm run verify:hosted-admin-endpoints` passes
against the alias, root headers include CSP/HSTS/noindex, and constrained live
stability passes 18/18 checks across `/`, `/book`, `/subscription`, auth/legal
routes, and `/products/cbd/cbd-33mg` at 390px and 1280px. Local
`npm run verify:prod` still cannot run until the credentialed production
verification env/secrets are available in the execution context.

June 18, 2026 iOS Simulator Safari evidence: iPhone 17 / iOS 26.5 screenshots
against the current `snooches.avalonvitality.co` alias were captured at
`.context/snooches-ios-2026-06-18-home-retry.png`,
`.context/snooches-ios-2026-06-18-book.png`, and
`.context/snooches-ios-2026-06-18-subscription.png`. `/book` and
`/subscription` rendered usable mobile flows, and `/` rendered after a
cache-busted reload. The first non-cache-busted home capture was blank, so keep
home first-paint timing in the watch list even though Chrome/CDP live stability
and the follow-up iOS Safari capture passed.

Deploy reminder: use `vercel build`, `vercel deploy --prebuilt --no-prod`, and `vercel alias set <url> snooches.avalonvitality.co`. Never run `vercel deploy --prod` from this repo during this launch.
