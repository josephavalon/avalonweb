# Avalon Go-Live Staging Drills

Internal launch-readiness runbook. Use only staging/test-mode vendors unless
Joseph explicitly promotes a step to production. Do not paste real client PHI,
secret values, or raw vendor error bodies into evidence.

## Required Environment

Before running these drills, staging must have:

- Supabase migrations applied through `supabase/migrations/011_launch_messaging_roles.sql`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set for the staging app.
- `VITE_AVALON_ENABLE_LIVE_API=true` and `AVALON_ENABLE_LIVE_API=true`.
- Server-only `APPOINTMENT_SUMMARY_TOKEN_SECRET`.
- Stripe test-mode secret and webhook secret configured.
- Acuity, Resend, and Attio staging/test credentials configured.
- Supabase Auth redirect URLs for staging login/admin login.
- Demo auth disabled unless the host is an approved beta simulation host.

Keep these user actions open until Joseph confirms completion:

- Rotate the exposed Acuity API key.
- Rotate the exposed Gemini image-MCP key.
- Confirm production MFA policy.
- Sign BAAs before real PHI flows: Supabase, Acuity, Resend, Sentry, hosting if
  PHI transits it.
- Confirm Stripe live-mode readiness separately from these staging drills.

## Evidence Format

Record each drill in `.context/enterprise-audit-log.md` with:

- Date, staging URL, commit SHA, and operator.
- Test-mode Stripe session/payment intent IDs only.
- Supabase appointment/reconciliation/audit row IDs only.
- Screenshot or response snippets with contact, address, DOB, notes, and raw
  vendor errors redacted.
- Result: `pass`, `fail`, or `blocked by user action`.

## Drill 1: Stripe Metadata Inspection

Purpose: prove new checkout sessions keep PHI out of Stripe metadata while the
full fulfillment payload stays in Supabase.

1. Create a test-mode mobile IV checkout with at least one NAD+ add-on.
2. Complete Stripe Checkout with a test card.
3. Inspect the Stripe session and PaymentIntent metadata.
4. Query the matching `public.appointments` row by `stripe_checkout_session_id`.

Expected:

- Stripe metadata contains operational fields only: fulfillment version,
  appointment record ID, payment type/method, item keys/types/minimal labels,
  and amount cents.
- Stripe metadata does not contain name, email, phone, DOB, address, ZIP,
  emergency contact, notes, clinical flags, or item price detail.
- Supabase `appointments.external_payload` contains the full checkout payload
  needed for fulfillment.

Suggested probes:

```bash
stripe checkout sessions retrieve "$STRIPE_SESSION_ID" \
  --expand payment_intent \
  --format json
```

```sql
select id,
       stripe_checkout_session_id,
       acuity_appointment_id,
       payment_status,
       reconciliation_status,
       external_payload ? 'contact' as has_contact_payload
  from public.appointments
 where stripe_checkout_session_id = '<STRIPE_SESSION_ID>';
```

## Drill 2: Unauthenticated Appointment Summary Probe

Purpose: prove a bearer Stripe session ID cannot read identifiable appointment
details.

1. Use a paid test-mode checkout session ID.
2. Probe without auth and without `x-appointment-summary-token`.
3. Call `api/checkout/verify` to get a short-lived summary token.
4. Probe again with `x-appointment-summary-token`.

Expected:

- Without auth/token, response is `401` with `code: "summary_auth_required"`.
- The unauthenticated response contains no address, phone, email, DOB, ZIP,
  emergency contact, notes, medical fields, or clinical flags.
- With the summary token, the booking confirmation can render the appointment
  summary.

Suggested probes:

```bash
curl -i "$STAGING_BASE_URL/api/appointment-summary?session_id=$STRIPE_SESSION_ID"
```

```bash
curl -sS -X POST "$STAGING_BASE_URL/api/checkout/verify" \
  -H 'content-type: application/json' \
  --data "{\"session_id\":\"$STRIPE_SESSION_ID\"}"
```

```bash
curl -i "$STAGING_BASE_URL/api/appointment-summary?session_id=$STRIPE_SESSION_ID" \
  -H "x-appointment-summary-token: $SUMMARY_TOKEN"
```

## Drill 3: Forced Acuity Failure After Paid Stripe Checkout

Purpose: prove paid-without-appointment is honest to the customer and actionable
for operations.

