-- Nurse assignment route builder. Migration 050 is the operational scheduling
-- prerequisite. No foreground or background GPS samples are persisted here.

do $$
begin
  if to_regclass('public.operational_shifts') is null
     or to_regclass('public.operational_shift_assignments') is null then
    raise exception using errcode = 'P0001', message = 'migration_050_required';
  end if;
  if to_regclass('public.provider_profiles') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.appointments') is null then
    raise exception using errcode = 'P0001', message = 'healthcare_os_core_required';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception using errcode = 'P0001', message = 'touch_updated_at_required';
  end if;
end $$;

-- Migration 050 owns the composite parent identities used by route foreign
-- keys. Require its exact provider identity instead of creating a duplicate
-- unique index under another name.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_profiles'::regclass
      and conname = 'operational_provider_profiles_tenant_id_id_key'
  ) then
    raise exception using errcode = 'P0001', message = 'migration_050_provider_identity_required';
  end if;
end $$;

create table if not exists public.provider_route_origins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_profile_id uuid,
  kind text not null check (kind in ('home', 'office')),
  label text not null check (char_length(trim(label)) between 1 and 120),
  address text not null check (char_length(trim(address)) between 1 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_route_origins_tenant_id_id_key unique (tenant_id, id),
  constraint provider_route_origins_owner_kind_check check (
    (kind = 'office' and owner_profile_id is null)
    or (kind = 'home' and owner_profile_id is not null)
  )
);

create table if not exists public.provider_route_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_profile_id uuid not null,
  route_date date not null,
  origin_kind text not null check (origin_kind in ('home', 'office', 'current', 'manual')),
  origin_id uuid,
  origin_label text not null check (char_length(trim(origin_label)) between 1 and 120),
  origin_address text check (origin_address is null or char_length(origin_address) <= 300),
  origin_latitude double precision,
  origin_longitude double precision,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  assignment_revision timestamptz not null default now(),
  acknowledged_revision timestamptz,
  active_appointment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_route_days_tenant_id_id_key unique (tenant_id, id),
  constraint provider_route_days_tenant_id_id_provider_key
    unique (tenant_id, id, provider_profile_id),
  constraint provider_route_days_provider_date_key unique (provider_profile_id, route_date),
  constraint provider_route_days_origin_coordinate_pair_check check (
    (origin_latitude is null and origin_longitude is null)
    or (
      origin_latitude between -90 and 90
      and origin_longitude between -180 and 180
    )
  ),
  constraint provider_route_days_current_not_persisted_check check (
    origin_kind <> 'current'
    or (
      origin_id is null
      and origin_address is null
      and origin_latitude is null
      and origin_longitude is null
    )
  )
);

create table if not exists public.provider_route_day_stops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null,
  appointment_id uuid not null,
  assigned_provider_profile_id uuid not null,
  selected boolean not null default true,
  omission_reason text check (
    omission_reason in ('timing_conflict', 'unavailable', 'duplicate_cancelled', 'admin_review', 'other')
  ),
  omission_note text check (omission_note is null or char_length(omission_note) <= 500),
  assignment_snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_route_day_stops_tenant_id_id_key unique (tenant_id, id),
  constraint provider_route_day_stops_day_appointment_key unique (route_day_id, appointment_id),
  constraint provider_route_day_stops_omission_required_check check (selected or omission_reason is not null),
  constraint provider_route_day_stops_other_note_check check (
    omission_reason <> 'other' or nullif(trim(omission_note), '') is not null
  )
);

-- Upgrade a local draft without retaining simple cross-tenant foreign keys.
-- The replacement composite constraints preserve the original delete actions.
alter table public.provider_route_origins
  drop constraint if exists provider_route_origins_owner_profile_id_fkey;
alter table public.provider_route_days
  drop constraint if exists provider_route_days_provider_profile_id_fkey;
alter table public.provider_route_days
  drop constraint if exists provider_route_days_origin_id_fkey;
alter table public.provider_route_days
  drop constraint if exists provider_route_days_active_appointment_id_fkey;
alter table public.provider_route_day_stops
  drop constraint if exists provider_route_day_stops_route_day_id_fkey;
alter table public.provider_route_day_stops
  drop constraint if exists provider_route_day_stops_appointment_id_fkey;
alter table public.provider_route_day_stops
  drop constraint if exists provider_route_day_stops_assigned_provider_profile_id_fkey;
alter table public.provider_route_days
  drop constraint if exists provider_route_days_provider_profile_id_route_date_key;
alter table public.provider_route_day_stops
  drop constraint if exists provider_route_day_stops_route_day_id_appointment_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_origins'::regclass
      and conname = 'provider_route_origins_tenant_id_id_key'
  ) then
    alter table public.provider_route_origins
      add constraint provider_route_origins_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_tenant_id_id_key'
  ) then
    alter table public.provider_route_days
      add constraint provider_route_days_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_tenant_id_id_provider_key'
  ) then
    alter table public.provider_route_days
      add constraint provider_route_days_tenant_id_id_provider_key
      unique (tenant_id, id, provider_profile_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_provider_date_key'
  ) then
    alter table public.provider_route_days
      add constraint provider_route_days_provider_date_key
      unique (provider_profile_id, route_date);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_day_stops'::regclass
      and conname = 'provider_route_day_stops_tenant_id_id_key'
  ) then
    alter table public.provider_route_day_stops
      add constraint provider_route_day_stops_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_day_stops'::regclass
      and conname = 'provider_route_day_stops_day_appointment_key'
  ) then
    alter table public.provider_route_day_stops
      add constraint provider_route_day_stops_day_appointment_key unique (route_day_id, appointment_id);
  end if;
end $$;

