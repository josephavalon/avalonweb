-- Durable membership IV credits.
--
-- Credits never expire. Balance is the sum of posted ledger units for a member.
-- Positive rows grant credits; negative rows redeem credits against IV visits.

create table if not exists public.member_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  member_email text,
  appointment_id uuid references public.appointments(id) on delete set null,
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  source text not null check (source in (
    'membership_initial_grant',
    'membership_renewal_grant',
    'iv_credit_redemption',
    'admin_adjustment'
  )),
  units integer not null check (units <> 0),
  credit_value_cents integer not null default 0 check (credit_value_cents >= 0),
  currency text not null default 'usd',
  description text,
  external_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_credit_ledger_tenant_email
  on public.member_credit_ledger (tenant_id, lower(member_email), created_at desc);
create index if not exists idx_member_credit_ledger_tenant_profile
  on public.member_credit_ledger (tenant_id, profile_id, created_at desc);
create index if not exists idx_member_credit_ledger_appointment
  on public.member_credit_ledger (appointment_id);

create unique index if not exists uq_member_credit_source_checkout
  on public.member_credit_ledger (tenant_id, source, stripe_checkout_session_id);

create unique index if not exists uq_member_credit_source_invoice
  on public.member_credit_ledger (tenant_id, source, stripe_invoice_id);

alter table public.member_credit_ledger enable row level security;

drop policy if exists "member credit self or staff read" on public.member_credit_ledger;
create policy "member credit self or staff read"
  on public.member_credit_ledger for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or profile_id = auth.uid()
    or lower(coalesce(member_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "member credit operator write" on public.member_credit_ledger;
create policy "member credit operator write"
  on public.member_credit_ledger for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

grant select on public.member_credit_ledger to authenticated;
grant insert, update, delete on public.member_credit_ledger to authenticated;
