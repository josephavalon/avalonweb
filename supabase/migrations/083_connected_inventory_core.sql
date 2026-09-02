-- Connected Inventory V1: canonical availability, physical kits, custody,
-- blind counts, demand episodes, controlled procurement, receiving, and A1
-- draft-only agent evidence. Existing os_* stock movements remain canonical.

begin;

do $$
begin
  if to_regclass('public.os_inventory_items') is null
     or to_regclass('public.os_inventory_locations') is null
     or to_regclass('public.os_inventory_location_assignments') is null
     or to_regclass('public.os_inventory_location_balances') is null
     or to_regclass('public.os_inventory_restock_requests') is null
     or to_regclass('public.os_inventory_restock_request_lines') is null
     or to_regclass('public.os_purchase_orders') is null
     or to_regclass('public.os_purchase_order_lines') is null
     or to_regclass('public.nurse_inventory_reservations') is null
     or to_regprocedure('app_private.prevent_os_append_only_mutation()') is null
     or to_regprocedure('app_private.assert_inventory_admin(uuid,uuid)') is null then
    raise exception using errcode = 'P0001', message = 'connected_inventory_dependencies_required';
  end if;
end $$;

-- Catalog classification is fail-closed. A new or backfilled item is unknown
-- until an accountable reviewer records the applicable class and policy.
alter table public.os_inventory_items
  add column if not exists base_uom text not null default 'unit',
  add column if not exists regulated_class text not null default 'unknown',
  add column if not exists classification_reviewed_by uuid,
  add column if not exists classification_reviewed_at timestamptz,
  add column if not exists storage_policy jsonb not null default '{}'::jsonb,
  add column if not exists serial_tracking_required boolean not null default false,
  add column if not exists udi_tracking_applicable boolean not null default false,
  add column if not exists ndc_tracking_applicable boolean not null default false,
  add column if not exists automation_eligible boolean not null default false,
  add column if not exists max_on_hand numeric(14,3),
  add column if not exists safety_stock numeric(14,3) not null default 0;

alter table public.os_inventory_items
  drop constraint if exists os_inventory_items_regulated_class_check;
alter table public.os_inventory_items
  add constraint os_inventory_items_regulated_class_check check (regulated_class in (
    'unknown', 'general_commodity', 'medical_supply', 'regulated_device',
    'prescription_drug', 'biologic', 'compounded_product', 'cold_chain',
    'controlled_substance', 'hazardous_material', 'calibration_equipment', 'other_reviewed'
  ));
alter table public.os_inventory_items
  drop constraint if exists os_inventory_items_classification_review_check;
alter table public.os_inventory_items
  add constraint os_inventory_items_classification_review_check check (
    (regulated_class = 'unknown' and classification_reviewed_by is null and classification_reviewed_at is null and automation_eligible = false)
    or (regulated_class <> 'unknown' and classification_reviewed_by is not null and classification_reviewed_at is not null)
  );
alter table public.os_inventory_items
  drop constraint if exists os_inventory_items_stock_policy_check;
alter table public.os_inventory_items
  add constraint os_inventory_items_stock_policy_check check (
    safety_stock >= 0 and (max_on_hand is null or max_on_hand >= safety_stock)
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_inventory_items'::regclass
      and conname = 'os_inventory_items_classification_reviewer_fk'
  ) then
    alter table public.os_inventory_items add constraint os_inventory_items_classification_reviewer_fk
      foreign key (tenant_id, classification_reviewed_by)
      references public.profiles(tenant_id, id) on delete restrict;
  end if;
end $$;

alter table public.os_inventory_variants
  add column if not exists manufacturer text,
  add column if not exists manufacturer_item_code text,
  add column if not exists udi_device_identifier text,
  add column if not exists ndc_code text,
  add column if not exists serial_number_required boolean not null default false;

-- A physical kit is a durable asset. Custody belongs to assignments/handoffs,
-- not to a copied balance or to the mutable display name of a nurse.
create table if not exists public.os_inventory_kits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null,
  kit_code text not null check (kit_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  barcode text,
  qr_code text,
  seal_code text,
  status text not null default 'ready' check (status in (
    'draft', 'ready', 'assignment_pending', 'handoff_pending', 'in_custody',
    'return_pending', 'inspection', 'quarantine', 'retired', 'lost', 'disputed'
  )),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_kits_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_kits_location_key unique (tenant_id, location_id),
  constraint os_inventory_kits_code_key unique (tenant_id, kit_code),
  constraint os_inventory_kits_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_kits_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict
);

insert into public.os_inventory_kits (
  id, tenant_id, location_id, kit_code, status, version, created_by, created_at, updated_at
)
select
  location.id, location.tenant_id, location.id, location.location_code,
  case
    when location.status = 'retired' then 'retired'
    when assignment.assignment_status = 'accepted' then 'in_custody'
    when assignment.assignment_status = 'assigned' then 'assignment_pending'
    when location.status = 'hold' then 'quarantine'
    else 'ready'
  end,
  location.version, location.created_by, location.created_at, location.updated_at
