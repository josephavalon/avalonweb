-- Connected Inventory governance: keep compatibility-created nurse locations
-- attached to physical kits, control custody changes, and version policy/kill
-- switch evidence without mutating an approved record.

begin;

alter table public.os_inventory_operation_requests
  drop constraint if exists os_inventory_operation_requests_name_check;
alter table public.os_inventory_operation_requests
  add constraint os_inventory_operation_requests_name_check check (operation_name in (
    'SET_PAR_LEVEL', 'TRANSITION_RESTOCK_REQUEST', 'ADMIN_INVENTORY_MOVEMENT',
    'FULFILL_RESTOCK_REQUEST', 'CREATE_INVENTORY_ITEM', 'CREATE_INVENTORY_VARIANT',
    'CREATE_INVENTORY_LOT', 'CREATE_INVENTORY_VENDOR', 'CREATE_DRAFT_PURCHASE_ORDER',
    'CREATE_PURCHASE_ORDER_LINE', 'RECEIVE_PURCHASE_ORDER_LINE', 'START_INVENTORY_COUNT',
    'SUBMIT_INVENTORY_COUNT', 'REVIEW_INVENTORY_COUNT', 'CREATE_CONNECTED_RESTOCK',
    'DISPATCH_INVENTORY_HANDOFF', 'RECEIVE_INVENTORY_HANDOFF', 'SUBMIT_PURCHASE_ORDER',
    'APPROVE_PURCHASE_ORDER', 'RECORD_PURCHASE_ORDER_EVENT', 'CREATE_RECEIVING_INSPECTION',
    'POST_RECEIVING_INSPECTION', 'RECORD_A1_PROPOSAL', 'ACCEPT_CONNECTED_KIT_CUSTODY',
    'DISPUTE_CONNECTED_KIT_CUSTODY', 'RECONCILE_SHIFT_INVENTORY', 'CLASSIFY_INVENTORY_ITEM',
    'CREATE_SUPPLIER_ITEM', 'APPROVE_SUPPLIER_ITEM', 'REQUEST_KIT_RETURN',
    'REPORT_KIT_LOST', 'ASSIGN_KIT_CUSTODY', 'CREATE_PROCUREMENT_POLICY',
    'APPROVE_PROCUREMENT_POLICY', 'SET_AUTOMATION_CONTROL'
  ));

create or replace function app_private.connect_physical_kit_for_location()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.location_type='nurse_kit' then
    insert into public.os_inventory_kits (
      id,tenant_id,location_id,kit_code,status,version,created_by,created_at,updated_at
    ) values (new.id,new.tenant_id,new.id,new.location_code,'assignment_pending',new.version,
      new.created_by,new.created_at,new.updated_at)
    on conflict (tenant_id,location_id) do nothing;
  end if;
  return new;
end; $$;
revoke all on function app_private.connect_physical_kit_for_location() from public,anon,authenticated,service_role;
drop trigger if exists os_inventory_location_connect_physical_kit on public.os_inventory_locations;
create trigger os_inventory_location_connect_physical_kit
  after insert on public.os_inventory_locations for each row
  execute function app_private.connect_physical_kit_for_location();

create or replace function app_private.connect_assignment_to_physical_kit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_kit_id uuid;
begin
  select kit.id into v_kit_id from public.os_inventory_kits kit
  where kit.tenant_id=new.tenant_id and kit.location_id=new.location_id;
  if v_kit_id is null and exists (
    select 1 from public.os_inventory_locations location
    where location.tenant_id=new.tenant_id and location.id=new.location_id and location.location_type<>'nurse_kit'
  ) then return new; end if;
  if v_kit_id is null then raise exception using errcode='P0001',message='inventory_physical_kit_required'; end if;
  if new.kit_id is not null and new.kit_id<>v_kit_id then
    raise exception using errcode='P0001',message='inventory_assignment_kit_location_mismatch';
  end if;
  new.kit_id:=v_kit_id;
  return new;
