# Production Environment Checklist

Set these in Vercel Production for `snooches.avalonvitality.co`. Do not commit values. After changes, run the verification checklist from `docs/CODEX_GO_LIVE_BUILD.md`.

## Required For Go-Live

These block payment, scheduling, auth, or staff operations if missing.

- `PUBLIC_SITE_URL` - set to `https://snooches.avalonvitality.co`.
- `AVALON_ENABLE_LIVE_API` - set `true` for production API routes.
- `VITE_AVALON_ENABLE_LIVE_API` - set `true` for the production client build.
- `VITE_SUPABASE_URL` - public Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` - public Supabase anon key.
- `SUPABASE_URL` - server-side Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - server-side service role key.
- `STRIPE_SECRET_KEY` - Stripe secret key for checkout and finance APIs.
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key for client checkout.
- `STRIPE_WEBHOOK_SECRET` - required by the Stripe webhook.
- `APPOINTMENT_SUMMARY_TOKEN_SECRET` - signs appointment summary links.
- `ACUITY_USER_ID` - required by Acuity API calls.
- `ACUITY_API_KEY` - required by Acuity API calls.
- `ACUITY_DEFAULT_TYPE_ID` - fallback scheduling type.
- `ACUITY_TYPE_IV_VITAMINS`
- `ACUITY_TYPE_IV_NAD`
- `ACUITY_TYPE_IV_CBD`
- `ACUITY_TYPE_IM_SHOTS`
- `ACUITY_TYPE_MEMBERSHIP`
- `ACUITY_TYPE_HYDRATION`
- `ACUITY_TYPE_ENERGY`
- `ACUITY_TYPE_IMMUNITY`
- `ACUITY_TYPE_BEAUTY`
- `ACUITY_TYPE_RECOVERY`
- `ACUITY_TYPE_JETLAG`
- `ACUITY_TYPE_MYERS`
- `ACUITY_TYPE_HANGOVER`
- `VITE_ACUITY_TYPE_HYDRATION`
- `VITE_ACUITY_TYPE_MYERS`
- `VITE_ACUITY_TYPE_ENERGY`
- `VITE_ACUITY_TYPE_IMMUNITY`
- `VITE_ACUITY_TYPE_BEAUTY`
- `VITE_ACUITY_TYPE_RECOVERY`
- `VITE_ACUITY_TYPE_HANGOVER`
- `VITE_ACUITY_TYPE_JETLAG`
- `VITE_ACUITY_TYPE_IV_NAD`
- `VITE_ACUITY_TYPE_IV_CBD`
- `VITE_ACUITY_TYPE_IM_SHOTS`
- `VITE_ACUITY_TYPE_MEMBERSHIP`
- `RESEND_API_KEY` - invite and operational email delivery.
- `RESEND_FROM_EMAIL` - required in production; no sandbox fallback.
- `KV_REST_API_URL` - persistent rate-limit backend; required before public launch.
- `KV_REST_API_TOKEN` - persistent rate-limit backend token.

## Optional Or Degrades Gracefully

- `QUO_API_KEY` - SMS delivery. Missing value logs a warning; email invite can still succeed.
- `QUO_FROM_NUMBER` - SMS sender. Missing value logs a warning; email invite can still succeed.
- `SEND_SMS_HOOK_SECRET` - Supabase send-SMS hook shared secret.
- `SEND_SMS_ALLOWED_COUNTRY_PREFIXES` - optional SMS country allowlist.
- `SEND_SMS_MAX_BODY_BYTES` - optional SMS hook request size limit.
- `ACUITY_WEBHOOK_SECRET` - required only when enabling the P1 Acuity reverse webhook.
- `ACUITY_WEBHOOK_FETCH_TIMEOUT_MS`
- `ACUITY_WEBHOOK_MAX_BODY_BYTES`
- `ATTIO_ACCESS_TOKEN`
- `ATTIO_API_KEY`
- `ATTIO_PEOPLE_OBJECT`
- `ATTIO_WORKSPACE_ID`
- `AVALON_INTERNAL_API_SECRET`
- `AVALON_OPERATIONS_EMAIL`
- `BOOKING_DEPOSIT_DOLLARS` - defaults to the payment rules deposit if unset.
- `EVENT_PRESALE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL` - legacy fallback used by older server helper.
- `NODE_ENV` - managed by Vercel/build tooling; production paths expect `production`.
- `STRIPE_CHECKOUT_EXPIRES_MINUTES` - defaults to 30 minutes.
- `STRIPE_WEBHOOK_MAX_BODY_BYTES` - defaults to 512 KB.
- `STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS` - defaults to 10 seconds.
- `SUPABASE_ANON_KEY` - legacy/server verifier fallback; prefer `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_KEY` - legacy fallback; prefer `SUPABASE_SERVICE_ROLE_KEY`.
- `VITE_ACUITY_DEFAULT_TYPE_ID`
- `VITE_ACUITY_TYPE_EVENT`
- `VITE_ACUITY_TYPE_EVENT_PRESALE`
- `VITE_ADMIN_PREVIEW` - set `1` only for preview/admin feature exposure.
- `VERCEL_ENV` / `VERCEL` - managed by Vercel; Acuity credentials fail loud in any Vercel runtime when missing.
- `VITE_APP_VERSION` - optional release label for client error telemetry.
- `VITE_ATTIO_CONFIGURED` - optional UI placeholder toggle.
- `VITE_AVALON_DEMO_AUTH` - local/demo-only override; leave unset or `false` in live environments.
- `VITE_AVALON_ENABLE_FIRST_PARTY_ANALYTICS` - optional first-party analytics switch.
- `VITE_AVALON_DEMO_PASSWORD` - local/demo only; do not use the retired password.
- `VITE_SENTRY_DSN` - optional client error telemetry sink.
- `VITE_BASE44_APP_BASE_URL`
- `VITE_BASE44_APP_ID`
- `VITE_BASE44_FUNCTIONS_VERSION`

## Verification Commands

Before running the commands, confirm Supabase Data API exposure for the launch
tables (`profiles`, `tenants`, `appointments`, `invitations`) in Supabase
Studio. Newer Supabase projects can require explicit grants for public tables
even when RLS policies exist; the verifiers will fail with permission errors if
those grants are missing.

The manual GitHub Actions workflow `.github/workflows/go-live-verify.yml` runs
`npm run lint`, `npm run typecheck`, `npm run verify:prod` against snooches,
`npm run verify:hosted-admin-endpoints`, then `npm run build` and
`npm run test:launch-blockers`. That keeps the credentialed smoke gate before
the prebuilt Vercel artifact step, proves the live admin UI endpoints are not
Vercel 404s, and then checks the generated artifact before deploy. Add these
GitHub Actions secrets before running it:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERIFY_EMAIL_ROOT` - a human-owned mailbox used as the plus-address root for signup, invite, and password-reset smoke tests.
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STRIPE_TEST_SECRET_KEY` - must be a `sk_test_...` key, never live.
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APPOINTMENT_SUMMARY_TOKEN_SECRET`
- `ACUITY_USER_ID`
- `ACUITY_API_KEY`
- `ACUITY_DEFAULT_TYPE_ID`
- `ACUITY_TYPE_HYDRATION`
- `ACUITY_TYPE_MEMBERSHIP`

