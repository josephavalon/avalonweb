-- 006_scheduling_lock.sql
--
-- Double-booking guard. The Stripe webhook and the client return-page
-- (api/checkout/verify.js) both create the Acuity appointment after payment.
-- `claimSchedulingCreation()` (api/_checkout-fulfillment.js) uses this column as
-- an atomic, time-expiring claim so only ONE path creates the appointment — a
-- nurse can no longer be double-booked by a single checkout. The column is
-- nullable and the add is idempotent, so this is safe to run anytime.

alter table public.appointments
  add column if not exists scheduling_lock_at timestamptz;
