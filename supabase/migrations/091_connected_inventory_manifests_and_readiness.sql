-- Clinical manifest authoring and short-lived connected readiness evidence.
-- This extends the nurse-marketplace reservation system from migrations 078/080.

begin;

alter table public.nurse_supply_manifest_versions
  add column if not exists effective_at timestamptz,
  add column if not exists expires_at timestamptz;

alter table public.nurse_supply_manifest_versions drop constraint if exists nurse_supply_manifest_versions_effective_window_check;
alter table public.nurse_supply_manifest_versions add constraint nurse_supply_manifest_versions_effective_window_check
  check (expires_at is null or (effective_at is not null and expires_at>effective_at));

alter table public.nurse_supply_manifest_requirements
  add column if not exists allowed_alternatives jsonb not null default '[]'::jsonb,
  add column if not exists minimum_expiry_days integer not null default 0,
  add column if not exists regulated_rule_code text;

alter table public.nurse_supply_manifest_requirements drop constraint if exists nurse_supply_manifest_requirements_alternatives_check;
alter table public.nurse_supply_manifest_requirements add constraint nurse_supply_manifest_requirements_alternatives_check check (
  jsonb_typeof(allowed_alternatives)='array' and minimum_expiry_days>=0
  and (regulated_rule_code is null or regulated_rule_code ~ '^[A-Z0-9_]{3,100}$')
);

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
  'CREATE_SUPPLY_MANIFEST_VERSION','APPROVE_SUPPLY_MANIFEST_VERSION','EVALUATE_CONNECTED_SHIFT_READINESS'
));

create or replace function public.create_supply_manifest_version(
  p_tenant_id uuid,p_actor_profile_id uuid,p_manifest_key text,p_name text,p_service_code text,p_role_required text,
  p_requirements jsonb,p_effective_at timestamptz,p_expires_at timestamptz,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_manifest public.nurse_supply_manifests%rowtype; v_version public.nurse_supply_manifest_versions%rowtype;
  v_requirement jsonb; v_number integer; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['clinical_approver']::text[]);
  if char_length(trim(coalesce(p_manifest_key,''))) not between 1 and 100
     or char_length(trim(coalesce(p_name,''))) not between 1 and 180
     or char_length(trim(coalesce(p_service_code,''))) not between 1 and 100
     or char_length(trim(coalesce(p_role_required,''))) not between 1 and 80
     or p_requirements is null or jsonb_typeof(p_requirements)<>'array' or jsonb_array_length(p_requirements)=0
     or p_effective_at is null or (p_expires_at is not null and p_expires_at<=p_effective_at)
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_manifest_version_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('manifestKey',trim(p_manifest_key),'name',trim(p_name),'serviceCode',trim(p_service_code),
    'roleRequired',trim(p_role_required),'requirements',p_requirements,'effectiveAt',p_effective_at,'expiresAt',p_expires_at)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-manifest:'||p_tenant_id::text||':'||trim(p_manifest_key),0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='CREATE_SUPPLY_MANIFEST_VERSION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_manifest from public.nurse_supply_manifests where tenant_id=p_tenant_id and manifest_key=trim(p_manifest_key) for update;
  if not found then
    insert into public.nurse_supply_manifests(tenant_id,manifest_key,name,service_code,role_required,created_by)
      values(p_tenant_id,trim(p_manifest_key),trim(p_name),trim(p_service_code),trim(p_role_required),p_actor_profile_id) returning * into v_manifest;
  elsif v_manifest.service_code<>trim(p_service_code) or v_manifest.role_required<>trim(p_role_required) then
    raise exception using errcode='P0001',message='inventory_manifest_identity_conflict';
  end if;
  select coalesce(max(version),0)+1 into v_number from public.nurse_supply_manifest_versions where tenant_id=p_tenant_id and manifest_id=v_manifest.id;
  insert into public.nurse_supply_manifest_versions(tenant_id,manifest_id,version,status,content_hash,requirements_hash,created_by,effective_at,expires_at)
    values(p_tenant_id,v_manifest.id,v_number,'draft',v_hash,v_hash,p_actor_profile_id,p_effective_at,p_expires_at) returning * into v_version;
  for v_requirement in select value from jsonb_array_elements(p_requirements) loop
    if coalesce(v_requirement->>'itemId','') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_requirement->>'quantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$' or (v_requirement->>'quantity')::numeric<=0
       or coalesce(v_requirement->'allowedAlternatives','[]'::jsonb) is null
       or jsonb_typeof(coalesce(v_requirement->'allowedAlternatives','[]'::jsonb))<>'array'
       or not exists(select 1 from public.os_inventory_items item where item.tenant_id=p_tenant_id and item.id=(v_requirement->>'itemId')::uuid
         and item.status='active' and item.archived_at is null and item.regulated_class<>'unknown' and item.classification_reviewed_at is not null) then
      raise exception using errcode='P0001',message='inventory_manifest_requirement_not_eligible';
    end if;
    insert into public.nurse_supply_manifest_requirements(tenant_id,manifest_version_id,item_id,variant_id,quantity,lot_required,
      temperature_evidence_required,calibration_evidence_required,pickup_allowed,sort_order,allowed_alternatives,minimum_expiry_days,regulated_rule_code)
    values(p_tenant_id,v_version.id,(v_requirement->>'itemId')::uuid,nullif(v_requirement->>'variantId','')::uuid,(v_requirement->>'quantity')::numeric,
      coalesce((v_requirement->>'lotRequired')::boolean,false),coalesce((v_requirement->>'temperatureEvidenceRequired')::boolean,false),
      coalesce((v_requirement->>'calibrationEvidenceRequired')::boolean,false),coalesce((v_requirement->>'pickupAllowed')::boolean,true),
      coalesce((v_requirement->>'sortOrder')::integer,0),coalesce(v_requirement->'allowedAlternatives','[]'::jsonb),
      coalesce((v_requirement->>'minimumExpiryDays')::integer,0),nullif(upper(trim(v_requirement->>'regulatedRuleCode')),''));
  end loop;
  v_response:=jsonb_build_object('manifestId',v_manifest.id,'manifestVersionId',v_version.id,'status',v_version.status,'version',v_version.version,'contentHash',v_version.content_hash);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'CREATE_SUPPLY_MANIFEST_VERSION',p_idempotency_key,v_hash,p_actor_profile_id,'nurse_supply_manifest_versions',v_version.id,v_version.version,v_response);
  return v_response;
