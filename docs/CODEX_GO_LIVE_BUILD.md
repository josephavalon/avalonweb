# Avalon — Go-Live Build Spec (Codex Handoff)

**Goal:** Ship the minimum complete feature set required to put needles in arms and collect money on `snooches.avalonvitality.co`, then promote to `avalonvitality.co`. Everything in this doc is **P0 unless flagged P1**.

**Hard rules** (read before editing anything):
- Never `vercel deploy --prod` from this repo — `--prod` auto-aliases `avalonvitality.co` + `www`, blowing away the coming-soon page. Deploy to **snooches** only.
- Never push to or merge `main` directly. Feature branches only.
- Demo password `JonJones1986` is RETIRED (`vite.config.js` strips it from build chunks). Use the current demo password the user holds.
- Don't reintroduce a caching service worker — `public/sw.js` is intentionally a kill-switch.
- `bg-white` is globally neutralized to the dark card color (`src/index.css`). Use inline style for a true white surface.
- Plans charge **$50 deposit only** at checkout (`payment` mode, not `subscription`). Do not switch to `subscription` mode. See `src/lib/paymentRules.js`.

---

## P0 — User Creation (Client + Admin)

### Client signup

- **File:** `app-modules/pages/Signup.jsx`
- **Today:** email magic-link only.
- **Ship:**
  1. Add **Google** and **Apple** buttons to the signup screen, calling `useAuthStore.signInWithOAuth('google' | 'apple')`. Match `Login.jsx` styling.
  2. Add a **passkey enrollment** affordance on the post-signup `/members/account` page (call `registerPasskey()` from `useAuthStore`).
  3. Verify the `handle_new_user` trigger (`supabase/migrations/007_auth_profile_trigger.sql`) populates `profiles` for OAuth users — write a single integration test under `scripts/verify-signup.mjs` that exits non-zero if a freshly created `auth.users` row does not produce a `profiles` row with `role='client'`, `tenant_id='avalon-vitality'`, `status='active'`.

**Acceptance:**
- A new visitor can sign up via email, Google, or Apple, lands on `/members/dashboard`, and shows up in `public.profiles` with the correct defaults.
- `scripts/verify-signup.mjs` passes.

### Admin user creation

- **Files:** `api/admin/team/invite.js`, `api/invite/{validate,accept}.js`, `app-modules/pages/admin/TeamSettings.jsx`, `src/pages/InviteAccept.jsx`.
- **Today:** end-to-end works (email magic link + 6-digit SMS code + password set). The team-RBAC migration `012_admin_team_management.sql` is applied.
- **Ship (hardening):**
  1. Add a `scripts/verify-team-invite.mjs` smoke that, against a `_test` tenant, creates an invite, hits `/api/invite/validate` with the token, hits `/api/invite/accept`, and asserts a `profiles` row with the requested role (`staff` or `admin`) plus `must_change_password=false`.
  2. Confirm Resend `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are set in Vercel Production. If `RESEND_FROM_EMAIL` is missing, the API silently falls back to `onboarding@resend.dev` — fail closed in production instead (return 500 with a clear error).
  3. Confirm Quo `QUO_API_KEY` + `QUO_FROM_NUMBER` are set; if absent, the invite API should still succeed (email-only delivery) but log a structured `warn` event — do not 500.

**Acceptance:**
- `scripts/verify-team-invite.mjs` passes against a real Supabase project.
- Missing `RESEND_FROM_EMAIL` in production = 500 (not silent fallback).

---

## P0 — OAuth Logins (Google + Apple) + Phone OTP

The buttons already exist in `app-modules/pages/Login.jsx`; the **providers are unconfigured in Supabase**, so they error on click.

This is a config + verification task, not a code task. **Codex's job:** add a `scripts/verify-oauth.mjs` that the user runs from CI after the user manually pastes provider secrets into Supabase Studio (credential boundary — Claude/Codex does not handle secrets).

### Supabase Studio config (user does — Codex documents)

1. **Google** — Google Cloud OAuth client (web). Authorized redirect URI: `https://sfrctrtogfbinzfhvnyt.supabase.co/auth/v1/callback`. Paste client id/secret into Supabase → Auth → Providers → Google.
2. **Apple** — Apple Developer Services ID + key. Same callback URL. Paste into Supabase → Auth → Providers → Apple.
3. **Phone** — Twilio account SID + auth token + verify service. Supabase → Auth → Providers → Phone.

Add these as **Site URL** and **Redirect URLs** in Supabase Auth → URL Configuration:
- `https://snooches.avalonvitality.co`
- `https://snooches.avalonvitality.co/login`
- `https://snooches.avalonvitality.co/auth/callback`
- `http://localhost:4173` + `http://localhost:5173` (and their `/login` paths)

