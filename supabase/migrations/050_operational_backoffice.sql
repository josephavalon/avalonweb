-- Avalon operational backoffice: PHI-free workforce scheduling, Square payment
-- facts, reconciliation history, and the accounting bridge introduced in 043.
--
-- Migration 047 is the only contractor-invoice schema. This migration must not
-- recreate or weaken nurse_invoices / nurse_invoice_lines.

do $$
begin
  if to_regclass('public.robbot3k_prospects') is null then
    raise exception using errcode = 'P0001', message = 'migration_046_required';
  end if;
  if to_regclass('public.nurse_invoice_status_events') is null
     or to_regprocedure('public.create_nurse_invoice(jsonb,jsonb)') is null then
    raise exception using errcode = 'P0001', message = 'migration_047_required';
  end if;
  if to_regclass('public.bd_companies') is null then
    raise exception using errcode = 'P0001', message = 'migration_048_required';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'robbot3k_settings'
      and column_name = 'global_pause'
  ) then
    raise exception using errcode = 'P0001', message = 'migration_049_required';
  end if;
  if to_regclass('public.os_finance_ledger') is null then
    raise exception using errcode = 'P0001', message = 'migration_043_required';
  end if;
  if to_regclass('public.provider_profiles') is null
     or to_regclass('public.audit_events') is null then
    raise exception using errcode = 'P0001', message = 'healthcare_os_core_required';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception using errcode = 'P0001', message = 'touch_updated_at_required';
  end if;
end $$;

-- Existing platform parents need composite identities before new operational
-- rows can prove that every association belongs to the same tenant.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'operational_profiles_tenant_id_id_key'
  ) then
    alter table public.profiles
      add constraint operational_profiles_tenant_id_id_key unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'operational_appointments_tenant_id_id_key'
  ) then
    alter table public.appointments
      add constraint operational_appointments_tenant_id_id_key unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_containers'::regclass
      and conname = 'operational_event_containers_tenant_id_id_key'
  ) then
    alter table public.event_containers
      add constraint operational_event_containers_tenant_id_id_key unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_services'::regclass
      and conname = 'operational_event_services_tenant_id_id_key'
  ) then
    alter table public.event_services
      add constraint operational_event_services_tenant_id_id_key unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_finance_ledger'::regclass
      and conname = 'operational_os_finance_ledger_tenant_id_id_key'
  ) then
    alter table public.os_finance_ledger
      add constraint operational_os_finance_ledger_tenant_id_id_key unique (tenant_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_profiles'::regclass
      and conname = 'operational_provider_profiles_tenant_id_id_key'
  ) then
    alter table public.provider_profiles
      add constraint operational_provider_profiles_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

create table if not exists public.operational_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  series_id uuid,
  occurrence_key text,
  event_container_id uuid,
  appointment_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Los_Angeles'
    check (char_length(trim(timezone)) between 1 and 80),
  location_name text check (location_name is null or char_length(location_name) <= 180),
  location_address text check (location_address is null or char_length(location_address) <= 300),
  service_area text check (service_area is null or char_length(service_area) <= 120),
  role_required text not null default 'RN' check (char_length(trim(role_required)) between 1 and 80),
  slots_required integer not null default 1 check (slots_required between 1 and 100),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  recurrence jsonb not null default '{}'::jsonb check (jsonb_typeof(recurrence) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_shifts_tenant_id_id_key unique (tenant_id, id),
  constraint operational_shifts_time_order check (ends_at > starts_at),
  unique (tenant_id, series_id, occurrence_key)
);

create table if not exists public.operational_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  status text not null default 'offered'
    check (status in ('offered', 'claimed', 'assigned', 'declined', 'completed', 'cancelled')),
  offered_at timestamptz,
  claimed_at timestamptz,
  assigned_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_shift_assignments_tenant_id_id_key unique (tenant_id, id),
  constraint operational_shift_assignments_shift_provider_key unique (shift_id, provider_profile_id)
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('square')),
  provider_payment_id text not null check (char_length(provider_payment_id) between 1 and 255),
  provider_order_id text,
  provider_customer_id text,
  merchant_id text,
  location_id text,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null check (char_length(trim(status)) between 1 and 80),
  refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'partial', 'refunded', 'failed')),
  source text,
  processed_at timestamptz,
  appointment_id uuid,
  event_container_id uuid,
  event_service_id uuid,
  invoice_reference text check (invoice_reference is null or char_length(invoice_reference) <= 160),
  reconciliation_status text not null default 'unmatched'
    check (reconciliation_status in ('matched', 'unmatched', 'manual_review', 'ignored')),
  match_method text,
  match_confidence numeric(4, 3) check (match_confidence between 0 and 1),
  raw_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_summary) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_payments_tenant_id_id_key unique (tenant_id, id),
  unique (tenant_id, provider, provider_payment_id),
  check (
    reconciliation_status <> 'matched'
    or num_nonnulls(appointment_id, event_container_id, event_service_id, invoice_reference) > 0
  )
);

create table if not exists public.client_payment_refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid,
  provider text not null check (provider in ('square')),
  provider_refund_id text not null check (char_length(provider_refund_id) between 1 and 255),
  provider_payment_id text not null check (char_length(provider_payment_id) between 1 and 255),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null check (char_length(trim(status)) between 1 and 80),
  reason text check (reason is null or char_length(reason) <= 240),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_payment_refunds_tenant_id_id_key unique (tenant_id, id),
  unique (tenant_id, provider, provider_refund_id)
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('square')),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 160),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_webhook_events_tenant_id_id_key unique (tenant_id, id),
  unique (tenant_id, provider, provider_event_id)
);

