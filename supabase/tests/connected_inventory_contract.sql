-- Connected Inventory V1 database postflight contract.
-- Run only after migrations 083-093 in the target Supabase environment.
-- This script is read-only and fails closed on a missing or over-permissive contract.

begin;

do $$
declare
  v_table text;
  v_function text;
  v_column text;
begin
  foreach v_table in array array[
    'os_inventory_kits', 'os_inventory_role_assignments',
    'os_inventory_handoffs', 'os_inventory_handoff_lines',
    'os_inventory_count_sessions', 'os_inventory_count_lines',
    'os_inventory_count_variances', 'os_inventory_demand_episodes',
    'os_inventory_demand_origins', 'os_inventory_exceptions',
    'os_inventory_supplier_items', 'os_inventory_requisitions',
    'os_inventory_requisition_lines', 'os_purchase_order_events',
    'os_purchase_order_execution_attempts',
    'os_inventory_receiving_inspections',
    'os_inventory_receiving_inspection_lines',
    'os_inventory_agent_proposals', 'os_inventory_agent_evaluations',
    'os_inventory_automation_controls', 'os_inventory_procurement_policies',
    'os_inventory_supplier_connections', 'os_inventory_holds',
    'os_inventory_hold_events', 'os_inventory_recall_events',
    'os_inventory_recall_targets', 'os_inventory_temperature_events',
    'os_inventory_calibration_events', 'os_inventory_allocations',
    'os_inventory_readiness_evaluations', 'os_inventory_shipments',
    'os_inventory_shipment_lines', 'os_inventory_requisition_events',
    'os_inventory_supplier_event_inbox'
  ] loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='public' and relation.relname=v_table
        and relation.relkind in ('r','p') and relation.relrowsecurity
    ) then
      raise exception 'connected_inventory_contract: RLS missing for public.%', v_table;
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'connected_inventory_contract: browser role can access public.%', v_table;
    end if;
  end loop;

  foreach v_column in array array[
    'quantity_on_hand', 'quantity_usable', 'quantity_reserved',
    'quantity_available', 'quantity_in_transit', 'quantity_on_order',
    'quantity_quarantined', 'quantity_recalled', 'quantity_expired',
    'quantity_damaged', 'quantity_disputed'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='os_inventory_availability'
        and column_name=v_column
    ) then
      raise exception 'connected_inventory_contract: availability column % missing', v_column;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='os_inventory_available_to_promise'
      and column_name='quantity_pending_allocation'
  ) then
    raise exception 'connected_inventory_contract: allocation-aware availability missing';
  end if;

  foreach v_function in array array[
    'start_inventory_count', 'submit_inventory_count',
    'review_inventory_count', 'dispatch_inventory_handoff',
    'receive_inventory_handoff', 'reconcile_shift_inventory',
    'submit_inventory_purchase_order', 'approve_inventory_purchase_order',
    'record_manual_purchase_order_event',
    'create_inventory_receiving_inspection',
    'post_inventory_receiving_inspection', 'record_inventory_a1_proposal',
    'classify_inventory_item', 'create_inventory_supplier_item',
    'approve_inventory_supplier_item', 'assign_connected_kit_custody',
    'create_inventory_procurement_policy',
    'approve_inventory_procurement_policy',
    'set_inventory_automation_control', 'place_inventory_hold',
    'release_inventory_hold', 'allocate_inventory_demand',
    'transition_inventory_requisition', 'record_inventory_shipment',
    'create_supply_manifest_version', 'approve_supply_manifest_version',
    'evaluate_connected_shift_readiness', 'create_inventory_requisition',
    'convert_inventory_requisition_to_purchase_order',
    'review_inventory_supplier', 'register_inventory_supplier_connection',
    'record_inventory_recall', 'record_inventory_temperature_event',
    'record_inventory_calibration_event', 'transition_inventory_demand',
    'transition_inventory_allocation'
  ] loop
    if not exists (
      select 1 from pg_proc procedure
      join pg_namespace namespace on namespace.oid=procedure.pronamespace
      where namespace.nspname='public' and procedure.proname=v_function
        and procedure.prosecdef
    ) then
      raise exception 'connected_inventory_contract: protected function % missing or not security definer', v_function;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid=procedure.pronamespace
      cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege
      left join pg_roles role on role.oid=privilege.grantee
      where namespace.nspname='public' and procedure.proname=v_function
        and privilege.privilege_type='EXECUTE'
        and (privilege.grantee=0 or role.rolname in ('anon','authenticated'))
    ) then
      raise exception 'connected_inventory_contract: browser role can execute %', v_function;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgname='os_purchase_orders_connected_immutable' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname='os_purchase_order_lines_connected_immutable' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname='os_purchase_order_events_immutable' and not tgisinternal
  ) then
    raise exception 'connected_inventory_contract: approved PO or event immutability trigger missing';
  end if;

  if exists (
    select 1 from public.os_inventory_supplier_connections
    where status not in ('disabled','configuration_required','validation_failed','manual_only')
  ) then
    raise exception 'connected_inventory_contract: executable supplier connection present in V1';
  end if;
end $$;

rollback;