### Code task

- Create `src/pages/AuthCallback.jsx` if not present, wiring `supabase.auth.exchangeCodeForSession` on mount and redirecting to `/members/dashboard` (client) or `/admin` (admin). Add route in `src/App.jsx`.
- Create `scripts/verify-oauth.mjs` that:
  - Reads `VITE_SUPABASE_URL` from env.
  - Hits `/auth/v1/settings` and asserts `external.google.enabled === true`, `external.apple.enabled === true`, `external.phone.enabled === true`.
  - Exits non-zero on any false.
- Update `docs/AUTH_SETUP.md` so each provider has a clear "you (the human) do X, then run `npm run test:oauth-config`" checklist.

**Acceptance:**
- Clicking Google or Apple on `/login` redirects to provider consent, returns to `/auth/callback`, lands the user on `/members/dashboard` with a real `auth.users` row + a `profiles` row from the trigger.
- `npm run test:oauth-config` (alias for `scripts/verify-oauth.mjs`) passes against snooches.

---

## P0 — Book Now → Acuity

The plumbing is built; **it has never been proven end-to-end on a live Acuity account.**

### Code work

- **Files:** `app-modules/pages/BookNow.jsx`, `api/create-checkout-session.js`, `api/_acuity.js`, `api/_checkout-fulfillment.js`, `api/integrations/stripe/webhook.js`, `api/checkout/verify.js`.
- **Ship:**
  1. **Fail-loud env validation.** In `api/_acuity.js`, at module load, throw a clear `Error('ACUITY_USER_ID + ACUITY_API_KEY are required')` if either is missing in production (NODE_ENV/Vercel env). Today it silently uses defaults that 401.
  2. **Appointment-type mapping audit.** Read every `process.env.ACUITY_TYPE_*` reference in `api/_acuity.js` and produce a table in `docs/ACUITY_TYPES.md` listing: env var → live Acuity Appointment Type ID → which protocol/service it maps to. Codex populates the columns it can from current code; the user fills the live IDs (credential-ish but not sensitive).
  3. **Reconciliation surfacing.** When `createSchedulingAppointmentWithFallback` fails (Acuity 4xx/5xx after retries), the appointment row's `reconciliation_status='action_required'` is set today but **invisible** to admins. Add a "Needs scheduling" badge to `/admin/bookings` that lists rows where `reconciliation_status='action_required'`, with a "Retry Acuity" button calling a new `POST /api/admin/bookings/retry-acuity` endpoint (calls the same fulfillment helper, requires `requireStaff`).
  4. **Smoke test.** `scripts/verify-booking-to-acuity.mjs` — in TEST mode, simulates a Stripe `checkout.session.completed` event for a Book Now flow, asserts a real Acuity appointment is created (uses the live Acuity API; the user holds credentials), then deletes the test appointment. Refuse to run unless `STRIPE_SECRET_KEY` starts with `sk_test_` and an explicit `ACUITY_VERIFY=1` env var is set.

**Acceptance:**
- A real Book Now → Stripe TEST → Acuity TEST appointment round-trip succeeds end-to-end.
- An intentionally-broken appointment (force the Acuity call to fail) shows up in `/admin/bookings` with a "Needs scheduling" badge and "Retry Acuity" succeeds when the cause is fixed.

### Acuity reverse webhook (P1, not blocking launch)

- `api/integrations/acuity/webhook.js` is currently a stub.
- Wire `appointment.rescheduled`, `appointment.canceled`, `appointment.changed` to update the matching `appointments` row by `acuity_appointment_id`. Verify Acuity webhook signature.
- Hidden risk if we skip this: a client reschedules in Acuity, our `/members/bookings` page still shows the old time. Acceptable for v1 if ops manually reconciles.

---

## P0 — Plans → Acuity

The deposit charge works (Model A: $50 deposit today via `payment` mode, balance after visit, recurring subscription deferred via `trial_end`). The **first visit must land in Acuity at the chosen time**, same path as Book Now.

### Code work

- **Files:** `app-modules/pages/PlanCheckout.jsx`, `api/_checkout-fulfillment.js` (`createDeferredPlanSubscription`, `bookMonthlyRecurrences`).
- **Ship:**
  1. Confirm `bookMonthlyRecurrences` is invoked from the Stripe webhook fulfillment path for plan signups, and asserts the first month's appointment exists in Acuity before declaring success. Today it pre-books up to 6 months — that's fine for monthly plans; for 12-month plans, write a follow-up TODO (do **not** build the auto-extend cron for v1).
  2. The verify-billing script `scripts/verify-plan-billing.mjs` already exists but has not been run against a `sk_test_` key end-to-end. Codex must add a one-line npm script alias in `package.json` (`"verify:plan-billing": "node scripts/verify-plan-billing.mjs"`), and the script's README header must make clear the user provides the `sk_test_` key.
  3. Extend `scripts/verify-booking-to-acuity.mjs` to also exercise the Plan path (1 deposit checkout → 1 Acuity appointment on the chosen first-visit date + a Stripe subscription in `trial` status with `trial_end` = first visit + 1 period).

