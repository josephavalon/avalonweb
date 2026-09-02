-- Controlled procurement, receiving inspection, and A1 draft persistence.
-- Option A is manual export only; there is no supplier transport or payment.

begin;

create or replace function app_private.guard_connected_purchase_order_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status<>'draft' and (
    new.tenant_id is distinct from old.tenant_id
    or new.vendor_id is distinct from old.vendor_id
    or new.order_number is distinct from old.order_number
    or new.expected_on is distinct from old.expected_on
    or new.subtotal_cents is distinct from old.subtotal_cents
    or new.tax_cents is distinct from old.tax_cents
    or new.shipping_cents is distinct from old.shipping_cents
    or new.requisition_id is distinct from old.requisition_id
    or new.ship_to_location_id is distinct from old.ship_to_location_id
    or new.payload is distinct from old.payload
    or new.payload_hash is distinct from old.payload_hash
  ) then raise exception using errcode='42501',message='inventory_approved_payload_immutable'; end if;
  if old.approved_payload_hash is not null and (
    new.approved_payload_hash is distinct from old.approved_payload_hash
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  ) then raise exception using errcode='42501',message='inventory_purchase_order_approval_immutable'; end if;
  return new;
end;
$$;
revoke all on function app_private.guard_connected_purchase_order_mutation() from public,anon,authenticated,service_role;
drop trigger if exists os_purchase_orders_connected_immutable on public.os_purchase_orders;
create trigger os_purchase_orders_connected_immutable before update on public.os_purchase_orders
  for each row execute function app_private.guard_connected_purchase_order_mutation();

create or replace function app_private.guard_connected_purchase_order_line_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_status text; v_tenant_id uuid; v_purchase_order_id uuid;
begin
  v_tenant_id:=case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
  v_purchase_order_id:=case when tg_op='DELETE' then old.purchase_order_id else new.purchase_order_id end;
  select status into v_status from public.os_purchase_orders po
  where po.tenant_id=v_tenant_id and po.id=v_purchase_order_id for share;
  if v_status is null then raise exception using errcode='P0002',message='inventory_purchase_order_not_found'; end if;
  if tg_op in ('INSERT','DELETE') and v_status<>'draft' then
    raise exception using errcode='42501',message='inventory_approved_payload_immutable';
  end if;
  if tg_op='UPDATE' and v_status<>'draft' and (
    new.tenant_id is distinct from old.tenant_id
    or new.purchase_order_id is distinct from old.purchase_order_id
    or new.item_id is distinct from old.item_id
    or new.variant_id is distinct from old.variant_id
    or new.quantity_ordered is distinct from old.quantity_ordered
    or new.unit_cost_cents is distinct from old.unit_cost_cents
  ) then raise exception using errcode='42501',message='inventory_approved_payload_immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.guard_connected_purchase_order_line_mutation() from public,anon,authenticated,service_role;
drop trigger if exists os_purchase_order_lines_connected_immutable on public.os_purchase_order_lines;
create trigger os_purchase_order_lines_connected_immutable
  before insert or update or delete on public.os_purchase_order_lines
  for each row execute function app_private.guard_connected_purchase_order_line_mutation();

