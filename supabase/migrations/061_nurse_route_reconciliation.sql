-- Atomic reconciliation for the existing Nurse route tables. This migration
-- intentionally does not create route data, route origins, or browser access.

begin;

-- Fail before the first schema or ACL mutation unless the existing route
-- tables and their composite parents have the exact contract used by 062.
do $$
begin
  if to_regclass('public.provider_route_days') is null
     or to_regclass('public.provider_route_day_stops') is null then
    raise exception using errcode = 'P0001', message = 'nurse_route_tables_required';
  end if;
  if to_regclass('public.provider_profiles') is null
     or to_regclass('public.appointments') is null then
    raise exception using errcode = 'P0001', message = 'nurse_route_parent_tables_required';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception using errcode = 'P0001', message = 'touch_updated_at_required';
  end if;
  if to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception using errcode = 'P0001', message = 'supabase_data_api_roles_required';
  end if;

  if exists (
    select 1
    from (values
      ('provider_route_days', 'id', 'uuid'::regtype, true),
      ('provider_route_days', 'tenant_id', 'uuid'::regtype, true),
      ('provider_route_days', 'provider_profile_id', 'uuid'::regtype, true),
      ('provider_route_days', 'route_date', 'date'::regtype, true),
      ('provider_route_days', 'origin_kind', 'text'::regtype, true),
      ('provider_route_days', 'origin_id', 'uuid'::regtype, false),
      ('provider_route_days', 'origin_label', 'text'::regtype, true),
      ('provider_route_days', 'origin_address', 'text'::regtype, false),
      ('provider_route_days', 'origin_latitude', 'double precision'::regtype, false),
      ('provider_route_days', 'origin_longitude', 'double precision'::regtype, false),
      ('provider_route_days', 'status', 'text'::regtype, true),
      ('provider_route_days', 'assignment_revision', 'timestamptz'::regtype, true),
      ('provider_route_days', 'acknowledged_revision', 'timestamptz'::regtype, false),
      ('provider_route_days', 'active_appointment_id', 'uuid'::regtype, false),
      ('provider_route_days', 'created_at', 'timestamptz'::regtype, true),
      ('provider_route_days', 'updated_at', 'timestamptz'::regtype, true),
      ('provider_route_day_stops', 'id', 'uuid'::regtype, true),
      ('provider_route_day_stops', 'tenant_id', 'uuid'::regtype, true),
      ('provider_route_day_stops', 'route_day_id', 'uuid'::regtype, true),
      ('provider_route_day_stops', 'appointment_id', 'uuid'::regtype, true),
      ('provider_route_day_stops', 'assigned_provider_profile_id', 'uuid'::regtype, true),
      ('provider_route_day_stops', 'selected', 'boolean'::regtype, true),
      ('provider_route_day_stops', 'omission_reason', 'text'::regtype, false),
      ('provider_route_day_stops', 'omission_note', 'text'::regtype, false),
      ('provider_route_day_stops', 'assignment_snapshot_at', 'timestamptz'::regtype, true),
      ('provider_route_day_stops', 'created_at', 'timestamptz'::regtype, true),
      ('provider_route_day_stops', 'updated_at', 'timestamptz'::regtype, true),
      ('provider_profiles', 'id', 'uuid'::regtype, true),
      ('provider_profiles', 'tenant_id', 'uuid'::regtype, true),
      ('appointments', 'id', 'uuid'::regtype, true),
      ('appointments', 'tenant_id', 'uuid'::regtype, false)
    ) as required(table_name, column_name, type_oid, is_not_null)
    left join pg_namespace table_namespace
      on table_namespace.nspname = 'public'
    left join pg_class table_definition
      on table_definition.relnamespace = table_namespace.oid
     and table_definition.relname = required.table_name
     and table_definition.relkind in ('r', 'p')
    left join pg_attribute column_definition
      on column_definition.attrelid = table_definition.oid
     and column_definition.attname = required.column_name
     and column_definition.attnum > 0
     and not column_definition.attisdropped
    where column_definition.attnum is null
       or column_definition.atttypid <> required.type_oid::oid
       or column_definition.attnotnull is distinct from required.is_not_null
  ) then
    raise exception using errcode = 'P0001', message = 'nurse_route_column_contract_mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.provider_profiles'::regclass
      and constraint_definition.conname = 'operational_provider_profiles_tenant_id_id_key'
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
  ) or not exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.appointments'::regclass
      and constraint_definition.conname = 'operational_appointments_tenant_id_id_key'
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
    raise exception using errcode = 'P0001', message = 'nurse_route_parent_identity_mismatch';
  end if;
end $$;

