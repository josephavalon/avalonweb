-- 036_wallets.sql
-- Patient wallets: dollars-in-cents balance per profile. Subscriptions credit
-- the wallet on invoice.paid; bookings debit it first (Stripe covers only the
-- remainder). Cancellations ≥ 48h before the appointment RE-credit the wallet
-- (default policy — refund_to_card is opt-in per booking, not global).
--
-- Every mutation goes through apply_wallet_transaction(...) so the balance and
-- the audit row are written in one transaction and stay in lockstep. Direct
-- UPDATEs on wallets.balance_cents from clients are blocked by RLS + a trigger.

create table if not exists public.wallets (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null unique references public.profiles(id) on delete cascade,
  balance_cents  integer not null default 0 check (balance_cents >= 0),
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists wallets_profile_idx on public.wallets (profile_id);

create table if not exists public.wallet_transactions (
  id               uuid primary key default gen_random_uuid(),
  wallet_id        uuid not null references public.wallets(id) on delete cascade,
  delta_cents      integer not null check (delta_cents <> 0),
  kind             text not null
                     check (kind in (
                       'admin_credit',       -- admin manually adds funds
                       'admin_debit',        -- admin removes funds (rare)
                       'subscription_credit',-- invoice.paid → monthly plan value
                       'booking_debit',      -- IV booking consumes balance
                       'booking_refund',     -- cancel ≥ 48h → credit back
                       'promo_credit',       -- promo code awards wallet credit
                       'gift_card_credit',   -- gift card redemption
                       'adjustment'          -- ops correction
                     )),
  actor_admin_id   uuid references public.profiles(id) on delete set null,
  idempotency_key  text unique,               -- webhook + retry safety
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_idx on public.wallet_transactions (wallet_id, created_at desc);
create index if not exists wallet_transactions_kind_idx on public.wallet_transactions (kind);

-- Atomic mutation: insert the audit row + update wallets.balance_cents in one
-- transaction. Returns the new balance. Idempotency: if idempotency_key already
-- exists, return the pre-existing balance without a second write.
create or replace function public.apply_wallet_transaction(
  p_profile_id     uuid,
  p_delta_cents    integer,
  p_kind           text,
  p_actor_admin_id uuid default null,
  p_idempotency    text default null,
  p_metadata       jsonb default '{}'::jsonb
) returns table (wallet_id uuid, balance_cents integer, transaction_id uuid, already_applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id      uuid;
  v_balance        integer;
  v_existing_tx    uuid;
  v_tx_id          uuid;
begin
  if p_delta_cents = 0 then
    raise exception 'delta_cents must be non-zero';
  end if;

  -- Idempotency short-circuit.
  if p_idempotency is not null then
    select id into v_existing_tx from public.wallet_transactions where idempotency_key = p_idempotency;
    if v_existing_tx is not null then
      select w.id, w.balance_cents into v_wallet_id, v_balance
      from public.wallets w
      join public.wallet_transactions t on t.wallet_id = w.id
      where t.id = v_existing_tx;
      return query select v_wallet_id, v_balance, v_existing_tx, true;
      return;
    end if;
  end if;

  -- Lazy-create wallet on first touch.
  insert into public.wallets (profile_id) values (p_profile_id)
  on conflict (profile_id) do update set updated_at = public.wallets.updated_at
  returning id, balance_cents into v_wallet_id, v_balance;

  -- Apply delta (CHECK on wallets.balance_cents catches overdraws).
  update public.wallets
  set balance_cents = balance_cents + p_delta_cents,
      updated_at = now()
  where id = v_wallet_id
  returning balance_cents into v_balance;

  insert into public.wallet_transactions
    (wallet_id, delta_cents, kind, actor_admin_id, idempotency_key, metadata)
  values
    (v_wallet_id, p_delta_cents, p_kind, p_actor_admin_id, p_idempotency, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_tx_id;

  return query select v_wallet_id, v_balance, v_tx_id, false;
end;
$$;

-- Direct client UPDATEs on wallets.balance_cents are a footgun — always go
-- through apply_wallet_transaction. Trigger blocks it.
create or replace function public.wallets_block_direct_balance_update()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() = 1
     and new.balance_cents is distinct from old.balance_cents
     and current_setting('app.wallet_atomic', true) is distinct from 'on' then
    raise exception 'balance_cents can only be mutated via apply_wallet_transaction';
  end if;
  return new;
end;
$$;

-- Guard is disabled inside the SECURITY DEFINER function by setting
-- app.wallet_atomic. Wrap the UPDATE inside apply_wallet_transaction so the
-- trigger allows it.
create or replace function public.apply_wallet_transaction(
  p_profile_id     uuid,
  p_delta_cents    integer,
  p_kind           text,
  p_actor_admin_id uuid default null,
  p_idempotency    text default null,
  p_metadata       jsonb default '{}'::jsonb
) returns table (wallet_id uuid, balance_cents integer, transaction_id uuid, already_applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id      uuid;
  v_balance        integer;
  v_existing_tx    uuid;
  v_tx_id          uuid;
begin
  if p_delta_cents = 0 then
    raise exception 'delta_cents must be non-zero';
  end if;

  perform set_config('app.wallet_atomic', 'on', true);

  if p_idempotency is not null then
    select id into v_existing_tx from public.wallet_transactions where idempotency_key = p_idempotency;
    if v_existing_tx is not null then
      select w.id, w.balance_cents into v_wallet_id, v_balance
      from public.wallets w
      join public.wallet_transactions t on t.wallet_id = w.id
      where t.id = v_existing_tx;
      return query select v_wallet_id, v_balance, v_existing_tx, true;
      return;
    end if;
  end if;

  insert into public.wallets (profile_id) values (p_profile_id)
  on conflict (profile_id) do update set updated_at = public.wallets.updated_at
  returning id, balance_cents into v_wallet_id, v_balance;

  update public.wallets
  set balance_cents = balance_cents + p_delta_cents,
      updated_at = now()
  where id = v_wallet_id
  returning balance_cents into v_balance;

  insert into public.wallet_transactions
    (wallet_id, delta_cents, kind, actor_admin_id, idempotency_key, metadata)
  values
    (v_wallet_id, p_delta_cents, p_kind, p_actor_admin_id, p_idempotency, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_tx_id;

  return query select v_wallet_id, v_balance, v_tx_id, false;
end;
$$;

drop trigger if exists wallets_block_direct_balance on public.wallets;
create trigger wallets_block_direct_balance
  before update on public.wallets
  for each row
  execute function public.wallets_block_direct_balance_update();

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

-- Owner-read policies: a signed-in patient sees only their own wallet + tx log.
create policy wallets_owner_read on public.wallets
  for select using (auth.uid() = profile_id);

create policy wallet_transactions_owner_read on public.wallet_transactions
  for select using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_id and w.profile_id = auth.uid()
    )
  );

grant select on public.wallets to authenticated;
grant select on public.wallet_transactions to authenticated;

grant select, insert, update on public.wallets to service_role;
grant select, insert, update on public.wallet_transactions to service_role;
grant execute on function public.apply_wallet_transaction to service_role;