create or replace function public.submit_inventory_purchase_order(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_purchase_order_id uuid,
  p_expected_version integer,
  p_ship_to_location_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po public.os_purchase_orders%rowtype;
  v_payload jsonb;
  v_payload_hash text;
  v_request_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_expected_version is null or p_expected_version<1
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023', message='inventory_purchase_order_submit_invalid';
  end if;
  v_request_hash:=encode(extensions.digest(jsonb_build_object(
    'tenant_id',p_tenant_id,'actor_profile_id',p_actor_profile_id,
    'purchase_order_id',p_purchase_order_id,'expected_version',p_expected_version,
    'ship_to_location_id',p_ship_to_location_id
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('po-submit:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='SUBMIT_PURCHASE_ORDER'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_request_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_po from public.os_purchase_orders po
    where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_purchase_order_not_found'; end if;
  if v_po.version<>p_expected_version or v_po.status<>'draft' then
    raise exception using errcode='40001',message='inventory_purchase_order_version_conflict';
  end if;
  if v_po.vendor_id is null or not exists (
    select 1 from public.os_inventory_locations location
    where location.tenant_id=p_tenant_id and location.id=p_ship_to_location_id
      and location.status='active' and location.location_type in ('central','warehouse','quarantine')
  ) then raise exception using errcode='P0001',message='inventory_purchase_order_submit_invalid'; end if;
  if not exists (
    select 1 from public.os_purchase_order_lines line
    where line.tenant_id=p_tenant_id and line.purchase_order_id=p_purchase_order_id
  ) then raise exception using errcode='P0001',message='inventory_purchase_order_lines_required'; end if;
  if exists (
    select 1
    from public.os_purchase_order_lines line
    join public.os_inventory_items item
      on item.tenant_id=line.tenant_id and item.id=line.item_id
    left join public.os_inventory_supplier_items supplier_item
      on supplier_item.tenant_id=line.tenant_id and supplier_item.vendor_id=v_po.vendor_id
      and supplier_item.item_id=line.item_id
      and supplier_item.variant_id is not distinct from line.variant_id
      and supplier_item.status='approved' and supplier_item.price_expires_at>clock_timestamp()
    where line.tenant_id=p_tenant_id and line.purchase_order_id=p_purchase_order_id
      and (item.regulated_class='unknown' or item.classification_reviewed_at is null
        or coalesce(item.storage_policy->>'storageClass','')=''
        or supplier_item.id is null or supplier_item.units_per_pack<=0
        or supplier_item.price_effective_at>clock_timestamp()
        or line.unit_cost_cents<>supplier_item.unit_price_cents
        or line.quantity_ordered/supplier_item.units_per_pack<supplier_item.minimum_order_packs
        or mod(line.quantity_ordered/supplier_item.units_per_pack,supplier_item.order_multiple_packs)<>0)
  ) then raise exception using errcode='P0001',message='inventory_purchase_order_catalog_hold'; end if;
  if v_po.subtotal_cents<>(select coalesce(sum(round(line.quantity_ordered*line.unit_cost_cents)),0)::bigint
      from public.os_purchase_order_lines line
      where line.tenant_id=p_tenant_id and line.purchase_order_id=p_purchase_order_id) then
    raise exception using errcode='P0001',message='inventory_purchase_order_total_mismatch';
  end if;
  select jsonb_build_object(
    'purchaseOrderId',v_po.id,'orderNumber',v_po.order_number,'vendorId',v_po.vendor_id,
    'vendorName',(select vendor.name from public.os_inventory_vendors vendor
      where vendor.tenant_id=p_tenant_id and vendor.id=v_po.vendor_id),
    'vendorTerms',(select vendor.terms from public.os_inventory_vendors vendor
      where vendor.tenant_id=p_tenant_id and vendor.id=v_po.vendor_id),
    'shipToLocationId',p_ship_to_location_id,
    'shipTo',(select jsonb_build_object('locationId',location.id,'locationCode',location.location_code,'name',location.name)
      from public.os_inventory_locations location
      where location.tenant_id=p_tenant_id and location.id=p_ship_to_location_id),
    'expectedOn',v_po.expected_on,
    'currency','USD','subtotalCents',v_po.subtotal_cents,'taxCents',v_po.tax_cents,
    'shippingCents',v_po.shipping_cents,
    'maximumTotalCents',v_po.subtotal_cents+v_po.tax_cents+v_po.shipping_cents,
    'substitutionRule','PROHIBITED',
    'lines',jsonb_agg(jsonb_build_object(
      'purchaseOrderLineId',line.id,'itemId',line.item_id,'variantId',line.variant_id,
      'supplierItemId',supplier_item.id,'supplierSku',supplier_item.supplier_sku,
      'packUom',supplier_item.pack_uom,'unitsPerPack',supplier_item.units_per_pack,
      'quantityOrdered',line.quantity_ordered,'unitCostCents',line.unit_cost_cents
    ) order by line.id)
  ) into v_payload
  from public.os_purchase_order_lines line
  join public.os_inventory_supplier_items supplier_item
    on supplier_item.tenant_id=line.tenant_id and supplier_item.vendor_id=v_po.vendor_id
    and supplier_item.item_id=line.item_id
    and supplier_item.variant_id is not distinct from line.variant_id
    and supplier_item.status='approved' and supplier_item.price_effective_at<=clock_timestamp()
    and supplier_item.price_expires_at>clock_timestamp()
  where line.tenant_id=p_tenant_id and line.purchase_order_id=p_purchase_order_id;
  v_payload_hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
  update public.os_purchase_orders po set
    status='pending_approval',ship_to_location_id=p_ship_to_location_id,
    payload=v_payload,payload_hash=v_payload_hash,approved_payload_hash=null,
    approved_by=null,approved_at=null,version=po.version+1
  where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id returning * into v_po;
  insert into public.os_purchase_order_events (
    tenant_id,purchase_order_id,event_type,payload_hash,correlation_id,evidence,actor_profile_id
  ) values (p_tenant_id,v_po.id,'submitted',v_payload_hash,p_idempotency_key,
    jsonb_build_object('version',v_po.version),p_actor_profile_id);
  v_response:=jsonb_build_object('id',v_po.id,'status',v_po.status,'version',v_po.version,'payloadHash',v_payload_hash);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'SUBMIT_PURCHASE_ORDER',p_idempotency_key,v_request_hash,p_actor_profile_id,
    'os_purchase_orders',v_po.id,v_po.version,v_response);
  return v_response;
end;
$$;
revoke all on function public.submit_inventory_purchase_order(uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_inventory_purchase_order(uuid,uuid,uuid,integer,uuid,text) to service_role;

create or replace function public.approve_inventory_purchase_order(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_purchase_order_id uuid,
  p_expected_version integer,
  p_expected_payload_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po public.os_purchase_orders%rowtype;
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if coalesce(p_expected_payload_hash,'') !~ '^[0-9a-f]{64}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_purchase_order_approval_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenant_id',p_tenant_id,'actor_profile_id',p_actor_profile_id,'purchase_order_id',p_purchase_order_id,
    'expected_version',p_expected_version,'expected_payload_hash',p_expected_payload_hash
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('po-approve:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='APPROVE_PURCHASE_ORDER'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_po from public.os_purchase_orders po
    where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_purchase_order_not_found'; end if;
  if v_po.version<>p_expected_version or v_po.status<>'pending_approval'
     or v_po.payload_hash is distinct from p_expected_payload_hash then
    raise exception using errcode='40001',message='inventory_purchase_order_version_conflict';
  end if;
  if v_po.created_by=p_actor_profile_id then
    raise exception using errcode='42501',message='inventory_purchase_order_self_approval_prohibited';
  end if;
  update public.os_purchase_orders po set
    status='approved',approved_payload_hash=po.payload_hash,approved_by=p_actor_profile_id,
    approved_at=clock_timestamp(),version=po.version+1
  where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id returning * into v_po;
  insert into public.os_purchase_order_events (
    tenant_id,purchase_order_id,event_type,payload_hash,correlation_id,evidence,actor_profile_id
  ) values (p_tenant_id,v_po.id,'approved',v_po.payload_hash,p_idempotency_key,
    jsonb_build_object('version',v_po.version),p_actor_profile_id);
  v_response:=jsonb_build_object('id',v_po.id,'status',v_po.status,'version',v_po.version,
    'payloadHash',v_po.payload_hash,'approvedAt',v_po.approved_at);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'APPROVE_PURCHASE_ORDER',p_idempotency_key,v_hash,p_actor_profile_id,
    'os_purchase_orders',v_po.id,v_po.version,v_response);
  return v_response;
end;
$$;
revoke all on function public.approve_inventory_purchase_order(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.approve_inventory_purchase_order(uuid,uuid,uuid,integer,text,text) to service_role;

create or replace function public.record_manual_purchase_order_event(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_purchase_order_id uuid,
  p_expected_version integer,
  p_event_type text,
  p_external_order_id text,
  p_evidence jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po public.os_purchase_orders%rowtype;
  v_hash text;
  v_next text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_event_type not in ('manual_exported','manual_sent','acknowledged','rejected','partial_fill','backordered','shipped','cancelled','failed','unknown_external_state','reconciled')
     or p_evidence is null or jsonb_typeof(p_evidence)<>'object'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_purchase_order_event_invalid';
  end if;
  if p_evidence::text ~* '(patient|diagnosis|treatment note|date of birth|medical record)' then
    raise exception using errcode='22023',message='inventory_supplier_evidence_phi_prohibited';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenant_id',p_tenant_id,'actor_profile_id',p_actor_profile_id,'purchase_order_id',p_purchase_order_id,
    'expected_version',p_expected_version,'event_type',p_event_type,
    'external_order_id',nullif(trim(coalesce(p_external_order_id,'')),''),'evidence',p_evidence
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('po-event:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='RECORD_PURCHASE_ORDER_EVENT'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_po from public.os_purchase_orders po
    where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_purchase_order_not_found'; end if;
  if v_po.version<>p_expected_version or v_po.approved_payload_hash is null
     or v_po.approved_payload_hash<>v_po.payload_hash then
    raise exception using errcode='40001',message='inventory_purchase_order_version_conflict';
  end if;
  v_next:=case p_event_type
    when 'manual_exported' then v_po.status
    when 'manual_sent' then 'sent'
    when 'acknowledged' then 'acknowledged'
    when 'rejected' then 'exception'
    when 'partial_fill' then 'acknowledged'
    when 'backordered' then 'acknowledged'
    when 'shipped' then 'acknowledged'
    when 'cancelled' then 'cancelled'
    when 'failed' then 'failed'
    when 'unknown_external_state' then 'unknown_external_state'
    when 'reconciled' then case when nullif(trim(coalesce(p_external_order_id,'')),'') is null then 'approved' else 'acknowledged' end
  end;
  if (p_event_type='manual_exported' and v_po.status<>'approved')
     or (p_event_type='manual_sent' and v_po.status<>'approved')
     or (p_event_type in ('acknowledged','rejected','partial_fill','backordered','shipped') and v_po.status not in ('sent','acknowledged'))
     or (p_event_type='reconciled' and v_po.status<>'unknown_external_state')
     or (p_event_type='cancelled' and v_po.status not in ('approved','sent','acknowledged','partially_received','failed','unknown_external_state','exception'))
     or (p_event_type in ('failed','unknown_external_state') and v_po.status not in ('approved','sent','acknowledged')) then
    raise exception using errcode='P0001',message='inventory_purchase_order_event_not_allowed';
  end if;
  update public.os_purchase_orders po set status=v_next,version=po.version+1
    where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id returning * into v_po;
  insert into public.os_purchase_order_events (
    tenant_id,purchase_order_id,event_type,payload_hash,correlation_id,external_order_id,evidence,actor_profile_id
  ) values (p_tenant_id,v_po.id,p_event_type,v_po.payload_hash,p_idempotency_key,
    nullif(trim(coalesce(p_external_order_id,'')),''),p_evidence,p_actor_profile_id);
  if p_event_type='manual_exported' then
    insert into public.os_purchase_order_execution_attempts (
      tenant_id,purchase_order_id,adapter_key,idempotency_key,request_hash,status,created_by
    ) values (p_tenant_id,v_po.id,'manual_export',p_idempotency_key,v_po.payload_hash,'manual_exported',p_actor_profile_id);
  end if;
  v_response:=jsonb_build_object('id',v_po.id,'status',v_po.status,'version',v_po.version,
    'payloadHash',v_po.payload_hash,'eventType',p_event_type);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'RECORD_PURCHASE_ORDER_EVENT',p_idempotency_key,v_hash,p_actor_profile_id,
    'os_purchase_orders',v_po.id,v_po.version,v_response);
  return v_response;
end;
$$;
revoke all on function public.record_manual_purchase_order_event(uuid,uuid,uuid,integer,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_manual_purchase_order_event(uuid,uuid,uuid,integer,text,text,jsonb,text) to service_role;

create or replace function public.create_inventory_receiving_inspection(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_purchase_order_id uuid,
  p_location_id uuid,
  p_lines jsonb,
  p_condition_code text,
  p_temperature_evidence jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po public.os_purchase_orders%rowtype;
  v_inspection public.os_inventory_receiving_inspections%rowtype;
  v_line jsonb;
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
  v_status text;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_receiving_inspection_invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) supplied
    where coalesce(supplied->>'purchaseOrderLineId','') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(supplied->>'quantityReceived','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or coalesce(supplied->>'quantityAccepted','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
      or (supplied->>'quantityAccepted')::numeric>(supplied->>'quantityReceived')::numeric
      or coalesce(supplied->>'disposition','') not in ('accepted','quarantine','rejected','backorder')
      or ((supplied->>'disposition') in ('quarantine','rejected','backorder')
        and (supplied->>'quantityAccepted')::numeric<>0)
  ) then raise exception using errcode='22023',message='inventory_receiving_line_invalid'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) supplied
    group by supplied->>'purchaseOrderLineId' having count(*)>1
  ) then raise exception using errcode='22023',message='inventory_receiving_line_duplicate'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenant_id',p_tenant_id,'actor_profile_id',p_actor_profile_id,'purchase_order_id',p_purchase_order_id,
    'location_id',p_location_id,'lines',p_lines,'condition_code',p_condition_code,
    'temperature_evidence',coalesce(p_temperature_evidence,'{}'::jsonb)
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('receiving-inspection:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='CREATE_RECEIVING_INSPECTION'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_po from public.os_purchase_orders po
    where po.tenant_id=p_tenant_id and po.id=p_purchase_order_id for update;
  if not found or v_po.status not in ('sent','acknowledged','partially_received')
     or v_po.approved_payload_hash is null or v_po.approved_payload_hash<>v_po.payload_hash then
    raise exception using errcode='P0001',message='inventory_receiving_po_not_committed';
  end if;
  if p_location_id is distinct from v_po.ship_to_location_id then
    raise exception using errcode='P0001',message='inventory_receiving_location_mismatch';
  end if;
  v_status:=case
    when exists(select 1 from jsonb_array_elements(p_lines) supplied where supplied->>'disposition'='quarantine') then 'quarantined'
    when exists(select 1 from jsonb_array_elements(p_lines) supplied where supplied->>'disposition'<>'accepted') then 'partial'
    else 'accepted'
  end;
  insert into public.os_inventory_receiving_inspections (
    tenant_id,purchase_order_id,location_id,status,condition_code,temperature_evidence,inspected_by
  ) values (p_tenant_id,p_purchase_order_id,p_location_id,v_status,nullif(upper(trim(coalesce(p_condition_code,''))),''),
    coalesce(p_temperature_evidence,'{}'::jsonb),p_actor_profile_id) returning * into v_inspection;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if not exists (
      select 1 from public.os_purchase_order_lines line
      where line.tenant_id=p_tenant_id and line.purchase_order_id=p_purchase_order_id
        and line.id=(v_line->>'purchaseOrderLineId')::uuid
    ) then raise exception using errcode='P0001',message='inventory_purchase_order_line_not_found'; end if;
    insert into public.os_inventory_receiving_inspection_lines (
      tenant_id,inspection_id,purchase_order_line_id,lot_id,quantity_received,
      quantity_accepted,disposition,variance_code,evidence
    ) values (p_tenant_id,v_inspection.id,(v_line->>'purchaseOrderLineId')::uuid,
      nullif(v_line->>'lotId','')::uuid,(v_line->>'quantityReceived')::numeric,
      (v_line->>'quantityAccepted')::numeric,v_line->>'disposition',
      nullif(upper(trim(coalesce(v_line->>'varianceCode',''))),''),
      coalesce(v_line->'evidence','{}'::jsonb));
  end loop;
  v_response:=jsonb_build_object('id',v_inspection.id,'status',v_inspection.status,'version',v_inspection.version,
    'lineCount',jsonb_array_length(p_lines));
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'CREATE_RECEIVING_INSPECTION',p_idempotency_key,v_hash,p_actor_profile_id,
    'os_inventory_receiving_inspections',v_inspection.id,v_inspection.version,v_response);
  return v_response;
end;
$$;
revoke all on function public.create_inventory_receiving_inspection(uuid,uuid,uuid,uuid,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_inventory_receiving_inspection(uuid,uuid,uuid,uuid,jsonb,text,jsonb,text) to service_role;

create or replace function public.post_inventory_receiving_inspection(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_inspection_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection public.os_inventory_receiving_inspections%rowtype;
  v_po public.os_purchase_orders%rowtype;
  v_receipt public.os_inventory_receiving_inspection_lines%rowtype;
  v_po_line public.os_purchase_order_lines%rowtype;
  v_lot public.os_inventory_lots%rowtype;
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
  v_movement public.os_stock_transactions%rowtype;
  v_all_received boolean;
  v_quarantine_location_id uuid;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenant_id',p_tenant_id,'actor_profile_id',p_actor_profile_id,'inspection_id',p_inspection_id,
    'expected_version',p_expected_version
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('receiving-post:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='POST_RECEIVING_INSPECTION'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_inspection from public.os_inventory_receiving_inspections inspection
    where inspection.tenant_id=p_tenant_id and inspection.id=p_inspection_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_receiving_inspection_not_found'; end if;
  if v_inspection.version<>p_expected_version or v_inspection.status not in ('accepted','partial','quarantined') then
    raise exception using errcode='40001',message='inventory_receiving_inspection_version_conflict';
  end if;
  select * into v_po from public.os_purchase_orders po
    where po.tenant_id=p_tenant_id and po.id=v_inspection.purchase_order_id for update;
  if v_po.status not in ('sent','acknowledged','partially_received')
     or v_po.approved_payload_hash is null or v_po.approved_payload_hash<>v_po.payload_hash then
    raise exception using errcode='P0001',message='inventory_receiving_po_not_committed';
  end if;
  for v_receipt in select * from public.os_inventory_receiving_inspection_lines line
    where line.tenant_id=p_tenant_id and line.inspection_id=p_inspection_id order by line.id
  loop
    select * into v_po_line from public.os_purchase_order_lines line
      where line.tenant_id=p_tenant_id and line.id=v_receipt.purchase_order_line_id for update;
    if v_po_line.quantity_received+v_receipt.quantity_accepted>v_po_line.quantity_ordered then
      raise exception using errcode='P0001',message='inventory_purchase_order_receive_quantity_exceeds_outstanding';
    end if;
    if v_receipt.disposition='accepted' and v_receipt.quantity_accepted>0 then
      if v_receipt.lot_id is null then raise exception using errcode='P0001',message='inventory_purchase_order_lot_invalid'; end if;
      select * into v_lot from public.os_inventory_lots lot
        where lot.tenant_id=p_tenant_id and lot.id=v_receipt.lot_id
          and lot.item_id=v_po_line.item_id
          and lot.variant_id is not distinct from v_po_line.variant_id;
      if not found or coalesce(nullif(v_lot.unit_cost_cents,0),v_po_line.unit_cost_cents)<>v_po_line.unit_cost_cents then
        raise exception using errcode='P0001',message='inventory_purchase_order_lot_cost_mismatch';
      end if;
      if coalesce(v_lot.disposition_status,'available')<>'available'
         or (v_lot.expires_on is not null and v_lot.expires_on<current_date)
         or (v_lot.temperature_controlled and (v_lot.temperature_evidence_expires_at is null
           or v_lot.temperature_evidence_expires_at<=clock_timestamp()))
         or (v_lot.calibration_required and (v_lot.calibration_expires_at is null
           or v_lot.calibration_expires_at<=clock_timestamp())) then
        raise exception using errcode='P0001',message='inventory_receiving_lot_hold_required';
      end if;
      insert into public.os_stock_transactions (
        tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,
        source_type,source_id,idempotency_key,occurred_at,created_by,to_location_id,operation_request_hash
      ) values (p_tenant_id,v_po_line.item_id,v_po_line.variant_id,v_receipt.lot_id,'receive',
        v_receipt.quantity_accepted,v_po_line.unit_cost_cents,'purchase_order',v_po_line.id::text,
        p_idempotency_key||':'||v_receipt.id::text,clock_timestamp(),p_actor_profile_id,
        v_inspection.location_id,v_hash) returning * into v_movement;
      update public.os_purchase_order_lines line set quantity_received=line.quantity_received+v_receipt.quantity_accepted
        where line.tenant_id=p_tenant_id and line.id=v_po_line.id;
    elsif v_receipt.disposition='quarantine' and v_receipt.quantity_received>0 then
      if v_receipt.lot_id is null then raise exception using errcode='P0001',message='inventory_purchase_order_lot_invalid'; end if;
      select * into v_lot from public.os_inventory_lots lot
      where lot.tenant_id=p_tenant_id and lot.id=v_receipt.lot_id
        and lot.item_id=v_po_line.item_id and lot.variant_id is not distinct from v_po_line.variant_id;
      if not found or coalesce(nullif(v_lot.unit_cost_cents,0),v_po_line.unit_cost_cents)<>v_po_line.unit_cost_cents then
        raise exception using errcode='P0001',message='inventory_purchase_order_lot_cost_mismatch';
      end if;
      if v_quarantine_location_id is null then
        select location.id into v_quarantine_location_id from public.os_inventory_locations location
        where location.tenant_id=p_tenant_id and location.location_type='quarantine'
          and location.status='active' order by location.created_at,location.id limit 1;
      end if;
      if v_quarantine_location_id is null then
        raise exception using errcode='P0001',message='inventory_quarantine_location_required';
      end if;
      update public.os_inventory_lots lot set disposition_status='quarantine'
      where lot.tenant_id=p_tenant_id and lot.id=v_receipt.lot_id;
      insert into public.os_stock_transactions (
        tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,
        source_type,source_id,idempotency_key,occurred_at,created_by,to_location_id,operation_request_hash
      ) values (p_tenant_id,v_po_line.item_id,v_po_line.variant_id,v_receipt.lot_id,'receive',
        v_receipt.quantity_received,v_po_line.unit_cost_cents,'purchase_order_quarantine',v_po_line.id::text,
        p_idempotency_key||':'||v_receipt.id::text||':quarantine',clock_timestamp(),p_actor_profile_id,
        v_quarantine_location_id,v_hash);
    end if;
    if v_receipt.disposition<>'accepted' or v_receipt.quantity_received<>v_receipt.quantity_accepted then
      insert into public.os_inventory_exceptions (
        tenant_id,exception_type,severity,entity_type,entity_id,reason_code,evidence
      ) values (p_tenant_id,'receiving_variance',
        case when v_receipt.disposition in ('quarantine','rejected') then 'critical' else 'warning' end,
        'os_inventory_receiving_inspections',v_inspection.id,
        coalesce(v_receipt.variance_code,upper(v_receipt.disposition)),
        jsonb_build_object('purchaseOrderLineId',v_po_line.id,'quantityReceived',v_receipt.quantity_received,
          'quantityAccepted',v_receipt.quantity_accepted,'disposition',v_receipt.disposition));
    end if;
  end loop;
  select bool_and(line.quantity_received>=line.quantity_ordered) into v_all_received
  from public.os_purchase_order_lines line where line.tenant_id=p_tenant_id and line.purchase_order_id=v_po.id;
  update public.os_purchase_orders po set status=case when v_all_received then 'received' else 'partially_received' end,
    version=po.version+1 where po.tenant_id=p_tenant_id and po.id=v_po.id returning * into v_po;
  update public.os_inventory_receiving_inspections inspection set status='posted',posted_by=p_actor_profile_id,
    posted_at=clock_timestamp(),version=inspection.version+1
    where inspection.tenant_id=p_tenant_id and inspection.id=p_inspection_id returning * into v_inspection;
  insert into public.os_purchase_order_events (
    tenant_id,purchase_order_id,event_type,payload_hash,correlation_id,evidence,actor_profile_id
  ) values (p_tenant_id,v_po.id,'receipt_posted',v_po.payload_hash,p_idempotency_key,
    jsonb_build_object('inspectionId',v_inspection.id,'purchaseOrderStatus',v_po.status),p_actor_profile_id);
  v_response:=jsonb_build_object('id',v_inspection.id,'status',v_inspection.status,'version',v_inspection.version,
    'purchaseOrderId',v_po.id,'purchaseOrderStatus',v_po.status,'purchaseOrderVersion',v_po.version);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'POST_RECEIVING_INSPECTION',p_idempotency_key,v_hash,p_actor_profile_id,
    'os_inventory_receiving_inspections',v_inspection.id,v_inspection.version,v_response);
  return v_response;
end;
$$;
revoke all on function public.post_inventory_receiving_inspection(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.post_inventory_receiving_inspection(uuid,uuid,uuid,integer,text) to service_role;

create or replace function public.record_inventory_a1_proposal(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_evaluator_version text,
  p_policy_version text,
  p_input jsonb,
  p_proposal jsonb,
  p_evaluations jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_control public.os_inventory_automation_controls%rowtype;
  v_record public.os_inventory_agent_proposals%rowtype;
  v_requisition public.os_inventory_requisitions%rowtype;
  v_line jsonb;
  v_eval jsonb;
  v_hash text;
  v_proposal_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  select * into v_control from public.os_inventory_automation_controls control
  where control.tenant_id=p_tenant_id and control.scope_type='tenant' and control.scope_id=p_tenant_id::text
    and control.effective_at<=clock_timestamp() and (control.expires_at is null or control.expires_at>clock_timestamp())
  order by control.version desc limit 1;
  if not found or not v_control.a1_drafts_enabled or v_control.kill_switch then
    raise exception using errcode='P0001',message='inventory_a1_drafts_disabled';
  end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or p_proposal is null or jsonb_typeof(p_proposal)<>'object'
     or p_evaluations is null or jsonb_typeof(p_evaluations)<>'array'
     or p_proposal ?| array['supplierContact','email','payment','bank','patient','clinicalNotes']
     or p_proposal->>'authority'<>'DRAFT_ONLY'
     or coalesce((p_proposal->>'supplierContactPermitted')::boolean,true)
     or coalesce((p_proposal->>'purchaseOrderPermitted')::boolean,true)
     or coalesce((p_proposal->>'paymentPermitted')::boolean,true)
     or p_input::text ~* '(patient|diagnosis|treatment note|date of birth|medical record)'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_a1_proposal_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'input',p_input,'proposal',p_proposal,'evaluations',p_evaluations,
    'evaluatorVersion',p_evaluator_version,'policyVersion',p_policy_version
  )::text,'sha256'),'hex');
  v_proposal_hash:=encode(extensions.digest(p_proposal::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-a1:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='RECORD_A1_PROPOSAL'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  if jsonb_typeof(p_proposal->'lines')='array' and jsonb_array_length(p_proposal->'lines')>0 then
    if coalesce(p_input->'policy'->>'status','')<>'approved'
       or p_policy_version<>'procurement-policy-'||coalesce(p_input->'policy'->>'version','') then
      raise exception using errcode='P0001',message='inventory_a1_approved_policy_required';
    end if;
    insert into public.os_inventory_requisitions (
      tenant_id,requisition_number,source,status,calculation_trace,calculation_hash,created_by,expires_at
    ) values (p_tenant_id,'A1-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(v_proposal_hash,1,12)),
      'a1_agent','draft',p_proposal,v_proposal_hash,p_actor_profile_id,clock_timestamp()+interval '24 hours')
    returning * into v_requisition;
    for v_line in select value from jsonb_array_elements(p_proposal->'lines') loop
      if coalesce(v_line->>'itemId','') !~ '^[0-9a-fA-F-]{36}$'
         or coalesce(v_line->>'supplierItemId','') !~ '^[0-9a-fA-F-]{36}$'
         or coalesce(v_line->>'netNeed','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
         or coalesce(v_line->>'orderPacks','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
         or coalesce(v_line->>'unitsPerPack','') !~ '^[0-9]+(\.[0-9]{1,3})?$'
         or not exists (
           select 1 from public.os_inventory_supplier_items supplier
           join public.os_inventory_items item on item.tenant_id=supplier.tenant_id and item.id=supplier.item_id
           where supplier.tenant_id=p_tenant_id and supplier.id=(v_line->>'supplierItemId')::uuid
             and supplier.item_id=(v_line->>'itemId')::uuid
             and supplier.variant_id is not distinct from nullif(v_line->>'variantId','')::uuid
             and supplier.status='approved' and supplier.automation_eligible
             and supplier.substitution_policy='prohibited'
             and supplier.price_effective_at<=clock_timestamp() and supplier.price_expires_at>clock_timestamp()
             and item.automation_eligible and item.regulated_class<>'unknown'
             and item.classification_reviewed_at is not null
         ) then raise exception using errcode='P0001',message='inventory_a1_line_not_eligible'; end if;
      insert into public.os_inventory_requisition_lines (
        tenant_id,requisition_id,demand_episode_id,supplier_item_id,item_id,variant_id,
        net_need,order_packs,units_per_pack,proposed_unit_price_cents,need_by,trace
      ) values (p_tenant_id,v_requisition.id,
        nullif(v_line->'demandEpisodeIds'->>0,'')::uuid,
        (v_line->>'supplierItemId')::uuid,(v_line->>'itemId')::uuid,
        nullif(v_line->>'variantId','')::uuid,(v_line->>'netNeed')::numeric,
        (v_line->>'orderPacks')::numeric,(v_line->>'unitsPerPack')::numeric,
        nullif(v_line->>'proposedUnitPriceCents','')::bigint,null,v_line);
    end loop;
  end if;
  insert into public.os_inventory_agent_proposals (
    tenant_id,requisition_id,status,agent_level,evaluator_version,policy_version,input_hash,proposal_hash,explanation,expires_at
  ) values (p_tenant_id,v_requisition.id,
    case when exists(select 1 from jsonb_array_elements(p_evaluations) evaluation where evaluation->>'outcome' in ('fail','hold')) then 'held' else 'generated' end,
    'A1',p_evaluator_version,p_policy_version,v_hash,v_proposal_hash,p_proposal,
    clock_timestamp()+interval '24 hours') returning * into v_record;
  for v_eval in select value from jsonb_array_elements(p_evaluations) loop
    insert into public.os_inventory_agent_evaluations (
      tenant_id,proposal_id,rule_code,outcome,evidence
    ) values (p_tenant_id,v_record.id,v_eval->>'ruleCode',v_eval->>'outcome',coalesce(v_eval->'evidence','{}'::jsonb));
  end loop;
  v_response:=jsonb_build_object('id',v_record.id,'status',v_record.status,'agentLevel','A1',
    'requisitionId',v_requisition.id,'proposalHash',v_record.proposal_hash,'expiresAt',v_record.expires_at);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'RECORD_A1_PROPOSAL',p_idempotency_key,v_hash,p_actor_profile_id,
    'os_inventory_agent_proposals',v_record.id,1,v_response);
  return v_response;
end;
$$;
revoke all on function public.record_inventory_a1_proposal(uuid,uuid,text,text,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_inventory_a1_proposal(uuid,uuid,text,text,jsonb,jsonb,jsonb,text) to service_role;

commit;
