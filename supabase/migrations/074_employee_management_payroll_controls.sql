-- Bounded employee + management payroll controls over the 067 PayOps tables.
--
-- This migration does not call Gusto, calculate statutory payroll, file tax,
-- move money, or infer that an employee was paid. It creates service-role-only
-- control RPCs and a PHI-minimized transactional outbox. A separate provider
-- adapter may be enabled by the server only after enrollment and canary gates.

do $$
begin
  if to_regclass('public.payroll_profiles') is null
     or to_regclass('public.payroll_calendars') is null
     or to_regclass('public.payroll_inputs') is null
     or to_regclass('public.payroll_runs') is null
     or to_regclass('public.payroll_items') is null
     or to_regclass('public.payroll_statements') is null
     or to_regclass('public.payroll_events') is null
     or to_regclass('public.bank_statement_items') is null
     or to_regclass('public.reconciliation_matches') is null
     or to_regclass('public.finance_integration_commands') is null
     or to_regclass('public.finance_integration_events') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='bank_statement_items'
         and column_name='normalized_direction'
     )
     or to_regprocedure('app_private.assert_payops_actor_role(uuid,uuid,text[])') is null
     or to_regprocedure('app_private.lock_payops_idempotency(uuid,text,text)') is null
     or to_regprocedure('app_private.lock_payops_aggregate(uuid,text,uuid)') is null
     or to_regprocedure('digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'payroll_control_prerequisites_missing';
  end if;
end $$;

alter table public.payroll_profiles
  add column if not exists worker_category text not null default 'employee',
  add column if not exists readiness_evidence_ref text,
  add column if not exists readiness_evidence_checksum text,
  add column if not exists prepared_by uuid,
  add column if not exists prepared_at timestamptz,
  add column if not exists request_idempotency_key text,
  add column if not exists request_hash text;

alter table public.payroll_calendars
  add column if not exists prepared_by uuid,
  add column if not exists prepared_at timestamptz,
  add column if not exists request_idempotency_key text,
  add column if not exists request_hash text;

alter table public.payroll_inputs
  add column if not exists prepared_by uuid,
  add column if not exists prepared_at timestamptz,
  add column if not exists request_idempotency_key text,
  add column if not exists request_hash text;

alter table public.payroll_runs
  add column if not exists prepared_by uuid,
  add column if not exists prepared_at timestamptz,
  add column if not exists request_idempotency_key text,
  add column if not exists request_hash text,
  add column if not exists hold_code text,
  add column if not exists hold_owner_profile_id uuid,
  add column if not exists cancelled_by uuid,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason_code text,
  add column if not exists last_reconciliation_event_id uuid,
  add column if not exists last_bank_statement_item_id uuid,
  add column if not exists last_reconciliation_match_id uuid,
  add column if not exists paid_provider_payload_checksum text,
  add column if not exists paid_controller_profile_id uuid,
  add column if not exists paid_evidence_recorded_at timestamptz;

-- Only the provider-ingestion service may populate this allowlisted,
-- checksum-bound representation of the signed Gusto event. Browser/API
-- callers never supply provider evidence fields to the reconciliation RPC.
alter table public.finance_integration_events
  add column if not exists provider_payload jsonb;

alter table public.payroll_events
  add column if not exists actor_profile_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists request_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_profiles'::regclass and conname = 'payroll_profiles_worker_category_check') then
    alter table public.payroll_profiles add constraint payroll_profiles_worker_category_check
      check (worker_category in ('employee', 'management'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_profiles'::regclass and conname = 'payroll_profiles_readiness_evidence_check') then
    alter table public.payroll_profiles add constraint payroll_profiles_readiness_evidence_check check (
      (readiness_evidence_ref is null and readiness_evidence_checksum is null)
      or (readiness_evidence_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
        and readiness_evidence_checksum ~ '^[0-9a-f]{64}$')
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_profiles'::regclass and conname = 'payroll_profiles_preparer_fk') then
    alter table public.payroll_profiles add constraint payroll_profiles_preparer_fk
      foreign key (tenant_id, prepared_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_calendars'::regclass and conname = 'payroll_calendars_preparer_fk') then
    alter table public.payroll_calendars add constraint payroll_calendars_preparer_fk
      foreign key (tenant_id, prepared_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_inputs'::regclass and conname = 'payroll_inputs_preparer_fk') then
    alter table public.payroll_inputs add constraint payroll_inputs_preparer_fk
      foreign key (tenant_id, prepared_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_preparer_fk') then
    alter table public.payroll_runs add constraint payroll_runs_preparer_fk
      foreign key (tenant_id, prepared_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_hold_owner_fk') then
    alter table public.payroll_runs add constraint payroll_runs_hold_owner_fk
      foreign key (tenant_id, hold_owner_profile_id) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_canceller_fk') then
    alter table public.payroll_runs add constraint payroll_runs_canceller_fk
      foreign key (tenant_id, cancelled_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_reconciliation_event_fk') then
    alter table public.payroll_runs add constraint payroll_runs_reconciliation_event_fk
      foreign key (tenant_id, last_reconciliation_event_id)
      references public.finance_integration_events(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_bank_statement_fk') then
    alter table public.payroll_runs add constraint payroll_runs_bank_statement_fk
      foreign key (tenant_id, last_bank_statement_item_id)
      references public.bank_statement_items(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_reconciliation_match_fk') then
    alter table public.payroll_runs add constraint payroll_runs_reconciliation_match_fk
      foreign key (tenant_id, last_reconciliation_match_id)
      references public.reconciliation_matches(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_paid_controller_fk') then
    alter table public.payroll_runs add constraint payroll_runs_paid_controller_fk
      foreign key (tenant_id, paid_controller_profile_id)
      references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_paid_evidence_check') then
    alter table public.payroll_runs add constraint payroll_runs_paid_evidence_check check (
      (status = 'PAID' and (
        last_reconciliation_event_id is not null
        and last_bank_statement_item_id is not null
        and last_reconciliation_match_id is not null
        and paid_provider_payload_checksum ~ '^[0-9a-f]{64}$'
        and paid_controller_profile_id is not null
        and paid_evidence_recorded_at is not null
      )) or (status <> 'PAID'
        and last_bank_statement_item_id is null
        and last_reconciliation_match_id is null
        and paid_provider_payload_checksum is null
        and paid_controller_profile_id is null
        and paid_evidence_recorded_at is null)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.finance_integration_events'::regclass and conname = 'finance_integration_events_provider_payload_object_check') then
    alter table public.finance_integration_events add constraint finance_integration_events_provider_payload_object_check
      check (provider_payload is null or jsonb_typeof(provider_payload) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_events'::regclass and conname = 'payroll_events_actor_fk') then
    alter table public.payroll_events add constraint payroll_events_actor_fk
      foreign key (tenant_id, actor_profile_id) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_events'::regclass and conname = 'payroll_events_control_request_check') then
    alter table public.payroll_events add constraint payroll_events_control_request_check check (
      (idempotency_key is null and request_hash is null)
      or (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
        and request_hash ~ '^[0-9a-f]{64}$')
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_hold_control_check') then
    alter table public.payroll_runs add constraint payroll_runs_hold_control_check check (
      (status = 'HELD' and hold_code ~ '^[A-Z0-9_]{3,100}$' and hold_owner_profile_id is not null)
      or status <> 'HELD'
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payroll_runs'::regclass and conname = 'payroll_runs_cancel_control_check') then
    alter table public.payroll_runs add constraint payroll_runs_cancel_control_check check (
      (status = 'CANCELLED' and cancelled_by is not null and cancelled_at is not null
        and cancel_reason_code ~ '^[A-Z0-9_]{3,100}$')
      or status <> 'CANCELLED'
    ) not valid;
  end if;
end $$;

-- Add explicit internal queue/hold states without weakening the existing
-- provider evidence states.
alter table public.payroll_runs drop constraint if exists payroll_runs_status_check;
alter table public.payroll_runs add constraint payroll_runs_status_check check (status in (
  'DRAFT', 'PREVIEW_QUEUED', 'PREVIEWED', 'HUMAN_APPROVED', 'SUBMISSION_QUEUED',
  'PROCESSING', 'EMPLOYER_FUNDED', 'EMPLOYEE_PAYMENT_PENDING', 'PAID', 'HELD',
  'ACTION_REQUIRED', 'FUNDING_FAILED', 'EMPLOYEE_PAYMENT_FAILED', 'TAX_OR_FILING_FAILED',
  'CANCELLED', 'CORRECTION_REQUIRED', 'OFF_CYCLE_REQUIRED', 'RECONCILIATION_REQUIRED'
));

-- A cancelled local run may be replaced after its inputs/calendar are unlocked,
-- while at most one non-cancelled provider run remains active per calendar.
alter table public.payroll_runs
  drop constraint if exists payroll_runs_tenant_id_payroll_calendar_id_provider_key;
create unique index if not exists payroll_runs_active_calendar_provider_key
  on public.payroll_runs (tenant_id, payroll_calendar_id, provider)
  where status <> 'CANCELLED';

create unique index if not exists payroll_profiles_request_idempotency_key
  on public.payroll_profiles (tenant_id, request_idempotency_key)
  where request_idempotency_key is not null;
create unique index if not exists payroll_calendars_request_idempotency_key
  on public.payroll_calendars (tenant_id, request_idempotency_key)
  where request_idempotency_key is not null;
create unique index if not exists payroll_inputs_request_idempotency_key
  on public.payroll_inputs (tenant_id, request_idempotency_key)
  where request_idempotency_key is not null;
create unique index if not exists payroll_runs_request_idempotency_key
  on public.payroll_runs (tenant_id, request_idempotency_key)
  where request_idempotency_key is not null;
create unique index if not exists payroll_events_control_idempotency_key
  on public.payroll_events (tenant_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists payroll_events_provider_reconciliation_once_uidx
  on public.payroll_events (tenant_id, provider_event_id)
  where event_type = 'PAYROLL_RECONCILED' and provider_event_id is not null;
create unique index if not exists reconciliation_matches_payroll_approved_uidx
  on public.reconciliation_matches (tenant_id, payroll_run_id)
  where payroll_run_id is not null and match_status = 'APPROVED';
create unique index if not exists reconciliation_matches_bank_payroll_approved_uidx
  on public.reconciliation_matches (tenant_id, bank_statement_item_id)
  where payroll_run_id is not null and match_status = 'APPROVED';

create or replace function app_private.payroll_control_hash(p_payload jsonb)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$ select encode(digest(p_payload::text, 'sha256'), 'hex') $$;

revoke all on function app_private.payroll_control_hash(jsonb)
  from public, anon, authenticated, service_role;

create or replace function app_private.guard_payroll_provider_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
  v_target_status text;
  v_expected_event_type text;
begin
  if tg_op = 'UPDATE' and (
    (old.provider = 'gusto_embedded' and old.aggregate_type = 'payroll_run')
    or (new.provider = 'gusto_embedded' and new.aggregate_type = 'payroll_run')
  ) then
    if old.tenant_id is distinct from new.tenant_id
       or old.provider is distinct from new.provider
       or old.provider_event_id is distinct from new.provider_event_id
       or old.event_type is distinct from new.event_type
       or old.aggregate_type is distinct from new.aggregate_type
       or old.aggregate_id is distinct from new.aggregate_id
       or old.payload_checksum is distinct from new.payload_checksum
       or old.signature_valid is distinct from new.signature_valid
       or old.occurred_at is distinct from new.occurred_at
       or old.received_at is distinct from new.received_at
       or old.correlation_id is distinct from new.correlation_id then
      raise exception using errcode = 'P0001', message = 'payroll_provider_event_identity_immutable';
    end if;
    if old.provider_payload is not null and old.provider_payload is distinct from new.provider_payload then
      raise exception using errcode = 'P0001', message = 'payroll_provider_payload_immutable';
    end if;
    if old.status is distinct from new.status and not (
      (old.status = 'RECEIVED' and new.status in ('PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED'))
      or (old.status = 'PROCESSING' and new.status in ('PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED'))
    ) then
      raise exception using errcode = 'P0001', message = 'payroll_provider_event_transition_invalid';
    end if;
    if old.status in ('PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED')
       and to_jsonb(old) is distinct from to_jsonb(new) then
      raise exception using errcode = 'P0001', message = 'payroll_provider_event_terminal_state_immutable';
    end if;
  end if;
  if new.provider <> 'gusto_embedded' or new.aggregate_type <> 'payroll_run' then
    return new;
  end if;
  v_payload := new.provider_payload;
  if new.status = 'PROCESSED' and (not new.signature_valid or v_payload is null) then
    raise exception using errcode = 'P0001', message = 'payroll_provider_event_signature_or_payload_invalid';
  end if;
  if v_payload is null then
    return new;
  end if;
  if jsonb_typeof(v_payload) <> 'object'
     or app_private.payroll_control_hash(v_payload) <> new.payload_checksum
     or coalesce(v_payload->>'tenant_id', '') <> new.tenant_id::text
     or coalesce(v_payload->>'payroll_run_id', '') <> new.aggregate_id::text
     or exists (
       select 1 from jsonb_object_keys(
         case when jsonb_typeof(v_payload) = 'object' then v_payload else '{}'::jsonb end
       ) key
       where key not in (
         'tenant_id', 'payroll_run_id', 'gusto_company_id', 'gusto_payroll_id',
         'target_status', 'currency', 'preview_version', 'preview_hash',
         'gross_cents', 'net_cents', 'employee_tax_cents', 'employer_tax_cents',
         'deduction_cents', 'reimbursement_cents', 'employer_cost_cents',
         'funding_status', 'employee_payment_status', 'tax_filing_status',
         'statement_status', 'reconciliation_state', 'funding_transaction_id',
         'funding_account_id', 'funding_amount_cents', 'bank_statement_payload_checksum', 'items'
       )
     ) then
    raise exception using errcode = 'P0001', message = 'payroll_provider_payload_binding_invalid';
  end if;
  v_target_status := v_payload->>'target_status';
  v_expected_event_type := case v_target_status
    when 'PREVIEWED' then 'PAYROLL_PREVIEW_READY'
    when 'PROCESSING' then 'PAYROLL_ACCEPTED'
    when 'EMPLOYER_FUNDED' then 'EMPLOYER_FUNDED'
    when 'EMPLOYEE_PAYMENT_PENDING' then 'EMPLOYEE_PAYMENT_PENDING'
    when 'PAID' then 'PAYROLL_PAID'
    when 'ACTION_REQUIRED' then 'PAYROLL_ACTION_REQUIRED'
    when 'FUNDING_FAILED' then 'PAYROLL_FUNDING_FAILED'
    when 'EMPLOYEE_PAYMENT_FAILED' then 'PAYROLL_PAYMENT_FAILED'
    when 'TAX_OR_FILING_FAILED' then 'PAYROLL_TAX_OR_FILING_FAILED'
    when 'RECONCILIATION_REQUIRED' then 'PAYROLL_RECONCILIATION_REQUIRED'
    else null
  end;
  if v_expected_event_type is null or new.event_type <> v_expected_event_type then
    raise exception using errcode = 'P0001', message = 'payroll_provider_event_type_binding_invalid';
  end if;
  if v_payload ? 'items' then
    if jsonb_typeof(v_payload->'items') is distinct from 'array' then
      raise exception using errcode = 'P0001', message = 'payroll_provider_items_invalid';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_payload->'items') item
      where jsonb_typeof(item) <> 'object'
         or exists (
           select 1 from jsonb_object_keys(
             case when jsonb_typeof(item) = 'object' then item else '{}'::jsonb end
           ) key
           where key not in (
             'payroll_item_id', 'payroll_profile_id', 'gusto_employee_id', 'net_cents',
             'payroll_statement_id', 'provider_statement_id', 'statement_checksum',
             'payment_status', 'statement_status'
           )
         )
    ) then
      raise exception using errcode = 'P0001', message = 'payroll_provider_items_invalid';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_payroll_provider_event()
  from public, anon, authenticated, service_role;

drop trigger if exists finance_integration_events_payroll_guard on public.finance_integration_events;
create trigger finance_integration_events_payroll_guard
before insert or update on public.finance_integration_events
for each row execute function app_private.guard_payroll_provider_event();

create table if not exists public.payroll_paid_statement_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_id uuid not null,
  payroll_item_id uuid not null,
  payroll_statement_id uuid not null,
  payroll_profile_id uuid not null,
  gusto_employee_id text not null,
  net_cents bigint not null check (net_cents >= 0),
  provider_statement_id text not null,
  statement_checksum text not null check (statement_checksum ~ '^[0-9a-f]{64}$'),
  provider_event_id uuid not null,
  recorded_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint payroll_paid_statement_evidence_run_fk foreign key (tenant_id, payroll_run_id)
    references public.payroll_runs(tenant_id, id) on delete restrict,
  constraint payroll_paid_statement_evidence_item_fk foreign key (tenant_id, payroll_item_id)
    references public.payroll_items(tenant_id, id) on delete restrict,
  constraint payroll_paid_statement_evidence_statement_fk foreign key (tenant_id, payroll_statement_id)
    references public.payroll_statements(tenant_id, id) on delete restrict,
  constraint payroll_paid_statement_evidence_profile_fk foreign key (tenant_id, payroll_profile_id)
    references public.payroll_profiles(tenant_id, id) on delete restrict,
  constraint payroll_paid_statement_evidence_event_fk foreign key (tenant_id, provider_event_id)
    references public.finance_integration_events(tenant_id, id) on delete restrict,
  constraint payroll_paid_statement_evidence_recorder_fk foreign key (tenant_id, recorded_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, payroll_run_id, payroll_item_id),
  unique (tenant_id, payroll_statement_id),
  unique (tenant_id, id)
);

alter table public.payroll_paid_statement_evidence enable row level security;
revoke all on public.payroll_paid_statement_evidence from public, anon, authenticated, service_role;
grant select on public.payroll_paid_statement_evidence to service_role;

create or replace function app_private.prevent_payroll_paid_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'payroll_paid_evidence_immutable';
end;
$$;

revoke all on function app_private.prevent_payroll_paid_evidence_mutation()
  from public, anon, authenticated, service_role;
drop trigger if exists payroll_paid_statement_evidence_immutable on public.payroll_paid_statement_evidence;
create trigger payroll_paid_statement_evidence_immutable
before update or delete on public.payroll_paid_statement_evidence
for each row execute function app_private.prevent_payroll_paid_evidence_mutation();

create or replace function app_private.guard_approved_payroll_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.payroll_run_id is not null and old.match_status = 'APPROVED' then
    raise exception using errcode = 'P0001', message = 'approved_payroll_reconciliation_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_approved_payroll_reconciliation()
  from public, anon, authenticated, service_role;
drop trigger if exists reconciliation_matches_payroll_approved_immutable on public.reconciliation_matches;
create trigger reconciliation_matches_payroll_approved_immutable
before update or delete on public.reconciliation_matches
for each row execute function app_private.guard_approved_payroll_reconciliation();

create or replace function app_private.guard_matched_payroll_bank_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.reconciliation_matches reconciliation
    where reconciliation.tenant_id=old.tenant_id
      and reconciliation.bank_statement_item_id=old.id
      and reconciliation.payroll_run_id is not null
      and reconciliation.match_status='APPROVED'
  ) then
    raise exception using errcode = 'P0001', message = 'matched_payroll_bank_evidence_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_matched_payroll_bank_evidence()
  from public, anon, authenticated, service_role;
drop trigger if exists bank_statement_items_payroll_match_immutable on public.bank_statement_items;
create trigger bank_statement_items_payroll_match_immutable
before update or delete on public.bank_statement_items
for each row execute function app_private.guard_matched_payroll_bank_evidence();

create or replace function app_private.guard_paid_payroll_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.payroll_runs run
    where run.tenant_id=old.tenant_id and run.id=old.payroll_run_id and run.status='PAID'
  ) then
    raise exception using errcode = 'P0001', message = 'paid_payroll_item_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_paid_payroll_item()
  from public, anon, authenticated, service_role;
drop trigger if exists payroll_items_paid_immutable on public.payroll_items;
create trigger payroll_items_paid_immutable
before update or delete on public.payroll_items
for each row execute function app_private.guard_paid_payroll_item();

create or replace function public.prepare_employee_payroll_profile(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_worker_profile_id uuid,
  p_legal_entity_id uuid,
  p_worker_category text,
  p_work_jurisdictions text[],
  p_tax_jurisdictions text[],
  p_gusto_company_id text,
  p_gusto_employee_id text,
  p_pay_schedule_ref text,
  p_readiness_evidence_ref text,
  p_readiness_evidence_checksum text,
  p_idempotency_key text
)
returns public.payroll_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.payroll_profiles%rowtype;
  v_decision public.engagement_decisions%rowtype;
  v_hash text;
  v_ready boolean;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['hr_legal']::text[]);
  if p_worker_category is null or p_worker_category not in ('employee', 'management')
     or coalesce(cardinality(p_work_jurisdictions), 0) not between 1 and 20
     or coalesce(cardinality(p_tax_jurisdictions), 0) not between 1 and 20
     or exists (select 1 from unnest(p_work_jurisdictions || p_tax_jurisdictions) value where value !~ '^[A-Z0-9_-]{2,40}$')
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_profile_request_invalid';
  end if;
  v_ready := nullif(trim(coalesce(p_gusto_company_id, '')), '') is not null
    and nullif(trim(coalesce(p_gusto_employee_id, '')), '') is not null
    and nullif(trim(coalesce(p_pay_schedule_ref, '')), '') is not null
    and coalesce(p_readiness_evidence_ref, '') ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
    and coalesce(p_readiness_evidence_checksum, '') ~ '^[0-9a-f]{64}$';
  if (p_gusto_company_id is not null and p_gusto_company_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$')
     or (p_gusto_employee_id is not null and p_gusto_employee_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$')
     or (p_pay_schedule_ref is not null and p_pay_schedule_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$')
     or ((p_readiness_evidence_ref is null) <> (p_readiness_evidence_checksum is null)) then
    raise exception using errcode = '22023', message = 'payroll_profile_provider_evidence_invalid';
  end if;
  v_hash := app_private.payroll_control_hash(jsonb_build_object(
    'tenant_id', p_tenant_id, 'worker_profile_id', p_worker_profile_id,
    'legal_entity_id', p_legal_entity_id, 'worker_category', p_worker_category,
    'work_jurisdictions', p_work_jurisdictions, 'tax_jurisdictions', p_tax_jurisdictions,
    'gusto_company_id', p_gusto_company_id, 'gusto_employee_id', p_gusto_employee_id,
    'pay_schedule_ref', p_pay_schedule_ref, 'readiness_evidence_ref', p_readiness_evidence_ref,
    'readiness_evidence_checksum', p_readiness_evidence_checksum, 'actor_profile_id', p_actor_profile_id
  ));
  perform app_private.lock_payops_idempotency(p_tenant_id, 'prepare_employee_payroll_profile', p_idempotency_key);
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payroll_worker', p_worker_profile_id);
  select * into v_profile from public.payroll_profiles profile
  where profile.tenant_id = p_tenant_id and profile.request_idempotency_key = p_idempotency_key;
  if found then
    if v_profile.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency_key_reused'; end if;
    return v_profile;
  end if;
  if exists (select 1 from public.payroll_profiles profile where profile.tenant_id = p_tenant_id
    and profile.worker_profile_id = p_worker_profile_id and profile.legal_entity_id = p_legal_entity_id) then
    raise exception using errcode = 'P0001', message = 'payroll_profile_already_exists';
  end if;
  select * into v_decision from public.engagement_decisions decision
  where decision.tenant_id = p_tenant_id and decision.worker_profile_id = p_worker_profile_id
    and decision.legal_entity_id = p_legal_entity_id and decision.decision_status = 'W2_EMPLOYEE'
    and decision.effective_from <= current_date
    and (decision.effective_through is null or decision.effective_through >= current_date)
    and not exists (select 1 from public.engagement_decisions newer
      where newer.tenant_id = decision.tenant_id and newer.worker_profile_id = decision.worker_profile_id
        and newer.legal_entity_id = decision.legal_entity_id and newer.decided_at > decision.decided_at
        and newer.effective_from <= current_date
        and (newer.effective_through is null or newer.effective_through >= current_date))
  for share;
  if v_decision.id is null then raise exception using errcode = 'P0001', message = 'effective_w2_decision_required'; end if;
  insert into public.payroll_profiles (
    tenant_id, worker_profile_id, legal_entity_id, worker_category,
    gusto_company_id, gusto_employee_id, work_jurisdictions, tax_jurisdictions,
    onboarding_status, coverage_status, pay_schedule_ref, payment_method_status,
    statement_status, readiness_evidence_ref, readiness_evidence_checksum,
    prepared_by, prepared_at, request_idempotency_key, request_hash
  ) values (
    p_tenant_id, p_worker_profile_id, p_legal_entity_id, p_worker_category,
    p_gusto_company_id, p_gusto_employee_id, p_work_jurisdictions, p_tax_jurisdictions,
    case when v_ready then 'READY' else 'NOT_STARTED' end,
    case when v_ready then 'VERIFIED' else 'UNVERIFIED' end,
    p_pay_schedule_ref, case when v_ready then 'READY' else 'UNKNOWN' end,
    'UNKNOWN', p_readiness_evidence_ref, p_readiness_evidence_checksum,
    p_actor_profile_id, clock_timestamp(), p_idempotency_key, v_hash
  ) returning * into v_profile;
  insert into public.audit_events (tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload_hash, payload)
  values (p_tenant_id, p_actor_profile_id, 'employee_payroll_profile_prepared', 'payroll_profiles', v_profile.id, false, v_hash,
    jsonb_build_object('worker_category', p_worker_category, 'legal_entity_id', p_legal_entity_id,
      'provider_ready', v_ready, 'profile_version', v_profile.version));
  return v_profile;
end;
$$;

revoke all on function public.prepare_employee_payroll_profile(uuid, uuid, uuid, uuid, text, text[], text[], text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_employee_payroll_profile(uuid, uuid, uuid, uuid, text, text[], text[], text, text, text, text, text, text)
  to service_role;

create or replace function public.prepare_payroll_calendar(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_legal_entity_id uuid,
  p_period_start date,
  p_period_end date,
  p_cutoff_at timestamptz,
  p_pay_date date,
  p_funding_date date,
  p_timezone text,
  p_run_type text,
  p_jurisdiction_policy_version text,
  p_idempotency_key text
)
returns public.payroll_calendars
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_calendar public.payroll_calendars%rowtype; v_hash text;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]);
  if p_period_start is null or p_period_end is null or p_cutoff_at is null or p_pay_date is null
     or p_period_end < p_period_start or p_pay_date < p_period_end
     or (p_funding_date is not null and p_funding_date > p_pay_date)
     or coalesce(p_timezone, '') !~ '^[A-Za-z_]+/[A-Za-z_]+$'
     or p_run_type not in ('REGULAR', 'OFF_CYCLE', 'FINAL_PAY')
     or coalesce(p_jurisdiction_policy_version, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_calendar_request_invalid';
  end if;
  v_hash := app_private.payroll_control_hash(jsonb_build_object(
    'tenant_id', p_tenant_id, 'legal_entity_id', p_legal_entity_id,
    'period_start', p_period_start, 'period_end', p_period_end, 'cutoff_at', p_cutoff_at,
    'pay_date', p_pay_date, 'funding_date', p_funding_date, 'timezone', p_timezone,
    'run_type', p_run_type, 'jurisdiction_policy_version', p_jurisdiction_policy_version,
    'actor_profile_id', p_actor_profile_id
  ));
  perform app_private.lock_payops_idempotency(p_tenant_id, 'prepare_payroll_calendar', p_idempotency_key);
  perform app_private.lock_payops_aggregate(p_tenant_id, 'legal_entity', p_legal_entity_id);
  select * into v_calendar from public.payroll_calendars calendar
  where calendar.tenant_id = p_tenant_id and calendar.request_idempotency_key = p_idempotency_key;
  if found then
    if v_calendar.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency_key_reused'; end if;
    return v_calendar;
  end if;
  insert into public.payroll_calendars (
    tenant_id, legal_entity_id, period_start, period_end, cutoff_at, pay_date,
    funding_date, timezone, run_type, jurisdiction_policy_version, status,
    prepared_by, prepared_at, request_idempotency_key, request_hash
  ) values (
    p_tenant_id, p_legal_entity_id, p_period_start, p_period_end, p_cutoff_at, p_pay_date,
    p_funding_date, p_timezone, p_run_type, p_jurisdiction_policy_version, 'OPEN',
    p_actor_profile_id, clock_timestamp(), p_idempotency_key, v_hash
  ) returning * into v_calendar;
  insert into public.audit_events (tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload_hash, payload)
  values (p_tenant_id, p_actor_profile_id, 'payroll_calendar_prepared', 'payroll_calendars', v_calendar.id, false, v_hash,
    jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end, 'pay_date', p_pay_date,
      'run_type', p_run_type, 'calendar_version', v_calendar.version));
  return v_calendar;
end;
$$;

revoke all on function public.prepare_payroll_calendar(uuid, uuid, uuid, date, date, timestamptz, date, date, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_payroll_calendar(uuid, uuid, uuid, date, date, timestamptz, date, date, text, text, text, text)
  to service_role;

create or replace function public.prepare_payroll_input(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payroll_profile_id uuid,
  p_payroll_calendar_id uuid,
  p_earning_event_id uuid,
  p_expected_earning_version integer,
  p_taxable boolean,
  p_regular_rate_component boolean,
  p_policy_version text,
  p_idempotency_key text
)
returns public.payroll_inputs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.payroll_profiles%rowtype;
  v_calendar public.payroll_calendars%rowtype;
  v_earning public.earning_events%rowtype;
  v_input public.payroll_inputs%rowtype;
  v_amount bigint;
  v_hash text;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]);
  if p_expected_earning_version is null or p_expected_earning_version < 1
     or p_taxable is null or p_regular_rate_component is null
     or coalesce(p_policy_version, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_input_request_invalid';
  end if;
  perform app_private.lock_payops_idempotency(p_tenant_id, 'prepare_payroll_input', p_idempotency_key);
  perform app_private.lock_payops_aggregate(p_tenant_id, 'earning_event', p_earning_event_id);
  select * into v_input from public.payroll_inputs input
  where input.tenant_id = p_tenant_id and input.request_idempotency_key = p_idempotency_key;
  if found then
    if v_input.payroll_profile_id <> p_payroll_profile_id
       or v_input.payroll_calendar_id <> p_payroll_calendar_id
       or v_input.earning_event_id <> p_earning_event_id
       or v_input.taxable <> p_taxable
       or v_input.regular_rate_component <> p_regular_rate_component
       or v_input.policy_version <> p_policy_version then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_input;
  end if;
  select * into v_profile from public.payroll_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = p_payroll_profile_id for share;
  select * into v_calendar from public.payroll_calendars calendar
  where calendar.tenant_id = p_tenant_id and calendar.id = p_payroll_calendar_id for update;
  select * into v_earning from public.earning_events earning
  where earning.tenant_id = p_tenant_id and earning.id = p_earning_event_id for update;
  if v_profile.id is null or v_profile.onboarding_status <> 'READY' or v_profile.coverage_status <> 'VERIFIED'
     or v_profile.payment_method_status <> 'READY' or v_profile.worker_category not in ('employee', 'management') then
    raise exception using errcode = 'P0001', message = 'payroll_profile_not_ready';
  end if;
  if v_calendar.id is null or v_calendar.status <> 'OPEN' or v_calendar.legal_entity_id <> v_profile.legal_entity_id then
    raise exception using errcode = 'P0001', message = 'payroll_calendar_not_open';
  end if;
  if v_earning.id is null or v_earning.version <> p_expected_earning_version
     or v_earning.worker_profile_id <> v_profile.worker_profile_id
     or v_earning.legal_entity_id <> v_profile.legal_entity_id
     or v_earning.service_date not between v_calendar.period_start and v_calendar.period_end
     or v_earning.approval_status not in ('APPROVED', 'ROUTED')
     or not exists (select 1 from public.earning_routings routing
       where routing.tenant_id = p_tenant_id and routing.earning_event_id = v_earning.id
         and routing.rail = 'W2_PAYROLL_INPUT') then
    raise exception using errcode = 'P0001', message = 'payroll_earning_not_eligible';
  end if;
  v_amount := v_earning.gross_amount_cents + v_earning.reimbursement_amount_cents;
  v_hash := app_private.payroll_control_hash(jsonb_build_object(
    'tenant_id', p_tenant_id, 'payroll_profile_id', p_payroll_profile_id,
    'payroll_calendar_id', p_payroll_calendar_id, 'earning_event_id', p_earning_event_id,
    'earning_version', v_earning.version, 'earning_source_hash', v_earning.source_hash,
    'earning_calculation_hash', v_earning.calculation_hash, 'category', v_earning.category,
    'quantity', v_earning.quantity, 'unit', v_earning.unit, 'amount_cents', v_amount,
    'taxable', p_taxable, 'regular_rate_component', p_regular_rate_component,
    'policy_version', p_policy_version, 'actor_profile_id', p_actor_profile_id
  ));
  insert into public.payroll_inputs (
    tenant_id, payroll_profile_id, payroll_calendar_id, earning_event_id,
    category, quantity, unit, amount_cents, taxable, regular_rate_component,
    source_hash, policy_version, status, approved_by, approved_at,
    prepared_by, prepared_at, request_idempotency_key, request_hash
  ) values (
    p_tenant_id, p_payroll_profile_id, p_payroll_calendar_id, p_earning_event_id,
    v_earning.category, v_earning.quantity, v_earning.unit, v_amount, p_taxable,
    p_regular_rate_component, v_hash, p_policy_version, 'VALIDATED',
    p_actor_profile_id, clock_timestamp(), p_actor_profile_id, clock_timestamp(),
    p_idempotency_key, v_hash
  ) returning * into v_input;
  update public.earning_events set approval_status = 'ROUTED', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_earning.id and version = v_earning.version;
  if not found then
    raise exception using errcode = '40001', message = 'payroll_earning_version_conflict';
  end if;
  insert into public.audit_events (tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload_hash, payload)
  values (p_tenant_id, p_actor_profile_id, 'payroll_input_prepared', 'payroll_inputs', v_input.id, false, v_hash,
    jsonb_build_object('worker_category', v_profile.worker_category, 'calendar_id', v_calendar.id,
      'amount_cents', v_amount, 'input_version', v_input.version));
  return v_input;
end;
$$;

revoke all on function public.prepare_payroll_input(uuid, uuid, uuid, uuid, uuid, integer, boolean, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_payroll_input(uuid, uuid, uuid, uuid, uuid, integer, boolean, boolean, text, text)
  to service_role;

create or replace function public.prepare_payroll_run(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payroll_calendar_id uuid,
  p_expected_calendar_version integer,
  p_idempotency_key text
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_calendar public.payroll_calendars%rowtype;
  v_run public.payroll_runs%rowtype;
  v_input_count integer;
  v_validated_input_count integer;
  v_locked_input_count integer;
  v_gross bigint;
  v_reimbursements bigint;
  v_company_id text;
  v_snapshot jsonb;
  v_hash text;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]);
  if p_expected_calendar_version is null or p_expected_calendar_version < 1
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_run_prepare_request_invalid';
  end if;
  perform app_private.lock_payops_idempotency(p_tenant_id, 'prepare_payroll_run', p_idempotency_key);
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payroll_calendar', p_payroll_calendar_id);
  select * into v_run from public.payroll_runs run
  where run.tenant_id = p_tenant_id and run.request_idempotency_key = p_idempotency_key;
  if found then
    if v_run.payroll_calendar_id <> p_payroll_calendar_id or v_run.prepared_by <> p_actor_profile_id then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_run;
  end if;
  select * into v_calendar from public.payroll_calendars calendar
  where calendar.tenant_id = p_tenant_id and calendar.id = p_payroll_calendar_id for update;
  if v_calendar.id is null or v_calendar.version <> p_expected_calendar_version or v_calendar.status <> 'OPEN' then
    raise exception using errcode = '40001', message = 'payroll_calendar_version_or_state_conflict';
  end if;
  -- Freeze every currently validated input and its readiness-bearing profile
  -- before evaluating eligibility. A concurrent HR/profile change therefore
  -- cannot turn a partial snapshot into a prepared run.
  perform input.id
  from public.payroll_inputs input
  join public.payroll_profiles profile
    on profile.tenant_id = input.tenant_id and profile.id = input.payroll_profile_id
  where input.tenant_id = p_tenant_id
    and input.payroll_calendar_id = p_payroll_calendar_id
    and input.status = 'VALIDATED'
  for update of input, profile;
  perform earning.id
  from public.payroll_inputs input
  join public.earning_events earning
    on earning.tenant_id = input.tenant_id and earning.id = input.earning_event_id
  where input.tenant_id = p_tenant_id
    and input.payroll_calendar_id = p_payroll_calendar_id
    and input.status = 'VALIDATED'
  for share of earning;
  perform routing.id
  from public.payroll_inputs input
  join public.earning_routings routing
    on routing.tenant_id = input.tenant_id and routing.earning_event_id = input.earning_event_id
  join public.engagement_decisions decision
    on decision.tenant_id = routing.tenant_id and decision.id = routing.engagement_decision_id
  where input.tenant_id = p_tenant_id
    and input.payroll_calendar_id = p_payroll_calendar_id
    and input.status = 'VALIDATED'
  for share of routing, decision;
  select count(*) into v_validated_input_count
  from public.payroll_inputs input
  where input.tenant_id = p_tenant_id
    and input.payroll_calendar_id = p_payroll_calendar_id
    and input.status = 'VALIDATED';
  select count(*),
    coalesce(sum(case when input.category in ('mileage', 'expense_reimbursement') then 0 else input.amount_cents end), 0),
    coalesce(sum(case when input.category in ('mileage', 'expense_reimbursement') then input.amount_cents else 0 end), 0),
    min(profile.gusto_company_id),
    jsonb_agg(jsonb_build_object(
      'input_id', input.id, 'input_version', input.version, 'source_hash', input.source_hash,
      'profile_id', profile.id, 'profile_version', profile.version,
      'earning_event_id', earning.id, 'earning_event_version', earning.version,
      'earning_source_hash', earning.source_hash, 'earning_calculation_hash', earning.calculation_hash,
      'routing_id', routing.id, 'engagement_decision_id', decision.id,
      'engagement_decision_version', decision.version,
      'worker_category', profile.worker_category, 'amount_cents', input.amount_cents,
      'taxable', input.taxable, 'regular_rate_component', input.regular_rate_component
    ) order by input.id)
  into v_input_count, v_gross, v_reimbursements, v_company_id, v_snapshot
  from public.payroll_inputs input
  join public.payroll_profiles profile on profile.tenant_id = input.tenant_id and profile.id = input.payroll_profile_id
  join public.earning_events earning
    on earning.tenant_id = input.tenant_id and earning.id = input.earning_event_id
  join public.earning_routings routing
    on routing.tenant_id = earning.tenant_id and routing.earning_event_id = earning.id
  join public.engagement_decisions decision
    on decision.tenant_id = routing.tenant_id and decision.id = routing.engagement_decision_id
  where input.tenant_id = p_tenant_id and input.payroll_calendar_id = p_payroll_calendar_id
    and input.status = 'VALIDATED' and profile.legal_entity_id = v_calendar.legal_entity_id
    and profile.onboarding_status = 'READY' and profile.coverage_status = 'VERIFIED'
    and profile.payment_method_status = 'READY' and profile.gusto_company_id is not null
    and profile.gusto_employee_id is not null and profile.pay_schedule_ref is not null
    and profile.readiness_evidence_ref is not null
    and profile.readiness_evidence_checksum ~ '^[0-9a-f]{64}$'
    and profile.worker_category in ('employee', 'management')
    and input.prepared_by is not null and input.approved_by = input.prepared_by
    and input.approved_at is not null and input.request_hash = input.source_hash
    and earning.worker_profile_id = profile.worker_profile_id
    and earning.legal_entity_id = profile.legal_entity_id
    and earning.service_date between v_calendar.period_start and v_calendar.period_end
    and earning.category = input.category and earning.quantity = input.quantity
    and earning.unit = input.unit and earning.currency = 'USD'
    and earning.gross_amount_cents + earning.reimbursement_amount_cents = input.amount_cents
    and earning.approval_status = 'ROUTED'
    and routing.rail = 'W2_PAYROLL_INPUT'
    and decision.worker_profile_id = profile.worker_profile_id
    and decision.legal_entity_id = profile.legal_entity_id
    and decision.decision_status = 'W2_EMPLOYEE'
    and decision.effective_from <= current_date
    and (decision.effective_through is null or decision.effective_through >= current_date)
    and not exists (
      select 1 from public.engagement_decisions newer
      where newer.tenant_id = decision.tenant_id
        and newer.worker_profile_id = decision.worker_profile_id
        and newer.legal_entity_id = decision.legal_entity_id
        and newer.decided_at > decision.decided_at
        and newer.effective_from <= current_date
        and (newer.effective_through is null or newer.effective_through >= current_date)
    )
    and input.source_hash = app_private.payroll_control_hash(jsonb_build_object(
      'tenant_id', input.tenant_id, 'payroll_profile_id', input.payroll_profile_id,
      'payroll_calendar_id', input.payroll_calendar_id, 'earning_event_id', earning.id,
      'earning_version', earning.version - 1, 'earning_source_hash', earning.source_hash,
      'earning_calculation_hash', earning.calculation_hash, 'category', earning.category,
      'quantity', earning.quantity, 'unit', earning.unit,
      'amount_cents', earning.gross_amount_cents + earning.reimbursement_amount_cents,
      'taxable', input.taxable, 'regular_rate_component', input.regular_rate_component,
      'policy_version', input.policy_version, 'actor_profile_id', input.prepared_by
    ));
  if v_input_count < 1 or v_input_count <> v_validated_input_count or v_company_id is null or exists (
    select 1 from public.payroll_inputs input
    join public.payroll_profiles profile on profile.tenant_id = input.tenant_id and profile.id = input.payroll_profile_id
    where input.tenant_id = p_tenant_id and input.payroll_calendar_id = p_payroll_calendar_id
      and input.status = 'VALIDATED' and profile.gusto_company_id is distinct from v_company_id
  ) then raise exception using errcode = 'P0001', message = 'payroll_run_inputs_not_ready'; end if;
  v_hash := app_private.payroll_control_hash(jsonb_build_object(
    'tenant_id', p_tenant_id, 'calendar_id', v_calendar.id, 'calendar_version', v_calendar.version,
    'legal_entity_id', v_calendar.legal_entity_id, 'gusto_company_id', v_company_id,
    'gross_cents', v_gross, 'reimbursement_cents', v_reimbursements,
    'input_count', v_input_count, 'input_snapshot', v_snapshot, 'actor_profile_id', p_actor_profile_id
  ));
  insert into public.payroll_runs (
    tenant_id, legal_entity_id, payroll_calendar_id, provider, gusto_company_id,
    status, gross_cents, net_cents, employee_tax_cents, employer_tax_cents,
    deduction_cents, reimbursement_cents, employer_cost_cents,
    funding_status, employee_payment_status, tax_filing_status, statement_status,
    reconciliation_state, prepared_by, prepared_at, request_idempotency_key, request_hash
  ) values (
    p_tenant_id, v_calendar.legal_entity_id, v_calendar.id, 'gusto_embedded', v_company_id,
    'DRAFT', v_gross, 0, 0, 0, 0, v_reimbursements, v_gross + v_reimbursements,
    'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'UNMATCHED',
    p_actor_profile_id, clock_timestamp(), p_idempotency_key, v_hash
  ) returning * into v_run;
  update public.payroll_inputs
  set status = 'LOCKED_TO_PAY_PERIOD', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and payroll_calendar_id = v_calendar.id
    and status = 'VALIDATED'
    and id in (
      select (snapshot_item->>'input_id')::uuid
      from jsonb_array_elements(v_snapshot) snapshot_item
    );
  get diagnostics v_locked_input_count = row_count;
  if v_locked_input_count <> v_input_count then
    raise exception using errcode = '40001', message = 'payroll_run_input_lock_conflict';
  end if;
  update public.payroll_calendars set status = 'LOCKED', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_calendar.id and version = v_calendar.version;
  insert into public.payroll_events (
    tenant_id, payroll_run_id, event_type, from_status, to_status, payload_checksum,
    occurred_at, actor_profile_id, idempotency_key, request_hash, safe_reason_code
  ) values (
    p_tenant_id, v_run.id, 'PAYROLL_RUN_PREPARED', null, 'DRAFT', v_hash,
    clock_timestamp(), p_actor_profile_id, p_idempotency_key, v_hash, 'FINANCE_MAKER_PREPARED'
  );
  insert into public.audit_events (tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload_hash, payload)
  values (p_tenant_id, p_actor_profile_id, 'employee_payroll_run_prepared', 'payroll_runs', v_run.id, false, v_hash,
    jsonb_build_object('calendar_id', v_calendar.id, 'input_count', v_input_count,
      'gross_cents', v_gross, 'reimbursement_cents', v_reimbursements, 'run_version', v_run.version));
  return v_run;
end;
$$;

revoke all on function public.prepare_payroll_run(uuid, uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.prepare_payroll_run(uuid, uuid, uuid, integer, text)
  to service_role;

create or replace function public.approve_payroll_run(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payroll_run_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_run public.payroll_runs%rowtype; v_event public.payroll_events%rowtype; v_hash text; v_count integer; v_gross bigint; v_net bigint; v_emp_tax bigint; v_er_tax bigint; v_deduct bigint; v_reimburse bigint;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['payroll_approver']::text[]);
  if p_expected_version is null or p_expected_version < 1 or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_approval_request_invalid';
  end if;
  perform app_private.lock_payops_idempotency(p_tenant_id, 'approve_payroll_run', p_idempotency_key);
  select * into v_event from public.payroll_events event where event.tenant_id = p_tenant_id and event.idempotency_key = p_idempotency_key;
  if found then
    if v_event.payroll_run_id <> p_payroll_run_id or v_event.actor_profile_id <> p_actor_profile_id or v_event.safe_reason_code <> p_reason_code then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_run from public.payroll_runs run where run.tenant_id = p_tenant_id and run.id = p_payroll_run_id;
    return v_run;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payroll_run', p_payroll_run_id);
  select * into v_run from public.payroll_runs run where run.tenant_id = p_tenant_id and run.id = p_payroll_run_id for update;
  if v_run.id is null then raise exception using errcode = 'P0002', message = 'payroll_run_not_found'; end if;
  if v_run.version <> p_expected_version or v_run.status <> 'PREVIEWED' or v_run.hold_code is not null
     or v_run.preview_hash is null or v_run.preview_version is null or v_run.last_reconciliation_event_id is null then
    raise exception using errcode = '40001', message = 'payroll_run_not_ready_for_approval';
  end if;
  if v_run.prepared_by = p_actor_profile_id then raise exception using errcode = '42501', message = 'payroll_maker_approver_required'; end if;
  select count(*), coalesce(sum(gross_cents),0), coalesce(sum(net_cents),0), coalesce(sum(employee_tax_cents),0),
    coalesce(sum(employer_tax_cents),0), coalesce(sum(deduction_cents),0), coalesce(sum(reimbursement_cents),0)
  into v_count, v_gross, v_net, v_emp_tax, v_er_tax, v_deduct, v_reimburse
  from public.payroll_items item where item.tenant_id = p_tenant_id and item.payroll_run_id = v_run.id;
  if v_count < 1 or v_gross <> v_run.gross_cents or v_net <> v_run.net_cents
     or v_emp_tax <> v_run.employee_tax_cents or v_er_tax <> v_run.employer_tax_cents
     or v_deduct <> v_run.deduction_cents or v_reimburse <> v_run.reimbursement_cents then
    raise exception using errcode = 'P0001', message = 'payroll_preview_items_do_not_reconcile';
  end if;
  v_hash := app_private.payroll_control_hash(jsonb_build_object(
    'tenant_id', p_tenant_id, 'payroll_run_id', v_run.id, 'expected_version', p_expected_version,
    'preview_hash', v_run.preview_hash, 'preview_version', v_run.preview_version,
    'actor_profile_id', p_actor_profile_id, 'reason_code', p_reason_code
  ));
  update public.payroll_runs set status = 'HUMAN_APPROVED', approved_by = p_actor_profile_id,
    approved_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_run.id and version = p_expected_version returning * into v_run;
  insert into public.payroll_events (tenant_id, payroll_run_id, event_type, from_status, to_status, payload_checksum,
    occurred_at, actor_profile_id, idempotency_key, request_hash, safe_reason_code)
  values (p_tenant_id, v_run.id, 'PAYROLL_HUMAN_APPROVED', 'PREVIEWED', 'HUMAN_APPROVED', v_hash,
    clock_timestamp(), p_actor_profile_id, p_idempotency_key, v_hash, p_reason_code);
  insert into public.audit_events (tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload_hash, payload)
  values (p_tenant_id, p_actor_profile_id, 'employee_payroll_run_approved', 'payroll_runs', v_run.id, false, v_hash,
    jsonb_build_object('preview_hash', v_run.preview_hash, 'gross_cents', v_run.gross_cents,
      'net_cents', v_run.net_cents, 'run_version', v_run.version, 'reason_code', p_reason_code));
  return v_run;
end;
$$;

revoke all on function public.approve_payroll_run(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_payroll_run(uuid, uuid, uuid, integer, text, text)
  to service_role;

create or replace function public.queue_payroll_run_command(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payroll_run_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.finance_integration_commands
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_run public.payroll_runs%rowtype; v_command public.finance_integration_commands%rowtype; v_payload jsonb; v_checksum text; v_type text; v_next_status text; v_hash text;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['finance_executor']::text[]);
  if p_expected_version is null or p_expected_version < 1 or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_command_request_invalid';
  end if;
  perform app_private.lock_payops_idempotency(p_tenant_id, 'queue_payroll_run_command', p_idempotency_key);
  select * into v_command from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id and command.provider = 'gusto_embedded' and command.stable_key = p_idempotency_key;
  if found then
    if v_command.aggregate_id is distinct from p_payroll_run_id or v_command.created_by is distinct from p_actor_profile_id
       or v_command.safe_payload->>'run_version' is distinct from p_expected_version::text
       or v_command.safe_payload->>'executor_profile_id' is distinct from p_actor_profile_id::text
       or v_command.safe_payload->>'safe_reason_code' is distinct from p_reason_code then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_command;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payroll_run', p_payroll_run_id);
  select * into v_run from public.payroll_runs run where run.tenant_id = p_tenant_id and run.id = p_payroll_run_id for update;
  if v_run.id is null then raise exception using errcode = 'P0002', message = 'payroll_run_not_found'; end if;
  if v_run.version <> p_expected_version or v_run.hold_code is not null
     or v_run.status not in ('DRAFT', 'HUMAN_APPROVED') then
    raise exception using errcode = '40001', message = 'payroll_run_not_queueable';
  end if;
  if v_run.prepared_by = p_actor_profile_id or v_run.approved_by = p_actor_profile_id then
    raise exception using errcode = '42501', message = 'payroll_executor_separation_required';
  end if;
  if v_run.status = 'DRAFT' then v_type := 'CREATE_PAYROLL_PREVIEW'; v_next_status := 'PREVIEW_QUEUED';
  else v_type := 'SUBMIT_APPROVED_PAYROLL'; v_next_status := 'SUBMISSION_QUEUED'; end if;
  v_payload := jsonb_build_object(
    'payroll_run_id', v_run.id, 'payroll_calendar_id', v_run.payroll_calendar_id,
    'legal_entity_id', v_run.legal_entity_id, 'gusto_company_id', v_run.gusto_company_id,
    'run_request_hash', v_run.request_hash, 'run_version', v_run.version,
    'gross_cents', v_run.gross_cents, 'reimbursement_cents', v_run.reimbursement_cents,
    'preview_hash', v_run.preview_hash, 'command_type', v_type,
    'executor_profile_id', p_actor_profile_id, 'safe_reason_code', p_reason_code
  );
  v_checksum := app_private.payroll_control_hash(v_payload);
  v_hash := app_private.payroll_control_hash(jsonb_build_object(
    'tenant_id', p_tenant_id, 'run_id', v_run.id, 'expected_version', p_expected_version,
    'actor_profile_id', p_actor_profile_id, 'reason_code', p_reason_code,
    'command_type', v_type, 'command_checksum', v_checksum
  ));
  insert into public.finance_integration_commands (
    tenant_id, provider, command_type, aggregate_type, aggregate_id, stable_key,
    request_checksum, safe_payload, status, created_by
  ) values (
    p_tenant_id, 'gusto_embedded', v_type, 'payroll_run', v_run.id, p_idempotency_key,
    v_checksum, v_payload, 'PENDING', p_actor_profile_id
  ) returning * into v_command;
  update public.payroll_runs set status = v_next_status, version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_run.id and version = v_run.version;
  insert into public.payroll_events (tenant_id, payroll_run_id, event_type, from_status, to_status,
    payload_checksum, occurred_at, actor_profile_id, idempotency_key, request_hash, safe_reason_code)
  values (p_tenant_id, v_run.id, v_type || '_QUEUED', v_run.status, v_next_status,
    v_checksum, clock_timestamp(), p_actor_profile_id, p_idempotency_key, v_hash, p_reason_code);
  insert into public.audit_events (tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload_hash, payload)
  values (p_tenant_id, p_actor_profile_id, 'employee_payroll_command_queued', 'finance_integration_commands', v_command.id, false, v_hash,
    jsonb_build_object('payroll_run_id', v_run.id, 'command_type', v_type,
      'command_checksum', v_checksum, 'provider_network_called', false, 'reason_code', p_reason_code));
  return v_command;
end;
$$;

revoke all on function public.queue_payroll_run_command(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.queue_payroll_run_command(uuid, uuid, uuid, integer, text, text)
  to service_role;

-- Migration 073 split vendor commands from the 070 contractor worker gate,
-- but its remaining "nonvendor" predicate still routes Gusto payroll into
-- contractor-only Mercury checks. Preserve both older gates and give payroll
-- its own final pre-provider claim revalidation.
create or replace function app_private.guard_payroll_finance_command()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.payroll_runs%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'payroll_command_delete_forbidden';
  end if;
  if old.tenant_id is distinct from new.tenant_id
     or old.provider is distinct from new.provider
     or old.command_type is distinct from new.command_type
     or old.aggregate_type is distinct from new.aggregate_type
     or old.aggregate_id is distinct from new.aggregate_id
     or old.stable_key is distinct from new.stable_key
     or old.request_checksum is distinct from new.request_checksum
     or old.safe_payload is distinct from new.safe_payload
     or old.correlation_id is distinct from new.correlation_id
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at then
    raise exception using errcode = 'P0001', message = 'payroll_command_identity_immutable';
  end if;
  if old.status is distinct from new.status and (
    (old.status='PENDING' and new.status not in ('CLAIMED','CANCELLED'))
    or old.status='CANCELLED'
    or (new.status='SENT' and old.status<>'CLAIMED')
  ) then
    raise exception using errcode = 'P0001', message = 'payroll_command_transition_invalid';
  end if;
  if old.status is distinct from new.status and new.status='CLAIMED' then
    perform app_private.lock_payops_aggregate(new.tenant_id,'payroll_run',new.aggregate_id);
    select * into v_run from public.payroll_runs run
    where run.tenant_id=new.tenant_id and run.id=new.aggregate_id for update;
    if v_run.id is null then
      raise exception using errcode = 'P0001', message = 'payroll_command_worker_revalidation_failed';
    end if;
    perform calendar.id
    from public.payroll_calendars calendar
    where calendar.tenant_id=v_run.tenant_id and calendar.id=v_run.payroll_calendar_id
    for share;
    perform input.id
    from public.payroll_inputs input
    join public.payroll_profiles profile
      on profile.tenant_id=input.tenant_id and profile.id=input.payroll_profile_id
    where input.tenant_id=v_run.tenant_id and input.payroll_calendar_id=v_run.payroll_calendar_id
    for share of input, profile;
    perform decision.id
    from public.engagement_decisions decision
    join public.payroll_profiles profile
      on profile.tenant_id=decision.tenant_id
      and profile.worker_profile_id=decision.worker_profile_id
      and profile.legal_entity_id=decision.legal_entity_id
    join public.payroll_inputs input
      on input.tenant_id=profile.tenant_id and input.payroll_profile_id=profile.id
    where input.payroll_calendar_id=v_run.payroll_calendar_id
    for share of decision;
    perform assignment.id
    from public.finance_role_assignments assignment
    where assignment.tenant_id=v_run.tenant_id
      and assignment.profile_id in (v_run.prepared_by,v_run.approved_by,new.created_by)
    for share;
    perform item.id from public.payroll_items item
    where item.tenant_id=v_run.tenant_id and item.payroll_run_id=v_run.id
    for share;
    perform event.id from public.finance_integration_events event
    where event.tenant_id=v_run.tenant_id and event.id=v_run.last_reconciliation_event_id
    for share;
    if old.status<>'PENDING'
       or new.aggregate_type<>'payroll_run'
       or new.provider<>'gusto_embedded'
       or new.command_type not in ('CREATE_PAYROLL_PREVIEW','SUBMIT_APPROVED_PAYROLL')
       or new.request_checksum<>app_private.payroll_control_hash(new.safe_payload)
       or jsonb_typeof(new.safe_payload)<>'object'
       or exists (
         select 1 from jsonb_object_keys(new.safe_payload) key
         where key not in (
           'payroll_run_id','payroll_calendar_id','legal_entity_id','gusto_company_id',
           'run_request_hash','run_version','gross_cents','reimbursement_cents',
           'preview_hash','command_type','executor_profile_id','safe_reason_code'
         )
       )
       or coalesce(new.safe_payload->>'safe_reason_code','') !~ '^[A-Z0-9_]{3,100}$'
       or not exists (
         select 1
         from public.payroll_runs run
         join public.payroll_calendars calendar
           on calendar.tenant_id=run.tenant_id and calendar.id=run.payroll_calendar_id
         where run.tenant_id=new.tenant_id and run.id=new.aggregate_id
           and run.provider='gusto_embedded' and run.hold_code is null
           and run.cancelled_by is null and calendar.status='LOCKED'
           and run.prepared_by is not null and run.prepared_by<>new.created_by
           and run.request_hash=new.safe_payload->>'run_request_hash'
           and run.id::text=new.safe_payload->>'payroll_run_id'
           and run.payroll_calendar_id::text=new.safe_payload->>'payroll_calendar_id'
           and run.legal_entity_id::text=new.safe_payload->>'legal_entity_id'
           and run.gusto_company_id=new.safe_payload->>'gusto_company_id'
           and (run.version-1)::text=new.safe_payload->>'run_version'
           and run.gross_cents::text=new.safe_payload->>'gross_cents'
           and run.reimbursement_cents::text=new.safe_payload->>'reimbursement_cents'
           and run.preview_hash is not distinct from new.safe_payload->>'preview_hash'
           and new.command_type=new.safe_payload->>'command_type'
           and new.created_by::text=new.safe_payload->>'executor_profile_id'
           and exists (
             select 1 from public.finance_role_assignments executor_assignment
             where executor_assignment.tenant_id=new.tenant_id
               and executor_assignment.profile_id=new.created_by
               and executor_assignment.finance_role='finance_executor'
               and executor_assignment.revoked_at is null
               and executor_assignment.effective_at<=clock_timestamp()
               and (executor_assignment.expires_at is null or executor_assignment.expires_at>clock_timestamp())
           )
           and exists (
             select 1 from public.finance_role_assignments maker_assignment
             where maker_assignment.tenant_id=new.tenant_id
               and maker_assignment.profile_id=run.prepared_by
               and maker_assignment.finance_role='finance_maker'
               and maker_assignment.revoked_at is null
               and maker_assignment.effective_at<=clock_timestamp()
               and (maker_assignment.expires_at is null or maker_assignment.expires_at>clock_timestamp())
           )
           and exists (
             select 1
             from public.payroll_inputs input
             join public.payroll_profiles profile
               on profile.tenant_id=input.tenant_id and profile.id=input.payroll_profile_id
             where input.tenant_id=run.tenant_id and input.payroll_calendar_id=run.payroll_calendar_id
               and input.status='LOCKED_TO_PAY_PERIOD'
               and profile.legal_entity_id=run.legal_entity_id
               and profile.onboarding_status='READY' and profile.coverage_status='VERIFIED'
               and profile.payment_method_status='READY'
               and profile.gusto_company_id=run.gusto_company_id
               and profile.gusto_employee_id is not null
               and profile.pay_schedule_ref is not null
               and profile.readiness_evidence_ref is not null
               and profile.readiness_evidence_checksum ~ '^[0-9a-f]{64}$'
               and profile.worker_category in ('employee','management')
               and exists (
                 select 1 from public.engagement_decisions decision
                 where decision.tenant_id=profile.tenant_id
                   and decision.worker_profile_id=profile.worker_profile_id
                   and decision.legal_entity_id=profile.legal_entity_id
                   and decision.decision_status='W2_EMPLOYEE'
                   and decision.effective_from<=current_date
                   and (decision.effective_through is null or decision.effective_through>=current_date)
                   and not exists (
                     select 1 from public.engagement_decisions newer
                     where newer.tenant_id=decision.tenant_id
                       and newer.worker_profile_id=decision.worker_profile_id
                       and newer.legal_entity_id=decision.legal_entity_id
                       and newer.decided_at>decision.decided_at
                       and newer.effective_from<=current_date
                       and (newer.effective_through is null or newer.effective_through>=current_date)
                   )
               )
           )
           and not exists (
             select 1
             from public.payroll_inputs input
             join public.payroll_profiles profile
               on profile.tenant_id=input.tenant_id and profile.id=input.payroll_profile_id
             where input.tenant_id=run.tenant_id and input.payroll_calendar_id=run.payroll_calendar_id
               and (input.status<>'LOCKED_TO_PAY_PERIOD'
                 or profile.legal_entity_id<>run.legal_entity_id
                 or profile.onboarding_status<>'READY' or profile.coverage_status<>'VERIFIED'
                 or profile.payment_method_status<>'READY'
                 or profile.gusto_company_id is distinct from run.gusto_company_id
                 or profile.gusto_employee_id is null
                 or profile.pay_schedule_ref is null
                 or profile.readiness_evidence_ref is null
                 or profile.readiness_evidence_checksum !~ '^[0-9a-f]{64}$'
                 or profile.worker_category not in ('employee','management')
               or not exists (
                 select 1 from public.engagement_decisions decision
                 where decision.tenant_id=profile.tenant_id
                   and decision.worker_profile_id=profile.worker_profile_id
                   and decision.legal_entity_id=profile.legal_entity_id
                   and decision.decision_status='W2_EMPLOYEE'
                   and decision.effective_from<=current_date
                   and (decision.effective_through is null or decision.effective_through>=current_date)
                   and not exists (
                     select 1 from public.engagement_decisions newer
                     where newer.tenant_id=decision.tenant_id
                       and newer.worker_profile_id=decision.worker_profile_id
                       and newer.legal_entity_id=decision.legal_entity_id
                       and newer.decided_at>decision.decided_at
                       and newer.effective_from<=current_date
                       and (newer.effective_through is null or newer.effective_through>=current_date)
                   )
               ))
           )
           and (
             (new.command_type='CREATE_PAYROLL_PREVIEW'
               and run.status='PREVIEW_QUEUED' and run.approved_by is null
               and run.preview_hash is null and run.preview_version is null)
             or
             (new.command_type='SUBMIT_APPROVED_PAYROLL'
               and run.status='SUBMISSION_QUEUED'
               and run.approved_by is not null and run.approved_at is not null
               and run.approved_by<>run.prepared_by and run.approved_by<>new.created_by
               and exists (
                 select 1 from public.finance_role_assignments approver_assignment
                 where approver_assignment.tenant_id=new.tenant_id
                   and approver_assignment.profile_id=run.approved_by
                   and approver_assignment.finance_role='payroll_approver'
                   and approver_assignment.revoked_at is null
                   and approver_assignment.effective_at<=clock_timestamp()
                   and (approver_assignment.expires_at is null or approver_assignment.expires_at>clock_timestamp())
               )
               and exists (
                 select 1 from public.payroll_events approval_event
                 where approval_event.tenant_id=run.tenant_id
                   and approval_event.payroll_run_id=run.id
                   and approval_event.event_type='PAYROLL_HUMAN_APPROVED'
                   and approval_event.actor_profile_id=run.approved_by
                   and approval_event.to_status='HUMAN_APPROVED'
               )
               and exists (
                 select 1 from public.finance_integration_events preview_event
                 where preview_event.tenant_id=run.tenant_id
                   and preview_event.id=run.last_reconciliation_event_id
                   and preview_event.provider='gusto_embedded'
                   and preview_event.aggregate_type='payroll_run'
                   and preview_event.aggregate_id=run.id
                   and preview_event.event_type='PAYROLL_PREVIEW_READY'
                   and preview_event.signature_valid and preview_event.status='PROCESSED'
                   and preview_event.provider_payload is not null
                   and app_private.payroll_control_hash(preview_event.provider_payload)=preview_event.payload_checksum
                   and preview_event.provider_payload->>'target_status'='PREVIEWED'
                   and preview_event.provider_payload->>'payroll_run_id'=run.id::text
                   and preview_event.provider_payload->>'gusto_company_id'=run.gusto_company_id
                   and preview_event.provider_payload->>'gusto_payroll_id'=run.gusto_payroll_id
                   and preview_event.provider_payload->>'preview_hash'=run.preview_hash
                   and preview_event.provider_payload->>'preview_version'=run.preview_version
               )
               and exists (
                 select 1 from public.payroll_items item
                 where item.tenant_id=run.tenant_id and item.payroll_run_id=run.id
                 having count(*)>0
                   and sum(item.gross_cents)=run.gross_cents
                   and sum(item.net_cents)=run.net_cents
                   and sum(item.employee_tax_cents)=run.employee_tax_cents
                   and sum(item.employer_tax_cents)=run.employer_tax_cents
                   and sum(item.deduction_cents)=run.deduction_cents
                   and sum(item.reimbursement_cents)=run.reimbursement_cents
               )
             )
           )
       ) then
      raise exception using errcode = 'P0001', message = 'payroll_command_worker_revalidation_failed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_payroll_finance_command()
  from public, anon, authenticated, service_role;

drop trigger if exists finance_integration_commands_nonvendor_guard_update
  on public.finance_integration_commands;
drop trigger if exists finance_integration_commands_nonvendor_guard_delete
  on public.finance_integration_commands;

create trigger finance_integration_commands_nonvendor_guard_update
  before update on public.finance_integration_commands
  for each row
  when (old.aggregate_type not in ('vendor_payment','payroll_run')
    and new.aggregate_type not in ('vendor_payment','payroll_run'))
  execute function app_private.guard_payout_aggregate();

create trigger finance_integration_commands_nonvendor_guard_delete
  before delete on public.finance_integration_commands
  for each row
  when (old.aggregate_type not in ('vendor_payment','payroll_run'))
  execute function app_private.guard_payout_aggregate();

drop trigger if exists finance_integration_commands_payroll_guard_update
  on public.finance_integration_commands;
create trigger finance_integration_commands_payroll_guard_update
  before update on public.finance_integration_commands
  for each row
  when (old.aggregate_type='payroll_run' or new.aggregate_type='payroll_run')
  execute function app_private.guard_payroll_finance_command();

drop trigger if exists finance_integration_commands_payroll_guard_delete
  on public.finance_integration_commands;
create trigger finance_integration_commands_payroll_guard_delete
  before delete on public.finance_integration_commands
  for each row
  when (old.aggregate_type='payroll_run')
  execute function app_private.guard_payroll_finance_command();

-- The service role has SELECT-only table access. Give the provider worker one
-- narrow, atomic way to claim an eligible payroll outbox row without restoring
-- direct UPDATE privileges. The payroll command trigger above remains the
-- final authorization boundary and revalidates the run immediately before the
-- row can become CLAIMED.
create or replace function public.claim_payroll_run_command(
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
begin
  if p_tenant_id is null
     or p_command_id is null
     or coalesce(p_expected_request_checksum, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_claimed_by, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$' then
    raise exception using errcode = '22023', message = 'payroll_command_claim_request_invalid';
  end if;

  -- Resolve the aggregate before taking its advisory lock so claim follows the
  -- same aggregate -> command lock order as hold/cancel and command creation.
  select * into v_command
  from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.id = p_command_id
    and command.provider = 'gusto_embedded'
    and command.aggregate_type = 'payroll_run';
  if not found then
    raise exception using errcode = 'P0002', message = 'payroll_command_not_found';
  end if;

  perform app_private.lock_payops_aggregate(
    p_tenant_id, 'payroll_run', v_command.aggregate_id
  );

  select * into v_command
  from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.id = p_command_id
    and command.provider = 'gusto_embedded'
    and command.aggregate_type = 'payroll_run'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'payroll_command_not_found';
  end if;
  if v_command.request_checksum <> p_expected_request_checksum then
    raise exception using errcode = '40001', message = 'payroll_command_claim_checksum_conflict';
  end if;

  -- A retry by the same worker is read-only and does not consume another
  -- attempt. A different claimant or any later command state fails closed.
  if v_command.status = 'CLAIMED'
     and v_command.claimed_by = p_claimed_by
     and v_command.claimed_at is not null then
    return v_command;
  end if;
  if v_command.status <> 'PENDING'
     or v_command.next_attempt_at > clock_timestamp() then
    raise exception using errcode = '40001', message = 'payroll_command_not_claimable';
  end if;

  update public.finance_integration_commands
  set status = 'CLAIMED',
      claimed_by = p_claimed_by,
      claimed_at = clock_timestamp(),
      attempt_count = attempt_count + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and id = p_command_id
    and provider = 'gusto_embedded'
    and aggregate_type = 'payroll_run'
    and status = 'PENDING'
    and request_checksum = p_expected_request_checksum
    and next_attempt_at <= clock_timestamp()
  returning * into v_command;
  if not found then
    raise exception using errcode = '40001', message = 'payroll_command_claim_conflict';
  end if;
  return v_command;
end;
$$;

revoke all on function public.claim_payroll_run_command(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_payroll_run_command(uuid, uuid, text, text)
  to service_role;

create or replace function public.hold_payroll_run(
  p_tenant_id uuid, p_actor_profile_id uuid, p_payroll_run_id uuid,
  p_expected_version integer, p_hold_code text, p_owner_profile_id uuid,
  p_idempotency_key text
)
returns public.payroll_runs
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_run public.payroll_runs%rowtype; v_event public.payroll_events%rowtype; v_hash text; v_from_status text;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id, p_actor_profile_id, array['payroll_approver','accountant_controller']::text[]);
  if p_expected_version is null or p_expected_version < 1 or p_owner_profile_id is null
     or coalesce(p_hold_code,'') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payroll_hold_request_invalid';
  end if;
  v_hash:=app_private.payroll_control_hash(jsonb_build_object('tenant_id',p_tenant_id,'run_id',p_payroll_run_id,
    'expected_version',p_expected_version,'actor_profile_id',p_actor_profile_id,'hold_code',p_hold_code,'owner_profile_id',p_owner_profile_id));
  perform app_private.lock_payops_idempotency(p_tenant_id, 'hold_payroll_run', p_idempotency_key);
  select * into v_event from public.payroll_events event where event.tenant_id=p_tenant_id and event.idempotency_key=p_idempotency_key;
  if found then
    if v_event.payroll_run_id<>p_payroll_run_id or v_event.actor_profile_id<>p_actor_profile_id
       or v_event.event_type<>'PAYROLL_RUN_HELD' or v_event.request_hash<>v_hash then
      raise exception using errcode='P0001', message='idempotency_key_reused'; end if;
    select * into v_run from public.payroll_runs run where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id;
    return v_run;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payroll_run', p_payroll_run_id);
  select * into v_run from public.payroll_runs run where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id for update;
  if v_run.id is null then raise exception using errcode='P0002', message='payroll_run_not_found'; end if;
  if v_run.version<>p_expected_version or v_run.status in ('PAID','CANCELLED') then raise exception using errcode='40001', message='payroll_run_not_holdable'; end if;
  if exists (select 1 from public.finance_integration_commands command where command.tenant_id=p_tenant_id
    and command.aggregate_type='payroll_run' and command.aggregate_id=v_run.id and command.status not in ('PENDING','CANCELLED')) then
    raise exception using errcode='P0001', message='payroll_dispatch_started_hold_requires_recovery';
  end if;
  v_from_status:=v_run.status;
  update public.finance_integration_commands set status='CANCELLED', last_safe_error_code='PAYROLL_HELD_BEFORE_DISPATCH', updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and aggregate_type='payroll_run' and aggregate_id=v_run.id and status='PENDING';
  update public.payroll_runs set status='HELD', hold_code=p_hold_code, hold_owner_profile_id=p_owner_profile_id,
    version=version+1, updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_run.id and version=p_expected_version returning * into v_run;
  insert into public.payroll_events (tenant_id,payroll_run_id,event_type,from_status,to_status,payload_checksum,occurred_at,actor_profile_id,idempotency_key,request_hash,safe_reason_code)
  values (p_tenant_id,v_run.id,'PAYROLL_RUN_HELD',v_from_status,'HELD',v_hash,clock_timestamp(),p_actor_profile_id,p_idempotency_key,v_hash,p_hold_code);
  return v_run;
end;
$$;

revoke all on function public.hold_payroll_run(uuid, uuid, uuid, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.hold_payroll_run(uuid, uuid, uuid, integer, text, uuid, text) to service_role;

create or replace function public.cancel_payroll_run(
  p_tenant_id uuid, p_actor_profile_id uuid, p_payroll_run_id uuid,
  p_expected_version integer, p_reason_code text, p_idempotency_key text
)
returns public.payroll_runs
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_run public.payroll_runs%rowtype; v_event public.payroll_events%rowtype; v_hash text; v_from_status text;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id,p_actor_profile_id,array['payroll_approver','accountant_controller']::text[]);
  if p_expected_version is null or p_expected_version<1 or coalesce(p_reason_code,'') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023', message='payroll_cancel_request_invalid'; end if;
  v_hash:=app_private.payroll_control_hash(jsonb_build_object('tenant_id',p_tenant_id,'run_id',p_payroll_run_id,'expected_version',p_expected_version,
    'actor_profile_id',p_actor_profile_id,'reason_code',p_reason_code));
  perform app_private.lock_payops_idempotency(p_tenant_id,'cancel_payroll_run',p_idempotency_key);
  select * into v_event from public.payroll_events event where event.tenant_id=p_tenant_id and event.idempotency_key=p_idempotency_key;
  if found then
    if v_event.payroll_run_id<>p_payroll_run_id or v_event.actor_profile_id<>p_actor_profile_id
       or v_event.event_type<>'PAYROLL_RUN_CANCELLED' or v_event.request_hash<>v_hash then
      raise exception using errcode='P0001', message='idempotency_key_reused'; end if;
    select * into v_run from public.payroll_runs run where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id;
    return v_run;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id,'payroll_run',p_payroll_run_id);
  select * into v_run from public.payroll_runs run where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id for update;
  if v_run.id is null then raise exception using errcode='P0002', message='payroll_run_not_found'; end if;
  if v_run.version<>p_expected_version or v_run.status in ('PAID','CANCELLED','PROCESSING','EMPLOYER_FUNDED','EMPLOYEE_PAYMENT_PENDING') then
    raise exception using errcode='40001', message='payroll_run_not_cancellable'; end if;
  if exists (select 1 from public.finance_integration_commands command where command.tenant_id=p_tenant_id
    and command.aggregate_type='payroll_run' and command.aggregate_id=v_run.id and command.status not in ('PENDING','CANCELLED')) then
    raise exception using errcode='P0001', message='payroll_dispatch_started_cancel_requires_recovery'; end if;
  v_from_status:=v_run.status;
  update public.finance_integration_commands set status='CANCELLED',last_safe_error_code='PAYROLL_CANCELLED_BEFORE_DISPATCH',updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and aggregate_type='payroll_run' and aggregate_id=v_run.id and status='PENDING';
  update public.payroll_inputs set status='VALIDATED',version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and payroll_calendar_id=v_run.payroll_calendar_id and status='LOCKED_TO_PAY_PERIOD';
  update public.payroll_calendars set status='OPEN',version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_run.payroll_calendar_id and status='LOCKED';
  update public.payroll_runs set status='CANCELLED',cancelled_by=p_actor_profile_id,cancelled_at=clock_timestamp(),cancel_reason_code=p_reason_code,
    version=version+1,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_run.id and version=p_expected_version returning * into v_run;
  insert into public.payroll_events (tenant_id,payroll_run_id,event_type,from_status,to_status,payload_checksum,occurred_at,actor_profile_id,idempotency_key,request_hash,safe_reason_code)
  values (p_tenant_id,v_run.id,'PAYROLL_RUN_CANCELLED',v_from_status,'CANCELLED',v_hash,clock_timestamp(),p_actor_profile_id,p_idempotency_key,v_hash,p_reason_code);
  return v_run;
end;
$$;

revoke all on function public.cancel_payroll_run(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.cancel_payroll_run(uuid, uuid, uuid, integer, text, text) to service_role;

create or replace function public.reconcile_payroll_run(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payroll_run_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_finance_integration_event_id uuid,
  p_bank_statement_item_id uuid,
  p_payroll_statement_ids uuid[],
  p_reason_code text,
  p_idempotency_key text
)
returns public.payroll_runs
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_run public.payroll_runs%rowtype;
  v_provider_event public.finance_integration_events%rowtype;
  v_event public.payroll_events%rowtype;
  v_bank public.bank_statement_items%rowtype;
  v_reconciliation public.reconciliation_matches%rowtype;
  v_payload jsonb;
  v_statement_ids uuid[];
  v_hash text;
  v_expected_event_type text;
  v_from_status text;
  v_funding_status text;
  v_employee_payment_status text;
  v_tax_filing_status text;
  v_statement_status text;
  v_reconciliation_state text;
  v_item_count integer;
  v_statement_count integer;
  v_evidence_count integer;
  v_funding_amount bigint;
  v_gross bigint; v_net bigint; v_employee_tax bigint; v_employer_tax bigint; v_deduction bigint; v_reimbursement bigint; v_employer_cost bigint;
begin
  perform app_private.assert_payops_actor_role(p_tenant_id,p_actor_profile_id,array['accountant_controller']::text[]);
  if p_expected_version is null or p_expected_version<1 or p_target_status is null
     or p_finance_integration_event_id is null
     or p_target_status not in ('PREVIEWED','PROCESSING','EMPLOYER_FUNDED','EMPLOYEE_PAYMENT_PENDING','PAID',
      'ACTION_REQUIRED','FUNDING_FAILED','EMPLOYEE_PAYMENT_FAILED','TAX_OR_FILING_FAILED','RECONCILIATION_REQUIRED')
     or coalesce(cardinality(p_payroll_statement_ids), 0) > 1000
     or exists (select 1 from unnest(coalesce(p_payroll_statement_ids, '{}'::uuid[])) statement_id where statement_id is null)
     or (select count(*) from unnest(coalesce(p_payroll_statement_ids, '{}'::uuid[])) statement_id)
        <> (select count(distinct statement_id) from unnest(coalesce(p_payroll_statement_ids, '{}'::uuid[])) statement_id)
     or (p_target_status = 'PAID' and (p_bank_statement_item_id is null or coalesce(cardinality(p_payroll_statement_ids), 0) < 1))
     or (p_target_status <> 'PAID' and (p_bank_statement_item_id is not null or coalesce(cardinality(p_payroll_statement_ids), 0) <> 0))
     or coalesce(p_reason_code,'') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023', message='payroll_reconciliation_request_invalid'; end if;
  select coalesce(array_agg(statement_id order by statement_id), '{}'::uuid[])
  into v_statement_ids
  from unnest(coalesce(p_payroll_statement_ids, '{}'::uuid[])) statement_id;
  v_hash:=app_private.payroll_control_hash(jsonb_build_object('tenant_id',p_tenant_id,'run_id',p_payroll_run_id,'expected_version',p_expected_version,
    'target_status',p_target_status,'finance_integration_event_id',p_finance_integration_event_id,
    'bank_statement_item_id',p_bank_statement_item_id,'payroll_statement_ids',to_jsonb(v_statement_ids),
    'actor_profile_id',p_actor_profile_id,'reason_code',p_reason_code));
  perform app_private.lock_payops_idempotency(p_tenant_id,'reconcile_payroll_run',p_idempotency_key);
  select * into v_event from public.payroll_events event where event.tenant_id=p_tenant_id and event.idempotency_key=p_idempotency_key;
  if found then
    if v_event.payroll_run_id<>p_payroll_run_id or v_event.actor_profile_id<>p_actor_profile_id
       or v_event.event_type<>'PAYROLL_RECONCILED' or v_event.request_hash<>v_hash then
      raise exception using errcode='P0001', message='idempotency_key_reused'; end if;
    select * into v_run from public.payroll_runs run where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id;
    return v_run;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id,'payroll_run',p_payroll_run_id);
  select * into v_run from public.payroll_runs run where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id for update;
  if v_run.id is null then raise exception using errcode='P0002', message='payroll_run_not_found'; end if;
  if v_run.version<>p_expected_version then raise exception using errcode='40001', message='payroll_run_version_conflict'; end if;
  if v_run.prepared_by = p_actor_profile_id
     or v_run.approved_by = p_actor_profile_id
     or exists (
       select 1 from public.finance_integration_commands command
       where command.tenant_id = p_tenant_id
         and command.provider = 'gusto_embedded'
         and command.aggregate_type = 'payroll_run'
         and command.aggregate_id = v_run.id
         and command.created_by = p_actor_profile_id
     ) then
    raise exception using errcode='P0001', message='payroll_controller_separation_required';
  end if;
  select * into v_provider_event from public.finance_integration_events event
  where event.tenant_id=p_tenant_id and event.id=p_finance_integration_event_id
    and event.provider='gusto_embedded' and event.aggregate_type='payroll_run' and event.aggregate_id=v_run.id
    and event.signature_valid and event.status='PROCESSED' and event.provider_payload is not null
  for update;
  if v_provider_event.id is null then raise exception using errcode='P0001', message='verified_gusto_event_required'; end if;
  v_payload := v_provider_event.provider_payload;
  if app_private.payroll_control_hash(v_payload) <> v_provider_event.payload_checksum
     or coalesce(v_payload->>'tenant_id','') <> p_tenant_id::text
     or coalesce(v_payload->>'payroll_run_id','') <> v_run.id::text
     or coalesce(v_payload->>'gusto_company_id','') <> coalesce(v_run.gusto_company_id,'')
     or coalesce(v_payload->>'target_status','') <> p_target_status
     or coalesce(v_payload->>'currency','') <> 'USD' then
    raise exception using errcode='P0001', message='payroll_provider_payload_binding_invalid';
  end if;
  v_expected_event_type := case p_target_status
    when 'PREVIEWED' then 'PAYROLL_PREVIEW_READY' when 'PROCESSING' then 'PAYROLL_ACCEPTED'
    when 'EMPLOYER_FUNDED' then 'EMPLOYER_FUNDED' when 'EMPLOYEE_PAYMENT_PENDING' then 'EMPLOYEE_PAYMENT_PENDING'
    when 'PAID' then 'PAYROLL_PAID' when 'ACTION_REQUIRED' then 'PAYROLL_ACTION_REQUIRED'
    when 'FUNDING_FAILED' then 'PAYROLL_FUNDING_FAILED' when 'EMPLOYEE_PAYMENT_FAILED' then 'PAYROLL_PAYMENT_FAILED'
    when 'TAX_OR_FILING_FAILED' then 'PAYROLL_TAX_OR_FILING_FAILED'
    when 'RECONCILIATION_REQUIRED' then 'PAYROLL_RECONCILIATION_REQUIRED' end;
  if v_provider_event.event_type<>v_expected_event_type then raise exception using errcode='P0001', message='gusto_event_type_mismatch'; end if;
  if (p_target_status='PREVIEWED' and v_run.status<>'PREVIEW_QUEUED')
     or (p_target_status='PROCESSING' and v_run.status<>'SUBMISSION_QUEUED')
     or (p_target_status='EMPLOYER_FUNDED' and v_run.status<>'PROCESSING')
     or (p_target_status='EMPLOYEE_PAYMENT_PENDING' and v_run.status<>'EMPLOYER_FUNDED')
     or (p_target_status='PAID' and v_run.status<>'EMPLOYEE_PAYMENT_PENDING')
     or (p_target_status='FUNDING_FAILED' and v_run.status<>'PROCESSING')
     or (p_target_status in ('EMPLOYEE_PAYMENT_FAILED','TAX_OR_FILING_FAILED') and v_run.status not in ('EMPLOYER_FUNDED','EMPLOYEE_PAYMENT_PENDING'))
     or (p_target_status='ACTION_REQUIRED' and v_run.status not in ('PREVIEW_QUEUED','PREVIEWED','SUBMISSION_QUEUED','PROCESSING','EMPLOYER_FUNDED','EMPLOYEE_PAYMENT_PENDING'))
     or (p_target_status='RECONCILIATION_REQUIRED' and v_run.status not in ('PREVIEW_QUEUED','PREVIEWED','SUBMISSION_QUEUED','PROCESSING','EMPLOYER_FUNDED','EMPLOYEE_PAYMENT_PENDING')) then
    raise exception using errcode='40001', message='payroll_reconciliation_transition_invalid'; end if;
  if coalesce(v_payload->>'gusto_payroll_id','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'
     or exists (select 1 from (values ('gross_cents'),('net_cents'),('employee_tax_cents'),('employer_tax_cents'),
       ('deduction_cents'),('reimbursement_cents'),('employer_cost_cents')) fields(name)
       where coalesce(v_payload->>fields.name,'') !~ '^[0-9]{1,18}$')
     or exists (select 1 from (values ('funding_status'),('employee_payment_status'),('tax_filing_status'),('statement_status')) fields(name)
       where coalesce(v_payload->>fields.name,'') !~ '^[A-Z][A-Z0-9_]{1,63}$')
     or coalesce(v_payload->>'reconciliation_state','') not in ('UNMATCHED','PARTIAL','MATCHED','EXCEPTION') then
    raise exception using errcode='22023', message='payroll_provider_payload_invalid';
  end if;
  v_gross:=(v_payload->>'gross_cents')::bigint; v_net:=(v_payload->>'net_cents')::bigint;
  v_employee_tax:=(v_payload->>'employee_tax_cents')::bigint; v_employer_tax:=(v_payload->>'employer_tax_cents')::bigint;
  v_deduction:=(v_payload->>'deduction_cents')::bigint; v_reimbursement:=(v_payload->>'reimbursement_cents')::bigint;
  v_employer_cost:=(v_payload->>'employer_cost_cents')::bigint;
  v_funding_status:=v_payload->>'funding_status';
  v_employee_payment_status:=v_payload->>'employee_payment_status';
  v_tax_filing_status:=v_payload->>'tax_filing_status';
  v_statement_status:=v_payload->>'statement_status';
  v_reconciliation_state:=v_payload->>'reconciliation_state';
  if v_net+v_employee_tax+v_deduction<>v_gross+v_reimbursement
     or v_employer_cost<>v_gross+v_reimbursement+v_employer_tax
     or v_gross<>v_run.gross_cents or v_reimbursement<>v_run.reimbursement_cents
     or (p_target_status<>'PREVIEWED' and (
       v_net<>v_run.net_cents or v_employee_tax<>v_run.employee_tax_cents
       or v_employer_tax<>v_run.employer_tax_cents or v_deduction<>v_run.deduction_cents
       or v_employer_cost<>v_run.employer_cost_cents
       or v_payload->>'gusto_payroll_id'<>v_run.gusto_payroll_id
     )) then
    raise exception using errcode='P0001', message='payroll_preview_totals_invalid';
  end if;
  if p_target_status='PREVIEWED' and (
    coalesce(v_payload->>'preview_version','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{1,119}$'
    or coalesce(v_payload->>'preview_hash','') !~ '^[0-9a-f]{64}$'
  ) then raise exception using errcode='22023', message='payroll_preview_evidence_invalid'; end if;
  if p_target_status<>'PAID' and (
    v_employee_payment_status='PAID' or v_statement_status='AVAILABLE' or v_reconciliation_state='MATCHED'
  ) then raise exception using errcode='P0001', message='payroll_terminal_state_requires_settlement_evidence'; end if;

  if p_target_status='PAID' then
    if v_run.approved_by is null
       or v_funding_status<>'FUNDED' or v_employee_payment_status<>'PAID'
       or v_tax_filing_status not in ('SCHEDULED','FILED','ACCEPTED')
       or v_statement_status<>'AVAILABLE' or v_reconciliation_state<>'MATCHED'
       or coalesce(v_payload->>'funding_transaction_id','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'
       or coalesce(v_payload->>'funding_account_id','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'
       or coalesce(v_payload->>'funding_amount_cents','') !~ '^[0-9]{1,18}$'
       or coalesce(v_payload->>'bank_statement_payload_checksum','') !~ '^[0-9a-f]{64}$'
       or jsonb_typeof(v_payload->'items')<>'array' then
      raise exception using errcode='P0001', message='payroll_paid_evidence_incomplete';
    end if;
    v_funding_amount:=(v_payload->>'funding_amount_cents')::bigint;
    if v_funding_amount<>v_run.employer_cost_cents then
      raise exception using errcode='P0001', message='payroll_bank_evidence_mismatch';
    end if;
    perform item.id
    from public.payroll_items item
    join public.payroll_profiles profile
      on profile.tenant_id=item.tenant_id and profile.id=item.payroll_profile_id
    where item.tenant_id=p_tenant_id and item.payroll_run_id=v_run.id
    for update of item, profile;
    select count(*) into v_item_count from public.payroll_items item
    where item.tenant_id=p_tenant_id and item.payroll_run_id=v_run.id;
    if v_item_count<1 or jsonb_array_length(v_payload->'items')<>v_item_count
       or cardinality(v_statement_ids)<>v_item_count
       or exists (
         select 1 from jsonb_array_elements(v_payload->'items') payload_item
         group by payload_item->>'payroll_item_id'
         having count(*)<>1
       )
       or exists (
         select 1 from jsonb_array_elements(v_payload->'items') payload_item
         group by payload_item->>'payroll_statement_id'
         having count(*)<>1
       ) then
      raise exception using errcode='P0001', message='payroll_statement_evidence_mismatch';
    end if;
    perform statement.id from public.payroll_statements statement
    where statement.tenant_id=p_tenant_id and statement.id=any(v_statement_ids)
    for update;
    select count(distinct statement.id) into v_statement_count
    from public.payroll_statements statement
    join public.payroll_items item
      on item.tenant_id=statement.tenant_id and item.id=statement.payroll_item_id
    join public.payroll_profiles profile
      on profile.tenant_id=item.tenant_id and profile.id=item.payroll_profile_id
    where statement.tenant_id=p_tenant_id and statement.id=any(v_statement_ids)
      and item.payroll_run_id=v_run.id
      and statement.payroll_profile_id=item.payroll_profile_id
      and statement.statement_status='AVAILABLE' and statement.available_at is not null
      and item.payment_status='PAID' and item.statement_status='AVAILABLE'
      and item.gusto_employee_id is not null and item.gusto_employee_id=profile.gusto_employee_id
      and exists (
        select 1 from jsonb_array_elements(v_payload->'items') payload_item
        where payload_item->>'payroll_item_id'=item.id::text
          and payload_item->>'payroll_profile_id'=item.payroll_profile_id::text
          and payload_item->>'gusto_employee_id'=item.gusto_employee_id
          and payload_item->>'net_cents'=item.net_cents::text
          and payload_item->>'payroll_statement_id'=statement.id::text
          and payload_item->>'provider_statement_id'=statement.provider_statement_id
          and payload_item->>'statement_checksum'=statement.checksum_sha256
          and payload_item->>'payment_status'='PAID'
          and payload_item->>'statement_status'='AVAILABLE'
      );
    if v_statement_count<>v_item_count then
      raise exception using errcode='P0001', message='payroll_statement_evidence_mismatch';
    end if;
    select * into v_bank from public.bank_statement_items bank
    where bank.tenant_id=p_tenant_id and bank.id=p_bank_statement_item_id
      and bank.legal_entity_id=v_run.legal_entity_id and bank.provider='mercury'
      and bank.provider_account_id=v_payload->>'funding_account_id'
      and bank.provider_transaction_id=v_payload->>'funding_transaction_id'
      and bank.payload_checksum=v_payload->>'bank_statement_payload_checksum'
      and bank.currency=v_payload->>'currency' and bank.normalized_direction='DEBIT'
      and bank.amount_cents=-v_funding_amount
      and lower(bank.provider_status) in ('posted','settled','completed')
      and bank.posted_at is not null and bank.last_success_at is not null
      and not exists (
        select 1 from public.reconciliation_matches allocated
        where allocated.tenant_id=p_tenant_id and allocated.bank_statement_item_id=bank.id
          and allocated.match_status='APPROVED'
      )
    for update;
    if v_bank.id is null then raise exception using errcode='P0001', message='payroll_bank_evidence_mismatch'; end if;
    insert into public.reconciliation_matches (
      tenant_id,bank_statement_item_id,payroll_run_id,match_status,matched_amount_cents,
      variance_cents,policy_version,proposed_by,approved_by,approved_at
    ) values (
      p_tenant_id,v_bank.id,v_run.id,'APPROVED',v_funding_amount,0,
      'employee_payroll_exact_v1','HUMAN',p_actor_profile_id,clock_timestamp()
    ) returning * into v_reconciliation;
    insert into public.payroll_paid_statement_evidence (
      tenant_id,payroll_run_id,payroll_item_id,payroll_statement_id,payroll_profile_id,
      gusto_employee_id,net_cents,provider_statement_id,statement_checksum,provider_event_id,recorded_by
    )
    select p_tenant_id,v_run.id,item.id,statement.id,item.payroll_profile_id,
      item.gusto_employee_id,item.net_cents,statement.provider_statement_id,
      statement.checksum_sha256,v_provider_event.id,p_actor_profile_id
    from public.payroll_statements statement
    join public.payroll_items item
      on item.tenant_id=statement.tenant_id and item.id=statement.payroll_item_id
    where statement.tenant_id=p_tenant_id and statement.id=any(v_statement_ids)
      and item.payroll_run_id=v_run.id;
    get diagnostics v_evidence_count = row_count;
    if v_evidence_count<>v_item_count then
      raise exception using errcode='P0001', message='payroll_statement_evidence_mismatch';
    end if;
  end if;
  v_from_status:=v_run.status;
  update public.payroll_runs set status=p_target_status,
    gusto_payroll_id=case when p_target_status='PREVIEWED' then v_payload->>'gusto_payroll_id' else gusto_payroll_id end,
    preview_version=case when p_target_status='PREVIEWED' then v_payload->>'preview_version' else preview_version end,
    preview_hash=case when p_target_status='PREVIEWED' then v_payload->>'preview_hash' else preview_hash end,
    gross_cents=v_gross,net_cents=v_net,employee_tax_cents=v_employee_tax,employer_tax_cents=v_employer_tax,
    deduction_cents=v_deduction,reimbursement_cents=v_reimbursement,employer_cost_cents=v_employer_cost,
    funding_status=v_funding_status,employee_payment_status=v_employee_payment_status,
    tax_filing_status=v_tax_filing_status,statement_status=v_statement_status,
    reconciliation_state=v_reconciliation_state,
    provider_observed_at=coalesce(v_provider_event.occurred_at,v_provider_event.received_at),
    last_provider_success_at=case when p_target_status in ('ACTION_REQUIRED','FUNDING_FAILED','EMPLOYEE_PAYMENT_FAILED','TAX_OR_FILING_FAILED','RECONCILIATION_REQUIRED')
      then last_provider_success_at else v_provider_event.received_at end,
    last_reconciliation_event_id=v_provider_event.id,
    last_bank_statement_item_id=case when p_target_status='PAID' then v_bank.id else last_bank_statement_item_id end,
    last_reconciliation_match_id=case when p_target_status='PAID' then v_reconciliation.id else last_reconciliation_match_id end,
    paid_provider_payload_checksum=case when p_target_status='PAID' then v_provider_event.payload_checksum else paid_provider_payload_checksum end,
    paid_controller_profile_id=case when p_target_status='PAID' then p_actor_profile_id else paid_controller_profile_id end,
    paid_evidence_recorded_at=case when p_target_status='PAID' then clock_timestamp() else paid_evidence_recorded_at end,
    version=version+1,updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=v_run.id and version=p_expected_version returning * into v_run;
  insert into public.payroll_events (tenant_id,payroll_run_id,event_type,from_status,to_status,provider_event_id,payload_checksum,
    occurred_at,actor_profile_id,idempotency_key,request_hash,safe_reason_code)
  values (p_tenant_id,v_run.id,'PAYROLL_RECONCILED',v_from_status,p_target_status,v_provider_event.provider_event_id,v_provider_event.payload_checksum,
    coalesce(v_provider_event.occurred_at,v_provider_event.received_at),p_actor_profile_id,p_idempotency_key,v_hash,p_reason_code);
  insert into public.audit_events (tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload)
  values (p_tenant_id,p_actor_profile_id,'employee_payroll_run_reconciled','payroll_runs',v_run.id,false,v_hash,
    jsonb_build_object('target_status',p_target_status,'finance_integration_event_id',v_provider_event.id,
      'bank_statement_item_id',v_bank.id,'reconciliation_match_id',v_reconciliation.id,
      'statement_count',case when p_target_status='PAID' then v_evidence_count else 0 end,
      'reconciliation_state',v_run.reconciliation_state,'run_version',v_run.version,'reason_code',p_reason_code));
  return v_run;
end;
$$;

revoke all on function public.reconcile_payroll_run(uuid, uuid, uuid, integer, text, uuid, uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.reconcile_payroll_run(uuid, uuid, uuid, integer, text, uuid, uuid, uuid[], text, text) to service_role;

-- Canonical paid is a live predicate, not a stored label. The Admin GET route
-- calls this for every persisted PAID run so a missing/superseded statement,
-- bank allocation, or non-terminal provider event fails closed in the UI.
create or replace function public.payroll_run_paid_evidence_valid(
  p_tenant_id uuid,
  p_payroll_run_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.payroll_runs run
    join public.finance_integration_events event
      on event.tenant_id=run.tenant_id and event.id=run.last_reconciliation_event_id
    join public.bank_statement_items bank
      on bank.tenant_id=run.tenant_id and bank.id=run.last_bank_statement_item_id
    join public.reconciliation_matches reconciliation
      on reconciliation.tenant_id=run.tenant_id and reconciliation.id=run.last_reconciliation_match_id
    where run.tenant_id=p_tenant_id and run.id=p_payroll_run_id and run.status='PAID'
      and run.funding_status='FUNDED' and run.employee_payment_status='PAID'
      and run.tax_filing_status in ('SCHEDULED','FILED','ACCEPTED')
      and run.statement_status='AVAILABLE' and run.reconciliation_state='MATCHED'
      and run.provider_observed_at is not null and run.last_provider_success_at is not null
      and run.paid_controller_profile_id is not null and run.paid_evidence_recorded_at is not null
      and run.approved_by is not null
      and run.paid_controller_profile_id is distinct from run.prepared_by
      and run.paid_controller_profile_id is distinct from run.approved_by
      and not exists (
        select 1 from public.finance_integration_commands command
        where command.tenant_id=run.tenant_id and command.provider='gusto_embedded'
          and command.aggregate_type='payroll_run' and command.aggregate_id=run.id
          and command.created_by=run.paid_controller_profile_id
      )
      and event.provider='gusto_embedded' and event.aggregate_type='payroll_run'
      and event.aggregate_id=run.id and event.event_type='PAYROLL_PAID'
      and event.signature_valid and event.status='PROCESSED' and event.provider_payload is not null
      and app_private.payroll_control_hash(event.provider_payload)=event.payload_checksum
      and run.paid_provider_payload_checksum=event.payload_checksum
      and event.provider_payload->>'tenant_id'=run.tenant_id::text
      and event.provider_payload->>'payroll_run_id'=run.id::text
      and event.provider_payload->>'gusto_company_id'=run.gusto_company_id
      and event.provider_payload->>'gusto_payroll_id'=run.gusto_payroll_id
      and event.provider_payload->>'target_status'='PAID'
      and event.provider_payload->>'currency'='USD'
      and event.provider_payload->>'gross_cents'=run.gross_cents::text
      and event.provider_payload->>'net_cents'=run.net_cents::text
      and event.provider_payload->>'employee_tax_cents'=run.employee_tax_cents::text
      and event.provider_payload->>'employer_tax_cents'=run.employer_tax_cents::text
      and event.provider_payload->>'deduction_cents'=run.deduction_cents::text
      and event.provider_payload->>'reimbursement_cents'=run.reimbursement_cents::text
      and event.provider_payload->>'employer_cost_cents'=run.employer_cost_cents::text
      and event.provider_payload->>'funding_amount_cents'=run.employer_cost_cents::text
      and event.provider_payload->>'funding_status'='FUNDED'
      and event.provider_payload->>'employee_payment_status'='PAID'
      and event.provider_payload->>'tax_filing_status'=run.tax_filing_status
      and event.provider_payload->>'statement_status'='AVAILABLE'
      and event.provider_payload->>'reconciliation_state'='MATCHED'
      and jsonb_typeof(event.provider_payload->'items')='array'
      and bank.legal_entity_id=run.legal_entity_id and bank.provider='mercury'
      and bank.provider_account_id=event.provider_payload->>'funding_account_id'
      and bank.provider_transaction_id=event.provider_payload->>'funding_transaction_id'
      and bank.payload_checksum=event.provider_payload->>'bank_statement_payload_checksum'
      and bank.currency='USD' and bank.normalized_direction='DEBIT'
      and bank.amount_cents=-run.employer_cost_cents
      and lower(bank.provider_status) in ('posted','settled','completed')
      and bank.posted_at is not null and bank.last_success_at is not null
      and reconciliation.bank_statement_item_id=bank.id and reconciliation.payroll_run_id=run.id
      and reconciliation.match_status='APPROVED'
      and reconciliation.matched_amount_cents=run.employer_cost_cents
      and reconciliation.variance_cents=0
      and reconciliation.policy_version='employee_payroll_exact_v1'
      and reconciliation.approved_by=run.paid_controller_profile_id
      and reconciliation.approved_at is not null
      and (select count(*) from public.payroll_items item
        where item.tenant_id=run.tenant_id and item.payroll_run_id=run.id)>0
      and jsonb_array_length(event.provider_payload->'items')=(
        select count(*) from public.payroll_items item
        where item.tenant_id=run.tenant_id and item.payroll_run_id=run.id
      )
      and (select count(*) from public.payroll_paid_statement_evidence evidence
        where evidence.tenant_id=run.tenant_id and evidence.payroll_run_id=run.id)=(
        select count(*) from public.payroll_items item
        where item.tenant_id=run.tenant_id and item.payroll_run_id=run.id
      )
      and not exists (
        select 1
        from public.payroll_items item
        join public.payroll_profiles profile
          on profile.tenant_id=item.tenant_id and profile.id=item.payroll_profile_id
        left join public.payroll_paid_statement_evidence evidence
          on evidence.tenant_id=item.tenant_id and evidence.payroll_run_id=item.payroll_run_id
          and evidence.payroll_item_id=item.id
        left join public.payroll_statements statement
          on statement.tenant_id=evidence.tenant_id and statement.id=evidence.payroll_statement_id
        where item.tenant_id=run.tenant_id and item.payroll_run_id=run.id
          and (
            item.payment_status<>'PAID' or item.statement_status<>'AVAILABLE'
            or item.gusto_employee_id is null or item.gusto_employee_id<>profile.gusto_employee_id
            or evidence.id is null or evidence.provider_event_id<>event.id
            or evidence.recorded_by<>run.paid_controller_profile_id
            or evidence.payroll_profile_id<>item.payroll_profile_id
            or evidence.gusto_employee_id<>item.gusto_employee_id
            or evidence.net_cents<>item.net_cents
            or statement.id is null or statement.payroll_item_id<>item.id
            or statement.payroll_profile_id<>item.payroll_profile_id
            or statement.statement_status<>'AVAILABLE' or statement.available_at is null
            or evidence.provider_statement_id<>statement.provider_statement_id
            or evidence.statement_checksum<>statement.checksum_sha256
            or not exists (
              select 1 from jsonb_array_elements(event.provider_payload->'items') payload_item
              where payload_item->>'payroll_item_id'=item.id::text
                and payload_item->>'payroll_profile_id'=item.payroll_profile_id::text
                and payload_item->>'gusto_employee_id'=item.gusto_employee_id
                and payload_item->>'net_cents'=item.net_cents::text
                and payload_item->>'payroll_statement_id'=statement.id::text
                and payload_item->>'provider_statement_id'=statement.provider_statement_id
                and payload_item->>'statement_checksum'=statement.checksum_sha256
                and payload_item->>'payment_status'='PAID'
                and payload_item->>'statement_status'='AVAILABLE'
            )
          )
      )
  );
$$;

revoke all on function public.payroll_run_paid_evidence_valid(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.payroll_run_paid_evidence_valid(uuid, uuid)
  to service_role;

create or replace function app_private.guard_employee_payroll_records()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_evidence public.finance_integration_events%rowtype;
  v_bank public.bank_statement_items%rowtype;
  v_match public.reconciliation_matches%rowtype;
  v_item_count integer;
  v_statement_evidence_count integer;
begin
  if tg_op='DELETE' then raise exception using errcode='P0001', message='payroll_control_record_delete_forbidden'; end if;
  if tg_table_name='payroll_profiles' and (
    old.tenant_id is distinct from new.tenant_id or old.worker_profile_id is distinct from new.worker_profile_id
    or old.legal_entity_id is distinct from new.legal_entity_id or old.worker_category is distinct from new.worker_category
    or old.gusto_company_id is distinct from new.gusto_company_id or old.gusto_employee_id is distinct from new.gusto_employee_id
    or old.request_idempotency_key is distinct from new.request_idempotency_key or old.request_hash is distinct from new.request_hash
    or old.prepared_by is distinct from new.prepared_by or old.prepared_at is distinct from new.prepared_at
  ) then raise exception using errcode='P0001', message='payroll_profile_identity_immutable'; end if;
  if tg_table_name='payroll_calendars' and (
    old.tenant_id is distinct from new.tenant_id or old.legal_entity_id is distinct from new.legal_entity_id
    or old.period_start is distinct from new.period_start or old.period_end is distinct from new.period_end
    or old.cutoff_at is distinct from new.cutoff_at or old.pay_date is distinct from new.pay_date
    or old.funding_date is distinct from new.funding_date or old.timezone is distinct from new.timezone
    or old.run_type is distinct from new.run_type or old.jurisdiction_policy_version is distinct from new.jurisdiction_policy_version
    or old.request_idempotency_key is distinct from new.request_idempotency_key or old.request_hash is distinct from new.request_hash
  ) then raise exception using errcode='P0001', message='payroll_calendar_identity_immutable'; end if;
  if tg_table_name='payroll_inputs' and (
    old.tenant_id is distinct from new.tenant_id or old.payroll_profile_id is distinct from new.payroll_profile_id
    or old.payroll_calendar_id is distinct from new.payroll_calendar_id or old.earning_event_id is distinct from new.earning_event_id
    or old.category is distinct from new.category or old.quantity is distinct from new.quantity or old.unit is distinct from new.unit
    or old.amount_cents is distinct from new.amount_cents or old.taxable is distinct from new.taxable
    or old.regular_rate_component is distinct from new.regular_rate_component or old.source_hash is distinct from new.source_hash
    or old.policy_version is distinct from new.policy_version or old.request_idempotency_key is distinct from new.request_idempotency_key
    or old.request_hash is distinct from new.request_hash or old.prepared_by is distinct from new.prepared_by
  ) then raise exception using errcode='P0001', message='payroll_input_source_immutable'; end if;
  if tg_table_name='payroll_runs' then
    if old.tenant_id is distinct from new.tenant_id or old.legal_entity_id is distinct from new.legal_entity_id
      or old.payroll_calendar_id is distinct from new.payroll_calendar_id or old.provider is distinct from new.provider
      or old.gusto_company_id is distinct from new.gusto_company_id or old.request_idempotency_key is distinct from new.request_idempotency_key
      or old.request_hash is distinct from new.request_hash or old.prepared_by is distinct from new.prepared_by
      or old.prepared_at is distinct from new.prepared_at then
      raise exception using errcode='P0001', message='payroll_run_identity_immutable'; end if;
    if old.status='PAID' and (
      old.last_reconciliation_event_id is distinct from new.last_reconciliation_event_id
      or old.last_bank_statement_item_id is distinct from new.last_bank_statement_item_id
      or old.last_reconciliation_match_id is distinct from new.last_reconciliation_match_id
      or old.paid_provider_payload_checksum is distinct from new.paid_provider_payload_checksum
      or old.paid_controller_profile_id is distinct from new.paid_controller_profile_id
      or old.paid_evidence_recorded_at is distinct from new.paid_evidence_recorded_at
    ) then raise exception using errcode='P0001', message='payroll_paid_evidence_immutable'; end if;
    if old.status is distinct from new.status and not (
      (old.status='DRAFT' and new.status in ('PREVIEW_QUEUED','HELD','CANCELLED','ACTION_REQUIRED'))
      or (old.status='PREVIEW_QUEUED' and new.status in ('PREVIEWED','HELD','CANCELLED','ACTION_REQUIRED','RECONCILIATION_REQUIRED'))
      or (old.status='PREVIEWED' and new.status in ('HUMAN_APPROVED','HELD','CANCELLED','ACTION_REQUIRED','CORRECTION_REQUIRED','RECONCILIATION_REQUIRED'))
      or (old.status='HUMAN_APPROVED' and new.status in ('SUBMISSION_QUEUED','HELD','CANCELLED','ACTION_REQUIRED'))
      or (old.status='SUBMISSION_QUEUED' and new.status in ('PROCESSING','HELD','CANCELLED','ACTION_REQUIRED','RECONCILIATION_REQUIRED'))
      or (old.status='PROCESSING' and new.status in ('EMPLOYER_FUNDED','FUNDING_FAILED','ACTION_REQUIRED','RECONCILIATION_REQUIRED'))
      or (old.status='EMPLOYER_FUNDED' and new.status in ('EMPLOYEE_PAYMENT_PENDING','EMPLOYEE_PAYMENT_FAILED','TAX_OR_FILING_FAILED','ACTION_REQUIRED','RECONCILIATION_REQUIRED'))
      or (old.status='EMPLOYEE_PAYMENT_PENDING' and new.status in ('PAID','EMPLOYEE_PAYMENT_FAILED','TAX_OR_FILING_FAILED','ACTION_REQUIRED','RECONCILIATION_REQUIRED'))
      or (old.status in ('HELD','ACTION_REQUIRED','FUNDING_FAILED','EMPLOYEE_PAYMENT_FAILED','TAX_OR_FILING_FAILED','CORRECTION_REQUIRED','OFF_CYCLE_REQUIRED','RECONCILIATION_REQUIRED') and new.status='CANCELLED')
    ) then raise exception using errcode='P0001', message='payroll_run_transition_invalid'; end if;
    if (
      old.gross_cents is distinct from new.gross_cents or old.net_cents is distinct from new.net_cents
      or old.employee_tax_cents is distinct from new.employee_tax_cents or old.employer_tax_cents is distinct from new.employer_tax_cents
      or old.deduction_cents is distinct from new.deduction_cents or old.reimbursement_cents is distinct from new.reimbursement_cents
      or old.employer_cost_cents is distinct from new.employer_cost_cents
    ) and not (old.status='PREVIEW_QUEUED' and new.status='PREVIEWED' and new.last_reconciliation_event_id is not null)
      then raise exception using errcode='P0001', message='payroll_run_money_immutable_after_preview'; end if;
    if new.status='PAID' then
      select * into v_evidence from public.finance_integration_events event
      where event.tenant_id=new.tenant_id and event.id=new.last_reconciliation_event_id
        and event.provider='gusto_embedded' and event.aggregate_type='payroll_run' and event.aggregate_id=new.id
        and event.event_type='PAYROLL_PAID' and event.signature_valid and event.status='PROCESSED'
        and event.provider_payload is not null
        and app_private.payroll_control_hash(event.provider_payload)=event.payload_checksum
        and event.payload_checksum=new.paid_provider_payload_checksum
        and event.provider_payload->>'tenant_id'=new.tenant_id::text
        and event.provider_payload->>'payroll_run_id'=new.id::text
        and event.provider_payload->>'gusto_company_id'=new.gusto_company_id
        and event.provider_payload->>'gusto_payroll_id'=new.gusto_payroll_id
        and event.provider_payload->>'target_status'='PAID'
        and event.provider_payload->>'currency'='USD'
        and event.provider_payload->>'employer_cost_cents'=new.employer_cost_cents::text
        and event.provider_payload->>'funding_amount_cents'=new.employer_cost_cents::text
        and event.provider_payload->>'funding_status'='FUNDED'
        and event.provider_payload->>'employee_payment_status'='PAID'
        and event.provider_payload->>'tax_filing_status'=new.tax_filing_status
        and event.provider_payload->>'statement_status'='AVAILABLE'
        and event.provider_payload->>'reconciliation_state'='MATCHED';
      select * into v_bank from public.bank_statement_items bank
      where bank.tenant_id=new.tenant_id and bank.id=new.last_bank_statement_item_id
        and bank.legal_entity_id=new.legal_entity_id and bank.provider='mercury'
        and bank.provider_account_id=v_evidence.provider_payload->>'funding_account_id'
        and bank.provider_transaction_id=v_evidence.provider_payload->>'funding_transaction_id'
        and bank.payload_checksum=v_evidence.provider_payload->>'bank_statement_payload_checksum'
        and bank.currency='USD' and bank.normalized_direction='DEBIT'
        and bank.amount_cents=-new.employer_cost_cents
        and lower(bank.provider_status) in ('posted','settled','completed')
        and bank.posted_at is not null and bank.last_success_at is not null;
      select * into v_match from public.reconciliation_matches reconciliation
      where reconciliation.tenant_id=new.tenant_id and reconciliation.id=new.last_reconciliation_match_id
        and reconciliation.bank_statement_item_id=v_bank.id and reconciliation.payroll_run_id=new.id
        and reconciliation.match_status='APPROVED' and reconciliation.matched_amount_cents=new.employer_cost_cents
        and reconciliation.variance_cents=0 and reconciliation.policy_version='employee_payroll_exact_v1'
        and reconciliation.approved_by=new.paid_controller_profile_id and reconciliation.approved_at is not null;
      select count(*) into v_item_count from public.payroll_items item
      where item.tenant_id=new.tenant_id and item.payroll_run_id=new.id;
      select count(*) into v_statement_evidence_count
      from public.payroll_paid_statement_evidence evidence
      join public.payroll_items item
        on item.tenant_id=evidence.tenant_id and item.id=evidence.payroll_item_id
      join public.payroll_statements statement
        on statement.tenant_id=evidence.tenant_id and statement.id=evidence.payroll_statement_id
      where evidence.tenant_id=new.tenant_id and evidence.payroll_run_id=new.id
        and evidence.provider_event_id=v_evidence.id and evidence.recorded_by=new.paid_controller_profile_id
        and item.payroll_run_id=new.id and item.payment_status='PAID' and item.statement_status='AVAILABLE'
        and evidence.payroll_profile_id=item.payroll_profile_id
        and evidence.gusto_employee_id=item.gusto_employee_id and evidence.net_cents=item.net_cents
        and statement.payroll_item_id=item.id and statement.payroll_profile_id=item.payroll_profile_id
        and statement.statement_status='AVAILABLE' and statement.available_at is not null
        and evidence.provider_statement_id=statement.provider_statement_id
        and evidence.statement_checksum=statement.checksum_sha256;
      if v_evidence.id is null or new.funding_status<>'FUNDED' or new.employee_payment_status<>'PAID'
         or new.tax_filing_status not in ('SCHEDULED','FILED','ACCEPTED')
         or new.statement_status<>'AVAILABLE' or new.reconciliation_state<>'MATCHED'
         or new.provider_observed_at is null or new.last_provider_success_at is null
         or new.paid_controller_profile_id is null
         or new.approved_by is null
         or new.paid_controller_profile_id=new.prepared_by or new.paid_controller_profile_id=new.approved_by
         or exists (select 1 from public.finance_integration_commands command
           where command.tenant_id=new.tenant_id and command.provider='gusto_embedded'
             and command.aggregate_type='payroll_run' and command.aggregate_id=new.id
             and command.created_by=new.paid_controller_profile_id)
         or v_bank.id is null or v_match.id is null or v_item_count<1
         or v_statement_evidence_count<>v_item_count then
        raise exception using errcode='P0001', message='payroll_paid_evidence_incomplete'; end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_employee_payroll_records() from public, anon, authenticated, service_role;

do $$
declare guarded text;
begin
  foreach guarded in array array['payroll_profiles','payroll_calendars','payroll_inputs','payroll_runs'] loop
    execute format('drop trigger if exists %I on public.%I', guarded || '_employee_control_guard', guarded);
    execute format('create trigger %I before update or delete on public.%I for each row execute function app_private.guard_employee_payroll_records()',
      guarded || '_employee_control_guard', guarded);
  end loop;
end $$;

-- Reassert the live privilege boundary in this newest migration as well as in
-- 067. Existing environments do not replay an already-applied historical
-- migration, so every payroll/evidence table touched here is deterministically
-- SELECT-only for service_role and writable only through SECURITY DEFINER RPCs.
do $$
declare
  payroll_table text;
begin
  foreach payroll_table in array array[
    'payroll_profiles', 'payroll_calendars', 'payroll_inputs', 'payroll_runs',
    'payroll_items', 'payroll_statements', 'payroll_events',
    'finance_integration_commands', 'finance_integration_events',
    'bank_statement_items', 'reconciliation_matches',
    'payroll_paid_statement_evidence'
  ] loop
    execute format('alter table public.%I enable row level security', payroll_table);
    execute format(
      'revoke all on public.%I from public, anon, authenticated, service_role',
      payroll_table
    );
    execute format('grant select on public.%I to service_role', payroll_table);
  end loop;
end $$;

comment on function public.queue_payroll_run_command(uuid, uuid, uuid, integer, text, text) is
  'Creates a PHI-minimized Gusto outbox intent only. The server must additionally require GUSTO_W2_ENABLED; this function makes no network call and records no payment.';
comment on function public.reconcile_payroll_run(uuid, uuid, uuid, integer, text, uuid, uuid, uuid[], text, text) is
  'Reconciles only from an immutable checksum-bound, signature-valid Gusto event. PAID additionally requires an exact posted Mercury debit, an approved one-use allocation, and one live AVAILABLE statement per payroll item.';
comment on function public.payroll_run_paid_evidence_valid(uuid, uuid) is
  'Live fail-closed validation for canonical PAID display. It rechecks terminal provider evidence, exact bank allocation, controller separation, and every current payroll statement.';
