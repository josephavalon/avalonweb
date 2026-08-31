-- Evidence-only contractor payout settlement reconciliation.
--
-- This migration never calls Mercury and cannot create provider or bank
-- evidence. It recognizes settlement only when a separately ingested,
-- signature-valid terminal Mercury event and a posted bank item already agree
-- with the locked payout command, payout item, payable, amount, and currency.

do $$
begin
  if to_regclass('public.payout_items') is null
     or to_regclass('public.payout_batches') is null
     or to_regclass('public.payables') is null
     or to_regclass('public.payout_events') is null
     or to_regclass('public.finance_integration_commands') is null
     or to_regclass('public.finance_integration_events') is null
     or to_regclass('public.bank_statement_items') is null
     or to_regclass('public.reconciliation_matches') is null
     or to_regprocedure('app_private.assert_payops_actor_role(uuid,uuid,text[])') is null
     or to_regprocedure('app_private.lock_payops_idempotency(uuid,text,text)') is null
     or to_regprocedure('app_private.lock_payops_aggregate(uuid,text,uuid)') is null
     or to_regprocedure('app_private.finance_command_checksum(jsonb)') is null
     or to_regprocedure('app_private.guard_payout_aggregate()') is null
     or not exists (
       select 1 from pg_attribute
       where attrelid = 'public.bank_statement_items'::regclass
         and attname = 'normalized_direction' and not attisdropped
     )
     or to_regprocedure('digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'contractor_settlement_prerequisites_missing';
  end if;
end $$;

-- Core finance tables remain SELECT-only for service_role. This bounded RPC is
-- the contractor adapter's only PENDING -> CLAIMED path; the payout command
-- trigger installed by 070 and split safely by 073/074 performs the final
-- approval, role, destination, tax, engagement, and checksum revalidation.
create or replace function public.claim_contractor_payout_command(
  p_tenant_id uuid,
  p_command_id uuid,
  p_expected_request_checksum text,
  p_claimed_by text
)
returns public.finance_integration_commands
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_command public.finance_integration_commands%rowtype;
  v_payable_id uuid;
begin
  if p_tenant_id is null
     or p_command_id is null
     or coalesce(p_expected_request_checksum, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_claimed_by, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$' then
    raise exception using errcode = '22023', message = 'contractor_payout_command_claim_request_invalid';
  end if;

  select * into v_command
  from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.id = p_command_id
    and command.provider = 'mercury'
    and command.aggregate_type = 'payout_item';
  if not found then
    raise exception using errcode = 'P0002', message = 'contractor_payout_command_not_found';
  end if;

  select item.payable_id into v_payable_id
  from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = v_command.aggregate_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'contractor_payout_command_not_found';
  end if;

  perform app_private.lock_payops_aggregate(
    p_tenant_id, 'payable', v_payable_id
  );

  select * into v_command
  from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.id = p_command_id
    and command.provider = 'mercury'
    and command.aggregate_type = 'payout_item'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'contractor_payout_command_not_found';
  end if;
  if v_command.request_checksum <> p_expected_request_checksum then
    raise exception using errcode = '40001', message = 'contractor_payout_command_claim_checksum_conflict';
  end if;
  if v_command.status = 'CLAIMED'
     and v_command.claimed_by = p_claimed_by
     and v_command.claimed_at is not null then
    return v_command;
  end if;
  if v_command.status <> 'PENDING'
     or v_command.next_attempt_at > clock_timestamp() then
    raise exception using errcode = '40001', message = 'contractor_payout_command_not_claimable';
  end if;

  update public.finance_integration_commands
  set status = 'CLAIMED',
      claimed_by = p_claimed_by,
      claimed_at = clock_timestamp(),
      attempt_count = attempt_count + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and id = p_command_id
    and provider = 'mercury'
    and aggregate_type = 'payout_item'
    and status = 'PENDING'
    and request_checksum = p_expected_request_checksum
    and next_attempt_at <= clock_timestamp()
  returning * into v_command;
  if not found then
    raise exception using errcode = '40001', message = 'contractor_payout_command_claim_conflict';
  end if;
  return v_command;
end;
$$;

revoke all on function public.claim_contractor_payout_command(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_contractor_payout_command(uuid, uuid, text, text)
  to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payout_batches'::regclass
      and conname = 'payout_batches_mercury_account_ref_check'
  ) then
    alter table public.payout_batches
      add constraint payout_batches_mercury_account_ref_check check (
        funding_account_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
      );
  end if;
end $$;

comment on column public.payout_batches.funding_account_ref is
  'Exact Mercury provider_account_id used by the approved outbox command; it is not a label or raw bank account number.';

-- Terminal adapters populate these safe, non-PHI fields before moving an
-- integration event to PROCESSED. Once processed, the event is frozen below.
alter table public.finance_integration_events
  add column if not exists provider_transaction_id text,
  add column if not exists settlement_amount_cents bigint,
  add column if not exists settlement_currency text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.finance_integration_events'::regclass
      and conname = 'finance_integration_events_settlement_fields_check'
  ) then
    alter table public.finance_integration_events
      add constraint finance_integration_events_settlement_fields_check check (
        (provider_transaction_id is null and settlement_amount_cents is null and settlement_currency is null)
        or (
          provider_transaction_id is not null
          and settlement_amount_cents is not null
          and settlement_currency is not null
          and provider_transaction_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'
          and settlement_amount_cents > 0
          and settlement_currency ~ '^[A-Z]{3}$'
        )
      );
  end if;
end $$;

create unique index if not exists finance_events_mercury_terminal_transaction_uidx
  on public.finance_integration_events (tenant_id, provider, provider_transaction_id)
  where provider = 'mercury' and event_type = 'PAYOUT_SETTLED'
    and status = 'PROCESSED' and provider_transaction_id is not null;

-- This index is also created by the vendor AP migration. Reasserting it here
-- makes bank capacity fail closed even when this slice is reviewed alone.
create unique index if not exists reconciliation_matches_bank_approved_uidx
  on public.reconciliation_matches (tenant_id, bank_statement_item_id)
  where match_status = 'APPROVED';

create unique index if not exists reconciliation_matches_payout_approved_uidx
  on public.reconciliation_matches (tenant_id, payout_item_id)
  where payout_item_id is not null and match_status = 'APPROVED';

create table if not exists public.contractor_payout_settlement_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_item_id uuid not null,
  payable_id uuid not null,
  command_id uuid not null,
  finance_integration_event_id uuid not null,
  bank_statement_item_id uuid not null,
  reconciliation_match_id uuid not null,
  provider_transaction_id text not null
    check (provider_transaction_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  evidence_checksum text not null check (evidence_checksum ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  recorded_by uuid not null,
  request_idempotency_key text not null
    check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint contractor_payout_settlement_item_fk
    foreign key (tenant_id, payout_item_id)
    references public.payout_items(tenant_id, id) on delete restrict,
  constraint contractor_payout_settlement_payable_fk
    foreign key (tenant_id, payable_id)
    references public.payables(tenant_id, id) on delete restrict,
  constraint contractor_payout_settlement_command_fk
    foreign key (tenant_id, command_id)
    references public.finance_integration_commands(tenant_id, id) on delete restrict,
  constraint contractor_payout_settlement_provider_event_fk
    foreign key (tenant_id, finance_integration_event_id)
    references public.finance_integration_events(tenant_id, id) on delete restrict,
  constraint contractor_payout_settlement_bank_fk
    foreign key (tenant_id, bank_statement_item_id)
    references public.bank_statement_items(tenant_id, id) on delete restrict,
  constraint contractor_payout_settlement_reconciliation_fk
    foreign key (tenant_id, reconciliation_match_id)
    references public.reconciliation_matches(tenant_id, id) on delete restrict,
  constraint contractor_payout_settlement_actor_fk
    foreign key (tenant_id, recorded_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, payout_item_id),
  unique (tenant_id, payable_id),
  unique (tenant_id, finance_integration_event_id),
  unique (tenant_id, bank_statement_item_id),
  unique (tenant_id, reconciliation_match_id),
  unique (tenant_id, provider_transaction_id),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

alter table public.contractor_payout_settlement_evidence enable row level security;
revoke all on public.contractor_payout_settlement_evidence
  from public, anon, authenticated, service_role;
grant select on public.contractor_payout_settlement_evidence to service_role;

create or replace function app_private.guard_contractor_settlement_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'contractor_payout_settlement_evidence' then
    raise exception using errcode = 'P0001', message = 'contractor_settlement_evidence_immutable';
  end if;
  if tg_table_name = 'finance_integration_events'
     and old.provider = 'mercury'
     and old.event_type = 'PAYOUT_SETTLED'
     and old.status = 'PROCESSED' then
    raise exception using errcode = 'P0001', message = 'terminal_mercury_event_immutable';
  end if;
  if tg_table_name = 'finance_integration_commands' and exists (
    select 1 from public.contractor_payout_settlement_evidence evidence
    where evidence.tenant_id = old.tenant_id and evidence.command_id = old.id
  ) then
    raise exception using errcode = 'P0001', message = 'settled_mercury_command_immutable';
  end if;
  if tg_table_name = 'bank_statement_items' and exists (
    select 1 from public.reconciliation_matches match
    where match.tenant_id = old.tenant_id
      and match.bank_statement_item_id = old.id
      and match.payout_item_id is not null
      and match.match_status = 'APPROVED'
  ) then
    raise exception using errcode = 'P0001', message = 'matched_bank_evidence_immutable';
  end if;
  if tg_table_name = 'reconciliation_matches'
     and old.payout_item_id is not null
     and old.match_status = 'APPROVED' then
    raise exception using errcode = 'P0001', message = 'approved_payout_reconciliation_immutable';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_contractor_settlement_evidence()
  from public, anon, authenticated, service_role;

drop trigger if exists contractor_payout_settlement_evidence_immutable
  on public.contractor_payout_settlement_evidence;
create trigger contractor_payout_settlement_evidence_immutable
  before update or delete on public.contractor_payout_settlement_evidence
  for each row execute function app_private.guard_contractor_settlement_evidence();

drop trigger if exists finance_events_terminal_mercury_immutable
  on public.finance_integration_events;
create trigger finance_events_terminal_mercury_immutable
  before update or delete on public.finance_integration_events
  for each row execute function app_private.guard_contractor_settlement_evidence();

drop trigger if exists settled_mercury_commands_immutable
  on public.finance_integration_commands;
create trigger settled_mercury_commands_immutable
  before update or delete on public.finance_integration_commands
  for each row execute function app_private.guard_contractor_settlement_evidence();

drop trigger if exists bank_items_after_payout_match_immutable
  on public.bank_statement_items;
create trigger bank_items_after_payout_match_immutable
  before update or delete on public.bank_statement_items
  for each row execute function app_private.guard_contractor_settlement_evidence();

drop trigger if exists approved_payout_reconciliation_immutable
  on public.reconciliation_matches;
create trigger approved_payout_reconciliation_immutable
  before update or delete on public.reconciliation_matches
  for each row execute function app_private.guard_contractor_settlement_evidence();

-- A SETTLED state is valid only after the immutable evidence record and exact
-- approved bank allocation already exist in the same transaction.
create or replace function app_private.guard_contractor_canonical_settlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'payout_items' then
    if new.status = 'SETTLED' and old.status is distinct from 'SETTLED' and not exists (
      select 1
      from public.contractor_payout_settlement_evidence evidence
      join public.reconciliation_matches match
        on match.tenant_id = evidence.tenant_id and match.id = evidence.reconciliation_match_id
      where evidence.tenant_id = new.tenant_id and evidence.payout_item_id = new.id
        and evidence.amount_cents = new.amount_cents and evidence.currency = new.currency
        and evidence.provider_transaction_id = new.provider_transaction_id
        and match.payout_item_id = new.id and match.match_status = 'APPROVED'
        and match.matched_amount_cents = new.amount_cents and match.variance_cents = 0
    ) then
      raise exception using errcode = 'P0001', message = 'canonical_payout_settlement_evidence_required';
    end if;
    if old.status = 'SETTLED' and (
      new.status is distinct from old.status
      or new.provider_transaction_id is distinct from old.provider_transaction_id
      or new.provider_observed_at is distinct from old.provider_observed_at
      or new.last_provider_success_at is distinct from old.last_provider_success_at
      or new.reconciliation_state is distinct from old.reconciliation_state
    ) then
      raise exception using errcode = 'P0001', message = 'settled_payout_canonical_state_immutable';
    end if;
  elsif tg_table_name = 'payables' then
    if new.status = 'SETTLED' and old.status is distinct from 'SETTLED' and not exists (
      select 1 from public.contractor_payout_settlement_evidence evidence
      where evidence.tenant_id = new.tenant_id and evidence.payable_id = new.id
        and evidence.amount_cents = new.net_cents and evidence.currency = new.currency
    ) then
      raise exception using errcode = 'P0001', message = 'canonical_payable_settlement_evidence_required';
    end if;
    if old.status = 'SETTLED' and (
      new.status is distinct from old.status
      or new.reconciliation_state is distinct from old.reconciliation_state
      or new.settled_at is distinct from old.settled_at
    ) then
      raise exception using errcode = 'P0001', message = 'settled_payable_canonical_state_immutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_contractor_canonical_settlement()
  from public, anon, authenticated, service_role;

drop trigger if exists payout_items_canonical_settlement_guard on public.payout_items;
create trigger payout_items_canonical_settlement_guard
  before update on public.payout_items
  for each row execute function app_private.guard_contractor_canonical_settlement();

drop trigger if exists payables_canonical_settlement_guard on public.payables;
create trigger payables_canonical_settlement_guard
  before update on public.payables
  for each row execute function app_private.guard_contractor_canonical_settlement();

create or replace function public.reconcile_contractor_payout_settlement(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payout_item_id uuid,
  p_expected_version integer,
  p_finance_integration_event_id uuid,
  p_bank_statement_item_id uuid,
  p_reason_code text,
  p_idempotency_key text
)
returns public.payout_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.payout_items%rowtype;
  v_batch public.payout_batches%rowtype;
  v_payable public.payables%rowtype;
  v_command public.finance_integration_commands%rowtype;
  v_provider_event public.finance_integration_events%rowtype;
  v_bank public.bank_statement_items%rowtype;
  v_match public.reconciliation_matches%rowtype;
  v_evidence public.contractor_payout_settlement_evidence%rowtype;
  v_executor_profile_id uuid;
  v_payable_id uuid;
  v_from_status text;
  v_request_hash text;
  v_evidence_checksum text;
  v_settled_at timestamptz;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['accountant_controller']::text[]
  );
  if p_expected_version is null or p_expected_version < 1
     or p_payout_item_id is null
     or p_finance_integration_event_id is null
     or p_bank_statement_item_id is null
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'contractor_settlement_request_invalid';
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'payout_item_id', p_payout_item_id,
    'expected_version', p_expected_version,
    'finance_integration_event_id', p_finance_integration_event_id,
    'bank_statement_item_id', p_bank_statement_item_id,
    'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'reconcile_contractor_payout_settlement', p_idempotency_key
  );
  select * into v_evidence
  from public.contractor_payout_settlement_evidence evidence
  where evidence.tenant_id = p_tenant_id
    and evidence.request_idempotency_key = p_idempotency_key;
  if found then
    if v_evidence.payout_item_id is distinct from p_payout_item_id
       or v_evidence.finance_integration_event_id is distinct from p_finance_integration_event_id
       or v_evidence.bank_statement_item_id is distinct from p_bank_statement_item_id
       or v_evidence.recorded_by is distinct from p_actor_profile_id
       or v_evidence.reason_code is distinct from p_reason_code
       or v_evidence.request_hash is distinct from v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_item from public.payout_items item
    where item.tenant_id = p_tenant_id and item.id = p_payout_item_id;
    return v_item;
  end if;

  select item.payable_id into v_payable_id
  from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = p_payout_item_id;
  if not found then raise exception using errcode = 'P0002', message = 'payout_item_not_found'; end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payable', v_payable_id);

  select * into v_item from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = p_payout_item_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'payout_item_not_found'; end if;
  if v_item.version <> p_expected_version
     or v_item.provider <> 'mercury'
     or v_item.status not in ('PROVIDER_PENDING', 'SUBMITTED', 'IN_TRANSIT', 'RECONCILIATION_REQUIRED')
     or v_item.reconciliation_state = 'MATCHED' then
    raise exception using errcode = '40001', message = 'payout_settlement_version_or_state_conflict';
  end if;

  select * into v_batch from public.payout_batches batch
  where batch.tenant_id = p_tenant_id and batch.id = v_item.payout_batch_id
  for update;
  select * into v_payable from public.payables payable
  where payable.tenant_id = p_tenant_id and payable.id = v_item.payable_id
  for update;
  if v_batch.id is null or v_batch.status <> 'PROCESSING'
     or v_batch.send_mode <> 'approval_queue'
     or v_batch.item_count <> 1
     or v_batch.total_cents <> v_item.amount_cents
     or v_batch.currency <> v_item.currency
     or v_payable.id is null
     or v_payable.status not in ('PAYOUT_REQUESTED', 'RECONCILIATION_REQUIRED')
     or v_payable.hold_code is not null
     or v_payable.net_cents <> v_item.amount_cents
     or v_payable.currency <> v_item.currency then
    raise exception using errcode = 'P0001', message = 'payout_settlement_aggregate_mismatch';
  end if;

  select * into v_command from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.provider = 'mercury'
    and command.aggregate_type = 'payout_item'
    and command.aggregate_id = v_item.id
    and command.command_type = 'CREATE_APPROVAL_REQUEST'
  order by command.created_at desc, command.id desc
  limit 1
  for update;
  if v_command.id is null or v_command.status is distinct from 'SUCCEEDED'
     or v_command.created_by is null
     or v_item.checker_approved_by is null
     or v_command.request_checksum is distinct from app_private.finance_command_checksum(v_command.safe_payload)
     or v_command.safe_payload->>'payout_item_id' is distinct from v_item.id::text
     or v_command.safe_payload->>'payable_id' is distinct from v_payable.id::text
     or v_command.safe_payload->>'legal_entity_id' is distinct from v_batch.legal_entity_id::text
     or v_command.safe_payload->>'amount_cents' is distinct from v_item.amount_cents::text
     or v_command.safe_payload->>'currency' is distinct from v_item.currency
     or v_command.safe_payload->>'proposal_hash' is distinct from v_item.request_hash then
    raise exception using errcode = 'P0001', message = 'successful_mercury_command_required';
  end if;
  v_executor_profile_id := v_command.created_by;
  if p_actor_profile_id in (
       v_item.maker_prepared_by, v_item.checker_approved_by, v_executor_profile_id
     ) or not exists (
       select 1 from public.payout_approvals approval
       where approval.tenant_id = p_tenant_id
         and approval.payout_item_id = v_item.id
         and approval.decision = 'SEND_AUTHORIZED'
         and approval.approval_role = 'finance_executor'
         and approval.actor_profile_id = v_executor_profile_id
     ) then
    raise exception using errcode = '42501', message = 'independent_settlement_controller_required';
  end if;

  select * into v_provider_event from public.finance_integration_events event
  where event.tenant_id = p_tenant_id
    and event.id = p_finance_integration_event_id
    and event.provider = 'mercury'
    and event.event_type = 'PAYOUT_SETTLED'
    and event.aggregate_type = 'payout_item'
    and event.aggregate_id = v_item.id
    and event.correlation_id = v_command.correlation_id
    and event.signature_valid
    and event.status = 'PROCESSED'
    and event.safe_error_code is null
    and event.provider_transaction_id is not null
    and event.settlement_amount_cents = v_item.amount_cents
    and event.settlement_currency = v_item.currency
  -- Serialize allocation of this immutable terminal event. The unique
  -- evidence constraints remain the final one-use guard.
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'terminal_mercury_settlement_evidence_required';
  end if;
  if exists (
    select 1 from public.contractor_payout_settlement_evidence used
    where used.tenant_id = p_tenant_id
      and (used.finance_integration_event_id = v_provider_event.id
        or used.provider_transaction_id = v_provider_event.provider_transaction_id)
  ) then
    raise exception using errcode = 'P0001', message = 'mercury_settlement_evidence_already_used';
  end if;

  select * into v_bank from public.bank_statement_items bank
  where bank.tenant_id = p_tenant_id
    and bank.id = p_bank_statement_item_id
    and bank.legal_entity_id = v_batch.legal_entity_id
    and bank.provider = 'mercury'
    and bank.provider_account_id = v_batch.funding_account_ref
    and bank.provider_transaction_id = v_provider_event.provider_transaction_id
    and bank.normalized_direction = 'DEBIT'
    and abs(bank.amount_cents) = v_item.amount_cents
    and bank.currency = v_item.currency
    and lower(bank.provider_status) in ('posted', 'settled', 'completed')
    and bank.posted_at is not null
    and bank.last_success_at is not null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'posted_bank_settlement_evidence_mismatch';
  end if;
  if exists (
    select 1 from public.reconciliation_matches allocated
    where allocated.tenant_id = p_tenant_id
      and allocated.bank_statement_item_id = v_bank.id
      and allocated.match_status = 'APPROVED'
  ) then
    raise exception using errcode = 'P0001', message = 'bank_statement_capacity_exhausted';
  end if;

  v_evidence_checksum := encode(digest(jsonb_build_object(
    'payout_item_id', v_item.id,
    'payable_id', v_payable.id,
    'command_id', v_command.id,
    'command_request_checksum', v_command.request_checksum,
    'finance_integration_event_id', v_provider_event.id,
    'provider_event_id', v_provider_event.provider_event_id,
    'provider_event_payload_checksum', v_provider_event.payload_checksum,
    'bank_statement_item_id', v_bank.id,
    'bank_payload_checksum', v_bank.payload_checksum,
    'bank_provider_account_id', v_bank.provider_account_id,
    'bank_normalized_direction', v_bank.normalized_direction,
    'provider_transaction_id', v_provider_event.provider_transaction_id,
    'amount_cents', v_item.amount_cents,
    'currency', v_item.currency,
    'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  insert into public.reconciliation_matches (
    tenant_id, bank_statement_item_id, payout_item_id,
    match_status, matched_amount_cents, variance_cents, policy_version,
    proposed_by, approved_by, approved_at
  ) values (
    p_tenant_id, v_bank.id, v_item.id,
    'APPROVED', v_item.amount_cents, 0, 'contractor_payout_v1_exact',
    'HUMAN', p_actor_profile_id, clock_timestamp()
  ) returning * into v_match;

  insert into public.contractor_payout_settlement_evidence (
    tenant_id, payout_item_id, payable_id, command_id,
    finance_integration_event_id, bank_statement_item_id, reconciliation_match_id,
    provider_transaction_id, amount_cents, currency, evidence_checksum,
    reason_code, recorded_by, request_idempotency_key, request_hash
  ) values (
    p_tenant_id, v_item.id, v_payable.id, v_command.id,
    v_provider_event.id, v_bank.id, v_match.id,
    v_provider_event.provider_transaction_id, v_item.amount_cents, v_item.currency,
    v_evidence_checksum, p_reason_code, p_actor_profile_id,
    p_idempotency_key, v_request_hash
  ) returning * into v_evidence;

  v_from_status := v_item.status;
  v_settled_at := coalesce(v_provider_event.occurred_at, v_bank.posted_at, v_provider_event.received_at);
  update public.payout_items
  set status = 'SETTLED',
      provider_transaction_id = v_provider_event.provider_transaction_id,
      provider_observed_at = coalesce(v_provider_event.occurred_at, v_provider_event.received_at),
      last_provider_success_at = v_provider_event.received_at,
      reconciliation_state = 'MATCHED',
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_item.id
    and version = p_expected_version
  returning * into v_item;
  if not found then
    raise exception using errcode = '40001', message = 'payout_settlement_version_or_state_conflict';
  end if;

  update public.payables
  set status = 'SETTLED',
      reconciliation_state = 'MATCHED',
      settled_at = v_settled_at,
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_payable.id
    and status in ('PAYOUT_REQUESTED', 'RECONCILIATION_REQUIRED');
  if not found then
    raise exception using errcode = '40001', message = 'payable_settlement_version_or_state_conflict';
  end if;

  update public.payout_batches
  set status = 'COMPLETE', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_batch.id and status = 'PROCESSING';
  if not found then
    raise exception using errcode = '40001', message = 'payout_batch_settlement_state_conflict';
  end if;

  insert into public.payout_events (
    tenant_id, payout_item_id, from_status, to_status, source,
    source_event_id, source_checksum, actor_profile_id, occurred_at,
    safe_reason_code
  ) values (
    p_tenant_id, v_item.id, v_from_status, 'SETTLED', 'reconciliation',
    v_provider_event.provider_event_id, v_evidence_checksum,
    p_actor_profile_id, v_settled_at, p_reason_code
  );

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payout_settlement_reconciled',
    'payout_items', v_item.id, false, v_request_hash,
    jsonb_build_object(
      'payable_id', v_payable.id,
      'command_id', v_command.id,
      'finance_integration_event_id', v_provider_event.id,
      'bank_statement_item_id', v_bank.id,
      'reconciliation_match_id', v_match.id,
      'provider_transaction_id', v_provider_event.provider_transaction_id,
      'amount_cents', v_item.amount_cents,
      'currency', v_item.currency,
      'reason_code', p_reason_code
    )
  );
  return v_item;
end;
$$;

revoke all on function public.reconcile_contractor_payout_settlement(
  uuid, uuid, uuid, integer, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.reconcile_contractor_payout_settlement(
  uuid, uuid, uuid, integer, uuid, uuid, text, text
) to service_role;

comment on function public.reconcile_contractor_payout_settlement(
  uuid, uuid, uuid, integer, uuid, uuid, text, text
) is 'Recognizes contractor settlement only from an immutable processed terminal Mercury event plus an unused posted bank item. It performs no provider call and cannot create either evidence source.';

comment on table public.contractor_payout_settlement_evidence is
  'Append-only, PHI-free binding between a settled contractor payout, terminal Mercury event, posted bank item, and exact approved reconciliation match.';
