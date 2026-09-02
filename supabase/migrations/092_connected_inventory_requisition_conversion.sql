-- Human procurement requisition creation/recalculation and controlled conversion
-- into a draft PO. Conversion never approves, sends, or pays an order.

begin;

alter table public.os_inventory_requisitions
  add column if not exists supersedes_requisition_id uuid;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.os_inventory_requisitions'::regclass and conname='os_inventory_requisitions_supersedes_fk') then
    alter table public.os_inventory_requisitions add constraint os_inventory_requisitions_supersedes_fk
      foreign key(tenant_id,supersedes_requisition_id) references public.os_inventory_requisitions(tenant_id,id) on delete restrict;
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
  'CREATE_INVENTORY_REQUISITION','CONVERT_INVENTORY_REQUISITION'
));

create or replace function public.create_inventory_requisition(
  p_tenant_id uuid,p_actor_profile_id uuid,p_lines jsonb,p_calculation_trace jsonb,p_expires_at timestamptz,
  p_supersedes_requisition_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_req public.os_inventory_requisitions%rowtype; v_old public.os_inventory_requisitions%rowtype; v_line jsonb;
  v_hash text; v_number text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 or jsonb_array_length(p_lines)>200
     or p_calculation_trace is null or jsonb_typeof(p_calculation_trace)<>'object' or p_expires_at<=clock_timestamp()
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_requisition_invalid'; end if;
  if p_calculation_trace::text ~* '(patient|diagnosis|date of birth|medical record|clinical note)' then raise exception using errcode='22023',message='inventory_requisition_phi_rejected'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('lines',p_lines,'calculationTrace',p_calculation_trace,'expiresAt',p_expires_at,'supersedesRequisitionId',p_supersedes_requisition_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-requisition-create:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='CREATE_INVENTORY_REQUISITION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  if p_supersedes_requisition_id is not null then
    select * into v_old from public.os_inventory_requisitions where tenant_id=p_tenant_id and id=p_supersedes_requisition_id for update;
    if not found or v_old.status not in ('draft','pending_approval','approved') then raise exception using errcode='P0001',message='inventory_requisition_supersede_not_allowed'; end if;
    update public.os_inventory_requisitions set status='expired',version=version+1,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_old.id;
  end if;
  v_number:='REQ-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(v_hash,1,8));
  insert into public.os_inventory_requisitions(tenant_id,requisition_number,source,status,calculation_trace,calculation_hash,created_by,expires_at,supersedes_requisition_id)
    values(p_tenant_id,v_number,'admin','draft',p_calculation_trace,v_hash,p_actor_profile_id,p_expires_at,p_supersedes_requisition_id) returning * into v_req;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if coalesce(v_line->>'demandEpisodeId','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(v_line->>'supplierItemId','') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_line->>'netNeed','') !~ '^[0-9]+(\.[0-9]{1,3})?$' or coalesce(v_line->>'orderPacks','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
       or not exists(select 1 from public.os_inventory_demand_episodes d join public.os_inventory_supplier_items s on s.tenant_id=d.tenant_id and s.id=(v_line->>'supplierItemId')::uuid
         where d.tenant_id=p_tenant_id and d.id=(v_line->>'demandEpisodeId')::uuid and d.item_id=s.item_id and d.variant_id is not distinct from s.variant_id
           and d.status not in ('denied','cancelled','closed') and s.status='approved' and s.price_effective_at<=clock_timestamp() and s.price_expires_at>clock_timestamp()) then
      raise exception using errcode='P0001',message='inventory_requisition_line_not_eligible';
    end if;
    insert into public.os_inventory_requisition_lines(tenant_id,requisition_id,demand_episode_id,supplier_item_id,item_id,variant_id,net_need,order_packs,units_per_pack,proposed_unit_price_cents,need_by,trace)
      select p_tenant_id,v_req.id,d.id,s.id,d.item_id,d.variant_id,(v_line->>'netNeed')::numeric,(v_line->>'orderPacks')::numeric,s.units_per_pack,s.unit_price_cents,d.need_by,v_line
      from public.os_inventory_demand_episodes d join public.os_inventory_supplier_items s on s.tenant_id=d.tenant_id and s.id=(v_line->>'supplierItemId')::uuid
      where d.tenant_id=p_tenant_id and d.id=(v_line->>'demandEpisodeId')::uuid;
  end loop;
  insert into public.os_inventory_requisition_events(tenant_id,requisition_id,event_type,calculation_hash,actor_profile_id,correlation_id)
    values(p_tenant_id,v_req.id,case when p_supersedes_requisition_id is null then 'created' else 'recalculated' end,v_req.calculation_hash,p_actor_profile_id,p_idempotency_key);
  v_response:=jsonb_build_object('id',v_req.id,'requisitionNumber',v_req.requisition_number,'status',v_req.status,'version',v_req.version,'calculationHash',v_req.calculation_hash);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'CREATE_INVENTORY_REQUISITION',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_requisitions',v_req.id,v_req.version,v_response);
  return v_response;
end $$;
revoke all on function public.create_inventory_requisition(uuid,uuid,jsonb,jsonb,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.create_inventory_requisition(uuid,uuid,jsonb,jsonb,timestamptz,uuid,text) to service_role;

create or replace function public.convert_inventory_requisition_to_purchase_order(
  p_tenant_id uuid,p_actor_profile_id uuid,p_requisition_id uuid,p_expected_version integer,p_expected_calculation_hash text,
  p_order_number text,p_expected_on date,p_tax_cents bigint,p_shipping_cents bigint,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_req public.os_inventory_requisitions%rowtype; v_po public.os_purchase_orders%rowtype; v_vendor uuid; v_subtotal bigint; v_vendor_count bigint;
  v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_expected_version is null or p_expected_version<1 or coalesce(p_expected_calculation_hash,'') !~ '^[0-9a-f]{64}$'
     or char_length(trim(coalesce(p_order_number,''))) not between 1 and 100 or p_tax_cents<0 or p_shipping_cents<0
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_requisition_conversion_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('requisitionId',p_requisition_id,'expectedVersion',p_expected_version,'expectedCalculationHash',p_expected_calculation_hash,'orderNumber',trim(p_order_number),'expectedOn',p_expected_on,'taxCents',p_tax_cents,'shippingCents',p_shipping_cents)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-requisition:'||p_tenant_id::text||':'||p_requisition_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='CONVERT_INVENTORY_REQUISITION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_req from public.os_inventory_requisitions where tenant_id=p_tenant_id and id=p_requisition_id for update;
  if not found or v_req.status<>'approved' or v_req.version<>p_expected_version or v_req.calculation_hash<>p_expected_calculation_hash or (v_req.expires_at is not null and v_req.expires_at<=clock_timestamp()) then
    raise exception using errcode='40001',message='inventory_requisition_approved_version_required';
  end if;
  select (array_agg(s.vendor_id order by s.vendor_id))[1],sum((l.order_packs*l.units_per_pack*l.proposed_unit_price_cents)::bigint),count(distinct s.vendor_id)
    into v_vendor,v_subtotal,v_vendor_count from public.os_inventory_requisition_lines l join public.os_inventory_supplier_items s on s.tenant_id=l.tenant_id and s.id=l.supplier_item_id
    where l.tenant_id=p_tenant_id and l.requisition_id=v_req.id and s.status='approved' and s.price_expires_at>clock_timestamp();
  if v_vendor_count<>1 or v_vendor is null then raise exception using errcode='P0001',message='inventory_requisition_single_supplier_required'; end if;
  insert into public.os_purchase_orders(tenant_id,vendor_id,order_number,status,expected_on,subtotal_cents,tax_cents,shipping_cents,created_by,requisition_id)
    values(p_tenant_id,v_vendor,trim(p_order_number),'draft',p_expected_on,v_subtotal,p_tax_cents,p_shipping_cents,p_actor_profile_id,v_req.id) returning * into v_po;
  insert into public.os_purchase_order_lines(tenant_id,purchase_order_id,item_id,variant_id,quantity_ordered,unit_cost_cents)
    select p_tenant_id,v_po.id,l.item_id,l.variant_id,l.order_packs*l.units_per_pack,l.proposed_unit_price_cents
    from public.os_inventory_requisition_lines l where l.tenant_id=p_tenant_id and l.requisition_id=v_req.id;
  update public.os_inventory_requisitions set status='converted',version=version+1,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_req.id returning * into v_req;
  insert into public.os_inventory_requisition_events(tenant_id,requisition_id,event_type,calculation_hash,actor_profile_id,correlation_id)
    values(p_tenant_id,v_req.id,'converted',v_req.calculation_hash,p_actor_profile_id,p_idempotency_key);
  v_response:=jsonb_build_object('requisitionId',v_req.id,'requisitionStatus',v_req.status,'requisitionVersion',v_req.version,'purchaseOrderId',v_po.id,'purchaseOrderStatus',v_po.status,'purchaseOrderVersion',v_po.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'CONVERT_INVENTORY_REQUISITION',p_idempotency_key,v_hash,p_actor_profile_id,'os_purchase_orders',v_po.id,v_po.version,v_response);
  return v_response;
end $$;
revoke all on function public.convert_inventory_requisition_to_purchase_order(uuid,uuid,uuid,integer,text,text,date,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.convert_inventory_requisition_to_purchase_order(uuid,uuid,uuid,integer,text,text,date,bigint,bigint,text) to service_role;

commit;