end $$;
revoke all on function public.create_supply_manifest_version(uuid,uuid,text,text,text,text,jsonb,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.create_supply_manifest_version(uuid,uuid,text,text,text,text,jsonb,timestamptz,timestamptz,text) to service_role;

create or replace function public.approve_supply_manifest_version(
  p_tenant_id uuid,p_actor_profile_id uuid,p_manifest_version_id uuid,p_expected_content_hash text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_version public.nurse_supply_manifest_versions%rowtype; v_replay public.os_inventory_operation_requests%rowtype; v_hash text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['clinical_approver']::text[]);
  if coalesce(p_expected_content_hash,'') !~ '^[0-9a-f]{64}$' or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_manifest_approval_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('manifestVersionId',p_manifest_version_id,'expectedContentHash',p_expected_content_hash)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-manifest-version:'||p_tenant_id::text||':'||p_manifest_version_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='APPROVE_SUPPLY_MANIFEST_VERSION' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_version from public.nurse_supply_manifest_versions where tenant_id=p_tenant_id and id=p_manifest_version_id for update;
  if not found or v_version.status not in ('draft','clinical_review') or v_version.content_hash<>p_expected_content_hash then raise exception using errcode='40001',message='inventory_manifest_version_conflict'; end if;
  if v_version.created_by=p_actor_profile_id then raise exception using errcode='42501',message='inventory_manifest_self_approval_prohibited'; end if;
  if v_version.expires_at is not null and v_version.expires_at<=clock_timestamp() then raise exception using errcode='P0001',message='inventory_manifest_expired'; end if;
  update public.nurse_supply_manifest_versions set status='approved',clinical_reviewed_by=p_actor_profile_id,clinical_reviewed_at=clock_timestamp(),
    approved_by=p_actor_profile_id,approved_at=clock_timestamp(),published_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=p_manifest_version_id returning * into v_version;
  v_response:=jsonb_build_object('manifestVersionId',v_version.id,'status',v_version.status,'version',v_version.version,'contentHash',v_version.content_hash,'approvedAt',v_version.approved_at);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'APPROVE_SUPPLY_MANIFEST_VERSION',p_idempotency_key,v_hash,p_actor_profile_id,'nurse_supply_manifest_versions',v_version.id,v_version.version,v_response);
  return v_response;
