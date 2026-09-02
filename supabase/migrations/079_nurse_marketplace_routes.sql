-- Versioned route plans, consent receipts, legs, release history, and provider quota evidence.

begin;

do $$
begin
  if to_regclass('public.provider_route_days') is null
     or to_regclass('public.provider_route_day_stops') is null
     or to_regclass('public.nurse_pickup_tasks') is null
     or to_regclass('public.operational_shifts') is null
     or to_regprocedure('app_private.prevent_os_append_only_mutation()') is null then
    raise exception using errcode = 'P0001', message = 'nurse_route_v1_dependencies_required';
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass
      and conname = 'provider_route_days_tenant_id_id_key' and contype = 'u' and convalidated
  ) then
    raise exception using errcode = 'P0001', message = 'provider_route_day_composite_identity_required';
  end if;
end $$;

alter table public.provider_route_days
  add column if not exists version integer not null default 1,
  add column if not exists current_plan_version_id uuid,
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid,
  add column if not exists release_reason_code text;

alter table public.provider_route_days drop constraint if exists provider_route_days_status_check;
alter table public.provider_route_days add constraint provider_route_days_status_check check (status in (
  'draft', 'origin_required', 'inventory_check', 'pickup_required', 'planning',
  'feasible', 'infeasible', 'released', 'acknowledged', 'active', 'paused',
  'recovery_required', 'cancelled', 'completed'
));
alter table public.provider_route_days drop constraint if exists provider_route_days_version_check;
alter table public.provider_route_days add constraint provider_route_days_version_check check (version > 0);
alter table public.provider_route_days drop constraint if exists provider_route_days_release_check;
alter table public.provider_route_days add constraint provider_route_days_release_check check (
  status not in ('released', 'acknowledged', 'active', 'paused', 'recovery_required', 'completed')
  or (released_at is not null and released_by is not null and current_plan_version_id is not null)
);

create table if not exists public.nurse_route_origin_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null,
  provider_profile_id uuid not null,
  origin_kind text not null check (origin_kind in ('current', 'manual', 'office')),
  consent_scope text not null default 'single_plan'
    check (consent_scope in ('single_plan', 'single_replan')),
  consent_text_version text not null check (char_length(trim(consent_text_version)) between 1 and 80),
  consent_hash text not null check (consent_hash ~ '^[0-9a-f]{64}$'),
  consented_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_origin_consents_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_origin_consents_route_fk foreign key (tenant_id, route_day_id, provider_profile_id)
    references public.provider_route_days(tenant_id, id, provider_profile_id) on delete cascade,
  constraint nurse_route_origin_consents_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete cascade,
  constraint nurse_route_origin_consents_expiry_check check (expires_at > consented_at),
  constraint nurse_route_origin_consents_usage_check check (consumed_at is null or consumed_at >= consented_at),
  constraint nurse_route_origin_consents_no_location_check check (
    -- This receipt deliberately contains no origin-position fields.
    origin_kind in ('current', 'manual', 'office')
  )
);

create index if not exists nurse_route_origin_consents_active_idx
  on public.nurse_route_origin_consents (tenant_id, route_day_id, provider_profile_id, expires_at)
  where consumed_at is null and revoked_at is null;

