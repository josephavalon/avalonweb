-- 023_member_credit_expiry.sql
-- Visit credits now carry a 1-year expiry, and we add two new ledger sources:
--   credit_refund_cancellation — a redeemed credit returned when an Acuity
--                                appointment is canceled.
--   credit_expiry              — negative-unit row posted by the expireStaleCredits
--                                sweep when a grant passes its expires_at.
-- Read paths (getMemberCreditBalance/listMemberCreditLedger) already net out
-- expired credits; this migration makes expiry durable + auditable. Idempotent.

-- 1. Expiry stamp on each grant.
alter table public.member_credit_ledger
  add column if not exists expires_at timestamptz;

-- 2. Allow the two new ledger sources (the existing CHECK rejects them).
alter table public.member_credit_ledger
  drop constraint if exists member_credit_ledger_source_check;
alter table public.member_credit_ledger
  add constraint member_credit_ledger_source_check
  check (source in (
    'membership_initial_grant',
    'membership_renewal_grant',
    'iv_credit_redemption',
    'admin_adjustment',
    'credit_refund_cancellation',
    'credit_expiry'
  ));

-- 3. Idempotency: one refund per canceled appointment.
create unique index if not exists uq_member_credit_refund_appointment
  on public.member_credit_ledger (tenant_id, source, appointment_id)
  where source = 'credit_refund_cancellation';

-- 4. Idempotency: one expiry row per grant (matches expireStaleCredits dedupe key).
create unique index if not exists uq_member_credit_expiry_grant
  on public.member_credit_ledger (tenant_id, (external_payload->>'expiredGrantId'))
  where source = 'credit_expiry';

-- 5. Sweep scan index.
create index if not exists idx_member_credit_ledger_expires_at
  on public.member_credit_ledger (tenant_id, expires_at)
  where units > 0 and expires_at is not null;
