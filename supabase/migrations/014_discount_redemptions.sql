-- Discount redemption tracking for Stripe Checkout promotion codes.
--
-- Stripe remains the source of truth for coupon / promotion-code creation.
-- This table stores the tenant-scoped redemption facts the admin console needs
-- without putting customer or clinical detail into Stripe metadata.

create table if not exists public.discount_redemptions (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  appointment_id              uuid references public.appointments(id) on delete set null,
  stripe_checkout_session_id  text not null,
  stripe_payment_intent_id    text,
  stripe_customer_id          text,
  stripe_discount_id          text,
  stripe_coupon_id            text,
  stripe_promotion_code_id    text,
  redemption_key              text not null,
  code                        text,
  coupon_name                 text,
  discount_type               text,
  percent_off                 numeric(7,4),
  amount_off_cents            integer,
  amount_discount_cents       integer not null default 0,
  currency                    text not null default 'usd',
  full_comp                   boolean not null default false,
  redeemed_at                 timestamptz not null default now(),
  external_payload            jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create unique index if not exists uq_discount_redemptions_checkout_key
  on public.discount_redemptions (tenant_id, stripe_checkout_session_id, redemption_key);

create index if not exists idx_discount_redemptions_tenant_redeemed
  on public.discount_redemptions (tenant_id, redeemed_at desc);

create index if not exists idx_discount_redemptions_appointment
  on public.discount_redemptions (appointment_id);

alter table public.discount_redemptions enable row level security;
grant select, insert, update, delete on public.discount_redemptions to authenticated;

drop policy if exists "discount redemptions tenant staff read" on public.discount_redemptions;
create policy "discount redemptions tenant staff read"
  on public.discount_redemptions for select
  using (app_private.same_tenant(tenant_id) and app_private.is_staff());

drop policy if exists "discount redemptions tenant operator write" on public.discount_redemptions;
create policy "discount redemptions tenant operator write"
  on public.discount_redemptions for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());