from public.os_inventory_locations location
left join lateral (
  select candidate.assignment_status
  from public.os_inventory_location_assignments candidate
  where candidate.tenant_id = location.tenant_id
    and candidate.location_id = location.id
    and candidate.assignment_status in ('assigned', 'accepted')
  order by candidate.assigned_at desc, candidate.id desc
  limit 1
) assignment on true
where location.location_type = 'nurse_kit'
on conflict (tenant_id, location_id) do nothing;

alter table public.os_inventory_location_assignments
  add column if not exists kit_id uuid;

update public.os_inventory_location_assignments assignment
set kit_id = kit.id
from public.os_inventory_kits kit
where assignment.tenant_id = kit.tenant_id
  and assignment.location_id = kit.location_id
  and assignment.kit_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_inventory_location_assignments'::regclass
      and conname = 'os_inventory_assignment_kit_fk'
  ) then
    alter table public.os_inventory_location_assignments add constraint os_inventory_assignment_kit_fk
      foreign key (tenant_id, kit_id)
      references public.os_inventory_kits(tenant_id, id) on delete restrict;
  end if;
end $$;

create unique index if not exists os_inventory_assignment_active_kit_uidx
  on public.os_inventory_location_assignments (tenant_id, kit_id)
  where kit_id is not null and assignment_status in ('assigned', 'accepted');

-- nurse_profile_id on a legacy location is historical metadata only. Physical
-- kit ownership is now represented exclusively by the active assignment.
alter table public.os_inventory_locations
  drop constraint if exists os_inventory_locations_nurse_type_check;
drop index if exists public.os_inventory_locations_active_nurse_uidx;

-- Expand the location vocabulary without changing existing location IDs.
alter table public.os_inventory_locations
  drop constraint if exists os_inventory_locations_location_type_check;
alter table public.os_inventory_locations
  add constraint os_inventory_locations_location_type_check check (location_type in (
    'central', 'warehouse', 'nurse_kit', 'event_kit', 'vehicle', 'quarantine', 'in_transit'
  ));

create table if not exists public.os_inventory_role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  inventory_role text not null check (inventory_role in (
    'inventory_admin', 'clinical_approver', 'procurement',
    'inventory_adjustment_reviewer', 'inventory_auditor'
  )),
  active boolean not null default true,
  assigned_by uuid not null,
  assigned_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  constraint os_inventory_role_assignments_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_role_assignments_profile_fk foreign key (tenant_id, profile_id)
    references public.profiles(tenant_id, id) on delete cascade,
  constraint os_inventory_role_assignments_actor_fk foreign key (tenant_id, assigned_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_role_assignments_state_check check (
    (active and revoked_at is null) or (not active and revoked_at is not null)
  )
);
create unique index if not exists os_inventory_role_assignments_active_uidx
  on public.os_inventory_role_assignments (tenant_id, profile_id, inventory_role)
  where active;

