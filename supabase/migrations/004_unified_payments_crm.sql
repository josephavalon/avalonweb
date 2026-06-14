-- 004_unified_payments_crm.sql
-- Unifies Stripe (deposit + balance), Acuity/EMR, and Attio/CRM onto a single
-- canonical record: public.appointments. Additive + idempotent — safe to re-run.
--
-- Flow this supports:
--   1. $50 deposit via Stripe (card on file saved for later balance charge)
--   2. Acuity holds appointment + EMR intake + GFE
--   3. Attio person profile linked back to the appointment
--   4. Nurse charges remaining balance via the saved card at appointment end
--
-- Existing columns already present on appointments (from 003):
--   payment_status, acuity_appointment_id, stripe_checkout_session_id,
--   gfe_status, reconciliation_status, external_payload

-- ── Stripe payment linkage ──────────────────────────────────────────────────
alter table public.appointments add column if not exists stripe_customer_id            text;
alter table public.appointments add column if not exists stripe_payment_method_id      text;   -- saved card for balance charge
alter table public.appointments add column if not exists stripe_deposit_payment_intent text;
alter table public.appointments add column if not exists stripe_balance_payment_intent text;
alter table public.appointments add column if not exists currency                      text not null default 'usd';

-- ── Money (store in cents to avoid float drift) ─────────────────────────────
alter table public.appointments add column if not exists visit_subtotal_cents  integer;
alter table public.appointments add column if not exists deposit_amount_cents   integer not null default 5000;  -- $50
alter table public.appointments add column if not exists balance_due_cents      integer;
alter table public.appointments add column if not exists deposit_paid_at        timestamptz;
alter table public.appointments add column if not exists balance_paid_at        timestamptz;

-- ── CRM linkage ─────────────────────────────────────────────────────────────
alter table public.appointments add column if not exists attio_person_id        text;
alter table public.appointments add column if not exists attio_synced_at        timestamptz;

-- payment_status lifecycle (text, already exists, default 'pending'):
--   pending -> deposit_paid -> paid_in_full   (or 'refunded')

-- Fast lookups from webhooks (Stripe session/PI -> appointment, Acuity id -> appointment)
create index if not exists idx_appointments_stripe_session
  on public.appointments (stripe_checkout_session_id);
create index if not exists idx_appointments_stripe_deposit_pi
  on public.appointments (stripe_deposit_payment_intent);
create index if not exists idx_appointments_acuity_id
  on public.appointments (acuity_appointment_id);
create index if not exists idx_appointments_attio_person
  on public.appointments (attio_person_id);
