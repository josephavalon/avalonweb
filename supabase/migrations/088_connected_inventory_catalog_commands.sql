-- Reviewed classification and supplier-item catalog commands.

begin;

create or replace function public.classify_inventory_item(
  p_tenant_id uuid,p_actor_profile_id uuid,p_item_id uuid,p_expected_version integer,
  p_regulated_class text,p_base_uom text,p_storage_policy jsonb,
  p_serial_tracking_required boolean,p_udi_tracking_applicable boolean,
  p_ndc_tracking_applicable boolean,p_automation_eligible boolean,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.os_inventory_items%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['clinical_approver']::text[]);
  if p_expected_version is null or p_expected_version<1
    or p_regulated_class not in ('general_commodity','medical_supply','regulated_device','prescription_drug','biologic','compounded_product','cold_chain','controlled_substance','hazardous_material','calibration_equipment','other_reviewed')
    or coalesce(p_base_uom,'') !~ '^[A-Za-z][A-Za-z0-9._/-]{0,39}$'
    or p_storage_policy is null or jsonb_typeof(p_storage_policy)<>'object'
    or coalesce(p_storage_policy->>'storageClass','') not in ('ambient','controlled_room_temperature','refrigerated','frozen','hazardous','calibration_controlled')
    or (p_automation_eligible and p_regulated_class not in ('general_commodity','medical_supply'))
    or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_item_classification_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('tenantId',p_tenant_id,'itemId',p_item_id,
    'expectedVersion',p_expected_version,'regulatedClass',p_regulated_class,'baseUom',p_base_uom,
    'storagePolicy',p_storage_policy,'serial',p_serial_tracking_required,'udi',p_udi_tracking_applicable,
    'ndc',p_ndc_tracking_applicable,'automationEligible',p_automation_eligible)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('classify-item:'||p_tenant_id::text||':'||p_item_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation where operation.tenant_id=p_tenant_id
    and operation.operation_name='CLASSIFY_INVENTORY_ITEM' and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  update public.os_inventory_items item set regulated_class=p_regulated_class,base_uom=p_base_uom,
    unit=p_base_uom,storage_policy=p_storage_policy,serial_tracking_required=p_serial_tracking_required,
    udi_tracking_applicable=p_udi_tracking_applicable,ndc_tracking_applicable=p_ndc_tracking_applicable,
    automation_eligible=p_automation_eligible,classification_reviewed_by=p_actor_profile_id,
    classification_reviewed_at=clock_timestamp(),version=item.version+1,updated_at=clock_timestamp()
    where item.tenant_id=p_tenant_id and item.id=p_item_id and item.version=p_expected_version
    returning * into v_item;
  if not found then raise exception using errcode='40001',message='inventory_item_version_conflict'; end if;
  v_response:=jsonb_build_object('id',v_item.id,'version',v_item.version,'regulatedClass',v_item.regulated_class,
    'baseUom',v_item.base_uom,'automationEligible',v_item.automation_eligible);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'CLASSIFY_INVENTORY_ITEM',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_items',v_item.id,v_item.version,v_response);
  return v_response;
end; $$;
revoke all on function public.classify_inventory_item(uuid,uuid,uuid,integer,text,text,jsonb,boolean,boolean,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.classify_inventory_item(uuid,uuid,uuid,integer,text,text,jsonb,boolean,boolean,boolean,boolean,text) to service_role;

create or replace function public.create_inventory_supplier_item(
  p_tenant_id uuid,p_actor_profile_id uuid,p_vendor_id uuid,p_item_id uuid,p_variant_id uuid,
  p_supplier_sku text,p_manufacturer text,p_pack_uom text,p_units_per_pack numeric,
  p_minimum_order_packs numeric,p_order_multiple_packs numeric,p_lead_time_days integer,
  p_unit_price_cents bigint,p_currency text,p_price_effective_at timestamptz,p_price_expires_at timestamptz,
  p_substitution_policy text,p_automation_eligible boolean,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_record public.os_inventory_supplier_items%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if coalesce(trim(p_supplier_sku),'')='' or char_length(p_supplier_sku)>120
    or coalesce(p_pack_uom,'') !~ '^[A-Za-z][A-Za-z0-9._/-]{0,39}$'
    or p_units_per_pack<=0 or p_minimum_order_packs<=0 or p_order_multiple_packs<=0
    or p_lead_time_days<0 or p_unit_price_cents<0 or p_currency !~ '^[A-Z]{3}$'
    or p_price_expires_at<=p_price_effective_at or p_substitution_policy not in ('prohibited','clinical_preapproved')
    or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_supplier_item_invalid';
  end if;
  if not exists(select 1 from public.os_inventory_items item where item.tenant_id=p_tenant_id and item.id=p_item_id
      and item.regulated_class<>'unknown' and item.classification_reviewed_at is not null
      and coalesce(item.storage_policy->>'storageClass','')<>'')
    or not exists(select 1 from public.os_inventory_vendors vendor where vendor.tenant_id=p_tenant_id and vendor.id=p_vendor_id and vendor.status='active') then
    raise exception using errcode='P0001',message='inventory_supplier_item_catalog_hold';
  end if;
  if p_variant_id is not null and not exists (
    select 1 from public.os_inventory_variants variant
    where variant.tenant_id=p_tenant_id and variant.id=p_variant_id
      and variant.item_id=p_item_id and variant.archived_at is null
  ) then raise exception using errcode='P0001',message='inventory_supplier_item_variant_mismatch'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('vendorId',p_vendor_id,'itemId',p_item_id,'variantId',p_variant_id,
    'supplierSku',p_supplier_sku,'packUom',p_pack_uom,'unitsPerPack',p_units_per_pack,'minimumOrderPacks',p_minimum_order_packs,
    'orderMultiplePacks',p_order_multiple_packs,'leadTimeDays',p_lead_time_days,'unitPriceCents',p_unit_price_cents,
    'currency',p_currency,'priceEffectiveAt',p_price_effective_at,'priceExpiresAt',p_price_expires_at,
    'substitutionPolicy',p_substitution_policy,'automationEligible',p_automation_eligible)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('supplier-item:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_replay from public.os_inventory_operation_requests operation where operation.tenant_id=p_tenant_id
    and operation.operation_name='CREATE_SUPPLIER_ITEM' and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  insert into public.os_inventory_supplier_items (tenant_id,vendor_id,item_id,variant_id,supplier_sku,manufacturer,
    pack_uom,units_per_pack,minimum_order_packs,order_multiple_packs,lead_time_days,unit_price_cents,currency,
    price_effective_at,price_expires_at,substitution_policy,automation_eligible,status,created_by)
    values (p_tenant_id,p_vendor_id,p_item_id,p_variant_id,trim(p_supplier_sku),nullif(trim(coalesce(p_manufacturer,'')),''),
      p_pack_uom,p_units_per_pack,p_minimum_order_packs,p_order_multiple_packs,p_lead_time_days,p_unit_price_cents,
      p_currency,p_price_effective_at,p_price_expires_at,p_substitution_policy,p_automation_eligible,'draft',p_actor_profile_id)
    returning * into v_record;
  v_response:=jsonb_build_object('id',v_record.id,'status',v_record.status,'version',v_record.version);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'CREATE_SUPPLIER_ITEM',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_supplier_items',v_record.id,v_record.version,v_response);
  return v_response;
end; $$;
revoke all on function public.create_inventory_supplier_item(uuid,uuid,uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,integer,bigint,text,timestamptz,timestamptz,text,boolean,text) from public,anon,authenticated;
grant execute on function public.create_inventory_supplier_item(uuid,uuid,uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,integer,bigint,text,timestamptz,timestamptz,text,boolean,text) to service_role;

create or replace function public.approve_inventory_supplier_item(
  p_tenant_id uuid,p_actor_profile_id uuid,p_supplier_item_id uuid,p_expected_version integer,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_record public.os_inventory_supplier_items%rowtype; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_expected_version is null or p_expected_version<1
    or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_supplier_item_approval_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('supplierItemId',p_supplier_item_id,'expectedVersion',p_expected_version)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('supplier-item-approve:'||p_tenant_id::text||':'||p_supplier_item_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation where operation.tenant_id=p_tenant_id
    and operation.operation_name='APPROVE_SUPPLIER_ITEM' and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_record from public.os_inventory_supplier_items supplier where supplier.tenant_id=p_tenant_id
    and supplier.id=p_supplier_item_id for update;
  if not found or v_record.version<>p_expected_version or v_record.status<>'draft' then
    raise exception using errcode='40001',message='inventory_supplier_item_version_conflict';
  end if;
  if v_record.created_by=p_actor_profile_id then raise exception using errcode='42501',message='inventory_supplier_item_self_approval_prohibited'; end if;
  if v_record.price_expires_at<=clock_timestamp() then raise exception using errcode='P0001',message='inventory_supplier_item_price_stale'; end if;
  update public.os_inventory_supplier_items supplier set status='approved',approved_by=p_actor_profile_id,
    approved_at=clock_timestamp(),version=supplier.version+1,updated_at=clock_timestamp()
    where supplier.tenant_id=p_tenant_id and supplier.id=p_supplier_item_id returning * into v_record;
  v_response:=jsonb_build_object('id',v_record.id,'status',v_record.status,'version',v_record.version,'approvedAt',v_record.approved_at);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'APPROVE_SUPPLIER_ITEM',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_supplier_items',v_record.id,v_record.version,v_response);
  return v_response;
end; $$;
revoke all on function public.approve_inventory_supplier_item(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.approve_inventory_supplier_item(uuid,uuid,uuid,integer,text) to service_role;

commit;
