-- Connected Inventory V1 safety, allocation, readiness, and supplier-logistics
-- evidence. Supplier connections are references only; this migration grants no
-- network execution, payment, or browser mutation authority.

begin;

do $$
begin
  if to_regclass('public.os_inventory_kits') is null
     or to_regclass('public.os_inventory_demand_episodes') is null
     or to_regclass('public.os_inventory_requisitions') is null
     or to_regclass('public.os_inventory_operation_requests') is null
     or to_regclass('public.nurse_shift_supply_requirements') is null
     or to_regprocedure('app_private.assert_inventory_role(uuid,uuid,text[])') is null then
    raise exception using errcode='P0001',message='connected_inventory_safety_dependencies_required';
  end if;
end $$;

-- Supplier identity and connection health are reviewed independently. Secrets
-- stay in the managed secret store; only an opaque reference may be persisted.
alter table public.os_inventory_vendors
  add column if not exists legal_name text,
  add column if not exists supplier_class text not null default 'unreviewed',
  add column if not exists approved_markets text[] not null default '{}',
  add column if not exists credential_evidence_refs text[] not null default '{}',
  add column if not exists ordering_channel text not null default 'manual',
  add column if not exists change_review_status text not null default 'pending',
  add column if not exists independently_reviewed_by uuid,
  add column if not exists independently_reviewed_at timestamptz;

alter table public.os_inventory_vendors drop constraint if exists os_inventory_vendors_supplier_class_check;
alter table public.os_inventory_vendors add constraint os_inventory_vendors_supplier_class_check
  check (supplier_class in ('unreviewed','general','medical_distributor','manufacturer','pharmacy','3pl','other_reviewed'));
alter table public.os_inventory_vendors drop constraint if exists os_inventory_vendors_ordering_channel_check;
alter table public.os_inventory_vendors add constraint os_inventory_vendors_ordering_channel_check
  check (ordering_channel in ('manual','api_disabled','edi_disabled','structured_sender_disabled'));
alter table public.os_inventory_vendors drop constraint if exists os_inventory_vendors_change_review_check;
alter table public.os_inventory_vendors add constraint os_inventory_vendors_change_review_check check (
  change_review_status in ('pending','approved','rejected','held')
  and (change_review_status<>'approved' or (independently_reviewed_by is not null and independently_reviewed_at is not null))
);

create table if not exists public.os_inventory_supplier_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid not null,
  adapter_key text not null check (adapter_key in ('manual_export','disabled_api','disabled_edi','disabled_structured_sender')),
  status text not null default 'disabled' check (status in ('disabled','configuration_required','validation_failed','manual_only')),
  secret_reference text check (secret_reference is null or secret_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'),
  masked_account_label text,
  health_code text not null default 'NOT_CONFIGURED',
  last_validated_at timestamptz,
  version integer not null default 1 check (version>0),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_supplier_connections_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_supplier_connections_vendor_fk foreign key (tenant_id,vendor_id)
    references public.os_inventory_vendors(tenant_id,id) on delete restrict,
  constraint os_inventory_supplier_connections_actor_fk foreign key (tenant_id,created_by)
    references public.profiles(tenant_id,id) on delete restrict,
  unique (tenant_id,vendor_id,adapter_key)
);

