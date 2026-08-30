-- Minimal operational foundation for the authenticated Nurse workflow.
-- This migration is safe to apply to a clinical-core installation or after the
-- broader operational schema because every shared object keeps the same name
-- and contract.

begin;

do $$
begin
  if to_regnamespace('app_private') is null
     or to_regclass('public.tenants') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.provider_profiles') is null
     or to_regclass('public.appointments') is null
     or to_regclass('public.audit_events') is null
     or to_regclass('public.provider_license_jurisdictions') is null
     or to_regclass('public.do_not_treat_flags') is null then
    raise exception using errcode = 'P0001', message = 'nurse_operational_bootstrap_core_required';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception using errcode = 'P0001', message = 'touch_updated_at_required';
  end if;
  if to_regprocedure('digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'pgcrypto_digest_required';
  end if;
  if to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception using errcode = 'P0001', message = 'supabase_data_api_roles_required';
  end if;
  if exists (
    select 1
    from (values
      ('profiles', 'id'),
      ('profiles', 'tenant_id'),
      ('profiles', 'status'),
      ('provider_profiles', 'id'),
      ('provider_profiles', 'tenant_id'),
      ('provider_profiles', 'profile_id'),
      ('provider_profiles', 'provider_role'),
      ('provider_profiles', 'credential_status'),
      ('provider_profiles', 'nursys_status'),
      ('provider_profiles', 'active'),
      ('appointments', 'id'),
      ('appointments', 'tenant_id'),
      ('appointments', 'patient_person_id'),
      ('appointments', 'protocol_key'),
      ('appointments', 'gfe_status'),
      ('appointments', 'payment_status'),
      ('audit_events', 'tenant_id'),
      ('audit_events', 'actor_profile_id'),
      ('audit_events', 'action'),
      ('audit_events', 'entity_type'),
      ('audit_events', 'entity_id'),
      ('audit_events', 'phi_touched'),
      ('audit_events', 'payload_hash'),
      ('audit_events', 'payload')
    ) as required(table_name, column_name)
    left join information_schema.columns column_definition
      on column_definition.table_schema = 'public'
     and column_definition.table_name = required.table_name
     and column_definition.column_name = required.column_name
    where column_definition.column_name is null
  ) then
    raise exception using errcode = 'P0001', message = 'nurse_operational_bootstrap_columns_required';
  end if;
end $$;

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

do $$
begin
  if exists (
    select 1
    from (values
      ('operational_shifts', 'id'),
      ('operational_shifts', 'tenant_id'),
      ('operational_shifts', 'series_id'),
      ('operational_shifts', 'occurrence_key'),
      ('operational_shifts', 'event_container_id'),
      ('operational_shifts', 'appointment_id'),
      ('operational_shifts', 'title'),
      ('operational_shifts', 'starts_at'),
      ('operational_shifts', 'ends_at'),
      ('operational_shifts', 'timezone'),
      ('operational_shifts', 'location_name'),
      ('operational_shifts', 'location_address'),
      ('operational_shifts', 'service_area'),
      ('operational_shifts', 'role_required'),
      ('operational_shifts', 'slots_required'),
      ('operational_shifts', 'status'),
      ('operational_shifts', 'instructions'),
      ('operational_shifts', 'recurrence'),
      ('operational_shifts', 'version'),
      ('operational_shifts', 'created_by'),
      ('operational_shifts', 'created_at'),
      ('operational_shifts', 'updated_at'),
      ('operational_shift_assignments', 'id'),
      ('operational_shift_assignments', 'tenant_id'),
      ('operational_shift_assignments', 'shift_id'),
      ('operational_shift_assignments', 'provider_profile_id'),
      ('operational_shift_assignments', 'status'),
      ('operational_shift_assignments', 'offered_at'),
      ('operational_shift_assignments', 'claimed_at'),
      ('operational_shift_assignments', 'assigned_at'),
      ('operational_shift_assignments', 'completed_at'),
      ('operational_shift_assignments', 'created_by'),
      ('operational_shift_assignments', 'created_at'),
      ('operational_shift_assignments', 'updated_at')
    ) as required(table_name, column_name)
    left join information_schema.columns column_definition
      on column_definition.table_schema = 'public'
     and column_definition.table_name = required.table_name
     and column_definition.column_name = required.column_name
    where column_definition.column_name is null
  ) then
    raise exception using errcode = 'P0001', message = 'nurse_operational_bootstrap_partial_schema';
  end if;
end $$;

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
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.operational_shifts'::regclass
      and constraint_definition.conname = 'operational_shifts_tenant_id_id_key'
      and constraint_definition.contype = 'u'
      and constraint_definition.convalidated
      and (
        select array_agg(attribute.attname::text order by key_column.ordinality)
        from unnest(constraint_definition.conkey)
          with ordinality as key_column(attnum, ordinality)
        join pg_attribute attribute
          on attribute.attrelid = constraint_definition.conrelid
         and attribute.attnum = key_column.attnum
      ) = array['tenant_id', 'id']::text[]
  ) then
    raise exception using errcode = 'P0001', message = 'operational_shifts_tenant_identity_constraint_invalid';
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
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.operational_shift_assignments'::regclass
      and constraint_definition.conname = 'operational_shift_assignments_tenant_id_id_key'
      and constraint_definition.contype = 'u'
      and constraint_definition.convalidated
      and (
        select array_agg(attribute.attname::text order by key_column.ordinality)
        from unnest(constraint_definition.conkey)
          with ordinality as key_column(attnum, ordinality)
        join pg_attribute attribute
          on attribute.attrelid = constraint_definition.conrelid
         and attribute.attnum = key_column.attnum
      ) = array['tenant_id', 'id']::text[]
  ) then
    raise exception using errcode = 'P0001', message = 'operational_shift_assignments_tenant_identity_constraint_invalid';
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
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.operational_shift_assignments'::regclass
      and constraint_definition.conname = 'operational_shift_assignments_shift_provider_key'
      and constraint_definition.contype = 'u'
      and constraint_definition.convalidated
      and (
        select array_agg(attribute.attname::text order by key_column.ordinality)
        from unnest(constraint_definition.conkey)
          with ordinality as key_column(attnum, ordinality)
        join pg_attribute attribute
          on attribute.attrelid = constraint_definition.conrelid
         and attribute.attnum = key_column.attnum
      ) = array['shift_id', 'provider_profile_id']::text[]
  ) then
    raise exception using errcode = 'P0001', message = 'operational_shift_assignments_provider_identity_constraint_invalid';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shifts'::regclass
      and conname = 'operational_shifts_status_check'
  ) then
    alter table public.operational_shifts
      add constraint operational_shifts_status_check
      check (status in ('draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shifts'::regclass
      and conname = 'operational_shifts_status_check'
      and contype = 'c'
      and convalidated
  ) then
    raise exception using errcode = 'P0001', message = 'operational_shifts_status_constraint_invalid';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_status_check'
  ) then
    alter table public.operational_shift_assignments
      add constraint operational_shift_assignments_status_check
      check (status in ('offered', 'claimed', 'assigned', 'declined', 'completed', 'cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_status_check'
      and contype = 'c'
      and convalidated
  ) then
    raise exception using errcode = 'P0001', message = 'operational_shift_assignments_status_constraint_invalid';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shifts'::regclass
      and conname = 'operational_shifts_appointment_tenant_fk'
  ) then
    alter table public.operational_shifts
      add constraint operational_shifts_appointment_tenant_fk
      foreign key (tenant_id, appointment_id)
      references public.appointments(tenant_id, id)
      on delete set null (appointment_id) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shifts'::regclass
      and conname = 'operational_shifts_created_by_tenant_fk'
  ) then
    alter table public.operational_shifts
      add constraint operational_shifts_created_by_tenant_fk
      foreign key (tenant_id, created_by)
      references public.profiles(tenant_id, id)
      on delete set null (created_by) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_shift_tenant_fk'
  ) then
    alter table public.operational_shift_assignments
      add constraint operational_shift_assignments_shift_tenant_fk
      foreign key (tenant_id, shift_id)
      references public.operational_shifts(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_provider_tenant_fk'
  ) then
    alter table public.operational_shift_assignments
      add constraint operational_shift_assignments_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id)
      references public.provider_profiles(tenant_id, id)
      on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_created_by_tenant_fk'
  ) then
    alter table public.operational_shift_assignments
      add constraint operational_shift_assignments_created_by_tenant_fk
      foreign key (tenant_id, created_by)
      references public.profiles(tenant_id, id)
      on delete set null (created_by) not valid;
  end if;
