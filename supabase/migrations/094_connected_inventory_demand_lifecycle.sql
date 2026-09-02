-- Independent demand-line decisions and allocation lifecycle with proof-based
-- closure. Original nurse request lines remain immutable lineage records.

begin;

alter table public.os_inventory_allocations add column if not exists handoff_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.os_inventory_allocations'::regclass and conname='os_inventory_allocations_handoff_fk') then
    alter table public.os_inventory_allocations add constraint os_inventory_allocations_handoff_fk
      foreign key(tenant_id,handoff_id) references public.os_inventory_handoffs(tenant_id,id) on delete restrict;
  end if;
end $$;

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
  'RELEASE_INVENTORY_HOLD','ALLOCATE_INVENTORY_DEMAND','TRANSITION_INVENTORY_REQUISITION','RECORD_INVENTORY_SHIPMENT',
  'CREATE_SUPPLY_MANIFEST_VERSION','APPROVE_SUPPLY_MANIFEST_VERSION','EVALUATE_CONNECTED_SHIFT_READINESS',
  'CREATE_INVENTORY_REQUISITION','CONVERT_INVENTORY_REQUISITION','REVIEW_INVENTORY_SUPPLIER',
  'REGISTER_SUPPLIER_CONNECTION','RECORD_INVENTORY_RECALL','RECORD_INVENTORY_TEMPERATURE','RECORD_INVENTORY_CALIBRATION',
  'TRANSITION_INVENTORY_DEMAND','TRANSITION_INVENTORY_ALLOCATION'
));

