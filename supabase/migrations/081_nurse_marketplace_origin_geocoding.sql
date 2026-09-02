-- Typed nurse-origin geocoding idempotency. Raw submitted addresses are never
-- stored in the pre-provider reservation; only an HMAC input hash is retained.

begin;

do $$
begin
  if to_regclass('public.provider_route_days') is null
     or to_regprocedure('app_private.assert_nurse_self(uuid,uuid,uuid)') is null
     or to_regrole('service_role') is null then
    raise exception using errcode='P0001',message='typed_origin_geocoding_dependencies_required';
  end if;
end $$;

create table if not exists public.nurse_typed_origin_geocode_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null,
  provider_profile_id uuid not null,
  idempotency_key uuid not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','resolved','failed','purged')),
  resolved_latitude double precision check (resolved_latitude is null or resolved_latitude between -90 and 90),
  resolved_longitude double precision check (resolved_longitude is null or resolved_longitude between -180 and 180),
  resolved_formatted_address text check (resolved_formatted_address is null or char_length(resolved_formatted_address)<=300),
  failure_code text check (failure_code is null or char_length(failure_code)<=100),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  purged_at timestamptz,
  constraint nurse_typed_origin_geocode_requests_tenant_id_id_key unique(tenant_id,id),
  constraint nurse_typed_origin_geocode_requests_idempotency_key unique(tenant_id,route_day_id,idempotency_key),
  constraint nurse_typed_origin_geocode_requests_route_fk foreign key(tenant_id,route_day_id,provider_profile_id)
    references public.provider_route_days(tenant_id,id,provider_profile_id) on delete cascade,
  constraint nurse_typed_origin_geocode_requests_provider_fk foreign key(tenant_id,provider_profile_id)
    references public.provider_profiles(tenant_id,id) on delete cascade,
  constraint nurse_typed_origin_geocode_requests_state_check check(
    (status='resolved' and resolved_latitude is not null and resolved_longitude is not null
      and resolved_formatted_address is not null and completed_at is not null and failure_code is null)
    or (status='failed' and failure_code is not null and completed_at is not null
      and resolved_latitude is null and resolved_longitude is null and resolved_formatted_address is null)
    or (status='purged' and purged_at is not null and resolved_latitude is null
      and resolved_longitude is null and resolved_formatted_address is null)
    or status='pending'
  )
);

alter table public.nurse_typed_origin_geocode_requests enable row level security;
revoke all on table public.nurse_typed_origin_geocode_requests from public,anon,authenticated;
grant select,insert,update,delete on table public.nurse_typed_origin_geocode_requests to service_role;