Use staging only. Preferred methods are temporarily pointing staging to a known
invalid Acuity appointment type or staging-only invalid Acuity credential. Do
not run this against production or with real client data.

1. Configure the staging-only Acuity failure condition.
2. Create and pay for a test-mode mobile IV checkout.
3. Open the booking confirmation page.
4. Inspect `appointments`, `reconciliation_cases`, PaymentIntent metadata, and
   Resend delivery records.
5. Restore the staging Acuity configuration immediately after the test.

Expected:

- Exactly one `stripe_succeeded_acuity_failed` reconciliation case exists for
  the Stripe session.
- Appointment `reconciliation_status` is `action_required`.
- No Acuity appointment is created for the failed session.
- Operations email is attempted once and contains staff-only details.
- Customer email is separate and customer-safe: no internal IDs, raw errors,
  address, DOB, emergency contact, notes, clinical flags, or fulfillment stack.
- Confirmation page says payment was received and Avalon is confirming the
  appointment, not that the appointment is fully scheduled.

Suggested query:

```sql
select case_type, provider, external_reference, severity, owner_role, payload
  from public.reconciliation_cases
 where external_reference = '<STRIPE_SESSION_ID>'
 order by created_at desc;
```

## Drill 4: Webhook/Verify Race Refresh

Purpose: prove Stripe webhook and `checkout/verify` cannot double-create Acuity
appointments.

1. Create a paid test-mode checkout session while webhook processing is active.
2. Immediately call `api/checkout/verify` repeatedly in parallel while the
   Stripe webhook is also processing.
3. Refresh the confirmation page several times during the same window.
4. Inspect the appointment row, PaymentIntent metadata, and Acuity account.

Expected:

- Exactly one Acuity appointment is created.
- Loser paths return `pendingFulfillment: true` until the winner persists the
  Acuity appointment ID.
- The appointment row has one `acuity_appointment_id`.
- No duplicate Acuity records exist for the same client/time/test session.

Suggested probe:

```bash
for i in 1 2 3 4 5 6 7 8; do
  curl -sS -X POST "$STAGING_BASE_URL/api/checkout/verify" \
    -H 'content-type: application/json' \
    --data "{\"session_id\":\"$STRIPE_SESSION_ID\"}" &
done
wait
```

## Drill 5: Balance Charge Override And Audit Events

Purpose: prove admin/internal balance collection cannot overcharge and every
attempt writes an immutable audit row.

1. Use a staging appointment with `balance_due_cents > 0`.
2. Attempt a charge/link above `balance_due_cents`.
3. Attempt the default balance collection/link.
4. Query `public.audit_events`.

Expected:

- Over-balance override returns `400`.
- Default amount uses current `balance_due_cents`.
- Audit rows exist for rejected and accepted attempts.
- Audit payload contains appointment ID, amount, mode, override flag, result
  code, actor where available, and no PHI/contact fields.

Suggested query:

```sql
select action, entity_type, entity_id, phi_touched, payload
  from public.audit_events
 where entity_type = 'appointment'
   and entity_id = '<APPOINTMENT_ID>'
 order by created_at desc
 limit 20;
```

## Drill 6: Email And CRM Failure Reconciliation

Purpose: prove Resend and Attio failures are visible in reconciliation instead
of only logs.

Use staging-only invalid Resend or Attio credentials, and restore immediately
after the drill.

Expected:

- Resend ops email failure creates `operations_email_failed`.
- Resend customer email failure creates `customer_email_failed` when applicable.
- Attio failure creates `crm_sync_failed`.
- Payloads contain provider, appointment/Stripe references, safe error code and
  status only; no raw response body and no client PHI.

## Drill 7: Live Revenue Matrix After Deploy

Purpose: prove the deploy did not break customer revenue paths in real browser
profiles.

Run after staging and again after production deploy:

```bash
REVENUE_MATRIX_BASE_URL="$STAGING_BASE_URL" npm run test:revenue-matrix
```

Expected:

- Desktop Chrome, desktop WebKit, Android Chrome, iPhone WebKit, iPhone Safari
  UA, Instagram webview UA, TikTok webview UA, and Facebook webview UA pass.
- Funnel events fire without contact/PHI fields.
- Stripe embedded checkout mounts where expected.

## Completion Criteria

Go-live remains blocked until all required drills are `pass` or Joseph records
an explicit deferral/waiver in `.context/enterprise-audit-log.md`.