**Acceptance:**
- A real plan signup TEST: $50 deposit charged, first visit in Acuity at the picked time, Stripe subscription created in trial state.
- `npm run verify:plan-billing` passes.
- `scripts/verify-booking-to-acuity.mjs` passes for both Book Now and Plans.

---

## P0 — Admin Rollback to Finance + Appointments

Trim the admin nav and route surface to **only what's live and useful**. Hide everything else behind a `VITE_ADMIN_PREVIEW=1` flag so engineers can still see it locally but the live shell doesn't expose it.

### Nav edit

**File:** `src/components/admin/AdminShell.jsx` — replace the `NAV` array (lines 26–46) with:

```js
const NAV_LIVE = [
  { label: 'Dashboard', icon: LayoutGrid, to: '/admin' },
  { label: 'Appointments', icon: CalendarCheck, to: '/admin/bookings' },
  { label: 'Finance', icon: CreditCard, to: '/admin/finance' },
  { label: 'Inventory', icon: Package, to: '/admin/inventory' },
  { label: 'Scheduling', icon: CalendarCheck, href: ACUITY_URL, external: true, note: 'Acuity' },
  { label: 'Team', icon: UserCog, to: '/admin/team' },
];

const NAV_PREVIEW = [
  // surfaced only when VITE_ADMIN_PREVIEW=1
  { label: 'Patients', icon: Users, children: [
    { label: 'All clients', to: '/admin/crm' },
    { label: 'Intake review', to: '/admin/credentials' },
  ]},
  { label: 'Analytics', icon: Activity, to: '/admin/client-heat-map' },
  { label: 'Operations', icon: ShieldCheck, to: '/admin/field' },
];

const NAV = [
  ...NAV_LIVE,
  ...(import.meta.env.VITE_ADMIN_PREVIEW === '1' ? NAV_PREVIEW : []),
];
```

### Route gate

**File:** `src/lib/adminAccess.js`. Add a `LIVE_ADMIN_ROUTES` constant containing only `/admin`, `/admin/bookings`, `/admin/finance`, `/admin/inventory`, `/admin/team`. In `canAccessAdminRoute`, when `import.meta.env.VITE_ADMIN_PREVIEW !== '1'`, restrict admin/staff to `LIVE_ADMIN_ROUTES` (still respecting the staff/admin split). Routes not in the set redirect to `/admin`.

### Finance page — replace mock data with real-enough v1

**File:** `app-modules/pages/admin/FinanceControl.jsx`.

Today it imports mock `PAYMENTS` / `INVOICES`. Replace with a thin live view backed by Stripe data and our `appointments` rows. Build a new endpoint `GET /api/admin/finance/summary` (gated by `requireStaff`) that returns:

- Last 30 days: count + sum of `appointments.payment_status='paid_in_full'` rows.
- Outstanding balances: count + sum of `appointments` where `payment_status='partial_payment'` and `balance_due > 0`.
- Stripe payouts (last 5) via `stripe.payouts.list({limit:5})`.
- Active subscriptions count via `stripe.subscriptions.list({status:'active', limit:100})` (paginate if >100).

Render four KPI cards + a payouts table + an "Outstanding balances" table linking to `/admin/bookings` rows. **No** QuickBooks, no Mercury, no Gusto for v1.

**Acceptance:**
- A staff user logging in sees only Dashboard / Appointments / Finance / Inventory / Scheduling (Acuity) / Team in the sidebar.
- An admin user sees the same.
- Visiting `/admin/dispatch` (or any hidden route) without `VITE_ADMIN_PREVIEW=1` redirects to `/admin`.
- `/admin/finance` shows live numbers — no fixture data.

---

## P0 — Critical Adjacent Items

These are not in the user's bullet list but **block "take money safely"**:

