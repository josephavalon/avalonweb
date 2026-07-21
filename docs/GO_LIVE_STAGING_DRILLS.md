# Go-Live Staging Drills

Run these drills against `snooches.avalonvitality.co` before aliasing traffic. Record evidence in `docs/GO_LIVE_STATUS.md`.

## Stripe Metadata Inspection

Create a test checkout and inspect the Stripe Checkout Session, PaymentIntent, and webhook event. Confirm Stripe metadata contains only non-PHI operational fields, keeps `appointmentRecordId`, and omits DOB, address, notes, emergency contact, clinical review, GFE, and raw item intake detail.

## Unauthenticated Appointment Summary Probe

Call the appointment summary endpoint without a signed summary token and without a staff session. Expected result: `summary_auth_required`, denied audit event, and no appointment details. Confirm signed token access uses `APPOINTMENT_SUMMARY_TOKEN_SECRET`.

## Forced Acuity Failure After Paid Stripe Checkout

Temporarily break Acuity configuration in a preview environment, complete a Stripe test checkout, and confirm the row is marked `reconciliation_status='action_required'`. Expected reconciliation case: `stripe_succeeded_acuity_failed`.

## Webhook/Verify Race Refresh

Trigger Stripe webhook processing and `/api/checkout/verify` refresh concurrently. Confirm the scheduling lock allows one Acuity creation winner and the loser defers without overwriting scheduling fields.

## Balance Charge Override And Audit Events

From `/admin/bookings`, test normal balance collection, override rejection above balance due, and a valid lower override. Confirm `audit_events` contains accepted and rejected actions with amount, balance, mode, actor, and no PHI.

## Email And CRM Failure Reconciliation

Disable email/CRM providers in preview and verify operational cases are inserted for `operations_email_failed`, `customer_email_failed`, and `crm_sync_failed` without exposing raw provider errors to customers.

## Live Revenue Matrix After Deploy

Run the revenue matrix against the deployed preview with `REVENUE_MATRIX_BASE_URL` set to the snooches URL. Confirm finance, booking, checkout, and balance collection agree on paid, partial, and outstanding states.

## Messaging And Roles

Verify `supabase/migrations/011_launch_messaging_roles.sql` is applied and staff/admin/client messaging policies match launch roles.

## Known P1 Launch Limitations

Record operator acknowledgement for both non-blocking v1 limits:

- Acuity reverse webhook: if not configured and verified with `ACUITY_WEBHOOK_SECRET`, Acuity-side reschedules/cancellations are reconciled manually.
- Plan recurrence extension: inline membership prebooking is capped at 6 months; annual auto-extension past month 6 is a scheduled-job follow-up.

## Evidence Terms

The staging evidence packet must include: `APPOINTMENT_SUMMARY_TOKEN_SECRET`, `supabase/migrations/011_launch_messaging_roles.sql`, `stripe_succeeded_acuity_failed`, `summary_auth_required`, `operations_email_failed`, `customer_email_failed`, `crm_sync_failed`, `audit_events`, and `REVENUE_MATRIX_BASE_URL`.
