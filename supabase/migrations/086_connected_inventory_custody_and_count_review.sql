-- Complete the connected custody and blind-count state machines. These
-- commands are service-role only and retain immutable request evidence.

begin;

create or replace function public.accept_connected_kit_custody(
  p_tenant_id uuid,
  p_nurse_profile_id uuid,
  p_kit_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.os_inventory_location_assignments%rowtype;
  v_kit public.os_inventory_kits%rowtype;
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
begin
  if p_expected_version is null or p_expected_version < 1
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='kit_custody_acceptance_invalid';
  end if;
  perform app_private.require_single_active_nurse_provider(p_tenant_id,p_nurse_profile_id);
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenantId',p_tenant_id,'nurseProfileId',p_nurse_profile_id,
    'kitId',p_kit_id,'expectedVersion',p_expected_version
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('kit-custody:'||p_tenant_id::text||':'||p_kit_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id
      and operation.operation_name='ACCEPT_CONNECTED_KIT_CUSTODY'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_kit from public.os_inventory_kits kit
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_kit_not_found'; end if;
  select * into v_assignment from public.os_inventory_location_assignments assignment
    where assignment.tenant_id=p_tenant_id and assignment.kit_id=p_kit_id
      and assignment.nurse_profile_id=p_nurse_profile_id
      and assignment.assignment_status in ('assigned','accepted') and assignment.ended_at is null
    for update;
  if not found then raise exception using errcode='42501',message='nurse_kit_assignment_not_available'; end if;
  if v_assignment.version<>p_expected_version then
    raise exception using errcode='40001',message='nurse_kit_assignment_version_conflict';
  end if;
  if v_assignment.assignment_status='assigned' then
    update public.os_inventory_location_assignments assignment set
      assignment_status='accepted',accepted_at=clock_timestamp(),version=assignment.version+1
    where assignment.tenant_id=p_tenant_id and assignment.id=v_assignment.id
    returning * into v_assignment;
  end if;
  update public.os_inventory_kits kit set status='in_custody',version=kit.version+1
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id returning * into v_kit;
  v_response:=jsonb_build_object('assignmentId',v_assignment.id,'assignmentStatus',v_assignment.assignment_status,
    'assignmentVersion',v_assignment.version,'kitId',v_kit.id,'kitStatus',v_kit.status,'kitVersion',v_kit.version);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'ACCEPT_CONNECTED_KIT_CUSTODY',p_idempotency_key,v_hash,p_nurse_profile_id,
    'os_inventory_location_assignments',v_assignment.id,v_assignment.version,v_response);
  insert into public.audit_events (tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload)
    values (p_tenant_id,p_nurse_profile_id,'connected_kit_custody_accepted','os_inventory_kits',v_kit.id,false,v_hash,
      jsonb_build_object('assignment_id',v_assignment.id,'assignment_version',v_assignment.version,'kit_version',v_kit.version));
  return v_response;
end;
$$;
revoke all on function public.accept_connected_kit_custody(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.accept_connected_kit_custody(uuid,uuid,uuid,integer,text) to service_role;

create or replace function public.dispute_connected_kit_custody(
  p_tenant_id uuid,
  p_nurse_profile_id uuid,
  p_kit_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.os_inventory_location_assignments%rowtype;
  v_kit public.os_inventory_kits%rowtype;
  v_reason text:=upper(trim(coalesce(p_reason_code,'')));
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_response jsonb;
begin
  if p_expected_version is null or p_expected_version < 1 or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode='22023',message='kit_custody_dispute_invalid';
  end if;
  perform app_private.require_single_active_nurse_provider(p_tenant_id,p_nurse_profile_id);
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenantId',p_tenant_id,'nurseProfileId',p_nurse_profile_id,'kitId',p_kit_id,
    'expectedVersion',p_expected_version,'reasonCode',v_reason
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('kit-custody:'||p_tenant_id::text||':'||p_kit_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id
      and operation.operation_name='DISPUTE_CONNECTED_KIT_CUSTODY'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_kit from public.os_inventory_kits kit
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_kit_not_found'; end if;
  select * into v_assignment from public.os_inventory_location_assignments assignment
    where assignment.tenant_id=p_tenant_id and assignment.kit_id=p_kit_id
      and assignment.nurse_profile_id=p_nurse_profile_id
      and assignment.assignment_status in ('assigned','accepted') and assignment.ended_at is null
    for update;
  if not found then raise exception using errcode='42501',message='nurse_kit_assignment_not_available'; end if;
  if v_assignment.version<>p_expected_version then
    raise exception using errcode='40001',message='nurse_kit_assignment_version_conflict';
  end if;
  update public.os_inventory_location_assignments assignment set
    assignment_status='revoked',ended_at=clock_timestamp(),version=assignment.version+1
    where assignment.tenant_id=p_tenant_id and assignment.id=v_assignment.id returning * into v_assignment;
  update public.os_inventory_kits kit set status='disputed',version=kit.version+1
    where kit.tenant_id=p_tenant_id and kit.id=p_kit_id returning * into v_kit;
  insert into public.os_inventory_exceptions (
    tenant_id,exception_type,severity,entity_type,entity_id,reason_code,evidence
  ) values (p_tenant_id,'custody_dispute','critical','os_inventory_kits',v_kit.id,v_reason,
    jsonb_build_object('assignmentId',v_assignment.id));
  v_response:=jsonb_build_object('assignmentId',v_assignment.id,'assignmentStatus',v_assignment.assignment_status,
    'assignmentVersion',v_assignment.version,'kitId',v_kit.id,'kitStatus',v_kit.status,'kitVersion',v_kit.version);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'DISPUTE_CONNECTED_KIT_CUSTODY',p_idempotency_key,v_hash,p_nurse_profile_id,
    'os_inventory_location_assignments',v_assignment.id,v_assignment.version,v_response);
  insert into public.audit_events (tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload)
    values (p_tenant_id,p_nurse_profile_id,'connected_kit_custody_disputed','os_inventory_kits',v_kit.id,false,v_hash,
      jsonb_build_object('assignment_id',v_assignment.id,'reason_code',v_reason));
  return v_response;
end;
$$;
revoke all on function public.dispute_connected_kit_custody(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.dispute_connected_kit_custody(uuid,uuid,uuid,integer,text,text) to service_role;

create or replace function public.review_inventory_count(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_count_session_id uuid,
  p_expected_version integer,
  p_decision text,
  p_reason_code text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.os_inventory_count_sessions%rowtype;
  v_variance record;
  v_reason text:=upper(trim(coalesce(p_reason_code,'')));
  v_hash text;
  v_replay public.os_inventory_operation_requests%rowtype;
  v_movement_id uuid;
  v_unit_cost bigint;
  v_available numeric(14,3);
  v_response jsonb;
begin
  perform app_private.assert_inventory_role(p_tenant_id,p_actor_profile_id,array['inventory_adjustment_reviewer']::text[]);
  if p_expected_version is null or p_expected_version<1 or p_decision not in ('approve','reject')
     or v_reason !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,140}$' then
    raise exception using errcode='22023',message='inventory_count_review_invalid';
  end if;
  v_hash:=encode(extensions.digest(jsonb_build_object(
    'tenantId',p_tenant_id,'countSessionId',p_count_session_id,'expectedVersion',p_expected_version,
    'decision',p_decision,'reasonCode',v_reason
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inventory-count-review:'||p_tenant_id::text||':'||p_count_session_id::text,0));
  select * into v_replay from public.os_inventory_operation_requests operation
    where operation.tenant_id=p_tenant_id and operation.operation_name='REVIEW_INVENTORY_COUNT'
      and operation.request_idempotency_key=p_idempotency_key;
  if found then
    if v_replay.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency_key_reused'; end if;
    return v_replay.response_payload;
  end if;
  select * into v_session from public.os_inventory_count_sessions session
    where session.tenant_id=p_tenant_id and session.id=p_count_session_id for update;
  if not found then raise exception using errcode='P0002',message='inventory_count_not_found'; end if;
  if v_session.status<>'variance_review' or v_session.version<>p_expected_version then
    raise exception using errcode='40001',message='inventory_count_version_conflict';
  end if;
  if p_actor_profile_id in (v_session.started_by,v_session.submitted_by) then
    raise exception using errcode='42501',message='inventory_count_self_approval_forbidden';
  end if;
  if p_decision='approve' and exists (
    select 1 from public.os_inventory_exceptions open_exception
    where open_exception.tenant_id=p_tenant_id and open_exception.entity_id=p_count_session_id
      and open_exception.exception_type='count_conflict' and open_exception.status in ('open','investigating')
  ) then raise exception using errcode='P0001',message='inventory_count_conflict_requires_recount'; end if;
  if p_decision='approve' then
    for v_variance in
      select variance.id variance_id,variance.variance_quantity,line.item_id,line.variant_id,line.lot_id
      from public.os_inventory_count_variances variance
      join public.os_inventory_count_lines line on line.tenant_id=variance.tenant_id and line.id=variance.count_line_id
      where variance.tenant_id=p_tenant_id and variance.count_session_id=p_count_session_id and variance.status='open'
      order by variance.id
    loop
      if v_variance.variance_quantity<0 then
        select coalesce(sum(balance.quantity_on_hand),0) into v_available
        from public.os_inventory_location_balances balance
        where balance.tenant_id=p_tenant_id and balance.location_id=v_session.location_id
          and balance.item_id=v_variance.item_id
          and balance.variant_id is not distinct from v_variance.variant_id
          and balance.lot_id is not distinct from v_variance.lot_id;
        if v_available<abs(v_variance.variance_quantity) then
          raise exception using errcode='P0001',message='inventory_count_adjustment_insufficient_stock';
        end if;
      end if;
      if v_variance.lot_id is null and exists (
        select 1 from public.os_inventory_location_balances balance
        where balance.tenant_id=p_tenant_id and balance.location_id=v_session.location_id
          and balance.item_id=v_variance.item_id
          and balance.variant_id is not distinct from v_variance.variant_id
          and balance.unit_cost_cents>0
      ) then raise exception using errcode='P0001',message='inventory_count_costed_lot_required'; end if;
      select lot.unit_cost_cents into v_unit_cost from public.os_inventory_lots lot
        where lot.tenant_id=p_tenant_id and lot.id=v_variance.lot_id;
      insert into public.os_stock_transactions (
        tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,
        source_type,source_id,idempotency_key,note,occurred_at,created_by,from_location_id,to_location_id,
        operation_request_hash
      ) values (
        p_tenant_id,v_variance.item_id,v_variance.variant_id,v_variance.lot_id,'adjust',v_variance.variance_quantity,
        nullif(v_unit_cost,0),'inventory_count',p_count_session_id::text,p_idempotency_key||':'||v_variance.variance_id::text,
        v_reason,clock_timestamp(),p_actor_profile_id,
        case when v_variance.variance_quantity<0 then v_session.location_id else null end,
        case when v_variance.variance_quantity>0 then v_session.location_id else null end,v_hash
      ) returning id into v_movement_id;
      update public.os_inventory_count_variances variance set status='approved',reason_code=v_reason,
        adjustment_movement_id=v_movement_id,decided_by=p_actor_profile_id,decided_at=clock_timestamp()
        where variance.tenant_id=p_tenant_id and variance.id=v_variance.variance_id;
    end loop;
  else
    update public.os_inventory_count_variances variance set status='rejected',reason_code=v_reason,
      decided_by=p_actor_profile_id,decided_at=clock_timestamp()
      where variance.tenant_id=p_tenant_id and variance.count_session_id=p_count_session_id and variance.status='open';
  end if;
  update public.os_inventory_count_sessions session set
    status=case when p_decision='approve' then 'approved_adjustment' else 'rejected' end,
    reviewed_by=p_actor_profile_id,reviewed_at=clock_timestamp(),version=session.version+1
    where session.tenant_id=p_tenant_id and session.id=p_count_session_id returning * into v_session;
  v_response:=jsonb_build_object('id',v_session.id,'status',v_session.status,'version',v_session.version,'decision',p_decision);
  insert into public.os_inventory_operation_requests (
    tenant_id,operation_name,request_idempotency_key,request_hash,actor_profile_id,
    result_entity_type,result_entity_id,result_version,response_payload
  ) values (p_tenant_id,'REVIEW_INVENTORY_COUNT',p_idempotency_key,v_hash,p_actor_profile_id,
    'os_inventory_count_sessions',v_session.id,v_session.version,v_response);
  insert into public.audit_events (tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload)
    values (p_tenant_id,p_actor_profile_id,'inventory_count_reviewed','os_inventory_count_sessions',v_session.id,false,v_hash,
      jsonb_build_object('decision',p_decision,'reason_code',v_reason,'version',v_session.version));
  return v_response;
end;
$$;
revoke all on function public.review_inventory_count(uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.review_inventory_count(uuid,uuid,uuid,integer,text,text,text) to service_role;

commit;