-- Add a missing unique identity normally so duplicate data aborts the entire
-- transaction. An existing same-name object must already be the exact,
-- validated identity; incompatible definitions are never dropped or replaced.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_tenant_id_id_key'
  ) then
    if not exists (
      select 1
      from pg_constraint constraint_definition
      where constraint_definition.conrelid = 'public.provider_route_days'::regclass
        and constraint_definition.conname = 'provider_route_days_tenant_id_id_key'
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
      raise exception using errcode = 'P0001', message = 'provider_route_days_tenant_identity_mismatch';
    end if;
  else
    alter table public.provider_route_days
      add constraint provider_route_days_tenant_id_id_key unique (tenant_id, id);
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_tenant_id_id_provider_key'
  ) then
    if not exists (
      select 1
      from pg_constraint constraint_definition
      where constraint_definition.conrelid = 'public.provider_route_days'::regclass
        and constraint_definition.conname = 'provider_route_days_tenant_id_id_provider_key'
        and constraint_definition.contype = 'u'
        and constraint_definition.convalidated
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.conkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.conrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'id', 'provider_profile_id']::text[]
    ) then
      raise exception using errcode = 'P0001', message = 'provider_route_days_provider_identity_mismatch';
    end if;
  else
    alter table public.provider_route_days
      add constraint provider_route_days_tenant_id_id_provider_key
      unique (tenant_id, id, provider_profile_id);
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_day_stops'::regclass
      and conname = 'provider_route_day_stops_tenant_id_id_key'
  ) then
    if not exists (
      select 1
      from pg_constraint constraint_definition
      where constraint_definition.conrelid = 'public.provider_route_day_stops'::regclass
        and constraint_definition.conname = 'provider_route_day_stops_tenant_id_id_key'
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
      raise exception using errcode = 'P0001', message = 'provider_route_day_stops_tenant_identity_mismatch';
    end if;
  else
    alter table public.provider_route_day_stops
      add constraint provider_route_day_stops_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

-- Foreign keys are installed NOT VALID to minimize the initial lock, then
-- validated before commit. Existing same-name constraints must already be
-- validated, cascading, and exact; mismatches fail rather than being replaced.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_provider_tenant_fk'
  ) then
    if not exists (
      select 1
      from pg_constraint constraint_definition
      where constraint_definition.conrelid = 'public.provider_route_days'::regclass
        and constraint_definition.conname = 'provider_route_days_provider_tenant_fk'
        and constraint_definition.contype = 'f'
        and constraint_definition.convalidated
        and constraint_definition.confrelid = 'public.provider_profiles'::regclass
        and constraint_definition.confdeltype = 'c'
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.conkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.conrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'provider_profile_id']::text[]
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.confkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.confrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'id']::text[]
    ) then
      raise exception using errcode = 'P0001', message = 'provider_route_days_provider_tenant_fk_mismatch';
    end if;
  else
    alter table public.provider_route_days
      add constraint provider_route_days_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id)
      references public.provider_profiles(tenant_id, id)
      on delete cascade not valid;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_day_stops'::regclass
      and conname = 'provider_route_day_stops_route_provider_tenant_fk'
  ) then
    if not exists (
      select 1
      from pg_constraint constraint_definition
      where constraint_definition.conrelid = 'public.provider_route_day_stops'::regclass
        and constraint_definition.conname = 'provider_route_day_stops_route_provider_tenant_fk'
        and constraint_definition.contype = 'f'
        and constraint_definition.convalidated
        and constraint_definition.confrelid = 'public.provider_route_days'::regclass
        and constraint_definition.confdeltype = 'c'
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.conkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.conrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'route_day_id', 'assigned_provider_profile_id']::text[]
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.confkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.confrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'id', 'provider_profile_id']::text[]
    ) then
      raise exception using errcode = 'P0001', message = 'provider_route_day_stops_route_provider_tenant_fk_mismatch';
    end if;
  else
    alter table public.provider_route_day_stops
      add constraint provider_route_day_stops_route_provider_tenant_fk
      foreign key (tenant_id, route_day_id, assigned_provider_profile_id)
      references public.provider_route_days(tenant_id, id, provider_profile_id)
      on delete cascade not valid;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_route_day_stops'::regclass
      and conname = 'provider_route_day_stops_appointment_tenant_fk'
  ) then
    if not exists (
      select 1
      from pg_constraint constraint_definition
      where constraint_definition.conrelid = 'public.provider_route_day_stops'::regclass
        and constraint_definition.conname = 'provider_route_day_stops_appointment_tenant_fk'
        and constraint_definition.contype = 'f'
        and constraint_definition.convalidated
        and constraint_definition.confrelid = 'public.appointments'::regclass
        and constraint_definition.confdeltype = 'c'
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.conkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.conrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'appointment_id']::text[]
        and (
          select array_agg(attribute.attname::text order by key_column.ordinality)
          from unnest(constraint_definition.confkey)
            with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_definition.confrelid
           and attribute.attnum = key_column.attnum
        ) = array['tenant_id', 'id']::text[]
    ) then
      raise exception using errcode = 'P0001', message = 'provider_route_day_stops_appointment_tenant_fk_mismatch';
    end if;
  else
    alter table public.provider_route_day_stops
      add constraint provider_route_day_stops_appointment_tenant_fk
      foreign key (tenant_id, appointment_id)
      references public.appointments(tenant_id, id)
      on delete cascade not valid;
  end if;
end $$;

alter table public.provider_route_days
  validate constraint provider_route_days_provider_tenant_fk;
alter table public.provider_route_day_stops
  validate constraint provider_route_day_stops_route_provider_tenant_fk;
alter table public.provider_route_day_stops
  validate constraint provider_route_day_stops_appointment_tenant_fk;

alter table public.provider_route_days enable row level security;
alter table public.provider_route_day_stops enable row level security;

revoke all on table public.provider_route_days,
  public.provider_route_day_stops from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.provider_route_days,
  public.provider_route_day_stops to service_role;

drop policy if exists "route days tenant operator access" on public.provider_route_days;
drop policy if exists "providers manage own route days" on public.provider_route_days;
drop policy if exists "route stops tenant operator access" on public.provider_route_day_stops;
drop policy if exists "providers manage own route stops" on public.provider_route_day_stops;

drop trigger if exists trg_provider_route_days_updated_at on public.provider_route_days;
create trigger trg_provider_route_days_updated_at
  before update on public.provider_route_days
  for each row execute function public.touch_updated_at();
alter table public.provider_route_days enable trigger trg_provider_route_days_updated_at;

drop trigger if exists trg_provider_route_day_stops_updated_at on public.provider_route_day_stops;
create trigger trg_provider_route_day_stops_updated_at
  before update on public.provider_route_day_stops
  for each row execute function public.touch_updated_at();
alter table public.provider_route_day_stops enable trigger trg_provider_route_day_stops_updated_at;

commit;