-- Named checks also upgrade an earlier local draft. Validation intentionally
-- blocks release if current-location details were persisted or omissions are
-- internally inconsistent.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_origins'::regclass and conname = 'provider_route_origins_owner_kind_check') then
    alter table public.provider_route_origins add constraint provider_route_origins_owner_kind_check
      check (
        (kind = 'office' and owner_profile_id is null)
        or (kind = 'home' and owner_profile_id is not null)
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_origin_coordinate_pair_check') then
    alter table public.provider_route_days add constraint provider_route_days_origin_coordinate_pair_check
      check (
        (origin_latitude is null and origin_longitude is null)
        or (origin_latitude between -90 and 90 and origin_longitude between -180 and 180)
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_current_not_persisted_check') then
    alter table public.provider_route_days add constraint provider_route_days_current_not_persisted_check
      check (
        origin_kind <> 'current'
        or (
          origin_id is null and origin_address is null
          and origin_latitude is null and origin_longitude is null
        )
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_day_stops'::regclass and conname = 'provider_route_day_stops_omission_required_check') then
    alter table public.provider_route_day_stops add constraint provider_route_day_stops_omission_required_check
      check (selected or omission_reason is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_day_stops'::regclass and conname = 'provider_route_day_stops_other_note_check') then
    alter table public.provider_route_day_stops add constraint provider_route_day_stops_other_note_check
      check (omission_reason <> 'other' or nullif(trim(omission_note), '') is not null) not valid;
  end if;
end $$;

alter table public.provider_route_origins validate constraint provider_route_origins_owner_kind_check;
alter table public.provider_route_days validate constraint provider_route_days_origin_coordinate_pair_check;
alter table public.provider_route_days validate constraint provider_route_days_current_not_persisted_check;
alter table public.provider_route_day_stops validate constraint provider_route_day_stops_omission_required_check;
alter table public.provider_route_day_stops validate constraint provider_route_day_stops_other_note_check;

-- Add relationships unvalidated to keep the metadata lock short, then validate
-- immediately so a pre-existing cross-tenant row fails the migration closed.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_origins'::regclass and conname = 'provider_route_origins_owner_tenant_fk') then
    alter table public.provider_route_origins add constraint provider_route_origins_owner_tenant_fk
      foreign key (tenant_id, owner_profile_id) references public.profiles(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_provider_tenant_fk') then
    alter table public.provider_route_days add constraint provider_route_days_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_origin_tenant_fk') then
    alter table public.provider_route_days add constraint provider_route_days_origin_tenant_fk
      foreign key (tenant_id, origin_id) references public.provider_route_origins(tenant_id, id)
      on delete set null (origin_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_active_appointment_tenant_fk') then
    alter table public.provider_route_days add constraint provider_route_days_active_appointment_tenant_fk
      foreign key (tenant_id, active_appointment_id) references public.appointments(tenant_id, id)
      on delete set null (active_appointment_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_day_stops'::regclass and conname = 'provider_route_day_stops_route_provider_tenant_fk') then
    alter table public.provider_route_day_stops add constraint provider_route_day_stops_route_provider_tenant_fk
      foreign key (tenant_id, route_day_id, assigned_provider_profile_id)
      references public.provider_route_days(tenant_id, id, provider_profile_id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_day_stops'::regclass and conname = 'provider_route_day_stops_appointment_tenant_fk') then
    alter table public.provider_route_day_stops add constraint provider_route_day_stops_appointment_tenant_fk
      foreign key (tenant_id, appointment_id) references public.appointments(tenant_id, id)
      on delete cascade not valid;
  end if;
end $$;

alter table public.provider_route_origins validate constraint provider_route_origins_owner_tenant_fk;
alter table public.provider_route_days validate constraint provider_route_days_provider_tenant_fk;
alter table public.provider_route_days validate constraint provider_route_days_origin_tenant_fk;
alter table public.provider_route_days validate constraint provider_route_days_active_appointment_tenant_fk;
alter table public.provider_route_day_stops validate constraint provider_route_day_stops_route_provider_tenant_fk;
alter table public.provider_route_day_stops validate constraint provider_route_day_stops_appointment_tenant_fk;

create index if not exists provider_route_origins_owner_idx
  on public.provider_route_origins (tenant_id, owner_profile_id, kind);
create unique index if not exists provider_route_origins_unique_home_idx
  on public.provider_route_origins (tenant_id, owner_profile_id, kind)
  where owner_profile_id is not null;
create index if not exists provider_route_days_provider_date_idx
  on public.provider_route_days (tenant_id, provider_profile_id, route_date);
create index if not exists provider_route_stops_day_idx
  on public.provider_route_day_stops (tenant_id, route_day_id, appointment_id);

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'provider_route_origins', 'provider_route_days', 'provider_route_day_stops'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'trg_' || tbl || '_updated_at', tbl
    );
  end loop;
end $$;

drop policy if exists "route origins tenant operator access" on public.provider_route_origins;
drop policy if exists "providers see own home and office origins" on public.provider_route_origins;
drop policy if exists "providers manage own home origins" on public.provider_route_origins;
drop policy if exists "route days tenant operator access" on public.provider_route_days;
drop policy if exists "providers manage own route days" on public.provider_route_days;
drop policy if exists "route stops tenant operator access" on public.provider_route_day_stops;
drop policy if exists "providers manage own route stops" on public.provider_route_day_stops;

comment on table public.provider_route_origins is
  'Tenant-scoped home/office route origins. Home addresses are server-only operational data.';
comment on table public.provider_route_days is
  'Fixed-appointment route plan; current foreground coordinates are never persisted.';
comment on table public.provider_route_day_stops is
  'Tenant- and provider-consistent appointment selections for one route day.';