1. **Stripe webhook signature verification — make it fail loud.** In `api/integrations/stripe/webhook.js`, confirm `STRIPE_WEBHOOK_SECRET` is required (no fallback). Add a structured log on every event type processed so we can grep production logs after launch.
2. **Idempotency on the verify path.** `api/checkout/verify.js` and the webhook both can create the Acuity appointment. The `claimSchedulingCreation` lock exists (120s TTL). Add a dedicated test in `scripts/verify-booking-to-acuity.mjs` that fires both paths concurrently and asserts only one Acuity appointment is created.
3. **`/members/bookings` actually reflects reality.** After a Book Now, the client should see the appointment in their member portal within 5 seconds. Confirm `src/pages/members/Bookings.jsx` reads from `appointments` (not a fixture) and renders the Acuity time + a "Reschedule" link to Acuity's self-service URL for that appointment.
4. **Password reset.** `useAuthStore` only has magic-link "forgot password." Confirm `/account/new-password` (forced password change for invited staff) works, and add a "Send me a magic link to reset" flow on `/login` that hits `supabase.auth.resetPasswordForEmail` with `redirectTo: '/account/new-password'`. Test with `scripts/verify-password-reset.mjs` (creates a user, requests reset, asserts a recovery email is queued).
5. **Production env-var checklist.** Add `docs/PROD_ENV_CHECKLIST.md` listing every env var the production deployment needs, sourced from `git grep -h 'process\.env\.' api/ src/` deduped. Group as: Required (build fails / app crashes without) vs Optional (degrades gracefully). Codex generates the initial list; the user verifies each in Vercel.
6. **Smoke test that runs in CI before deploy.** A single `npm run verify:prod` that chains: `verify-signup`, `verify-team-invite`, `verify-oauth`, `verify-booking-to-acuity` (TEST mode), `verify-plan-billing`, `verify-password-reset`. CI gate before `vercel build`.

---

## Out of Scope (do not build for v1)

- Provider/nurse portal beyond what's already shipped — `src/pages/provider/*` stays as-is.
- Attio CRM sync (`/admin/crm`).
- Inventory restock automation, kits, dispatch, training.
- QuickBooks / Mercury / Gusto integrations.
- Marketing event presale codes (`/admin/events`).
- Acuity reverse webhook (P1 — list as known limitation in the launch announcement).
- Auto-extending plan appointments past month 6 (P1).
- Refunds UI in admin (ops can refund directly in Stripe).
- Service-worker caching.

---

## Verification Plan (end of build, before flip)

Run, in order, against **snooches**:

1. `npm run verify:signup`
2. `npm run verify:team-invite`
3. `npm run test:oauth-config` (assumes provider secrets pasted into Supabase Studio)
4. `STRIPE_SECRET_KEY=sk_test_... ACUITY_VERIFY=1 npm run verify:booking-to-acuity`
5. `STRIPE_SECRET_KEY=sk_test_... npm run verify:plan-billing`
6. `npm run verify:password-reset`
7. **Manual:** sign up a fresh client via Google → book a real (TEST) appointment → confirm Acuity appointment exists → confirm `/members/bookings` shows it → confirm `/admin/bookings` shows it with the right balance → click "Complete & Collect" → confirm Stripe charge succeeds → confirm `/admin/finance` revenue ticks up.
8. **Manual:** invite a staff user → accept via email link → set password → log in to `/admin/login` → confirm only the 6 live nav items render.

When 1–8 all pass, deploy to snooches via `vercel build` + `vercel deploy --prebuilt --no-prod`, then `vercel alias set <url> snooches.avalonvitality.co`. **Do not** run `vercel deploy --prod`.

---

## File Map (Codex's edit surface)

```
docs/CODEX_GO_LIVE_BUILD.md                          (this file)
docs/AUTH_SETUP.md                                   (update)
docs/ACUITY_TYPES.md                                 (new)
docs/PROD_ENV_CHECKLIST.md                           (new)

src/components/admin/AdminShell.jsx                  (NAV trim + flag)
src/lib/adminAccess.js                               (route gate)
src/lib/useAuthStore.js                              (resetPasswordForEmail)
src/pages/AuthCallback.jsx                           (new — OAuth landing)
src/pages/InviteAccept.jsx                           (unchanged unless bugs found)
src/pages/AdminLogin.jsx                             (unchanged unless bugs found)
src/App.jsx                                          (add /auth/callback route)

app-modules/pages/Signup.jsx                         (add Google + Apple buttons)
app-modules/pages/admin/FinanceControl.jsx           (replace mock data)
app-modules/pages/admin/Bookings.jsx                 (add "Needs scheduling" badge + retry)

api/_acuity.js                                       (fail-loud env validation)
api/admin/bookings/retry-acuity.js                   (new endpoint)
api/admin/finance/summary.js                         (new endpoint)
api/auth/send-sms.js                                 (confirm Twilio wired)
api/integrations/stripe/webhook.js                   (structured logging, no behavior change)

scripts/verify-signup.mjs                            (new)
scripts/verify-team-invite.mjs                       (new)
scripts/verify-oauth.mjs                             (new)
scripts/verify-booking-to-acuity.mjs                 (new)
scripts/verify-password-reset.mjs                    (new)
scripts/verify-prod.mjs                              (new — orchestrator)

package.json                                         (npm scripts)
```