The workflow also sets these non-secret verification env vars directly:

- `API_BASE_URL` - `https://snooches.avalonvitality.co`
- `ACUITY_VERIFY` - `1`
- `PASSWORD_RESET_REDIRECT_TO` - `https://snooches.avalonvitality.co/account/new-password`

The Acuity verifier can fall back to live appointment-type name matching, but
the explicit IDs above make the Book Now and plan deposit smoke test
deterministic in CI.

`VERIFY_EMAIL_ROOT` should be a mailbox the launch team controls, such as
`qa@avalonvitality.co`. The verification scripts create plus-addressed users
like `qa+verify-team-...@avalonvitality.co`, then delete them.
For password reset, the script verifies Supabase accepts the recovery request
and enforces `/account/new-password` as the redirect target. Hosted Supabase
does not expose a portable email-queue read API, so the launch operator must
confirm delivery in the mailbox or provider logs during the manual drill.

```bash
npm run verify:signup
npm run verify:team-invite
npm run test:oauth-config
STRIPE_SECRET_KEY=sk_test_... ACUITY_VERIFY=1 npm run verify:booking-to-acuity
STRIPE_SECRET_KEY=sk_test_... npm run verify:plan-billing
npm run verify:password-reset
npm run verify:prod
npm run verify:hosted-admin-endpoints
```

Deploy only to snooches:

```bash
vercel build
vercel deploy --prebuilt --no-prod
vercel alias set <deployment-url> snooches.avalonvitality.co
```

Never run `vercel deploy --prod` from this repo for this launch.
