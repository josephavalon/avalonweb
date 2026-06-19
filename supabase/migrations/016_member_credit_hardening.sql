-- 016: harden the member credit ledger (review of branch security/post-cso-mediums).
--
-- Fixes:
--  1) CRITICAL — atomic, balance-floored credit redemption. The old path checked
--     balance at checkout and inserted the debit later from the webhook with no
--     DB-level guard, so two concurrent redemptions could both pass and drive the
--     balance negative (one credit spent twice). Redemption now goes through a
--     single locked function that re-checks the balance and refuses to go negative.
--  2) HIGH — make the ledger append-only: operators may read + insert, never
--     UPDATE/DELETE. Corrections are offsetting `admin_adjustment` rows. Keeps an
--     auditable history and removes the silent-rewrite path.
--  3) HIGH — every read branch is now scoped to the caller's tenant, closing the
--     cross-tenant leak where a matching member_email could read another tenant's
--     credits.

-- ── (3) Tenant-scoped read policy ──────────────────────────────────────────
drop policy if exists "member credit self or staff read" on public.member_credit_ledger;
create policy "member credit self or staff read"
  on public.member_credit_ledger for select
  using (
    app_private.same_tenant(tenant_id)
    and (
      app_private.is_staff()
      or profile_id = auth.uid()
      or lower(coalesce(member_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ── (2) Append-only writes ─────────────────────────────────────────────────
-- Replace the broad "for all" operator policy with insert-only, and drop the
-- table-level UPDATE/DELETE grants. Service-role writers (webhook/checkout)
-- bypass RLS and are unaffected; no app role can rewrite or delete a ledger row.
drop policy if exists "member credit operator write" on public.member_credit_ledger;
create policy "member credit operator insert"
  on public.member_credit_ledger for insert
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

revoke update, delete on public.member_credit_ledger from authenticated;

-- ── (1) Atomic, balance-floored redemption ─────────────────────────────────
create or replace function public.redeem_member_credit(
  p_tenant_id           uuid,
  p_profile_id          uuid,
  p_member_email        text,
  p_appointment_id      uuid,
  p_checkout_session_id text,
  p_units               integer,
  p_credit_value_cents  integer,
  p_description         text,
  p_external_payload    jsonb
) returns public.member_credit_ledger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_units   integer := greatest(1, coalesce(p_units, 1));
  v_email   text    := nullif(lower(coalesce(p_member_email, '')), '');
  v_lockkey bigint;
  v_balance integer;
  v_row     public.member_credit_ledger;
begin
  if p_tenant_id is null or p_checkout_session_id is null then
    raise exception 'redeem_member_credit_bad_args';
  end if;
  if p_profile_id is null and v_email is null then
    raise exception 'redeem_member_credit_no_member';
  end if;

  -- Idempotent: this checkout session already redeemed → return the existing row.
  select * into v_row from public.member_credit_ledger
   where tenant_id = p_tenant_id
     and source = 'iv_credit_redemption'
     and stripe_checkout_session_id = p_checkout_session_id
   limit 1;
  if found then
    return v_row;
  end if;

  -- Serialize concurrent redemptions for this member so the balance check and
  -- the debit are one atomic step (held until this txn commits).
  v_lockkey := hashtextextended(
    p_tenant_id::text || ':' || coalesce(p_profile_id::text, v_email), 0);
  perform pg_advisory_xact_lock(v_lockkey);

  -- Re-check idempotency under the lock.
  select * into v_row from public.member_credit_ledger
   where tenant_id = p_tenant_id
     and source = 'iv_credit_redemption'
     and stripe_checkout_session_id = p_checkout_session_id
   limit 1;
  if found then
    return v_row;
  end if;

  select coalesce(sum(units), 0) into v_balance
    from public.member_credit_ledger
   where tenant_id = p_tenant_id
     and (
       (p_profile_id is not null and profile_id = p_profile_id)
       or (v_email is not null and lower(member_email) = v_email)
     );

  if v_balance < v_units then
    raise exception 'insufficient_member_credit' using errcode = 'check_violation';
  end if;

  begin
    insert into public.member_credit_ledger (
      tenant_id, profile_id, member_email, appointment_id,
      stripe_checkout_session_id, source, units, credit_value_cents,
      currency, description, external_payload
    ) values (
      p_tenant_id, p_profile_id, v_email, p_appointment_id,
      p_checkout_session_id, 'iv_credit_redemption', -v_units,
      greatest(0, coalesce(p_credit_value_cents, 0)), 'usd',
      coalesce(p_description, 'IV credit redeemed'), coalesce(p_external_payload, '{}'::jsonb)
    )
    returning * into v_row;
  exception when unique_violation then
    -- A concurrent delivery inserted the same session's redemption first.
    select * into v_row from public.member_credit_ledger
     where tenant_id = p_tenant_id
       and source = 'iv_credit_redemption'
       and stripe_checkout_session_id = p_checkout_session_id
     limit 1;
  end;

  return v_row;
end;
$$;

-- Only privileged (service-role / definer) callers may redeem.
revoke all on function public.redeem_member_credit(uuid,uuid,text,uuid,text,integer,integer,text,jsonb) from public;
revoke all on function public.redeem_member_credit(uuid,uuid,text,uuid,text,integer,integer,text,jsonb) from anon;
revoke all on function public.redeem_member_credit(uuid,uuid,text,uuid,text,integer,integer,text,jsonb) from authenticated;