create table if not exists public.os_inventory_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hold_type text not null check (hold_type in ('recall','suspect_product','temperature_excursion','calibration','damage','count_variance','custody_dispute','manual_safety')),
  item_id uuid,
  variant_id uuid,
  lot_id uuid,
  location_id uuid,
  kit_id uuid,
  status text not null default 'active' check (status in ('active','released','disposed','superseded')),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  placed_by uuid not null,
  placed_at timestamptz not null default clock_timestamp(),
  released_by uuid,
  released_at timestamptz,
  release_reason_code text,
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_holds_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_holds_item_fk foreign key (tenant_id,item_id) references public.os_inventory_items(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_variant_fk foreign key (tenant_id,variant_id) references public.os_inventory_variants(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_lot_fk foreign key (tenant_id,lot_id) references public.os_inventory_lots(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_location_fk foreign key (tenant_id,location_id) references public.os_inventory_locations(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_kit_fk foreign key (tenant_id,kit_id) references public.os_inventory_kits(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_placer_fk foreign key (tenant_id,placed_by) references public.profiles(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_releaser_fk foreign key (tenant_id,released_by) references public.profiles(tenant_id,id) on delete restrict,
  constraint os_inventory_holds_scope_check check (num_nonnulls(item_id,variant_id,lot_id,location_id,kit_id)>0),
  constraint os_inventory_holds_release_check check (
    (status='active' and released_by is null and released_at is null and release_reason_code is null)
    or (status<>'active' and released_by is not null and released_at is not null and release_reason_code ~ '^[A-Z0-9_]{3,100}$')
  )
);
create index if not exists os_inventory_holds_active_scope_idx
  on public.os_inventory_holds(tenant_id,status,item_id,variant_id,lot_id,location_id,kit_id) where status='active';

create table if not exists public.os_inventory_hold_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hold_id uuid not null,
  event_type text not null check (event_type in ('placed','released','disposed','superseded')),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  actor_profile_id uuid not null,
  correlation_id text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_hold_events_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_hold_events_hold_fk foreign key (tenant_id,hold_id) references public.os_inventory_holds(tenant_id,id) on delete restrict,
  constraint os_inventory_hold_events_actor_fk foreign key (tenant_id,actor_profile_id) references public.profiles(tenant_id,id) on delete restrict,
  unique (tenant_id,hold_id,correlation_id)
);

create table if not exists public.os_inventory_recall_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_type text not null check (source_type in ('manufacturer','supplier','fda_signal','internal','other_reviewed')),
  source_reference text not null check (char_length(trim(source_reference)) between 1 and 200),
  status text not null default 'investigating' check (status in ('investigating','confirmed','closed','not_applicable')),
  classification text not null default 'pending_review' check (classification in ('pending_review','class_i','class_ii','class_iii','market_withdrawal','safety_alert','other_reviewed')),
  summary_code text not null check (summary_code ~ '^[A-Z0-9_]{3,100}$'),
  opened_by uuid not null,
  reviewed_by uuid,
  opened_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_recall_events_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_recall_events_opener_fk foreign key (tenant_id,opened_by) references public.profiles(tenant_id,id) on delete restrict,
  constraint os_inventory_recall_events_reviewer_fk foreign key (tenant_id,reviewed_by) references public.profiles(tenant_id,id) on delete restrict
);

create table if not exists public.os_inventory_recall_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recall_event_id uuid not null,
  item_id uuid not null,
  variant_id uuid,
  lot_id uuid,
  action_status text not null default 'hold_required' check (action_status in ('hold_required','quarantined','disposed','returned','released_not_affected')),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_recall_targets_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_recall_targets_event_fk foreign key (tenant_id,recall_event_id) references public.os_inventory_recall_events(tenant_id,id) on delete restrict,
  constraint os_inventory_recall_targets_item_fk foreign key (tenant_id,item_id) references public.os_inventory_items(tenant_id,id) on delete restrict,
  constraint os_inventory_recall_targets_variant_fk foreign key (tenant_id,variant_id) references public.os_inventory_variants(tenant_id,id) on delete restrict,
  constraint os_inventory_recall_targets_lot_fk foreign key (tenant_id,lot_id) references public.os_inventory_lots(tenant_id,id) on delete restrict
);
create unique index if not exists os_inventory_recall_targets_key_uidx on public.os_inventory_recall_targets(
  tenant_id,recall_event_id,item_id,coalesce(variant_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid)
);

create table if not exists public.os_inventory_temperature_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  lot_id uuid not null, location_id uuid, event_type text not null check (event_type in ('reading','excursion','evidence_expired','reviewed_safe','quarantined')),
  temperature_c numeric(7,3), observed_at timestamptz not null, evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  actor_profile_id uuid not null, created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_temperature_events_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_temperature_events_lot_fk foreign key (tenant_id,lot_id) references public.os_inventory_lots(tenant_id,id) on delete restrict,
  constraint os_inventory_temperature_events_location_fk foreign key (tenant_id,location_id) references public.os_inventory_locations(tenant_id,id) on delete restrict,
  constraint os_inventory_temperature_events_actor_fk foreign key (tenant_id,actor_profile_id) references public.profiles(tenant_id,id) on delete restrict
);

create table if not exists public.os_inventory_calibration_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null, variant_id uuid, lot_id uuid, event_type text not null check (event_type in ('calibrated','inspection_failed','maintenance_due','retired')),
  effective_at timestamptz not null, expires_at timestamptz, evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  actor_profile_id uuid not null, created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_calibration_events_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_calibration_events_item_fk foreign key (tenant_id,item_id) references public.os_inventory_items(tenant_id,id) on delete restrict,
  constraint os_inventory_calibration_events_variant_fk foreign key (tenant_id,variant_id) references public.os_inventory_variants(tenant_id,id) on delete restrict,
  constraint os_inventory_calibration_events_lot_fk foreign key (tenant_id,lot_id) references public.os_inventory_lots(tenant_id,id) on delete restrict,
  constraint os_inventory_calibration_events_actor_fk foreign key (tenant_id,actor_profile_id) references public.profiles(tenant_id,id) on delete restrict,
  constraint os_inventory_calibration_events_expiry_check check (expires_at is null or expires_at>effective_at)
);

create table if not exists public.os_inventory_allocations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  demand_episode_id uuid not null, source_location_id uuid not null, destination_location_id uuid not null,
  item_id uuid not null, variant_id uuid, lot_id uuid, quantity numeric(14,3) not null check (quantity>0),
  status text not null default 'reserved' check (status in ('reserved','picking','in_transit','received','released','cancelled','disputed')),
  expires_at timestamptz not null, version integer not null default 1 check (version>0), created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_allocations_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_allocations_demand_fk foreign key (tenant_id,demand_episode_id) references public.os_inventory_demand_episodes(tenant_id,id) on delete restrict,
  constraint os_inventory_allocations_source_fk foreign key (tenant_id,source_location_id) references public.os_inventory_locations(tenant_id,id) on delete restrict,
  constraint os_inventory_allocations_destination_fk foreign key (tenant_id,destination_location_id) references public.os_inventory_locations(tenant_id,id) on delete restrict,
  constraint os_inventory_allocations_item_fk foreign key (tenant_id,item_id) references public.os_inventory_items(tenant_id,id) on delete restrict,
  constraint os_inventory_allocations_variant_fk foreign key (tenant_id,variant_id) references public.os_inventory_variants(tenant_id,id) on delete restrict,
  constraint os_inventory_allocations_lot_fk foreign key (tenant_id,lot_id) references public.os_inventory_lots(tenant_id,id) on delete restrict,
  constraint os_inventory_allocations_actor_fk foreign key (tenant_id,created_by) references public.profiles(tenant_id,id) on delete restrict
);
create unique index if not exists os_inventory_allocations_key_uidx on public.os_inventory_allocations(
  tenant_id,demand_episode_id,source_location_id,item_id,
  coalesce(variant_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid)
) where status in ('reserved','picking','in_transit');