create or replace function public.transition_inventory_demand(
  p_tenant_id uuid,p_actor_profile_id uuid,p_demand_episode_id uuid,p_action text,p_expected_version integer,p_reason_code text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_demand public.os_inventory_demand_episodes%rowtype; v_replay public.os_inventory_operation_requests%rowtype;
  v_next text; v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_action not in ('triage','approve','partial','deny','cancel','await_purchase','close') or p_expected_version is null or p_expected_version<1
     or v_reason !~ '^[A-Z0-9_]{3,100}$' or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_demand_transition_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('demandEpisodeId',p_demand_episode_id,'action',p_action,'expectedVersion',p_expected_version,'reasonCode',v_reason)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-demand:'||p_tenant_id::text||':'||p_demand_episode_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='TRANSITION_INVENTORY_DEMAND' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_demand from public.os_inventory_demand_episodes where tenant_id=p_tenant_id and id=p_demand_episode_id for update;
  if not found or v_demand.version<>p_expected_version then raise exception using errcode='40001',message='inventory_demand_version_conflict'; end if;
  v_next:=case
    when p_action='triage' and v_demand.status='submitted' then 'triaged'
    when p_action='approve' and v_demand.status in ('submitted','triaged','partial') then 'approved'
    when p_action='partial' and v_demand.status in ('submitted','triaged','approved','allocated') then 'partial'
    when p_action='deny' and v_demand.status in ('submitted','triaged','partial') then 'denied'
    when p_action='cancel' and v_demand.status in ('submitted','triaged','approved','partial','awaiting_purchase') then 'cancelled'
    when p_action='await_purchase' and v_demand.status in ('approved','partial') then 'awaiting_purchase'
    when p_action='close' and v_demand.status in ('received','disputed','allocated','partial') then 'closed'
    else null end;
  if v_next is null then raise exception using errcode='P0001',message='inventory_demand_transition_not_allowed'; end if;
  if p_action='cancel' and exists(select 1 from public.os_inventory_allocations a where a.tenant_id=p_tenant_id and a.demand_episode_id=v_demand.id and a.status in ('picking','in_transit')) then
    raise exception using errcode='P0001',message='inventory_demand_committed_allocation';
  end if;
  if p_action='close' and not (
    exists(select 1 from public.os_inventory_allocations a where a.tenant_id=p_tenant_id and a.demand_episode_id=v_demand.id and a.status='received')
    or exists(select 1 from public.os_inventory_handoffs h where h.tenant_id=p_tenant_id and h.restock_request_id=v_demand.originating_request_id and h.status='received')
    or exists(select 1 from public.os_inventory_exceptions e where e.tenant_id=p_tenant_id and e.entity_id=v_demand.id and e.status='resolved')
  ) then raise exception using errcode='P0001',message='inventory_demand_closure_proof_required'; end if;
  update public.os_inventory_demand_episodes set status=v_next,closed_at=case when v_next='closed' then clock_timestamp() else null end,
    version=version+1,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_demand.id returning * into v_demand;
  v_response:=jsonb_build_object('id',v_demand.id,'status',v_demand.status,'version',v_demand.version,'reasonCode',v_reason);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'TRANSITION_INVENTORY_DEMAND',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_demand_episodes',v_demand.id,v_demand.version,v_response);
  return v_response;
end $$;
revoke all on function public.transition_inventory_demand(uuid,uuid,uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.transition_inventory_demand(uuid,uuid,uuid,text,integer,text,text) to service_role;

create or replace function public.transition_inventory_allocation(
  p_tenant_id uuid,p_actor_profile_id uuid,p_allocation_id uuid,p_action text,p_expected_version integer,p_handoff_id uuid,p_reason_code text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_allocation public.os_inventory_allocations%rowtype; v_demand public.os_inventory_demand_episodes%rowtype;
  v_replay public.os_inventory_operation_requests%rowtype; v_next text; v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_action not in ('start_picking','dispatch','receive','release','cancel','dispute') or p_expected_version is null or p_expected_version<1
     or v_reason !~ '^[A-Z0-9_]{3,100}$' or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_allocation_transition_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('allocationId',p_allocation_id,'action',p_action,'expectedVersion',p_expected_version,'handoffId',p_handoff_id,'reasonCode',v_reason)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-allocation:'||p_tenant_id::text||':'||p_allocation_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='TRANSITION_INVENTORY_ALLOCATION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_allocation from public.os_inventory_allocations where tenant_id=p_tenant_id and id=p_allocation_id for update;
  if not found or v_allocation.version<>p_expected_version then raise exception using errcode='40001',message='inventory_allocation_version_conflict'; end if;
  v_next:=case when p_action='start_picking' and v_allocation.status='reserved' then 'picking'
    when p_action='dispatch' and v_allocation.status='picking' then 'in_transit'
    when p_action='receive' and v_allocation.status='in_transit' then 'received'
    when p_action='release' and v_allocation.status in ('reserved','picking') then 'released'
    when p_action='cancel' and v_allocation.status='reserved' then 'cancelled'
    when p_action='dispute' and v_allocation.status='in_transit' then 'disputed' else null end;
  if v_next is null then raise exception using errcode='P0001',message='inventory_allocation_transition_not_allowed'; end if;
  if p_action in ('dispatch','receive','dispute') and (p_handoff_id is null or not exists(select 1 from public.os_inventory_handoffs h where h.tenant_id=p_tenant_id and h.id=p_handoff_id
      and h.from_location_id=v_allocation.source_location_id and h.to_location_id=v_allocation.destination_location_id
      and ((p_action='dispatch' and h.status in ('in_transit','ready_pickup')) or (p_action='receive' and h.status='received') or (p_action='dispute' and h.status in ('disputed','quarantined'))))) then
    raise exception using errcode='P0001',message='inventory_allocation_handoff_proof_required';
  end if;
  update public.os_inventory_allocations set status=v_next,handoff_id=coalesce(p_handoff_id,handoff_id),version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_allocation.id returning * into v_allocation;
  select * into v_demand from public.os_inventory_demand_episodes where tenant_id=p_tenant_id and id=v_allocation.demand_episode_id for update;
  update public.os_inventory_demand_episodes set status=case when v_next='picking' then 'picking' when v_next='in_transit' then 'in_transit'
      when v_next='received' then 'received' when v_next='disputed' then 'disputed' when v_next in ('released','cancelled') then 'approved' else status end,
    version=version+1,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_demand.id returning * into v_demand;
  v_response:=jsonb_build_object('id',v_allocation.id,'status',v_allocation.status,'version',v_allocation.version,'demandStatus',v_demand.status,'demandVersion',v_demand.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'TRANSITION_INVENTORY_ALLOCATION',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_allocations',v_allocation.id,v_allocation.version,v_response);
  return v_response;
end $$;
revoke all on function public.transition_inventory_allocation(uuid,uuid,uuid,text,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.transition_inventory_allocation(uuid,uuid,uuid,text,integer,uuid,text,text) to service_role;

commit;
