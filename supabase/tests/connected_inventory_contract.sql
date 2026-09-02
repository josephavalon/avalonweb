-- Connected Inventory V1 database postflight contract.
-- Run only after migrations 083-089 in the target Supabase environment.
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
    'os_inventory_automation_controls', 'os_inventory_procurement_policies'
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
    'set_inventory_automation_control'
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
end $$;

rollback;
