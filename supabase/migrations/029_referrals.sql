-- 029_referrals.sql
-- Referral program: per-member 8-char code + attribution + idempotency table.
-- Member shares ?ref=<code>, new signup attributes once, first paid visit grants
-- $50 visit credit to BOTH sides via member_credit_ledger (source='referral_bonus'
-- — which is allowed by the source CHECK extended in migration 023 once you
-- include it there; if 023 still uses the original CHECK, add 'referral_bonus'
-- to the list). Idempotent.

alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (referral_code)
  where referral_code is not null;

create table if not exists public.referrals (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid references public.tenants(id) on delete cascade,
  referrer_profile_id  uuid not null references public.profiles(id) on delete cascade,
  referee_profile_id   uuid not null references public.profiles(id) on delete cascade,
  code                 text not null,
  status               text not null default 'pending'
                        check (status in ('pending', 'credited', 'revoked', 'invalid')),
  created_at           timestamptz not null default now(),
  credited_at          timestamptz,
  appointment_id       uuid references public.appointments(id) on delete set null,
  referee_grant_id     uuid references public.member_credit_ledger(id) on delete set null,
  referrer_grant_id    uuid references public.member_credit_ledger(id) on delete set null
);

create unique index if not exists referrals_referee_uidx on public.referrals (referee_profile_id);
create index if not exists referrals_referrer_idx on public.referrals (referrer_profile_id);
create index if not exists referrals_code_idx on public.referrals (code);

alter table public.referrals enable row level security;

drop policy if exists "referrals self read" on public.referrals;
create policy "referrals self read"
  on public.referrals for select
  using (referrer_profile_id = auth.uid() or referee_profile_id = auth.uid());

-- Extend the member_credit_ledger source enum to include the new grant sources.
-- (Idempotent: drops then re-adds the CHECK with the full set.)
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
    'credit_expiry',
    'referral_bonus',
    'gift_card_redemption'
  ));