end $$;

alter table public.operational_shifts
  validate constraint operational_shifts_appointment_tenant_fk;
alter table public.operational_shifts
  validate constraint operational_shifts_created_by_tenant_fk;
alter table public.operational_shift_assignments
  validate constraint operational_shift_assignments_shift_tenant_fk;
alter table public.operational_shift_assignments
  validate constraint operational_shift_assignments_provider_tenant_fk;
alter table public.operational_shift_assignments
  validate constraint operational_shift_assignments_created_by_tenant_fk;

create index if not exists operational_shifts_window_idx
  on public.operational_shifts (tenant_id, starts_at, status);
create index if not exists operational_shift_assignment_provider_idx
  on public.operational_shift_assignments (tenant_id, provider_profile_id, status);

alter table public.operational_shifts enable row level security;
alter table public.operational_shift_assignments enable row level security;

revoke all on public.operational_shifts,
  public.operational_shift_assignments
  from public, anon, authenticated, service_role;

drop policy if exists "operational shifts operator access" on public.operational_shifts;
drop policy if exists "operational shifts nurse read" on public.operational_shifts;
drop policy if exists "shift assignments operator access" on public.operational_shift_assignments;
drop policy if exists "shift assignments nurse read" on public.operational_shift_assignments;

grant select on public.operational_shifts,
  public.operational_shift_assignments to service_role;

drop trigger if exists trg_operational_shifts_updated_at on public.operational_shifts;
create trigger trg_operational_shifts_updated_at
before update on public.operational_shifts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_operational_shift_assignments_updated_at
  on public.operational_shift_assignments;
create trigger trg_operational_shift_assignments_updated_at
before update on public.operational_shift_assignments
for each row execute function public.touch_updated_at();

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

revoke all on function app_private.operational_provider_is_eligible(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_operational_provider(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.append_operational_audit(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

comment on table public.operational_shifts is
  'PHI-free workforce schedule used by the authenticated Nurse workflow.';
comment on table public.operational_shift_assignments is
  'Tenant-scoped provider assignment state used by server-only Nurse APIs.';

commit;
