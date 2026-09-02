-- Optional route geometry for the authenticated Nurse map preview.
-- The optimizer remains authoritative for order, timing, feasibility, and
-- release. Geometry is presentation evidence only and never advances state.

begin;

do $$
begin
  if to_regclass('public.nurse_route_plan_versions') is null
     or to_regprocedure('app_private.assert_nurse_self(uuid,uuid,uuid)') is null then
    raise exception using errcode = 'P0001', message = 'nurse_route_map_preview_dependencies_required';
  end if;
end $$;

alter table public.nurse_route_plan_versions
  add column if not exists overview_polyline text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nurse_route_plan_versions'::regclass
      and conname = 'nurse_route_plan_versions_overview_polyline_check'
  ) then
    alter table public.nurse_route_plan_versions
      add constraint nurse_route_plan_versions_overview_polyline_check
      check (
        overview_polyline is null
        or char_length(overview_polyline) between 1 and 200000
      );
  end if;
end $$;

create or replace function public.store_nurse_route_plan_polyline_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_plan_version_id uuid,
  p_response_hash text,
  p_overview_polyline text
)
returns public.nurse_route_plan_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.nurse_route_plan_versions%rowtype;
begin
  perform app_private.assert_nurse_self(
    p_tenant_id,
    p_provider_profile_id,
    p_actor_profile_id
  );
  if p_response_hash !~ '^[0-9a-f]{64}$'
     or p_overview_polyline is null
     or char_length(p_overview_polyline) not between 1 and 200000 then
    raise exception using errcode = '22023', message = 'route_polyline_invalid';
  end if;

  select * into v_plan
  from public.nurse_route_plan_versions plan
  where plan.tenant_id = p_tenant_id
    and plan.id = p_plan_version_id
    and plan.route_day_id = p_route_day_id
    and plan.provider_profile_id = p_provider_profile_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'route_plan_not_found';
  end if;
  if v_plan.response_hash <> p_response_hash then
    raise exception using errcode = '22023', message = 'route_polyline_response_conflict';
  end if;
  if v_plan.provider <> 'google_route_optimization' then
    raise exception using errcode = '22023', message = 'route_polyline_provider_invalid';
  end if;
  if v_plan.overview_polyline is not null
     and v_plan.overview_polyline <> p_overview_polyline then
    raise exception using errcode = '22023', message = 'route_polyline_immutable';
  end if;

  update public.nurse_route_plan_versions
  set overview_polyline = coalesce(overview_polyline, p_overview_polyline)
  where tenant_id = p_tenant_id and id = p_plan_version_id
  returning * into v_plan;
  return v_plan;
end;
$$;

revoke all on function public.store_nurse_route_plan_polyline_v1(
  uuid,uuid,uuid,uuid,uuid,text,text
) from public, anon, authenticated;
grant execute on function public.store_nurse_route_plan_polyline_v1(
  uuid,uuid,uuid,uuid,uuid,text,text
) to service_role;

commit;