create table if not exists public.os_inventory_readiness_evaluations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null, kit_id uuid not null, manifest_version_id uuid not null, ledger_snapshot_hash text not null check (ledger_snapshot_hash ~ '^[0-9a-f]{64}$'),
  reservation_ids uuid[] not null default '{}', count_session_id uuid, evaluator_version text not null,
  outcome text not null check (outcome in ('ready','pickup_required','blocked','expired')),
  rule_results jsonb not null check (jsonb_typeof(rule_results)='array'), evaluated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null, invalidated_at timestamptz, invalidation_code text,
  constraint os_inventory_readiness_evaluations_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_readiness_evaluations_shift_fk foreign key (tenant_id,shift_id) references public.operational_shifts(tenant_id,id) on delete cascade,
  constraint os_inventory_readiness_evaluations_kit_fk foreign key (tenant_id,kit_id) references public.os_inventory_kits(tenant_id,id) on delete restrict,
  constraint os_inventory_readiness_evaluations_manifest_fk foreign key (tenant_id,manifest_version_id) references public.nurse_supply_manifest_versions(tenant_id,id) on delete restrict,
  constraint os_inventory_readiness_evaluations_count_fk foreign key (tenant_id,count_session_id) references public.os_inventory_count_sessions(tenant_id,id) on delete restrict,
  constraint os_inventory_readiness_evaluations_expiry_check check (expires_at>evaluated_at),
  constraint os_inventory_readiness_evaluations_invalidation_check check ((invalidated_at is null and invalidation_code is null) or (invalidated_at is not null and invalidation_code is not null))
);
create unique index if not exists os_inventory_readiness_active_shift_uidx on public.os_inventory_readiness_evaluations(tenant_id,shift_id) where invalidated_at is null and outcome<>'expired';

create or replace function app_private.invalidate_connected_inventory_readiness()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tenant uuid; v_location uuid; v_kit uuid; v_shift uuid; v_code text;
begin
  v_tenant:=coalesce(new.tenant_id,old.tenant_id);
  if tg_table_name='os_stock_transactions' then
    v_location:=coalesce(new.to_location_id,new.from_location_id); v_code:='LEDGER_MOVEMENT';
  elsif tg_table_name='os_inventory_location_assignments' then
    v_kit:=coalesce(new.kit_id,old.kit_id); v_code:='CUSTODY_CHANGED';
  elsif tg_table_name='nurse_inventory_reservations' then
    v_shift:=coalesce(new.shift_id,old.shift_id); v_code:='RESERVATION_CHANGED';
  elsif tg_table_name='nurse_shift_supply_requirements' then
    v_shift:=coalesce(new.shift_id,old.shift_id); v_code:='MANIFEST_CHANGED';
  elsif tg_table_name='operational_shifts' then
    v_shift:=coalesce(new.id,old.id); v_code:='SHIFT_CHANGED';
  elsif tg_table_name='nurse_pickup_tasks' then
    v_shift:=coalesce(new.shift_id,old.shift_id); v_code:='PICKUP_CHANGED';
  else v_code:='INVENTORY_EVIDENCE_CHANGED'; end if;
  update public.os_inventory_readiness_evaluations readiness
    set invalidated_at=clock_timestamp(),invalidation_code=v_code
    where readiness.tenant_id=v_tenant and readiness.invalidated_at is null
      and (v_shift is not null and readiness.shift_id=v_shift
        or v_kit is not null and readiness.kit_id=v_kit
        or v_location is not null and exists(select 1 from public.os_inventory_kits kit where kit.tenant_id=v_tenant and kit.id=readiness.kit_id and kit.location_id=v_location));
  return new;
end $$;
revoke all on function app_private.invalidate_connected_inventory_readiness() from public,anon,authenticated,service_role;
drop trigger if exists os_stock_transactions_invalidate_readiness on public.os_stock_transactions;
create trigger os_stock_transactions_invalidate_readiness after insert on public.os_stock_transactions
  for each row execute function app_private.invalidate_connected_inventory_readiness();
drop trigger if exists os_inventory_assignments_invalidate_readiness on public.os_inventory_location_assignments;
create trigger os_inventory_assignments_invalidate_readiness after insert or update on public.os_inventory_location_assignments
  for each row execute function app_private.invalidate_connected_inventory_readiness();
drop trigger if exists nurse_inventory_reservations_invalidate_connected_readiness on public.nurse_inventory_reservations;
create trigger nurse_inventory_reservations_invalidate_connected_readiness after insert or update on public.nurse_inventory_reservations
  for each row execute function app_private.invalidate_connected_inventory_readiness();
