-- Exact shift closeout against pinned reservation IDs. No service-name or SKU
-- guessing is permitted at closeout.

begin;

alter table public.nurse_inventory_reservations
  add column if not exists consumed_quantity numeric(14,3),
  add column if not exists waste_quantity numeric(14,3),
  add column if not exists damaged_quantity numeric(14,3),
  add column if not exists unused_released_quantity numeric(14,3),
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciliation_hash text;
alter table public.nurse_inventory_reservations
  drop constraint if exists nurse_inventory_reservations_reconciliation_check;
alter table public.nurse_inventory_reservations
  add constraint nurse_inventory_reservations_reconciliation_check check (
    (reconciled_at is null and consumed_quantity is null and waste_quantity is null
      and damaged_quantity is null and unused_released_quantity is null and reconciliation_hash is null)
    or (reconciled_at is not null and consumed_quantity>=0 and waste_quantity>=0
      and damaged_quantity>=0 and unused_released_quantity>=0
      and consumed_quantity+waste_quantity+damaged_quantity+unused_released_quantity=quantity
      and reconciliation_hash ~ '^[0-9a-f]{64}$')
  );

create or replace function public.reconcile_shift_inventory(
  p_tenant_id uuid,
  p_nurse_profile_id uuid,
  p_shift_id uuid,
  p_lines jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider_id uuid;
  v_kit_location_id uuid;
  v_movement_location_id uuid;
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_line jsonb;
  v_reservation public.nurse_inventory_reservations%rowtype;
  v_consumed numeric(14,3);
  v_waste numeric(14,3);
  v_damaged numeric(14,3);
  v_unused numeric(14,3);
  v_unit_cost bigint;
  v_response jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines)<>'array'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,100}$' then
    raise exception using errcode='22023',message='shift_inventory_reconciliation_invalid';
  end if;
  v_provider_id:=app_private.require_single_active_nurse_provider(p_tenant_id,p_nurse_profile_id);
  select assignment.location_id into v_kit_location_id
  from public.os_inventory_location_assignments assignment
  where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=v_provider_id
    and assignment.nurse_profile_id=p_nurse_profile_id and assignment.assignment_status='accepted'
    and assignment.ended_at is null order by assignment.is_primary desc,assignment.accepted_at desc limit 1;
  if v_kit_location_id is null then raise exception using errcode='42501',message='active_nurse_kit_custody_required'; end if;
  if not exists (
    select 1 from public.operational_shifts shift
    join public.operational_shift_assignments assignment
      on assignment.tenant_id=shift.tenant_id and assignment.shift_id=shift.id
    where shift.tenant_id=p_tenant_id and shift.id=p_shift_id
      and shift.status in ('in_progress','completed')
      and assignment.provider_profile_id=v_provider_id
      and assignment.status in ('claimed','assigned','completed')
  ) then raise exception using errcode='42501',message='shift_inventory_assignment_required'; end if;
  if not exists (
    select 1 from public.nurse_shift_supply_requirements requirement
    where requirement.tenant_id=p_tenant_id and requirement.shift_id=p_shift_id
      and requirement.invalidated_at is null
  ) then raise exception using errcode='P0001',message='shift_inventory_manifest_required'; end if;
  if not exists (
    select 1 from public.nurse_inventory_reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.shift_id=p_shift_id
      and reservation.provider_profile_id=v_provider_id and reservation.status in ('reserved','consumed')
      and reservation.reconciled_at is null
  ) then raise exception using errcode='P0001',message='shift_inventory_reservations_required'; end if;
  if jsonb_array_length(p_lines)<>(select count(*) from public.nurse_inventory_reservations reservation
      where reservation.tenant_id=p_tenant_id and reservation.shift_id=p_shift_id
        and reservation.provider_profile_id=v_provider_id and reservation.status in ('reserved','consumed')
        and reservation.reconciled_at is null)
     or exists (
       select 1 from jsonb_array_elements(p_lines) supplied
       where coalesce(supplied->>'reservationId','') !~ '^[0-9a-fA-F-]{36}$'
         or coalesce(supplied->>'consumedQuantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
         or coalesce(supplied->>'wasteQuantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
         or coalesce(supplied->>'damagedQuantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
         or not exists (select 1 from public.nurse_inventory_reservations reservation
           where reservation.tenant_id=p_tenant_id and reservation.shift_id=p_shift_id
             and reservation.provider_profile_id=v_provider_id and reservation.status in ('reserved','consumed')
             and reservation.reconciled_at is null
             and reservation.id=(supplied->>'reservationId')::uuid)
     ) or exists (
       select 1 from jsonb_array_elements(p_lines) supplied group by supplied->>'reservationId' having count(*)>1
     ) then raise exception using errcode='22023',message='shift_inventory_reconciliation_lines_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenantId',p_tenant_id,'nurseProfileId',p_nurse_profile_id,'shiftId',p_shift_id,'lines',p_lines
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('shift-inventory:'||p_tenant_id::text||':'||p_shift_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='RECONCILE_SHIFT_INVENTORY'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_reservation from public.nurse_inventory_reservations reservation
      where reservation.tenant_id=p_tenant_id and reservation.id=(v_line->>'reservationId')::uuid for update;
    if not found or v_reservation.shift_id<>p_shift_id or v_reservation.provider_profile_id<>v_provider_id
       or v_reservation.status not in ('reserved','consumed') or v_reservation.reconciled_at is not null then
      raise exception using errcode='40001',message='shift_inventory_reservation_conflict';
    end if;
    v_movement_location_id:=case when v_reservation.status='consumed' then v_kit_location_id else v_reservation.location_id end;
    v_consumed:=(v_line->>'consumedQuantity')::numeric;
    v_waste:=(v_line->>'wasteQuantity')::numeric;
    v_damaged:=(v_line->>'damagedQuantity')::numeric;
    if v_consumed+v_waste+v_damaged>v_reservation.quantity then
      raise exception using errcode='22023',message='shift_inventory_quantity_exceeds_reservation';
    end if;
    v_unused:=v_reservation.quantity-v_consumed-v_waste-v_damaged;
    select lot.unit_cost_cents into v_unit_cost from public.os_inventory_lots lot
      where lot.tenant_id=p_tenant_id and lot.id=v_reservation.lot_id;
    if v_reservation.lot_id is null and exists (
      select 1 from public.os_inventory_location_balances balance
      where balance.tenant_id=p_tenant_id and balance.location_id=v_movement_location_id
        and balance.item_id=v_reservation.item_id
        and balance.variant_id is not distinct from v_reservation.variant_id
        and balance.unit_cost_cents>0
    ) then raise exception using errcode='P0001',message='shift_inventory_costed_lot_required'; end if;
    if v_consumed+v_waste+v_damaged>(select coalesce(sum(balance.quantity_on_hand),0)
      from public.os_inventory_location_balances balance where balance.tenant_id=p_tenant_id
        and balance.location_id=v_movement_location_id and balance.item_id=v_reservation.item_id
        and balance.variant_id is not distinct from v_reservation.variant_id
        and balance.lot_id is not distinct from v_reservation.lot_id) then
      raise exception using errcode='P0001',message='shift_inventory_balance_insufficient';
    end if;
    if v_consumed>0 then
      insert into public.os_stock_transactions (
        tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,source_type,
        source_id,idempotency_key,note,occurred_at,created_by,from_location_id,operation_request_hash
      ) values (p_tenant_id,v_reservation.item_id,v_reservation.variant_id,v_reservation.lot_id,'consume',-v_consumed,
        nullif(v_unit_cost,0),'shift_reservation',v_reservation.id::text,p_idempotency_key||':'||v_reservation.id::text||':use',
        'SHIFT_USE',clock_timestamp(),p_nurse_profile_id,v_movement_location_id,v_hash);
    end if;
    if v_waste>0 then
      insert into public.os_stock_transactions (
        tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,source_type,
        source_id,idempotency_key,note,occurred_at,created_by,from_location_id,operation_request_hash
      ) values (p_tenant_id,v_reservation.item_id,v_reservation.variant_id,v_reservation.lot_id,'shrink',-v_waste,
        nullif(v_unit_cost,0),'shift_reservation',v_reservation.id::text,p_idempotency_key||':'||v_reservation.id::text||':waste',
        'SHIFT_WASTE',clock_timestamp(),p_nurse_profile_id,v_movement_location_id,v_hash);
    end if;
    if v_damaged>0 then
      insert into public.os_stock_transactions (
        tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,source_type,
        source_id,idempotency_key,note,occurred_at,created_by,from_location_id,operation_request_hash
      ) values (p_tenant_id,v_reservation.item_id,v_reservation.variant_id,v_reservation.lot_id,'shrink',-v_damaged,
        nullif(v_unit_cost,0),'shift_reservation',v_reservation.id::text,p_idempotency_key||':'||v_reservation.id::text||':damage',
        'SHIFT_DAMAGE',clock_timestamp(),p_nurse_profile_id,v_movement_location_id,v_hash);
    end if;
    update public.nurse_inventory_reservations reservation set
      status=case when v_consumed+v_waste+v_damaged>0 then 'consumed' else 'released' end,
      consumed_quantity=v_consumed,waste_quantity=v_waste,damaged_quantity=v_damaged,
      unused_released_quantity=v_unused,reconciled_at=clock_timestamp(),reconciliation_hash=v_hash,
      released_at=case when v_unused>0 then clock_timestamp() else null end,
      release_code=case when v_unused>0 then 'SHIFT_UNUSED' else null end,
      version=reservation.version+1,updated_at=clock_timestamp()
      where reservation.tenant_id=p_tenant_id and reservation.id=v_reservation.id;
  end loop;
  update public.os_inventory_exceptions open_exception set status='resolved',resolved_by=p_nurse_profile_id,
    resolved_at=clock_timestamp(),updated_at=clock_timestamp()
    where open_exception.tenant_id=p_tenant_id and open_exception.entity_id=p_shift_id
      and open_exception.exception_type='shift_closeout_reconciliation' and open_exception.status in ('open','investigating');
  v_response:=jsonb_build_object('shiftId',p_shift_id,'status','reconciled','lineCount',jsonb_array_length(p_lines));
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'RECONCILE_SHIFT_INVENTORY',p_idempotency_key,v_hash,p_nurse_profile_id,
    'operational_shifts',p_shift_id,1,v_response);
  insert into public.audit_events (tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload)
    values (p_tenant_id,p_nurse_profile_id,'shift_inventory_reconciled','operational_shifts',p_shift_id,false,v_hash,
      jsonb_build_object('line_count',jsonb_array_length(p_lines)));
  return v_response;
end;
$$;
revoke all on function public.reconcile_shift_inventory(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.reconcile_shift_inventory(uuid,uuid,uuid,jsonb,text) to service_role;

commit;