end $$;
revoke all on function public.approve_supply_manifest_version(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.approve_supply_manifest_version(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.evaluate_connected_shift_readiness(
  p_tenant_id uuid,p_actor_profile_id uuid,p_shift_id uuid,p_kit_id uuid,p_evaluator_version text,p_ttl_minutes integer,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_kit public.os_inventory_kits%rowtype; v_assignment public.os_inventory_location_assignments%rowtype;
  v_manifest public.nurse_shift_supply_requirements%rowtype; v_count public.os_inventory_count_sessions%rowtype;
  v_outcome text:='ready'; v_rules jsonb:='[]'::jsonb; v_reservations uuid[]:='{}'; v_snapshot text;
  v_eval public.os_inventory_readiness_evaluations%rowtype; v_replay public.os_inventory_operation_requests%rowtype; v_hash text; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if char_length(trim(coalesce(p_evaluator_version,''))) not between 1 and 100 or p_ttl_minutes not between 1 and 240
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then raise exception using errcode='22023',message='inventory_readiness_request_invalid'; end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('shiftId',p_shift_id,'kitId',p_kit_id,'evaluatorVersion',p_evaluator_version,'ttlMinutes',p_ttl_minutes)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-readiness:'||p_tenant_id::text||':'||p_shift_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests where tenant_id=p_tenant_id and operation_name='EVALUATE_CONNECTED_SHIFT_READINESS' and request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if; return v_replay.response_payload; end if;
  select * into v_kit from public.os_inventory_kits where tenant_id=p_tenant_id and id=p_kit_id;
  if not found then raise exception using errcode='P0002',message='inventory_kit_not_found'; end if;
  select * into v_assignment from public.os_inventory_location_assignments where tenant_id=p_tenant_id and kit_id=p_kit_id and assignment_status='accepted' and ended_at is null;
  v_rules:=v_rules||jsonb_build_array(jsonb_build_object('ruleCode','ACCEPTED_CUSTODY','outcome',case when found and v_kit.status='in_custody' then 'pass' else 'fail' end));
  if not found or v_kit.status<>'in_custody' then v_outcome:='blocked'; end if;
  select * into v_manifest from public.nurse_shift_supply_requirements where tenant_id=p_tenant_id and shift_id=p_shift_id and invalidated_at is null;
  if not found then raise exception using errcode='P0001',message='approved_supply_manifest_required'; end if;
  v_rules:=v_rules||jsonb_build_array(jsonb_build_object('ruleCode','APPROVED_MANIFEST','outcome',case when found and exists(select 1 from public.nurse_supply_manifest_versions m where m.tenant_id=p_tenant_id and m.id=v_manifest.manifest_version_id and m.status='approved' and coalesce(m.effective_at,'-infinity')<=clock_timestamp() and coalesce(m.expires_at,'infinity')>clock_timestamp()) then 'pass' else 'fail' end));
  if not found or not exists(select 1 from public.nurse_supply_manifest_versions m where m.tenant_id=p_tenant_id and m.id=v_manifest.manifest_version_id and m.status='approved' and coalesce(m.effective_at,'-infinity')<=clock_timestamp() and coalesce(m.expires_at,'infinity')>clock_timestamp()) then v_outcome:='blocked'; end if;
  select * into v_count from public.os_inventory_count_sessions where tenant_id=p_tenant_id and kit_id=p_kit_id and status in ('reconciled','approved_adjustment') and reviewed_at>clock_timestamp()-interval '24 hours' order by reviewed_at desc limit 1;
  v_rules:=v_rules||jsonb_build_array(jsonb_build_object('ruleCode','FRESH_ACCEPTED_COUNT','outcome',case when found then 'pass' else 'fail' end));
  if not found then v_outcome:='blocked'; end if;
  select coalesce(array_agg(r.id order by r.id),'{}'::uuid[]) into v_reservations from public.nurse_inventory_reservations r
    where r.tenant_id=p_tenant_id and r.shift_id=p_shift_id and r.location_id=v_kit.location_id and r.status='reserved' and r.expires_at>clock_timestamp();
  if cardinality(v_reservations)=0 then
    v_outcome:=case when exists(select 1 from public.nurse_pickup_tasks p where p.tenant_id=p_tenant_id and p.shift_id=p_shift_id and p.status in ('required','acknowledged','arrived')) then 'pickup_required' else 'blocked' end;
  end if;
  v_rules:=v_rules||jsonb_build_array(jsonb_build_object('ruleCode','ACTIVE_RESERVATIONS','outcome',case when cardinality(v_reservations)>0 then 'pass' else 'fail' end,'reservationCount',cardinality(v_reservations)));
  if exists(select 1 from public.nurse_inventory_reservations r join public.os_inventory_lots l on l.tenant_id=r.tenant_id and l.id=r.lot_id
    where r.tenant_id=p_tenant_id and r.shift_id=p_shift_id and r.status='reserved' and (l.disposition_status<>'available' or l.expires_on<current_date
      or (l.temperature_controlled and coalesce(l.temperature_evidence_expires_at,'-infinity')<=clock_timestamp())
      or (l.calibration_required and coalesce(l.calibration_expires_at,'-infinity')<=clock_timestamp())))
    or exists(select 1 from public.os_inventory_holds h where h.tenant_id=p_tenant_id and h.status='active' and (h.kit_id=p_kit_id or h.location_id=v_kit.location_id)) then
    v_outcome:='blocked'; v_rules:=v_rules||jsonb_build_array(jsonb_build_object('ruleCode','LOT_AND_HOLD_SAFETY','outcome','fail'));
  else v_rules:=v_rules||jsonb_build_array(jsonb_build_object('ruleCode','LOT_AND_HOLD_SAFETY','outcome','pass')); end if;
  select encode(extensions.digest(coalesce(string_agg(m.id::text||':'||m.quantity_delta::text||':'||m.occurred_at::text,'|' order by m.id),'empty'),'sha256'),'hex') into v_snapshot
    from public.os_stock_transactions m where m.tenant_id=p_tenant_id and (m.from_location_id=v_kit.location_id or m.to_location_id=v_kit.location_id);
  update public.os_inventory_readiness_evaluations set invalidated_at=clock_timestamp(),invalidation_code='RECOMPUTED' where tenant_id=p_tenant_id and shift_id=p_shift_id and invalidated_at is null;
  insert into public.os_inventory_readiness_evaluations(tenant_id,shift_id,kit_id,manifest_version_id,ledger_snapshot_hash,reservation_ids,count_session_id,evaluator_version,outcome,rule_results,expires_at)
    values(p_tenant_id,p_shift_id,p_kit_id,v_manifest.manifest_version_id,v_snapshot,v_reservations,v_count.id,trim(p_evaluator_version),v_outcome,v_rules,clock_timestamp()+make_interval(mins=>p_ttl_minutes)) returning * into v_eval;
  v_response:=jsonb_build_object('id',v_eval.id,'outcome',v_eval.outcome,'expiresAt',v_eval.expires_at,'ruleResults',v_eval.rule_results,'reservationIds',v_eval.reservation_ids);
  insert into public.os_inventory_operation_requests(tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values(p_tenant_id,'EVALUATE_CONNECTED_SHIFT_READINESS',p_idempotency_key,v_hash,p_actor_profile_id,'os_inventory_readiness_evaluations',v_eval.id,1,v_response);
  return v_response;
end $$;
revoke all on function public.evaluate_connected_shift_readiness(uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.evaluate_connected_shift_readiness(uuid,uuid,uuid,uuid,text,integer,text) to service_role;

commit;