create table if not exists public.nurse_appointment_route_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null,
  version integer not null check (version > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  provenance_source text not null check (provenance_source in (
    'approved_booking_normalization', 'approved_operations_entry', 'approved_import'
  )),
  provenance_hash text not null check (provenance_hash ~ '^[0-9a-f]{64}$'),
  verified_by uuid not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  invalidation_code text check (invalidation_code is null or char_length(invalidation_code) <= 100),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_appointment_route_locations_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_appointment_route_locations_version_key unique (tenant_id, appointment_id, version),
  constraint nurse_appointment_route_locations_appointment_fk foreign key (tenant_id, appointment_id)
    references public.appointments(tenant_id, id) on delete cascade,
  constraint nurse_appointment_route_locations_actor_fk foreign key (tenant_id, verified_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_appointment_route_locations_freshness_check check (expires_at > verified_at),
  constraint nurse_appointment_route_locations_invalidation_check check (
    (invalidated_at is null and invalidation_code is null)
    or (invalidated_at is not null and invalidation_code is not null)
  )
);

create unique index if not exists nurse_appointment_route_locations_active_uidx
  on public.nurse_appointment_route_locations (tenant_id, appointment_id)
  where invalidated_at is null;

create table if not exists public.nurse_inventory_location_route_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inventory_location_id uuid not null,
  version integer not null check (version > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  safe_label text not null check (char_length(trim(safe_label)) between 1 and 160),
  safe_address text not null check (char_length(trim(safe_address)) between 1 and 300),
  hours_label text not null check (char_length(trim(hours_label)) between 1 and 160),
  provenance_source text not null check (provenance_source in ('approved_operations_entry', 'approved_import')),
  provenance_hash text not null check (provenance_hash ~ '^[0-9a-f]{64}$'),
  verified_by uuid not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  invalidation_code text check (invalidation_code is null or char_length(invalidation_code) <= 100),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_inventory_location_route_locations_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_inventory_location_route_locations_version_key unique (tenant_id, inventory_location_id, version),
  constraint nurse_inventory_location_route_locations_location_fk foreign key (tenant_id, inventory_location_id)
    references public.os_inventory_locations(tenant_id, id) on delete cascade,
  constraint nurse_inventory_location_route_locations_actor_fk foreign key (tenant_id, verified_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_inventory_location_route_locations_freshness_check check (expires_at > verified_at),
  constraint nurse_inventory_location_route_locations_invalidation_check check (
    (invalidated_at is null and invalidation_code is null)
    or (invalidated_at is not null and invalidation_code is not null)
  )
);

create unique index if not exists nurse_inventory_location_route_locations_active_uidx
  on public.nurse_inventory_location_route_locations (tenant_id, inventory_location_id)
  where invalidated_at is null;

create table if not exists public.nurse_route_plan_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null,
  provider_profile_id uuid not null,
  origin_consent_id uuid not null,
  plan_version integer not null check (plan_version > 0),
  status text not null default 'draft' check (status in (
    'draft', 'planning', 'feasible', 'infeasible', 'superseded', 'released', 'completed'
  )),
  provider text not null check (provider in ('google_route_optimization', 'disabled')),
  provider_request_id text,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_hash text check (response_hash is null or response_hash ~ '^[0-9a-f]{64}$'),
  route_policy_id uuid not null,
  constraints_hash text not null check (constraints_hash ~ '^[0-9a-f]{64}$'),
  constraint_evidence jsonb not null check (jsonb_typeof(constraint_evidence)='object'),
  constraint_evidence_hash text not null check (constraint_evidence_hash ~ '^[0-9a-f]{64}$'),
  expected_stop_count integer not null check (expected_stop_count >= 0),
  planned_stop_count integer check (planned_stop_count is null or planned_stop_count >= 0),
  skipped_stop_count integer not null default 0 check (skipped_stop_count >= 0),
  validation_error_count integer not null default 0 check (validation_error_count >= 0),
  total_duration_seconds integer check (total_duration_seconds is null or total_duration_seconds >= 0),
  total_distance_meters integer check (total_distance_meters is null or total_distance_meters >= 0),
  infeasibility_code text check (infeasibility_code is null or char_length(infeasibility_code) <= 100),
  planned_at timestamptz,
  released_at timestamptz,
  released_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_plan_versions_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_plan_versions_route_version_key unique (tenant_id, route_day_id, plan_version),
  constraint nurse_route_plan_versions_route_fk foreign key (tenant_id, route_day_id, provider_profile_id)
    references public.provider_route_days(tenant_id, id, provider_profile_id) on delete cascade,
  constraint nurse_route_plan_versions_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete cascade,
  constraint nurse_route_plan_versions_consent_fk foreign key (tenant_id, origin_consent_id)
    references public.nurse_route_origin_consents(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_versions_policy_fk foreign key (tenant_id, route_policy_id)
    references public.nurse_marketplace_policies(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_versions_releaser_fk foreign key (tenant_id, released_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_versions_feasible_check check (
    status <> 'feasible'
    or (
      response_hash is not null and planned_at is not null
      and planned_stop_count = expected_stop_count
      and skipped_stop_count = 0 and validation_error_count = 0
      and infeasibility_code is null
    )
  ),
  constraint nurse_route_plan_versions_infeasible_check check (
    status <> 'infeasible' or (planned_at is not null and infeasibility_code is not null)
  ),
  constraint nurse_route_plan_versions_release_check check (
    status not in ('released', 'completed')
    or (released_at is not null and released_by is not null and skipped_stop_count = 0 and validation_error_count = 0)
  )
);

create table if not exists public.nurse_route_plan_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null,
  provider_profile_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  origin_kind text not null check (origin_kind in ('current', 'manual', 'office')),
  status text not null default 'pending' check (status in ('pending', 'persisted', 'failed')),
  plan_version_id uuid,
  failure_code text check (failure_code is null or char_length(failure_code) <= 100),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint nurse_route_plan_requests_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_plan_requests_idempotency_key unique (tenant_id, route_day_id, idempotency_key),
  constraint nurse_route_plan_requests_route_fk foreign key (tenant_id, route_day_id, provider_profile_id)
    references public.provider_route_days(tenant_id, id, provider_profile_id) on delete restrict,
  constraint nurse_route_plan_requests_plan_fk foreign key (tenant_id, plan_version_id)
    references public.nurse_route_plan_versions(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_requests_state_check check (
    (status = 'persisted' and plan_version_id is not null and completed_at is not null)
    or (status = 'failed' and failure_code is not null and completed_at is not null)
    or status = 'pending'
  )
);

create unique index if not exists nurse_route_plan_versions_released_uidx
  on public.nurse_route_plan_versions (tenant_id, route_day_id)
  where status = 'released';

create table if not exists public.nurse_route_plan_stops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_version_id uuid not null,
  stop_key text not null check (char_length(trim(stop_key)) between 1 and 120),
  stop_type text not null check (stop_type in ('appointment', 'pickup', 'break')),
  sequence_number integer not null check (sequence_number >= 0),
  appointment_id uuid,
  pickup_task_id uuid,
  predecessor_stop_id uuid,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  service_duration_seconds integer not null check (service_duration_seconds >= 0),
  load_demands jsonb not null default '{}'::jsonb check (jsonb_typeof(load_demands) = 'object'),
  planned_arrival_at timestamptz,
  planned_departure_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_plan_stops_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_plan_stops_sequence_key unique (tenant_id, plan_version_id, sequence_number),
  constraint nurse_route_plan_stops_stop_key unique (tenant_id, plan_version_id, stop_key),
  constraint nurse_route_plan_stops_plan_fk foreign key (tenant_id, plan_version_id)
    references public.nurse_route_plan_versions(tenant_id, id) on delete cascade,
  constraint nurse_route_plan_stops_appointment_fk foreign key (tenant_id, appointment_id)
    references public.appointments(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_stops_pickup_fk foreign key (tenant_id, pickup_task_id)
    references public.nurse_pickup_tasks(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_stops_predecessor_fk foreign key (tenant_id, predecessor_stop_id)
    references public.nurse_route_plan_stops(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_stops_type_reference_check check (
    (stop_type = 'appointment' and appointment_id is not null and pickup_task_id is null)
    or (stop_type = 'pickup' and pickup_task_id is not null and appointment_id is null)
    or (stop_type = 'break' and appointment_id is null and pickup_task_id is null)
  ),
  constraint nurse_route_plan_stops_window_check check (
    window_starts_at is null or window_ends_at is null or window_ends_at > window_starts_at
  ),
  constraint nurse_route_plan_stops_timing_check check (
    planned_arrival_at is null or planned_departure_at is null or planned_departure_at >= planned_arrival_at
  )
);

alter table public.nurse_route_plan_stops
  add constraint nurse_route_plan_stops_plan_identity_key
  unique (tenant_id,plan_version_id,id);

create table if not exists public.nurse_route_plan_stop_dependencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_version_id uuid not null,
  predecessor_stop_id uuid not null,
  dependent_stop_id uuid not null,
  dependency_type text not null default 'pickup_before_appointment'
    check (dependency_type='pickup_before_appointment'),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_plan_stop_dependencies_tenant_id_id_key unique(tenant_id,id),
  constraint nurse_route_plan_stop_dependencies_key unique(
    tenant_id,plan_version_id,predecessor_stop_id,dependent_stop_id
  ),
  constraint nurse_route_plan_stop_dependencies_distinct_check
    check(predecessor_stop_id<>dependent_stop_id),
  constraint nurse_route_plan_stop_dependencies_plan_fk
    foreign key(tenant_id,plan_version_id)
    references public.nurse_route_plan_versions(tenant_id,id) on delete cascade,
  constraint nurse_route_plan_stop_dependencies_predecessor_fk
    foreign key(tenant_id,plan_version_id,predecessor_stop_id)
    references public.nurse_route_plan_stops(tenant_id,plan_version_id,id) on delete cascade,
  constraint nurse_route_plan_stop_dependencies_dependent_fk
    foreign key(tenant_id,plan_version_id,dependent_stop_id)
    references public.nurse_route_plan_stops(tenant_id,plan_version_id,id) on delete cascade
);
create index if not exists nurse_route_plan_stop_dependencies_dependent_idx
  on public.nurse_route_plan_stop_dependencies(tenant_id,plan_version_id,dependent_stop_id);

create table if not exists public.nurse_route_plan_legs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_version_id uuid not null,
  leg_number integer not null check (leg_number >= 0),
  from_stop_id uuid,
  to_stop_id uuid not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters integer not null check (distance_meters >= 0),
  planned_departure_at timestamptz,
  planned_arrival_at timestamptz,
  navigation_state text not null default 'pending' check (navigation_state in (
    'pending', 'active', 'arrived', 'completed', 'skipped', 'cancelled'
  )),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_plan_legs_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_plan_legs_number_key unique (tenant_id, plan_version_id, leg_number),
  constraint nurse_route_plan_legs_plan_fk foreign key (tenant_id, plan_version_id)
    references public.nurse_route_plan_versions(tenant_id, id) on delete cascade,
  constraint nurse_route_plan_legs_from_stop_fk foreign key (tenant_id, from_stop_id)
    references public.nurse_route_plan_stops(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_legs_to_stop_fk foreign key (tenant_id, to_stop_id)
    references public.nurse_route_plan_stops(tenant_id, id) on delete restrict,
  constraint nurse_route_plan_legs_timing_check check (
    planned_departure_at is null or planned_arrival_at is null or planned_arrival_at >= planned_departure_at
  )
);

create table if not exists public.nurse_route_release_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null,
  plan_version_id uuid,
  provider_profile_id uuid not null,
  from_status text,
  to_status text not null,
  action text not null check (action in (
    'set_origin', 'request_plan', 'mark_feasible', 'mark_infeasible', 'release',
    'acknowledge', 'activate', 'arrive', 'complete_stop', 'pause', 'resume', 'require_recovery', 'cancel', 'complete'
  )),
  reason_code text not null check (char_length(trim(reason_code)) between 1 and 100),
  actor_profile_id uuid not null,
  idempotency_key uuid not null,
  route_day_version integer not null check (route_day_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_release_history_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_release_history_idempotency_key unique (tenant_id, route_day_id, idempotency_key),
  constraint nurse_route_release_history_route_fk foreign key (tenant_id, route_day_id, provider_profile_id)
    references public.provider_route_days(tenant_id, id, provider_profile_id) on delete restrict,
  constraint nurse_route_release_history_plan_fk foreign key (tenant_id, plan_version_id)
    references public.nurse_route_plan_versions(tenant_id, id) on delete restrict,
  constraint nurse_route_release_history_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict
);

create table if not exists public.nurse_route_provider_daily_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider = 'google_maps_platform'),
  operation text not null check (operation in ('route_optimization', 'origin_geocoding')),
  usage_date date not null,
  usage_minute timestamptz not null,
  request_idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  daily_limit integer not null check (daily_limit > 0),
  ordinal integer not null check (ordinal > 0),
  per_minute_limit integer not null check (per_minute_limit > 0),
  minute_ordinal integer not null check (minute_ordinal > 0),
  allowed boolean not null,
  denial_code text check (denial_code is null or char_length(denial_code) <= 100),
  route_day_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_route_provider_daily_usage_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_route_provider_daily_usage_request_key unique (tenant_id, provider, operation, request_idempotency_key),
  constraint nurse_route_provider_daily_usage_ordinal_key unique (tenant_id, provider, operation, usage_date, ordinal),
  constraint nurse_route_provider_minute_usage_ordinal_key unique (tenant_id, provider, operation, usage_minute, minute_ordinal),
  constraint nurse_route_provider_daily_usage_denial_check check (allowed or denial_code is not null),
  constraint nurse_route_provider_daily_usage_route_fk foreign key (tenant_id, route_day_id)
    references public.provider_route_days(tenant_id, id) on delete restrict
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_current_plan_fk') then
    alter table public.provider_route_days add constraint provider_route_days_current_plan_fk
      foreign key (tenant_id, current_plan_version_id)
      references public.nurse_route_plan_versions(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_route_days'::regclass and conname = 'provider_route_days_releaser_fk') then
    alter table public.provider_route_days add constraint provider_route_days_releaser_fk
      foreign key (tenant_id, released_by)
      references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_pickup_tasks'::regclass and conname = 'nurse_pickup_tasks_route_day_fk') then
    alter table public.nurse_pickup_tasks add constraint nurse_pickup_tasks_route_day_fk
      foreign key (tenant_id, route_day_id)
      references public.provider_route_days(tenant_id, id) on delete restrict;
  end if;
end $$;

create index if not exists nurse_route_plan_stops_plan_idx
  on public.nurse_route_plan_stops (tenant_id, plan_version_id, sequence_number);
create index if not exists nurse_route_plan_legs_plan_idx
  on public.nurse_route_plan_legs (tenant_id, plan_version_id, leg_number);
create index if not exists nurse_route_provider_daily_usage_count_idx
  on public.nurse_route_provider_daily_usage (tenant_id, provider, operation, usage_date, allowed);

create or replace function app_private.protect_nurse_route_origin_consent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'route_origin_consent_delete_prohibited';
  end if;
  if new.id <> old.id or new.tenant_id <> old.tenant_id
     or new.route_day_id <> old.route_day_id
     or new.provider_profile_id <> old.provider_profile_id
     or new.origin_kind <> old.origin_kind
     or new.consent_scope <> old.consent_scope
     or new.consent_text_version <> old.consent_text_version
     or new.consent_hash <> old.consent_hash
     or new.consented_at <> old.consented_at
     or new.expires_at <> old.expires_at
     or new.created_at <> old.created_at then
    raise exception using errcode = 'P0001', message = 'route_origin_consent_evidence_immutable';
  end if;
  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
    raise exception using errcode = 'P0001', message = 'route_origin_consent_consumption_immutable';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception using errcode = 'P0001', message = 'route_origin_consent_revocation_immutable';
  end if;
  if new.consumed_at is not null and new.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'route_origin_consent_terminal_conflict';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_nurse_route_origin_consent() from public, anon, authenticated;
drop trigger if exists nurse_route_origin_consents_immutable on public.nurse_route_origin_consents;
create trigger nurse_route_origin_consents_immutable before update or delete on public.nurse_route_origin_consents
  for each row execute function app_private.protect_nurse_route_origin_consent();
drop trigger if exists nurse_route_release_history_immutable on public.nurse_route_release_history;
create trigger nurse_route_release_history_immutable before update or delete on public.nurse_route_release_history
  for each row execute function app_private.prevent_os_append_only_mutation();
drop trigger if exists nurse_route_provider_daily_usage_immutable on public.nurse_route_provider_daily_usage;
create trigger nurse_route_provider_daily_usage_immutable before update or delete on public.nurse_route_provider_daily_usage
  for each row execute function app_private.prevent_os_append_only_mutation();

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'nurse_route_origin_consents', 'nurse_appointment_route_locations',
    'nurse_inventory_location_route_locations', 'nurse_route_plan_versions',
    'nurse_route_plan_requests', 'nurse_route_plan_stop_dependencies',
    'nurse_route_plan_stops', 'nurse_route_plan_legs',
    'nurse_route_release_history', 'nurse_route_provider_daily_usage'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

comment on table public.nurse_route_origin_consents is
  'One-plan foreground/manual origin consent receipt. Exact current coordinates are intentionally never persisted.';
comment on table public.nurse_route_plan_versions is
  'Normalized provider result hashes and plan facts. Raw provider request/response bodies are not persisted.';
comment on table public.nurse_route_provider_daily_usage is
  'Append-only transactional provider quota decisions, including denied attempts.';

commit;
