-- Human-controlled supplier review and regulated-product safety evidence.
-- No function in this migration performs network or payment execution.

begin;

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
  'REGISTER_SUPPLIER_CONNECTION','RECORD_INVENTORY_RECALL','RECORD_INVENTORY_TEMPERATURE','RECORD_INVENTORY_CALIBRATION'
));

create or replace function app_private.guard_connected_supplier_item()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.os_inventory_vendors vendor where vendor.tenant_id=new.tenant_id and vendor.id=new.vendor_id
      and vendor.status='active' and vendor.change_review_status='approved') then
    raise exception using errcode='P0001',message='inventory_supplier_review_required';
  end if;
  if new.automation_eligible and exists(select 1 from public.os_inventory_items item where item.tenant_id=new.tenant_id and item.id=new.item_id
      and item.regulated_class not in ('general_commodity','medical_supply')) then
    raise exception using errcode='P0001',message='inventory_supplier_item_automation_prohibited';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_connected_supplier_item() from public,anon,authenticated,service_role;
drop trigger if exists os_inventory_supplier_items_connected_guard on public.os_inventory_supplier_items;
create trigger os_inventory_supplier_items_connected_guard before insert or update of vendor_id,item_id,automation_eligible,status
  on public.os_inventory_supplier_items for each row execute function app_private.guard_connected_supplier_item();