create table if not exists public.os_inventory_handoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kit_id uuid not null,
  from_location_id uuid not null,
  transit_location_id uuid not null,
  to_location_id uuid not null,
  restock_request_id uuid,
  status text not null default 'draft' check (status in (
    'draft', 'picking', 'in_transit', 'ready_pickup', 'received', 'disputed',
    'cancelled', 'quarantined'
  )),
  seal_code text,
  version integer not null default 1 check (version > 0),
  dispatched_by uuid,
  dispatched_at timestamptz,
  received_by uuid,
  received_at timestamptz,
  dispute_code text,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_handoffs_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_handoffs_kit_fk foreign key (tenant_id, kit_id)
    references public.os_inventory_kits(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_from_fk foreign key (tenant_id, from_location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_transit_fk foreign key (tenant_id, transit_location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_to_fk foreign key (tenant_id, to_location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_restock_fk foreign key (tenant_id, restock_request_id)
    references public.os_inventory_restock_requests(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_dispatcher_fk foreign key (tenant_id, dispatched_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_receiver_fk foreign key (tenant_id, received_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_handoffs_location_check check (
    from_location_id <> transit_location_id and transit_location_id <> to_location_id
      and from_location_id <> to_location_id
  ),
  constraint os_inventory_handoffs_state_check check (
    (status in ('draft', 'picking', 'cancelled') and received_at is null)
    or (status in ('in_transit', 'ready_pickup') and dispatched_by is not null and dispatched_at is not null and received_at is null)
    or (status = 'received' and dispatched_by is not null and dispatched_at is not null and received_by is not null and received_at is not null and dispute_code is null)
    or (status in ('disputed', 'quarantined') and received_by is not null and received_at is not null and dispute_code is not null)
  )
);

create table if not exists public.os_inventory_handoff_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  handoff_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  lot_id uuid,
  quantity numeric(14,3) not null check (quantity > 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_handoff_lines_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_handoff_lines_handoff_fk foreign key (tenant_id, handoff_id)
    references public.os_inventory_handoffs(tenant_id, id) on delete restrict,
  constraint os_inventory_handoff_lines_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_handoff_lines_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint os_inventory_handoff_lines_lot_fk foreign key (tenant_id, lot_id)
    references public.os_inventory_lots(tenant_id, id) on delete restrict
);
create unique index if not exists os_inventory_handoff_lines_key_uidx
  on public.os_inventory_handoff_lines (
    tenant_id, handoff_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.os_inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null,
  kit_id uuid,
  status text not null default 'in_progress' check (status in (
    'draft', 'in_progress', 'submitted', 'reconciled', 'variance_review',
    'approved_adjustment', 'rejected', 'superseded'
  )),
  snapshot_at timestamptz not null default clock_timestamp(),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  count_reason text not null check (count_reason in (
    'scheduled', 'handoff', 'return', 'variance', 'recall', 'admin_requested'
  )),
  version integer not null default 1 check (version > 0),
  started_by uuid not null,
  submitted_by uuid,
  reviewed_by uuid,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_count_sessions_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_count_sessions_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_count_sessions_kit_fk foreign key (tenant_id, kit_id)
    references public.os_inventory_kits(tenant_id, id) on delete restrict,
  constraint os_inventory_count_sessions_starter_fk foreign key (tenant_id, started_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_count_sessions_submitter_fk foreign key (tenant_id, submitted_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_count_sessions_reviewer_fk foreign key (tenant_id, reviewed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_count_sessions_state_check check (
    (status in ('draft', 'in_progress') and submitted_at is null and reviewed_at is null)
    or (status in ('submitted', 'variance_review') and submitted_by is not null and submitted_at is not null and reviewed_at is null)
    or (status in ('reconciled', 'approved_adjustment', 'rejected', 'superseded') and submitted_by is not null and submitted_at is not null and reviewed_by is not null and reviewed_at is not null)
  )
);
create unique index if not exists os_inventory_count_sessions_active_uidx
  on public.os_inventory_count_sessions (tenant_id, location_id)
  where status in ('draft', 'in_progress', 'submitted', 'variance_review');

create table if not exists public.os_inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  count_session_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  lot_id uuid,
  expected_quantity numeric(14,3) not null,
  actual_quantity numeric(14,3),
  scanned_identifier text,
  counted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_count_lines_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_count_lines_session_fk foreign key (tenant_id, count_session_id)
    references public.os_inventory_count_sessions(tenant_id, id) on delete restrict,
  constraint os_inventory_count_lines_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_count_lines_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint os_inventory_count_lines_lot_fk foreign key (tenant_id, lot_id)
    references public.os_inventory_lots(tenant_id, id) on delete restrict,
  constraint os_inventory_count_lines_actual_check check (actual_quantity is null or actual_quantity >= 0)
);
create unique index if not exists os_inventory_count_lines_key_uidx
  on public.os_inventory_count_lines (
    tenant_id, count_session_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.os_inventory_count_variances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  count_session_id uuid not null,
  count_line_id uuid not null,
  variance_quantity numeric(14,3) not null check (variance_quantity <> 0),
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'superseded')),
  reason_code text,
  adjustment_movement_id uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_count_variances_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_count_variances_session_fk foreign key (tenant_id, count_session_id)
    references public.os_inventory_count_sessions(tenant_id, id) on delete restrict,
  constraint os_inventory_count_variances_line_fk foreign key (tenant_id, count_line_id)
    references public.os_inventory_count_lines(tenant_id, id) on delete restrict,
  constraint os_inventory_count_variances_decider_fk foreign key (tenant_id, decided_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_count_variances_state_check check (
    (status = 'open' and decided_by is null and decided_at is null)
    or (status <> 'open' and decided_by is not null and decided_at is not null)
  ),
  unique (tenant_id, count_line_id)
);

-- Each legacy restock line receives one durable shortage episode. The episode,
-- not click count, is the demand input for allocation and procurement.
create table if not exists public.os_inventory_demand_episodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null,
  kit_id uuid,
  item_id uuid not null,
  variant_id uuid,
  originating_request_id uuid,
  originating_line_id uuid,
  reason_code text not null,
  validated_quantity numeric(14,3) not null check (validated_quantity > 0),
  need_by timestamptz,
  status text not null default 'submitted' check (status in (
    'submitted', 'triaged', 'approved', 'partial', 'denied', 'cancelled',
    'allocated', 'awaiting_purchase', 'picking', 'in_transit', 'ready_pickup',
    'received', 'disputed', 'closed'
  )),
  version integer not null default 1 check (version > 0),
  closed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_demand_episodes_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_demand_episodes_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_episodes_kit_fk foreign key (tenant_id, kit_id)
    references public.os_inventory_kits(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_episodes_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_episodes_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_episodes_request_fk foreign key (tenant_id, originating_request_id)
    references public.os_inventory_restock_requests(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_episodes_line_fk foreign key (tenant_id, originating_line_id)
    references public.os_inventory_restock_request_lines(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_episodes_close_check check (
    (status = 'closed' and closed_at is not null) or (status <> 'closed' and closed_at is null)
  )
);
create unique index if not exists os_inventory_demand_episode_open_uidx
  on public.os_inventory_demand_episodes (
    tenant_id, location_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where status not in ('denied', 'cancelled', 'closed');

create table if not exists public.os_inventory_demand_origins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demand_episode_id uuid not null,
  restock_request_id uuid not null,
  restock_request_line_id uuid not null,
  requested_quantity numeric(14,3) not null check (requested_quantity > 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_demand_origins_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_demand_origins_episode_fk foreign key (tenant_id, demand_episode_id)
    references public.os_inventory_demand_episodes(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_origins_request_fk foreign key (tenant_id, restock_request_id)
    references public.os_inventory_restock_requests(tenant_id, id) on delete restrict,
  constraint os_inventory_demand_origins_line_fk foreign key (tenant_id, restock_request_line_id)
    references public.os_inventory_restock_request_lines(tenant_id, id) on delete restrict,
  unique (tenant_id, restock_request_line_id)
);

insert into public.os_inventory_demand_episodes (
  tenant_id, location_id, kit_id, item_id, variant_id,
  originating_request_id, originating_line_id, reason_code,
  validated_quantity, status, closed_at, created_at, updated_at
)
select
  request.tenant_id, request.location_id, kit.id, line.item_id, line.variant_id,
  request.id, line.id, request.reason_code, line.requested_quantity,
  case request.status
    when 'requested' then 'submitted'
    when 'approved' then 'approved'
    when 'packing' then 'picking'
    when 'fulfilled' then 'closed'
    when 'rejected' then 'denied'
    when 'cancelled' then 'cancelled'
    else 'submitted'
  end,
  case when request.status = 'fulfilled' then request.fulfilled_at else null end,
  request.requested_at, coalesce(request.fulfilled_at, request.requested_at)
from public.os_inventory_restock_requests request
join public.os_inventory_restock_request_lines line
  on line.tenant_id = request.tenant_id and line.restock_request_id = request.id
left join public.os_inventory_kits kit
  on kit.tenant_id = request.tenant_id and kit.location_id = request.location_id
on conflict (tenant_id, location_id, item_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status not in ('denied', 'cancelled', 'closed') do nothing;

insert into public.os_inventory_demand_origins (
  tenant_id, demand_episode_id, restock_request_id, restock_request_line_id,
  requested_quantity, created_at
)
select
  line.tenant_id, episode.id, request.id, line.id, line.requested_quantity,
  request.requested_at
from public.os_inventory_restock_requests request
join public.os_inventory_restock_request_lines line
  on line.tenant_id = request.tenant_id and line.restock_request_id = request.id
join public.os_inventory_demand_episodes episode
  on episode.tenant_id = request.tenant_id
  and (
    episode.originating_line_id = line.id
    or (
      episode.location_id = request.location_id
      and episode.item_id = line.item_id
      and episode.variant_id is not distinct from line.variant_id
      and episode.status not in ('denied', 'cancelled', 'closed')
    )
  )
on conflict (tenant_id, restock_request_line_id) do nothing;

create table if not exists public.os_inventory_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exception_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  entity_type text not null,
  entity_id uuid,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  reason_code text not null,
  evidence jsonb not null default '{}'::jsonb,
  owner_profile_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_exceptions_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_exceptions_owner_fk foreign key (tenant_id, owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_exceptions_resolver_fk foreign key (tenant_id, resolved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_exceptions_resolution_check check (
    (status in ('resolved', 'dismissed') and resolved_by is not null and resolved_at is not null)
    or (status in ('open', 'investigating') and resolved_at is null)
  )
);

-- Controlled supplier catalog and procurement evidence. Supplier payloads are
-- structured and PHI-free; credentials remain external secret references.
create table if not exists public.os_inventory_supplier_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  supplier_sku text not null,
  manufacturer text,
  pack_uom text not null,
  units_per_pack numeric(14,3) not null check (units_per_pack > 0),
  minimum_order_packs numeric(14,3) not null default 1 check (minimum_order_packs > 0),
  order_multiple_packs numeric(14,3) not null default 1 check (order_multiple_packs > 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  price_effective_at timestamptz not null,
  price_expires_at timestamptz not null,
  substitution_policy text not null default 'prohibited' check (substitution_policy in ('prohibited', 'clinical_preapproved')),
  automation_eligible boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paused', 'retired')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_supplier_items_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_supplier_items_vendor_fk foreign key (tenant_id, vendor_id)
    references public.os_inventory_vendors(tenant_id, id) on delete restrict,
  constraint os_inventory_supplier_items_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_supplier_items_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint os_inventory_supplier_items_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_supplier_items_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_supplier_items_approval_check check (
    status <> 'approved' or (approved_by is not null and approved_at is not null and price_expires_at > price_effective_at)
  ),
  unique (tenant_id, vendor_id, supplier_sku)
);

create table if not exists public.os_inventory_requisitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requisition_number text not null,
  source text not null check (source in ('admin', 'a1_agent')),
  status text not null default 'draft' check (status in (
    'draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'converted', 'expired'
  )),
  calculation_trace jsonb not null,
  calculation_hash text not null check (calculation_hash ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version > 0),
  created_by uuid,
  submitted_by uuid,
  approved_by uuid,
  submitted_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_requisitions_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_requisitions_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_requisitions_submitter_fk foreign key (tenant_id, submitted_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_requisitions_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_requisitions_approval_check check (
    status <> 'approved' or (approved_by is not null and approved_at is not null and approved_by is distinct from created_by)
  ),
  unique (tenant_id, requisition_number)
);

create table if not exists public.os_inventory_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requisition_id uuid not null,
  demand_episode_id uuid,
  supplier_item_id uuid,
  item_id uuid not null,
  variant_id uuid,
  net_need numeric(14,3) not null check (net_need > 0),
  order_packs numeric(14,3) not null check (order_packs > 0),
  units_per_pack numeric(14,3) not null check (units_per_pack > 0),
  proposed_unit_price_cents bigint,
  need_by timestamptz,
  trace jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_requisition_lines_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_requisition_lines_requisition_fk foreign key (tenant_id, requisition_id)
    references public.os_inventory_requisitions(tenant_id, id) on delete restrict,
  constraint os_inventory_requisition_lines_demand_fk foreign key (tenant_id, demand_episode_id)
    references public.os_inventory_demand_episodes(tenant_id, id) on delete restrict,
  constraint os_inventory_requisition_lines_supplier_item_fk foreign key (tenant_id, supplier_item_id)
    references public.os_inventory_supplier_items(tenant_id, id) on delete restrict,
  constraint os_inventory_requisition_lines_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_requisition_lines_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict
);

alter table public.os_purchase_orders
  add column if not exists requisition_id uuid,
  add column if not exists payload jsonb,
  add column if not exists payload_hash text,
  add column if not exists approved_payload_hash text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists ship_to_location_id uuid;

alter table public.os_purchase_orders drop constraint if exists os_purchase_orders_status_check;
alter table public.os_purchase_orders add constraint os_purchase_orders_status_check check (status in (
  'draft', 'submitted', 'pending_approval', 'approved', 'sending', 'sent', 'acknowledged',
  'partially_received', 'received', 'closed', 'failed', 'unknown_external_state',
  'exception', 'cancelled'
));
alter table public.os_purchase_orders drop constraint if exists os_purchase_orders_payload_hash_check;
alter table public.os_purchase_orders add constraint os_purchase_orders_payload_hash_check check (
  (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$')
  and (approved_payload_hash is null or approved_payload_hash ~ '^[0-9a-f]{64}$')
  and (approved_payload_hash is null or approved_payload_hash = payload_hash)
  and (status not in ('approved', 'sending', 'sent', 'acknowledged', 'partially_received', 'received', 'closed')
    or (approved_by is not null and approved_at is not null and approved_payload_hash is not null))
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.os_purchase_orders'::regclass and conname='os_purchase_orders_requisition_fk') then
    alter table public.os_purchase_orders add constraint os_purchase_orders_requisition_fk
      foreign key (tenant_id, requisition_id)
      references public.os_inventory_requisitions(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.os_purchase_orders'::regclass and conname='os_purchase_orders_approver_fk') then
    alter table public.os_purchase_orders add constraint os_purchase_orders_approver_fk
      foreign key (tenant_id, approved_by)
      references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.os_purchase_orders'::regclass and conname='os_purchase_orders_ship_to_fk') then
    alter table public.os_purchase_orders add constraint os_purchase_orders_ship_to_fk
      foreign key (tenant_id, ship_to_location_id)
      references public.os_inventory_locations(tenant_id, id) on delete restrict;
  end if;
end $$;

create table if not exists public.os_purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null,
  event_type text not null check (event_type in (
    'created', 'submitted', 'approved', 'manual_exported', 'manual_sent',
    'acknowledged', 'rejected', 'partial_fill', 'backordered', 'shipped',
    'delivery', 'cancel_requested', 'cancelled', 'failed',
    'unknown_external_state', 'reconciled', 'receipt_posted', 'closed'
  )),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  correlation_id text not null,
  external_order_id text,
  evidence jsonb not null default '{}'::jsonb,
  actor_profile_id uuid,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_purchase_order_events_tenant_id_id_key unique (tenant_id, id),
  constraint os_purchase_order_events_po_fk foreign key (tenant_id, purchase_order_id)
    references public.os_purchase_orders(tenant_id, id) on delete restrict,
  constraint os_purchase_order_events_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict
);

create table if not exists public.os_purchase_order_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null,
  adapter_key text not null,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_hash text check (response_hash is null or response_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('prepared', 'manual_exported', 'sent', 'failed', 'unknown_external_state', 'reconciled')),
  external_order_id text,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  reconciled_at timestamptz,
  constraint os_purchase_order_execution_attempts_tenant_id_id_key unique (tenant_id, id),
  constraint os_purchase_order_execution_attempts_po_fk foreign key (tenant_id, purchase_order_id)
    references public.os_purchase_orders(tenant_id, id) on delete restrict,
  constraint os_purchase_order_execution_attempts_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, adapter_key, idempotency_key)
);

create table if not exists public.os_inventory_receiving_inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null,
  location_id uuid not null,
  status text not null default 'inspection' check (status in (
    'draft', 'inspection', 'accepted', 'partial', 'quarantined', 'rejected', 'posted', 'reconciled'
  )),
  condition_code text,
  temperature_evidence jsonb,
  version integer not null default 1 check (version > 0),
  inspected_by uuid not null,
  posted_by uuid,
  inspected_at timestamptz not null default clock_timestamp(),
  posted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_receiving_inspections_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_receiving_inspections_po_fk foreign key (tenant_id, purchase_order_id)
    references public.os_purchase_orders(tenant_id, id) on delete restrict,
  constraint os_inventory_receiving_inspections_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_receiving_inspections_inspector_fk foreign key (tenant_id, inspected_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_receiving_inspections_poster_fk foreign key (tenant_id, posted_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_receiving_inspections_post_check check (
    status not in ('posted', 'reconciled') or (posted_by is not null and posted_at is not null)
  )
);

create table if not exists public.os_inventory_receiving_inspection_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inspection_id uuid not null,
  purchase_order_line_id uuid not null,
  lot_id uuid,
  quantity_received numeric(14,3) not null check (quantity_received >= 0),
  quantity_accepted numeric(14,3) not null check (quantity_accepted >= 0 and quantity_accepted <= quantity_received),
  disposition text not null check (disposition in ('accepted', 'quarantine', 'rejected', 'backorder')),
  variance_code text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_receiving_lines_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_receiving_lines_inspection_fk foreign key (tenant_id, inspection_id)
    references public.os_inventory_receiving_inspections(tenant_id, id) on delete restrict,
  constraint os_inventory_receiving_lines_po_line_fk foreign key (tenant_id, purchase_order_line_id)
    references public.os_purchase_order_lines(tenant_id, id) on delete restrict,
  constraint os_inventory_receiving_lines_lot_fk foreign key (tenant_id, lot_id)
    references public.os_inventory_lots(tenant_id, id) on delete restrict
);

create table if not exists public.os_inventory_agent_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requisition_id uuid,
  status text not null default 'generated' check (status in (
    'generated', 'awaiting_authority', 'rejected', 'held', 'expired', 'superseded', 'draft_created'
  )),
  agent_level text not null default 'A1' check (agent_level = 'A1'),
  evaluator_version text not null,
  policy_version text not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  explanation jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  constraint os_inventory_agent_proposals_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_agent_proposals_requisition_fk foreign key (tenant_id, requisition_id)
    references public.os_inventory_requisitions(tenant_id, id) on delete restrict
);

create table if not exists public.os_inventory_agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proposal_id uuid not null,
  rule_code text not null,
  outcome text not null check (outcome in ('pass', 'fail', 'hold')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_agent_evaluations_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_agent_evaluations_proposal_fk foreign key (tenant_id, proposal_id)
    references public.os_inventory_agent_proposals(tenant_id, id) on delete restrict,
  unique (tenant_id, proposal_id, rule_code)
);

create table if not exists public.os_inventory_automation_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  scope_type text not null check (scope_type in ('global', 'tenant', 'location', 'vendor', 'category', 'sku', 'adapter')),
  scope_id text not null,
  execution_enabled boolean not null default false,
  a1_drafts_enabled boolean not null default false,
  kill_switch boolean not null default true,
  version integer not null default 1 check (version > 0),
  changed_by uuid not null,
  reason_code text not null,
  effective_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_automation_controls_tenant_id_id_key unique (tenant_id, id),
  constraint os_inventory_automation_controls_actor_fk foreign key (tenant_id, changed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_automation_controls_expiry_check check (expires_at is null or expires_at > effective_at),
  unique (tenant_id, scope_type, scope_id, version)
);

create table if not exists public.os_inventory_procurement_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  budget_remaining_cents bigint not null check (budget_remaining_cents >= 0),
  max_order_total_cents bigint not null check (max_order_total_cents >= 0),
  max_units_per_line numeric(14,3) not null check (max_units_per_line > 0),
  max_lead_time_days integer not null check (max_lead_time_days >= 0),
  expiry_risk_days integer not null default 7 check (expiry_risk_days >= 0),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  effective_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_procurement_policies_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_procurement_policies_creator_fk foreign key (tenant_id,created_by)
    references public.profiles(tenant_id,id) on delete restrict,
  constraint os_inventory_procurement_policies_approver_fk foreign key (tenant_id,approved_by)
    references public.profiles(tenant_id,id) on delete restrict,
  constraint os_inventory_procurement_policies_approval_check check (
    status<>'approved' or (approved_by is not null and approved_at is not null and approved_by<>created_by)
  ),
  constraint os_inventory_procurement_policies_expiry_check check (expires_at is null or expires_at>effective_at),
  unique (tenant_id,version)
);

-- Append-only evidence tables may be corrected only by new records.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'os_inventory_handoff_lines', 'os_inventory_demand_origins',
    'os_purchase_order_events', 'os_purchase_order_execution_attempts',
    'os_inventory_receiving_inspection_lines', 'os_inventory_agent_proposals',
    'os_inventory_agent_evaluations', 'os_inventory_automation_controls',
    'os_inventory_procurement_policies'
  ] loop
    execute format('drop trigger if exists %I_immutable on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_immutable before update or delete on public.%I for each row execute function app_private.prevent_os_append_only_mutation()',
      v_table, v_table
    );
  end loop;
end $$;

-- Availability is derived from the movement ledger plus active reservations
-- and committed inbound quantities. It is never a directly edited balance.
create or replace view public.os_inventory_availability
with (security_invoker = true)
as
with active_reservations as (
  select
    tenant_id, location_id, item_id, variant_id, lot_id,
    sum(quantity)::numeric(14,3) as quantity_reserved
  from public.nurse_inventory_reservations
  where status in ('prepared', 'reserved') and expires_at > clock_timestamp()
  group by tenant_id, location_id, item_id, variant_id, lot_id
), inbound as (
  select
    po.tenant_id, po.ship_to_location_id as location_id,
    line.item_id, line.variant_id, null::uuid as lot_id,
    sum(line.quantity_ordered - line.quantity_received)::numeric(14,3) as quantity_on_order
  from public.os_purchase_orders po
  join public.os_purchase_order_lines line
    on line.tenant_id = po.tenant_id and line.purchase_order_id = po.id
  where po.status in ('approved', 'sending', 'sent', 'acknowledged', 'partially_received')
    and po.ship_to_location_id is not null
  group by po.tenant_id, po.ship_to_location_id, line.item_id, line.variant_id
), availability_keys as (
  select tenant_id,location_id,item_id,variant_id,lot_id
  from public.os_inventory_location_balances
  union
  select tenant_id,location_id,item_id,variant_id,null::uuid as lot_id
  from inbound
)
select
  stock_key.tenant_id,
  stock_key.location_id,
  location.location_type,
  stock_key.item_id,
  stock_key.variant_id,
  stock_key.lot_id,
  coalesce(balance.quantity_on_hand,0)::numeric(14,3) as quantity_on_hand,
  case
    when location.location_type = 'in_transit' then 0
    when location.location_type = 'quarantine' then 0
    when coalesce(lot.disposition_status, 'available') <> 'available' then 0
    when lot.expires_on is not null and lot.expires_on < current_date then 0
    else greatest(coalesce(balance.quantity_on_hand,0), 0)
  end::numeric(14,3) as quantity_usable,
  coalesce(reservation.quantity_reserved, 0)::numeric(14,3) as quantity_reserved,
  greatest(
    case
      when location.location_type in ('in_transit', 'quarantine') then 0
      when coalesce(lot.disposition_status, 'available') <> 'available' then 0
      when lot.expires_on is not null and lot.expires_on < current_date then 0
      else coalesce(balance.quantity_on_hand,0)
    end - coalesce(reservation.quantity_reserved, 0),
    0
  )::numeric(14,3) as quantity_available,
  case when location.location_type = 'in_transit' then greatest(coalesce(balance.quantity_on_hand,0), 0) else 0 end::numeric(14,3) as quantity_in_transit,
  coalesce(inbound.quantity_on_order, 0)::numeric(14,3) as quantity_on_order,
  case when location.location_type = 'quarantine' or coalesce(lot.disposition_status, 'available') = 'quarantine' then greatest(coalesce(balance.quantity_on_hand,0), 0) else 0 end::numeric(14,3) as quantity_quarantined,
  case when coalesce(lot.disposition_status, 'available') = 'recalled' then greatest(coalesce(balance.quantity_on_hand,0), 0) else 0 end::numeric(14,3) as quantity_recalled,
  case when coalesce(lot.disposition_status, 'available') = 'expired' or (lot.expires_on is not null and lot.expires_on < current_date) then greatest(coalesce(balance.quantity_on_hand,0), 0) else 0 end::numeric(14,3) as quantity_expired,
  case when location.location_type='quarantine' and exists (
    select 1 from public.os_inventory_receiving_inspection_lines damaged_line
    join public.os_inventory_receiving_inspections damaged_inspection
      on damaged_inspection.tenant_id=damaged_line.tenant_id and damaged_inspection.id=damaged_line.inspection_id
    where damaged_line.tenant_id=stock_key.tenant_id and damaged_line.lot_id=stock_key.lot_id
      and (damaged_line.variance_code like '%DAMAG%' or damaged_inspection.condition_code like '%DAMAG%')
  ) then greatest(coalesce(balance.quantity_on_hand,0),0) else 0 end::numeric(14,3) as quantity_damaged,
  case when location.location_type='quarantine' and exists (
    select 1 from public.os_inventory_handoff_lines disputed_line
    join public.os_inventory_handoffs disputed_handoff
      on disputed_handoff.tenant_id=disputed_line.tenant_id and disputed_handoff.id=disputed_line.handoff_id
    where disputed_line.tenant_id=stock_key.tenant_id and disputed_line.item_id=stock_key.item_id
      and disputed_line.variant_id is not distinct from stock_key.variant_id
      and disputed_line.lot_id is not distinct from stock_key.lot_id
      and disputed_handoff.status in ('disputed','quarantined')
  ) then greatest(coalesce(balance.quantity_on_hand,0),0) else 0 end::numeric(14,3) as quantity_disputed,
  balance.last_movement_at
from availability_keys stock_key
left join public.os_inventory_location_balances balance
  on balance.tenant_id=stock_key.tenant_id and balance.location_id=stock_key.location_id
  and balance.item_id=stock_key.item_id and balance.variant_id is not distinct from stock_key.variant_id
  and balance.lot_id is not distinct from stock_key.lot_id
join public.os_inventory_locations location
  on location.tenant_id = stock_key.tenant_id and location.id = stock_key.location_id
left join public.os_inventory_lots lot
  on lot.tenant_id = stock_key.tenant_id and lot.id = stock_key.lot_id
left join active_reservations reservation
  on reservation.tenant_id = stock_key.tenant_id
  and reservation.location_id = stock_key.location_id
  and reservation.item_id = stock_key.item_id
  and reservation.variant_id is not distinct from stock_key.variant_id
  and reservation.lot_id is not distinct from stock_key.lot_id
left join inbound
  on inbound.tenant_id = stock_key.tenant_id
  and inbound.location_id = stock_key.location_id
  and inbound.item_id = stock_key.item_id
  and inbound.variant_id is not distinct from stock_key.variant_id
  and stock_key.lot_id is null;

-- RLS is defense in depth; application access remains through server APIs and
-- service-role-only functions.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'os_inventory_kits', 'os_inventory_role_assignments',
    'os_inventory_handoffs', 'os_inventory_handoff_lines',
    'os_inventory_count_sessions', 'os_inventory_count_lines',
    'os_inventory_count_variances', 'os_inventory_demand_episodes',
    'os_inventory_demand_origins',
    'os_inventory_exceptions', 'os_inventory_supplier_items',
    'os_inventory_requisitions', 'os_inventory_requisition_lines',
    'os_purchase_order_events', 'os_purchase_order_execution_attempts',
    'os_inventory_receiving_inspections', 'os_inventory_receiving_inspection_lines',
    'os_inventory_agent_proposals', 'os_inventory_agent_evaluations',
    'os_inventory_automation_controls', 'os_inventory_procurement_policies'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

revoke all on public.os_inventory_availability from public, anon, authenticated;
grant select on public.os_inventory_availability to service_role;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'os_inventory_kits', 'os_inventory_handoffs', 'os_inventory_count_sessions',
    'os_inventory_demand_episodes', 'os_inventory_exceptions',
    'os_inventory_supplier_items', 'os_inventory_requisitions',
    'os_inventory_receiving_inspections'
  ] loop
    execute format('drop trigger if exists touch_%I_updated_at on public.%I', v_table, v_table);
    execute format('create trigger touch_%I_updated_at before update on public.%I for each row execute function public.touch_updated_at()', v_table, v_table);
  end loop;
end $$;

comment on view public.os_inventory_availability is
  'Canonical derived availability: on hand is distinct from usable, reserved, available, in transit, on order, quarantined, recalled, and expired.';
comment on table public.os_inventory_agent_proposals is
  'A1 draft-only evidence. This table grants no supplier-contact, PO approval, invoice approval, or payment authority.';

commit;
