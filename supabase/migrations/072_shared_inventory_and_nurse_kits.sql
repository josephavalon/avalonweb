-- Shared typed inventory and nurse-kit custody.
--
-- Admins receive the full inventory workspace. Nurses receive only the stock
-- assigned to their own kit location, with cost, vendor, purchase-order, and
-- other nurses' data excluded at the API boundary. All quantity changes remain
-- append-only stock transactions; corrections are new movements, never edits.

do $$
begin
  if to_regclass('public.os_inventory_items') is null
     or to_regclass('public.os_stock_transactions') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.provider_profiles') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('app_private.prevent_os_append_only_mutation()') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'avalon_os_inventory_migration_required';
  end if;
end $$;

create table if not exists public.os_inventory_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_type text not null check (location_type in ('central', 'warehouse', 'nurse_kit', 'event_kit', 'vehicle', 'quarantine')),
  location_code text not null check (location_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  name text not null check (char_length(name) between 1 and 120),
  nurse_profile_id uuid,
  status text not null default 'active' check (status in ('active', 'hold', 'retired')),
  version integer not null default 1 check (version > 0),
  request_idempotency_key text not null
    check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_locations_nurse_fk foreign key (tenant_id, nurse_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_locations_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_locations_nurse_type_check check (
    (location_type = 'nurse_kit' and nurse_profile_id is not null)
    or (location_type <> 'nurse_kit' and nurse_profile_id is null)
  ),
  unique (tenant_id, location_code),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

create unique index if not exists os_inventory_locations_active_nurse_uidx
  on public.os_inventory_locations (tenant_id, nurse_profile_id)
  where location_type = 'nurse_kit' and status <> 'retired';

create unique index if not exists provider_profiles_tenant_id_id_uidx
  on public.provider_profiles (tenant_id, id);
create unique index if not exists os_inventory_vendors_tenant_id_id_uidx
  on public.os_inventory_vendors (tenant_id, id);
create unique index if not exists os_purchase_order_lines_tenant_id_id_uidx
  on public.os_purchase_order_lines (tenant_id, id);

do $$
begin
  if exists (
    select 1 from public.os_purchase_order_lines line
    where line.quantity_received > line.quantity_ordered
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_line_quantity_preflight_failed';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_purchase_order_lines'::regclass
      and conname = 'os_purchase_order_lines_received_lte_ordered_check'
  ) then
    alter table public.os_purchase_order_lines
      add constraint os_purchase_order_lines_received_lte_ordered_check
      check (quantity_received <= quantity_ordered);
  end if;
end $$;

create table if not exists public.os_inventory_location_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null,
  provider_profile_id uuid not null,
  nurse_profile_id uuid not null,
  assignment_status text not null default 'assigned'
    check (assignment_status in ('assigned', 'accepted', 'ended', 'revoked')),
  is_primary boolean not null default true,
  assigned_by uuid not null,
  assigned_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz,
  ended_at timestamptz,
  version integer not null default 1 check (version > 0),
  constraint os_inventory_assignment_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_assignment_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_assignment_nurse_fk foreign key (tenant_id, nurse_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_assignment_actor_fk foreign key (tenant_id, assigned_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, id)
);

create unique index if not exists os_inventory_assignment_active_location_uidx
  on public.os_inventory_location_assignments (tenant_id, location_id)
  where assignment_status in ('assigned', 'accepted');
create unique index if not exists os_inventory_assignment_active_primary_provider_uidx
  on public.os_inventory_location_assignments (tenant_id, provider_profile_id)
  where assignment_status in ('assigned', 'accepted') and is_primary;

alter table public.os_inventory_location_assignments
  drop constraint if exists os_inventory_assignment_state_timestamps_check;
alter table public.os_inventory_location_assignments
  add constraint os_inventory_assignment_state_timestamps_check check (
    (assignment_status = 'assigned' and accepted_at is null and ended_at is null)
    or (assignment_status = 'accepted' and accepted_at is not null and ended_at is null)
    or (assignment_status in ('ended', 'revoked') and ended_at is not null)
  );

create table if not exists public.os_inventory_location_par_levels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  par_quantity numeric(14, 3) not null check (par_quantity >= 0),
  reorder_quantity numeric(14, 3) not null check (reorder_quantity >= 0 and reorder_quantity <= par_quantity),
  version integer not null default 1 check (version > 0),
  updated_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_location_par_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete cascade,
  constraint os_inventory_location_par_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_location_par_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint os_inventory_location_par_updater_fk foreign key (tenant_id, updated_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, location_id, item_id, variant_id),
  unique (tenant_id, id)
);

create unique index if not exists os_inventory_location_par_key_uidx
  on public.os_inventory_location_par_levels (
    tenant_id, location_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

alter table public.os_stock_transactions
  add column if not exists from_location_id uuid,
  add column if not exists to_location_id uuid,
  add column if not exists transfer_group_id uuid,
  add column if not exists operation_request_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_stock_transactions'::regclass
      and conname = 'os_stock_transactions_from_location_fk'
  ) then
    alter table public.os_stock_transactions
      add constraint os_stock_transactions_from_location_fk
      foreign key (tenant_id, from_location_id)
      references public.os_inventory_locations(tenant_id, id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_stock_transactions'::regclass
      and conname = 'os_stock_transactions_to_location_fk'
  ) then
    alter table public.os_stock_transactions
      add constraint os_stock_transactions_to_location_fk
      foreign key (tenant_id, to_location_id)
      references public.os_inventory_locations(tenant_id, id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_stock_transactions'::regclass
      and conname = 'os_stock_transactions_location_distinct_check'
  ) then
    alter table public.os_stock_transactions
      add constraint os_stock_transactions_location_distinct_check
      check (from_location_id is null or to_location_id is null or from_location_id <> to_location_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_stock_transactions'::regclass
      and conname = 'os_stock_transactions_operation_hash_check'
  ) then
    alter table public.os_stock_transactions
      add constraint os_stock_transactions_operation_hash_check
      check (
        operation_request_hash is null
        or operation_request_hash ~ '^[0-9a-f]{64}$'
      );
  end if;
end $$;

-- Existing migration-043 movements predate custody locations and must remain
-- immutable. Create a truthful compatibility location per affected tenant;
-- the balance view below projects those historical rows into that location
-- without rewriting their append-only evidence.
with legacy_tenants as (
  select distinct movement.tenant_id
  from public.os_stock_transactions movement
  where movement.from_location_id is null and movement.to_location_id is null
), legacy_actors as (
  select
    legacy.tenant_id,
    coalesce(
      (
        select movement.created_by
        from public.os_stock_transactions movement
        join public.profiles profile
          on profile.tenant_id = movement.tenant_id and profile.id = movement.created_by
        where movement.tenant_id = legacy.tenant_id and movement.created_by is not null
        order by movement.created_at, movement.id
        limit 1
      ),
      (
        select profile.id
        from public.profiles profile
        where profile.tenant_id = legacy.tenant_id
        order by profile.id
        limit 1
      )
    ) as created_by
  from legacy_tenants legacy
)
insert into public.os_inventory_locations (
  tenant_id, location_type, location_code, name, nurse_profile_id,
  request_idempotency_key, request_hash, created_by
)
select
  actor.tenant_id,
  'warehouse',
  'LEGACY_UNASSIGNED',
  'Unassigned inventory',
  null,
  'inventory:legacy-unassigned:v1',
  encode(extensions.digest(jsonb_build_object(
    'tenant_id', actor.tenant_id,
    'location_type', 'warehouse',
    'location_code', 'LEGACY_UNASSIGNED',
    'name', 'Unassigned inventory',
    'nurse_profile_id', null
  )::text, 'sha256'), 'hex'),
  actor.created_by
from legacy_actors actor
where actor.created_by is not null
on conflict (tenant_id, location_code) do nothing;

do $$
begin
  if exists (
    select 1
    from public.os_stock_transactions movement
    left join public.os_inventory_locations location
      on location.tenant_id = movement.tenant_id
      and location.location_code = 'LEGACY_UNASSIGNED'
    where movement.from_location_id is null
      and movement.to_location_id is null
      and (
        location.id is null
        or location.location_type <> 'warehouse'
        or location.name <> 'Unassigned inventory'
        or location.nurse_profile_id is not null
        or location.status <> 'active'
        or location.request_idempotency_key <> 'inventory:legacy-unassigned:v1'
        or location.request_hash <> encode(extensions.digest(jsonb_build_object(
          'tenant_id', movement.tenant_id,
          'location_type', 'warehouse',
          'location_code', 'LEGACY_UNASSIGNED',
          'name', 'Unassigned inventory',
          'nurse_profile_id', null
        )::text, 'sha256'), 'hex')
      )
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_legacy_location_preflight_failed';
  end if;
end $$;

create table if not exists public.os_inventory_restock_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null,
  nurse_profile_id uuid not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'packing', 'fulfilled', 'rejected', 'cancelled')),
  reason_code text not null check (reason_code in ('BELOW_PAR', 'UPCOMING_SHIFT', 'EXPIRED_REMOVAL', 'DAMAGED', 'COUNT_VARIANCE')),
  request_idempotency_key text not null
    check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default clock_timestamp(),
  fulfilled_at timestamptz,
  fulfilled_by uuid,
  fulfillment_reference text,
  fulfillment_transfer_group_id uuid,
  last_transition_reason_code text,
  version integer not null default 1 check (version > 0),
  constraint os_inventory_restock_location_fk foreign key (tenant_id, location_id)
    references public.os_inventory_locations(tenant_id, id) on delete restrict,
  constraint os_inventory_restock_nurse_fk foreign key (tenant_id, nurse_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_restock_fulfiller_fk foreign key (tenant_id, fulfilled_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint os_inventory_restock_fulfillment_check check (
    (
      status = 'fulfilled'
      and fulfilled_at is not null
      and fulfilled_by is not null
      and fulfillment_reference is not null
      and fulfillment_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,159}$'
      and fulfillment_transfer_group_id is not null
    ) or (
      status <> 'fulfilled'
      and fulfilled_at is null
      and fulfilled_by is null
      and fulfillment_reference is null
      and fulfillment_transfer_group_id is null
    )
  ),
  constraint os_inventory_restock_transition_reason_check check (
    last_transition_reason_code is null
    or last_transition_reason_code ~ '^[A-Z0-9_]{3,100}$'
  ),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

alter table public.os_inventory_restock_requests
  add column if not exists fulfillment_reference text,
  add column if not exists fulfillment_transfer_group_id uuid,
  add column if not exists last_transition_reason_code text;

alter table public.os_inventory_restock_requests
  drop constraint if exists os_inventory_restock_fulfillment_check;
alter table public.os_inventory_restock_requests
  add constraint os_inventory_restock_fulfillment_check check (
    (
      status = 'fulfilled'
      and fulfilled_at is not null
      and fulfilled_by is not null
      and fulfillment_reference is not null
      and fulfillment_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,159}$'
      and fulfillment_transfer_group_id is not null
    ) or (
      status <> 'fulfilled'
      and fulfilled_at is null
      and fulfilled_by is null
      and fulfillment_reference is null
      and fulfillment_transfer_group_id is null
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.os_inventory_restock_requests'::regclass
      and conname = 'os_inventory_restock_transition_reason_check'
  ) then
    alter table public.os_inventory_restock_requests
      add constraint os_inventory_restock_transition_reason_check check (
        last_transition_reason_code is null
        or last_transition_reason_code ~ '^[A-Z0-9_]{3,100}$'
      );
  end if;
end $$;

create table if not exists public.os_inventory_restock_request_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  restock_request_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  requested_quantity numeric(14, 3) not null check (requested_quantity > 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_restock_lines_request_fk foreign key (tenant_id, restock_request_id)
    references public.os_inventory_restock_requests(tenant_id, id) on delete restrict,
  constraint os_inventory_restock_lines_item_fk foreign key (tenant_id, item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint os_inventory_restock_lines_variant_fk foreign key (tenant_id, variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  unique (tenant_id, restock_request_id, item_id, variant_id),
  unique (tenant_id, id)
);

create unique index if not exists os_inventory_restock_line_key_uidx
  on public.os_inventory_restock_request_lines (
    tenant_id, restock_request_id, item_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

drop trigger if exists os_inventory_restock_request_lines_immutable
  on public.os_inventory_restock_request_lines;
create trigger os_inventory_restock_request_lines_immutable
  before update or delete on public.os_inventory_restock_request_lines
  for each row execute function app_private.prevent_os_append_only_mutation();

create table if not exists public.os_inventory_operation_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_name text not null,
  request_idempotency_key text not null
    check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  actor_profile_id uuid not null,
  result_entity_type text not null,
  result_entity_id uuid not null,
  result_version integer not null check (result_version > 0),
  response_payload jsonb not null check (jsonb_typeof(response_payload) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_operation_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, operation_name, request_idempotency_key),
  unique (tenant_id, id)
);

-- Keep the operation allowlist under an explicit, stable constraint name so
-- interrupted development installs cannot retain an older allowlist that
-- rejects a newer idempotent RPC at runtime.
alter table public.os_inventory_operation_requests
  drop constraint if exists os_inventory_operation_requests_operation_name_check;
alter table public.os_inventory_operation_requests
  drop constraint if exists os_inventory_operation_requests_name_check;
alter table public.os_inventory_operation_requests
  add constraint os_inventory_operation_requests_name_check check (operation_name in (
    'SET_PAR_LEVEL', 'TRANSITION_RESTOCK_REQUEST', 'ADMIN_INVENTORY_MOVEMENT',
    'FULFILL_RESTOCK_REQUEST', 'CREATE_INVENTORY_ITEM',
    'CREATE_INVENTORY_VARIANT', 'CREATE_INVENTORY_LOT',
    'CREATE_INVENTORY_VENDOR', 'CREATE_DRAFT_PURCHASE_ORDER',
    'CREATE_PURCHASE_ORDER_LINE', 'RECEIVE_PURCHASE_ORDER_LINE'
  ));

drop trigger if exists os_inventory_operation_requests_immutable
  on public.os_inventory_operation_requests;
create trigger os_inventory_operation_requests_immutable
  before update or delete on public.os_inventory_operation_requests
  for each row execute function app_private.prevent_os_append_only_mutation();

create index if not exists os_stock_transactions_from_location_idx
  on public.os_stock_transactions (tenant_id, from_location_id, occurred_at desc)
  where from_location_id is not null;
create index if not exists os_stock_transactions_to_location_idx
  on public.os_stock_transactions (tenant_id, to_location_id, occurred_at desc)
  where to_location_id is not null;
create index if not exists os_stock_transactions_transfer_group_idx
  on public.os_stock_transactions (tenant_id, transfer_group_id, occurred_at)
  where transfer_group_id is not null;
create index if not exists os_inventory_restock_open_idx
  on public.os_inventory_restock_requests (tenant_id, location_id, status, requested_at desc);

create or replace function app_private.guard_inventory_stock_location_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_compat_location public.os_inventory_locations%rowtype;
  v_lot public.os_inventory_lots%rowtype;
  v_variant public.os_inventory_variants%rowtype;
  v_to_location public.os_inventory_locations%rowtype;
  v_compat_hash text;
  v_available numeric(14, 3);
  v_canonical_unit_cost bigint := 0;
begin
  -- Migration 043's existing /api/os/v1 inventory writer does not send a
  -- location. Preserve that contract by routing those rows into an explicit
  -- Unassigned inventory location instead of failing the write or silently
  -- excluding it from custody balances. Location-aware APIs always send one
  -- side explicitly and do not enter this compatibility path.
  if new.from_location_id is null and new.to_location_id is null then
    if new.created_by is null or not exists (
      select 1 from public.profiles profile
      where profile.tenant_id = new.tenant_id and profile.id = new.created_by
    ) then
      raise exception using errcode = 'P0001', message = 'inventory_location_required';
    end if;

    v_compat_hash := encode(extensions.digest(jsonb_build_object(
      'tenant_id', new.tenant_id,
      'location_type', 'warehouse',
      'location_code', 'LEGACY_UNASSIGNED',
      'name', 'Unassigned inventory',
      'nurse_profile_id', null
    )::text, 'sha256'), 'hex');
    perform pg_advisory_xact_lock(hashtextextended(
      'inventory_compat_location:' || new.tenant_id::text,
      0
    ));

    select * into v_compat_location
    from public.os_inventory_locations location
    where location.tenant_id = new.tenant_id
      and location.location_code = 'LEGACY_UNASSIGNED';

    if not found then
      insert into public.os_inventory_locations (
        tenant_id, location_type, location_code, name, nurse_profile_id,
        request_idempotency_key, request_hash, created_by
      ) values (
        new.tenant_id, 'warehouse', 'LEGACY_UNASSIGNED', 'Unassigned inventory', null,
        'inventory:legacy-unassigned:v1', v_compat_hash, new.created_by
      )
      on conflict (tenant_id, location_code) do nothing;

      select * into v_compat_location
      from public.os_inventory_locations location
      where location.tenant_id = new.tenant_id
        and location.location_code = 'LEGACY_UNASSIGNED';
    end if;

    if v_compat_location.id is null
       or v_compat_location.location_type <> 'warehouse'
       or v_compat_location.name <> 'Unassigned inventory'
       or v_compat_location.nurse_profile_id is not null
       or v_compat_location.status <> 'active'
       or v_compat_location.request_idempotency_key <> 'inventory:legacy-unassigned:v1'
       or v_compat_location.request_hash <> v_compat_hash then
      raise exception using errcode = 'P0001', message = 'inventory_compatibility_location_conflict';
    end if;

    if new.transaction_type in ('receive', 'transfer_in')
       or (new.transaction_type = 'adjust' and new.quantity_delta > 0) then
      new.to_location_id := v_compat_location.id;
    elsif new.transaction_type in ('consume', 'expire', 'shrink', 'return', 'transfer_out')
       or (new.transaction_type = 'adjust' and new.quantity_delta < 0) then
      new.from_location_id := v_compat_location.id;
    else
      raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
    end if;
  end if;

  if new.transaction_type in ('transfer_in', 'transfer_out') then
    new.transfer_group_id := coalesce(new.transfer_group_id, gen_random_uuid());
  elsif new.transfer_group_id is not null then
    raise exception using errcode = 'P0001', message = 'inventory_transfer_group_invalid';
  end if;

  if (new.from_location_id is not null and not exists (
        select 1 from public.os_inventory_locations location
        where location.tenant_id = new.tenant_id
          and location.id = new.from_location_id
          and location.status = 'active'
      )) or (new.to_location_id is not null and not exists (
        select 1 from public.os_inventory_locations location
        where location.tenant_id = new.tenant_id
          and location.id = new.to_location_id
          and location.status = 'active'
      )) then
    raise exception using errcode = 'P0001', message = 'inventory_location_not_active';
  end if;

  if not exists (
    select 1 from public.os_inventory_items item
    where item.tenant_id = new.tenant_id
      and item.id = new.item_id
      and item.archived_at is null
  ) or (new.variant_id is not null and not exists (
    select 1 from public.os_inventory_variants variant
    where variant.tenant_id = new.tenant_id
      and variant.id = new.variant_id
      and variant.item_id = new.item_id
      and variant.archived_at is null
  )) or (new.lot_id is not null and not exists (
    select 1 from public.os_inventory_lots lot
    where lot.tenant_id = new.tenant_id
      and lot.id = new.lot_id
      and lot.item_id = new.item_id
      and lot.variant_id is not distinct from new.variant_id
  )) then
    raise exception using errcode = 'P0001', message = 'inventory_item_context_invalid';
  end if;

  if new.lot_id is not null then
    select * into strict v_lot
    from public.os_inventory_lots lot
    where lot.tenant_id = new.tenant_id
      and lot.id = new.lot_id
      and lot.item_id = new.item_id
      and lot.variant_id is not distinct from new.variant_id;
    if new.variant_id is not null then
      select * into strict v_variant
      from public.os_inventory_variants variant
      where variant.tenant_id = new.tenant_id
        and variant.id = new.variant_id
        and variant.item_id = new.item_id
        and variant.archived_at is null;
    end if;
    v_canonical_unit_cost := coalesce(
      nullif(v_lot.unit_cost_cents, 0),
      nullif(v_variant.unit_cost_cents, 0),
      0
    );
    if nullif(new.unit_cost_cents, 0) is not null
       and new.unit_cost_cents <> v_canonical_unit_cost then
      raise exception using errcode = '22023', message = 'inventory_stock_unit_cost_mismatch';
    end if;
    new.unit_cost_cents := nullif(v_canonical_unit_cost, 0);
  else
    if nullif(new.unit_cost_cents, 0) is not null then
      raise exception using errcode = 'P0001', message = 'inventory_costed_stock_lot_required';
    end if;
    -- Historical no-lot rows stay immutable, but every new no-lot movement is
    -- explicitly uncosted. Finance must never revive their old snapshots.
    new.unit_cost_cents := null;
  end if;

  if new.lot_id is not null
     and v_lot.expires_on < current_date
     and new.transaction_type = 'consume' then
    raise exception using errcode = 'P0001', message = 'inventory_expired_lot_consumption_prohibited';
  end if;

  if new.to_location_id is not null then
    select * into strict v_to_location
    from public.os_inventory_locations location
    where location.tenant_id = new.tenant_id
      and location.id = new.to_location_id
      and location.status = 'active';
    if new.lot_id is not null
       and v_lot.expires_on < current_date
       and v_to_location.location_type in ('nurse_kit', 'event_kit', 'vehicle') then
      raise exception using errcode = 'P0001', message = 'inventory_expired_lot_care_transfer_prohibited';
    end if;
    if v_to_location.location_type = 'nurse_kit' and not exists (
      select 1
      from public.os_inventory_location_assignments assignment
      join public.provider_profiles provider
        on provider.tenant_id = assignment.tenant_id
        and provider.id = assignment.provider_profile_id
      join public.profiles profile
        on profile.tenant_id = assignment.tenant_id
        and profile.id = assignment.nurse_profile_id
      where assignment.tenant_id = new.tenant_id
        and assignment.location_id = v_to_location.id
        and assignment.nurse_profile_id = v_to_location.nurse_profile_id
        and assignment.assignment_status = 'accepted'
        and assignment.accepted_at is not null
        and assignment.ended_at is null
        and assignment.is_primary
        and provider.profile_id = assignment.nurse_profile_id
        and provider.provider_role in ('rn', 'np')
        and provider.active
        and profile.status = 'active'
        and profile.role in ('nurse', 'rn', 'np')
    ) then
      raise exception using errcode = '42501', message = 'nurse_kit_active_custody_required';
    end if;
  end if;

  if new.transaction_type in ('receive', 'transfer_in') and (
       new.quantity_delta <= 0 or new.to_location_id is null or new.from_location_id is not null
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
  elsif new.transaction_type in ('consume', 'expire', 'shrink', 'return', 'transfer_out') and (
       new.quantity_delta >= 0 or new.from_location_id is null or new.to_location_id is not null
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
  elsif new.transaction_type = 'adjust' and (
       (new.quantity_delta > 0 and (new.to_location_id is null or new.from_location_id is not null))
       or (new.quantity_delta < 0 and (new.from_location_id is null or new.to_location_id is not null))
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
  end if;

  if new.quantity_delta < 0 then
    -- All decrement paths, including the compatibility API, share this lock.
    -- That prevents two different request keys from both spending the same
    -- on-hand quantity after independently reading an old balance.
    perform pg_advisory_xact_lock(hashtextextended(
      'inventory_balance:' || new.tenant_id::text || ':'
        || new.from_location_id::text || ':' || new.item_id::text || ':'
        || coalesce(new.variant_id::text, '-') || ':'
        || coalesce(new.lot_id::text, '-'),
      0
    ));
    select coalesce(sum(balance.quantity_on_hand), 0) into v_available
    from public.os_inventory_location_balances balance
    where balance.tenant_id = new.tenant_id
      and balance.location_id = new.from_location_id
      and balance.item_id = new.item_id
      and balance.variant_id is not distinct from new.variant_id
      and balance.lot_id is not distinct from new.lot_id;
    if v_available < abs(new.quantity_delta) then
      raise exception using errcode = 'P0001', message = 'inventory_quantity_unavailable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_inventory_stock_location_insert()
  from public, anon, authenticated, service_role;

drop trigger if exists os_stock_transactions_location_guard on public.os_stock_transactions;
create trigger os_stock_transactions_location_guard
  before insert on public.os_stock_transactions
  for each row execute function app_private.guard_inventory_stock_location_insert();

create or replace view public.os_inventory_location_balances
with (security_invoker = true)
as
with raw_movement_lines as (
  select
    movement.tenant_id,
    movement.to_location_id as location_id,
    movement.item_id,
    movement.variant_id,
    movement.lot_id,
    movement.quantity_delta,
    movement.unit_cost_cents,
    movement.occurred_at,
    movement.created_at,
    movement.id as movement_id
  from public.os_stock_transactions movement
  where movement.to_location_id is not null and movement.quantity_delta > 0
  union all
  select
    movement.tenant_id,
    movement.from_location_id as location_id,
    movement.item_id,
    movement.variant_id,
    movement.lot_id,
    movement.quantity_delta,
    movement.unit_cost_cents,
    movement.occurred_at,
    movement.created_at,
    movement.id as movement_id
  from public.os_stock_transactions movement
  where movement.from_location_id is not null and movement.quantity_delta < 0
  union all
  select
    movement.tenant_id,
    location.id as location_id,
    movement.item_id,
    movement.variant_id,
    movement.lot_id,
    movement.quantity_delta,
    movement.unit_cost_cents,
    movement.occurred_at,
    movement.created_at,
    movement.id as movement_id
  from public.os_stock_transactions movement
  join public.os_inventory_locations location
    on location.tenant_id = movement.tenant_id
    and location.location_code = 'LEGACY_UNASSIGNED'
    and location.location_type = 'warehouse'
  where movement.from_location_id is null
    and movement.to_location_id is null
), movement_lines as (
  select
    line.tenant_id,
    line.location_id,
    line.item_id,
    coalesce(line.variant_id, lot.variant_id) as variant_id,
    line.lot_id,
    line.quantity_delta,
    line.occurred_at
  from raw_movement_lines line
  left join public.os_inventory_lots lot
    on lot.tenant_id = line.tenant_id
    and lot.id = line.lot_id
    and lot.item_id = line.item_id
), location_totals as (
  select
    line.tenant_id,
    line.location_id,
    line.item_id,
    line.variant_id,
    line.lot_id,
    sum(line.quantity_delta)::numeric(14, 3) as quantity_on_hand,
    max(line.occurred_at) as last_movement_at
  from movement_lines line
  group by line.tenant_id, line.location_id, line.item_id, line.variant_id, line.lot_id
)
select
  balance.tenant_id,
  balance.location_id,
  balance.item_id,
  balance.variant_id,
  balance.lot_id,
  balance.quantity_on_hand,
  balance.last_movement_at,
  case when balance.lot_id is not null then coalesce(
      nullif(lot.unit_cost_cents, 0),
      nullif(variant.unit_cost_cents, 0),
      0
    ) else 0 end::bigint as unit_cost_cents
from location_totals balance
left join public.os_inventory_lots lot
  on lot.tenant_id = balance.tenant_id
  and lot.id = balance.lot_id
  and lot.item_id = balance.item_id
left join public.os_inventory_variants variant
  on variant.tenant_id = balance.tenant_id
  and variant.id = coalesce(balance.variant_id, lot.variant_id)
  and variant.item_id = balance.item_id;

create or replace function app_private.inventory_location_has_positive_cost(
  p_tenant_id uuid,
  p_location_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_lot_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_lot_id is not null and exists (
    select 1
    from public.os_inventory_location_balances balance
    where balance.tenant_id = p_tenant_id
      and balance.location_id = p_location_id
      and balance.item_id = p_item_id
      and balance.variant_id is not distinct from p_variant_id
      and balance.lot_id = p_lot_id
      and balance.quantity_on_hand > 0
      and balance.unit_cost_cents > 0
  );
$$;

revoke all on function app_private.inventory_location_has_positive_cost(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- A lot identifies the acquisition cohort. Movement, lot, and variant costs
-- are finance-ready only inside that lot boundary; anonymous stock is uncosted.
create or replace view public.os_inventory_balances
with (security_invoker = true)
as
select
  item.tenant_id,
  item.id as item_id,
  item.name,
  item.sku,
  item.reorder_point,
  coalesce(sum(movement.quantity_delta), 0)::numeric(14, 3) as quantity_on_hand,
  coalesce(sum(round(
    movement.quantity_delta * case when movement.lot_id is not null then coalesce(
      nullif(lot.unit_cost_cents, 0),
      nullif(variant.unit_cost_cents, 0),
      0
    ) else 0 end
  )), 0)::bigint as inventory_value_cents
from public.os_inventory_items item
left join public.os_stock_transactions movement
  on movement.item_id = item.id and movement.tenant_id = item.tenant_id
left join public.os_inventory_lots lot
  on lot.id = movement.lot_id and lot.tenant_id = item.tenant_id
left join public.os_inventory_variants variant
  on variant.id = coalesce(movement.variant_id, lot.variant_id)
  and variant.item_id = item.id
  and variant.tenant_id = item.tenant_id
where item.archived_at is null
group by item.tenant_id, item.id, item.name, item.sku, item.reorder_point;

create or replace function app_private.assert_inventory_admin(
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
    select 1 from public.profiles profile
    where profile.tenant_id = p_tenant_id
      and profile.id = p_actor_profile_id
      and profile.status = 'active'
      and profile.role in ('admin', 'founder')
  ) then
    raise exception using errcode = '42501', message = 'inventory_admin_required';
  end if;
end;
$$;

revoke all on function app_private.assert_inventory_admin(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.require_single_active_nurse_provider(
  p_tenant_id uuid,
  p_nurse_profile_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider_profile_ids uuid[];
begin
  select array_agg(provider.id order by provider.id) into v_provider_profile_ids
  from public.provider_profiles provider
  join public.profiles profile
    on profile.tenant_id = provider.tenant_id
    and profile.id = provider.profile_id
  where provider.tenant_id = p_tenant_id
    and provider.profile_id = p_nurse_profile_id
    and provider.provider_role in ('rn', 'np')
    and provider.active
    and profile.status = 'active'
    and profile.role in ('nurse', 'rn', 'np');
  if coalesce(cardinality(v_provider_profile_ids), 0) = 0 then
    raise exception using errcode = '42501', message = 'nurse_active_provider_required';
  elsif cardinality(v_provider_profile_ids) > 1 then
    raise exception using errcode = 'P0001', message = 'nurse_active_provider_ambiguous';
  end if;
  return v_provider_profile_ids[1];
end;
$$;

revoke all on function app_private.require_single_active_nurse_provider(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.set_inventory_par_level(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_par_quantity numeric,
  p_reorder_quantity numeric,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_par public.os_inventory_location_par_levels%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_location_id is null or p_item_id is null
     or p_par_quantity is null or p_reorder_quantity is null
     or p_par_quantity < 0 or p_reorder_quantity < 0
     or p_reorder_quantity > p_par_quantity
     or p_par_quantity > 99999999999.999
     or p_reorder_quantity > 99999999999.999
     or p_par_quantity <> round(p_par_quantity, 3)
     or p_reorder_quantity <> round(p_reorder_quantity, 3)
     or p_expected_version is null or p_expected_version < 0
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_par_request_invalid';
  end if;
  if not exists (
    select 1 from public.os_inventory_locations location
    where location.tenant_id = p_tenant_id
      and location.id = p_location_id
      and location.status = 'active'
  ) or not exists (
    select 1 from public.os_inventory_items item
    where item.tenant_id = p_tenant_id
      and item.id = p_item_id
      and item.archived_at is null
  ) or (p_variant_id is not null and not exists (
    select 1 from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = p_variant_id
      and variant.item_id = p_item_id
      and variant.archived_at is null
  )) then
    raise exception using errcode = 'P0001', message = 'inventory_par_context_invalid';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'location_id', p_location_id,
    'item_id', p_item_id,
    'variant_id', p_variant_id,
    'par_quantity', p_par_quantity,
    'reorder_quantity', p_reorder_quantity,
    'expected_version', p_expected_version
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_par_request:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'SET_PAR_LEVEL'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_par_key:' || p_tenant_id::text || ':' || p_location_id::text || ':'
      || p_item_id::text || ':' || coalesce(p_variant_id::text, '-'),
    0
  ));
  select * into v_par
  from public.os_inventory_location_par_levels par
  where par.tenant_id = p_tenant_id
    and par.location_id = p_location_id
    and par.item_id = p_item_id
    and par.variant_id is not distinct from p_variant_id
  for update;
  if found then
    if v_par.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'inventory_par_version_conflict';
    end if;
    update public.os_inventory_location_par_levels par
    set par_quantity = p_par_quantity,
        reorder_quantity = p_reorder_quantity,
        updated_by = p_actor_profile_id,
        updated_at = clock_timestamp(),
        version = par.version + 1
    where par.tenant_id = p_tenant_id and par.id = v_par.id
    returning * into v_par;
  else
    if p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'inventory_par_version_conflict';
    end if;
    insert into public.os_inventory_location_par_levels (
      tenant_id, location_id, item_id, variant_id, par_quantity,
      reorder_quantity, updated_by
    ) values (
      p_tenant_id, p_location_id, p_item_id, p_variant_id, p_par_quantity,
      p_reorder_quantity, p_actor_profile_id
    ) returning * into v_par;
  end if;

  v_response := jsonb_build_object(
    'id', v_par.id,
    'locationId', v_par.location_id,
    'itemId', v_par.item_id,
    'variantId', v_par.variant_id,
    'parQuantity', v_par.par_quantity::text,
    'reorderQuantity', v_par.reorder_quantity::text,
    'version', v_par.version,
    'updatedAt', v_par.updated_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'SET_PAR_LEVEL', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_location_par_levels', v_par.id,
    v_par.version, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_par_level_set',
    'os_inventory_location_par_levels', v_par.id, false, v_request_hash,
    jsonb_build_object(
      'location_id', p_location_id,
      'item_id', p_item_id,
      'variant_id', p_variant_id,
      'par_quantity', p_par_quantity,
      'reorder_quantity', p_reorder_quantity,
      'version', v_par.version
    )
  );
  return v_response;
end;
$$;

revoke all on function public.set_inventory_par_level(uuid, uuid, uuid, uuid, uuid, numeric, numeric, integer, text)
  from public, anon, authenticated;
grant execute on function public.set_inventory_par_level(uuid, uuid, uuid, uuid, uuid, numeric, numeric, integer, text)
  to service_role;

create or replace function public.create_inventory_location(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_location_type text,
  p_location_code text,
  p_name text,
  p_nurse_profile_id uuid,
  p_idempotency_key text
)
returns public.os_inventory_locations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location public.os_inventory_locations%rowtype;
  v_code text := upper(trim(coalesce(p_location_code, '')));
  v_request_hash text;
  v_provider_profile_id uuid;
  v_provider_profile_ids uuid[];
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if coalesce(p_location_type, '') not in ('central', 'warehouse', 'nurse_kit', 'event_kit', 'vehicle', 'quarantine')
     or v_code !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
     or char_length(trim(coalesce(p_name, ''))) not between 1 and 120
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or (p_location_type = 'nurse_kit') <> (p_nurse_profile_id is not null) then
    raise exception using errcode = '22023', message = 'inventory_location_request_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'location_type', p_location_type,
    'location_code', v_code,
    'name', trim(p_name),
    'nurse_profile_id', p_nurse_profile_id
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_location_request:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_location_code:' || p_tenant_id::text || ':' || v_code,
    0
  ));
  if p_nurse_profile_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'inventory_nurse_assignment:' || p_tenant_id::text || ':' || p_nurse_profile_id::text,
      0
    ));
  end if;

  select * into v_location from public.os_inventory_locations location
  where location.tenant_id = p_tenant_id
    and location.request_idempotency_key = p_idempotency_key;
  if found then
    if v_location.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_location;
  end if;
  select * into v_location from public.os_inventory_locations location
  where location.tenant_id = p_tenant_id and location.location_code = v_code;
  if found then
    -- A location code is a durable business identifier. Returning a record
    -- created under another request key would leave this new key unreserved
    -- and allow it to be reused for a different operation later.
    raise exception using errcode = 'P0001', message = 'inventory_location_code_conflict';
  end if;
  if p_nurse_profile_id is not null then
    select array_agg(provider.id order by provider.id) into v_provider_profile_ids
    from public.provider_profiles provider
    join public.profiles profile
      on profile.tenant_id = provider.tenant_id and profile.id = provider.profile_id
    where provider.tenant_id = p_tenant_id
      and provider.profile_id = p_nurse_profile_id
      and provider.provider_role in ('rn', 'np') and provider.active
      and profile.status = 'active' and profile.role in ('nurse', 'rn', 'np');
    if coalesce(cardinality(v_provider_profile_ids), 0) = 0 then
      raise exception using errcode = 'P0001', message = 'inventory_nurse_invalid';
    elsif cardinality(v_provider_profile_ids) > 1 then
      raise exception using errcode = 'P0001', message = 'inventory_nurse_profile_ambiguous';
    end if;
    v_provider_profile_id := v_provider_profile_ids[1];
  end if;
  insert into public.os_inventory_locations (
    tenant_id, location_type, location_code, name, nurse_profile_id,
    request_idempotency_key, request_hash, created_by
  ) values (
    p_tenant_id, p_location_type, v_code, trim(p_name), p_nurse_profile_id,
    p_idempotency_key, v_request_hash, p_actor_profile_id
  ) returning * into v_location;
  if v_provider_profile_id is not null then
    insert into public.os_inventory_location_assignments (
      tenant_id, location_id, provider_profile_id, nurse_profile_id,
      assignment_status, is_primary, assigned_by
    ) values (
      p_tenant_id, v_location.id, v_provider_profile_id, p_nurse_profile_id,
      'assigned', true, p_actor_profile_id
    );
  end if;
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_location_created',
    'os_inventory_locations', v_location.id, false,
    jsonb_build_object('location_type', p_location_type, 'location_code', v_code)
  );
  return v_location;
end;
$$;

revoke all on function public.create_inventory_location(uuid, uuid, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_inventory_location(uuid, uuid, text, text, text, uuid, text)
  to service_role;

create or replace function public.accept_nurse_kit_assignment(
  p_tenant_id uuid,
  p_nurse_profile_id uuid,
  p_location_id uuid
)
returns public.os_inventory_location_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.os_inventory_location_assignments%rowtype;
  v_provider_profile_id uuid;
begin
  if p_tenant_id is null or p_nurse_profile_id is null or p_location_id is null then
    raise exception using errcode = '22023', message = 'nurse_kit_assignment_request_invalid';
  end if;
  v_provider_profile_id := app_private.require_single_active_nurse_provider(
    p_tenant_id, p_nurse_profile_id
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_assignment_accept:' || p_tenant_id::text || ':' || p_location_id::text,
    0
  ));
  select assignment.* into v_assignment
  from public.os_inventory_location_assignments assignment
  join public.os_inventory_locations location
    on location.tenant_id = assignment.tenant_id and location.id = assignment.location_id
  join public.provider_profiles provider
    on provider.tenant_id = assignment.tenant_id and provider.id = assignment.provider_profile_id
  join public.profiles profile
    on profile.tenant_id = assignment.tenant_id and profile.id = assignment.nurse_profile_id
  where assignment.tenant_id = p_tenant_id
    and assignment.location_id = p_location_id
    and assignment.nurse_profile_id = p_nurse_profile_id
    and assignment.provider_profile_id = v_provider_profile_id
    and assignment.assignment_status in ('assigned', 'accepted')
    and location.location_type = 'nurse_kit' and location.status = 'active'
    and location.nurse_profile_id = p_nurse_profile_id
    and provider.profile_id = p_nurse_profile_id
    and provider.provider_role in ('rn', 'np') and provider.active
    and profile.status = 'active' and profile.role in ('nurse', 'rn', 'np')
  for update of assignment;
  if not found then
    raise exception using errcode = '42501', message = 'nurse_kit_assignment_not_available';
  end if;
  if v_assignment.assignment_status = 'accepted' then
    return v_assignment;
  end if;
  update public.os_inventory_location_assignments assignment
  set assignment_status = 'accepted',
      accepted_at = clock_timestamp(),
      version = assignment.version + 1
  where assignment.tenant_id = p_tenant_id and assignment.id = v_assignment.id
  returning * into v_assignment;
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload
  ) values (
    p_tenant_id, p_nurse_profile_id, 'nurse_kit_assignment_accepted',
    'os_inventory_location_assignments', v_assignment.id, false,
    jsonb_build_object('location_id', p_location_id, 'version', v_assignment.version)
  );
  return v_assignment;
end;
$$;

revoke all on function public.accept_nurse_kit_assignment(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.accept_nurse_kit_assignment(uuid, uuid, uuid)
  to service_role;

create or replace function public.record_admin_inventory_movement(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_lot_id uuid,
  p_movement_type text,
  p_adjustment_direction text,
  p_quantity numeric,
  p_unit_cost_cents bigint,
  p_reason_code text,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.os_inventory_items%rowtype;
  v_variant public.os_inventory_variants%rowtype;
  v_lot public.os_inventory_lots%rowtype;
  v_location public.os_inventory_locations%rowtype;
  v_movement public.os_stock_transactions%rowtype;
  v_existing public.os_stock_transactions%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_movement_type text := lower(trim(coalesce(p_movement_type, '')));
  v_adjustment_direction text := nullif(lower(trim(coalesce(p_adjustment_direction, ''))), '');
  v_reason_code text := nullif(upper(trim(coalesce(p_reason_code, ''))), '');
  v_effective_variant_id uuid := p_variant_id;
  v_is_gain boolean;
  v_quantity_delta numeric(14, 3);
  v_available numeric(14, 3);
  v_has_positive_cost boolean;
  v_unit_cost_cents bigint;
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_location_id is null or p_item_id is null
     or v_movement_type not in ('receive', 'consume', 'adjust', 'expire', 'shrink', 'return')
     or p_quantity is null or p_quantity <= 0
     or p_quantity > 99999999999.999
     or p_quantity <> round(p_quantity, 3)
     or (p_unit_cost_cents is not null and p_unit_cost_cents < 0)
     or v_reason_code is null or v_reason_code !~ '^[A-Z0-9_]{3,100}$'
     or p_occurred_at is null
     or p_occurred_at > clock_timestamp() + interval '5 minutes'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_admin_movement_request_invalid';
  end if;
  if v_movement_type = 'adjust' then
    if v_adjustment_direction not in ('gain', 'loss') then
      raise exception using errcode = '22023', message = 'inventory_admin_adjustment_direction_required';
    end if;
    v_is_gain := v_adjustment_direction = 'gain';
  else
    if v_adjustment_direction is not null then
      raise exception using errcode = '22023', message = 'inventory_admin_adjustment_direction_invalid';
    end if;
    v_is_gain := v_movement_type = 'receive';
  end if;
  v_quantity_delta := case when v_is_gain then p_quantity else -p_quantity end;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'location_id', p_location_id,
    'item_id', p_item_id,
    'variant_id', p_variant_id,
    'lot_id', p_lot_id,
    'movement_type', v_movement_type,
    'adjustment_direction', v_adjustment_direction,
    'quantity', p_quantity,
    'unit_cost_cents', p_unit_cost_cents,
    'reason_code', v_reason_code
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'admin_inventory_movement:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'ADMIN_INVENTORY_MOVEMENT'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  select * into v_existing
  from public.os_stock_transactions movement
  where movement.tenant_id = p_tenant_id
    and movement.idempotency_key = p_idempotency_key;
  if found then
    raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
  end if;

  select * into v_location
  from public.os_inventory_locations location
  where location.tenant_id = p_tenant_id
    and location.id = p_location_id
    and location.status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'inventory_admin_movement_location_invalid';
  end if;
  select * into v_item
  from public.os_inventory_items item
  where item.tenant_id = p_tenant_id
    and item.id = p_item_id
    and item.archived_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_admin_movement_item_invalid';
  end if;
  if p_variant_id is not null then
    select * into v_variant
    from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = p_variant_id
      and variant.item_id = p_item_id
      and variant.archived_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'inventory_admin_movement_variant_invalid';
    end if;
  end if;
  if p_lot_id is not null then
    select * into v_lot
    from public.os_inventory_lots lot
    where lot.tenant_id = p_tenant_id
      and lot.id = p_lot_id
      and lot.item_id = p_item_id
      and (p_variant_id is null or lot.variant_id = p_variant_id);
    if not found then
      raise exception using errcode = 'P0001', message = 'inventory_admin_movement_lot_invalid';
    end if;
    if p_variant_id is null and v_lot.variant_id is not null then
      v_effective_variant_id := v_lot.variant_id;
      select * into v_variant
      from public.os_inventory_variants variant
      where variant.tenant_id = p_tenant_id
        and variant.id = v_lot.variant_id
        and variant.item_id = p_item_id
        and variant.archived_at is null;
      if not found then
        raise exception using errcode = 'P0001', message = 'inventory_admin_movement_lot_variant_invalid';
      end if;
    end if;
  end if;
  if v_movement_type = 'consume'
     and p_lot_id is not null
     and v_lot.expires_on < current_date then
    raise exception using errcode = 'P0001', message = 'inventory_expired_lot_consumption_prohibited';
  end if;
  if v_is_gain
     and p_lot_id is not null
     and v_lot.expires_on < current_date
     and v_location.location_type in ('nurse_kit', 'event_kit', 'vehicle') then
    raise exception using errcode = 'P0001', message = 'inventory_expired_lot_care_receipt_prohibited';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_balance:' || p_tenant_id::text || ':' || p_location_id::text || ':'
      || p_item_id::text || ':' || coalesce(v_effective_variant_id::text, '-') || ':'
      || coalesce(p_lot_id::text, '-'),
    0
  ));
  if not v_is_gain then
    select coalesce(sum(balance.quantity_on_hand), 0) into v_available
    from public.os_inventory_location_balances balance
    where balance.tenant_id = p_tenant_id
      and balance.location_id = p_location_id
      and balance.item_id = p_item_id
      and balance.variant_id is not distinct from v_effective_variant_id
      and balance.lot_id is not distinct from p_lot_id;
    if v_available < p_quantity then
      raise exception using errcode = 'P0001', message = 'inventory_admin_movement_insufficient_stock';
    end if;
    v_has_positive_cost := app_private.inventory_location_has_positive_cost(
      p_tenant_id, p_location_id, p_item_id, v_effective_variant_id, p_lot_id
    );
  end if;

  v_unit_cost_cents := case when p_lot_id is not null then coalesce(
      nullif(v_lot.unit_cost_cents, 0),
      nullif(v_variant.unit_cost_cents, 0),
      0
    ) else 0 end;
  if p_lot_id is null and (
       nullif(p_unit_cost_cents, 0) is not null
       or v_unit_cost_cents > 0
       or (not v_is_gain and coalesce(v_has_positive_cost, false))
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_costed_stock_lot_required';
  end if;
  if nullif(p_unit_cost_cents, 0) is not null
     and p_unit_cost_cents <> v_unit_cost_cents then
    raise exception using errcode = '22023', message = 'inventory_admin_movement_cost_mismatch';
  end if;
  insert into public.os_stock_transactions (
    tenant_id, item_id, variant_id, lot_id, transaction_type, quantity_delta,
    unit_cost_cents, source_type, source_id, idempotency_key, note,
    occurred_at, created_by, from_location_id, to_location_id,
    operation_request_hash
  ) values (
    p_tenant_id, p_item_id, v_effective_variant_id, p_lot_id, v_movement_type,
    v_quantity_delta, nullif(v_unit_cost_cents, 0), 'admin_inventory',
    p_idempotency_key, p_idempotency_key, v_reason_code, p_occurred_at,
    p_actor_profile_id,
    case when v_is_gain then null else p_location_id end,
    case when v_is_gain then p_location_id else null end,
    v_request_hash
  ) returning * into v_movement;

  v_response := jsonb_build_object(
    'id', v_movement.id,
    'locationId', p_location_id,
    'itemId', v_movement.item_id,
    'variantId', v_movement.variant_id,
    'lotId', v_movement.lot_id,
    'movementType', v_movement.transaction_type,
    'adjustmentDirection', v_adjustment_direction,
    'quantity', p_quantity::text,
    'quantityDelta', v_movement.quantity_delta::text,
    'unitCostCents', v_movement.unit_cost_cents::text,
    'reasonCode', v_reason_code,
    'occurredAt', v_movement.occurred_at,
    'fromLocationId', v_movement.from_location_id,
    'toLocationId', v_movement.to_location_id
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'ADMIN_INVENTORY_MOVEMENT', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_stock_transactions', v_movement.id, 1, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'admin_inventory_movement_recorded',
    'os_stock_transactions', v_movement.id, false, v_request_hash,
    jsonb_build_object(
      'location_id', p_location_id,
      'item_id', p_item_id,
      'variant_id', v_effective_variant_id,
      'lot_id', p_lot_id,
      'movement_type', v_movement_type,
      'adjustment_direction', v_adjustment_direction,
      'quantity', p_quantity,
      'unit_cost_cents', nullif(v_unit_cost_cents, 0),
      'reason_code', v_reason_code
    )
  );
  return v_response;
end;
$$;

revoke all on function public.record_admin_inventory_movement(uuid, uuid, uuid, uuid, uuid, uuid, text, text, numeric, bigint, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.record_admin_inventory_movement(uuid, uuid, uuid, uuid, uuid, uuid, text, text, numeric, bigint, text, timestamptz, text)
  to service_role;

create or replace function public.transfer_inventory_to_location(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available numeric(14, 3);
  v_has_positive_cost boolean;
  v_unit_cost bigint;
  v_to_location public.os_inventory_locations%rowtype;
  v_out public.os_stock_transactions%rowtype;
  v_in public.os_stock_transactions%rowtype;
  v_transfer_group_id uuid := gen_random_uuid();
  v_request_hash text;
  v_occurred_at timestamptz := clock_timestamp();
  v_out_key text := p_idempotency_key || ':out';
  v_in_key text := p_idempotency_key || ':in';
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_from_location_id is null or p_to_location_id is null or p_item_id is null
     or p_from_location_id = p_to_location_id
     or p_quantity is null or p_quantity <= 0
     or p_quantity > 99999999999.999
     or p_quantity <> round(p_quantity, 3)
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,190}$' then
    raise exception using errcode = '22023', message = 'inventory_transfer_request_invalid';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'from_location_id', p_from_location_id,
    'to_location_id', p_to_location_id,
    'item_id', p_item_id,
    'variant_id', p_variant_id,
    'lot_id', p_lot_id,
    'quantity', p_quantity
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_transfer_request:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_out from public.os_stock_transactions movement
  where movement.tenant_id = p_tenant_id and movement.idempotency_key = v_out_key;
  if found then
    select * into v_in from public.os_stock_transactions movement
    where movement.tenant_id = p_tenant_id and movement.idempotency_key = v_in_key;
    if not found
       or v_out.operation_request_hash is distinct from v_request_hash
       or v_in.operation_request_hash is distinct from v_request_hash
       or v_out.transfer_group_id is null
       or v_out.transfer_group_id is distinct from v_in.transfer_group_id
       or v_out.from_location_id is distinct from p_from_location_id
       or v_in.to_location_id is distinct from p_to_location_id
       or v_out.item_id is distinct from p_item_id
       or v_in.item_id is distinct from p_item_id
       or v_out.variant_id is distinct from p_variant_id
       or v_in.variant_id is distinct from p_variant_id
       or v_out.lot_id is distinct from p_lot_id
       or v_in.lot_id is distinct from p_lot_id
       or v_out.quantity_delta is distinct from -p_quantity
       or v_in.quantity_delta is distinct from p_quantity then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return jsonb_build_object(
      'transferGroupId', v_out.transfer_group_id,
      'transferOutId', v_out.id,
      'transferInId', v_in.id
    );
  elsif exists (
    select 1 from public.os_stock_transactions movement
    where movement.tenant_id = p_tenant_id and movement.idempotency_key = v_in_key
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_transfer_replay_incomplete';
  end if;
  if not exists (
    select 1 from public.os_inventory_locations location
    where location.tenant_id = p_tenant_id and location.id = p_from_location_id and location.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_location_not_active';
  end if;
  select * into v_to_location
  from public.os_inventory_locations location
  where location.tenant_id = p_tenant_id
    and location.id = p_to_location_id
    and location.status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'inventory_location_not_active';
  end if;
  if p_lot_id is not null
     and v_to_location.location_type in ('nurse_kit', 'event_kit', 'vehicle')
     and exists (
       select 1 from public.os_inventory_lots lot
       where lot.tenant_id = p_tenant_id
         and lot.id = p_lot_id
         and lot.item_id = p_item_id
         and (p_variant_id is null or lot.variant_id = p_variant_id)
         and lot.expires_on < current_date
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_expired_lot_care_transfer_prohibited';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_balance:' || p_tenant_id::text || ':'
      || p_from_location_id::text || ':' || p_item_id::text || ':'
      || coalesce(p_variant_id::text, '-') || ':' || coalesce(p_lot_id::text, '-'),
    0
  ));
  select coalesce(sum(balance.quantity_on_hand), 0) into v_available
  from public.os_inventory_location_balances balance
  where balance.tenant_id = p_tenant_id
    and balance.location_id = p_from_location_id
    and balance.item_id = p_item_id
    and balance.variant_id is not distinct from p_variant_id
    and balance.lot_id is not distinct from p_lot_id;
  if v_available < p_quantity then
    raise exception using errcode = 'P0001', message = 'inventory_transfer_insufficient_stock';
  end if;
  select case when p_lot_id is not null then coalesce(
      nullif(lot.unit_cost_cents, 0),
      nullif(variant.unit_cost_cents, 0),
      0
    ) else 0 end into v_unit_cost
  from public.os_inventory_items item
  left join public.os_inventory_lots lot
    on lot.tenant_id = item.tenant_id and lot.id = p_lot_id and lot.item_id = item.id
  left join public.os_inventory_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.id = coalesce(p_variant_id, lot.variant_id)
    and variant.item_id = item.id
  where item.tenant_id = p_tenant_id and item.id = p_item_id and item.archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'inventory_item_not_found'; end if;
  if p_lot_id is null then
    v_has_positive_cost := app_private.inventory_location_has_positive_cost(
      p_tenant_id, p_from_location_id, p_item_id, p_variant_id, p_lot_id
    );
    if v_unit_cost > 0 or v_has_positive_cost then
      raise exception using errcode = 'P0001', message = 'inventory_costed_stock_lot_required';
    end if;
  end if;
  insert into public.os_stock_transactions (
    tenant_id, item_id, variant_id, lot_id, transaction_type, quantity_delta,
    unit_cost_cents, source_type, source_id, idempotency_key, occurred_at,
    created_by, from_location_id, transfer_group_id, operation_request_hash
  ) values (
    p_tenant_id, p_item_id, p_variant_id, p_lot_id, 'transfer_out', -p_quantity,
    nullif(v_unit_cost, 0), 'location_transfer', p_idempotency_key, v_out_key,
    v_occurred_at, p_actor_profile_id, p_from_location_id,
    v_transfer_group_id, v_request_hash
  ) returning * into v_out;
  insert into public.os_stock_transactions (
    tenant_id, item_id, variant_id, lot_id, transaction_type, quantity_delta,
    unit_cost_cents, source_type, source_id, idempotency_key, occurred_at,
    created_by, to_location_id, transfer_group_id, operation_request_hash
  ) values (
    p_tenant_id, p_item_id, p_variant_id, p_lot_id, 'transfer_in', p_quantity,
    nullif(v_unit_cost, 0), 'location_transfer', p_idempotency_key, v_in_key,
    v_occurred_at, p_actor_profile_id, p_to_location_id,
    v_transfer_group_id, v_request_hash
  ) returning * into v_in;
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_location_transfer_recorded',
    'os_stock_transactions', v_in.id, false,
    jsonb_build_object(
      'transfer_group_id', v_transfer_group_id,
      'from_location_id', p_from_location_id, 'to_location_id', p_to_location_id,
      'item_id', p_item_id, 'quantity', p_quantity
    )
  );
  return jsonb_build_object(
    'transferGroupId', v_transfer_group_id,
    'transferOutId', v_out.id,
    'transferInId', v_in.id
  );
end;
$$;

revoke all on function public.transfer_inventory_to_location(uuid, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.transfer_inventory_to_location(uuid, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text)
  to service_role;

create or replace function public.record_nurse_kit_movement(
  p_tenant_id uuid,
  p_nurse_profile_id uuid,
  p_location_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_lot_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason_code text,
  p_idempotency_key text
)
returns public.os_stock_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available numeric(14, 3);
  v_has_positive_cost boolean;
  v_unit_cost bigint;
  v_provider_profile_id uuid;
  v_movement public.os_stock_transactions%rowtype;
  v_request_hash text;
begin
  if coalesce(p_movement_type, '') not in ('consume', 'expire', 'shrink')
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or p_item_id is null
     or p_quantity is null or p_quantity <= 0
     or p_quantity > 99999999999.999
     or p_quantity <> round(p_quantity, 3)
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'nurse_kit_movement_request_invalid';
  end if;
  v_provider_profile_id := app_private.require_single_active_nurse_provider(
    p_tenant_id, p_nurse_profile_id
  );
  if not exists (
    select 1 from public.profiles profile
    join public.os_inventory_locations location
      on location.tenant_id = profile.tenant_id
      and location.nurse_profile_id = profile.id
    join public.os_inventory_location_assignments assignment
      on assignment.tenant_id = location.tenant_id
      and assignment.location_id = location.id
      and assignment.nurse_profile_id = profile.id
      and assignment.provider_profile_id = v_provider_profile_id
    where profile.tenant_id = p_tenant_id and profile.id = p_nurse_profile_id
      and profile.status = 'active' and profile.role in ('nurse', 'rn', 'np')
      and location.id = p_location_id and location.location_type = 'nurse_kit'
      and location.status = 'active'
      and assignment.assignment_status = 'accepted'
      and assignment.accepted_at is not null
      and assignment.ended_at is null
      and assignment.is_primary
  ) then
    raise exception using errcode = '42501', message = 'nurse_kit_access_required';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'nurse_profile_id', p_nurse_profile_id,
    'location_id', p_location_id,
    'item_id', p_item_id,
    'variant_id', p_variant_id,
    'lot_id', p_lot_id,
    'movement_type', p_movement_type,
    'quantity', p_quantity,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'nurse_kit_movement_request:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_movement from public.os_stock_transactions movement
  where movement.tenant_id = p_tenant_id and movement.idempotency_key = p_idempotency_key;
  if found then
    if v_movement.operation_request_hash is distinct from v_request_hash
       or v_movement.from_location_id is distinct from p_location_id
       or v_movement.item_id is distinct from p_item_id
       or v_movement.variant_id is distinct from p_variant_id
       or v_movement.lot_id is distinct from p_lot_id
       or v_movement.transaction_type is distinct from p_movement_type
       or v_movement.quantity_delta is distinct from -p_quantity
       or v_movement.note is distinct from p_reason_code then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_movement;
  end if;
  if p_movement_type = 'consume'
     and p_lot_id is not null
     and exists (
       select 1 from public.os_inventory_lots lot
       where lot.tenant_id = p_tenant_id
         and lot.id = p_lot_id
         and lot.item_id = p_item_id
         and (p_variant_id is null or lot.variant_id = p_variant_id)
         and lot.expires_on < current_date
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_expired_lot_consumption_prohibited';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_balance:' || p_tenant_id::text || ':'
      || p_location_id::text || ':' || p_item_id::text || ':'
      || coalesce(p_variant_id::text, '-') || ':' || coalesce(p_lot_id::text, '-'),
    0
  ));
  select coalesce(sum(balance.quantity_on_hand), 0) into v_available
  from public.os_inventory_location_balances balance
  where balance.tenant_id = p_tenant_id and balance.location_id = p_location_id
    and balance.item_id = p_item_id
    and balance.variant_id is not distinct from p_variant_id
    and balance.lot_id is not distinct from p_lot_id;
  if v_available < p_quantity then
    raise exception using errcode = 'P0001', message = 'inventory_quantity_unavailable';
  end if;
  select case when p_lot_id is not null then coalesce(
      nullif(lot.unit_cost_cents, 0),
      nullif(variant.unit_cost_cents, 0),
      0
    ) else 0 end into v_unit_cost
  from public.os_inventory_items item
  left join public.os_inventory_lots lot
    on lot.tenant_id = item.tenant_id and lot.id = p_lot_id and lot.item_id = item.id
  left join public.os_inventory_variants variant
    on variant.tenant_id = item.tenant_id
    and variant.id = coalesce(p_variant_id, lot.variant_id)
    and variant.item_id = item.id
  where item.tenant_id = p_tenant_id and item.id = p_item_id and item.archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'inventory_item_not_found'; end if;
  if p_lot_id is null then
    v_has_positive_cost := app_private.inventory_location_has_positive_cost(
      p_tenant_id, p_location_id, p_item_id, p_variant_id, p_lot_id
    );
    if v_unit_cost > 0 or v_has_positive_cost then
      raise exception using errcode = 'P0001', message = 'inventory_costed_stock_lot_required';
    end if;
  end if;
  insert into public.os_stock_transactions (
    tenant_id, item_id, variant_id, lot_id, transaction_type, quantity_delta,
    unit_cost_cents, source_type, source_id, idempotency_key, note,
    occurred_at, created_by, from_location_id, operation_request_hash
  ) values (
    p_tenant_id, p_item_id, p_variant_id, p_lot_id, p_movement_type, -p_quantity,
    nullif(v_unit_cost, 0), 'nurse_kit', p_location_id::text, p_idempotency_key,
    p_reason_code, clock_timestamp(), p_nurse_profile_id, p_location_id,
    v_request_hash
  ) returning * into v_movement;
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched, payload
  ) values (
    p_tenant_id, p_nurse_profile_id, 'nurse_kit_movement_recorded',
    'os_stock_transactions', v_movement.id, false,
    jsonb_build_object(
      'location_id', p_location_id, 'item_id', p_item_id,
      'movement_type', p_movement_type, 'quantity', p_quantity,
      'reason_code', p_reason_code
    )
  );
  return v_movement;
end;
$$;

revoke all on function public.record_nurse_kit_movement(uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.record_nurse_kit_movement(uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, text, text)
  to service_role;

create or replace function public.create_nurse_kit_restock_request(
  p_tenant_id uuid,
  p_nurse_profile_id uuid,
  p_location_id uuid,
  p_reason_code text,
  p_lines jsonb,
  p_idempotency_key text
)
returns public.os_inventory_restock_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.os_inventory_restock_requests%rowtype;
  v_line jsonb;
  v_request_hash text;
  v_item_id uuid;
  v_variant_id uuid;
  v_quantity numeric;
  v_provider_profile_id uuid;
begin
  if coalesce(p_reason_code, '') not in ('BELOW_PAR', 'UPCOMING_SHIFT', 'EXPIRED_REMOVAL', 'DAMAGED', 'COUNT_VARIANCE')
     or p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'nurse_kit_restock_request_invalid';
  end if;
  if jsonb_array_length(p_lines) <> 1 then
    raise exception using errcode = '22023', message = 'nurse_kit_restock_request_invalid';
  end if;
  v_provider_profile_id := app_private.require_single_active_nurse_provider(
    p_tenant_id, p_nurse_profile_id
  );
  if not exists (
    select 1 from public.os_inventory_locations location
    join public.profiles profile
      on profile.tenant_id = location.tenant_id and profile.id = location.nurse_profile_id
    join public.os_inventory_location_assignments assignment
      on assignment.tenant_id = location.tenant_id
      and assignment.location_id = location.id
      and assignment.nurse_profile_id = profile.id
      and assignment.provider_profile_id = v_provider_profile_id
    where location.tenant_id = p_tenant_id and location.id = p_location_id
      and location.location_type = 'nurse_kit' and location.status = 'active'
      and location.nurse_profile_id = p_nurse_profile_id
      and profile.status = 'active' and profile.role in ('nurse', 'rn', 'np')
      and assignment.assignment_status = 'accepted'
      and assignment.accepted_at is not null
      and assignment.ended_at is null
      and assignment.is_primary
  ) then
    raise exception using errcode = '42501', message = 'nurse_kit_access_required';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'nurse_profile_id', p_nurse_profile_id,
    'location_id', p_location_id, 'reason_code', p_reason_code, 'lines', p_lines
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'nurse_kit_restock_request:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_request from public.os_inventory_restock_requests request
  where request.tenant_id = p_tenant_id and request.request_idempotency_key = p_idempotency_key;
  if found then
    if v_request.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_request;
  end if;
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception using errcode = '22023', message = 'nurse_kit_restock_line_invalid';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_line) as supplied(key)
      where supplied.key not in ('itemId', 'variantId', 'quantity')
    ) or coalesce(v_line->>'itemId', '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or (
        coalesce(v_line->>'variantId', '') <> ''
        and coalesce(v_line->>'variantId', '') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      )
      or coalesce(v_line->>'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
      raise exception using errcode = '22023', message = 'nurse_kit_restock_line_invalid';
    end if;
    v_item_id := (v_line->>'itemId')::uuid;
    v_variant_id := nullif(v_line->>'variantId', '')::uuid;
    v_quantity := (v_line->>'quantity')::numeric;
    if v_quantity <= 0 or v_quantity > 99999999999.999 or not exists (
      select 1 from public.os_inventory_items item
      where item.tenant_id = p_tenant_id and item.id = v_item_id and item.archived_at is null
    ) then raise exception using errcode = 'P0001', message = 'nurse_kit_restock_item_invalid'; end if;
    if v_variant_id is not null and not exists (
      select 1 from public.os_inventory_variants variant
      where variant.tenant_id = p_tenant_id and variant.id = v_variant_id
        and variant.item_id = v_item_id and variant.archived_at is null
    ) then raise exception using errcode = 'P0001', message = 'nurse_kit_restock_variant_invalid'; end if;
    if not exists (
      select 1 from public.os_inventory_location_balances balance
      where balance.tenant_id = p_tenant_id
        and balance.location_id = p_location_id
        and balance.item_id = v_item_id
        and balance.variant_id is not distinct from v_variant_id
        and balance.quantity_on_hand > 0
    ) and not exists (
      select 1 from public.os_inventory_location_par_levels par
      where par.tenant_id = p_tenant_id
        and par.location_id = p_location_id
        and par.item_id = v_item_id
        and par.variant_id is not distinct from v_variant_id
    ) then
      raise exception using errcode = 'P0001', message = 'nurse_kit_restock_item_not_authorized';
    end if;
  end loop;
  if exists (
    select 1
    from jsonb_array_elements(p_lines) as line(value)
    group by line.value->>'itemId', coalesce(line.value->>'variantId', '')
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'nurse_kit_restock_line_duplicate';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'nurse_kit_open_restock:' || p_tenant_id::text || ':' || p_location_id::text || ':'
      || v_item_id::text || ':' || coalesce(v_variant_id::text, '-'),
    0
  ));
  if exists (
    select 1
    from public.os_inventory_restock_requests request
    join public.os_inventory_restock_request_lines line
      on line.tenant_id = request.tenant_id
      and line.restock_request_id = request.id
    where request.tenant_id = p_tenant_id
      and request.location_id = p_location_id
      and request.status in ('requested', 'approved', 'packing')
      and line.item_id = v_item_id
      and line.variant_id is not distinct from v_variant_id
  ) then
    raise exception using errcode = 'P0001', message = 'nurse_kit_restock_open_request_exists';
  end if;
  insert into public.os_inventory_restock_requests (
    tenant_id, location_id, nurse_profile_id, reason_code,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, p_location_id, p_nurse_profile_id, p_reason_code,
    p_idempotency_key, v_request_hash
  ) returning * into v_request;
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.os_inventory_restock_request_lines (
      tenant_id, restock_request_id, item_id, variant_id, requested_quantity
    ) values (
      p_tenant_id, v_request.id, (v_line->>'itemId')::uuid,
      nullif(v_line->>'variantId', '')::uuid, (v_line->>'quantity')::numeric
    );
  end loop;
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id, phi_touched,
    payload_hash, payload
  ) values (
    p_tenant_id, p_nurse_profile_id, 'nurse_kit_restock_requested',
    'os_inventory_restock_requests', v_request.id, false, v_request_hash,
    jsonb_build_object(
      'location_id', p_location_id, 'reason_code', p_reason_code,
      'line_count', jsonb_array_length(p_lines)
    )
  );
  return v_request;
end;
$$;

revoke all on function public.create_nurse_kit_restock_request(uuid, uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_nurse_kit_restock_request(uuid, uuid, uuid, text, jsonb, text)
  to service_role;

create or replace function public.transition_inventory_restock_request(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_request_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_reason_code text,
  p_fulfillment_reference text,
  p_fulfillment_transfer_group_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.os_inventory_restock_requests%rowtype;
  v_line public.os_inventory_restock_request_lines%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_line_count integer;
  v_request_hash text;
  v_response jsonb;
  v_reason_code text := nullif(upper(trim(coalesce(p_reason_code, ''))), '');
  v_fulfillment_reference text := nullif(trim(coalesce(p_fulfillment_reference, '')), '');
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_request_id is null
     or p_expected_version is null or p_expected_version < 1
     or coalesce(p_target_status, '') not in ('approved', 'packing', 'fulfilled', 'rejected', 'cancelled')
     or (v_reason_code is not null and v_reason_code !~ '^[A-Z0-9_]{3,100}$')
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_restock_transition_invalid';
  end if;
  if p_target_status in ('rejected', 'cancelled') and v_reason_code is null then
    raise exception using errcode = '22023', message = 'inventory_restock_transition_reason_required';
  end if;
  if p_target_status = 'fulfilled' then
    if v_fulfillment_reference is null
       or v_fulfillment_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,159}$' then
      raise exception using errcode = '22023', message = 'inventory_restock_fulfillment_reference_required';
    end if;
    if p_fulfillment_transfer_group_id is null then
      raise exception using errcode = '22023', message = 'inventory_restock_fulfillment_transfer_required';
    end if;
  elsif v_fulfillment_reference is not null
     or p_fulfillment_transfer_group_id is not null then
    raise exception using errcode = '22023', message = 'inventory_restock_fulfillment_context_invalid';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'request_id', p_request_id,
    'expected_version', p_expected_version,
    'target_status', p_target_status,
    'reason_code', v_reason_code,
    'fulfillment_reference', v_fulfillment_reference,
    'fulfillment_transfer_group_id', p_fulfillment_transfer_group_id
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_restock_transition:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'TRANSITION_RESTOCK_REQUEST'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;

  select * into v_request
  from public.os_inventory_restock_requests request
  where request.tenant_id = p_tenant_id and request.id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_restock_request_not_found';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'inventory_restock_version_conflict';
  end if;
  if not (
    (v_request.status = 'requested' and p_target_status in ('approved', 'rejected', 'cancelled'))
    or (v_request.status = 'approved' and p_target_status in ('packing', 'rejected', 'cancelled'))
    or (v_request.status = 'packing' and p_target_status in ('fulfilled', 'rejected', 'cancelled'))
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_restock_transition_not_allowed';
  end if;
  if p_target_status = 'fulfilled' then
    if not exists (
      select 1
      from public.os_inventory_locations location
      join public.os_inventory_location_assignments assignment
        on assignment.tenant_id = location.tenant_id
        and assignment.location_id = location.id
        and assignment.nurse_profile_id = location.nurse_profile_id
      join public.provider_profiles provider
        on provider.tenant_id = assignment.tenant_id
        and provider.id = assignment.provider_profile_id
        and provider.profile_id = assignment.nurse_profile_id
      join public.profiles profile
        on profile.tenant_id = assignment.tenant_id
        and profile.id = assignment.nurse_profile_id
      where location.tenant_id = p_tenant_id
        and location.id = v_request.location_id
        and location.location_type = 'nurse_kit'
        and location.status = 'active'
        and assignment.assignment_status = 'accepted'
        and assignment.accepted_at is not null
        and assignment.ended_at is null
        and assignment.is_primary
        and provider.provider_role in ('rn', 'np')
        and provider.active
        and profile.status = 'active'
        and profile.role in ('nurse', 'rn', 'np')
    ) then
      raise exception using errcode = '42501', message = 'nurse_kit_active_custody_required';
    end if;
    select count(*) into v_line_count
    from public.os_inventory_restock_request_lines line
    where line.tenant_id = p_tenant_id
      and line.restock_request_id = v_request.id;
    if v_line_count <> 1 then
      raise exception using errcode = 'P0001', message = 'inventory_restock_fulfillment_line_count_invalid';
    end if;
    select * into strict v_line
    from public.os_inventory_restock_request_lines line
    where line.tenant_id = p_tenant_id
      and line.restock_request_id = v_request.id;
    if (
      select count(*)
      from public.os_stock_transactions movement
      where movement.tenant_id = p_tenant_id
        and movement.transfer_group_id = p_fulfillment_transfer_group_id
    ) <> 2 or not exists (
      select 1
      from public.os_stock_transactions movement_in
      join public.os_stock_transactions movement_out
        on movement_out.tenant_id = movement_in.tenant_id
        and movement_out.transfer_group_id = movement_in.transfer_group_id
        and movement_out.transaction_type = 'transfer_out'
        and movement_out.item_id = movement_in.item_id
        and movement_out.variant_id is not distinct from movement_in.variant_id
        and movement_out.lot_id is not distinct from movement_in.lot_id
        and movement_out.quantity_delta = -movement_in.quantity_delta
        and movement_out.unit_cost_cents is not distinct from movement_in.unit_cost_cents
        and movement_out.occurred_at = movement_in.occurred_at
        and movement_out.source_type = movement_in.source_type
        and movement_out.source_id is not distinct from movement_in.source_id
        and movement_out.operation_request_hash is not distinct from movement_in.operation_request_hash
      where movement_in.tenant_id = p_tenant_id
        and movement_in.transfer_group_id = p_fulfillment_transfer_group_id
        and movement_in.transaction_type = 'transfer_in'
        and movement_in.source_type = 'location_transfer'
        and movement_in.to_location_id = v_request.location_id
        and movement_in.item_id = v_line.item_id
        and movement_in.variant_id is not distinct from v_line.variant_id
        and movement_in.quantity_delta = v_line.requested_quantity
        and movement_in.occurred_at >= v_request.requested_at
        and movement_out.from_location_id is not null
        and movement_out.to_location_id is null
        and movement_in.from_location_id is null
        and movement_in.operation_request_hash is not null
    ) then
      raise exception using errcode = 'P0001', message = 'inventory_restock_fulfillment_transfer_invalid';
    end if;
  end if;

  update public.os_inventory_restock_requests request
  set status = p_target_status,
      version = request.version + 1,
      last_transition_reason_code = v_reason_code,
      fulfilled_at = case when p_target_status = 'fulfilled' then clock_timestamp() else null end,
      fulfilled_by = case when p_target_status = 'fulfilled' then p_actor_profile_id else null end,
      fulfillment_reference = case when p_target_status = 'fulfilled' then v_fulfillment_reference else null end,
      fulfillment_transfer_group_id = case
        when p_target_status = 'fulfilled' then p_fulfillment_transfer_group_id
        else null
      end
  where request.tenant_id = p_tenant_id and request.id = p_request_id
  returning * into v_request;

  v_response := jsonb_build_object(
    'id', v_request.id,
    'locationId', v_request.location_id,
    'status', v_request.status,
    'reasonCode', v_request.last_transition_reason_code,
    'fulfillmentReference', v_request.fulfillment_reference,
    'fulfillmentTransferGroupId', v_request.fulfillment_transfer_group_id,
    'fulfilledAt', v_request.fulfilled_at,
    'fulfilledBy', v_request.fulfilled_by,
    'version', v_request.version
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'TRANSITION_RESTOCK_REQUEST', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_restock_requests', v_request.id,
    v_request.version, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_restock_status_transitioned',
    'os_inventory_restock_requests', v_request.id, false, v_request_hash,
    jsonb_build_object(
      'status', v_request.status,
      'reason_code', v_request.last_transition_reason_code,
      'fulfillment_reference', v_request.fulfillment_reference,
      'fulfillment_transfer_group_id', v_request.fulfillment_transfer_group_id,
      'version', v_request.version
    )
  );
  return v_response;
end;
$$;

revoke all on function public.transition_inventory_restock_request(uuid, uuid, uuid, integer, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.transition_inventory_restock_request(uuid, uuid, uuid, integer, text, text, text, uuid, text)
  to service_role;

create or replace function public.fulfill_inventory_restock_request(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_request_id uuid,
  p_expected_version integer,
  p_from_location_id uuid,
  p_lot_id uuid,
  p_fulfillment_reference text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.os_inventory_restock_requests%rowtype;
  v_line public.os_inventory_restock_request_lines%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_line_count integer;
  v_request_hash text;
  v_child_key_hash text;
  v_transfer_key text;
  v_transition_key text;
  v_fulfillment_reference text := nullif(trim(coalesce(p_fulfillment_reference, '')), '');
  v_transfer jsonb;
  v_transition jsonb;
  v_transfer_group_id uuid;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_request_id is null
     or p_expected_version is null or p_expected_version < 1
     or p_from_location_id is null
     or v_fulfillment_reference is null
     or v_fulfillment_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,159}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception using errcode = '22023', message = 'inventory_restock_fulfill_request_invalid';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'request_id', p_request_id,
    'expected_version', p_expected_version,
    'from_location_id', p_from_location_id,
    'lot_id', p_lot_id,
    'fulfillment_reference', v_fulfillment_reference
  )::text, 'sha256'), 'hex');
  v_child_key_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');
  v_transfer_key := 'restock:fulfill:transfer:' || v_child_key_hash;
  v_transition_key := 'restock:fulfill:transition:' || v_child_key_hash;

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_restock_fulfill:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'FULFILL_RESTOCK_REQUEST'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;

  select * into v_request
  from public.os_inventory_restock_requests request
  where request.tenant_id = p_tenant_id and request.id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_restock_request_not_found';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'inventory_restock_version_conflict';
  end if;
  if v_request.status <> 'packing' then
    raise exception using errcode = 'P0001', message = 'inventory_restock_fulfillment_requires_packing';
  end if;

  select count(*) into v_line_count
  from public.os_inventory_restock_request_lines line
  where line.tenant_id = p_tenant_id
    and line.restock_request_id = v_request.id;
  if v_line_count <> 1 then
    raise exception using errcode = 'P0001', message = 'inventory_restock_fulfillment_line_count_invalid';
  end if;
  select * into strict v_line
  from public.os_inventory_restock_request_lines line
  where line.tenant_id = p_tenant_id
    and line.restock_request_id = v_request.id;

  v_transfer := public.transfer_inventory_to_location(
    p_tenant_id,
    p_actor_profile_id,
    p_from_location_id,
    v_request.location_id,
    v_line.item_id,
    v_line.variant_id,
    p_lot_id,
    v_line.requested_quantity,
    v_transfer_key
  );
  v_transfer_group_id := (v_transfer->>'transferGroupId')::uuid;
  v_transition := public.transition_inventory_restock_request(
    p_tenant_id,
    p_actor_profile_id,
    p_request_id,
    p_expected_version,
    'fulfilled',
    null,
    v_fulfillment_reference,
    v_transfer_group_id,
    v_transition_key
  );

  v_response := jsonb_build_object(
    'requestId', p_request_id,
    'locationId', v_request.location_id,
    'itemId', v_line.item_id,
    'variantId', v_line.variant_id,
    'lotId', p_lot_id,
    'requestedQuantity', v_line.requested_quantity::text,
    'status', v_transition->>'status',
    'version', (v_transition->>'version')::integer,
    'fulfillmentReference', v_fulfillment_reference,
    'fulfillmentTransferGroupId', v_transfer_group_id,
    'transferOutId', v_transfer->>'transferOutId',
    'transferInId', v_transfer->>'transferInId',
    'fulfilledAt', v_transition->'fulfilledAt',
    'fulfilledBy', v_transition->'fulfilledBy'
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'FULFILL_RESTOCK_REQUEST', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_restock_requests', p_request_id,
    (v_transition->>'version')::integer, v_response
  );
  return v_response;
end;
$$;

revoke all on function public.fulfill_inventory_restock_request(uuid, uuid, uuid, integer, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fulfill_inventory_restock_request(uuid, uuid, uuid, integer, uuid, uuid, text, text)
  to service_role;

create or replace function public.create_inventory_item(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_qr_code text,
  p_unit text,
  p_reorder_point numeric,
  p_tags text[],
  p_preferred_vendor_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.os_inventory_items%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_sku text := nullif(trim(coalesce(p_sku, '')), '');
  v_barcode text := nullif(trim(coalesce(p_barcode, '')), '');
  v_qr_code text := nullif(trim(coalesce(p_qr_code, '')), '');
  v_unit text := trim(coalesce(p_unit, ''));
  v_tags text[];
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if char_length(v_name) not between 1 and 240
     or char_length(v_unit) not between 1 and 40
     or (v_sku is not null and char_length(v_sku) > 120)
     or (v_barcode is not null and char_length(v_barcode) > 160)
     or (v_qr_code is not null and char_length(v_qr_code) > 160)
     or p_reorder_point is null or p_reorder_point < 0
     or p_reorder_point > 99999999999.999
     or p_reorder_point <> round(p_reorder_point, 3)
     or coalesce(array_ndims(p_tags), 1) <> 1
     or coalesce(cardinality(p_tags), 0) > 50
     or exists (
       select 1 from unnest(coalesce(p_tags, array[]::text[])) tag
       where tag is null or char_length(trim(tag)) not between 1 and 80
     )
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_item_create_invalid';
  end if;
  select coalesce(array_agg(trim(tag.value) order by tag.ordinality), array[]::text[])
  into v_tags
  from unnest(coalesce(p_tags, array[]::text[])) with ordinality as tag(value, ordinality);
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'name', v_name,
    'sku', v_sku,
    'barcode', v_barcode,
    'qr_code', v_qr_code,
    'unit', v_unit,
    'reorder_point', p_reorder_point,
    'tags', to_jsonb(v_tags),
    'preferred_vendor_id', p_preferred_vendor_id
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_item_create:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'CREATE_INVENTORY_ITEM'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  if p_preferred_vendor_id is not null and not exists (
    select 1 from public.os_inventory_vendors vendor
    where vendor.tenant_id = p_tenant_id
      and vendor.id = p_preferred_vendor_id
      and vendor.archived_at is null
      and vendor.status <> 'archived'
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_preferred_vendor_invalid';
  end if;
  insert into public.os_inventory_items (
    tenant_id, preferred_vendor_id, name, sku, barcode, qr_code, unit,
    reorder_point, tags, created_by
  ) values (
    p_tenant_id, p_preferred_vendor_id, v_name, v_sku, v_barcode, v_qr_code,
    v_unit, p_reorder_point, v_tags, p_actor_profile_id
  ) returning * into v_item;
  v_response := jsonb_build_object(
    'id', v_item.id, 'name', v_item.name, 'sku', v_item.sku,
    'barcode', v_item.barcode, 'qr_code', v_item.qr_code, 'unit', v_item.unit,
    'reorder_point', v_item.reorder_point::text, 'tags', to_jsonb(v_item.tags),
    'preferred_vendor_id', v_item.preferred_vendor_id, 'status', v_item.status,
    'version', v_item.version, 'created_at', v_item.created_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'CREATE_INVENTORY_ITEM', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_items', v_item.id, v_item.version, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_item_created',
    'os_inventory_items', v_item.id, false, v_request_hash,
    jsonb_build_object('sku', v_item.sku, 'preferred_vendor_id', v_item.preferred_vendor_id)
  );
  return v_response;
end;
$$;

revoke all on function public.create_inventory_item(uuid, uuid, text, text, text, text, text, numeric, text[], uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_inventory_item(uuid, uuid, text, text, text, text, text, numeric, text[], uuid, text)
  to service_role;

create or replace function public.create_inventory_vendor(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_name text,
  p_contact jsonb,
  p_terms jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor public.os_inventory_vendors%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_contact jsonb := coalesce(p_contact, '{}'::jsonb);
  v_terms jsonb := coalesce(p_terms, '{}'::jsonb);
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if char_length(v_name) not between 1 and 160
     or jsonb_typeof(v_contact) <> 'object'
     or jsonb_typeof(v_terms) <> 'object'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_vendor_create_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'name', v_name,
    'contact', v_contact,
    'terms', v_terms
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_vendor_create:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'CREATE_INVENTORY_VENDOR'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  insert into public.os_inventory_vendors (
    tenant_id, name, contact, terms, created_by
  ) values (
    p_tenant_id, v_name, v_contact, v_terms, p_actor_profile_id
  ) returning * into v_vendor;
  v_response := jsonb_build_object(
    'id', v_vendor.id, 'name', v_vendor.name, 'status', v_vendor.status,
    'contact', v_vendor.contact, 'terms', v_vendor.terms,
    'version', v_vendor.version, 'created_at', v_vendor.created_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'CREATE_INVENTORY_VENDOR', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_vendors', v_vendor.id, v_vendor.version, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_vendor_created',
    'os_inventory_vendors', v_vendor.id, false, v_request_hash,
    jsonb_build_object('name', v_vendor.name)
  );
  return v_response;
end;
$$;

revoke all on function public.create_inventory_vendor(uuid, uuid, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_inventory_vendor(uuid, uuid, text, jsonb, jsonb, text)
  to service_role;

create or replace function public.create_inventory_variant(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_item_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_attributes jsonb,
  p_unit_cost_cents bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_variant public.os_inventory_variants%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_sku text := nullif(trim(coalesce(p_sku, '')), '');
  v_barcode text := nullif(trim(coalesce(p_barcode, '')), '');
  v_attributes jsonb := coalesce(p_attributes, '{}'::jsonb);
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_item_id is null
     or char_length(v_name) not between 1 and 160
     or (v_sku is not null and char_length(v_sku) > 120)
     or (v_barcode is not null and char_length(v_barcode) > 160)
     or jsonb_typeof(v_attributes) <> 'object'
     or p_unit_cost_cents is null or p_unit_cost_cents < 0
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_variant_create_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'item_id', p_item_id,
    'name', v_name,
    'sku', v_sku,
    'barcode', v_barcode,
    'attributes', v_attributes,
    'unit_cost_cents', p_unit_cost_cents
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_variant_create:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'CREATE_INVENTORY_VARIANT'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  if not exists (
    select 1 from public.os_inventory_items item
    where item.tenant_id = p_tenant_id
      and item.id = p_item_id
      and item.archived_at is null
      and item.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_item_invalid';
  end if;
  insert into public.os_inventory_variants (
    tenant_id, item_id, name, sku, barcode, attributes, unit_cost_cents, created_by
  ) values (
    p_tenant_id, p_item_id, v_name, v_sku, v_barcode, v_attributes,
    p_unit_cost_cents, p_actor_profile_id
  ) returning * into v_variant;
  v_response := jsonb_build_object(
    'id', v_variant.id, 'item_id', v_variant.item_id, 'name', v_variant.name,
    'sku', v_variant.sku, 'barcode', v_variant.barcode,
    'attributes', v_variant.attributes, 'unit_cost_cents', v_variant.unit_cost_cents,
    'version', v_variant.version, 'created_at', v_variant.created_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'CREATE_INVENTORY_VARIANT', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_variants', v_variant.id, v_variant.version,
    v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_variant_created',
    'os_inventory_variants', v_variant.id, false, v_request_hash,
    jsonb_build_object('item_id', v_variant.item_id, 'sku', v_variant.sku)
  );
  return v_response;
end;
$$;

revoke all on function public.create_inventory_variant(uuid, uuid, uuid, text, text, text, jsonb, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_inventory_variant(uuid, uuid, uuid, text, text, text, jsonb, bigint, text)
  to service_role;

create or replace function public.create_inventory_lot(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_lot_code text,
  p_expires_on date,
  p_received_at timestamptz,
  p_unit_cost_cents bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot public.os_inventory_lots%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_lot_code text := trim(coalesce(p_lot_code, ''));
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_item_id is null
     or char_length(v_lot_code) not between 1 and 120
     or (p_received_at is not null and p_received_at > clock_timestamp() + interval '5 minutes')
     or p_unit_cost_cents is null or p_unit_cost_cents < 0
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_lot_create_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'item_id', p_item_id,
    'variant_id', p_variant_id,
    'lot_code', v_lot_code,
    'expires_on', p_expires_on,
    'received_at', p_received_at,
    'unit_cost_cents', p_unit_cost_cents
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_lot_create:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'CREATE_INVENTORY_LOT'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  if not exists (
    select 1 from public.os_inventory_items item
    where item.tenant_id = p_tenant_id
      and item.id = p_item_id
      and item.archived_at is null
      and item.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_item_invalid';
  end if;
  if p_variant_id is not null and not exists (
    select 1 from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = p_variant_id
      and variant.item_id = p_item_id
      and variant.archived_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_variant_invalid';
  end if;
  insert into public.os_inventory_lots (
    tenant_id, item_id, variant_id, lot_code, expires_on, received_at,
    unit_cost_cents, created_by
  ) values (
    p_tenant_id, p_item_id, p_variant_id, v_lot_code, p_expires_on,
    p_received_at, p_unit_cost_cents, p_actor_profile_id
  ) returning * into v_lot;
  v_response := jsonb_build_object(
    'id', v_lot.id, 'item_id', v_lot.item_id, 'variant_id', v_lot.variant_id,
    'lot_code', v_lot.lot_code, 'expires_on', v_lot.expires_on,
    'received_at', v_lot.received_at, 'unit_cost_cents', v_lot.unit_cost_cents,
    'created_at', v_lot.created_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'CREATE_INVENTORY_LOT', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_inventory_lots', v_lot.id, 1, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_lot_created',
    'os_inventory_lots', v_lot.id, false, v_request_hash,
    jsonb_build_object(
      'item_id', v_lot.item_id, 'variant_id', v_lot.variant_id,
      'lot_code', v_lot.lot_code, 'expires_on', v_lot.expires_on
    )
  );
  return v_response;
end;
$$;

revoke all on function public.create_inventory_lot(uuid, uuid, uuid, uuid, text, date, timestamptz, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_inventory_lot(uuid, uuid, uuid, uuid, text, date, timestamptz, bigint, text)
  to service_role;

create or replace function public.create_draft_purchase_order(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_id uuid,
  p_order_number text,
  p_expected_on date,
  p_subtotal_cents bigint,
  p_tax_cents bigint,
  p_shipping_cents bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_order public.os_purchase_orders%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_order_number text := trim(coalesce(p_order_number, ''));
  v_request_hash text;
  v_response jsonb;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  -- Line extensions are the only subtotal authority. A draft starts at zero
  -- and create_purchase_order_line recalculates it transactionally.
  if p_subtotal_cents is null or p_subtotal_cents <> 0 then
    raise exception using errcode = '22023', message = 'inventory_purchase_order_subtotal_must_be_zero';
  end if;
  if char_length(v_order_number) not between 1 and 120
     or p_tax_cents is null or p_tax_cents < 0
     or p_shipping_cents is null or p_shipping_cents < 0
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_purchase_order_create_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'vendor_id', p_vendor_id,
    'order_number', v_order_number,
    'expected_on', p_expected_on,
    'subtotal_cents', p_subtotal_cents,
    'tax_cents', p_tax_cents,
    'shipping_cents', p_shipping_cents
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_purchase_order_create:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'CREATE_DRAFT_PURCHASE_ORDER'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  if p_vendor_id is not null and not exists (
    select 1 from public.os_inventory_vendors vendor
    where vendor.tenant_id = p_tenant_id
      and vendor.id = p_vendor_id
      and vendor.archived_at is null
      and vendor.status <> 'archived'
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_vendor_invalid';
  end if;
  insert into public.os_purchase_orders (
    tenant_id, vendor_id, order_number, status, expected_on, subtotal_cents,
    tax_cents, shipping_cents, created_by
  ) values (
    p_tenant_id, p_vendor_id, v_order_number, 'draft', p_expected_on,
    p_subtotal_cents, p_tax_cents, p_shipping_cents, p_actor_profile_id
  ) returning * into v_purchase_order;
  v_response := jsonb_build_object(
    'id', v_purchase_order.id, 'vendor_id', v_purchase_order.vendor_id,
    'order_number', v_purchase_order.order_number, 'status', v_purchase_order.status,
    'expected_on', v_purchase_order.expected_on,
    'subtotal_cents', v_purchase_order.subtotal_cents,
    'tax_cents', v_purchase_order.tax_cents,
    'shipping_cents', v_purchase_order.shipping_cents,
    'version', v_purchase_order.version, 'created_at', v_purchase_order.created_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'CREATE_DRAFT_PURCHASE_ORDER', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_purchase_orders', v_purchase_order.id,
    v_purchase_order.version, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_draft_purchase_order_created',
    'os_purchase_orders', v_purchase_order.id, false, v_request_hash,
    jsonb_build_object(
      'vendor_id', v_purchase_order.vendor_id,
      'order_number', v_purchase_order.order_number
    )
  );
  return v_response;
end;
$$;

revoke all on function public.create_draft_purchase_order(uuid, uuid, uuid, text, date, bigint, bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_draft_purchase_order(uuid, uuid, uuid, text, date, bigint, bigint, bigint, text)
  to service_role;

create or replace function public.create_purchase_order_line(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_purchase_order_id uuid,
  p_item_id uuid,
  p_variant_id uuid,
  p_quantity_ordered numeric,
  p_unit_cost_cents bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_order public.os_purchase_orders%rowtype;
  v_line public.os_purchase_order_lines%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_request_hash text;
  v_response jsonb;
  v_reconciled_subtotal numeric;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_purchase_order_id is null or p_item_id is null
     or p_quantity_ordered is null or p_quantity_ordered <= 0
     or p_quantity_ordered > 99999999999.999
     or p_quantity_ordered <> round(p_quantity_ordered, 3)
     or p_unit_cost_cents is null or p_unit_cost_cents <= 0
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_purchase_order_line_create_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'purchase_order_id', p_purchase_order_id,
    'item_id', p_item_id,
    'variant_id', p_variant_id,
    'quantity_ordered', p_quantity_ordered,
    'unit_cost_cents', p_unit_cost_cents
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_purchase_order_line_create:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'CREATE_PURCHASE_ORDER_LINE'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  select * into v_purchase_order
  from public.os_purchase_orders purchase_order
  where purchase_order.tenant_id = p_tenant_id
    and purchase_order.id = p_purchase_order_id
    and purchase_order.archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_purchase_order_not_found';
  end if;
  if v_purchase_order.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_line_create_not_allowed';
  end if;
  if not exists (
    select 1 from public.os_inventory_items item
    where item.tenant_id = p_tenant_id
      and item.id = p_item_id
      and item.archived_at is null
      and item.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_item_invalid';
  end if;
  if p_variant_id is not null and not exists (
    select 1 from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = p_variant_id
      and variant.item_id = p_item_id
      and variant.archived_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'inventory_variant_invalid';
  end if;
  select coalesce(sum(round(line.quantity_ordered * line.unit_cost_cents)), 0)
    + round(p_quantity_ordered * p_unit_cost_cents)
  into v_reconciled_subtotal
  from public.os_purchase_order_lines line
  where line.tenant_id = p_tenant_id
    and line.purchase_order_id = p_purchase_order_id;
  if v_reconciled_subtotal > 9223372036854775807 then
    raise exception using errcode = '22003', message = 'inventory_purchase_order_subtotal_overflow';
  end if;
  insert into public.os_purchase_order_lines (
    tenant_id, purchase_order_id, item_id, variant_id,
    quantity_ordered, quantity_received, unit_cost_cents
  ) values (
    p_tenant_id, p_purchase_order_id, p_item_id, p_variant_id,
    p_quantity_ordered, 0, p_unit_cost_cents
  ) returning * into v_line;
  update public.os_purchase_orders purchase_order
  set subtotal_cents = v_reconciled_subtotal::bigint,
      version = purchase_order.version + 1,
      updated_at = clock_timestamp()
  where purchase_order.tenant_id = p_tenant_id
    and purchase_order.id = p_purchase_order_id
  returning * into v_purchase_order;
  v_response := jsonb_build_object(
    'id', v_line.id, 'purchase_order_id', v_line.purchase_order_id,
    'item_id', v_line.item_id, 'variant_id', v_line.variant_id,
    'quantity_ordered', v_line.quantity_ordered::text,
    'quantity_received', v_line.quantity_received::text,
    'unit_cost_cents', v_line.unit_cost_cents,
    'purchase_order_subtotal_cents', v_purchase_order.subtotal_cents,
    'purchase_order_version', v_purchase_order.version,
    'created_at', v_line.created_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'CREATE_PURCHASE_ORDER_LINE', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_purchase_order_lines', v_line.id, 1, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_purchase_order_line_created',
    'os_purchase_order_lines', v_line.id, false, v_request_hash,
    jsonb_build_object(
      'purchase_order_id', v_line.purchase_order_id,
      'item_id', v_line.item_id,
      'variant_id', v_line.variant_id,
      'quantity_ordered', v_line.quantity_ordered,
      'unit_cost_cents', v_line.unit_cost_cents
    )
  );
  return v_response;
end;
$$;

revoke all on function public.create_purchase_order_line(uuid, uuid, uuid, uuid, uuid, numeric, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_purchase_order_line(uuid, uuid, uuid, uuid, uuid, numeric, bigint, text)
  to service_role;

create or replace function public.receive_purchase_order_line(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_purchase_order_id uuid,
  p_purchase_order_line_id uuid,
  p_expected_purchase_order_version integer,
  p_location_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_order public.os_purchase_orders%rowtype;
  v_line public.os_purchase_order_lines%rowtype;
  v_lot public.os_inventory_lots%rowtype;
  v_location public.os_inventory_locations%rowtype;
  v_movement public.os_stock_transactions%rowtype;
  v_existing public.os_stock_transactions%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_request_hash text;
  v_response jsonb;
  v_all_received boolean;
begin
  perform app_private.assert_inventory_admin(p_tenant_id, p_actor_profile_id);
  if p_purchase_order_id is null or p_purchase_order_line_id is null
     or p_expected_purchase_order_version is null or p_expected_purchase_order_version < 1
     or p_location_id is null or p_lot_id is null
     or p_quantity is null or p_quantity <= 0
     or p_quantity > 99999999999.999
     or p_quantity <> round(p_quantity, 3)
     or p_occurred_at is null
     or p_occurred_at > clock_timestamp() + interval '5 minutes'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_purchase_order_receive_invalid';
  end if;
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'purchase_order_id', p_purchase_order_id,
    'purchase_order_line_id', p_purchase_order_line_id,
    'expected_purchase_order_version', p_expected_purchase_order_version,
    'location_id', p_location_id,
    'lot_id', p_lot_id,
    'quantity', p_quantity
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_purchase_order_receive:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));
  select * into v_replay
  from public.os_inventory_operation_requests operation
  where operation.tenant_id = p_tenant_id
    and operation.operation_name = 'RECEIVE_PURCHASE_ORDER_LINE'
    and operation.request_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_replay.response_payload;
  end if;
  select * into v_existing
  from public.os_stock_transactions movement
  where movement.tenant_id = p_tenant_id
    and movement.idempotency_key = p_idempotency_key;
  if found then
    raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
  end if;
  select * into v_purchase_order
  from public.os_purchase_orders purchase_order
  where purchase_order.tenant_id = p_tenant_id
    and purchase_order.id = p_purchase_order_id
    and purchase_order.archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_purchase_order_not_found';
  end if;
  if v_purchase_order.version <> p_expected_purchase_order_version then
    raise exception using errcode = '40001', message = 'inventory_purchase_order_version_conflict';
  end if;
  if v_purchase_order.status not in ('draft', 'submitted', 'partially_received') then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_receive_not_allowed';
  end if;
  select * into v_line
  from public.os_purchase_order_lines line
  where line.tenant_id = p_tenant_id
    and line.id = p_purchase_order_line_id
    and line.purchase_order_id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_purchase_order_line_not_found';
  end if;
  if p_quantity > v_line.quantity_ordered - v_line.quantity_received then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_receive_quantity_exceeds_outstanding';
  end if;
  if not exists (
    select 1 from public.os_inventory_items item
    where item.tenant_id = p_tenant_id
      and item.id = v_line.item_id
      and item.archived_at is null
      and item.status = 'active'
  ) or (v_line.variant_id is not null and not exists (
    select 1 from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = v_line.variant_id
      and variant.item_id = v_line.item_id
      and variant.archived_at is null
  )) then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_item_invalid';
  end if;
  select * into v_location
  from public.os_inventory_locations location
  where location.tenant_id = p_tenant_id
    and location.id = p_location_id
    and location.status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_location_invalid';
  end if;
  select * into v_lot
  from public.os_inventory_lots lot
  where lot.tenant_id = p_tenant_id
    and lot.id = p_lot_id
    and lot.item_id = v_line.item_id
    and lot.variant_id is not distinct from v_line.variant_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_lot_invalid';
  end if;
  if v_lot.unit_cost_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_lot_cost_required';
  end if;
  if v_lot.unit_cost_cents <> v_line.unit_cost_cents then
    raise exception using errcode = 'P0001', message = 'inventory_purchase_order_lot_cost_mismatch';
  end if;
  if v_lot.expires_on < current_date
     and v_location.location_type in ('nurse_kit', 'event_kit', 'vehicle') then
    raise exception using errcode = 'P0001', message = 'inventory_expired_lot_care_receipt_prohibited';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_balance:' || p_tenant_id::text || ':' || p_location_id::text || ':'
      || v_line.item_id::text || ':' || coalesce(v_line.variant_id::text, '-') || ':'
      || p_lot_id::text,
    0
  ));
  insert into public.os_stock_transactions (
    tenant_id, item_id, variant_id, lot_id, transaction_type, quantity_delta,
    unit_cost_cents, source_type, source_id, idempotency_key, note,
    occurred_at, created_by, to_location_id, operation_request_hash
  ) values (
    p_tenant_id, v_line.item_id, v_line.variant_id, p_lot_id, 'receive', p_quantity,
    v_lot.unit_cost_cents, 'purchase_order', p_purchase_order_id::text,
    p_idempotency_key, 'PURCHASE_ORDER_RECEIPT', p_occurred_at,
    p_actor_profile_id, p_location_id, v_request_hash
  ) returning * into v_movement;
  update public.os_purchase_order_lines line
  set quantity_received = line.quantity_received + p_quantity
  where line.tenant_id = p_tenant_id and line.id = p_purchase_order_line_id
  returning * into v_line;
  select coalesce(bool_and(line.quantity_received >= line.quantity_ordered), false)
  into v_all_received
  from public.os_purchase_order_lines line
  where line.tenant_id = p_tenant_id
    and line.purchase_order_id = p_purchase_order_id;
  update public.os_purchase_orders purchase_order
  set status = case when v_all_received then 'received' else 'partially_received' end,
      version = purchase_order.version + 1,
      updated_at = clock_timestamp()
  where purchase_order.tenant_id = p_tenant_id
    and purchase_order.id = p_purchase_order_id
  returning * into v_purchase_order;
  v_response := jsonb_build_object(
    'movement_id', v_movement.id,
    'purchase_order_id', v_purchase_order.id,
    'purchase_order_line_id', v_line.id,
    'location_id', p_location_id,
    'lot_id', p_lot_id,
    'item_id', v_line.item_id,
    'variant_id', v_line.variant_id,
    'quantity_received', p_quantity::text,
    'line_quantity_received', v_line.quantity_received::text,
    'line_quantity_ordered', v_line.quantity_ordered::text,
    'unit_cost_cents', v_lot.unit_cost_cents,
    'purchase_order_status', v_purchase_order.status,
    'purchase_order_version', v_purchase_order.version,
    'occurred_at', v_movement.occurred_at
  );
  insert into public.os_inventory_operation_requests (
    tenant_id, operation_name, request_idempotency_key, request_hash,
    actor_profile_id, result_entity_type, result_entity_id, result_version,
    response_payload
  ) values (
    p_tenant_id, 'RECEIVE_PURCHASE_ORDER_LINE', p_idempotency_key, v_request_hash,
    p_actor_profile_id, 'os_stock_transactions', v_movement.id,
    v_purchase_order.version, v_response
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_purchase_order_line_received',
    'os_stock_transactions', v_movement.id, false, v_request_hash,
    jsonb_build_object(
      'purchase_order_id', v_purchase_order.id,
      'purchase_order_line_id', v_line.id,
      'location_id', p_location_id,
      'lot_id', p_lot_id,
      'quantity', p_quantity,
      'unit_cost_cents', v_lot.unit_cost_cents,
      'purchase_order_status', v_purchase_order.status,
      'purchase_order_version', v_purchase_order.version
    )
  );
  return v_response;
end;
$$;

revoke all on function public.receive_purchase_order_line(uuid, uuid, uuid, uuid, integer, uuid, uuid, numeric, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.receive_purchase_order_line(uuid, uuid, uuid, uuid, integer, uuid, uuid, numeric, timestamptz, text)
  to service_role;

-- Fail closed: migration 043 exposed browser/operator CRUD on the typed
-- inventory tables. All mutations now cross the audited SECURITY DEFINER RPCs
-- above; browser roles cannot read or write this operational/financial data,
-- and service_role receives read access plus only the explicit RPC grants.
do $$
declare
  protected_existing_table text;
begin
  foreach protected_existing_table in array array[
    'os_inventory_folders', 'os_inventory_vendors', 'os_inventory_items',
    'os_inventory_variants', 'os_inventory_lots', 'os_stock_transactions',
    'os_purchase_orders', 'os_purchase_order_lines'
  ] loop
    execute format('alter table public.%I enable row level security', protected_existing_table);
    execute format('drop policy if exists "os tenant operator access" on public.%I', protected_existing_table);
    execute format('revoke all on public.%I from anon, authenticated, service_role', protected_existing_table);
    execute format('grant select on public.%I to service_role', protected_existing_table);
  end loop;
end $$;

revoke all on public.os_inventory_balances
  from public, anon, authenticated, service_role;
grant select on public.os_inventory_balances to service_role;

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'os_inventory_locations', 'os_inventory_location_par_levels',
    'os_inventory_location_assignments', 'os_inventory_restock_requests',
    'os_inventory_restock_request_lines', 'os_inventory_operation_requests'
  ] loop
    execute format('alter table public.%I enable row level security', protected_table);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', protected_table);
    execute format('grant select on public.%I to service_role', protected_table);
  end loop;
end $$;

revoke all on public.os_inventory_location_balances
  from public, anon, authenticated, service_role;
grant select on public.os_inventory_location_balances to service_role;

comment on table public.os_inventory_locations is
  'Tenant-scoped central, warehouse, event-kit, and nurse-kit custody locations.';
comment on table public.os_inventory_restock_requests is
  'Structured nurse-kit restock requests. No patient, appointment, service, treatment, or unrestricted note fields.';
comment on table public.os_inventory_operation_requests is
  'Append-only request hashes and stable responses for privileged inventory mutations.';
comment on column public.os_stock_transactions.transfer_group_id is
  'Shared immutable identifier for the paired transfer-out and transfer-in rows of an atomic location transfer.';
comment on view public.os_inventory_location_balances is
  'Derived custody balance by location, item, variant, and lot from append-only stock movements.';