create table if not exists public.payment_reconciliation_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid not null,
  previous_status text,
  next_status text not null,
  association jsonb not null default '{}'::jsonb check (jsonb_typeof(association) = 'object'),
  reason text check (reason is null or char_length(reason) <= 240),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint payment_reconciliation_history_tenant_id_id_key unique (tenant_id, id)
);

-- A local pre-release draft used auth/profile ids for assignments. If present,
-- resolve each one to its provider source-of-truth row, then remove the legacy
-- identity so new code has exactly one unambiguous provider key.
drop policy if exists "operational shifts nurse read" on public.operational_shifts;
drop policy if exists "shift assignments nurse read" on public.operational_shift_assignments;

do $$
declare
  v_mapping_invalid boolean;
begin
  alter table public.operational_shift_assignments
    add column if not exists provider_profile_id uuid;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operational_shift_assignments'
      and column_name = 'nurse_profile_id'
  ) then
    execute $sql$
      select exists (
        select 1
        from public.operational_shift_assignments a
        left join public.provider_profiles pp
          on pp.tenant_id = a.tenant_id
         and pp.profile_id = a.nurse_profile_id
        group by a.id
        having count(pp.id) <> 1
      )
    $sql$ into v_mapping_invalid;
    if v_mapping_invalid then
      raise exception using errcode = 'P0001', message = 'legacy_assignment_provider_mapping_required';
    end if;
    execute $sql$
      update public.operational_shift_assignments a
      set provider_profile_id = pp.id
      from public.provider_profiles pp
      where a.provider_profile_id is null
        and pp.tenant_id = a.tenant_id
        and pp.profile_id = a.nurse_profile_id
    $sql$;
    if exists (
      select 1 from public.operational_shift_assignments
      where provider_profile_id is null
    ) then
      raise exception using errcode = 'P0001', message = 'legacy_assignment_provider_mapping_required';
    end if;
    alter table public.operational_shift_assignments
      drop constraint if exists operational_shift_assignments_shift_id_nurse_profile_id_key;
    alter table public.operational_shift_assignments
      drop constraint if exists operational_shift_assignments_nurse_profile_id_fkey;
    alter table public.operational_shift_assignments
      drop column nurse_profile_id;
  end if;
  alter table public.operational_shift_assignments
    alter column provider_profile_id set not null;
end $$;

-- Remove obsolete pre-release overloads so callers cannot bypass the current
-- actor, provider-source-of-truth, and optimistic-version contract.
drop function if exists app_private.claim_operational_shift(uuid, uuid, uuid);
drop function if exists public.claim_operational_shift(uuid, uuid, uuid);

-- Upgrade an earlier draft in place. Parent identity constraints are harmless
-- on clean tables and guarded by both owning relation and constraint name.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shifts'::regclass
      and conname = 'operational_shifts_tenant_id_id_key'
  ) then
    alter table public.operational_shifts
      add constraint operational_shifts_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_tenant_id_id_key'
  ) then
    alter table public.operational_shift_assignments
      add constraint operational_shift_assignments_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_shift_provider_key'
  ) then
    alter table public.operational_shift_assignments
      add constraint operational_shift_assignments_shift_provider_key
      unique (shift_id, provider_profile_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.client_payments'::regclass
      and conname = 'client_payments_tenant_id_id_key'
  ) then
    alter table public.client_payments
      add constraint client_payments_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.client_payment_refunds'::regclass
      and conname = 'client_payment_refunds_tenant_id_id_key'
  ) then
    alter table public.client_payment_refunds
      add constraint client_payment_refunds_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payment_webhook_events'::regclass
      and conname = 'payment_webhook_events_tenant_id_id_key'
  ) then
    alter table public.payment_webhook_events
      add constraint payment_webhook_events_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payment_reconciliation_history'::regclass
      and conname = 'payment_reconciliation_history_tenant_id_id_key'
  ) then
    alter table public.payment_reconciliation_history
      add constraint payment_reconciliation_history_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

-- Add every relationship as NOT VALID first so existing installations get a
-- short metadata lock. Immediate validation then fails closed on tenant drift.
alter table public.operational_shifts
  drop constraint if exists operational_shifts_event_container_id_fkey;
alter table public.operational_shifts
  drop constraint if exists operational_shifts_appointment_id_fkey;
alter table public.operational_shifts
  drop constraint if exists operational_shifts_created_by_fkey;
alter table public.operational_shift_assignments
  drop constraint if exists operational_shift_assignments_shift_id_fkey;
alter table public.operational_shift_assignments
  drop constraint if exists operational_shift_assignments_created_by_fkey;
alter table public.client_payments
  drop constraint if exists client_payments_appointment_id_fkey;
alter table public.client_payments
  drop constraint if exists client_payments_event_container_id_fkey;
alter table public.client_payments
  drop constraint if exists client_payments_event_service_id_fkey;
alter table public.client_payment_refunds
  drop constraint if exists client_payment_refunds_payment_id_fkey;
alter table public.payment_reconciliation_history
  drop constraint if exists payment_reconciliation_history_payment_id_fkey;
alter table public.payment_reconciliation_history
  drop constraint if exists payment_reconciliation_history_created_by_fkey;
alter table public.os_finance_ledger
  drop constraint if exists os_finance_ledger_reversal_of_fkey;