create or replace function public.get_nurse_typed_origin_geocode_v1(
  p_tenant_id uuid,p_actor_profile_id uuid,p_provider_profile_id uuid,
  p_route_day_id uuid,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_request public.nurse_typed_origin_geocode_requests%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  select * into v_request from public.nurse_typed_origin_geocode_requests request
  where request.tenant_id=p_tenant_id and request.route_day_id=p_route_day_id
    and request.provider_profile_id=p_provider_profile_id and request.idempotency_key=p_idempotency_key;
  if not found then return null; end if;
  return jsonb_build_object('status',v_request.status,'input_hash',v_request.input_hash,
    'latitude',v_request.resolved_latitude,'longitude',v_request.resolved_longitude,
    'formatted_address',v_request.resolved_formatted_address,'failure_code',v_request.failure_code);
end;
$$;

create or replace function public.reserve_nurse_typed_origin_geocode_v1(
  p_tenant_id uuid,p_actor_profile_id uuid,p_provider_profile_id uuid,
  p_route_day_id uuid,p_idempotency_key uuid,p_input_hash text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_request public.nurse_typed_origin_geocode_requests%rowtype; v_reserved boolean:=false;
begin
  perform app_private.assert_nurse_self(p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  if p_input_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='typed_origin_input_hash_required'; end if;
  insert into public.nurse_typed_origin_geocode_requests(tenant_id,route_day_id,provider_profile_id,idempotency_key,input_hash)
  values(p_tenant_id,p_route_day_id,p_provider_profile_id,p_idempotency_key,p_input_hash)
  on conflict(tenant_id,route_day_id,idempotency_key) do nothing returning * into v_request;
  v_reserved:=found;
  if not found then
    select * into v_request from public.nurse_typed_origin_geocode_requests request
    where request.tenant_id=p_tenant_id and request.route_day_id=p_route_day_id
      and request.idempotency_key=p_idempotency_key for update;
    if v_request.input_hash<>p_input_hash then raise exception using errcode='22023',message='typed_origin_idempotency_conflict'; end if;
  end if;
  return jsonb_build_object('status',v_request.status,'input_hash',v_request.input_hash,
    'latitude',v_request.resolved_latitude,'longitude',v_request.resolved_longitude,
    'formatted_address',v_request.resolved_formatted_address,'failure_code',v_request.failure_code,
    'reserved_now',v_reserved);
end;
$$;

create or replace function public.complete_nurse_typed_origin_geocode_v1(
  p_tenant_id uuid,p_actor_profile_id uuid,p_provider_profile_id uuid,
  p_route_day_id uuid,p_idempotency_key uuid,p_input_hash text,
  p_latitude double precision,p_longitude double precision,p_formatted_address text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_request public.nurse_typed_origin_geocode_requests%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or p_formatted_address is null or char_length(trim(p_formatted_address)) not between 1 and 300 then
    raise exception using errcode='22023',message='typed_origin_geocode_result_invalid';
  end if;
  update public.nurse_typed_origin_geocode_requests set status='resolved',resolved_latitude=p_latitude,
    resolved_longitude=p_longitude,resolved_formatted_address=trim(p_formatted_address),completed_at=clock_timestamp()
  where tenant_id=p_tenant_id and route_day_id=p_route_day_id and provider_profile_id=p_provider_profile_id
    and idempotency_key=p_idempotency_key and input_hash=p_input_hash and status='pending'
  returning * into v_request;
  if not found then raise exception using errcode='P0001',message='pending_typed_origin_request_required'; end if;
  return jsonb_build_object('status','resolved','input_hash',v_request.input_hash,
    'latitude',v_request.resolved_latitude,'longitude',v_request.resolved_longitude,
    'formatted_address',v_request.resolved_formatted_address);
end;
$$;

create or replace function public.purge_nurse_typed_origin_retention_v1(
  p_tenant_id uuid,p_retention_hours integer default 24
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_days integer; v_requests integer;
begin
  if p_retention_hours not between 1 and 168 then
    raise exception using errcode='22023',message='typed_origin_retention_invalid';
  end if;
  update public.nurse_typed_origin_geocode_requests set
    status='purged',resolved_latitude=null,resolved_longitude=null,
    resolved_formatted_address=null,purged_at=clock_timestamp()
  where tenant_id=p_tenant_id and status='resolved'
    and completed_at<=clock_timestamp()-make_interval(hours=>p_retention_hours);
  get diagnostics v_requests=row_count;
  update public.provider_route_days set
    origin_id=case when origin_kind='manual' then null else origin_id end,
    origin_label='Origin expired',
    origin_address=null,origin_latitude=null,origin_longitude=null,
    updated_at=clock_timestamp(),version=version+1
  where tenant_id=p_tenant_id and origin_kind in ('manual','office')
    and (origin_address is not null or origin_latitude is not null
      or origin_longitude is not null or (origin_kind='manual' and origin_id is not null))
    and (status in ('completed','cancelled')
      or route_date<current_date-1
      or updated_at<=clock_timestamp()-make_interval(hours=>p_retention_hours));
  get diagnostics v_days=row_count;
  if v_requests+v_days>0 then
    insert into public.audit_events(
      tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload
    ) values(
      p_tenant_id,null,'nurse_typed_origin_retention_purged','tenant',p_tenant_id,false,
      encode(extensions.digest(jsonb_build_object('geocode_requests_purged',v_requests,
        'route_day_origins_purged',v_days,'retention_hours',p_retention_hours)::text,'sha256'),'hex'),
      jsonb_build_object('geocode_requests_purged',v_requests,
        'route_day_origins_purged',v_days,'retention_hours',p_retention_hours)
    );
  end if;
  return jsonb_build_object('geocode_requests_purged',v_requests,
    'route_day_origins_purged',v_days,'retention_hours',p_retention_hours,
    'purged_at',clock_timestamp());
end;
$$;

create or replace function public.fail_nurse_typed_origin_geocode_v1(
  p_tenant_id uuid,p_actor_profile_id uuid,p_provider_profile_id uuid,
  p_route_day_id uuid,p_idempotency_key uuid,p_input_hash text,p_failure_code text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  perform app_private.assert_nurse_self(p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  if char_length(trim(p_failure_code)) not between 1 and 100 then raise exception using errcode='22023',message='typed_origin_failure_code_required'; end if;
  update public.nurse_typed_origin_geocode_requests set status='failed',failure_code=trim(p_failure_code),completed_at=clock_timestamp()
  where tenant_id=p_tenant_id and route_day_id=p_route_day_id and provider_profile_id=p_provider_profile_id
    and idempotency_key=p_idempotency_key and input_hash=p_input_hash and status='pending';
  if not found then raise exception using errcode='P0001',message='pending_typed_origin_request_required'; end if;
  return jsonb_build_object('status','failed','input_hash',p_input_hash,'failure_code',p_failure_code);
end;
$$;

revoke all on function public.get_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.reserve_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid,text,double precision,double precision,text) from public,anon,authenticated;
revoke all on function public.fail_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.purge_nurse_typed_origin_retention_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.reserve_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.complete_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid,text,double precision,double precision,text) to service_role;
grant execute on function public.fail_nurse_typed_origin_geocode_v1(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.purge_nurse_typed_origin_retention_v1(uuid,integer) to service_role;

comment on table public.nurse_typed_origin_geocode_requests is
  'HMAC-keyed typed nurse-origin geocoding reservations. Raw submitted address is not retained before provider resolution.';

commit;