drop trigger if exists nurse_shift_requirements_invalidate_connected_readiness on public.nurse_shift_supply_requirements;
create trigger nurse_shift_requirements_invalidate_connected_readiness after insert or update on public.nurse_shift_supply_requirements
  for each row execute function app_private.invalidate_connected_inventory_readiness();
drop trigger if exists operational_shifts_invalidate_connected_readiness on public.operational_shifts;
create trigger operational_shifts_invalidate_connected_readiness after update on public.operational_shifts
  for each row execute function app_private.invalidate_connected_inventory_readiness();
drop trigger if exists nurse_pickup_tasks_invalidate_connected_readiness on public.nurse_pickup_tasks;
create trigger nurse_pickup_tasks_invalidate_connected_readiness after insert or update on public.nurse_pickup_tasks
  for each row execute function app_private.invalidate_connected_inventory_readiness();

create table if not exists public.os_inventory_shipments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null, shipment_reference text not null, carrier_code text, tracking_reference text,
  status text not null default 'announced' check (status in ('announced','in_transit','delivered_uninspected','partially_received','received','exception','cancelled')),
  expected_at timestamptz, delivered_at timestamptz, evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  version integer not null default 1 check (version>0), recorded_by uuid not null, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_shipments_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_shipments_po_fk foreign key (tenant_id,purchase_order_id) references public.os_purchase_orders(tenant_id,id) on delete restrict,
  constraint os_inventory_shipments_actor_fk foreign key (tenant_id,recorded_by) references public.profiles(tenant_id,id) on delete restrict,
  unique (tenant_id,purchase_order_id,shipment_reference)
);

create table if not exists public.os_inventory_shipment_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid not null, purchase_order_line_id uuid not null, quantity_shipped numeric(14,3) not null check (quantity_shipped>0),
  created_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_shipment_lines_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_shipment_lines_shipment_fk foreign key (tenant_id,shipment_id) references public.os_inventory_shipments(tenant_id,id) on delete restrict,
  constraint os_inventory_shipment_lines_po_line_fk foreign key (tenant_id,purchase_order_line_id) references public.os_purchase_order_lines(tenant_id,id) on delete restrict,
  unique (tenant_id,shipment_id,purchase_order_line_id)
);

create or replace function app_private.guard_connected_po_shipment_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.event_type='shipped' and not exists(
    select 1 from public.os_inventory_shipments shipment
    where shipment.tenant_id=new.tenant_id and shipment.purchase_order_id=new.purchase_order_id
      and shipment.id=nullif(new.evidence->>'shipmentId','')::uuid
  ) then raise exception using errcode='P0001',message='inventory_shipment_evidence_required'; end if;
  return new;
end $$;
revoke all on function app_private.guard_connected_po_shipment_event() from public,anon,authenticated,service_role;
drop trigger if exists os_purchase_order_events_shipment_guard on public.os_purchase_order_events;
create trigger os_purchase_order_events_shipment_guard before insert on public.os_purchase_order_events
  for each row execute function app_private.guard_connected_po_shipment_event();

create table if not exists public.os_inventory_requisition_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  requisition_id uuid not null, event_type text not null check (event_type in ('created','recalculated','submitted','approved','rejected','cancelled','converted','expired')),
  calculation_hash text not null check (calculation_hash ~ '^[0-9a-f]{64}$'), reason_code text,
  actor_profile_id uuid not null, correlation_id text not null, occurred_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_requisition_events_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_requisition_events_req_fk foreign key (tenant_id,requisition_id) references public.os_inventory_requisitions(tenant_id,id) on delete restrict,
  constraint os_inventory_requisition_events_actor_fk foreign key (tenant_id,actor_profile_id) references public.profiles(tenant_id,id) on delete restrict,
  unique (tenant_id,requisition_id,correlation_id)
);

create table if not exists public.os_inventory_supplier_event_inbox (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null, external_event_id text not null, event_type text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'), signature_status text not null check (signature_status in ('unverified','verified','failed','not_applicable_manual')),
  ordering_key text, occurred_at timestamptz, status text not null default 'held' check (status in ('held','proposed','applied','duplicate','rejected','out_of_order')),
  received_at timestamptz not null default clock_timestamp(),
  constraint os_inventory_supplier_event_inbox_tenant_id_id_key unique (tenant_id,id),
  constraint os_inventory_supplier_event_inbox_connection_fk foreign key (tenant_id,connection_id) references public.os_inventory_supplier_connections(tenant_id,id) on delete restrict,
  unique (tenant_id,connection_id,external_event_id)
);