alter table public.os_finance_ledger
  drop constraint if exists os_finance_ledger_created_by_fkey;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_shifts'::regclass and conname = 'operational_shifts_event_container_tenant_fk') then
    alter table public.operational_shifts add constraint operational_shifts_event_container_tenant_fk
      foreign key (tenant_id, event_container_id) references public.event_containers(tenant_id, id)
      on delete set null (event_container_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_shifts'::regclass and conname = 'operational_shifts_appointment_tenant_fk') then
    alter table public.operational_shifts add constraint operational_shifts_appointment_tenant_fk
      foreign key (tenant_id, appointment_id) references public.appointments(tenant_id, id)
      on delete set null (appointment_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_shifts'::regclass and conname = 'operational_shifts_created_by_tenant_fk') then
    alter table public.operational_shifts add constraint operational_shifts_created_by_tenant_fk
      foreign key (tenant_id, created_by) references public.profiles(tenant_id, id)
      on delete set null (created_by) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_shift_assignments'::regclass and conname = 'operational_shift_assignments_shift_tenant_fk') then
    alter table public.operational_shift_assignments add constraint operational_shift_assignments_shift_tenant_fk
      foreign key (tenant_id, shift_id) references public.operational_shifts(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_shift_assignments'::regclass and conname = 'operational_shift_assignments_provider_tenant_fk') then
    alter table public.operational_shift_assignments add constraint operational_shift_assignments_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.operational_shift_assignments'::regclass and conname = 'operational_shift_assignments_created_by_tenant_fk') then
    alter table public.operational_shift_assignments add constraint operational_shift_assignments_created_by_tenant_fk
      foreign key (tenant_id, created_by) references public.profiles(tenant_id, id)
      on delete set null (created_by) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.client_payments'::regclass and conname = 'client_payments_appointment_tenant_fk') then
    alter table public.client_payments add constraint client_payments_appointment_tenant_fk
      foreign key (tenant_id, appointment_id) references public.appointments(tenant_id, id)
      on delete set null (appointment_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.client_payments'::regclass and conname = 'client_payments_event_container_tenant_fk') then
    alter table public.client_payments add constraint client_payments_event_container_tenant_fk
      foreign key (tenant_id, event_container_id) references public.event_containers(tenant_id, id)
      on delete set null (event_container_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.client_payments'::regclass and conname = 'client_payments_event_service_tenant_fk') then
    alter table public.client_payments add constraint client_payments_event_service_tenant_fk
      foreign key (tenant_id, event_service_id) references public.event_services(tenant_id, id)
      on delete set null (event_service_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.client_payment_refunds'::regclass and conname = 'client_payment_refunds_payment_tenant_fk') then
    alter table public.client_payment_refunds add constraint client_payment_refunds_payment_tenant_fk
      foreign key (tenant_id, payment_id) references public.client_payments(tenant_id, id)
      on delete set null (payment_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.payment_reconciliation_history'::regclass and conname = 'payment_reconciliation_history_payment_tenant_fk') then
    alter table public.payment_reconciliation_history add constraint payment_reconciliation_history_payment_tenant_fk
      foreign key (tenant_id, payment_id) references public.client_payments(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.payment_reconciliation_history'::regclass and conname = 'payment_reconciliation_history_created_by_tenant_fk') then
    alter table public.payment_reconciliation_history add constraint payment_reconciliation_history_created_by_tenant_fk
      foreign key (tenant_id, created_by) references public.profiles(tenant_id, id)
      on delete set null (created_by) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.os_finance_ledger'::regclass and conname = 'os_finance_ledger_reversal_tenant_fk') then
    alter table public.os_finance_ledger add constraint os_finance_ledger_reversal_tenant_fk
      foreign key (tenant_id, reversal_of) references public.os_finance_ledger(tenant_id, id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.os_finance_ledger'::regclass and conname = 'os_finance_ledger_created_by_tenant_fk') then
    alter table public.os_finance_ledger add constraint os_finance_ledger_created_by_tenant_fk
      foreign key (tenant_id, created_by) references public.profiles(tenant_id, id)
      on delete set null (created_by) not valid;
  end if;
end $$;

alter table public.operational_shifts validate constraint operational_shifts_event_container_tenant_fk;
alter table public.operational_shifts validate constraint operational_shifts_appointment_tenant_fk;
alter table public.operational_shifts validate constraint operational_shifts_created_by_tenant_fk;
alter table public.operational_shift_assignments validate constraint operational_shift_assignments_shift_tenant_fk;
alter table public.operational_shift_assignments validate constraint operational_shift_assignments_provider_tenant_fk;
alter table public.operational_shift_assignments validate constraint operational_shift_assignments_created_by_tenant_fk;
alter table public.client_payments validate constraint client_payments_appointment_tenant_fk;
alter table public.client_payments validate constraint client_payments_event_container_tenant_fk;
alter table public.client_payments validate constraint client_payments_event_service_tenant_fk;
alter table public.client_payment_refunds validate constraint client_payment_refunds_payment_tenant_fk;
alter table public.payment_reconciliation_history validate constraint payment_reconciliation_history_payment_tenant_fk;
alter table public.payment_reconciliation_history validate constraint payment_reconciliation_history_created_by_tenant_fk;
alter table public.os_finance_ledger validate constraint os_finance_ledger_reversal_tenant_fk;
alter table public.os_finance_ledger validate constraint os_finance_ledger_created_by_tenant_fk;

create index if not exists operational_shifts_window_idx
  on public.operational_shifts (tenant_id, starts_at, status);
create index if not exists operational_shift_assignment_provider_idx
  on public.operational_shift_assignments (tenant_id, provider_profile_id, status);
create index if not exists client_payments_reconciliation_idx
  on public.client_payments (tenant_id, reconciliation_status, processed_at desc);
create index if not exists client_payments_period_idx
  on public.client_payments (tenant_id, processed_at desc, status);
create index if not exists client_payment_refunds_payment_idx
  on public.client_payment_refunds (tenant_id, provider_payment_id, processed_at desc);
create index if not exists payment_webhook_events_status_idx
  on public.payment_webhook_events (tenant_id, processing_status, received_at);
create index if not exists payment_reconciliation_history_payment_idx
  on public.payment_reconciliation_history (tenant_id, payment_id, created_at desc);

-- All browser and session access goes through authenticated server APIs. RLS is
-- still enabled as defense in depth; no anon/authenticated policies are kept.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'operational_shifts', 'operational_shift_assignments', 'client_payments',
    'client_payment_refunds', 'payment_webhook_events', 'payment_reconciliation_history'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', tbl);
  end loop;
end $$;

drop policy if exists "operational shifts operator access" on public.operational_shifts;
drop policy if exists "operational shifts nurse read" on public.operational_shifts;
drop policy if exists "shift assignments operator access" on public.operational_shift_assignments;
drop policy if exists "shift assignments nurse read" on public.operational_shift_assignments;
drop policy if exists "client_payments operator access" on public.client_payments;
drop policy if exists "client_payment_refunds operator access" on public.client_payment_refunds;
drop policy if exists "payment_webhook_events operator access" on public.payment_webhook_events;
drop policy if exists "payment_reconciliation_history operator access" on public.payment_reconciliation_history;

grant select on public.operational_shifts,
  public.operational_shift_assignments to service_role;
grant select, insert, update on public.client_payments,
  public.client_payment_refunds, public.payment_webhook_events to service_role;
grant select, insert on public.payment_reconciliation_history to service_role;

-- Existing immutable accounting remains migration 043's source of truth. Limit
-- its Data API role to exactly the reads and appends used by accounting APIs.
alter table public.os_finance_ledger enable row level security;
drop policy if exists "os tenant operator access" on public.os_finance_ledger;
revoke all on public.os_finance_ledger from public, anon, authenticated, service_role;
grant select, insert on public.os_finance_ledger to service_role;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'operational_shifts', 'operational_shift_assignments',
    'client_payments', 'client_payment_refunds'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'trg_' || tbl || '_updated_at', tbl
    );
  end loop;
end $$;

create or replace function app_private.prevent_payment_reconciliation_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Payment reconciliation history is append-only';
end;
$$;

revoke all on function app_private.prevent_payment_reconciliation_history_mutation()
  from public, anon, authenticated;

drop trigger if exists payment_reconciliation_history_immutable on public.payment_reconciliation_history;
create trigger payment_reconciliation_history_immutable
  before update or delete on public.payment_reconciliation_history
  for each row execute function app_private.prevent_payment_reconciliation_history_mutation();

-- Scheduling mutations are transactional RPCs. Browser/session code has only
-- read access to these tables through server APIs; every write rechecks actor,
-- tenant, provider eligibility, capacity, state, and optimistic version.
create or replace function app_private.assert_operational_operator(
  p_tenant_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_profile_id
      and p.tenant_id = p_tenant_id
      and p.status = 'active'
      and p.role in ('ops_manager', 'admin', 'founder')
  ) then
    raise exception using errcode = '42501', message = 'operational_operator_required';
  end if;
end;
$$;

create or replace function app_private.operational_provider_is_eligible(
  p_tenant_id uuid,
  p_provider_profile_id uuid,
  p_role_required text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.provider_profiles pp
    join public.profiles p
      on p.id = pp.profile_id
     and p.tenant_id = pp.tenant_id
    where pp.id = p_provider_profile_id
      and pp.tenant_id = p_tenant_id
      and pp.active
      and pp.credential_status = 'clear'
      and pp.nursys_status = 'clear'
      and pp.provider_role in ('rn', 'np')
      and p.status = 'active'
      and case lower(trim(coalesce(p_role_required, 'rn')))
        when 'rn' then pp.provider_role in ('rn', 'np')
        when 'nurse' then pp.provider_role in ('rn', 'np')
        when 'registered nurse' then pp.provider_role in ('rn', 'np')
        when 'np' then pp.provider_role = 'np'
        when 'nurse practitioner' then pp.provider_role = 'np'
        else pp.provider_role = lower(trim(p_role_required))
      end
  );
$$;

create or replace function app_private.assert_operational_provider(
  p_tenant_id uuid,
  p_provider_profile_id uuid,
  p_role_required text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.operational_provider_is_eligible(
    p_tenant_id, p_provider_profile_id, p_role_required
  ) then
    raise exception using errcode = 'P0001', message = 'provider_not_eligible_for_shift';
  end if;
end;
$$;

create or replace function app_private.append_operational_audit(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_action text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, p_action, 'operational_shifts', p_entity_id,
    false, encode(digest(v_payload::text, 'sha256'), 'hex'), v_payload
  );
end;
$$;

revoke all on function app_private.assert_operational_operator(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.operational_provider_is_eligible(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_operational_provider(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.append_operational_audit(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.create_operational_shift_series(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift jsonb,
  p_occurrences jsonb,
  p_provider_profile_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_assignments jsonb := '[]'::jsonb;
  v_count integer;
  v_first_shift_id uuid;
  v_occurrence jsonb;
  v_ordinal integer;
  v_provider_id uuid;
  v_providers uuid[];
  v_recurrence jsonb;
  v_requested_status text;
  v_role_required text;
  v_series_id uuid;
  v_shift public.operational_shifts%rowtype;
  v_shifts jsonb := '[]'::jsonb;
  v_slots integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_timezone text;
  v_title text;
begin
  perform app_private.assert_operational_operator(p_tenant_id, p_actor_profile_id);
  if jsonb_typeof(p_shift) is distinct from 'object'
     or jsonb_typeof(p_occurrences) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_shift_series_payload';
  end if;

  v_count := jsonb_array_length(p_occurrences);
  if v_count < 1 or v_count > 180 then
    raise exception using errcode = '22023', message = 'shift_occurrence_count_out_of_range';
  end if;
  v_title := trim(coalesce(p_shift ->> 'title', ''));
  if char_length(v_title) < 1 or char_length(v_title) > 160 then
    raise exception using errcode = '22023', message = 'invalid_shift_title';
  end if;
  v_timezone := coalesce(nullif(trim(p_shift ->> 'timezone'), ''), 'America/Los_Angeles');
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'invalid_shift_timezone';
  end if;
  v_role_required := coalesce(nullif(trim(p_shift ->> 'role_required'), ''), 'RN');
  if char_length(v_role_required) > 80 then
    raise exception using errcode = '22023', message = 'invalid_shift_role';
  end if;
  v_slots := coalesce((p_shift ->> 'slots_required')::integer, 1);
  if v_slots < 1 or v_slots > 100 then
    raise exception using errcode = '22023', message = 'invalid_shift_slots';
  end if;
  v_requested_status := coalesce(nullif(p_shift ->> 'status', ''), 'open');
  if v_requested_status not in ('draft', 'open') then
    raise exception using errcode = '22023', message = 'invalid_initial_shift_status';
  end if;
  v_recurrence := coalesce(p_shift -> 'recurrence', '{}'::jsonb);
  if jsonb_typeof(v_recurrence) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_shift_recurrence';
  end if;

  select coalesce(array_agg(distinct provider_id), '{}'::uuid[])
  into v_providers
  from unnest(coalesce(p_provider_profile_ids, '{}'::uuid[])) as requested(provider_id)
  where provider_id is not null;
  if cardinality(v_providers) > v_slots then
    raise exception using errcode = 'P0001', message = 'assigned_providers_exceed_slots';
  end if;
  foreach v_provider_id in array v_providers loop
    perform app_private.assert_operational_provider(
      p_tenant_id, v_provider_id, v_role_required
    );
  end loop;

  v_series_id := case when v_count > 1 then gen_random_uuid() else null end;
  for v_occurrence, v_ordinal in
    select value, ordinality::integer
    from jsonb_array_elements(p_occurrences) with ordinality
  loop
    if jsonb_typeof(v_occurrence) <> 'object'
       or nullif(v_occurrence ->> 'startsAt', '') is null
       or nullif(v_occurrence ->> 'endsAt', '') is null then
      raise exception using errcode = '22023', message = 'invalid_shift_occurrence';
    end if;
    v_starts_at := (v_occurrence ->> 'startsAt')::timestamptz;
    v_ends_at := (v_occurrence ->> 'endsAt')::timestamptz;
    if v_ends_at <= v_starts_at then
      raise exception using errcode = '22023', message = 'invalid_shift_time_range';
    end if;

    insert into public.operational_shifts (
      tenant_id, series_id, occurrence_key, event_container_id, appointment_id,
      title, starts_at, ends_at, timezone, location_name, location_address,
      service_area, role_required, slots_required, status, instructions,
      recurrence, created_by
    ) values (
      p_tenant_id,
      v_series_id,
      case when v_series_id is null then null
        else coalesce(nullif(v_occurrence ->> 'occurrenceDate', ''), v_ordinal::text)
      end,
      nullif(p_shift ->> 'event_container_id', '')::uuid,
      nullif(p_shift ->> 'appointment_id', '')::uuid,
      v_title,
      v_starts_at,
      v_ends_at,
      v_timezone,
      nullif(trim(p_shift ->> 'location_name'), ''),
      nullif(trim(p_shift ->> 'location_address'), ''),
      nullif(trim(p_shift ->> 'service_area'), ''),
      v_role_required,
      v_slots,
      case
        when cardinality(v_providers) >= v_slots then 'assigned'
        when cardinality(v_providers) > 0 then 'open'
        else v_requested_status
      end,
      nullif(trim(p_shift ->> 'instructions'), ''),
      case when v_series_id is null then '{}'::jsonb else v_recurrence end,
      p_actor_profile_id
    )
    returning * into v_shift;

    if v_first_shift_id is null then
      v_first_shift_id := v_shift.id;
    end if;
    v_shifts := v_shifts || jsonb_build_array(to_jsonb(v_shift));

    foreach v_provider_id in array v_providers loop
      insert into public.operational_shift_assignments (
        tenant_id, shift_id, provider_profile_id, status, assigned_at, created_by
      ) values (
        p_tenant_id, v_shift.id, v_provider_id, 'assigned', now(), p_actor_profile_id
      )
      returning * into v_assignment;
      v_assignments := v_assignments || jsonb_build_array(to_jsonb(v_assignment));
    end loop;
  end loop;

  perform app_private.append_operational_audit(
    p_tenant_id,
    p_actor_profile_id,
    'operational_shift_series_created',
    v_first_shift_id,
    jsonb_build_object(
      'series_id', v_series_id,
      'occurrence_count', v_count,
      'provider_count', cardinality(v_providers)
    )
  );
  return jsonb_build_object('shifts', v_shifts, 'assignments', v_assignments);
end;
$$;

revoke all on function public.create_operational_shift_series(uuid, uuid, jsonb, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function public.create_operational_shift_series(uuid, uuid, jsonb, jsonb, uuid[])
  to service_role;

create or replace function public.update_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns public.operational_shifts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count integer;
  v_ends_at timestamptz;
  v_role_required text;
  v_shift public.operational_shifts%rowtype;
  v_slots integer;
  v_starts_at timestamptz;
  v_timezone text;
  v_title text;
begin
  perform app_private.assert_operational_operator(p_tenant_id, p_actor_profile_id);
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_shift_patch';
  end if;
  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'shift_not_found';
  end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  if v_shift.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'closed_shift_cannot_be_edited';
  end if;

  v_title := case when p_patch ? 'title'
    then trim(coalesce(p_patch ->> 'title', '')) else v_shift.title end;
  v_timezone := case when p_patch ? 'timezone'
    then trim(coalesce(p_patch ->> 'timezone', '')) else v_shift.timezone end;
  v_role_required := case when p_patch ? 'role_required'
    then trim(coalesce(p_patch ->> 'role_required', '')) else v_shift.role_required end;
  v_slots := case when p_patch ? 'slots_required'
    then (p_patch ->> 'slots_required')::integer else v_shift.slots_required end;
  v_starts_at := case when p_patch ? 'starts_at'
    then nullif(p_patch ->> 'starts_at', '')::timestamptz else v_shift.starts_at end;
  v_ends_at := case when p_patch ? 'ends_at'
    then nullif(p_patch ->> 'ends_at', '')::timestamptz else v_shift.ends_at end;

  if char_length(v_title) < 1 or char_length(v_title) > 160 then
    raise exception using errcode = '22023', message = 'invalid_shift_title';
  end if;
  if char_length(v_timezone) < 1
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'invalid_shift_timezone';
  end if;
  if char_length(v_role_required) < 1 or char_length(v_role_required) > 80 then
    raise exception using errcode = '22023', message = 'invalid_shift_role';
  end if;
  if v_slots < 1 or v_slots > 100 then
    raise exception using errcode = '22023', message = 'invalid_shift_slots';
  end if;
  if v_starts_at is null or v_ends_at is null or v_ends_at <= v_starts_at then
    raise exception using errcode = '22023', message = 'invalid_shift_time_range';
  end if;

  select count(*) into v_active_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status in ('claimed', 'assigned', 'completed');
  if v_slots < v_active_count then
    raise exception using errcode = 'P0001', message = 'shift_slots_below_active_assignments';
  end if;
  if v_role_required is distinct from v_shift.role_required
     and exists (
       select 1
       from public.operational_shift_assignments a
       where a.tenant_id = p_tenant_id
         and a.shift_id = p_shift_id
         and a.status in ('claimed', 'assigned')
         and not app_private.operational_provider_is_eligible(
           p_tenant_id, a.provider_profile_id, v_role_required
         )
     ) then
    raise exception using errcode = 'P0001', message = 'assigned_provider_role_mismatch';
  end if;

  update public.operational_shifts
  set title = v_title,
      starts_at = v_starts_at,
      ends_at = v_ends_at,
      timezone = v_timezone,
      location_name = case when p_patch ? 'location_name'
        then nullif(trim(p_patch ->> 'location_name'), '') else location_name end,
      location_address = case when p_patch ? 'location_address'
        then nullif(trim(p_patch ->> 'location_address'), '') else location_address end,
      service_area = case when p_patch ? 'service_area'
        then nullif(trim(p_patch ->> 'service_area'), '') else service_area end,
      role_required = v_role_required,
      slots_required = v_slots,
      instructions = case when p_patch ? 'instructions'
        then nullif(trim(p_patch ->> 'instructions'), '') else instructions end,
      event_container_id = case when p_patch ? 'event_container_id'
        then nullif(p_patch ->> 'event_container_id', '')::uuid else event_container_id end,
      appointment_id = case when p_patch ? 'appointment_id'
        then nullif(p_patch ->> 'appointment_id', '')::uuid else appointment_id end,
      status = case
        when v_shift.status not in ('draft', 'open', 'assigned') then v_shift.status
        when v_active_count >= v_slots then 'assigned'
        when v_shift.status = 'draft' and v_active_count = 0 then 'draft'
        else 'open'
      end,
      version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id
  returning * into v_shift;

  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_updated', p_shift_id,
    jsonb_build_object('version', v_shift.version)
  );
  return v_shift;
end;
$$;

revoke all on function public.update_operational_shift(uuid, uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_operational_shift(uuid, uuid, uuid, integer, jsonb)
  to service_role;

create or replace function public.assign_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count integer;
  v_assignment public.operational_shift_assignments%rowtype;
  v_existing_active boolean;
  v_shift public.operational_shifts%rowtype;
begin
  perform app_private.assert_operational_operator(p_tenant_id, p_actor_profile_id);
  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'shift_not_found';
  end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  if v_shift.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'closed_shift_cannot_be_assigned';
  end if;
  perform app_private.assert_operational_provider(
    p_tenant_id, p_provider_profile_id, v_shift.role_required
  );

  select exists (
    select 1
    from public.operational_shift_assignments a
    where a.tenant_id = p_tenant_id
      and a.shift_id = p_shift_id
      and a.provider_profile_id = p_provider_profile_id
      and a.status in ('claimed', 'assigned', 'completed')
  ) into v_existing_active;
  select count(*) into v_active_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status in ('claimed', 'assigned', 'completed');
  if not v_existing_active and v_active_count >= v_shift.slots_required then
    raise exception using errcode = 'P0001', message = 'shift_full';
  end if;

  insert into public.operational_shift_assignments (
    tenant_id, shift_id, provider_profile_id, status, assigned_at, created_by
  ) values (
    p_tenant_id, p_shift_id, p_provider_profile_id, 'assigned', now(), p_actor_profile_id
  )
  on conflict (shift_id, provider_profile_id) do update
  set status = 'assigned',
      assigned_at = now(),
      completed_at = null,
      created_by = p_actor_profile_id,
      updated_at = now()
  returning * into v_assignment;

  select count(*) into v_active_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status in ('claimed', 'assigned', 'completed');
  update public.operational_shifts
  set status = case
        when v_shift.status = 'in_progress' then 'in_progress'
        when v_active_count >= slots_required then 'assigned'
        else 'open'
      end,
      version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id;

  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_assigned', p_shift_id,
    jsonb_build_object(
      'provider_profile_id', p_provider_profile_id,
      'version', v_shift.version + 1
    )
  );
  return v_assignment;
end;
$$;

revoke all on function public.assign_operational_shift(uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.assign_operational_shift(uuid, uuid, uuid, uuid, integer)
  to service_role;

create or replace function public.offer_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_ids uuid[] default '{}'::uuid[],
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_offers jsonb := '[]'::jsonb;
  v_provider_id uuid;
  v_providers uuid[];
  v_shift public.operational_shifts%rowtype;
begin
  perform app_private.assert_operational_operator(p_tenant_id, p_actor_profile_id);
  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'shift_not_found';
  end if;
  if p_expected_version is not null and v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  if v_shift.status not in ('draft', 'open') then
    raise exception using errcode = 'P0001', message = 'shift_not_offerable';
  end if;

  select coalesce(array_agg(distinct provider_id), '{}'::uuid[])
  into v_providers
  from unnest(coalesce(p_provider_profile_ids, '{}'::uuid[])) as requested(provider_id)
  where provider_id is not null;
  if cardinality(v_providers) = 0 then
    select coalesce(array_agg(pp.id order by pp.id), '{}'::uuid[])
    into v_providers
    from public.provider_profiles pp
    where pp.tenant_id = p_tenant_id
      and app_private.operational_provider_is_eligible(
        p_tenant_id, pp.id, v_shift.role_required
      );
  else
    foreach v_provider_id in array v_providers loop
      perform app_private.assert_operational_provider(
        p_tenant_id, v_provider_id, v_shift.role_required
      );
    end loop;
  end if;
  if cardinality(v_providers) = 0 then
    raise exception using errcode = 'P0001', message = 'empty_offer_roster';
  end if;

  foreach v_provider_id in array v_providers loop
    v_assignment := null;
    insert into public.operational_shift_assignments (
      tenant_id, shift_id, provider_profile_id, status, offered_at, created_by
    ) values (
      p_tenant_id, p_shift_id, v_provider_id, 'offered', now(), p_actor_profile_id
    )
    on conflict (shift_id, provider_profile_id) do update
    set status = 'offered',
        offered_at = now(),
        created_by = p_actor_profile_id,
        updated_at = now()
    where operational_shift_assignments.status not in ('claimed', 'assigned', 'completed')
    returning * into v_assignment;
    if found then
      v_offers := v_offers || jsonb_build_array(to_jsonb(v_assignment));
    end if;
  end loop;

  update public.operational_shifts
  set status = 'open', version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id
  returning * into v_shift;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_offered', p_shift_id,
    jsonb_build_object(
      'offered_count', jsonb_array_length(v_offers),
      'version', v_shift.version
    )
  );
  return jsonb_build_object('shift', to_jsonb(v_shift), 'offers', v_offers);
end;
$$;

revoke all on function public.offer_operational_shift(uuid, uuid, uuid, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.offer_operational_shift(uuid, uuid, uuid, uuid[], integer)
  to service_role;

create or replace function public.transition_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_action text,
  p_expected_version integer
)
returns public.operational_shifts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text := lower(trim(coalesce(p_action, '')));
  v_active_count integer;
  v_next_status text;
  v_shift public.operational_shifts%rowtype;
begin
  perform app_private.assert_operational_operator(p_tenant_id, p_actor_profile_id);
  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'shift_not_found';
  end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;

  if v_action = 'open' then
    if v_shift.status not in ('draft', 'open') then
      raise exception using errcode = 'P0001', message = 'invalid_shift_transition';
    end if;
    v_next_status := 'open';
  elsif v_action in ('start', 'in_progress') then
    select count(*) into v_active_count
    from public.operational_shift_assignments a
    where a.tenant_id = p_tenant_id
      and a.shift_id = p_shift_id
      and a.status in ('claimed', 'assigned');
    if v_shift.status <> 'assigned' or v_active_count < v_shift.slots_required then
      raise exception using errcode = 'P0001', message = 'shift_not_ready_to_start';
    end if;
    v_next_status := 'in_progress';
  elsif v_action in ('complete', 'completed') then
    if v_shift.status not in ('assigned', 'in_progress') then
      raise exception using errcode = 'P0001', message = 'shift_not_completable';
    end if;
    if clock_timestamp() < v_shift.starts_at then
      raise exception using errcode = 'P0001', message = 'shift_not_started';
    end if;
    update public.operational_shift_assignments
    set status = 'completed', completed_at = now(), updated_at = now()
    where tenant_id = p_tenant_id
      and shift_id = p_shift_id
      and status in ('claimed', 'assigned');
    update public.operational_shift_assignments
    set status = 'cancelled', updated_at = now()
    where tenant_id = p_tenant_id
      and shift_id = p_shift_id
      and status = 'offered';
    v_next_status := 'completed';
  elsif v_action in ('cancel', 'cancelled') then
    if v_shift.status in ('completed', 'cancelled') then
      raise exception using errcode = 'P0001', message = 'shift_already_closed';
    end if;
    update public.operational_shift_assignments
    set status = 'cancelled', updated_at = now()
    where tenant_id = p_tenant_id
      and shift_id = p_shift_id
      and status in ('offered', 'claimed', 'assigned');
    v_next_status := 'cancelled';
  else
    raise exception using errcode = '22023', message = 'invalid_shift_action';
  end if;

  update public.operational_shifts
  set status = v_next_status, version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id
  returning * into v_shift;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_' || v_next_status,
    p_shift_id, jsonb_build_object('version', v_shift.version)
  );
  return v_shift;
end;
$$;

revoke all on function public.transition_operational_shift(uuid, uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.transition_operational_shift(uuid, uuid, uuid, text, integer)
  to service_role;

create or replace function public.claim_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count integer;
  v_assignment public.operational_shift_assignments%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  if not exists (
    select 1
    from public.provider_profiles pp
    join public.profiles p
      on p.id = pp.profile_id
     and p.tenant_id = pp.tenant_id
    where pp.id = p_provider_profile_id
      and pp.tenant_id = p_tenant_id
      and pp.profile_id = p_actor_profile_id
      and p.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'provider_self_action_required';
  end if;

  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'shift_not_found';
  end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  perform app_private.assert_operational_provider(
    p_tenant_id, p_provider_profile_id, v_shift.role_required
  );

  select * into v_assignment
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.provider_profile_id = p_provider_profile_id
  for update;
  if found and v_assignment.status in ('claimed', 'assigned', 'completed') then
    return v_assignment;
  end if;
  if v_shift.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'shift_not_open';
  end if;

  select count(*) into v_active_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status in ('claimed', 'assigned', 'completed');
  if v_active_count >= v_shift.slots_required then
    raise exception using errcode = 'P0001', message = 'shift_full';
  end if;

  insert into public.operational_shift_assignments (
    tenant_id, shift_id, provider_profile_id, status, claimed_at, created_by
  ) values (
    p_tenant_id, p_shift_id, p_provider_profile_id, 'claimed', now(), p_actor_profile_id
  )
  on conflict (shift_id, provider_profile_id) do update
  set status = 'claimed',
      claimed_at = now(),
      completed_at = null,
      created_by = p_actor_profile_id,
      updated_at = now()
  returning * into v_assignment;

  update public.operational_shifts
  set status = case
        when v_active_count + 1 >= slots_required then 'assigned'
        else 'open'
      end,
      version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_claimed', p_shift_id,
    jsonb_build_object(
      'provider_profile_id', p_provider_profile_id,
      'version', v_shift.version + 1
    )
  );
  return v_assignment;
end;
$$;

revoke all on function public.claim_operational_shift(uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_operational_shift(uuid, uuid, uuid, uuid, integer)
  to service_role;

create or replace function public.complete_operational_shift_assignment(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_is_operator boolean;
  v_actor_is_provider boolean;
  v_assignment public.operational_shift_assignments%rowtype;
  v_completed_count integer;
  v_remaining_count integer;
  v_shift public.operational_shifts%rowtype;
begin
  select exists (
    select 1 from public.profiles p
    where p.id = p_actor_profile_id
      and p.tenant_id = p_tenant_id
      and p.status = 'active'
      and p.role in ('ops_manager', 'admin', 'founder')
  ) into v_actor_is_operator;
  select exists (
    select 1
    from public.provider_profiles pp
    join public.profiles p
      on p.id = pp.profile_id
     and p.tenant_id = pp.tenant_id
    where pp.id = p_provider_profile_id
      and pp.tenant_id = p_tenant_id
      and pp.profile_id = p_actor_profile_id
      and p.status = 'active'
  ) into v_actor_is_provider;
  if not v_actor_is_operator and not v_actor_is_provider then
    raise exception using errcode = '42501', message = 'assignment_completion_not_authorized';
  end if;

  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'shift_not_found';
  end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  if v_shift.status not in ('assigned', 'in_progress') then
    raise exception using errcode = 'P0001', message = 'shift_not_in_progress';
  end if;
  if clock_timestamp() < v_shift.starts_at then
    raise exception using errcode = 'P0001', message = 'shift_not_started';
  end if;

  select * into v_assignment
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.provider_profile_id = p_provider_profile_id
  for update;
  if not found or v_assignment.status not in ('claimed', 'assigned') then
    raise exception using errcode = 'P0001', message = 'active_assignment_required';
  end if;
  update public.operational_shift_assignments
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_assignment.id
  returning * into v_assignment;

  select count(*) into v_remaining_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status in ('claimed', 'assigned');
  select count(*) into v_completed_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status = 'completed';
  update public.operational_shifts
  set status = case
        when v_remaining_count = 0 and v_completed_count >= slots_required then 'completed'
        else 'in_progress'
      end,
      version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_assignment_completed', p_shift_id,
    jsonb_build_object(
      'provider_profile_id', p_provider_profile_id,
      'version', v_shift.version + 1
    )
  );
  return v_assignment;
end;
$$;

revoke all on function public.complete_operational_shift_assignment(uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.complete_operational_shift_assignment(uuid, uuid, uuid, uuid, integer)
  to service_role;

comment on table public.operational_shifts is
  'PHI-free workforce schedule; recurrence occurrences are independently editable rows.';
comment on table public.client_payments is
  'Normalized Square payment facts and explicit reconciliation state; no card credentials or raw webhook payloads.';
comment on table public.payment_reconciliation_history is
  'Append-only human reconciliation history for tenant-scoped client payments.';