create or replace function public.review_inventory_supplier(
  p_tenant_id uuid,p_actor_profile_id uuid,p_vendor_id uuid,p_expected_version integer,p_legal_name text,p_supplier_class text,
  p_approved_markets text[],p_credential_evidence_refs text[],p_ordering_channel text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_vendor public.os_inventory_vendors%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_expected_version is null or p_expected_version<1 or char_length(trim(coalesce(p_legal_name,''))) not between 1 and 180
     or p_supplier_class not in ('general','medical_distributor','manufacturer','pharmacy','3pl','other_reviewed')
     or p_ordering_channel not in ('manual','api_disabled','edi_disabled','structured_sender_disabled')
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_supplier_review_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('vendorId',p_vendor_id,'expectedVersion',p_expected_version,'legalName',trim(p_legal_name),'supplierClass',p_supplier_class,'approvedMarkets',p_approved_markets,'credentialEvidenceRefs',p_credential_evidence_refs,'orderingChannel',p_ordering_channel)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-supplier:'||p_tenant_id::text||':'||p_vendor_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='REVIEW_INVENTORY_SUPPLIER' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_vendor from public.os_inventory_vendors where tenant_id=p_tenant_id and id=p_vendor_id for update;
  if not found or v_vendor.version<>p_expected_version then raise exception using errcode='40001',message='inventory_supplier_version_conflict'; end if;
  if v_vendor.created_by=p_actor_profile_id then raise exception using errcode='42501',message='inventory_supplier_self_review_prohibited'; end if;
  update public.os_inventory_vendors set legal_name=trim(p_legal_name),supplier_class=p_supplier_class,approved_markets=coalesce(p_approved_markets,'{}'),
    credential_evidence_refs=coalesce(p_credential_evidence_refs,'{}'),ordering_channel=p_ordering_channel,change_review_status='approved',
    independently_reviewed_by=p_actor_profile_id,independently_reviewed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=p_vendor_id returning * into v_vendor;
  v_response:=jsonb_build_object('id',v_vendor.id,'status',v_vendor.status,'changeReviewStatus',v_vendor.change_review_status,'version',v_vendor.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'REVIEW_INVENTORY_SUPPLIER',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_vendors',v_vendor.id,v_vendor.version,v_response);
  return v_response;
end $$;
revoke all on function public.review_inventory_supplier(uuid,uuid,uuid,integer,text,text,text[],text[],text,text) from public,anon,authenticated;
grant execute on function public.review_inventory_supplier(uuid,uuid,uuid,integer,text,text,text[],text[],text,text) to service_role;

create or replace function public.register_inventory_supplier_connection(
  p_tenant_id uuid,p_actor_profile_id uuid,p_vendor_id uuid,p_adapter_key text,p_secret_reference text,p_masked_account_label text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_connection public.os_inventory_supplier_connections%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_adapter_key not in ('manual_export','disabled_api','disabled_edi','disabled_structured_sender')
     or (p_adapter_key='manual_export' and p_secret_reference is not null)
     or (p_secret_reference is not null and p_secret_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$')
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_supplier_connection_invalid'; end if;
  if not exists(select 1 from public.os_inventory_vendors v where v.tenant_id=p_tenant_id and v.id=p_vendor_id and v.status='active' and v.change_review_status='approved') then
    raise exception using errcode='P0001',message='inventory_supplier_review_required'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('vendorId',p_vendor_id,'adapterKey',p_adapter_key,'secretReference',p_secret_reference,'maskedAccountLabel',p_masked_account_label)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-supplier-connection:'||p_tenant_id::text||':'||p_vendor_id::text||':'||p_adapter_key,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='REGISTER_SUPPLIER_CONNECTION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  insert into public.os_inventory_supplier_connections(tenant_id,vendor_id,adapter_key,status,secret_reference,masked_account_label,health_code,created_by)
    values(p_tenant_id,p_vendor_id,p_adapter_key,case when p_adapter_key='manual_export' then 'manual_only' else 'disabled' end,p_secret_reference,
      nullif(trim(p_masked_account_label),''),case when p_adapter_key='manual_export' then 'MANUAL_HANDOFF' else 'EXECUTION_DISABLED_V1' end,p_actor_profile_id)
    on conflict(tenant_id,vendor_id,adapter_key) do nothing returning * into v_connection;
  if not found then select * into v_connection from public.os_inventory_supplier_connections where tenant_id=p_tenant_id and vendor_id=p_vendor_id and adapter_key=p_adapter_key; end if;
  v_response:=jsonb_build_object('id',v_connection.id,'adapterKey',v_connection.adapter_key,'status',v_connection.status,'healthCode',v_connection.health_code,'version',v_connection.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'REGISTER_SUPPLIER_CONNECTION',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_supplier_connections',v_connection.id,v_connection.version,v_response);
  return v_response;
end $$;
revoke all on function public.register_inventory_supplier_connection(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.register_inventory_supplier_connection(uuid,uuid,uuid,text,text,text,text) to service_role;

create or replace function public.record_inventory_recall(
  p_tenant_id uuid,p_actor_profile_id uuid,p_source_type text,p_source_reference text,p_classification text,p_summary_code text,p_targets jsonb,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_recall public.os_inventory_recall_events%rowtype; v_target jsonb; v_lot uuid; v_item uuid; v_variant uuid;
  v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['clinical_approver']::text[]);
  if p_source_type not in ('manufacturer','supplier','fda_signal','internal','other_reviewed') or char_length(trim(coalesce(p_source_reference,''))) not between 1 and 200
     or p_classification not in ('pending_review','class_i','class_ii','class_iii','market_withdrawal','safety_alert','other_reviewed')
     or upper(trim(coalesce(p_summary_code,''))) !~ '^[A-Z0-9_]{3,100}$' or p_targets is null or jsonb_typeof(p_targets)<>'array' or jsonb_array_length(p_targets)=0
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_recall_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('sourceType',p_source_type,'sourceReference',trim(p_source_reference),'classification',p_classification,'summaryCode',upper(trim(p_summary_code)),'targets',p_targets)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-recall:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='RECORD_INVENTORY_RECALL' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  insert into public.os_inventory_recall_events(tenant_id,source_type,source_reference,status,classification,summary_code,opened_by)
    values(p_tenant_id,p_source_type,trim(p_source_reference),'investigating',p_classification,upper(trim(p_summary_code)),p_actor_profile_id) returning * into v_recall;
  for v_target in select value from jsonb_array_elements(p_targets) loop
    v_item:=nullif(v_target->>'itemId','')::uuid; v_variant:=nullif(v_target->>'variantId','')::uuid; v_lot:=nullif(v_target->>'lotId','')::uuid;
    if v_item is null or not exists(select 1 from public.os_inventory_items i where i.tenant_id=p_tenant_id and i.id=v_item)
       or (v_lot is not null and not exists(select 1 from public.os_inventory_lots l where l.tenant_id=p_tenant_id and l.id=v_lot and l.item_id=v_item and l.variant_id is not distinct from v_variant)) then
      raise exception using errcode='22023',message='inventory_recall_target_invalid'; end if;
    insert into public.os_inventory_recall_targets(tenant_id,recall_event_id,item_id,variant_id,lot_id,action_status)
      values(p_tenant_id,v_recall.id,v_item,v_variant,v_lot,case when v_lot is null then 'hold_required' else 'quarantined' end);
    insert into public.os_inventory_holds(tenant_id,hold_type,item_id,variant_id,lot_id,status,reason_code,evidence,placed_by)
      values(p_tenant_id,'recall',v_item,v_variant,v_lot,'active',upper(trim(p_summary_code)),jsonb_build_object('recallEventId',v_recall.id),p_actor_profile_id);
    if v_lot is not null then update public.os_inventory_lots set disposition_status='recalled',disposition_reason_code=upper(trim(p_summary_code)),disposition_changed_at=clock_timestamp(),disposition_changed_by=p_actor_profile_id where tenant_id=p_tenant_id and id=v_lot; end if;
  end loop;
  update public.os_inventory_readiness_evaluations set invalidated_at=clock_timestamp(),invalidation_code='RECALL_SIGNAL' where tenant_id=p_tenant_id and invalidated_at is null;
  v_response:=jsonb_build_object('id',v_recall.id,'status',v_recall.status,'classification',v_recall.classification,'version',v_recall.version);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'RECORD_INVENTORY_RECALL',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_recall_events',v_recall.id,v_recall.version,v_response);
  return v_response;
end $$;
revoke all on function public.record_inventory_recall(uuid,uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_inventory_recall(uuid,uuid,text,text,text,text,jsonb,text) to service_role;

create or replace function public.record_inventory_temperature_event(
  p_tenant_id uuid,p_actor_profile_id uuid,p_lot_id uuid,p_location_id uuid,p_event_type text,p_temperature_c numeric,
  p_observed_at timestamptz,p_evidence_hash text,p_evidence_expires_at timestamptz,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.os_inventory_temperature_events%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin','clinical_approver']::text[]);
  if p_event_type not in ('reading','excursion','evidence_expired','reviewed_safe','quarantined') or p_observed_at is null or coalesce(p_evidence_hash,'') !~ '^[0-9a-f]{64}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_temperature_event_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('lotId',p_lot_id,'locationId',p_location_id,'eventType',p_event_type,'temperatureC',p_temperature_c,'observedAt',p_observed_at,'evidenceHash',p_evidence_hash,'evidenceExpiresAt',p_evidence_expires_at)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-temperature:'||p_tenant_id::text||':'||p_lot_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='RECORD_INVENTORY_TEMPERATURE' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  if not exists(select 1 from public.os_inventory_lots l where l.tenant_id=p_tenant_id and l.id=p_lot_id and l.temperature_controlled) then raise exception using errcode='P0001',message='inventory_temperature_control_not_applicable'; end if;
  insert into public.os_inventory_temperature_events(tenant_id,lot_id,location_id,event_type,temperature_c,observed_at,evidence_hash,actor_profile_id)
    values(p_tenant_id,p_lot_id,p_location_id,p_event_type,p_temperature_c,p_observed_at,p_evidence_hash,p_actor_profile_id) returning * into v_event;
  update public.os_inventory_lots set temperature_evidence_expires_at=case when p_event_type in ('reading','reviewed_safe') then p_evidence_expires_at else null end,
    disposition_status=case when p_event_type in ('excursion','evidence_expired','quarantined') then 'quarantine' else disposition_status end,
    disposition_reason_code=case when p_event_type in ('excursion','evidence_expired','quarantined') then upper(p_event_type) else disposition_reason_code end,
    disposition_changed_at=clock_timestamp(),disposition_changed_by=p_actor_profile_id where tenant_id=p_tenant_id and id=p_lot_id;
  update public.os_inventory_readiness_evaluations set invalidated_at=clock_timestamp(),invalidation_code='TEMPERATURE_EVIDENCE_CHANGED' where tenant_id=p_tenant_id and invalidated_at is null;
  v_response:=jsonb_build_object('id',v_event.id,'eventType',v_event.event_type,'lotId',v_event.lot_id);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'RECORD_INVENTORY_TEMPERATURE',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_temperature_events',v_event.id,1,v_response);
  return v_response;
end $$;
revoke all on function public.record_inventory_temperature_event(uuid,uuid,uuid,uuid,text,numeric,timestamptz,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_inventory_temperature_event(uuid,uuid,uuid,uuid,text,numeric,timestamptz,text,timestamptz,text) to service_role;

create or replace function public.record_inventory_calibration_event(
  p_tenant_id uuid,p_actor_profile_id uuid,p_item_id uuid,p_variant_id uuid,p_lot_id uuid,p_event_type text,
  p_effective_at timestamptz,p_expires_at timestamptz,p_evidence_hash text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.os_inventory_calibration_events%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin','clinical_approver']::text[]);
  if p_event_type not in ('calibrated','inspection_failed','maintenance_due','retired') or p_effective_at is null
     or (p_expires_at is not null and p_expires_at<=p_effective_at) or coalesce(p_evidence_hash,'') !~ '^[0-9a-f]{64}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_calibration_event_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('itemId',p_item_id,'variantId',p_variant_id,'lotId',p_lot_id,'eventType',p_event_type,'effectiveAt',p_effective_at,'expiresAt',p_expires_at,'evidenceHash',p_evidence_hash)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-calibration:'||p_tenant_id::text||':'||p_item_id::text||':'||coalesce(p_lot_id::text,'-'),0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='RECORD_INVENTORY_CALIBRATION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  if not exists(select 1 from public.os_inventory_items i where i.tenant_id=p_tenant_id and i.id=p_item_id and i.regulated_class='calibration_equipment') then raise exception using errcode='P0001',message='inventory_calibration_not_applicable'; end if;
  insert into public.os_inventory_calibration_events(tenant_id,item_id,variant_id,lot_id,event_type,effective_at,expires_at,evidence_hash,actor_profile_id)
    values(p_tenant_id,p_item_id,p_variant_id,p_lot_id,p_event_type,p_effective_at,p_expires_at,p_evidence_hash,p_actor_profile_id) returning * into v_event;
  if p_lot_id is not null then update public.os_inventory_lots set calibration_required=true,calibration_expires_at=case when p_event_type='calibrated' then p_expires_at else null end,
    disposition_status=case when p_event_type='calibrated' then disposition_status else 'quarantine' end,
    disposition_reason_code=case when p_event_type='calibrated' then disposition_reason_code else upper(p_event_type) end,
    disposition_changed_at=clock_timestamp(),disposition_changed_by=p_actor_profile_id where tenant_id=p_tenant_id and id=p_lot_id and item_id=p_item_id;
  end if;
  update public.os_inventory_readiness_evaluations set invalidated_at=clock_timestamp(),invalidation_code='CALIBRATION_EVIDENCE_CHANGED' where tenant_id=p_tenant_id and invalidated_at is null;
  v_response:=jsonb_build_object('id',v_event.id,'eventType',v_event.event_type,'itemId',v_event.item_id,'lotId',v_event.lot_id);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'RECORD_INVENTORY_CALIBRATION',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_calibration_events',v_event.id,1,v_response);
  return v_response;
end $$;
revoke all on function public.record_inventory_calibration_event(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.record_inventory_calibration_event(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text) to service_role;

commit;