-- All evidence collections are server-only and tenant-filtered by service code.
do $$ declare v_table text; begin
  foreach v_table in array array[
    'os_inventory_supplier_connections','os_inventory_holds','os_inventory_hold_events',
    'os_inventory_recall_events','os_inventory_recall_targets','os_inventory_temperature_events',
    'os_inventory_calibration_events','os_inventory_allocations','os_inventory_readiness_evaluations',
    'os_inventory_shipments','os_inventory_shipment_lines','os_inventory_requisition_events',
    'os_inventory_supplier_event_inbox'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',v_table);
    execute format('grant select on public.%I to service_role',v_table);
  end loop;
end $$;

do $$ declare v_table text; begin
  foreach v_table in array array[
    'os_inventory_hold_events','os_inventory_recall_targets','os_inventory_temperature_events',
    'os_inventory_calibration_events','os_inventory_shipment_lines','os_inventory_requisition_events',
    'os_inventory_supplier_event_inbox'
  ] loop
    execute format('drop trigger if exists %I_immutable on public.%I',v_table,v_table);
    execute format('create trigger %I_immutable before update or delete on public.%I for each row execute function app_private.prevent_os_append_only_mutation()',v_table,v_table);
  end loop;
end $$;

do $$ declare v_table text; begin
  foreach v_table in array array['os_inventory_supplier_connections','os_inventory_holds','os_inventory_recall_events','os_inventory_allocations','os_inventory_shipments'] loop
    execute format('drop trigger if exists touch_%I_updated_at on public.%I',v_table,v_table);
    execute format('create trigger touch_%I_updated_at before update on public.%I for each row execute function public.touch_updated_at()',v_table,v_table);
  end loop;
end $$;

-- Allocations reduce availability before physical movement.
create or replace view public.os_inventory_pending_allocations
with (security_invoker=true) as
select tenant_id,source_location_id as location_id,item_id,variant_id,lot_id,
  sum(quantity)::numeric(14,3) as quantity_pending_allocation
from public.os_inventory_allocations
where status in ('reserved','picking') and expires_at>clock_timestamp()
group by tenant_id,source_location_id,item_id,variant_id,lot_id;
revoke all on public.os_inventory_pending_allocations from public,anon,authenticated;
grant select on public.os_inventory_pending_allocations to service_role;

create or replace view public.os_inventory_available_to_promise
with (security_invoker=true) as
select a.tenant_id,a.location_id,a.location_type,a.item_id,a.variant_id,a.lot_id,
  a.quantity_on_hand,a.quantity_usable,a.quantity_reserved,
  a.quantity_available as quantity_available_before_allocations,
  coalesce(p.quantity_pending_allocation,0)::numeric(14,3) as quantity_pending_allocation,
  greatest(a.quantity_available-coalesce(p.quantity_pending_allocation,0),0)::numeric(14,3) as quantity_available,
  a.quantity_in_transit,a.quantity_on_order,a.quantity_quarantined,a.quantity_recalled,
  a.quantity_expired,a.quantity_damaged,a.quantity_disputed,a.last_movement_at
from public.os_inventory_availability a
left join public.os_inventory_pending_allocations p on p.tenant_id=a.tenant_id and p.location_id=a.location_id
  and p.item_id=a.item_id and p.variant_id is not distinct from a.variant_id and p.lot_id is not distinct from a.lot_id;
revoke all on public.os_inventory_available_to_promise from public,anon,authenticated;
grant select on public.os_inventory_available_to_promise to service_role;

-- Add the remaining semantic commands to the idempotent operation registry.
alter table public.os_inventory_operation_requests drop constraint if exists os_inventory_operation_requests_name_check;
alter table public.os_inventory_operation_requests add constraint os_inventory_operation_requests_name_check check (operation_name in (
  'SET_PAR_LEVEL','TRANSITION_RESTOCK_REQUEST','ADMIN_INVENTORY_MOVEMENT','FULFILL_RESTOCK_REQUEST',
  'CREATE_INVENTORY_ITEM','CREATE_INVENTORY_VARIANT','CREATE_INVENTORY_LOT','CREATE_INVENTORY_VENDOR',
  'CREATE_DRAFT_PURCHASE_ORDER','CREATE_PURCHASE_ORDER_LINE','RECEIVE_PURCHASE_ORDER_LINE','START_INVENTORY_COUNT',
  'SUBMIT_INVENTORY_COUNT','REVIEW_INVENTORY_COUNT','CREATE_CONNECTED_RESTOCK','DISPATCH_INVENTORY_HANDOFF',
  'RECEIVE_INVENTORY_HANDOFF','SUBMIT_PURCHASE_ORDER','APPROVE_PURCHASE_ORDER','RECORD_PURCHASE_ORDER_EVENT',
  'CREATE_RECEIVING_INSPECTION','POST_RECEIVING_INSPECTION','RECORD_A1_PROPOSAL','ACCEPT_CONNECTED_KIT_CUSTODY',
  'DISPUTE_CONNECTED_KIT_CUSTODY','RECONCILE_SHIFT_INVENTORY','CLASSIFY_INVENTORY_ITEM','CREATE_SUPPLIER_ITEM',
  'APPROVE_SUPPLIER_ITEM','REQUEST_KIT_RETURN','REPORT_KIT_LOST','ASSIGN_KIT_CUSTODY',
  'CREATE_PROCUREMENT_POLICY','APPROVE_PROCUREMENT_POLICY','SET_AUTOMATION_CONTROL','PLACE_INVENTORY_HOLD',
  'RELEASE_INVENTORY_HOLD','ALLOCATE_INVENTORY_DEMAND','TRANSITION_INVENTORY_REQUISITION','RECORD_INVENTORY_SHIPMENT'
));

create or replace function public.place_inventory_hold(
  p_tenant_id uuid,p_actor_profile_id uuid,p_hold_type text,p_item_id uuid,p_variant_id uuid,p_lot_id uuid,
  p_location_id uuid,p_kit_id uuid,p_reason_code text,p_evidence jsonb,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_hold public.os_inventory_holds%rowtype; v_replay public.os_inventory_operation_requests%rowtype;
  v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin','clinical_approver']::text[]);
  if p_hold_type not in ('recall','suspect_product','temperature_excursion','calibration','damage','count_variance','custody_dispute','manual_safety')
     or num_nonnulls(p_item_id,p_variant_id,p_lot_id,p_location_id,p_kit_id)=0 or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or p_evidence is null or jsonb_typeof(p_evidence)<>'object'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_hold_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('holdType',p_hold_type,'itemId',p_item_id,'variantId',p_variant_id,
    'lotId',p_lot_id,'locationId',p_location_id,'kitId',p_kit_id,'reasonCode',v_reason,'evidence',p_evidence)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-hold:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='PLACE_INVENTORY_HOLD' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  insert into public.os_inventory_holds(tenant_id,hold_type,item_id,variant_id,lot_id,location_id,kit_id,reason_code,evidence,placed_by)
    values(p_tenant_id,p_hold_type,p_item_id,p_variant_id,p_lot_id,p_location_id,p_kit_id,v_reason,p_evidence,p_actor_profile_id) returning * into v_hold;
  if p_lot_id is not null then
    update public.os_inventory_lots set disposition_status=case when p_hold_type='recall' then 'recalled' else 'quarantine' end,
      disposition_reason_code=v_reason,disposition_changed_at=clock_timestamp(),disposition_changed_by=p_actor_profile_id
    where tenant_id=p_tenant_id and id=p_lot_id and disposition_status not in ('expired','consumed','retired');
  end if;
  insert into public.os_inventory_hold_events(tenant_id,hold_id,event_type,reason_code,evidence,actor_profile_id,correlation_id)
    values(p_tenant_id,v_hold.id,'placed',v_reason,p_evidence,p_actor_profile_id,p_idempotency_key);
  update public.os_inventory_readiness_evaluations set invalidated_at=clock_timestamp(),invalidation_code='SAFETY_HOLD'
    where tenant_id=p_tenant_id and invalidated_at is null and (kit_id=p_kit_id or p_kit_id is null);
  v_response:=jsonb_build_object('id',v_hold.id,'status',v_hold.status,'version',v_hold.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'PLACE_INVENTORY_HOLD',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_holds',v_hold.id,v_hold.version,v_response);
  return v_response;
end $$;
revoke all on function public.place_inventory_hold(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.place_inventory_hold(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,text,jsonb,text) to service_role;

create or replace function public.release_inventory_hold(
  p_tenant_id uuid,p_actor_profile_id uuid,p_hold_id uuid,p_expected_version integer,p_reason_code text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_hold public.os_inventory_holds%rowtype; v_replay public.os_inventory_operation_requests%rowtype;
  v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['clinical_approver']::text[]);
  if p_expected_version is null or p_expected_version<1 or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_hold_release_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('holdId',p_hold_id,'expectedVersion',p_expected_version,'reasonCode',v_reason)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-hold:'||p_tenant_id::text||':'||p_hold_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='RELEASE_INVENTORY_HOLD' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_hold from public.os_inventory_holds where tenant_id=p_tenant_id and id=p_hold_id for update;
  if not found or v_hold.status<>'active' or v_hold.version<>p_expected_version then raise exception using errcode='40001',message='inventory_hold_version_conflict'; end if;
  update public.os_inventory_holds set status='released',released_by=p_actor_profile_id,released_at=clock_timestamp(),release_reason_code=v_reason,version=version+1
    where tenant_id=p_tenant_id and id=p_hold_id returning * into v_hold;
  if v_hold.lot_id is not null and not exists(select 1 from public.os_inventory_holds h where h.tenant_id=p_tenant_id and h.lot_id=v_hold.lot_id and h.status='active') then
    update public.os_inventory_lots set disposition_status='available',disposition_reason_code=null,disposition_changed_at=clock_timestamp(),disposition_changed_by=p_actor_profile_id
      where tenant_id=p_tenant_id and id=v_hold.lot_id and disposition_status in ('quarantine','recalled');
  end if;
  insert into public.os_inventory_hold_events(tenant_id,hold_id,event_type,reason_code,evidence,actor_profile_id,correlation_id)
    values(p_tenant_id,v_hold.id,'released',v_reason,'{}'::jsonb,p_actor_profile_id,p_idempotency_key);
  v_response:=jsonb_build_object('id',v_hold.id,'status',v_hold.status,'version',v_hold.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'RELEASE_INVENTORY_HOLD',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_holds',v_hold.id,v_hold.version,v_response);
  return v_response;
end $$;
revoke all on function public.release_inventory_hold(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.release_inventory_hold(uuid,uuid,uuid,integer,text,text) to service_role;

create or replace function public.allocate_inventory_demand(
  p_tenant_id uuid,p_actor_profile_id uuid,p_demand_episode_id uuid,p_source_location_id uuid,
  p_lot_id uuid,p_quantity numeric,p_expires_at timestamptz,p_expected_version integer,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_demand public.os_inventory_demand_episodes%rowtype; v_allocation public.os_inventory_allocations%rowtype;
  v_available numeric(14,3); v_pending numeric(14,3); v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_quantity is null or p_quantity<=0 or p_quantity<>round(p_quantity,3) or p_expires_at<=clock_timestamp()
     or p_expected_version is null or p_expected_version<1 or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_allocation_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('demandEpisodeId',p_demand_episode_id,'sourceLocationId',p_source_location_id,'lotId',p_lot_id,'quantity',p_quantity,'expiresAt',p_expires_at,'expectedVersion',p_expected_version)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-demand:'||p_tenant_id::text||':'||p_demand_episode_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='ALLOCATE_INVENTORY_DEMAND' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_demand from public.os_inventory_demand_episodes where tenant_id=p_tenant_id and id=p_demand_episode_id for update;
  if not found or v_demand.version<>p_expected_version or v_demand.status in ('denied','cancelled','closed','received') then raise exception using errcode='40001',message='inventory_demand_version_conflict'; end if;
  if exists(select 1 from public.os_inventory_holds h where h.tenant_id=p_tenant_id and h.status='active' and (h.item_id=v_demand.item_id or h.variant_id=v_demand.variant_id or h.lot_id=p_lot_id or h.location_id=p_source_location_id)) then
    raise exception using errcode='P0001',message='inventory_allocation_safety_hold';
  end if;
  select coalesce(sum(a.quantity_available),0) into v_available from public.os_inventory_availability a
    where a.tenant_id=p_tenant_id and a.location_id=p_source_location_id and a.item_id=v_demand.item_id
      and a.variant_id is not distinct from v_demand.variant_id and a.lot_id is not distinct from p_lot_id;
  select coalesce(sum(a.quantity),0) into v_pending from public.os_inventory_allocations a
    where a.tenant_id=p_tenant_id and a.source_location_id=p_source_location_id and a.item_id=v_demand.item_id
      and a.variant_id is not distinct from v_demand.variant_id and a.lot_id is not distinct from p_lot_id
      and a.status in ('reserved','picking') and a.expires_at>clock_timestamp();
  if v_available-v_pending<p_quantity then raise exception using errcode='P0001',message='inventory_allocation_insufficient_available'; end if;
  insert into public.os_inventory_allocations(tenant_id,demand_episode_id,source_location_id,destination_location_id,item_id,variant_id,lot_id,quantity,expires_at,created_by)
    values(p_tenant_id,v_demand.id,p_source_location_id,v_demand.location_id,v_demand.item_id,v_demand.variant_id,p_lot_id,p_quantity,p_expires_at,p_actor_profile_id) returning * into v_allocation;
  update public.os_inventory_demand_episodes set status=case when p_quantity<validated_quantity then 'partial' else 'allocated' end,version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_demand.id returning * into v_demand;
  v_response:=jsonb_build_object('id',v_allocation.id,'status',v_allocation.status,'version',v_allocation.version,'demandStatus',v_demand.status,'demandVersion',v_demand.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'ALLOCATE_INVENTORY_DEMAND',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_allocations',v_allocation.id,v_allocation.version,v_response);
  return v_response;
end $$;
revoke all on function public.allocate_inventory_demand(uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.allocate_inventory_demand(uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,integer,text) to service_role;

create or replace function public.transition_inventory_requisition(
  p_tenant_id uuid,p_actor_profile_id uuid,p_requisition_id uuid,p_action text,p_expected_version integer,p_expected_calculation_hash text,p_reason_code text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_req public.os_inventory_requisitions%rowtype; v_replay public.os_inventory_operation_requests%rowtype;
  v_hash text; v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_next text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_action not in ('submit','approve','reject','cancel','expire') or p_expected_version is null or p_expected_version<1
     or coalesce(p_expected_calculation_hash,'') !~ '^[0-9a-f]{64}$' or (p_action in ('reject','cancel') and v_reason !~ '^[A-Z0-9_]{3,100}$')
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_requisition_transition_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('requisitionId',p_requisition_id,'action',p_action,'expectedVersion',p_expected_version,'expectedCalculationHash',p_expected_calculation_hash,'reasonCode',nullif(v_reason,''))::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-requisition:'||p_tenant_id::text||':'||p_requisition_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='TRANSITION_INVENTORY_REQUISITION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_req from public.os_inventory_requisitions where tenant_id=p_tenant_id and id=p_requisition_id for update;
  if not found or v_req.version<>p_expected_version or v_req.calculation_hash<>p_expected_calculation_hash then raise exception using errcode='40001',message='inventory_requisition_version_conflict'; end if;
  v_next:=case when p_action='submit' and v_req.status='draft' then 'pending_approval' when p_action='approve' and v_req.status='pending_approval' then 'approved'
    when p_action='reject' and v_req.status='pending_approval' then 'rejected' when p_action='cancel' and v_req.status in ('draft','pending_approval','approved') then 'cancelled'
    when p_action='expire' and v_req.status in ('draft','pending_approval','approved') then 'expired' else null end;
  if v_next is null then raise exception using errcode='P0001',message='inventory_requisition_transition_not_allowed'; end if;
  if p_action='approve' and v_req.created_by=p_actor_profile_id then raise exception using errcode='42501',message='inventory_requisition_self_approval_prohibited'; end if;
  update public.os_inventory_requisitions set status=v_next,version=version+1,submitted_by=case when p_action='submit' then p_actor_profile_id else submitted_by end,
    submitted_at=case when p_action='submit' then clock_timestamp() else submitted_at end,approved_by=case when p_action='approve' then p_actor_profile_id else approved_by end,
    approved_at=case when p_action='approve' then clock_timestamp() else approved_at end,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=p_requisition_id returning * into v_req;
  insert into public.os_inventory_requisition_events(tenant_id,requisition_id,event_type,calculation_hash,reason_code,actor_profile_id,correlation_id)
    values(p_tenant_id,v_req.id,p_action,v_req.calculation_hash,nullif(v_reason,''),p_actor_profile_id,p_idempotency_key);
  v_response:=jsonb_build_object('id',v_req.id,'status',v_req.status,'version',v_req.version,'calculationHash',v_req.calculation_hash);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'TRANSITION_INVENTORY_REQUISITION',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_requisitions',v_req.id,v_req.version,v_response);
  return v_response;
end $$;
revoke all on function public.transition_inventory_requisition(uuid,uuid,uuid,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.transition_inventory_requisition(uuid,uuid,uuid,text,integer,text,text,text) to service_role;

create or replace function public.record_inventory_shipment(
  p_tenant_id uuid,p_actor_profile_id uuid,p_purchase_order_id uuid,p_shipment_reference text,p_carrier_code text,p_tracking_reference text,
  p_expected_at timestamptz,p_lines jsonb,p_evidence jsonb,p_expected_po_version integer,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_po public.os_purchase_orders%rowtype; v_shipment public.os_inventory_shipments%rowtype; v_line jsonb;
  v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if coalesce(trim(p_shipment_reference),'')='' or char_length(p_shipment_reference)>180 or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0
     or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or p_expected_po_version is null or p_expected_po_version<1
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_shipment_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('purchaseOrderId',p_purchase_order_id,'shipmentReference',trim(p_shipment_reference),'carrierCode',p_carrier_code,'trackingReference',p_tracking_reference,'expectedAt',p_expected_at,'lines',p_lines,'evidence',p_evidence,'expectedPoVersion',p_expected_po_version)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-shipment:'||p_tenant_id::text||':'||p_purchase_order_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='RECORD_INVENTORY_SHIPMENT' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_po from public.os_purchase_orders where tenant_id=p_tenant_id and id=p_purchase_order_id for update;
  if not found or v_po.version<>p_expected_po_version or v_po.status not in ('sent','acknowledged','partially_received') or v_po.approved_payload_hash is distinct from v_po.payload_hash then
    raise exception using errcode='P0001',message='inventory_shipment_approved_order_required';
  end if;
  insert into public.os_inventory_shipments(tenant_id,purchase_order_id,shipment_reference,carrier_code,tracking_reference,status,expected_at,evidence,recorded_by)
    values(p_tenant_id,v_po.id,trim(p_shipment_reference),nullif(trim(p_carrier_code),''),nullif(trim(p_tracking_reference),''),'in_transit',p_expected_at,p_evidence,p_actor_profile_id) returning * into v_shipment;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if coalesce(v_line->>'purchaseOrderLineId','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(v_line->>'quantityShipped','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
       or not exists(select 1 from public.os_purchase_order_lines l where l.tenant_id=p_tenant_id and l.id=(v_line->>'purchaseOrderLineId')::uuid and l.purchase_order_id=v_po.id and (v_line->>'quantityShipped')::numeric>0) then
      raise exception using errcode='22023',message='inventory_shipment_line_invalid';
    end if;
    insert into public.os_inventory_shipment_lines(tenant_id,shipment_id,purchase_order_line_id,quantity_shipped)
      values(p_tenant_id,v_shipment.id,(v_line->>'purchaseOrderLineId')::uuid,(v_line->>'quantityShipped')::numeric);
  end loop;
  insert into public.os_purchase_order_events(tenant_id,purchase_order_id,event_type,payload_hash,correlation_id,evidence,actor_profile_id)
    values(p_tenant_id,v_po.id,'shipped',v_po.payload_hash,p_idempotency_key,jsonb_build_object('shipmentId',v_shipment.id,'shipmentReference',v_shipment.shipment_reference),p_actor_profile_id);
  v_response:=jsonb_build_object('id',v_shipment.id,'status',v_shipment.status,'version',v_shipment.version,'purchaseOrderId',v_po.id);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'RECORD_INVENTORY_SHIPMENT',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_shipments',v_shipment.id,v_shipment.version,v_response);
  return v_response;
end $$;
revoke all on function public.record_inventory_shipment(uuid,uuid,uuid,text,text,text,timestamptz,jsonb,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.record_inventory_shipment(uuid,uuid,uuid,text,text,text,timestamptz,jsonb,jsonb,integer,text) to service_role;

comment on table public.os_inventory_supplier_connections is 'Secret references and masked health only. No connection is executable in Connected Inventory V1.';
comment on table public.os_inventory_supplier_event_inbox is 'Untrusted supplier events are held as immutable evidence; they cannot directly mutate stock or policy.';
comment on table public.os_inventory_readiness_evaluations is 'Short-lived derived evidence only; readiness is never manually asserted.';

commit;
