-- Versioned supply requirements, exact stock reservations, and pickup work.

begin;

do $$
begin
  if to_regclass('public.nurse_shift_offers') is null
     or to_regclass('public.operational_shifts') is null
     or to_regclass('public.os_inventory_items') is null
     or to_regclass('public.os_inventory_variants') is null
     or to_regclass('public.os_inventory_lots') is null
     or to_regclass('public.os_inventory_locations') is null
     or to_regclass('public.os_inventory_location_balances') is null
     or to_regprocedure('app_private.prevent_os_append_only_mutation()') is null then
    raise exception using errcode = 'P0001', message = 'nurse_marketplace_inventory_dependencies_required';
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.nurse_shift_offers'::regclass
      and conname = 'nurse_shift_offers_tenant_id_id_key' and contype = 'u' and convalidated
  ) then
    raise exception using errcode = 'P0001', message = 'nurse_marketplace_offer_identity_required';
  end if;
end $$;

alter table public.os_inventory_lots
  add column if not exists disposition_status text not null default 'available',
  add column if not exists temperature_controlled boolean not null default false,
  add column if not exists temperature_evidence_expires_at timestamptz,
  add column if not exists calibration_required boolean not null default false,
  add column if not exists calibration_expires_at timestamptz,
  add column if not exists disposition_reason_code text,
  add column if not exists disposition_changed_at timestamptz,
  add column if not exists disposition_changed_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.os_inventory_lots'::regclass and conname = 'os_inventory_lots_disposition_check') then
    alter table public.os_inventory_lots add constraint os_inventory_lots_disposition_check
      check (disposition_status in ('available', 'quarantine', 'recalled', 'expired', 'consumed', 'retired'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.os_inventory_lots'::regclass and conname = 'os_inventory_lots_hold_reason_check') then
    alter table public.os_inventory_lots add constraint os_inventory_lots_hold_reason_check
      check (
        disposition_status = 'available'
        or (disposition_reason_code is not null and disposition_changed_at is not null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.os_inventory_lots'::regclass and conname = 'os_inventory_lots_disposition_actor_fk') then
    alter table public.os_inventory_lots add constraint os_inventory_lots_disposition_actor_fk
      foreign key (tenant_id, disposition_changed_by)
      references public.profiles(tenant_id, id) on delete restrict;
  end if;
end $$;

create table if not exists public.nurse_supply_manifests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manifest_key text not null check (char_length(trim(manifest_key)) between 1 and 100),
  name text not null check (char_length(trim(name)) between 1 and 180),
  service_code text not null check (char_length(trim(service_code)) between 1 and 100),
  role_required text not null check (char_length(trim(role_required)) between 1 and 80),
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_supply_manifests_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_supply_manifests_key unique (tenant_id, manifest_key),
  constraint nurse_supply_manifests_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict
);

create table if not exists public.nurse_supply_manifest_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manifest_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'clinical_review', 'approved', 'retired')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  requirements_hash text,
  clinical_reviewed_by uuid,
  clinical_reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  retired_at timestamptz,
  published_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_supply_manifest_versions_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_supply_manifest_versions_version_key unique (tenant_id, manifest_id, version),
  constraint nurse_supply_manifest_versions_manifest_fk foreign key (tenant_id, manifest_id)
    references public.nurse_supply_manifests(tenant_id, id) on delete cascade,
  constraint nurse_supply_manifest_versions_review_fk foreign key (tenant_id, clinical_reviewed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_supply_manifest_versions_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_supply_manifest_versions_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_supply_manifest_versions_review_check check (
    status not in ('clinical_review', 'approved', 'retired')
    or (clinical_reviewed_by is not null and clinical_reviewed_at is not null)
  ),
  constraint nurse_supply_manifest_versions_approval_check check (
    status not in ('approved', 'retired') or (approved_by is not null and approved_at is not null)
  ),
  constraint nurse_supply_manifest_versions_retired_check check (status <> 'retired' or retired_at is not null)
);

alter table public.nurse_supply_manifest_versions
  add constraint nurse_supply_manifest_versions_requirements_hash_check
  check (requirements_hash is null or requirements_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists nurse_supply_manifest_versions_approved_uidx
  on public.nurse_supply_manifest_versions (tenant_id, manifest_id)
  where status = 'approved';

create table if not exists public.nurse_supply_manifest_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manifest_version_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  quantity numeric(14,3) not null check (quantity > 0),
  lot_required boolean not null default false,
  temperature_evidence_required boolean not null default false,
  calibration_evidence_required boolean not null default false,
  pickup_allowed boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_supply_manifest_requirements_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_supply_manifest_requirements_version_fk foreign key (tenant_id, manifest_version_id)
    references public.nurse_supply_manifest_versions(tenant_id, id) on delete cascade,
  constraint nurse_supply_manifest_requirements_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint nurse_supply_manifest_requirements_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict
);

create unique index if not exists nurse_supply_manifest_requirements_item_uidx
  on public.nurse_supply_manifest_requirements (
    tenant_id, manifest_version_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.nurse_shift_supply_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  manifest_version_id uuid not null,
  requirements_hash text not null check (requirements_hash ~ '^[0-9a-f]{64}$'),
  pinned_by uuid not null,
  pinned_at timestamptz not null default clock_timestamp(),
  invalidated_at timestamptz,
  invalidation_code text check (invalidation_code is null or char_length(invalidation_code) <= 100),
  constraint nurse_shift_supply_requirements_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_shift_supply_requirements_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete restrict,
  constraint nurse_shift_supply_requirements_manifest_fk foreign key (tenant_id, manifest_version_id)
    references public.nurse_supply_manifest_versions(tenant_id, id) on delete restrict,
  constraint nurse_shift_supply_requirements_actor_fk foreign key (tenant_id, pinned_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_shift_supply_requirements_invalidation_check check (
    (invalidated_at is null and invalidation_code is null)
    or (invalidated_at is not null and invalidation_code is not null)
  )
);

create unique index if not exists nurse_shift_supply_requirements_active_uidx
  on public.nurse_shift_supply_requirements(tenant_id,shift_id)
  where invalidated_at is null;

create table if not exists public.nurse_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  offer_id uuid,
  assignment_request_id uuid,
  provider_profile_id uuid not null,
  requirement_id uuid not null,
  location_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  lot_id uuid,
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'prepared' check (status in (
    'prepared', 'reserved', 'released', 'consumed', 'expired', 'cancelled'
  )),
  version integer not null default 1 check (version > 0),
  prepared_at timestamptz not null default clock_timestamp(),
  reserved_at timestamptz,
  expires_at timestamptz not null,
  released_at timestamptz,
  release_code text check (release_code is null or char_length(release_code) <= 100),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_inventory_reservations_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_inventory_reservations_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete cascade,
  constraint nurse_inventory_reservations_offer_fk foreign key (tenant_id, offer_id)
    references public.nurse_shift_offers(tenant_id, id) on delete cascade,
  constraint nurse_inventory_reservations_source_check check (
    (offer_id is not null and assignment_request_id is null)
    or (offer_id is null and assignment_request_id is not null)
  ),
  constraint nurse_inventory_reservations_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete cascade,
  constraint nurse_inventory_reservations_requirement_fk foreign key (tenant_id, requirement_id)
    references public.nurse_supply_manifest_requirements(tenant_id, id) on delete restrict,
  constraint nurse_inventory_reservations_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint nurse_inventory_reservations_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint nurse_inventory_reservations_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint nurse_inventory_reservations_lot_fk foreign key (tenant_id, lot_id)
    references public.os_inventory_lots(tenant_id, id) on delete restrict,
  constraint nurse_inventory_reservations_state_check check (
    (status = 'reserved' and reserved_at is not null and released_at is null)
    or (status in ('released', 'expired', 'cancelled') and released_at is not null and release_code is not null)
    or status in ('prepared', 'consumed')
  )
);

create index if not exists nurse_inventory_reservations_stock_idx
  on public.nurse_inventory_reservations
  (tenant_id, location_id, item_id, variant_id, lot_id, status, expires_at);
create index if not exists nurse_inventory_reservations_offer_idx
  on public.nurse_inventory_reservations (tenant_id, offer_id, status);
create unique index if not exists nurse_inventory_reservations_allocation_uidx
  on public.nurse_inventory_reservations (
    tenant_id,
    coalesce(offer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(assignment_request_id, '00000000-0000-0000-0000-000000000000'::uuid),
    requirement_id, location_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.nurse_pickup_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  location_id uuid not null,
  route_day_id uuid,
  status text not null default 'required' check (status in (
    'required', 'acknowledged', 'arrived', 'completed', 'cancelled', 'blocked'
  )),
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  evidence_hash text check (evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$'),
  completion_idempotency_key uuid,
  completion_request_hash text check (
    completion_request_hash is null or completion_request_hash ~ '^[0-9a-f]{64}$'
  ),
  completed_by uuid,
  handoff_evidence jsonb check (
    handoff_evidence is null or jsonb_typeof(handoff_evidence)='object'
  ),
  version integer not null default 1 check (version > 0),
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_pickup_tasks_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_pickup_tasks_shift_location_key unique (tenant_id, shift_id, provider_profile_id, location_id),
  constraint nurse_pickup_tasks_window_check check (
    window_starts_at is null or window_ends_at is null or window_ends_at > window_starts_at
  ),
  constraint nurse_pickup_tasks_completion_check check (
    status <> 'completed' or (completed_at is not null and evidence_hash is not null)
  ),
  constraint nurse_pickup_tasks_completion_evidence_check check (
    (completion_idempotency_key is null and completion_request_hash is null
      and completed_by is null and handoff_evidence is null)
    or (completion_idempotency_key is not null and completion_request_hash is not null
      and completed_by is not null and handoff_evidence is not null)
  ),
  constraint nurse_pickup_tasks_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete cascade,
  constraint nurse_pickup_tasks_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete cascade,
  constraint nurse_pickup_tasks_completed_by_fk foreign key (tenant_id, completed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_pickup_tasks_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict
);

drop trigger if exists touch_nurse_supply_manifests_updated_at on public.nurse_supply_manifests;
create trigger touch_nurse_supply_manifests_updated_at before update on public.nurse_supply_manifests
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_nurse_inventory_reservations_updated_at on public.nurse_inventory_reservations;
create trigger touch_nurse_inventory_reservations_updated_at before update on public.nurse_inventory_reservations
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_nurse_pickup_tasks_updated_at on public.nurse_pickup_tasks;
create trigger touch_nurse_pickup_tasks_updated_at before update on public.nurse_pickup_tasks
  for each row execute function public.touch_updated_at();

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'nurse_supply_manifests', 'nurse_supply_manifest_versions',
    'nurse_supply_manifest_requirements', 'nurse_shift_supply_requirements',
    'nurse_inventory_reservations', 'nurse_pickup_tasks'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

comment on table public.nurse_inventory_reservations is
  'Exact lot/location allocations. Prepared rows are only feasibility evidence; accepted work atomically promotes them to reserved.';
comment on table public.nurse_shift_supply_requirements is
  'Immutable manifest version pinned to a shift. Free-text kit assertions cannot satisfy readiness.';

commit;