end; $$;
revoke all on function app_private.connect_assignment_to_physical_kit() from public,anon,authenticated,service_role;
drop trigger if exists os_inventory_assignment_connect_physical_kit on public.os_inventory_location_assignments;
create trigger os_inventory_assignment_connect_physical_kit
  before insert or update of location_id,kit_id on public.os_inventory_location_assignments
  for each row execute function app_private.connect_assignment_to_physical_kit();

create or replace function public.request_connected_kit_return(
  p_tenant_id uuid,p_nurse_profile_id uuid,p_kit_id uuid,p_expected_version integer,
  p_reason_code text,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_assignment public.os_inventory_location_assignments%rowtype; v_kit public.os_inventory_kits%rowtype;
  v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.require_single_active_nurse_provider(p_tenant_id,p_nurse_profile_id);
  if p_expected_version is null or p_expected_version<1 or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='kit_return_request_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('kitId',p_kit_id,'expectedVersion',p_expected_version,
    'reasonCode',v_reason,'nurseProfileId',p_nurse_profile_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('kit-custody:'||p_tenant_id::text||':'||p_kit_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='REQUEST_KIT_RETURN'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload; end if;
  select * into v_assignment from public.os_inventory_location_assignments assignment
    where assignment.tenant_id=p_tenant_id and assignment.kit_id=p_kit_id
      and assignment.nurse_profile_id=p_nurse_profile_id and assignment.assignment_status='accepted'
      and assignment.ended_at is null for update;
  if not found or v_assignment.version<>p_expected_version then
    raise exception using errcode='40001',message='nurse_kit_assignment_version_conflict';
  end if;
  update public.os_inventory_kits kit set status='return_pending',version=kit.version+1,updated_at=clock_timestamp()
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id and kit.status='in_custody' returning * into v_kit;
  if not found then raise exception using errcode='P0001',message='inventory_kit_return_not_allowed'; end if;
  insert into public.os_inventory_exceptions (tenant_id,exception_type,severity,entity_type,entity_id,reason_code,evidence)
    values (p_tenant_id,'kit_return','info','os_inventory_kits',p_kit_id,v_reason,
      jsonb_build_object('assignmentId',v_assignment.id));
  v_response:=jsonb_build_object('kitId',v_kit.id,'kitStatus',v_kit.status,'kitVersion',v_kit.version,
    'assignmentId',v_assignment.id,'assignmentVersion',v_assignment.version);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'REQUEST_KIT_RETURN',p_idempotency_key,v_hash,p_nurse_profile_id,
      'os_inventory_kits',v_kit.id,v_kit.version,v_response);
  return v_response;
end; $$;
revoke all on function public.request_connected_kit_return(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.request_connected_kit_return(uuid,uuid,uuid,integer,text,text) to service_role;

create or replace function public.report_connected_kit_lost(
  p_tenant_id uuid,p_nurse_profile_id uuid,p_kit_id uuid,p_expected_version integer,
  p_reason_code text,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_assignment public.os_inventory_location_assignments%rowtype; v_kit public.os_inventory_kits%rowtype;
  v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.require_single_active_nurse_provider(p_tenant_id,p_nurse_profile_id);
  if p_expected_version is null or p_expected_version<1 or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='kit_lost_report_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('kitId',p_kit_id,'expectedVersion',p_expected_version,
    'reasonCode',v_reason,'nurseProfileId',p_nurse_profile_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('kit-custody:'||p_tenant_id::text||':'||p_kit_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='REPORT_KIT_LOST'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload; end if;
  select * into v_assignment from public.os_inventory_location_assignments assignment
    where assignment.tenant_id=p_tenant_id and assignment.kit_id=p_kit_id
      and assignment.nurse_profile_id=p_nurse_profile_id and assignment.assignment_status='accepted'
      and assignment.ended_at is null for update;
  if not found or v_assignment.version<>p_expected_version then
    raise exception using errcode='40001',message='nurse_kit_assignment_version_conflict';
  end if;
  update public.os_inventory_location_assignments assignment set assignment_status='revoked',ended_at=clock_timestamp(),
    version=assignment.version+1 where assignment.tenant_id=p_tenant_id and assignment.id=v_assignment.id returning * into v_assignment;
  update public.os_inventory_kits kit set status='lost',version=kit.version+1,updated_at=clock_timestamp()
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id and kit.status in ('in_custody','return_pending') returning * into v_kit;
  if not found then raise exception using errcode='P0001',message='inventory_kit_lost_not_allowed'; end if;
  insert into public.os_inventory_exceptions (tenant_id,exception_type,severity,entity_type,entity_id,reason_code,evidence)
    values (p_tenant_id,'kit_lost','critical','os_inventory_kits',p_kit_id,v_reason,
      jsonb_build_object('assignmentId',v_assignment.id));
  v_response:=jsonb_build_object('kitId',v_kit.id,'kitStatus',v_kit.status,'kitVersion',v_kit.version,
    'assignmentId',v_assignment.id,'assignmentStatus',v_assignment.assignment_status,'assignmentVersion',v_assignment.version);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'REPORT_KIT_LOST',p_idempotency_key,v_hash,p_nurse_profile_id,
      'os_inventory_kits',v_kit.id,v_kit.version,v_response);
  return v_response;
end; $$;
revoke all on function public.report_connected_kit_lost(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.report_connected_kit_lost(uuid,uuid,uuid,integer,text,text) to service_role;

create or replace function public.assign_connected_kit_custody(
  p_tenant_id uuid,p_actor_profile_id uuid,p_kit_id uuid,p_nurse_profile_id uuid,
  p_expected_kit_version integer,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_kit public.os_inventory_kits%rowtype; v_provider_id uuid;
  v_old public.os_inventory_location_assignments%rowtype; v_assignment public.os_inventory_location_assignments%rowtype;
  v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_expected_kit_version is null or p_expected_kit_version<1
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='kit_custody_assignment_invalid';
  end if;
  v_provider_id:=app_private.require_single_active_nurse_provider(p_tenant_id,p_nurse_profile_id);
  v_hash:=encode(extensions.digest(jsonb_build_object('kitId',p_kit_id,'nurseProfileId',p_nurse_profile_id,
    'expectedKitVersion',p_expected_kit_version)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('kit-custody:'||p_tenant_id::text||':'||p_kit_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='ASSIGN_KIT_CUSTODY'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload; end if;
  select * into v_kit from public.os_inventory_kits kit where kit.tenant_id=p_tenant_id and kit.id=p_kit_id for update;
  if not found or v_kit.version<>p_expected_kit_version or v_kit.status not in ('ready','return_pending','assignment_pending') then
    raise exception using errcode='40001',message='inventory_kit_version_conflict';
  end if;
  select * into v_old from public.os_inventory_location_assignments assignment
    where assignment.tenant_id=p_tenant_id and assignment.kit_id=p_kit_id
      and assignment.assignment_status in ('assigned','accepted') and assignment.ended_at is null for update;
  if found then
    if v_old.assignment_status='accepted' and v_kit.status<>'return_pending' then
      raise exception using errcode='P0001',message='inventory_kit_return_required';
    end if;
    update public.os_inventory_location_assignments assignment set assignment_status='ended',ended_at=clock_timestamp(),
      version=assignment.version+1 where assignment.tenant_id=p_tenant_id and assignment.id=v_old.id;
  end if;
  insert into public.os_inventory_location_assignments (
    tenant_id,location_id,kit_id,provider_profile_id,nurse_profile_id,assignment_status,is_primary,assigned_by
  ) values (p_tenant_id,v_kit.location_id,v_kit.id,v_provider_id,p_nurse_profile_id,'assigned',true,p_actor_profile_id)
  returning * into v_assignment;
  update public.os_inventory_kits kit set status='assignment_pending',version=kit.version+1,updated_at=clock_timestamp()
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id returning * into v_kit;
  v_response:=jsonb_build_object('kitId',v_kit.id,'kitStatus',v_kit.status,'kitVersion',v_kit.version,
    'assignmentId',v_assignment.id,'assignmentStatus',v_assignment.assignment_status,'assignmentVersion',v_assignment.version);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'ASSIGN_KIT_CUSTODY',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_location_assignments',v_assignment.id,v_assignment.version,v_response);
  return v_response;
end; $$;
revoke all on function public.assign_connected_kit_custody(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.assign_connected_kit_custody(uuid,uuid,uuid,uuid,integer,text) to service_role;

create or replace function public.create_inventory_procurement_policy(
  p_tenant_id uuid,p_actor_profile_id uuid,p_budget_remaining_cents bigint,p_max_order_total_cents bigint,
  p_max_units_per_line numeric,p_max_lead_time_days integer,p_expiry_risk_days integer,
  p_effective_at timestamptz,p_expires_at timestamptz,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_policy public.os_inventory_procurement_policies%rowtype; v_version integer;
  v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_budget_remaining_cents<0 or p_max_order_total_cents<0 or p_max_units_per_line<=0
     or p_max_lead_time_days<0 or p_expiry_risk_days<0 or p_effective_at is null
     or (p_expires_at is not null and p_expires_at<=p_effective_at)
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_procurement_policy_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('budgetRemainingCents',p_budget_remaining_cents,
    'maxOrderTotalCents',p_max_order_total_cents,'maxUnitsPerLine',p_max_units_per_line,
    'maxLeadTimeDays',p_max_lead_time_days,'expiryRiskDays',p_expiry_risk_days,
    'effectiveAt',p_effective_at,'expiresAt',p_expires_at)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('procurement-policy:'||p_tenant_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='CREATE_PROCUREMENT_POLICY'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload; end if;
  select coalesce(max(policy.version),0)+1 into v_version from public.os_inventory_procurement_policies policy
    where policy.tenant_id=p_tenant_id;
  insert into public.os_inventory_procurement_policies (tenant_id,status,budget_remaining_cents,max_order_total_cents,
    max_units_per_line,max_lead_time_days,expiry_risk_days,version,created_by,effective_at,expires_at)
  values (p_tenant_id,'draft',p_budget_remaining_cents,p_max_order_total_cents,p_max_units_per_line,
    p_max_lead_time_days,p_expiry_risk_days,v_version,p_actor_profile_id,p_effective_at,p_expires_at)
  returning * into v_policy;
  v_response:=jsonb_build_object('id',v_policy.id,'status',v_policy.status,'version',v_policy.version);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'CREATE_PROCUREMENT_POLICY',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_procurement_policies',v_policy.id,v_policy.version,v_response);
  return v_response;
end; $$;
revoke all on function public.create_inventory_procurement_policy(uuid,uuid,bigint,bigint,numeric,integer,integer,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.create_inventory_procurement_policy(uuid,uuid,bigint,bigint,numeric,integer,integer,timestamptz,timestamptz,text) to service_role;

create or replace function public.approve_inventory_procurement_policy(
  p_tenant_id uuid,p_actor_profile_id uuid,p_policy_id uuid,p_expected_version integer,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_draft public.os_inventory_procurement_policies%rowtype; v_policy public.os_inventory_procurement_policies%rowtype;
  v_version integer; v_hash text; v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['procurement']::text[]);
  if p_expected_version is null or p_expected_version<1
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_procurement_policy_approval_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object('policyId',p_policy_id,
    'expectedVersion',p_expected_version)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('procurement-policy:'||p_tenant_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='APPROVE_PROCUREMENT_POLICY'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload; end if;
  select * into v_draft from public.os_inventory_procurement_policies policy
    where policy.tenant_id=p_tenant_id and policy.id=p_policy_id;
  if not found or v_draft.status<>'draft' or v_draft.version<>p_expected_version then
    raise exception using errcode='40001',message='inventory_procurement_policy_version_conflict';
  end if;
  if v_draft.created_by=p_actor_profile_id then
    raise exception using errcode='42501',message='inventory_procurement_policy_self_approval_prohibited';
  end if;
  if v_draft.expires_at is not null and v_draft.expires_at<=clock_timestamp() then
    raise exception using errcode='P0001',message='inventory_procurement_policy_expired';
  end if;
  select coalesce(max(policy.version),0)+1 into v_version from public.os_inventory_procurement_policies policy
    where policy.tenant_id=p_tenant_id;
  insert into public.os_inventory_procurement_policies (tenant_id,status,budget_remaining_cents,max_order_total_cents,
    max_units_per_line,max_lead_time_days,expiry_risk_days,version,created_by,approved_by,approved_at,effective_at,expires_at)
  values (p_tenant_id,'approved',v_draft.budget_remaining_cents,v_draft.max_order_total_cents,
    v_draft.max_units_per_line,v_draft.max_lead_time_days,v_draft.expiry_risk_days,v_version,
    v_draft.created_by,p_actor_profile_id,clock_timestamp(),v_draft.effective_at,v_draft.expires_at)
  returning * into v_policy;
  v_response:=jsonb_build_object('id',v_policy.id,'status',v_policy.status,'version',v_policy.version,
    'sourcePolicyId',v_draft.id,'approvedAt',v_policy.approved_at);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'APPROVE_PROCUREMENT_POLICY',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_procurement_policies',v_policy.id,v_policy.version,v_response);
  return v_response;
end; $$;
revoke all on function public.approve_inventory_procurement_policy(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.approve_inventory_procurement_policy(uuid,uuid,uuid,integer,text) to service_role;

create or replace function public.set_inventory_automation_control(
  p_tenant_id uuid,p_actor_profile_id uuid,p_scope_type text,p_scope_id text,p_execution_enabled boolean,
  p_a1_drafts_enabled boolean,p_kill_switch boolean,p_reason_code text,p_effective_at timestamptz,
  p_expires_at timestamptz,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_control public.os_inventory_automation_controls%rowtype; v_version integer;
  v_reason text:=upper(trim(coalesce(p_reason_code,''))); v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype; v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_admin']::text[]);
  if p_scope_type not in ('global','tenant','location','vendor','category','sku','adapter')
     or coalesce(trim(p_scope_id),'')='' or char_length(p_scope_id)>160 or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or p_effective_at is null or (p_expires_at is not null and p_expires_at<=p_effective_at)
     or p_execution_enabled or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='inventory_automation_control_invalid';
  end if;
  -- V1 can enable A1 drafts only. Supplier execution remains structurally off.
  v_hash:=encode(extensions.digest(jsonb_build_object('scopeType',p_scope_type,'scopeId',trim(p_scope_id),
    'executionEnabled',p_execution_enabled,'a1DraftsEnabled',p_a1_drafts_enabled,'killSwitch',p_kill_switch,
    'reasonCode',v_reason,'effectiveAt',p_effective_at,'expiresAt',p_expires_at)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('automation-control:'||p_tenant_id::text||':'||p_scope_type||':'||trim(p_scope_id),0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='SET_AUTOMATION_CONTROL'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload; end if;
  select coalesce(max(control.version),0)+1 into v_version from public.os_inventory_automation_controls control
    where control.tenant_id=p_tenant_id and control.scope_type=p_scope_type and control.scope_id=trim(p_scope_id);
  insert into public.os_inventory_automation_controls (tenant_id,scope_type,scope_id,execution_enabled,
    a1_drafts_enabled,kill_switch,version,changed_by,reason_code,effective_at,expires_at)
  values (p_tenant_id,p_scope_type,trim(p_scope_id),false,p_a1_drafts_enabled,p_kill_switch,
    v_version,p_actor_profile_id,v_reason,p_effective_at,p_expires_at) returning * into v_control;
  v_response:=jsonb_build_object('id',v_control.id,'scopeType',v_control.scope_type,'scopeId',v_control.scope_id,
    'executionEnabled',v_control.execution_enabled,'a1DraftsEnabled',v_control.a1_drafts_enabled,
    'killSwitch',v_control.kill_switch,'version',v_control.version);
  insert into public.os_inventory_operation_requests (tenant_id,operation_name,request_idempotency_key,request_hash,
    actor_profile_id,result_entity_type,result_entity_id,result_version,response_payload)
    values (p_tenant_id,'SET_AUTOMATION_CONTROL',p_idempotency_key,v_hash,p_actor_profile_id,
      'os_inventory_automation_controls',v_control.id,v_control.version,v_response);
  return v_response;
end; $$;
revoke all on function public.set_inventory_automation_control(uuid,uuid,text,text,boolean,boolean,boolean,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.set_inventory_automation_control(uuid,uuid,text,text,boolean,boolean,boolean,text,timestamptz,timestamptz,text) to service_role;

commit;
