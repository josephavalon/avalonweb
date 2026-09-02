-- Runtime controls: durable jobs, guide publication, realtime offer reads,
-- atomic offer acceptance, quota accounting, and route state transitions.

begin;

do $$
begin
  if to_regclass('public.nurse_shift_offers') is null
     or to_regclass('public.nurse_inventory_reservations') is null
     or to_regclass('public.nurse_route_plan_versions') is null
     or to_regclass('public.nurse_marketplace_policies') is null
     or to_regprocedure('public.claim_operational_shift(uuid,uuid,uuid,uuid,integer)') is null
     or to_regprocedure('app_private.assert_nurse_self(uuid,uuid,uuid)') is null then
    raise exception using errcode = 'P0001', message = 'nurse_marketplace_runtime_dependencies_required';
  end if;
end $$;

alter table public.nurse_offer_terms
  add column if not exists request_idempotency_key uuid,
  add column if not exists request_hash text,
  add column if not exists approval_policy_id uuid;
alter table public.nurse_offer_terms
  drop constraint if exists nurse_offer_terms_request_hash_check;
alter table public.nurse_offer_terms
  add constraint nurse_offer_terms_request_hash_check check (
    (request_idempotency_key is null and request_hash is null and approval_policy_id is null)
    or (request_idempotency_key is not null and request_hash ~ '^[0-9a-f]{64}$'
      and approval_policy_id is not null)
  );
create unique index if not exists nurse_offer_terms_request_uidx
  on public.nurse_offer_terms(tenant_id,request_idempotency_key)
  where request_idempotency_key is not null;
do $$
begin
  if not exists(select 1 from pg_constraint
    where conrelid='public.nurse_offer_terms'::regclass
      and conname='nurse_offer_terms_approval_policy_fk') then
    alter table public.nurse_offer_terms add constraint nurse_offer_terms_approval_policy_fk
      foreign key(tenant_id,approval_policy_id)
      references public.nurse_marketplace_policies(tenant_id,id) on delete restrict;
  end if;
end $$;

create or replace function app_private.nurse_offer_terms_hash(p_terms public.nurse_offer_terms)
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select encode(extensions.digest(concat_ws('|',
    p_terms.id::text, p_terms.shift_id::text, p_terms.provider_profile_id::text,
    p_terms.terms_version::text, p_terms.engagement_model,
    coalesce(p_terms.gross_pay_cents::text,'null'), coalesce(p_terms.hourly_rate_cents::text,'null'),
    p_terms.currency, p_terms.estimated_work_minutes::text,
    coalesce(p_terms.estimated_travel_minutes::text,'null'),
    coalesce(p_terms.mileage_rate_cents::text,'null'),
    coalesce(p_terms.guaranteed_minimum_cents::text,'null'),
    p_terms.cancellation_terms_code, p_terms.expense_policy_code,
    to_char(p_terms.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ), 'sha256'), 'hex')
$$;
revoke all on function app_private.nurse_offer_terms_hash(public.nurse_offer_terms) from public, anon, authenticated;

update public.nurse_offer_terms terms set terms_hash = app_private.nurse_offer_terms_hash(terms)
where terms.terms_hash is null;

create or replace function app_private.protect_nurse_offer_terms_material_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.terms_hash := app_private.nurse_offer_terms_hash(new);
    return new;
  end if;
  if (new.id,new.tenant_id,new.shift_id,new.provider_profile_id,new.terms_version,
      new.engagement_model,new.gross_pay_cents,new.hourly_rate_cents,new.currency,
      new.estimated_work_minutes,new.estimated_travel_minutes,new.mileage_rate_cents,
      new.guaranteed_minimum_cents,new.cancellation_terms_code,new.expense_policy_code,new.expires_at)
     is distinct from
     (old.id,old.tenant_id,old.shift_id,old.provider_profile_id,old.terms_version,
      old.engagement_model,old.gross_pay_cents,old.hourly_rate_cents,old.currency,
      old.estimated_work_minutes,old.estimated_travel_minutes,old.mileage_rate_cents,
      old.guaranteed_minimum_cents,old.cancellation_terms_code,old.expense_policy_code,old.expires_at) then
    if exists (select 1 from public.nurse_shift_offers offer where offer.tenant_id=old.tenant_id and offer.offer_terms_id=old.id) then
      raise exception using errcode='P0001',message='offered_terms_material_fields_immutable';
    end if;
    new.terms_hash := app_private.nurse_offer_terms_hash(new);
  elsif new.terms_hash is distinct from old.terms_hash then
    raise exception using errcode='P0001',message='offer_terms_hash_system_managed';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_nurse_offer_terms_material_fields() from public, anon, authenticated;
drop trigger if exists nurse_offer_terms_material_guard on public.nurse_offer_terms;
create trigger nurse_offer_terms_material_guard before insert or update on public.nurse_offer_terms
  for each row execute function app_private.protect_nurse_offer_terms_material_fields();

create or replace function app_private.assert_nurse_shift_offer_terms_hash()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.nurse_offer_terms terms where terms.tenant_id=new.tenant_id
      and terms.id=new.offer_terms_id and terms.terms_hash is not null
      and terms.terms_hash=app_private.nurse_offer_terms_hash(terms)
  ) then raise exception using errcode='P0001',message='canonical_offer_terms_hash_required'; end if;
  return new;
end;
$$;
revoke all on function app_private.assert_nurse_shift_offer_terms_hash() from public, anon, authenticated;
drop trigger if exists nurse_shift_offers_terms_hash_guard on public.nurse_shift_offers;
create trigger nurse_shift_offers_terms_hash_guard before insert or update of offer_terms_id on public.nurse_shift_offers
  for each row execute function app_private.assert_nurse_shift_offer_terms_hash();

-- Legacy approved guides are not silently promoted. New marketplace runs must
-- explicitly require publication_status=published in their readiness evaluator.
alter table public.shift_guide_versions
  add column if not exists publication_status text not null default 'draft',
  add column if not exists clinical_reviewed_by uuid,
  add column if not exists clinical_reviewed_at timestamptz,
  add column if not exists medical_director_approval_required boolean not null default false,
  add column if not exists medical_director_approved_by uuid,
  add column if not exists medical_director_approved_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists published_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists content_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_publication_status_check') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_publication_status_check check (
      publication_status in ('draft', 'clinical_review', 'medical_director_approval', 'published', 'retired', 'legacy_approved')
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_publication_hash_check') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_publication_hash_check check (
      content_hash is null or content_hash ~ '^[0-9a-f]{64}$'
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_publication_evidence_check') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_publication_evidence_check check (
      publication_status not in ('clinical_review', 'medical_director_approval', 'published', 'retired')
      or (clinical_reviewed_by is not null and clinical_reviewed_at is not null and content_hash is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_medical_director_evidence_check') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_medical_director_evidence_check check (
      not (medical_director_approval_required and publication_status in ('published', 'retired'))
      or (medical_director_approved_by is not null and medical_director_approved_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_published_evidence_check') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_published_evidence_check check (
      publication_status not in ('published', 'retired')
      or (published_by is not null and published_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_clinical_reviewer_fk') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_clinical_reviewer_fk
      foreign key (tenant_id, clinical_reviewed_by) references public.profiles(tenant_id, id) on delete restrict;
    alter table public.shift_guide_versions add constraint shift_guide_versions_medical_director_fk
      foreign key (tenant_id, medical_director_approved_by) references public.profiles(tenant_id, id) on delete restrict;
    alter table public.shift_guide_versions add constraint shift_guide_versions_publisher_fk
      foreign key (tenant_id, published_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
end $$;

create table if not exists public.nurse_guide_publication_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  guide_version_id uuid not null,
  from_status text,
  to_status text not null check (to_status in (
    'draft', 'clinical_review', 'medical_director_approval', 'published', 'retired'
  )),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  actor_profile_id uuid not null,
  reason_code text not null check (char_length(trim(reason_code)) between 1 and 100),
  idempotency_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_guide_publication_history_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_guide_publication_history_idempotency_key unique (tenant_id, guide_version_id, idempotency_key),
  constraint nurse_guide_publication_history_guide_fk foreign key (tenant_id, guide_version_id)
    references public.shift_guide_versions(tenant_id, id) on delete restrict,
  constraint nurse_guide_publication_history_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict
);

create table if not exists public.nurse_marketplace_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_type text not null check (job_type in (
    'appointment_reconcile', 'readiness_evaluate', 'offer_distribute',
    'route_plan', 'route_stop_reconcile', 'pickup_exception_recovery',
    'notification_deliver', 'daily_readiness_sweep'
  )),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 240),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in (
    'pending', 'leased', 'completed', 'dead_letter', 'cancelled'
  )),
  available_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts between 0 and 100),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 100),
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_marketplace_jobs_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_marketplace_jobs_idempotency_key unique (tenant_id, job_type, idempotency_key),
  constraint nurse_marketplace_jobs_lease_check check (
    (status = 'leased' and lease_owner is not null and lease_token is not null and lease_expires_at is not null)
    or status <> 'leased'
  ),
  constraint nurse_marketplace_jobs_completion_check check (
    status <> 'completed' or completed_at is not null
  )
);

create table if not exists public.nurse_marketplace_dead_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  job_type text not null,
  idempotency_key text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  error_code text not null check (char_length(trim(error_code)) between 1 and 100),
  attempts integer not null check (attempts > 0),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolution_code text check (resolution_code is null or char_length(resolution_code) <= 100),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_marketplace_dead_letters_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_marketplace_dead_letters_job_key unique (tenant_id, job_id),
  constraint nurse_marketplace_dead_letters_job_fk foreign key (tenant_id, job_id)
    references public.nurse_marketplace_jobs(tenant_id, id) on delete restrict,
  constraint nurse_marketplace_dead_letters_actor_fk foreign key (tenant_id, acknowledged_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_marketplace_dead_letters_ack_check check (
    (acknowledged_at is null and acknowledged_by is null and resolution_code is null)
    or (acknowledged_at is not null and acknowledged_by is not null and resolution_code is not null)
  )
);

create table if not exists public.nurse_w2_assignment_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  assignment_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_w2_assignment_idempotency_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_w2_assignment_idempotency_request_key unique (tenant_id, idempotency_key),
  constraint nurse_w2_assignment_idempotency_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete restrict,
  constraint nurse_w2_assignment_idempotency_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete restrict,
  constraint nurse_w2_assignment_idempotency_assignment_fk foreign key (tenant_id, assignment_id)
    references public.operational_shift_assignments(tenant_id, id) on delete restrict
);

create index if not exists nurse_marketplace_jobs_available_idx
  on public.nurse_marketplace_jobs (status, available_at, created_at)
  where status in ('pending', 'leased');

drop trigger if exists touch_nurse_marketplace_jobs_updated_at on public.nurse_marketplace_jobs;
create trigger touch_nurse_marketplace_jobs_updated_at before update on public.nurse_marketplace_jobs
  for each row execute function public.touch_updated_at();
drop trigger if exists nurse_guide_publication_history_immutable on public.nurse_guide_publication_history;
create trigger nurse_guide_publication_history_immutable before update or delete on public.nurse_guide_publication_history
  for each row execute function app_private.prevent_os_append_only_mutation();
drop trigger if exists nurse_marketplace_dead_letters_immutable on public.nurse_marketplace_dead_letters;
create trigger nurse_marketplace_dead_letters_immutable before update or delete on public.nurse_marketplace_dead_letters
  for each row execute function app_private.prevent_os_append_only_mutation();

create or replace function public.lease_nurse_marketplace_jobs_v1(
  p_worker text,
  p_limit integer,
  p_lease_seconds integer
)
returns setof public.nurse_marketplace_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_worker is null or char_length(trim(p_worker)) not between 3 and 160
     or p_limit is null or p_limit < 1 or p_limit > 100
     or p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception using errcode = '22023', message = 'marketplace_job_lease_parameters_invalid';
  end if;
  return query
  with candidates as (
    select job.id
    from public.nurse_marketplace_jobs job
    where (
      (job.status = 'pending' and job.available_at <= clock_timestamp())
      or (job.status = 'leased' and job.lease_expires_at <= clock_timestamp())
    )
    order by job.available_at, job.created_at, job.id
    limit p_limit
    for update skip locked
  )
  update public.nurse_marketplace_jobs job
  set status = 'leased', lease_owner = trim(p_worker), lease_token = gen_random_uuid(),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      attempts = job.attempts + 1, updated_at = clock_timestamp()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

create or replace function public.consume_nurse_route_provider_quota_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_route_day_id uuid,
  p_provider text,
  p_request_idempotency_key uuid,
  p_request_hash text,
  p_daily_limit integer,
  p_per_minute_limit integer
)
returns public.nurse_route_provider_daily_usage
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation text;
  v_existing public.nurse_route_provider_daily_usage%rowtype;
  v_ordinal integer;
  v_minute timestamptz;
  v_minute_ordinal integer;
  v_result public.nurse_route_provider_daily_usage%rowtype;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' or p_daily_limit is null or p_daily_limit <= 0
     or p_per_minute_limit is null or p_per_minute_limit <= 0 then
    raise exception using errcode = '22023', message = 'route_provider_quota_parameters_invalid';
  end if;
  v_operation := case p_provider
    when 'google_route_optimization' then 'route_optimization'
    when 'google_geocoding' then 'origin_geocoding'
    else null end;
  if v_operation is null then
    raise exception using errcode = '22023', message = 'route_provider_not_allowed';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.tenant_id = p_tenant_id and p.id = p_actor_profile_id and p.status='active'
      and p.role in ('ops_manager','admin','founder')
  ) and not exists (
    select 1 from public.provider_route_days day
    join public.provider_profiles provider
      on provider.tenant_id=day.tenant_id and provider.id=day.provider_profile_id
    where day.tenant_id=p_tenant_id and day.id=p_route_day_id
      and provider.profile_id=p_actor_profile_id and provider.active
  ) then
    raise exception using errcode = '42501', message = 'route_provider_actor_forbidden';
  end if;
  select * into v_existing from public.nurse_route_provider_daily_usage usage
  where usage.tenant_id = p_tenant_id
    and usage.provider = 'google_maps_platform'
    and usage.operation = v_operation
    and usage.request_idempotency_key = p_request_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = '22023', message = 'route_provider_idempotency_conflict';
    end if;
    return v_existing;
  end if;
  v_minute := date_trunc('minute', clock_timestamp());
  -- A day-scoped lock serializes both daily and per-minute ordinals, including
  -- calls that arrive on opposite sides of a minute boundary.
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':google_maps_platform:' || v_operation || ':' || current_date::text, 0
  ));
  select count(*) + 1 into v_ordinal
  from public.nurse_route_provider_daily_usage usage
  where usage.tenant_id = p_tenant_id and usage.provider = 'google_maps_platform'
    and usage.operation = v_operation and usage.usage_date = current_date;
  select count(*) + 1 into v_minute_ordinal
  from public.nurse_route_provider_daily_usage usage
  where usage.tenant_id = p_tenant_id and usage.provider = 'google_maps_platform'
    and usage.operation = v_operation and usage.usage_minute = v_minute;
  insert into public.nurse_route_provider_daily_usage (
    tenant_id, provider, operation, usage_date, usage_minute, request_idempotency_key,
    request_hash, daily_limit, ordinal, per_minute_limit, minute_ordinal,
    allowed, denial_code, route_day_id
  ) values (
    p_tenant_id, 'google_maps_platform', v_operation, current_date, v_minute,
    p_request_idempotency_key, p_request_hash, p_daily_limit, v_ordinal,
    p_per_minute_limit, v_minute_ordinal,
    v_ordinal <= p_daily_limit and v_minute_ordinal <= p_per_minute_limit,
    case when v_ordinal > p_daily_limit then 'daily_quota_exhausted'
      when v_minute_ordinal > p_per_minute_limit then 'per_minute_quota_exhausted' end,
    p_route_day_id
  ) returning * into v_result;
  return v_result;
end;
$$;

create or replace function app_private.assign_marketplace_shift(
  p_tenant_id uuid,p_actor_profile_id uuid,p_shift_id uuid,p_provider_profile_id uuid,
  p_expected_version integer,p_assignment_status text
)
returns public.operational_shift_assignments
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_active_count integer;
  v_assignment public.operational_shift_assignments%rowtype;
  v_max_daily_hours numeric;
  v_max_daily_stops integer;
  v_min_turnaround_minutes integer;
  v_shift public.operational_shifts%rowtype;
  v_patient_person_id uuid;
  v_gfe_status text;
  v_payment_status text;
  v_protocol_key text;
begin
  if p_assignment_status not in ('claimed','assigned') then raise exception using errcode='22023',message='marketplace_assignment_status_invalid'; end if;
  select * into v_shift from public.operational_shifts shift
  where shift.tenant_id=p_tenant_id and shift.id=p_shift_id for update;
  if not found then raise exception using errcode='P0002',message='shift_not_found'; end if;
  if v_shift.version<>p_expected_version then raise exception using errcode='40001',message='shift_version_conflict'; end if;
  if v_shift.status<>'open' then raise exception using errcode='P0001',message='shift_not_open'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_provider_profile_id::text,0));
  perform app_private.assert_operational_provider(p_tenant_id,p_provider_profile_id,v_shift.role_required);
  select
    coalesce(nullif(preferences.availability->>'max_daily_hours','')::numeric,8),
    coalesce(nullif(preferences.service_preferences->>'max_daily_stops','')::integer,8),
    coalesce(nullif(preferences.service_preferences->>'minimum_turnaround_minutes','')::integer,15)
    into v_max_daily_hours,v_max_daily_stops,v_min_turnaround_minutes
  from public.provider_work_preferences preferences
  where preferences.tenant_id=p_tenant_id and preferences.provider_profile_id=p_provider_profile_id for share;
  if not found then raise exception using errcode='P0001',message='provider_work_preferences_required'; end if;
  if v_shift.appointment_id is not null then
    select appointment.gfe_status,appointment.payment_status,appointment.patient_person_id,appointment.protocol_key
      into v_gfe_status,v_payment_status,v_patient_person_id,v_protocol_key
    from public.appointments appointment
    where appointment.tenant_id=p_tenant_id and appointment.id=v_shift.appointment_id for share;
    if not found then raise exception using errcode='P0001',message='appointment_readiness_unavailable'; end if;
    if lower(coalesce(v_gfe_status,'')) not in ('approved','clear','cleared','complete','completed','not_required') then
      raise exception using errcode='P0001',message='gfe_not_ready';
    end if;
    if lower(coalesce(v_payment_status,'')) not in ('authorized','captured','paid','deposit_paid','succeeded','not_required','waived','complete','completed') then
      raise exception using errcode='P0001',message='patient_payment_not_ready';
    end if;
    if v_patient_person_id is not null and exists(select 1 from public.do_not_treat_flags flag
      where flag.tenant_id=p_tenant_id and flag.patient_person_id=v_patient_person_id
        and flag.active and flag.resolved_at is null) then
      raise exception using errcode='P0001',message='active_safety_hold';
    end if;
    if nullif(trim(v_protocol_key),'') is null or not exists(
      select 1 from public.shift_guide_templates template
      join public.shift_guide_versions guide on guide.tenant_id=template.tenant_id and guide.template_id=template.id
      where template.tenant_id=p_tenant_id and template.active and template.work_kind='mobile_appointment'
        and lower(trim(template.protocol_key))=lower(trim(v_protocol_key))
        and guide.publication_status='published'
        and case lower(trim(v_shift.role_required)) when 'np' then lower(trim(template.role_required)) in ('np','rn','nurse','registered nurse')
          else lower(trim(template.role_required)) in ('rn','nurse','registered nurse') end
    ) then raise exception using errcode='P0001',message='published_appointment_guide_required'; end if;
  end if;
  if not exists(
    select 1 from public.nurse_shift_supply_requirements pinned
    join public.nurse_supply_manifest_versions manifest on manifest.tenant_id=pinned.tenant_id and manifest.id=pinned.manifest_version_id
    where pinned.tenant_id=p_tenant_id and pinned.shift_id=p_shift_id and pinned.invalidated_at is null
      and manifest.status='approved'
  ) then raise exception using errcode='P0001',message='approved_supply_manifest_required'; end if;
  if exists(
    select 1 from public.operational_shift_assignments assignment
    join public.operational_shifts shift on shift.tenant_id=assignment.tenant_id and shift.id=assignment.shift_id
    where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=p_provider_profile_id
      and assignment.status in ('claimed','assigned') and shift.id<>p_shift_id
      and shift.status not in ('completed','cancelled')
      and shift.starts_at<v_shift.ends_at and shift.ends_at>v_shift.starts_at
  ) then raise exception using errcode='P0001',message='provider_schedule_conflict'; end if;
  if v_min_turnaround_minutes>0 and exists(
    select 1 from public.operational_shift_assignments assignment
    join public.operational_shifts shift on shift.tenant_id=assignment.tenant_id and shift.id=assignment.shift_id
    where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=p_provider_profile_id
      and assignment.status in ('claimed','assigned') and shift.id<>p_shift_id
      and shift.status not in ('completed','cancelled') and (
        (shift.ends_at<=v_shift.starts_at and shift.ends_at+make_interval(mins=>v_min_turnaround_minutes)>v_shift.starts_at)
        or (shift.starts_at>=v_shift.ends_at and v_shift.ends_at+make_interval(mins=>v_min_turnaround_minutes)>shift.starts_at)
      )
  ) then raise exception using errcode='P0001',message='minimum_turnaround_not_met'; end if;
  if exists(select 1 from public.operational_shift_assignments assignment
    where assignment.tenant_id=p_tenant_id and assignment.shift_id=p_shift_id
      and assignment.provider_profile_id=p_provider_profile_id
      and assignment.status in ('claimed','assigned','completed')) then
    raise exception using errcode='P0001',message='assignment_already_active';
  end if;
  select count(*) into v_active_count
  from public.operational_shift_assignments assignment
  join public.operational_shifts shift on shift.tenant_id=assignment.tenant_id and shift.id=assignment.shift_id
  where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=p_provider_profile_id
    and assignment.status in ('claimed','assigned') and shift.status not in ('completed','cancelled')
    and (shift.starts_at at time zone v_shift.timezone)::date=(v_shift.starts_at at time zone v_shift.timezone)::date;
  if v_active_count+1>v_max_daily_stops then raise exception using errcode='P0001',message='maximum_daily_stops_reached'; end if;
  if coalesce((select sum(extract(epoch from (shift.ends_at-shift.starts_at))/3600.0)
    from public.operational_shift_assignments assignment
    join public.operational_shifts shift on shift.tenant_id=assignment.tenant_id and shift.id=assignment.shift_id
    where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=p_provider_profile_id
      and assignment.status in ('claimed','assigned') and shift.status not in ('completed','cancelled')
      and (shift.starts_at at time zone v_shift.timezone)::date=(v_shift.starts_at at time zone v_shift.timezone)::date),0)
    +extract(epoch from (v_shift.ends_at-v_shift.starts_at))/3600.0>v_max_daily_hours then
    raise exception using errcode='P0001',message='maximum_daily_hours_exceeded';
  end if;
  select count(*) into v_active_count from public.operational_shift_assignments assignment
  where assignment.tenant_id=p_tenant_id and assignment.shift_id=p_shift_id
    and assignment.status in ('claimed','assigned','completed');
  if v_active_count>=v_shift.slots_required then raise exception using errcode='P0001',message='shift_full'; end if;
  insert into public.operational_shift_assignments(
    tenant_id,shift_id,provider_profile_id,status,claimed_at,assigned_at,created_by
  ) values(
    p_tenant_id,p_shift_id,p_provider_profile_id,p_assignment_status,
    case when p_assignment_status='claimed' then clock_timestamp() end,
    case when p_assignment_status='assigned' then clock_timestamp() end,p_actor_profile_id
  ) on conflict(shift_id,provider_profile_id) do update set
    status=excluded.status,claimed_at=excluded.claimed_at,assigned_at=excluded.assigned_at,
    completed_at=null,created_by=excluded.created_by,updated_at=clock_timestamp()
  where operational_shift_assignments.status in ('offered','declined','countered','expired','cancelled')
  returning * into v_assignment;
  if not found then raise exception using errcode='P0001',message='assignment_state_conflict'; end if;
  update public.operational_shifts set
    status=case when v_active_count+1>=slots_required then 'assigned' else 'open' end,
    version=version+1 where tenant_id=p_tenant_id and id=p_shift_id;
  perform app_private.append_operational_audit(p_tenant_id,p_actor_profile_id,
    case when p_assignment_status='claimed' then 'nurse_marketplace_shift_claimed' else 'nurse_marketplace_w2_assigned' end,
    p_shift_id,jsonb_build_object('provider_profile_id',p_provider_profile_id,'version',v_shift.version+1));
  return v_assignment;
end;
$$;
revoke all on function app_private.assign_marketplace_shift(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated;

create or replace function public.claim_nurse_shift_offer_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_offer_id uuid,
  p_provider_profile_id uuid,
  p_expected_offer_version integer,
  p_expected_shift_version integer,
  p_idempotency_key uuid,
  p_request_hash text,
  p_accepted_terms_hash text
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_existing public.nurse_offer_action_idempotency%rowtype;
  v_offer public.nurse_shift_offers%rowtype;
  v_requirement record;
  v_reservation record;
  v_terms public.nurse_offer_terms%rowtype;
  v_balance numeric(14,3);
  v_committed numeric(14,3);
  v_kit_location_id uuid;
  v_route_day public.provider_route_days%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' or p_accepted_terms_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'offer_acceptance_hash_required';
  end if;
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':' || p_provider_profile_id::text || ':' || p_idempotency_key::text, 0
  ));
  select * into v_existing from public.nurse_offer_action_idempotency action_record
  where action_record.tenant_id = p_tenant_id
    and action_record.provider_profile_id = p_provider_profile_id
    and action_record.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash or v_existing.action <> 'accept' then
      raise exception using errcode = '22023', message = 'offer_action_idempotency_conflict';
    end if;
    select * into v_assignment from public.operational_shift_assignments assignment
    where assignment.tenant_id = p_tenant_id and assignment.id = v_existing.result_reference_id;
    if not found then raise exception using errcode = 'P0001', message = 'offer_action_idempotency_result_missing'; end if;
    return v_assignment;
  end if;
  select * into v_offer from public.nurse_shift_offers offer
  where offer.tenant_id = p_tenant_id and offer.id = p_offer_id
    and offer.provider_profile_id = p_provider_profile_id
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'offer_unavailable'; end if;
  if v_offer.version <> p_expected_offer_version then
    raise exception using errcode = '40001', message = 'offer_version_conflict';
  end if;
  if v_offer.status not in ('pending', 'offered', 'delivered', 'viewed')
     or v_offer.expires_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'offer_unavailable';
  end if;
  select * into v_terms from public.nurse_offer_terms terms
  where terms.tenant_id = p_tenant_id and terms.id = v_offer.offer_terms_id
    and terms.shift_id = v_offer.shift_id and terms.provider_profile_id = p_provider_profile_id
  for update;
  if not found or v_terms.status <> 'proposed' or v_terms.expires_at <= clock_timestamp()
     or v_terms.terms_hash is null or v_terms.terms_hash <> p_accepted_terms_hash
     or v_terms.terms_hash <> app_private.nurse_offer_terms_hash(v_terms) then
    raise exception using errcode = 'P0001', message = 'offer_terms_changed';
  end if;
  if v_terms.engagement_model<>'approved_contractor' then
    raise exception using errcode='P0001',message='w2_offer_claim_prohibited';
  end if;
  perform app_private.assert_nurse_offer_engagement(
    p_tenant_id,p_provider_profile_id,v_terms.engagement_model
  );
  if not exists (
    select 1 from public.nurse_shift_readiness_snapshots readiness
    where readiness.tenant_id = p_tenant_id
      and readiness.shift_id = v_offer.shift_id and readiness.provider_profile_id = p_provider_profile_id
      and readiness.source_shift_version = p_expected_shift_version
      and readiness.evaluation_stage = 'claim' and readiness.claim_allowed
      and readiness.overall_status = 'ready' and readiness.invalidated_at is null
      and readiness.expires_at > clock_timestamp()
  ) then
    raise exception using errcode = 'P0001', message = 'fresh_claim_readiness_required';
  end if;
  if not exists (
    select 1 from public.nurse_shift_supply_requirements pinned
    join public.nurse_supply_manifest_versions manifest
      on manifest.tenant_id = pinned.tenant_id and manifest.id = pinned.manifest_version_id
    where pinned.tenant_id = p_tenant_id and pinned.shift_id = v_offer.shift_id
      and pinned.invalidated_at is null and manifest.status = 'approved'
  ) then
    raise exception using errcode = 'P0001', message = 'approved_supply_manifest_required';
  end if;
  for v_requirement in
    select requirement.id, requirement.quantity
    from public.nurse_shift_supply_requirements pinned
    join public.nurse_supply_manifest_requirements requirement
      on requirement.tenant_id = pinned.tenant_id and requirement.manifest_version_id = pinned.manifest_version_id
    where pinned.tenant_id = p_tenant_id and pinned.shift_id = v_offer.shift_id
      and pinned.invalidated_at is null
  loop
    if coalesce((
      select sum(reservation.quantity) from public.nurse_inventory_reservations reservation
      where reservation.tenant_id = p_tenant_id and reservation.offer_id = p_offer_id
        and reservation.requirement_id = v_requirement.id and reservation.status = 'prepared'
        and reservation.expires_at > clock_timestamp()
    ), 0) < v_requirement.quantity then
      raise exception using errcode = 'P0001', message = 'inventory_reservation_incomplete';
    end if;
  end loop;
  for v_reservation in
    select * from public.nurse_inventory_reservations reservation
    where reservation.tenant_id = p_tenant_id and reservation.offer_id = p_offer_id
      and reservation.status = 'prepared' and reservation.expires_at > clock_timestamp()
    order by reservation.location_id, reservation.item_id, reservation.variant_id, reservation.lot_id
    for update
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      p_tenant_id::text || ':' || v_reservation.location_id::text || ':'
      || v_reservation.item_id::text || ':' || coalesce(v_reservation.variant_id::text, '-')
      || ':' || coalesce(v_reservation.lot_id::text, '-'), 0
    ));
    select coalesce(sum(balance.quantity_on_hand), 0) into v_balance
    from public.os_inventory_location_balances balance
    where balance.tenant_id = p_tenant_id and balance.location_id = v_reservation.location_id
      and balance.item_id = v_reservation.item_id
      and balance.variant_id is not distinct from v_reservation.variant_id
      and balance.lot_id is not distinct from v_reservation.lot_id;
    select coalesce(sum(reservation.quantity), 0) into v_committed
    from public.nurse_inventory_reservations reservation
    where reservation.tenant_id = p_tenant_id and reservation.location_id = v_reservation.location_id
      and reservation.item_id = v_reservation.item_id
      and reservation.variant_id is not distinct from v_reservation.variant_id
      and reservation.lot_id is not distinct from v_reservation.lot_id
      and reservation.status in ('prepared', 'reserved')
      and reservation.expires_at > clock_timestamp();
    if v_committed > v_balance then
      raise exception using errcode = 'P0001', message = 'inventory_reservation_unavailable';
    end if;
    if v_reservation.lot_id is not null and not exists (
      select 1 from public.os_inventory_lots lot
      where lot.tenant_id = p_tenant_id and lot.id = v_reservation.lot_id
        and lot.disposition_status = 'available'
        and (lot.expires_on is null or lot.expires_on >= current_date)
        and (not lot.temperature_controlled or lot.temperature_evidence_expires_at > clock_timestamp())
        and (not lot.calibration_required or lot.calibration_expires_at > clock_timestamp())
    ) then
      raise exception using errcode = 'P0001', message = 'inventory_lot_evidence_stale';
    end if;
  end loop;
  v_assignment := app_private.assign_marketplace_shift(
    p_tenant_id, p_actor_profile_id, v_offer.shift_id, p_provider_profile_id, p_expected_shift_version,'claimed'
  );
  update public.nurse_inventory_reservations set
    status = 'reserved', reserved_at = clock_timestamp(), version = version + 1
  where tenant_id = p_tenant_id and offer_id = p_offer_id
    and status = 'prepared' and expires_at > clock_timestamp();
  update public.nurse_shift_offers set
    status = 'accepted', acted_at = clock_timestamp(), version = version + 1
  where tenant_id = p_tenant_id and id = p_offer_id;
  update public.nurse_offer_terms set
    status = 'accepted', accepted_at = coalesce(accepted_at, clock_timestamp()),
    accepted_terms_hash = p_accepted_terms_hash
  where tenant_id = p_tenant_id and id = v_offer.offer_terms_id;
  select * into v_shift from public.operational_shifts shift
  where shift.tenant_id=p_tenant_id and shift.id=v_offer.shift_id;
  select assignment.location_id into v_kit_location_id
  from public.os_inventory_location_assignments assignment
  join public.os_inventory_locations location
    on location.tenant_id=assignment.tenant_id and location.id=assignment.location_id
  where assignment.tenant_id=p_tenant_id
    and assignment.provider_profile_id=p_provider_profile_id
    and assignment.assignment_status='accepted' and assignment.is_primary
    and location.location_type='nurse_kit' and location.status='active'
  for share of assignment,location;
  if v_kit_location_id is null then
    raise exception using errcode='P0001',message='accepted_nurse_kit_required';
  end if;
  insert into public.provider_route_days(
    tenant_id,provider_profile_id,route_date,origin_kind,origin_label,status,
    assignment_revision
  ) values(
    p_tenant_id,p_provider_profile_id,
    (v_shift.starts_at at time zone v_shift.timezone)::date,
    'current','Origin required','origin_required',clock_timestamp()
  ) on conflict(provider_profile_id,route_date) do update set
    assignment_revision=clock_timestamp(),
    status=case
      when provider_route_days.status in ('released','acknowledged','active','paused')
        then 'recovery_required'
      when provider_route_days.status in ('completed','cancelled')
        then provider_route_days.status
      else 'origin_required' end,
    version=provider_route_days.version+1,
    updated_at=clock_timestamp()
  returning * into v_route_day;
  if v_route_day.status in ('completed','cancelled') then
    raise exception using errcode='P0001',message='route_day_closed';
  end if;
  insert into public.provider_route_day_stops(
    tenant_id,route_day_id,appointment_id,assigned_provider_profile_id,
    selected,assignment_snapshot_at
  ) values(
    p_tenant_id,v_route_day.id,v_shift.appointment_id,p_provider_profile_id,
    true,clock_timestamp()
  ) on conflict(route_day_id,appointment_id) do update set
    assigned_provider_profile_id=excluded.assigned_provider_profile_id,
    selected=true,omission_reason=null,omission_note=null,
    assignment_snapshot_at=clock_timestamp(),updated_at=clock_timestamp();
  insert into public.nurse_pickup_tasks(
    tenant_id,shift_id,provider_profile_id,location_id,route_day_id,status,
    window_starts_at,window_ends_at
  )
  select distinct p_tenant_id,v_shift.id,p_provider_profile_id,reservation.location_id,
    v_route_day.id,'required',v_shift.starts_at-interval '4 hours',v_shift.starts_at
  from public.nurse_inventory_reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.offer_id=p_offer_id
    and reservation.status='reserved' and reservation.location_id<>v_kit_location_id
  on conflict(tenant_id,shift_id,provider_profile_id,location_id) do update set
    route_day_id=excluded.route_day_id,
    status=case when nurse_pickup_tasks.status in ('cancelled','blocked') then 'required'
      else nurse_pickup_tasks.status end,
    window_starts_at=excluded.window_starts_at,window_ends_at=excluded.window_ends_at,
    version=nurse_pickup_tasks.version+1,updated_at=clock_timestamp();
  update public.nurse_shift_offers competitor set
    status = 'revoked', revoked_at = clock_timestamp(), revocation_code = 'work_filled',
    version = competitor.version + 1
  where competitor.tenant_id = p_tenant_id and competitor.shift_id = v_offer.shift_id
    and competitor.id <> p_offer_id and competitor.status in ('pending', 'offered', 'delivered', 'viewed');
  update public.nurse_inventory_reservations reservation set
    status = 'released', released_at = clock_timestamp(), release_code = 'competing_offer_revoked',
    version = reservation.version + 1
  where reservation.tenant_id = p_tenant_id and reservation.shift_id = v_offer.shift_id
    and reservation.offer_id <> p_offer_id and reservation.status = 'prepared';
  insert into public.nurse_offer_action_idempotency (
    tenant_id, offer_id, provider_profile_id, action, idempotency_key,
    request_hash, result_status, result_reference_id
  ) values (
    p_tenant_id, p_offer_id, p_provider_profile_id, 'accept', p_idempotency_key,
    p_request_hash, 'accepted', v_assignment.id
  );
  insert into public.nurse_marketplace_transitions (
    tenant_id, entity_type, entity_id, from_status, to_status,
    reason_code, actor_profile_id, correlation_id
  ) values (
    p_tenant_id, 'offer', p_offer_id, v_offer.status, 'accepted',
    'nurse_accepted', p_actor_profile_id, p_idempotency_key
  );
  return v_assignment;
end;
$$;

create or replace function public.assign_w2_nurse_shift_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_shift_version integer,
  p_idempotency_key uuid,
  p_request_hash text
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available numeric(14,3);
  v_assignment public.operational_shift_assignments%rowtype;
  v_candidate record;
  v_committed numeric(14,3);
  v_existing public.nurse_w2_assignment_idempotency%rowtype;
  v_kit_location_id uuid;
  v_policy public.nurse_marketplace_policies%rowtype;
  v_remaining numeric(14,3);
  v_requirement record;
  v_route_day public.provider_route_days%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode = '22023', message = 'w2_assignment_hash_required'; end if;
  if not exists (select 1 from public.profiles p where p.tenant_id = p_tenant_id and p.id = p_actor_profile_id
    and p.status='active' and p.role in ('ops_manager','admin','founder')) then
    raise exception using errcode = '42501', message = 'w2_assignment_actor_forbidden';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text||':w2:'||p_idempotency_key::text,0
  ));
  select * into v_existing from public.nurse_w2_assignment_idempotency request
  where request.tenant_id = p_tenant_id and request.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'w2_assignment_idempotency_conflict'; end if;
    select * into v_assignment from public.operational_shift_assignments
    where tenant_id = p_tenant_id and id = v_existing.assignment_id;
    return v_assignment;
  end if;
  if not exists (
    select 1 from public.provider_work_preferences preferences
    where preferences.tenant_id = p_tenant_id and preferences.provider_profile_id = p_provider_profile_id
      and preferences.engagement_status = 'w2_approved'
      and preferences.engagement_approved_by is not null
      and preferences.engagement_approved_at is not null
      and preferences.engagement_effective_at <= clock_timestamp()
  ) or not exists (
    select 1 from public.nurse_marketplace_policies policy
    where policy.tenant_id = p_tenant_id and policy.policy_type = 'engagement'
      and policy.status = 'approved' and policy.effective_at <= clock_timestamp()
      and policy.rules ->> 'classification' = 'w2'
  ) then raise exception using errcode = 'P0001', message = 'approved_w2_engagement_required'; end if;
  if not exists (
    select 1 from public.nurse_shift_readiness_snapshots readiness
    where readiness.tenant_id = p_tenant_id and readiness.shift_id = p_shift_id
      and readiness.provider_profile_id = p_provider_profile_id
      and readiness.evaluation_stage = 'claim' and readiness.overall_status = 'ready'
      and readiness.claim_allowed and readiness.invalidated_at is null
      and readiness.expires_at > clock_timestamp()
  ) then raise exception using errcode = 'P0001', message = 'fresh_claim_readiness_required'; end if;
  if exists (
    select 1 from public.provider_work_preferences preferences
    where preferences.tenant_id = p_tenant_id and preferences.provider_profile_id = p_provider_profile_id
      and preferences.engagement_status in ('contractor_review','contractor_approved')
  ) then raise exception using errcode = 'P0001', message = 'contractor_direct_assignment_prohibited'; end if;
  select * into v_shift from public.operational_shifts shift
  where shift.tenant_id=p_tenant_id and shift.id=p_shift_id for share;
  if not found or v_shift.status<>'open' or v_shift.version<>p_expected_shift_version then
    raise exception using errcode='40001',message='shift_version_or_state_conflict';
  end if;
  select assignment.location_id into v_kit_location_id
  from public.os_inventory_location_assignments assignment
  join public.os_inventory_locations location
    on location.tenant_id=assignment.tenant_id and location.id=assignment.location_id
  where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=p_provider_profile_id
    and assignment.assignment_status='accepted' and assignment.is_primary
    and location.location_type='nurse_kit' and location.status='active'
  for share of assignment,location;
  if v_kit_location_id is null then raise exception using errcode='P0001',message='accepted_nurse_kit_required'; end if;
  select * into v_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='supply_manifest'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
    and jsonb_typeof(policy.rules->'pickup_location_ids')='array'
  order by policy.version desc limit 1;
  if not found then raise exception using errcode='P0001',message='approved_supply_allocation_policy_required'; end if;
  for v_requirement in
    select requirement.*
    from public.nurse_shift_supply_requirements pinned
    join public.nurse_supply_manifest_requirements requirement
      on requirement.tenant_id=pinned.tenant_id
      and requirement.manifest_version_id=pinned.manifest_version_id
    where pinned.tenant_id=p_tenant_id and pinned.shift_id=p_shift_id
      and pinned.invalidated_at is null
    order by requirement.sort_order,requirement.id
  loop
    v_remaining:=v_requirement.quantity;
    for v_candidate in
      select balance.location_id,balance.item_id,balance.variant_id,balance.lot_id,lot.expires_on
      from public.os_inventory_location_balances balance
      join public.os_inventory_locations location
        on location.tenant_id=balance.tenant_id and location.id=balance.location_id
        and location.status='active'
      left join public.os_inventory_lots lot
        on lot.tenant_id=balance.tenant_id and lot.id=balance.lot_id
      where balance.tenant_id=p_tenant_id and balance.item_id=v_requirement.item_id
        and balance.variant_id is not distinct from v_requirement.variant_id
        and balance.quantity_on_hand>0
        and (balance.location_id=v_kit_location_id or (
          v_requirement.pickup_allowed
          and v_policy.rules->'pickup_location_ids' ? balance.location_id::text
          and exists(select 1 from public.nurse_inventory_location_route_locations evidence
            where evidence.tenant_id=p_tenant_id
              and evidence.inventory_location_id=balance.location_id
              and evidence.invalidated_at is null and evidence.expires_at>clock_timestamp())
        ))
        and (not v_requirement.lot_required or balance.lot_id is not null)
        and (balance.lot_id is null or (lot.disposition_status='available'
          and (lot.expires_on is null or lot.expires_on>=current_date)
          and (not v_requirement.temperature_evidence_required
            or (lot.temperature_controlled and lot.temperature_evidence_expires_at>clock_timestamp()))
          and (not v_requirement.calibration_evidence_required
            or (lot.calibration_required and lot.calibration_expires_at>clock_timestamp()))))
      order by (balance.location_id=v_kit_location_id) desc,lot.expires_on nulls last,
        balance.location_id,balance.lot_id
    loop
      exit when v_remaining<=0;
      perform pg_advisory_xact_lock(hashtextextended(
        p_tenant_id::text||':'||v_candidate.location_id::text||':'||v_candidate.item_id::text||':'||
        coalesce(v_candidate.variant_id::text,'-')||':'||coalesce(v_candidate.lot_id::text,'-'),0));
      select coalesce(sum(balance.quantity_on_hand),0) into v_available
      from public.os_inventory_location_balances balance
      where balance.tenant_id=p_tenant_id and balance.location_id=v_candidate.location_id
        and balance.item_id=v_candidate.item_id
        and balance.variant_id is not distinct from v_candidate.variant_id
        and balance.lot_id is not distinct from v_candidate.lot_id;
      select coalesce(sum(reservation.quantity),0) into v_committed
      from public.nurse_inventory_reservations reservation
      where reservation.tenant_id=p_tenant_id and reservation.location_id=v_candidate.location_id
        and reservation.item_id=v_candidate.item_id
        and reservation.variant_id is not distinct from v_candidate.variant_id
        and reservation.lot_id is not distinct from v_candidate.lot_id
        and reservation.status in ('prepared','reserved')
        and reservation.expires_at>clock_timestamp();
      v_available:=greatest(v_available-v_committed,0);
      if v_available>0 then
        insert into public.nurse_inventory_reservations(
          tenant_id,shift_id,assignment_request_id,provider_profile_id,requirement_id,
          location_id,item_id,variant_id,lot_id,quantity,status,reserved_at,expires_at
        ) values(
          p_tenant_id,p_shift_id,p_idempotency_key,p_provider_profile_id,v_requirement.id,
          v_candidate.location_id,v_candidate.item_id,v_candidate.variant_id,v_candidate.lot_id,
          least(v_available,v_remaining),'reserved',clock_timestamp(),v_shift.ends_at+interval '4 hours'
        );
        v_remaining:=v_remaining-least(v_available,v_remaining);
      end if;
    end loop;
    if v_remaining>0 then raise exception using errcode='P0001',message='inventory_unserviceable'; end if;
  end loop;
  v_assignment := app_private.assign_marketplace_shift(
    p_tenant_id, p_actor_profile_id, p_shift_id, p_provider_profile_id, p_expected_shift_version,'assigned'
  );
  insert into public.provider_route_days(
    tenant_id,provider_profile_id,route_date,origin_kind,origin_label,status,assignment_revision
  ) values(
    p_tenant_id,p_provider_profile_id,(v_shift.starts_at at time zone v_shift.timezone)::date,
    'current','Origin required','origin_required',clock_timestamp()
  ) on conflict(provider_profile_id,route_date) do update set
    assignment_revision=clock_timestamp(),
    status=case when provider_route_days.status in ('released','acknowledged','active','paused')
      then 'recovery_required' when provider_route_days.status in ('completed','cancelled')
      then provider_route_days.status else 'origin_required' end,
    version=provider_route_days.version+1,updated_at=clock_timestamp()
  returning * into v_route_day;
  if v_route_day.status in ('completed','cancelled') then raise exception using errcode='P0001',message='route_day_closed'; end if;
  insert into public.provider_route_day_stops(
    tenant_id,route_day_id,appointment_id,assigned_provider_profile_id,selected,assignment_snapshot_at
  ) values(p_tenant_id,v_route_day.id,v_shift.appointment_id,p_provider_profile_id,true,clock_timestamp())
  on conflict(route_day_id,appointment_id) do update set
    assigned_provider_profile_id=excluded.assigned_provider_profile_id,selected=true,
    omission_reason=null,omission_note=null,assignment_snapshot_at=clock_timestamp(),updated_at=clock_timestamp();
  insert into public.nurse_pickup_tasks(
    tenant_id,shift_id,provider_profile_id,location_id,route_day_id,status,window_starts_at,window_ends_at
  ) select distinct p_tenant_id,p_shift_id,p_provider_profile_id,reservation.location_id,
      v_route_day.id,'required',v_shift.starts_at-interval '4 hours',v_shift.starts_at
    from public.nurse_inventory_reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.assignment_request_id=p_idempotency_key
      and reservation.status='reserved' and reservation.location_id<>v_kit_location_id
  on conflict(tenant_id,shift_id,provider_profile_id,location_id) do update set
    route_day_id=excluded.route_day_id,
    status=case when nurse_pickup_tasks.status in ('cancelled','blocked') then 'required'
      else nurse_pickup_tasks.status end,
    window_starts_at=excluded.window_starts_at,window_ends_at=excluded.window_ends_at,
    version=nurse_pickup_tasks.version+1,updated_at=clock_timestamp();
  insert into public.nurse_w2_assignment_idempotency (
    tenant_id, shift_id, provider_profile_id, idempotency_key, request_hash, assignment_id
  ) values (
    p_tenant_id, p_shift_id, p_provider_profile_id, p_idempotency_key, p_request_hash, v_assignment.id
  );
  insert into public.nurse_marketplace_transitions (
    tenant_id, entity_type, entity_id, to_status, reason_code, actor_profile_id, correlation_id
  ) values (
    p_tenant_id, 'assignment', v_assignment.id, 'assigned', 'approved_w2_direct_assignment',
    p_actor_profile_id, p_idempotency_key
  );
  return v_assignment;
end;
$$;

create or replace function public.act_on_nurse_shift_offer_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_offer_id uuid,
  p_expected_offer_version integer,
  p_expected_shift_version integer,
  p_idempotency_key uuid,
  p_request_hash text,
  p_action text,
  p_accepted_terms_hash text,
  p_requested_terms jsonb
)
returns public.nurse_shift_offers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_existing public.nurse_offer_action_idempotency%rowtype;
  v_offer public.nurse_shift_offers%rowtype;
begin
  if p_action = 'accept' then
    v_assignment := public.claim_nurse_shift_offer_v1(
      p_tenant_id, p_actor_profile_id, p_offer_id, p_provider_profile_id,
      p_expected_offer_version, p_expected_shift_version, p_idempotency_key,
      p_request_hash, p_accepted_terms_hash
    );
    select * into v_offer from public.nurse_shift_offers
    where tenant_id = p_tenant_id and id = p_offer_id;
    return v_offer;
  end if;
  if p_action not in ('view', 'decline', 'counter', 'ignore') or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'offer_action_invalid';
  end if;
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':' || p_provider_profile_id::text || ':' || p_idempotency_key::text, 0
  ));
  select * into v_existing from public.nurse_offer_action_idempotency action_record
  where action_record.tenant_id = p_tenant_id
    and action_record.provider_profile_id = p_provider_profile_id
    and action_record.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash or v_existing.action <> p_action then
      raise exception using errcode = '22023', message = 'offer_action_idempotency_conflict';
    end if;
    select * into v_offer from public.nurse_shift_offers
    where tenant_id = p_tenant_id and id = p_offer_id;
    return v_offer;
  end if;
  select * into v_offer from public.nurse_shift_offers offer
  where offer.tenant_id = p_tenant_id and offer.id = p_offer_id
    and offer.provider_profile_id = p_provider_profile_id
  for update;
  if not found or v_offer.version <> p_expected_offer_version
     or v_offer.status not in ('pending', 'offered', 'delivered', 'viewed') then
    raise exception using errcode = 'P0001', message = 'offer_unavailable';
  end if;
  if p_action = 'counter' then
    if p_requested_terms is null or jsonb_typeof(p_requested_terms) <> 'object' or p_requested_terms = '{}'::jsonb then
      raise exception using errcode = '22023', message = 'counter_terms_required';
    end if;
    insert into public.nurse_offer_counters (
      tenant_id, shift_id, offer_terms_id, provider_profile_id,
      request_key, requested_terms, status
    ) values (
      p_tenant_id, v_offer.shift_id, v_offer.offer_terms_id, p_provider_profile_id,
      p_idempotency_key, p_requested_terms, 'pending'
    );
  end if;
  update public.nurse_shift_offers set
    status = case p_action
      when 'view' then 'viewed' when 'decline' then 'declined'
      when 'counter' then 'countered' when 'ignore' then 'ignored' end,
    viewed_at = case when p_action = 'view' then coalesce(viewed_at, clock_timestamp()) else viewed_at end,
    acted_at = case when p_action in ('decline', 'counter', 'ignore') then clock_timestamp() else acted_at end,
    version = version + 1
  where tenant_id = p_tenant_id and id = p_offer_id
  returning * into v_offer;
  insert into public.nurse_offer_action_idempotency (
    tenant_id, offer_id, provider_profile_id, action, idempotency_key,
    request_hash, result_status, result_reference_id
  ) values (
    p_tenant_id, p_offer_id, p_provider_profile_id, p_action, p_idempotency_key,
    p_request_hash, v_offer.status, p_offer_id
  );
  insert into public.nurse_marketplace_transitions (
    tenant_id, entity_type, entity_id, from_status, to_status,
    reason_code, actor_profile_id, correlation_id
  ) values (
    p_tenant_id, 'offer', p_offer_id, null, v_offer.status,
    'nurse_' || p_action, p_actor_profile_id, p_idempotency_key
  );
  return v_offer;
end;
$$;

create or replace function public.transition_nurse_route_day_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_action text,
  p_entity_id uuid,
  p_reason_code text
)
returns public.provider_route_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_arrival_appointment_id uuid;
  v_arrival_pickup_id uuid;
  v_arrival_stop_type text;
  v_day public.provider_route_days%rowtype;
  v_from text;
  v_next text;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if exists (
    select 1 from public.nurse_route_release_history history
    where history.tenant_id = p_tenant_id and history.route_day_id = p_route_day_id
      and history.idempotency_key = p_idempotency_key
  ) then
    select * into v_day from public.provider_route_days
    where tenant_id = p_tenant_id and id = p_route_day_id;
    return v_day;
  end if;
  select * into v_day from public.provider_route_days day
  where day.tenant_id = p_tenant_id and day.id = p_route_day_id
    and day.provider_profile_id = p_provider_profile_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'route_day_not_found'; end if;
  if v_day.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'route_day_version_conflict';
  end if;
  v_from := v_day.status;
  v_next := case
    when p_action = 'acknowledge' and v_from = 'released' then 'acknowledged'
    when p_action = 'activate' and v_from = 'acknowledged' then 'active'
    when p_action = 'pause' and v_from = 'active' then 'paused'
    when p_action = 'resume' and v_from = 'paused' then 'active'
    when p_action = 'require_recovery' and v_from in ('released','acknowledged','active','paused') then 'recovery_required'
    when p_action = 'complete' and v_from in ('active','paused') then 'completed'
    when p_action = 'arrive' and v_from = 'active' then 'active'
    else null end;
  if v_next is null then raise exception using errcode = 'P0001', message = 'route_transition_invalid'; end if;
  if p_action in ('acknowledge', 'activate') and not exists (
    select 1 from public.nurse_route_plan_versions plan
    where plan.tenant_id = p_tenant_id and plan.id = v_day.current_plan_version_id
      and plan.route_day_id = p_route_day_id and plan.status = 'released'
      and plan.skipped_stop_count = 0 and plan.validation_error_count = 0
  ) then
    raise exception using errcode = 'P0001', message = 'released_route_plan_required';
  end if;
  if p_action = 'arrive' then
    select stop.stop_type,stop.appointment_id,stop.pickup_task_id
      into v_arrival_stop_type,v_arrival_appointment_id,v_arrival_pickup_id
    from public.nurse_route_plan_stops stop
    join public.nurse_route_plan_legs leg
      on leg.tenant_id = stop.tenant_id and leg.plan_version_id = stop.plan_version_id
      and leg.to_stop_id = stop.id
    where stop.tenant_id = p_tenant_id and stop.id = p_entity_id
      and stop.plan_version_id = v_day.current_plan_version_id
      and stop.stop_type in ('appointment','pickup')
      and leg.navigation_state in ('pending', 'active')
    for update of leg;
    if v_arrival_stop_type is null then
      raise exception using errcode = 'P0001', message = 'route_arrival_stop_invalid';
    end if;
    update public.nurse_route_plan_legs set navigation_state = 'arrived'
    where tenant_id = p_tenant_id and plan_version_id = v_day.current_plan_version_id
      and to_stop_id = p_entity_id and navigation_state in ('pending', 'active');
    if v_arrival_stop_type='pickup' then
      update public.nurse_pickup_tasks set status='arrived',version=version+1
      where tenant_id=p_tenant_id and id=v_arrival_pickup_id
        and status in ('required','acknowledged');
      if not found then raise exception using errcode='P0001',message='pickup_arrival_state_invalid'; end if;
    end if;
  end if;
  update public.provider_route_days set
    status = v_next,
    acknowledged_revision = case when p_action = 'acknowledge' then assignment_revision else acknowledged_revision end,
    active_appointment_id = case when p_action = 'arrive' and v_arrival_stop_type='appointment'
      then v_arrival_appointment_id else active_appointment_id end,
    version = version + 1
  where tenant_id = p_tenant_id and id = p_route_day_id
  returning * into v_day;
  insert into public.nurse_route_release_history (
    tenant_id, route_day_id, plan_version_id, provider_profile_id,
    from_status, to_status, action, reason_code, actor_profile_id,
    idempotency_key, route_day_version
  ) values (
    p_tenant_id, p_route_day_id, v_day.current_plan_version_id, p_provider_profile_id,
    v_from, v_next, p_action, p_reason_code, p_actor_profile_id,
    p_idempotency_key, v_day.version
  );
  return v_day;
end;
$$;

create or replace function public.complete_nurse_route_stop_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_plan_stop_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
returns public.provider_route_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day public.provider_route_days%rowtype;
  v_leg_number integer;
  v_route_finished boolean;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if exists (
    select 1 from public.nurse_route_release_history history
    where history.tenant_id = p_tenant_id and history.route_day_id = p_route_day_id
      and history.idempotency_key = p_idempotency_key
      and history.action in ('complete_stop','complete')
  ) then
    select * into v_day from public.provider_route_days where tenant_id = p_tenant_id and id = p_route_day_id;
    return v_day;
  end if;
  select * into v_day from public.provider_route_days day
  where day.tenant_id = p_tenant_id and day.id = p_route_day_id
    and day.provider_profile_id = p_provider_profile_id for update;
  if not found or v_day.status <> 'active' then raise exception using errcode = 'P0001', message = 'active_route_required'; end if;
  if v_day.version <> p_expected_version then raise exception using errcode = '40001', message = 'route_day_version_conflict'; end if;
  select leg.leg_number into v_leg_number
  from public.nurse_route_plan_stops stop
  join public.nurse_route_plan_legs leg
    on leg.tenant_id = stop.tenant_id and leg.plan_version_id = stop.plan_version_id and leg.to_stop_id = stop.id
  where stop.tenant_id = p_tenant_id and stop.id = p_plan_stop_id
    and stop.plan_version_id = v_day.current_plan_version_id
    and stop.appointment_id = v_day.active_appointment_id
    and leg.navigation_state = 'arrived'
  for update of leg;
  if v_leg_number is null then raise exception using errcode = 'P0001', message = 'arrived_route_stop_required'; end if;
  update public.nurse_route_plan_legs set navigation_state = 'completed'
  where tenant_id = p_tenant_id and plan_version_id = v_day.current_plan_version_id
    and leg_number = v_leg_number and navigation_state = 'arrived';
  update public.nurse_route_plan_legs set navigation_state = 'active'
  where tenant_id = p_tenant_id and plan_version_id = v_day.current_plan_version_id
    and leg_number = v_leg_number + 1 and navigation_state = 'pending';
  select not exists(
    select 1 from public.nurse_route_plan_legs leg
    where leg.tenant_id=p_tenant_id and leg.plan_version_id=v_day.current_plan_version_id
      and leg.navigation_state in ('pending','active','arrived')
  ) into v_route_finished;
  if v_route_finished then
    update public.nurse_route_plan_versions set status='completed'
    where tenant_id=p_tenant_id and id=v_day.current_plan_version_id and status='released';
    if not found then
      raise exception using errcode='P0001',message='released_route_plan_required';
    end if;
  end if;
  update public.provider_route_days set
    active_appointment_id = null,
    status=case when v_route_finished then 'completed' else status end,
    origin_id=case when v_route_finished and origin_kind='manual' then null else origin_id end,
    origin_label=case when v_route_finished then 'Origin expired' else origin_label end,
    origin_address=case when v_route_finished then null else origin_address end,
    origin_latitude=case when v_route_finished then null else origin_latitude end,
    origin_longitude=case when v_route_finished then null else origin_longitude end,
    version = version + 1
  where tenant_id = p_tenant_id and id = p_route_day_id returning * into v_day;
  insert into public.nurse_route_release_history (
    tenant_id, route_day_id, plan_version_id, provider_profile_id, from_status, to_status,
    action, reason_code, actor_profile_id, idempotency_key, route_day_version
  ) values (
    p_tenant_id, p_route_day_id, v_day.current_plan_version_id, p_provider_profile_id,
    'active', case when v_route_finished then 'completed' else 'active' end,
    case when v_route_finished then 'complete' else 'complete_stop' end,
    case when v_route_finished then 'route_stops_completed' else 'guided_stop_completed' end,
    p_actor_profile_id,
    p_idempotency_key, v_day.version
  );
  return v_day;
end;
$$;

create or replace function public.complete_nurse_route_stop_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_appointment_id uuid,
  p_idempotency_key uuid
)
returns public.provider_route_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day public.provider_route_days%rowtype;
  v_stop_id uuid;
begin
  select * into v_day from public.provider_route_days day
  where day.tenant_id = p_tenant_id and day.id = p_route_day_id
    and day.provider_profile_id = p_provider_profile_id;
  if not found then raise exception using errcode = 'P0002', message = 'route_day_not_found'; end if;
  select stop.id into v_stop_id from public.nurse_route_plan_stops stop
  where stop.tenant_id = p_tenant_id and stop.plan_version_id = v_day.current_plan_version_id
    and stop.appointment_id = p_appointment_id;
  if not found then raise exception using errcode = 'P0001', message = 'route_appointment_stop_not_found'; end if;
  return public.complete_nurse_route_stop_v1(
    p_tenant_id, p_actor_profile_id, p_provider_profile_id, p_route_day_id,
    v_stop_id, v_day.version, p_idempotency_key
  );
end;
$$;

create or replace function public.reconcile_nurse_route_stop_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_shift_id uuid,
  p_shift_run_id uuid,
  p_idempotency_key uuid
)
returns public.provider_route_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_appointment_id uuid;
begin
  if not exists (
    select 1 from public.mobile_shift_runs run
    where run.tenant_id = p_tenant_id and run.id = p_shift_run_id
      and run.shift_id = p_shift_id and run.provider_profile_id = p_provider_profile_id
      and run.route_day_id = p_route_day_id and run.status in ('closed','time_submitted','clocked_out')
  ) then raise exception using errcode = 'P0001', message = 'closed_shift_run_required'; end if;
  select shift.appointment_id into v_appointment_id from public.operational_shifts shift
  where shift.tenant_id = p_tenant_id and shift.id = p_shift_id;
  if v_appointment_id is null then raise exception using errcode = 'P0001', message = 'route_appointment_required'; end if;
  return public.complete_nurse_route_stop_v1(
    p_tenant_id, p_actor_profile_id, p_provider_profile_id, p_route_day_id,
    v_appointment_id, p_idempotency_key
  );
end;
$$;

create or replace function public.set_nurse_route_origin_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_origin_kind text,
  p_origin_label text,
  p_origin_address text,
  p_origin_latitude double precision,
  p_origin_longitude double precision
)
returns public.provider_route_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day public.provider_route_days%rowtype;
  v_from_status text;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if p_origin_kind not in ('manual', 'office')
     or p_origin_label is null or char_length(trim(p_origin_label)) not between 1 and 120
     or p_origin_address is null or char_length(trim(p_origin_address)) not between 1 and 300
     or p_origin_latitude is null or p_origin_latitude not between -90 and 90
     or p_origin_longitude is null or p_origin_longitude not between -180 and 180 then
    raise exception using errcode = '22023', message = 'persisted_route_origin_invalid';
  end if;
  if exists (
    select 1 from public.nurse_route_release_history history
    where history.tenant_id = p_tenant_id and history.route_day_id = p_route_day_id
      and history.idempotency_key = p_idempotency_key and history.action = 'set_origin'
  ) then
    select * into v_day from public.provider_route_days
    where tenant_id = p_tenant_id and id = p_route_day_id;
    return v_day;
  end if;
  select * into v_day from public.provider_route_days day
  where day.tenant_id = p_tenant_id and day.id = p_route_day_id
    and day.provider_profile_id = p_provider_profile_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'route_day_not_found'; end if;
  if v_day.version <> p_expected_version then raise exception using errcode = '40001', message = 'route_day_version_conflict'; end if;
  if v_day.status not in ('draft', 'origin_required', 'inventory_check', 'pickup_required', 'infeasible') then
    raise exception using errcode = 'P0001', message = 'route_origin_change_prohibited';
  end if;
  v_from_status:=v_day.status;
  update public.provider_route_days set
    origin_kind = p_origin_kind, origin_id = null,
    origin_label = left(trim(p_origin_label), 120), origin_address = trim(p_origin_address),
    origin_latitude = p_origin_latitude, origin_longitude = p_origin_longitude,
    status = 'inventory_check', version = version + 1
  where tenant_id = p_tenant_id and id = p_route_day_id
  returning * into v_day;
  insert into public.nurse_route_release_history (
    tenant_id, route_day_id, provider_profile_id, from_status, to_status,
    action, reason_code, actor_profile_id, idempotency_key, route_day_version
  ) values (
    p_tenant_id, p_route_day_id, p_provider_profile_id, v_from_status, 'inventory_check',
    'set_origin', 'typed_origin_verified', p_actor_profile_id, p_idempotency_key, v_day.version
  );
  return v_day;
end;
$$;

create or replace function public.prepare_nurse_route_plan_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_constraints jsonb;
  v_constraints_hash text;
  v_day public.provider_route_days%rowtype;
  v_day_end timestamptz;
  v_day_start timestamptz;
  v_day_timezone text;
  v_inventory_state text;
  v_route_policy public.nurse_marketplace_policies%rowtype;
  v_stops jsonb;
  v_timezone_count integer;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  select * into v_day from public.provider_route_days day
  where day.tenant_id = p_tenant_id and day.id = p_route_day_id
    and day.provider_profile_id = p_provider_profile_id
  for share;
  if not found then raise exception using errcode = 'P0002', message = 'route_day_not_found'; end if;
  if v_day.version <> p_expected_version then raise exception using errcode = '40001', message = 'route_day_version_conflict'; end if;
  select * into v_route_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='route_release'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
  order by policy.version desc limit 1;
  v_constraints:=v_route_policy.rules->'route_constraints';
  if v_route_policy.id is null or jsonb_typeof(v_constraints)<>'object'
     or coalesce(nullif(v_constraints->>'maxStops','')::integer between 1 and 100,false) is not true
     or coalesce(nullif(v_constraints->>'maxWorkMinutes','')::integer between 1 and 1440,false) is not true
     or coalesce(nullif(v_constraints->>'maxTravelMinutes','')::integer between 0 and 1440,false) is not true
     or jsonb_typeof(v_constraints->'requiredBreaks')<>'array'
     or coalesce(nullif(v_constraints->>'parkingBufferMinutes','')::integer between 0 and 240,false) is not true
     or coalesce(nullif(v_constraints->>'serviceBufferMinutes','')::integer between 0 and 240,false) is not true
     or coalesce(nullif(v_constraints->>'observationBufferMinutes','')::integer between 0 and 240,false) is not true
     or coalesce(nullif(v_constraints->>'coldChainMaxElapsedMinutes','')::integer between 1 and 1440,false) is not true
     or coalesce(v_constraints->>'dayStartLocalTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(v_constraints->>'dayEndLocalTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(v_constraints->>'tollPolicy','') not in ('avoid','allow') then
    raise exception using errcode='P0001',message='approved_route_constraints_required';
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_constraints->'requiredBreaks') break_rule
    where nullif(break_rule->>'windowStart','') is null
      or nullif(break_rule->>'windowEnd','') is null
      or coalesce(nullif(break_rule->>'durationMinutes','')::integer between 1 and 240,false) is not true
  ) then raise exception using errcode='P0001',message='approved_route_break_rules_invalid'; end if;
  if exists(select 1 from public.nurse_pickup_tasks pickup
      where pickup.tenant_id=p_tenant_id and pickup.route_day_id=p_route_day_id
        and pickup.status not in ('completed','cancelled'))
     and (jsonb_typeof(v_constraints->'depotHours')<>'object'
       or nullif(v_constraints->'depotHours'->>'start','') is null
       or nullif(v_constraints->'depotHours'->>'end','') is null) then
    raise exception using errcode='P0001',message='approved_pickup_depot_hours_required';
  end if;
  v_constraints_hash:=encode(extensions.digest(v_constraints::text,'sha256'),'hex');
  select min(shift.timezone),count(distinct shift.timezone)
    into v_day_timezone,v_timezone_count
  from public.provider_route_day_stops stop
  join public.nurse_work_source_links source_link
    on source_link.tenant_id=stop.tenant_id and source_link.appointment_id=stop.appointment_id
    and source_link.status='active'
  join public.operational_shifts shift
    on shift.tenant_id=source_link.tenant_id and shift.id=source_link.shift_id
  where stop.tenant_id=p_tenant_id and stop.route_day_id=p_route_day_id and stop.selected;
  if v_day_timezone is null or v_timezone_count<>1 then
    raise exception using errcode='P0001',message='single_route_day_timezone_required';
  end if;
  v_day_start:=((v_day.route_date::text||' '||v_constraints->>'dayStartLocalTime')::timestamp
    at time zone v_day_timezone);
  v_day_end:=((v_day.route_date::text||' '||v_constraints->>'dayEndLocalTime')::timestamp
    at time zone v_day_timezone);
  if v_day_end<=v_day_start
     or v_day_start>=(select min(shift.starts_at)
       from public.provider_route_day_stops stop
       join public.nurse_work_source_links source_link on source_link.tenant_id=stop.tenant_id
         and source_link.appointment_id=stop.appointment_id and source_link.status='active'
       join public.operational_shifts shift on shift.tenant_id=source_link.tenant_id and shift.id=source_link.shift_id
       where stop.tenant_id=p_tenant_id and stop.route_day_id=p_route_day_id and stop.selected)
     or v_day_end<=(select max(shift.ends_at)
       from public.provider_route_day_stops stop
       join public.nurse_work_source_links source_link on source_link.tenant_id=stop.tenant_id
         and source_link.appointment_id=stop.appointment_id and source_link.status='active'
       join public.operational_shifts shift on shift.tenant_id=source_link.tenant_id and shift.id=source_link.shift_id
       where stop.tenant_id=p_tenant_id and stop.route_day_id=p_route_day_id and stop.selected)
     or extract(epoch from (v_day_end-v_day_start))/60.0>
        nullif(v_constraints->>'maxWorkMinutes','')::integer+
        nullif(v_constraints->>'maxTravelMinutes','')::integer then
    raise exception using errcode='P0001',message='approved_route_day_bounds_invalid';
  end if;
  if not exists (
    select 1 from public.provider_route_day_stops stop
    where stop.tenant_id = p_tenant_id and stop.route_day_id = p_route_day_id and stop.selected
  ) then raise exception using errcode = 'P0001', message = 'route_stops_required'; end if;
  if exists (
    select 1
    from public.provider_route_day_stops stop
    left join public.nurse_appointment_route_locations location
      on location.tenant_id = stop.tenant_id and location.appointment_id = stop.appointment_id
      and location.invalidated_at is null and location.expires_at > clock_timestamp()
    where stop.tenant_id = p_tenant_id and stop.route_day_id = p_route_day_id
      and stop.selected and location.id is null
  ) then raise exception using errcode = 'P0001', message = 'appointment_route_coordinates_required'; end if;
  if exists (
    select 1
    from public.nurse_pickup_tasks pickup
    left join public.nurse_inventory_location_route_locations location
      on location.tenant_id = pickup.tenant_id and location.inventory_location_id = pickup.location_id
      and location.invalidated_at is null and location.expires_at > clock_timestamp()
    where pickup.tenant_id = p_tenant_id and pickup.route_day_id = p_route_day_id
      and pickup.status not in ('completed', 'cancelled') and location.id is null
  ) then raise exception using errcode = 'P0001', message = 'pickup_route_coordinates_required'; end if;
  if exists (
    select 1
    from public.provider_route_day_stops stop
    join public.nurse_work_source_links source_link
      on source_link.tenant_id=stop.tenant_id
      and source_link.appointment_id=stop.appointment_id and source_link.status='active'
    join public.operational_shifts shift
      on shift.tenant_id = source_link.tenant_id and shift.id=source_link.shift_id
    where stop.tenant_id = p_tenant_id and stop.route_day_id = p_route_day_id and stop.selected
      and not exists (
        select 1 from public.nurse_shift_readiness_snapshots readiness
        where readiness.tenant_id = shift.tenant_id and readiness.shift_id = shift.id
          and readiness.provider_profile_id = p_provider_profile_id
          and readiness.evaluation_stage = 'claim'
          and readiness.overall_status = 'ready' and readiness.claim_allowed and readiness.invalidated_at is null
          and readiness.expires_at > clock_timestamp()
      )
  ) then raise exception using errcode = 'P0001', message = 'fresh_preplan_assignment_readiness_required'; end if;
  v_inventory_state := case when exists (
    select 1 from public.nurse_pickup_tasks pickup
    where pickup.tenant_id = p_tenant_id and pickup.route_day_id = p_route_day_id
      and pickup.status not in ('completed', 'cancelled')
  ) then 'pickup_required' else 'kit_ready' end;
  with appointment_stops as (
    select
      'appt_' || stop.id::text as id, 'appointment'::text as kind,
      location.latitude, location.longitude,
      shift.starts_at as window_start, shift.ends_at as window_end,
      greatest(1, ceil(extract(epoch from (shift.ends_at - shift.starts_at)) / 60.0)::integer) as duration_minutes,
      coalesce((select ceil(sum(requirement.quantity))::integer
        from public.nurse_shift_supply_requirements pinned
        join public.nurse_supply_manifest_requirements requirement
          on requirement.tenant_id = pinned.tenant_id and requirement.manifest_version_id = pinned.manifest_version_id
        where pinned.tenant_id = shift.tenant_id and pinned.shift_id = shift.id and pinned.invalidated_at is null), 0) as load,
      (select 'pickup_' || pickup.id::text
        from public.nurse_pickup_tasks pickup
        where pickup.tenant_id = shift.tenant_id and pickup.shift_id = shift.id
          and pickup.route_day_id = p_route_day_id and pickup.status not in ('completed','cancelled')
        order by pickup.created_at,pickup.id limit 1) as predecessor,
      coalesce((select jsonb_agg('pickup_'||pickup.id::text order by pickup.created_at,pickup.id)
        from public.nurse_pickup_tasks pickup
        where pickup.tenant_id=shift.tenant_id and pickup.shift_id=shift.id
          and pickup.route_day_id=p_route_day_id
          and pickup.status not in ('completed','cancelled')),'[]'::jsonb) as predecessors
    from public.provider_route_day_stops stop
    join public.nurse_work_source_links source_link
      on source_link.tenant_id=stop.tenant_id
      and source_link.appointment_id=stop.appointment_id and source_link.status='active'
    join public.operational_shifts shift
      on shift.tenant_id=source_link.tenant_id and shift.id=source_link.shift_id
    join public.operational_shift_assignments assignment
      on assignment.tenant_id = shift.tenant_id and assignment.shift_id = shift.id
      and assignment.provider_profile_id = p_provider_profile_id
      and assignment.status in ('claimed','assigned')
    join public.nurse_appointment_route_locations location
      on location.tenant_id = stop.tenant_id and location.appointment_id = stop.appointment_id
      and location.invalidated_at is null and location.expires_at > clock_timestamp()
    where stop.tenant_id = p_tenant_id and stop.route_day_id = p_route_day_id and stop.selected
  ), pickup_stops as (
    select
      'pickup_' || pickup.id::text as id, 'pickup'::text as kind,
      location.latitude, location.longitude,
      coalesce(pickup.window_starts_at, min(shift.starts_at) - interval '2 hours') as window_start,
      coalesce(pickup.window_ends_at, min(shift.starts_at)) as window_end,
      15 as duration_minutes, 0 as load, null::text as predecessor,'[]'::jsonb as predecessors
    from public.nurse_pickup_tasks pickup
    join public.operational_shifts shift
      on shift.tenant_id = pickup.tenant_id and shift.id = pickup.shift_id
    join public.nurse_inventory_location_route_locations location
      on location.tenant_id = pickup.tenant_id and location.inventory_location_id = pickup.location_id
      and location.invalidated_at is null and location.expires_at > clock_timestamp()
    where pickup.tenant_id = p_tenant_id and pickup.route_day_id = p_route_day_id
      and pickup.status not in ('completed','cancelled')
    group by pickup.id, location.latitude, location.longitude,
      pickup.window_starts_at, pickup.window_ends_at
  ), all_stops as (
    select * from appointment_stops union all select * from pickup_stops
  )
  select jsonb_agg(jsonb_build_object(
    'id', id, 'kind', kind, 'latitude', latitude, 'longitude', longitude,
    'windowStart', window_start, 'windowEnd', window_end,
    'durationMinutes', duration_minutes, 'load', load,
    'pickupPredecessorId', predecessor,
    'pickupPredecessorIds', predecessors
  ) order by window_start, id) into v_stops from all_stops;
  if v_stops is null or jsonb_array_length(v_stops) = 0 then
    raise exception using errcode = 'P0001', message = 'route_stops_not_ready';
  end if;
  return jsonb_build_object(
    'inventory_state', v_inventory_state,
    'capacity', coalesce((select ceil(sum(reservation.quantity))::integer
      from public.nurse_inventory_reservations reservation
      where reservation.tenant_id = p_tenant_id and reservation.provider_profile_id = p_provider_profile_id
        and reservation.status = 'reserved' and reservation.expires_at > clock_timestamp()), 0),
    'shift_start',v_day_start,
    'shift_end',v_day_end,
    'stops', v_stops,
    'constraints',v_constraints,
    'constraints_hash',v_constraints_hash,
    'route_policy_id',v_route_policy.id
  );
end;
$$;

create or replace function public.get_nurse_route_plan_request_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_request public.nurse_route_plan_requests%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  select * into v_request from public.nurse_route_plan_requests request
  where request.tenant_id = p_tenant_id and request.route_day_id = p_route_day_id
    and request.provider_profile_id = p_provider_profile_id
    and request.idempotency_key = p_idempotency_key;
  if not found then return null; end if;
  return jsonb_build_object(
    'status', v_request.status, 'plan_version_id', v_request.plan_version_id,
    'request_hash', v_request.request_hash, 'failure_code', v_request.failure_code
  );
end;
$$;

create or replace function public.reserve_nurse_route_plan_request_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_origin_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.nurse_route_plan_requests%rowtype;
  v_reserved_now boolean := false;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if p_request_hash !~ '^[0-9a-f]{64}$' or p_origin_kind not in ('current','manual','office') then
    raise exception using errcode = '22023', message = 'route_plan_request_invalid';
  end if;
  if not exists (
    select 1 from public.provider_route_days day where day.tenant_id = p_tenant_id
      and day.id = p_route_day_id and day.provider_profile_id = p_provider_profile_id
  ) then raise exception using errcode = 'P0002', message = 'route_day_not_found'; end if;
  insert into public.nurse_route_plan_requests (
    tenant_id, route_day_id, provider_profile_id, idempotency_key,
    request_hash, origin_kind, status
  ) values (
    p_tenant_id, p_route_day_id, p_provider_profile_id, p_idempotency_key,
    p_request_hash, p_origin_kind, 'pending'
  ) on conflict (tenant_id, route_day_id, idempotency_key) do nothing
  returning * into v_request;
  v_reserved_now := found;
  if not found then
    select * into v_request from public.nurse_route_plan_requests request
    where request.tenant_id = p_tenant_id and request.route_day_id = p_route_day_id
      and request.idempotency_key = p_idempotency_key for update;
    if v_request.request_hash <> p_request_hash or v_request.origin_kind <> p_origin_kind then
      raise exception using errcode = '22023', message = 'route_plan_idempotency_conflict';
    end if;
    if v_request.status='failed' then
      update public.nurse_route_plan_requests set
        status='pending',failure_code=null,completed_at=null
      where tenant_id=p_tenant_id and id=v_request.id
      returning * into v_request;
      v_reserved_now:=true;
    end if;
  end if;
  return jsonb_build_object(
    'status', v_request.status, 'request_hash', v_request.request_hash,
    'plan_version_id', v_request.plan_version_id, 'reserved_now', v_reserved_now
  );
end;
$$;

create or replace function public.fail_nurse_route_plan_request_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_failure_code text
)
returns public.nurse_route_plan_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_request public.nurse_route_plan_requests%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if char_length(trim(p_failure_code)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'route_plan_failure_code_required';
  end if;
  update public.nurse_route_plan_requests set
    status = 'failed', failure_code = trim(p_failure_code), completed_at = clock_timestamp()
  where tenant_id = p_tenant_id and route_day_id = p_route_day_id
    and provider_profile_id = p_provider_profile_id and idempotency_key = p_idempotency_key
    and request_hash = p_request_hash and status = 'pending'
  returning * into v_request;
  if not found then raise exception using errcode = 'P0001', message = 'pending_route_plan_request_required'; end if;
  return v_request;
end;
$$;

create or replace function public.persist_nurse_route_plan_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_route_day_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_origin_kind text,
  p_origin_label text,
  p_origin_address text,
  p_origin_latitude double precision,
  p_origin_longitude double precision,
  p_consent_text_version text,
  p_consent_hash text,
  p_request_hash text,
  p_response_hash text,
  p_route_policy_id uuid,
  p_constraints_hash text,
  p_constraint_evidence jsonb,
  p_ordered_stop_ids text[],
  p_visits jsonb,
  p_transitions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consent public.nurse_route_origin_consents%rowtype;
  v_day public.provider_route_days%rowtype;
  v_existing public.nurse_route_plan_requests%rowtype;
  v_from_stop_id uuid;
  v_index integer;
  v_plan public.nurse_route_plan_versions%rowtype;
  v_plan_stop public.nurse_route_plan_stops%rowtype;
  v_route_constraints jsonb;
  v_route_policy public.nurse_marketplace_policies%rowtype;
  v_stop_key text;
  v_transition jsonb;
  v_visit jsonb;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if p_origin_kind not in ('current','manual','office')
     or p_consent_hash !~ '^[0-9a-f]{64}$' or p_request_hash !~ '^[0-9a-f]{64}$'
     or p_response_hash !~ '^[0-9a-f]{64}$' or coalesce(array_length(p_ordered_stop_ids,1),0) = 0
     or p_consent_text_version is null or char_length(trim(p_consent_text_version)) not between 1 and 80
     or p_constraints_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_constraint_evidence)<>'object'
     or jsonb_typeof(p_visits) <> 'array' or jsonb_typeof(p_transitions) <> 'array'
     or jsonb_array_length(p_visits)<>array_length(p_ordered_stop_ids,1)
     or jsonb_array_length(p_transitions)<array_length(p_ordered_stop_ids,1) then
    raise exception using errcode = '22023', message = 'route_plan_result_invalid';
  end if;
  if p_origin_kind = 'current' and (
    p_origin_address is not null or p_origin_latitude is not null or p_origin_longitude is not null
  ) then raise exception using errcode = '22023', message = 'current_origin_persistence_prohibited'; end if;
  if p_origin_kind in ('manual','office') and (
    p_origin_label is null or char_length(trim(p_origin_label)) not between 1 and 120
    or p_origin_address is null or char_length(trim(p_origin_address)) not between 1 and 300
    or p_origin_latitude is null or p_origin_latitude not between -90 and 90
    or p_origin_longitude is null or p_origin_longitude not between -180 and 180
  ) then raise exception using errcode = '22023', message = 'persisted_route_origin_invalid'; end if;
  select * into v_existing from public.nurse_route_plan_requests request
  where request.tenant_id = p_tenant_id and request.route_day_id = p_route_day_id
    and request.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'route_plan_idempotency_conflict'; end if;
    if v_existing.status = 'persisted' then
      return jsonb_build_object('route_day_id', p_route_day_id, 'plan_version_id', v_existing.plan_version_id, 'idempotent', true);
    end if;
    if v_existing.status <> 'pending' then raise exception using errcode = 'P0001', message = 'route_plan_request_not_retryable'; end if;
  end if;
  select * into v_day from public.provider_route_days day
  where day.tenant_id = p_tenant_id and day.id = p_route_day_id
    and day.provider_profile_id = p_provider_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'route_day_not_found'; end if;
  if v_day.version <> p_expected_version then raise exception using errcode = '40001', message = 'route_day_version_conflict'; end if;
  select * into v_route_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.id=p_route_policy_id
    and policy.policy_type='route_release' and policy.status='approved'
    and policy.effective_at<=clock_timestamp() for share;
  v_route_constraints:=v_route_policy.rules->'route_constraints';
  if not found or jsonb_typeof(v_route_constraints)<>'object'
     or encode(extensions.digest(v_route_constraints::text,'sha256'),'hex')<>p_constraints_hash
     or coalesce(p_constraint_evidence->>'routePolicyId','')<>p_route_policy_id::text
     or coalesce(p_constraint_evidence->>'constraintsHash','')<>p_constraints_hash
     or coalesce(nullif(p_constraint_evidence->>'stopCount','')::integer,-1)<>array_length(p_ordered_stop_ids,1)
     or array_length(p_ordered_stop_ids,1)>nullif(v_route_constraints->>'maxStops','')::integer
     or coalesce(nullif(p_constraint_evidence->>'workMinutes','')::numeric,-1)<0
     or coalesce(nullif(p_constraint_evidence->>'workMinutes','')::numeric,1e18)>
        nullif(v_route_constraints->>'maxWorkMinutes','')::numeric
     or coalesce(nullif(p_constraint_evidence->>'travelMinutes','')::numeric,-1)<0
     or coalesce(nullif(p_constraint_evidence->>'travelMinutes','')::numeric,1e18)>
        nullif(v_route_constraints->>'maxTravelMinutes','')::numeric
     or coalesce(nullif(p_constraint_evidence->>'requiredBreakCount','')::integer,-1)<>
        jsonb_array_length(v_route_constraints->'requiredBreaks')
     or coalesce(nullif(p_constraint_evidence->>'completedBreakCount','')::integer,-1)<
        jsonb_array_length(v_route_constraints->'requiredBreaks')
     or coalesce(p_constraint_evidence->>'tollPolicy','')<>v_route_constraints->>'tollPolicy'
     or jsonb_typeof(p_constraint_evidence->'coldChain')<>'array' then
    raise exception using errcode='P0001',message='route_constraint_evidence_invalid';
  end if;
  if (select count(*)<>count(distinct stop_key) from unnest(p_ordered_stop_ids) stop_key)
     or exists(
       with expected(stop_key) as (
         select 'appt_'||stop.id::text
         from public.provider_route_day_stops stop
         where stop.tenant_id=p_tenant_id and stop.route_day_id=p_route_day_id and stop.selected
         union all
         select 'pickup_'||pickup.id::text
         from public.nurse_pickup_tasks pickup
         where pickup.tenant_id=p_tenant_id and pickup.route_day_id=p_route_day_id
           and pickup.status not in ('completed','cancelled')
       ), actual(stop_key) as (
         select unnest(p_ordered_stop_ids)
       ), difference as (
         (select stop_key from expected except select stop_key from actual)
         union all
         (select stop_key from actual except select stop_key from expected)
       ) select 1 from difference
     ) then
    raise exception using errcode='P0001',message='route_stop_set_mismatch';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_visits) visit
    where nullif(visit->>'stopId','') is null or nullif(visit->>'startTime','') is null
      or not ((visit->>'stopId')=any(p_ordered_stop_ids))
  ) then raise exception using errcode='P0001',message='route_visit_invalid'; end if;
  if exists(
    select 1
    from public.nurse_pickup_tasks pickup
    join public.nurse_work_source_links source_link
      on source_link.tenant_id=pickup.tenant_id and source_link.shift_id=pickup.shift_id
      and source_link.status='active'
    join public.provider_route_day_stops appointment_stop
      on appointment_stop.tenant_id=source_link.tenant_id
      and appointment_stop.appointment_id=source_link.appointment_id
      and appointment_stop.route_day_id=p_route_day_id and appointment_stop.selected
    where pickup.tenant_id=p_tenant_id and pickup.route_day_id=p_route_day_id
      and pickup.status not in ('completed','cancelled') and (
        array_position(p_ordered_stop_ids,'pickup_'||pickup.id::text) is null
        or array_position(p_ordered_stop_ids,'appt_'||appointment_stop.id::text) is null
        or array_position(p_ordered_stop_ids,'pickup_'||pickup.id::text)>=
           array_position(p_ordered_stop_ids,'appt_'||appointment_stop.id::text)
      )
  ) then raise exception using errcode='P0001',message='pickup_precedence_invalid'; end if;
  if coalesce(nullif(p_constraint_evidence->>'precedenceEdgeCount','')::integer,-1)<>
      (select count(*) from public.nurse_pickup_tasks pickup
       join public.nurse_work_source_links source_link
         on source_link.tenant_id=pickup.tenant_id and source_link.shift_id=pickup.shift_id
         and source_link.status='active'
       where pickup.tenant_id=p_tenant_id and pickup.route_day_id=p_route_day_id
         and pickup.status not in ('completed','cancelled')) then
    raise exception using errcode='P0001',message='pickup_precedence_evidence_incomplete';
  end if;
  if exists(
    select 1
    from public.nurse_pickup_tasks pickup
    join public.nurse_work_source_links source_link
      on source_link.tenant_id=pickup.tenant_id and source_link.shift_id=pickup.shift_id
      and source_link.status='active'
    join public.provider_route_day_stops appointment_stop
      on appointment_stop.tenant_id=source_link.tenant_id
      and appointment_stop.appointment_id=source_link.appointment_id
      and appointment_stop.route_day_id=p_route_day_id and appointment_stop.selected
    where pickup.tenant_id=p_tenant_id and pickup.route_day_id=p_route_day_id
      and pickup.status not in ('completed','cancelled')
      and exists(select 1 from public.nurse_inventory_reservations reservation
        join public.os_inventory_lots lot
          on lot.tenant_id=reservation.tenant_id and lot.id=reservation.lot_id
        where reservation.tenant_id=pickup.tenant_id and reservation.shift_id=pickup.shift_id
          and reservation.location_id=pickup.location_id and reservation.status='reserved'
          and lot.temperature_controlled)
      and (
        (select nullif(visit->>'startTime','')::timestamptz from jsonb_array_elements(p_visits) visit
          where visit->>'stopId'='appt_'||appointment_stop.id::text limit 1) is null
        or (select nullif(visit->>'startTime','')::timestamptz from jsonb_array_elements(p_visits) visit
          where visit->>'stopId'='pickup_'||pickup.id::text limit 1) is null
        or extract(epoch from (
          (select nullif(visit->>'startTime','')::timestamptz from jsonb_array_elements(p_visits) visit
            where visit->>'stopId'='appt_'||appointment_stop.id::text limit 1)
          -(select nullif(visit->>'startTime','')::timestamptz from jsonb_array_elements(p_visits) visit
            where visit->>'stopId'='pickup_'||pickup.id::text limit 1)
        ))/60.0>nullif(v_route_constraints->>'coldChainMaxElapsedMinutes','')::integer
      )
  ) then raise exception using errcode='P0001',message='cold_chain_route_constraint_invalid'; end if;
  insert into public.nurse_route_origin_consents (
    tenant_id, route_day_id, provider_profile_id, origin_kind, consent_scope,
    consent_text_version, consent_hash, expires_at
  ) values (
    p_tenant_id, p_route_day_id, p_provider_profile_id, p_origin_kind, 'single_plan',
    p_consent_text_version, p_consent_hash, clock_timestamp() + interval '15 minutes'
  ) returning * into v_consent;
  insert into public.nurse_route_plan_versions (
    tenant_id, route_day_id, provider_profile_id, origin_consent_id, plan_version,
    status, provider, request_hash, response_hash,route_policy_id,constraints_hash,
    constraint_evidence,constraint_evidence_hash,expected_stop_count,
    planned_stop_count, skipped_stop_count, validation_error_count, planned_at
  ) values (
    p_tenant_id, p_route_day_id, p_provider_profile_id, v_consent.id,
    coalesce((select max(plan.plan_version) + 1 from public.nurse_route_plan_versions plan
      where plan.tenant_id = p_tenant_id and plan.route_day_id = p_route_day_id), 1),
    'feasible', 'google_route_optimization', p_request_hash, p_response_hash,
    p_route_policy_id,p_constraints_hash,p_constraint_evidence,
    encode(extensions.digest(p_constraint_evidence::text,'sha256'),'hex'),
    array_length(p_ordered_stop_ids,1), array_length(p_ordered_stop_ids,1), 0, 0, clock_timestamp()
  ) returning * into v_plan;
  for v_index in 1..array_length(p_ordered_stop_ids,1) loop
    v_stop_key := p_ordered_stop_ids[v_index];
    select value into v_visit from jsonb_array_elements(p_visits) value
    where value ->> 'stopId' = v_stop_key limit 1;
    if v_visit is null then raise exception using errcode = 'P0001', message = 'route_visit_missing'; end if;
    if left(v_stop_key,5)='appt_' then
      insert into public.nurse_route_plan_stops (
        tenant_id, plan_version_id, stop_key, stop_type, sequence_number,
        appointment_id, latitude, longitude, window_starts_at, window_ends_at,
        service_duration_seconds, planned_arrival_at, planned_departure_at
      )
      select p_tenant_id, v_plan.id, v_stop_key, 'appointment', v_index - 1,
        route_stop.appointment_id, location.latitude, location.longitude,
        shift.starts_at, shift.ends_at,
        greatest(60, extract(epoch from (shift.ends_at - shift.starts_at))::integer),
        (v_visit ->> 'startTime')::timestamptz,
        (v_visit ->> 'startTime')::timestamptz + (shift.ends_at - shift.starts_at)
      from public.provider_route_day_stops route_stop
      join public.nurse_appointment_route_locations location
        on location.tenant_id = route_stop.tenant_id and location.appointment_id = route_stop.appointment_id
        and location.invalidated_at is null and location.expires_at > clock_timestamp()
      join public.nurse_work_source_links source_link
        on source_link.tenant_id=route_stop.tenant_id
        and source_link.appointment_id=route_stop.appointment_id and source_link.status='active'
      join public.operational_shifts shift
        on shift.tenant_id=source_link.tenant_id and shift.id=source_link.shift_id
      where route_stop.tenant_id = p_tenant_id and route_stop.route_day_id = p_route_day_id
        and route_stop.id = substring(v_stop_key from 6)::uuid and route_stop.selected
      returning * into v_plan_stop;
    elsif left(v_stop_key,7)='pickup_' then
      insert into public.nurse_route_plan_stops (
        tenant_id, plan_version_id, stop_key, stop_type, sequence_number,
        pickup_task_id, latitude, longitude, window_starts_at, window_ends_at,
        service_duration_seconds, planned_arrival_at, planned_departure_at
      )
      select p_tenant_id, v_plan.id, v_stop_key, 'pickup', v_index - 1,
        pickup.id, location.latitude, location.longitude,
        pickup.window_starts_at, pickup.window_ends_at, 900,
        (v_visit ->> 'startTime')::timestamptz,
        (v_visit ->> 'startTime')::timestamptz + interval '15 minutes'
      from public.nurse_pickup_tasks pickup
      join public.nurse_inventory_location_route_locations location
        on location.tenant_id = pickup.tenant_id and location.inventory_location_id = pickup.location_id
        and location.invalidated_at is null and location.expires_at > clock_timestamp()
      where pickup.tenant_id = p_tenant_id and pickup.route_day_id = p_route_day_id
        and pickup.id = substring(v_stop_key from 8)::uuid
      returning * into v_plan_stop;
    else
      raise exception using errcode = 'P0001', message = 'route_stop_identifier_invalid';
    end if;
    if v_plan_stop.id is null then raise exception using errcode = 'P0001', message = 'route_stop_source_missing'; end if;
    v_transition := p_transitions -> (v_index - 1);
    insert into public.nurse_route_plan_legs (
      tenant_id, plan_version_id, leg_number, from_stop_id, to_stop_id,
      duration_seconds, distance_meters, planned_arrival_at
    ) values (
      p_tenant_id, v_plan.id, v_index - 1, v_from_stop_id, v_plan_stop.id,
      coalesce(nullif(regexp_replace(v_transition ->> 'travelDuration', '[^0-9]', '', 'g'), '')::integer, 0),
      coalesce((v_transition ->> 'travelDistanceMeters')::integer, 0),
      (v_visit ->> 'startTime')::timestamptz
    );
    v_from_stop_id := v_plan_stop.id;
  end loop;
  update public.nurse_route_plan_stops appointment_stop set predecessor_stop_id=(
    select pickup_stop.id
    from public.nurse_work_source_links source_link
    join public.nurse_pickup_tasks pickup
      on pickup.tenant_id=source_link.tenant_id and pickup.shift_id=source_link.shift_id
      and pickup.route_day_id=p_route_day_id and pickup.status not in ('completed','cancelled')
    join public.nurse_route_plan_stops pickup_stop
      on pickup_stop.tenant_id=pickup.tenant_id and pickup_stop.plan_version_id=v_plan.id
      and pickup_stop.pickup_task_id=pickup.id
    where source_link.tenant_id=p_tenant_id and source_link.status='active'
      and source_link.appointment_id=appointment_stop.appointment_id
    order by pickup.created_at,pickup.id limit 1
  ) where appointment_stop.tenant_id=p_tenant_id
    and appointment_stop.plan_version_id=v_plan.id
    and appointment_stop.stop_type='appointment';
  insert into public.nurse_route_plan_stop_dependencies(
    tenant_id,plan_version_id,predecessor_stop_id,dependent_stop_id
  )
  select p_tenant_id,v_plan.id,pickup_stop.id,appointment_stop.id
  from public.nurse_route_plan_stops appointment_stop
  join public.nurse_work_source_links source_link
    on source_link.tenant_id=appointment_stop.tenant_id
    and source_link.appointment_id=appointment_stop.appointment_id and source_link.status='active'
  join public.nurse_pickup_tasks pickup
    on pickup.tenant_id=source_link.tenant_id and pickup.shift_id=source_link.shift_id
    and pickup.route_day_id=p_route_day_id and pickup.status not in ('completed','cancelled')
  join public.nurse_route_plan_stops pickup_stop
    on pickup_stop.tenant_id=pickup.tenant_id and pickup_stop.plan_version_id=v_plan.id
    and pickup_stop.pickup_task_id=pickup.id
  where appointment_stop.tenant_id=p_tenant_id
    and appointment_stop.plan_version_id=v_plan.id
    and appointment_stop.stop_type='appointment';
  update public.provider_route_days set
    origin_kind = p_origin_kind, origin_id = null, origin_label = left(coalesce(p_origin_label, 'Current location'),120),
    origin_address = case when p_origin_kind = 'current' then null else p_origin_address end,
    origin_latitude = case when p_origin_kind = 'current' then null else p_origin_latitude end,
    origin_longitude = case when p_origin_kind = 'current' then null else p_origin_longitude end,
    current_plan_version_id = v_plan.id, status = 'feasible', version = version + 1
  where tenant_id = p_tenant_id and id = p_route_day_id returning * into v_day;
  update public.nurse_route_origin_consents set consumed_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_consent.id;
  if v_existing.id is null then
    insert into public.nurse_route_plan_requests (
      tenant_id, route_day_id, provider_profile_id, idempotency_key,
      request_hash, origin_kind, status, plan_version_id, completed_at
    ) values (
      p_tenant_id, p_route_day_id, p_provider_profile_id, p_idempotency_key,
      p_request_hash, p_origin_kind, 'persisted', v_plan.id, clock_timestamp()
    );
  else
    update public.nurse_route_plan_requests set status = 'persisted', plan_version_id = v_plan.id,
      completed_at = clock_timestamp(), failure_code = null
    where tenant_id = p_tenant_id and id = v_existing.id;
  end if;
  return jsonb_build_object('route_day_id', p_route_day_id, 'plan_version_id', v_plan.id, 'route_day_version', v_day.version, 'idempotent', false);
end;
$$;

create or replace function app_private.assert_nurse_marketplace_admin(
  p_tenant_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.tenant_id = p_tenant_id and profile.id = p_actor_profile_id
      and profile.status = 'active' and profile.role in ('ops_manager','admin','founder')
  ) then raise exception using errcode = '42501', message = 'nurse_marketplace_admin_required'; end if;
end;
$$;
revoke all on function app_private.assert_nurse_marketplace_admin(uuid,uuid) from public, anon, authenticated;

create or replace function public.prepare_nurse_offer_candidate_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_shift_version integer,
  p_approval_policy_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_terms_key text,
  p_engagement_model text,
  p_gross_pay_cents integer,
  p_hourly_rate_cents integer,
  p_currency text,
  p_estimated_work_minutes integer,
  p_estimated_travel_minutes integer,
  p_mileage_rate_cents integer,
  p_guaranteed_minimum_cents integer,
  p_cancellation_terms_code text,
  p_expense_policy_code text,
  p_expires_at timestamptz,
  p_wave_key text,
  p_cohort_key text
)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp
as $$
declare
  v_engagement_policy public.nurse_marketplace_policies%rowtype;
  v_existing public.nurse_offer_terms%rowtype;
  v_expiry_policy public.nurse_marketplace_policies%rowtype;
  v_max_minutes integer;
  v_policy public.nurse_marketplace_policies%rowtype;
  v_shift public.operational_shifts%rowtype;
  v_template jsonb;
  v_terms public.nurse_offer_terms%rowtype;
  v_wave_policy public.nurse_marketplace_policies%rowtype;
begin
  perform app_private.assert_nurse_marketplace_admin(p_tenant_id,p_actor_profile_id);
  if p_request_hash !~ '^[0-9a-f]{64}$' or nullif(trim(p_terms_key),'') is null
     or nullif(trim(p_wave_key),'') is null or nullif(trim(p_cohort_key),'') is null then
    raise exception using errcode='22023',message='offer_candidate_request_invalid';
  end if;
  if p_engagement_model<>'approved_contractor' then
    raise exception using errcode='P0001',message='w2_offer_candidate_prohibited';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text||':offer-terms:'||p_idempotency_key::text,0));
  select * into v_existing from public.nurse_offer_terms terms
  where terms.tenant_id=p_tenant_id and terms.request_idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>p_request_hash or v_existing.shift_id<>p_shift_id
       or v_existing.provider_profile_id<>p_provider_profile_id then
      raise exception using errcode='22023',message='offer_candidate_idempotency_conflict';
    end if;
    return jsonb_build_object('offer_terms_id',v_existing.id,'terms_hash',v_existing.terms_hash,
      'expires_at',v_existing.expires_at,'wave_key',p_wave_key,'cohort_key',p_cohort_key,
      'approval_policy_id',v_existing.approval_policy_id,'idempotent',true);
  end if;
  select * into v_shift from public.operational_shifts shift
  where shift.tenant_id=p_tenant_id and shift.id=p_shift_id for update;
  if not found or v_shift.status<>'open' then
    raise exception using errcode='P0001',message='open_shift_required';
  end if;
  if v_shift.version<>p_expected_shift_version then
    raise exception using errcode='40001',message='shift_version_conflict';
  end if;
  select * into v_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.id=p_approval_policy_id
    and policy.policy_type='offer_terms' and policy.status='approved'
    and policy.effective_at<=clock_timestamp() for share;
  if not found then raise exception using errcode='P0001',message='approved_offer_terms_policy_required'; end if;
  v_template:=v_policy.rules->'approved_terms'->p_terms_key;
  if v_template is null or jsonb_typeof(v_template)<>'object' then
    raise exception using errcode='P0001',message='approved_offer_terms_template_required';
  end if;
  if v_template<>jsonb_strip_nulls(jsonb_build_object(
    'engagement_model',p_engagement_model,
    'gross_pay_cents',p_gross_pay_cents,
    'hourly_rate_cents',p_hourly_rate_cents,
    'currency',p_currency,
    'estimated_work_minutes',p_estimated_work_minutes,
    'estimated_travel_minutes',p_estimated_travel_minutes,
    'mileage_rate_cents',p_mileage_rate_cents,
    'guaranteed_minimum_cents',p_guaranteed_minimum_cents,
    'cancellation_terms_code',p_cancellation_terms_code,
    'expense_policy_code',p_expense_policy_code
  )) then raise exception using errcode='P0001',message='offer_terms_not_policy_approved'; end if;
  select * into v_engagement_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='engagement'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
    and jsonb_typeof(policy.rules->'allowed_models')='array'
    and policy.rules->'allowed_models' ? p_engagement_model
  order by policy.version desc limit 1;
  if not found then raise exception using errcode='P0001',message='approved_engagement_policy_required'; end if;
  perform app_private.assert_nurse_offer_engagement(
    p_tenant_id,p_provider_profile_id,p_engagement_model);
  select * into v_wave_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='offer_wave'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
    and jsonb_typeof(policy.rules->'allowed_wave_keys')='array'
    and jsonb_typeof(policy.rules->'allowed_cohort_keys')='array'
    and policy.rules->'allowed_wave_keys' ? p_wave_key
    and policy.rules->'allowed_cohort_keys' ? p_cohort_key
  order by policy.version desc limit 1;
  if not found then raise exception using errcode='P0001',message='approved_offer_wave_required'; end if;
  select * into v_expiry_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='offer_expiry'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
  order by policy.version desc limit 1;
  v_max_minutes:=nullif(v_expiry_policy.rules->>'max_minutes','')::integer;
  if v_expiry_policy.id is null or v_max_minutes not between 1 and 10080
     or p_expires_at is null or p_expires_at<=clock_timestamp()
     or p_expires_at>clock_timestamp()+make_interval(mins=>v_max_minutes)
     or p_expires_at>v_shift.starts_at then
    raise exception using errcode='P0001',message='approved_offer_expiry_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text||':'||p_shift_id::text||':'||p_provider_profile_id::text||':terms',0));
  insert into public.nurse_offer_terms(
    tenant_id,shift_id,provider_profile_id,terms_version,status,engagement_model,
    gross_pay_cents,hourly_rate_cents,currency,estimated_work_minutes,
    estimated_travel_minutes,mileage_rate_cents,guaranteed_minimum_cents,
    cancellation_terms_code,expense_policy_code,created_by,expires_at,
    request_idempotency_key,request_hash,approval_policy_id
  ) values(
    p_tenant_id,p_shift_id,p_provider_profile_id,
    coalesce((select max(terms.terms_version)+1 from public.nurse_offer_terms terms
      where terms.tenant_id=p_tenant_id and terms.shift_id=p_shift_id
        and terms.provider_profile_id=p_provider_profile_id),1),
    'proposed',p_engagement_model,p_gross_pay_cents,p_hourly_rate_cents,lower(p_currency),
    p_estimated_work_minutes,p_estimated_travel_minutes,p_mileage_rate_cents,
    p_guaranteed_minimum_cents,p_cancellation_terms_code,p_expense_policy_code,
    p_actor_profile_id,p_expires_at,p_idempotency_key,p_request_hash,p_approval_policy_id
  ) returning * into v_terms;
  insert into public.nurse_marketplace_transitions(
    tenant_id,entity_type,entity_id,to_status,reason_code,actor_profile_id,
    correlation_id,metadata
  ) values(
    p_tenant_id,'shift',p_shift_id,'offer_terms_prepared','approved_offer_terms_policy',
    p_actor_profile_id,p_idempotency_key,jsonb_build_object(
      'offer_terms_id',v_terms.id,'terms_hash',v_terms.terms_hash,
      'offer_terms_policy_id',v_policy.id,'engagement_policy_id',v_engagement_policy.id,
      'wave_policy_id',v_wave_policy.id,'expiry_policy_id',v_expiry_policy.id,
      'wave_key',p_wave_key,'cohort_key',p_cohort_key));
  return jsonb_build_object('offer_terms_id',v_terms.id,'terms_hash',v_terms.terms_hash,
    'expires_at',v_terms.expires_at,'wave_key',p_wave_key,'cohort_key',p_cohort_key,
    'approval_policy_id',v_policy.id,'idempotent',false);
end;
$$;

create or replace function public.admin_release_nurse_route_v1(
  p_tenant_id uuid, p_actor_profile_id uuid, p_entity_id uuid,
  p_expected_version integer, p_idempotency_key uuid, p_action text, p_reason_code text
)
returns public.provider_route_days
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_day public.provider_route_days%rowtype;
  v_plan public.nurse_route_plan_versions%rowtype;
begin
  perform app_private.assert_nurse_marketplace_admin(p_tenant_id,p_actor_profile_id);
  if p_action <> 'release_route' then raise exception using errcode='22023', message='route_release_action_invalid'; end if;
  if exists (select 1 from public.nurse_route_release_history h where h.tenant_id=p_tenant_id and h.route_day_id=p_entity_id and h.idempotency_key=p_idempotency_key) then
    select * into v_day from public.provider_route_days where tenant_id=p_tenant_id and id=p_entity_id; return v_day;
  end if;
  select * into v_day from public.provider_route_days day
  where day.tenant_id=p_tenant_id and day.id=p_entity_id for update;
  if not found then raise exception using errcode='P0002', message='route_day_not_found'; end if;
  if v_day.version<>p_expected_version then raise exception using errcode='40001', message='route_day_version_conflict'; end if;
  if v_day.status<>'feasible' then raise exception using errcode='P0001', message='feasible_route_required'; end if;
  select * into v_plan from public.nurse_route_plan_versions plan
  where plan.tenant_id=p_tenant_id and plan.id=v_day.current_plan_version_id
    and plan.status='feasible' and plan.skipped_stop_count=0 and plan.validation_error_count=0 for update;
  if not found then raise exception using errcode='P0001', message='feasible_route_plan_required'; end if;
  if v_plan.constraint_evidence_hash<>
       encode(extensions.digest(v_plan.constraint_evidence::text,'sha256'),'hex')
     or coalesce((v_plan.constraint_evidence->>'stopCount')::integer,-1)<>v_plan.planned_stop_count
     or not exists(
       select 1 from public.nurse_marketplace_policies policy
       where policy.tenant_id=p_tenant_id and policy.id=v_plan.route_policy_id
         and policy.policy_type='route_release' and policy.status='approved'
         and policy.effective_at<=clock_timestamp()
         and encode(extensions.digest((policy.rules->'route_constraints')::text,'sha256'),'hex')=
           v_plan.constraints_hash
     ) then raise exception using errcode='P0001',message='current_route_constraint_evidence_required'; end if;
  if not exists (
    select 1 from public.nurse_marketplace_policies policy where policy.tenant_id=p_tenant_id
      and policy.policy_type='route_release' and policy.status='approved'
      and policy.effective_at<=clock_timestamp()
  ) then raise exception using errcode='P0001', message='approved_route_release_policy_required'; end if;
  if exists (
    select 1 from public.provider_route_day_stops stop
    join public.nurse_work_source_links source_link on source_link.tenant_id=stop.tenant_id
      and source_link.appointment_id=stop.appointment_id and source_link.status='active'
    join public.operational_shifts shift on shift.tenant_id=source_link.tenant_id and shift.id=source_link.shift_id
    where stop.tenant_id=p_tenant_id and stop.route_day_id=p_entity_id and stop.selected
      and not exists (
        select 1 from public.nurse_shift_readiness_snapshots readiness
        where readiness.tenant_id=shift.tenant_id and readiness.shift_id=shift.id
          and readiness.provider_profile_id=v_day.provider_profile_id
          and readiness.source_shift_version=shift.version
          and readiness.evaluation_stage='route_release' and readiness.overall_status='ready'
          and readiness.invalidated_at is null and readiness.expires_at>clock_timestamp()
      )
  ) then raise exception using errcode='P0001', message='fresh_route_release_readiness_required'; end if;
  update public.nurse_route_plan_versions set status='released',released_at=clock_timestamp(),released_by=p_actor_profile_id
  where tenant_id=p_tenant_id and id=v_plan.id;
  update public.provider_route_days set status='released',released_at=clock_timestamp(),released_by=p_actor_profile_id,
    release_reason_code=p_reason_code,version=version+1,current_plan_version_id=v_plan.id
  where tenant_id=p_tenant_id and id=p_entity_id returning * into v_day;
  insert into public.nurse_route_release_history(tenant_id,route_day_id,plan_version_id,provider_profile_id,
    from_status,to_status,action,reason_code,actor_profile_id,idempotency_key,route_day_version)
  values(p_tenant_id,p_entity_id,v_plan.id,v_day.provider_profile_id,'feasible','released','release',
    p_reason_code,p_actor_profile_id,p_idempotency_key,v_day.version);
  return v_day;
end;
$$;

create or replace function public.admin_recover_nurse_route_v1(
  p_tenant_id uuid, p_actor_profile_id uuid, p_entity_id uuid,
  p_expected_version integer, p_idempotency_key uuid, p_action text, p_reason_code text
)
returns public.provider_route_days
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_day public.provider_route_days%rowtype; v_from text;
begin
  perform app_private.assert_nurse_marketplace_admin(p_tenant_id,p_actor_profile_id);
  if p_action<>'recover_route' then raise exception using errcode='22023',message='route_recovery_action_invalid'; end if;
  if exists(select 1 from public.nurse_route_release_history h where h.tenant_id=p_tenant_id and h.route_day_id=p_entity_id and h.idempotency_key=p_idempotency_key) then
    select * into v_day from public.provider_route_days where tenant_id=p_tenant_id and id=p_entity_id; return v_day;
  end if;
  select * into v_day from public.provider_route_days where tenant_id=p_tenant_id and id=p_entity_id for update;
  if not found then raise exception using errcode='P0002',message='route_day_not_found'; end if;
  if v_day.version<>p_expected_version then raise exception using errcode='40001',message='route_day_version_conflict'; end if;
  if v_day.status not in ('released','acknowledged','active','paused','recovery_required') then raise exception using errcode='P0001',message='route_recovery_state_invalid'; end if;
  v_from:=v_day.status;
  update public.provider_route_days set status='recovery_required',release_reason_code=p_reason_code,version=version+1
  where tenant_id=p_tenant_id and id=p_entity_id returning * into v_day;
  insert into public.nurse_route_release_history(tenant_id,route_day_id,plan_version_id,provider_profile_id,
    from_status,to_status,action,reason_code,actor_profile_id,idempotency_key,route_day_version)
  values(p_tenant_id,p_entity_id,v_day.current_plan_version_id,v_day.provider_profile_id,v_from,'recovery_required',
    'require_recovery',p_reason_code,p_actor_profile_id,p_idempotency_key,v_day.version);
  return v_day;
end;
$$;

create or replace function app_private.transfer_nurse_pickup_reservation(
  p_tenant_id uuid,p_actor_profile_id uuid,p_provider_profile_id uuid,
  p_pickup_task_id uuid,p_reservation_id uuid,p_policy_id uuid,p_idempotency_key text
)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp
as $$
declare
  v_available numeric(14,3);
  v_destination_id uuid;
  v_has_positive_cost boolean;
  v_in public.os_stock_transactions%rowtype;
  v_out public.os_stock_transactions%rowtype;
  v_request_hash text;
  v_reservation public.nurse_inventory_reservations%rowtype;
  v_task public.nurse_pickup_tasks%rowtype;
  v_transfer_group_id uuid:=gen_random_uuid();
  v_unit_cost bigint;
begin
  select * into v_task from public.nurse_pickup_tasks task
  where task.tenant_id=p_tenant_id and task.id=p_pickup_task_id
    and task.provider_profile_id=p_provider_profile_id for share;
  if not found then raise exception using errcode='P0002',message='pickup_task_not_found'; end if;
  if not exists(select 1 from public.profiles profile
      where profile.tenant_id=p_tenant_id and profile.id=p_actor_profile_id
        and profile.status='active' and profile.role in ('admin','founder','ops_manager')) then
    perform app_private.assert_nurse_self(
      p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  end if;
  select * into v_reservation from public.nurse_inventory_reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.id=p_reservation_id
    and reservation.shift_id=v_task.shift_id
    and reservation.provider_profile_id=p_provider_profile_id
    and reservation.location_id=v_task.location_id and reservation.status='reserved'
    and reservation.expires_at>clock_timestamp() for update;
  if not found then raise exception using errcode='P0001',message='reserved_pickup_line_required'; end if;
  select assignment.location_id into v_destination_id
  from public.os_inventory_location_assignments assignment
  join public.os_inventory_locations location
    on location.tenant_id=assignment.tenant_id and location.id=assignment.location_id
  where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=p_provider_profile_id
    and assignment.assignment_status='accepted' and assignment.is_primary
    and location.location_type='nurse_kit' and location.status='active'
  for share of assignment,location;
  if v_destination_id is null then raise exception using errcode='P0001',message='active_nurse_kit_custody_required'; end if;
  v_request_hash:=encode(extensions.digest(jsonb_build_object(
    'task_id',v_task.id,'reservation_id',v_reservation.id,'actor',p_actor_profile_id,
    'provider',p_provider_profile_id,'from',v_task.location_id,'to',v_destination_id,
    'item',v_reservation.item_id,'variant',v_reservation.variant_id,'lot',v_reservation.lot_id,
    'quantity',v_reservation.quantity,'policy_id',p_policy_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'nurse_pickup_transfer:'||p_tenant_id::text||':'||p_idempotency_key,0));
  select * into v_out from public.os_stock_transactions movement
  where movement.tenant_id=p_tenant_id and movement.idempotency_key=p_idempotency_key||':out';
  if found then
    select * into v_in from public.os_stock_transactions movement
    where movement.tenant_id=p_tenant_id and movement.idempotency_key=p_idempotency_key||':in';
    if not found or v_out.operation_request_hash is distinct from v_request_hash
       or v_in.operation_request_hash is distinct from v_request_hash then
      raise exception using errcode='P0001',message='pickup_transfer_idempotency_conflict';
    end if;
    return jsonb_build_object('transferGroupId',v_out.transfer_group_id,
      'transferOutId',v_out.id,'transferInId',v_in.id,'idempotent',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_balance:'||p_tenant_id::text||':'||v_task.location_id::text||':'||
      v_reservation.item_id::text||':'||coalesce(v_reservation.variant_id::text,'-')||':'||
      coalesce(v_reservation.lot_id::text,'-'),0));
  select coalesce(sum(balance.quantity_on_hand),0) into v_available
  from public.os_inventory_location_balances balance
  where balance.tenant_id=p_tenant_id and balance.location_id=v_task.location_id
    and balance.item_id=v_reservation.item_id
    and balance.variant_id is not distinct from v_reservation.variant_id
    and balance.lot_id is not distinct from v_reservation.lot_id;
  if v_available<v_reservation.quantity then
    raise exception using errcode='P0001',message='inventory_transfer_insufficient_stock';
  end if;
  select case when v_reservation.lot_id is not null then coalesce(
      nullif(lot.unit_cost_cents,0),nullif(variant.unit_cost_cents,0),0) else 0 end
    into v_unit_cost
  from public.os_inventory_items item
  left join public.os_inventory_lots lot on lot.tenant_id=item.tenant_id
    and lot.id=v_reservation.lot_id and lot.item_id=item.id
  left join public.os_inventory_variants variant on variant.tenant_id=item.tenant_id
    and variant.id=coalesce(v_reservation.variant_id,lot.variant_id) and variant.item_id=item.id
  where item.tenant_id=p_tenant_id and item.id=v_reservation.item_id and item.archived_at is null;
  if not found then raise exception using errcode='P0002',message='inventory_item_not_found'; end if;
  if v_reservation.lot_id is null then
    v_has_positive_cost:=app_private.inventory_location_has_positive_cost(
      p_tenant_id,v_task.location_id,v_reservation.item_id,v_reservation.variant_id,null);
    if v_unit_cost>0 or v_has_positive_cost then
      raise exception using errcode='P0001',message='inventory_costed_stock_lot_required';
    end if;
  end if;
  insert into public.os_stock_transactions(
    tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,
    source_type,source_id,idempotency_key,occurred_at,created_by,from_location_id,
    transfer_group_id,operation_request_hash
  ) values(
    p_tenant_id,v_reservation.item_id,v_reservation.variant_id,v_reservation.lot_id,
    'transfer_out',-v_reservation.quantity,nullif(v_unit_cost,0),'nurse_pickup',v_task.id::text,
    p_idempotency_key||':out',clock_timestamp(),p_actor_profile_id,v_task.location_id,
    v_transfer_group_id,v_request_hash
  ) returning * into v_out;
  insert into public.os_stock_transactions(
    tenant_id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,
    source_type,source_id,idempotency_key,occurred_at,created_by,to_location_id,
    transfer_group_id,operation_request_hash
  ) values(
    p_tenant_id,v_reservation.item_id,v_reservation.variant_id,v_reservation.lot_id,
    'transfer_in',v_reservation.quantity,nullif(v_unit_cost,0),'nurse_pickup',v_task.id::text,
    p_idempotency_key||':in',clock_timestamp(),p_actor_profile_id,v_destination_id,
    v_transfer_group_id,v_request_hash
  ) returning * into v_in;
  insert into public.audit_events(
    tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload
  ) values(
    p_tenant_id,p_actor_profile_id,'nurse_pickup_custody_transferred',
    'os_stock_transactions',v_in.id,false,jsonb_build_object(
      'pickup_task_id',v_task.id,'reservation_id',v_reservation.id,
      'transfer_group_id',v_transfer_group_id,'from_location_id',v_task.location_id,
      'to_location_id',v_destination_id,'item_id',v_reservation.item_id,
      'quantity',v_reservation.quantity,'approval_policy_id',p_policy_id));
  return jsonb_build_object('transferGroupId',v_transfer_group_id,
    'transferOutId',v_out.id,'transferInId',v_in.id,'idempotent',false);
end;
$$;
revoke all on function app_private.transfer_nurse_pickup_reservation(uuid,uuid,uuid,uuid,uuid,uuid,text)
  from public,anon,authenticated,service_role;

create or replace function public.resolve_nurse_pickup_task_v1(
  p_tenant_id uuid, p_actor_profile_id uuid, p_entity_id uuid,
  p_expected_version integer, p_idempotency_key uuid, p_action text, p_reason_code text
)
returns public.nurse_pickup_tasks
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_task public.nurse_pickup_tasks%rowtype;
  v_hash text;
  v_destination_id uuid;
  v_policy public.nurse_marketplace_policies%rowtype;
  v_reservation public.nurse_inventory_reservations%rowtype;
begin
  if p_action not in ('resolve_pickup','nurse_complete_pickup') then raise exception using errcode='22023',message='pickup_action_invalid'; end if;
  if p_action='resolve_pickup' then
    raise exception using errcode='P0001',message='admin_pickup_custody_completion_prohibited';
  end if;
  select * into v_task from public.nurse_pickup_tasks task where task.tenant_id=p_tenant_id and task.id=p_entity_id for update;
  if not found then raise exception using errcode='P0002',message='pickup_task_not_found'; end if;
  perform app_private.assert_nurse_self(p_tenant_id,v_task.provider_profile_id,p_actor_profile_id);
  if v_task.status='completed' then return v_task; end if;
  if v_task.version<>p_expected_version then raise exception using errcode='40001',message='pickup_task_version_conflict'; end if;
  if v_task.status not in ('acknowledged','arrived') then raise exception using errcode='P0001',message='pickup_custody_confirmation_required'; end if;
  select assignment.location_id into v_destination_id
  from public.os_inventory_location_assignments assignment
  join public.os_inventory_locations location on location.tenant_id=assignment.tenant_id and location.id=assignment.location_id
  where assignment.tenant_id=p_tenant_id and assignment.provider_profile_id=v_task.provider_profile_id
    and assignment.assignment_status='accepted' and assignment.is_primary
    and location.location_type='nurse_kit' and location.status='active'
  for share of assignment,location;
  if v_destination_id is null then raise exception using errcode='P0001',message='active_nurse_kit_custody_required'; end if;
  select * into v_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='supply_manifest'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
  order by policy.version desc limit 1;
  if not found then raise exception using errcode='P0001',message='approved_supply_policy_required'; end if;
  if not exists(select 1 from public.nurse_inventory_reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.shift_id=v_task.shift_id
      and reservation.provider_profile_id=v_task.provider_profile_id and reservation.location_id=v_task.location_id
      and reservation.status='reserved' and reservation.expires_at>clock_timestamp()) then
    raise exception using errcode='P0001',message='reserved_pickup_lines_required';
  end if;
  for v_reservation in
    select * from public.nurse_inventory_reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.shift_id=v_task.shift_id
      and reservation.provider_profile_id=v_task.provider_profile_id and reservation.location_id=v_task.location_id
      and reservation.status='reserved' and reservation.expires_at>clock_timestamp()
    order by reservation.id for update
  loop
    if v_reservation.lot_id is not null and not exists(select 1 from public.os_inventory_lots lot
      where lot.tenant_id=p_tenant_id and lot.id=v_reservation.lot_id and lot.disposition_status='available'
        and (lot.expires_on is null or lot.expires_on>=current_date)
        and (not lot.temperature_controlled or lot.temperature_evidence_expires_at>clock_timestamp())
        and (not lot.calibration_required or lot.calibration_expires_at>clock_timestamp())) then
      raise exception using errcode='P0001',message='pickup_lot_evidence_stale';
    end if;
    perform app_private.transfer_nurse_pickup_reservation(
      p_tenant_id,p_actor_profile_id,v_task.provider_profile_id,p_entity_id,
      v_reservation.id,v_policy.id,
      'nurse-pickup:'||p_entity_id::text||':'||v_reservation.id::text||':'||p_idempotency_key::text);
    update public.nurse_inventory_reservations set status='consumed',version=version+1
    where tenant_id=p_tenant_id and id=v_reservation.id;
  end loop;
  v_hash:=encode(extensions.digest(jsonb_build_object('task_id',p_entity_id,'actor',p_actor_profile_id,
    'destination',v_destination_id,'reason',p_reason_code,'idempotency',p_idempotency_key)::text,'sha256'),'hex');
  update public.nurse_pickup_tasks set status='completed',completed_at=clock_timestamp(),evidence_hash=v_hash,version=version+1
  where tenant_id=p_tenant_id and id=p_entity_id returning * into v_task;
  update public.nurse_route_plan_legs leg set navigation_state='completed'
  from public.nurse_route_plan_stops stop
  where stop.tenant_id=p_tenant_id and stop.pickup_task_id=p_entity_id
    and leg.tenant_id=stop.tenant_id and leg.plan_version_id=stop.plan_version_id
    and leg.to_stop_id=stop.id and leg.navigation_state='arrived';
  update public.nurse_route_plan_legs next_leg set navigation_state='active'
  from public.nurse_route_plan_stops stop
  join public.nurse_route_plan_legs arrived_leg on arrived_leg.tenant_id=stop.tenant_id
    and arrived_leg.plan_version_id=stop.plan_version_id and arrived_leg.to_stop_id=stop.id
  where stop.tenant_id=p_tenant_id and stop.pickup_task_id=p_entity_id
    and next_leg.tenant_id=arrived_leg.tenant_id and next_leg.plan_version_id=arrived_leg.plan_version_id
    and next_leg.leg_number=arrived_leg.leg_number+1 and next_leg.navigation_state='pending';
  return v_task;
end;
$$;

create or replace function public.complete_nurse_pickup_task_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_pickup_task_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_lines jsonb,
  p_handoff_evidence jsonb,
  p_cold_chain_evidence jsonb
)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp
as $$
declare
  v_has_cold_chain boolean;
  v_policy public.nurse_marketplace_policies%rowtype;
  v_request_hash text;
  v_resolved public.nurse_pickup_tasks%rowtype;
  v_task public.nurse_pickup_tasks%rowtype;
  v_temperature numeric;
begin
  perform app_private.assert_nurse_self(
    p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  if jsonb_typeof(p_lines)<>'array' or jsonb_typeof(p_handoff_evidence)<>'object'
     or jsonb_typeof(p_cold_chain_evidence)<>'object'
     or coalesce((p_handoff_evidence->>'countConfirmed')::boolean,false) is not true
     or coalesce((p_handoff_evidence->>'handoffConfirmed')::boolean,false) is not true
     or coalesce(p_handoff_evidence->>'evidenceHash','') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='pickup_handoff_evidence_invalid';
  end if;
  v_request_hash:=encode(extensions.digest(concat_ws('|',p_pickup_task_id::text,
    p_idempotency_key::text,p_lines::text,p_handoff_evidence::text,p_cold_chain_evidence::text),
    'sha256'),'hex');
  select * into v_task from public.nurse_pickup_tasks task
  where task.tenant_id=p_tenant_id and task.id=p_pickup_task_id
    and task.provider_profile_id=p_provider_profile_id for update;
  if not found then raise exception using errcode='P0002',message='pickup_task_not_found'; end if;
  if v_task.status='completed' then
    if v_task.completion_idempotency_key=p_idempotency_key
       and v_task.completion_request_hash=v_request_hash then
      return jsonb_build_object('pickup_task_id',v_task.id,'status',v_task.status,
        'version',v_task.version,'evidence_hash',v_task.evidence_hash,'idempotent',true);
    end if;
    raise exception using errcode='P0001',message='pickup_completion_conflict';
  end if;
  if v_task.version<>p_expected_version then
    raise exception using errcode='40001',message='pickup_task_version_conflict';
  end if;
  if v_task.status<>'arrived' then
    raise exception using errcode='P0001',message='pickup_arrival_required';
  end if;
  if jsonb_array_length(p_lines)<>(select count(*)
      from public.nurse_inventory_reservations reservation
      where reservation.tenant_id=p_tenant_id and reservation.shift_id=v_task.shift_id
        and reservation.provider_profile_id=p_provider_profile_id
        and reservation.location_id=v_task.location_id and reservation.status='reserved'
        and reservation.expires_at>clock_timestamp())
     or (select count(*)<>count(distinct line->>'reservationId')
       from jsonb_array_elements(p_lines) line)
     or exists(
       select 1 from public.nurse_inventory_reservations reservation
       where reservation.tenant_id=p_tenant_id and reservation.shift_id=v_task.shift_id
         and reservation.provider_profile_id=p_provider_profile_id
         and reservation.location_id=v_task.location_id and reservation.status='reserved'
         and reservation.expires_at>clock_timestamp()
         and not exists(
           select 1 from jsonb_array_elements(p_lines) line
           where line->>'reservationId'=reservation.id::text
             and line->>'itemId'=reservation.item_id::text
             and nullif(line->>'variantId','') is not distinct from reservation.variant_id::text
             and nullif(line->>'lotId','') is not distinct from reservation.lot_id::text
             and nullif(line->>'quantity','')::numeric=reservation.quantity
             and coalesce((line->>'countVerified')::boolean,false)
         )
     ) or exists(
       select 1 from jsonb_array_elements(p_lines) line
       where not exists(
         select 1 from public.nurse_inventory_reservations reservation
         where reservation.tenant_id=p_tenant_id and reservation.id=(line->>'reservationId')::uuid
           and reservation.shift_id=v_task.shift_id
           and reservation.provider_profile_id=p_provider_profile_id
           and reservation.location_id=v_task.location_id and reservation.status='reserved'
           and reservation.expires_at>clock_timestamp()
       )
     ) then raise exception using errcode='P0001',message='pickup_exact_count_mismatch'; end if;
  select exists(
    select 1 from public.nurse_inventory_reservations reservation
    join public.os_inventory_lots lot
      on lot.tenant_id=reservation.tenant_id and lot.id=reservation.lot_id
    where reservation.tenant_id=p_tenant_id and reservation.shift_id=v_task.shift_id
      and reservation.provider_profile_id=p_provider_profile_id
      and reservation.location_id=v_task.location_id and reservation.status='reserved'
      and lot.temperature_controlled
  ) into v_has_cold_chain;
  select * into v_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='supply_manifest'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
    and coalesce((policy.rules->>'nurse_pickup_completion_enabled')::boolean,false)
  order by policy.version desc limit 1;
  if not found or not exists(select 1 from public.profiles profile
      where profile.tenant_id=p_tenant_id and profile.id=v_policy.approved_by
        and profile.status='active' and profile.role in ('admin','founder')) then
    raise exception using errcode='P0001',message='approved_nurse_pickup_policy_required';
  end if;
  if v_has_cold_chain then
    v_temperature:=nullif(p_cold_chain_evidence->>'temperatureC','')::numeric;
    if coalesce(p_cold_chain_evidence->>'evidenceHash','') !~ '^[0-9a-f]{64}$'
       or coalesce(nullif(p_cold_chain_evidence->>'recordedAt','')::timestamptz
          between clock_timestamp()-interval '30 minutes' and clock_timestamp()+interval '5 minutes',false) is not true
       or v_temperature is null
       or nullif(v_policy.rules->>'cold_chain_min_c','') is null
       or nullif(v_policy.rules->>'cold_chain_max_c','') is null
       or v_temperature<nullif(v_policy.rules->>'cold_chain_min_c','')::numeric
       or v_temperature>nullif(v_policy.rules->>'cold_chain_max_c','')::numeric then
      raise exception using errcode='P0001',message='pickup_cold_chain_evidence_invalid';
    end if;
  elsif coalesce((p_cold_chain_evidence->>'notRequired')::boolean,false) is not true then
    raise exception using errcode='P0001',message='pickup_cold_chain_not_required_attestation_required';
  end if;
  v_resolved:=public.resolve_nurse_pickup_task_v1(
    p_tenant_id,p_actor_profile_id,p_pickup_task_id,p_expected_version,
    p_idempotency_key,'nurse_complete_pickup','nurse_verified_handoff');
  update public.nurse_pickup_tasks set
    completion_idempotency_key=p_idempotency_key,
    completion_request_hash=v_request_hash,completed_by=p_actor_profile_id,
    handoff_evidence=jsonb_build_object('linesHash',encode(extensions.digest(p_lines::text,'sha256'),'hex'),
      'handoff',p_handoff_evidence,'coldChain',p_cold_chain_evidence),
    evidence_hash=v_request_hash,version=version+1
  where tenant_id=p_tenant_id and id=p_pickup_task_id returning * into v_task;
  insert into public.nurse_marketplace_jobs(
    tenant_id,job_type,idempotency_key,payload,status,available_at
  ) values(
    p_tenant_id,'readiness_evaluate',
    'pickup-complete:'||p_pickup_task_id::text||':'||p_idempotency_key::text,
    jsonb_build_object('shiftId',v_task.shift_id,'providerProfileId',p_provider_profile_id,
      'routeDayId',v_task.route_day_id,'stage','run_start'),
    'pending',clock_timestamp()
  ) on conflict(tenant_id,job_type,idempotency_key) do nothing;
  return jsonb_build_object('pickup_task_id',v_task.id,'status',v_task.status,
    'version',v_task.version,'evidence_hash',v_task.evidence_hash,
    'route_day_id',v_task.route_day_id,'readiness_recheck_enqueued',true,'idempotent',false);
end;
$$;

create or replace function public.report_nurse_pickup_mismatch_v1(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_provider_profile_id uuid,
  p_pickup_task_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_reason_code text,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp
as $$
declare
  v_day public.provider_route_days%rowtype;
  v_job public.nurse_marketplace_jobs%rowtype;
  v_lines_hash text;
  v_task public.nurse_pickup_tasks%rowtype;
begin
  perform app_private.assert_nurse_self(
    p_tenant_id,p_provider_profile_id,p_actor_profile_id);
  if p_reason_code not in ('count_mismatch','lot_mismatch','temperature_out_of_range',
      'handoff_refused','stock_missing','package_damaged','other_operational_mismatch')
     or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>200 then
    raise exception using errcode='22023',message='pickup_mismatch_report_invalid';
  end if;
  v_lines_hash:=encode(extensions.digest(p_lines::text,'sha256'),'hex');
  select * into v_task from public.nurse_pickup_tasks task
  where task.tenant_id=p_tenant_id and task.id=p_pickup_task_id
    and task.provider_profile_id=p_provider_profile_id for update;
  if not found then raise exception using errcode='P0002',message='pickup_task_not_found'; end if;
  if exists(select 1 from public.nurse_route_release_history history
    where history.tenant_id=p_tenant_id and history.route_day_id=v_task.route_day_id
      and history.idempotency_key=p_idempotency_key and history.action='require_recovery') then
    return jsonb_build_object('pickup_task_id',v_task.id,'status',v_task.status,
      'route_day_id',v_task.route_day_id,'recovery_required',true,'idempotent',true);
  end if;
  if v_task.version<>p_expected_version then
    raise exception using errcode='40001',message='pickup_task_version_conflict';
  end if;
  if v_task.status<>'arrived' or v_task.route_day_id is null then
    raise exception using errcode='P0001',message='arrived_pickup_task_required';
  end if;
  update public.nurse_pickup_tasks set status='blocked',version=version+1
  where tenant_id=p_tenant_id and id=p_pickup_task_id returning * into v_task;
  select * into v_day from public.provider_route_days day
  where day.tenant_id=p_tenant_id and day.id=v_task.route_day_id
    and day.provider_profile_id=p_provider_profile_id for update;
  if not found then raise exception using errcode='P0002',message='route_day_not_found'; end if;
  update public.provider_route_days set status='recovery_required',version=version+1,
    updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=v_day.id returning * into v_day;
  insert into public.nurse_route_release_history(
    tenant_id,route_day_id,plan_version_id,provider_profile_id,from_status,to_status,
    action,reason_code,actor_profile_id,idempotency_key,route_day_version
  ) values(
    p_tenant_id,v_day.id,v_day.current_plan_version_id,p_provider_profile_id,
    'active','recovery_required','require_recovery',p_reason_code,
    p_actor_profile_id,p_idempotency_key,v_day.version
  );
  insert into public.nurse_marketplace_transitions(
    tenant_id,entity_type,entity_id,from_status,to_status,reason_code,
    actor_profile_id,correlation_id,metadata
  ) values(
    p_tenant_id,'pickup_task',v_task.id,'arrived','blocked',p_reason_code,
    p_actor_profile_id,p_idempotency_key,jsonb_build_object(
      'lines_hash',v_lines_hash,'line_count',jsonb_array_length(p_lines),
      'owner_roles',jsonb_build_array('inventory','dispatch'),'route_day_id',v_day.id)
  );
  insert into public.nurse_marketplace_jobs(
    tenant_id,job_type,idempotency_key,payload,status,available_at,attempts,last_error_code
  ) values(
    p_tenant_id,'pickup_exception_recovery','pickup-mismatch:'||p_idempotency_key::text,
    jsonb_build_object('pickupTaskId',v_task.id,'routeDayId',v_day.id,
      'providerProfileId',p_provider_profile_id,'reasonCode',p_reason_code,
      'linesHash',v_lines_hash,'ownerRoles',jsonb_build_array('inventory','dispatch')),
    'dead_letter',clock_timestamp(),1,p_reason_code
  ) on conflict(tenant_id,job_type,idempotency_key) do update set
    last_error_code=excluded.last_error_code
  returning * into v_job;
  insert into public.nurse_marketplace_dead_letters(
    tenant_id,job_id,job_type,idempotency_key,payload,error_code,attempts
  ) values(
    p_tenant_id,v_job.id,v_job.job_type,v_job.idempotency_key,v_job.payload,p_reason_code,1
  ) on conflict(tenant_id,job_id) do nothing;
  insert into public.audit_events(
    tenant_id,actor_profile_id,action,entity_type,entity_id,phi_touched,payload_hash,payload
  ) values(
    p_tenant_id,p_actor_profile_id,'nurse_pickup_mismatch_reported','nurse_pickup_tasks',
    v_task.id,false,v_lines_hash,jsonb_build_object('reason_code',p_reason_code,
      'lines_hash',v_lines_hash,'route_day_id',v_day.id,
      'owner_roles',jsonb_build_array('inventory','dispatch'))
  );
  return jsonb_build_object('pickup_task_id',v_task.id,'status','blocked',
    'version',v_task.version,'route_day_id',v_day.id,'route_day_version',v_day.version,
    'recovery_required',true,'owner_roles',jsonb_build_array('inventory','dispatch'),
    'dead_letter_id',v_job.id,'idempotent',false);
end;
$$;

create or replace function public.recheck_nurse_inventory_v1(
  p_tenant_id uuid, p_actor_profile_id uuid, p_entity_id uuid,
  p_expected_version integer, p_idempotency_key uuid, p_action text, p_reason_code text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_shift public.operational_shifts%rowtype; v_state text;
begin
  perform app_private.assert_nurse_marketplace_admin(p_tenant_id,p_actor_profile_id);
  if p_action<>'recheck_inventory' then raise exception using errcode='22023',message='inventory_recheck_action_invalid'; end if;
  select * into v_shift from public.operational_shifts where tenant_id=p_tenant_id and id=p_entity_id for share;
  if not found then raise exception using errcode='P0002',message='shift_not_found'; end if;
  if v_shift.version<>p_expected_version then raise exception using errcode='40001',message='shift_version_conflict'; end if;
  v_state:=case
    when not exists(select 1 from public.nurse_shift_supply_requirements pinned where pinned.tenant_id=p_tenant_id and pinned.shift_id=p_entity_id and pinned.invalidated_at is null) then 'unserviceable'
    when exists(select 1 from public.nurse_inventory_reservations r where r.tenant_id=p_tenant_id and r.shift_id=p_entity_id and r.status='reserved' and r.expires_at<=clock_timestamp()) then 'evidence_stale'
    when exists(select 1 from public.nurse_pickup_tasks p where p.tenant_id=p_tenant_id and p.shift_id=p_entity_id and p.status not in ('completed','cancelled')) then 'pickup_required'
    when exists(select 1 from public.nurse_inventory_reservations r where r.tenant_id=p_tenant_id and r.shift_id=p_entity_id and r.status='reserved' and r.expires_at>clock_timestamp()) then 'kit_ready'
    else 'unserviceable' end;
  return jsonb_build_object('shift_id',p_entity_id,'inventory_state',v_state,'checked_at',clock_timestamp(),
    'correlation_id',p_idempotency_key,'reason_code',p_reason_code);
end;
$$;

create or replace function public.transition_nurse_guide_version_v1(
  p_tenant_id uuid, p_actor_profile_id uuid, p_entity_id uuid,
  p_expected_version integer, p_idempotency_key uuid, p_action text, p_reason_code text
)
returns public.shift_guide_versions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_guide public.shift_guide_versions%rowtype; v_next text;
begin
  perform app_private.assert_nurse_marketplace_admin(p_tenant_id,p_actor_profile_id);
  if exists(select 1 from public.nurse_guide_publication_history h where h.tenant_id=p_tenant_id and h.guide_version_id=p_entity_id and h.idempotency_key=p_idempotency_key) then
    select * into v_guide from public.shift_guide_versions where tenant_id=p_tenant_id and id=p_entity_id; return v_guide;
  end if;
  select * into v_guide from public.shift_guide_versions guide where guide.tenant_id=p_tenant_id and guide.id=p_entity_id for update;
  if not found then raise exception using errcode='P0002',message='guide_version_not_found'; end if;
  if v_guide.version<>p_expected_version then raise exception using errcode='40001',message='guide_version_conflict'; end if;
  if v_guide.content_hash is null then raise exception using errcode='P0001',message='guide_content_hash_required'; end if;
  v_next:=case
    when p_action='submit_clinical_review' and v_guide.publication_status='draft' then
      case when v_guide.medical_director_approval_required then 'medical_director_approval' else 'clinical_review' end
    when p_action='publish' and v_guide.publication_status in ('clinical_review','medical_director_approval') then 'published'
    when p_action='retire' and v_guide.publication_status='published' then 'retired'
    else null end;
  if v_next is null then raise exception using errcode='P0001',message='guide_publication_transition_invalid'; end if;
  if p_action in ('submit_clinical_review','publish') and not exists(
    select 1 from public.provider_profiles provider where provider.tenant_id=p_tenant_id
      and provider.profile_id=p_actor_profile_id and provider.active and provider.credential_status='clear'
  ) then raise exception using errcode='42501',message='clinical_reviewer_required'; end if;
  if p_action='publish' and v_guide.medical_director_approval_required and not exists(
    select 1 from public.provider_profiles provider where provider.tenant_id=p_tenant_id
      and provider.profile_id=p_actor_profile_id and provider.active and provider.provider_role='medical_director'
      and provider.credential_status='clear'
  ) then raise exception using errcode='42501',message='medical_director_approval_required'; end if;
  update public.shift_guide_versions set publication_status=v_next,
    clinical_reviewed_by=case when p_action='submit_clinical_review' then p_actor_profile_id else clinical_reviewed_by end,
    clinical_reviewed_at=case when p_action='submit_clinical_review' then clock_timestamp() else clinical_reviewed_at end,
    medical_director_approved_by=case when p_action='publish' and medical_director_approval_required then p_actor_profile_id else medical_director_approved_by end,
    medical_director_approved_at=case when p_action='publish' and medical_director_approval_required then clock_timestamp() else medical_director_approved_at end,
    published_by=case when p_action='publish' then p_actor_profile_id else published_by end,
    published_at=case when p_action='publish' then clock_timestamp() else published_at end,
    retired_at=case when p_action='retire' then clock_timestamp() else retired_at end
  where tenant_id=p_tenant_id and id=p_entity_id returning * into v_guide;
  insert into public.nurse_guide_publication_history(tenant_id,guide_version_id,from_status,to_status,
    content_hash,actor_profile_id,reason_code,idempotency_key)
  values(p_tenant_id,p_entity_id,null,v_next,v_guide.content_hash,p_actor_profile_id,p_reason_code,p_idempotency_key);
  return v_guide;
end;
$$;

-- Worker handlers remain policy-driven. They never invent clinical readiness,
-- appointment mappings, terms, cohorts, or recipients.
create or replace function public.reconcile_nurse_appointment_event_v1(
  p_tenant_id uuid, p_job_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_appointment public.appointments%rowtype;
  v_duration_minutes integer;
  v_event public.nurse_appointment_source_events%rowtype;
  v_last_event_occurred_at timestamptz;
  v_link public.nurse_work_source_links%rowtype;
  v_manifest public.nurse_supply_manifest_versions%rowtype;
  v_mapping jsonb;
  v_policy public.nurse_marketplace_policies%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  select event.* into v_event from public.nurse_appointment_source_events event
  where event.tenant_id=p_tenant_id and event.id=nullif(p_payload->>'event_id','')::uuid for update;
  if not found then raise exception using errcode='P0002',message='appointment_source_event_required'; end if;
  select * into v_policy from public.nurse_marketplace_policies policy where policy.tenant_id=p_tenant_id
    and policy.policy_type='appointment_mapping' and policy.status='approved'
    and policy.effective_at<=clock_timestamp() order by policy.version desc limit 1;
  if not found then
    raise exception using errcode='P0001',message='approved_appointment_mapping_policy_required';
  end if;
  select * into v_link from public.nurse_work_source_links link
  where link.tenant_id=p_tenant_id and link.source_provider=v_event.source_provider
    and link.source_appointment_id=v_event.source_appointment_id for update;
  if found then
    select previous.event_occurred_at into v_last_event_occurred_at
    from public.nurse_appointment_source_events previous
    where previous.tenant_id=p_tenant_id and previous.id=v_link.last_source_event_id;
    if v_event.event_occurred_at is not null and v_last_event_occurred_at is not null
      and v_event.event_occurred_at<v_last_event_occurred_at then
      update public.nurse_appointment_source_events set status='ignored',processed_at=clock_timestamp(),failure_code='older_source_revision'
      where tenant_id=p_tenant_id and id=v_event.id;
      return jsonb_build_object('source_event_id',v_event.id,'status','ignored_older_revision');
    end if;
  end if;
  if v_event.event_type='cancelled' and v_link.id is not null then
    if exists(
      select 1 from public.operational_shift_assignments assignment
      where assignment.tenant_id=p_tenant_id and assignment.shift_id=v_link.shift_id
        and assignment.status in ('claimed','assigned')
    ) then
      raise exception using errcode='P0001',
        message='assigned_source_cancellation_requires_human_review';
    end if;
    update public.operational_shifts set status='cancelled',version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_link.shift_id returning * into v_shift;
    update public.operational_shift_assignments set status='cancelled',updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and shift_id=v_link.shift_id and status not in ('completed','cancelled');
    update public.nurse_shift_offers set status='revoked',revoked_at=clock_timestamp(),
      revocation_code='source_cancelled',version=version+1
    where tenant_id=p_tenant_id and shift_id=v_link.shift_id and status in ('pending','offered','delivered','viewed');
    update public.nurse_inventory_reservations set status='released',released_at=clock_timestamp(),
      release_code='source_cancelled',version=version+1
    where tenant_id=p_tenant_id and shift_id=v_link.shift_id and status in ('prepared','reserved');
    update public.nurse_work_source_links set status='cancelled',last_source_event_id=v_event.id,
      last_source_revision=v_event.source_revision where tenant_id=p_tenant_id and id=v_link.id;
    update public.nurse_appointment_source_events set status='processed',processed_at=clock_timestamp(),failure_code=null
    where tenant_id=p_tenant_id and id=v_event.id;
    return jsonb_build_object('source_event_id',v_event.id,'shift_id',v_link.shift_id,'status','cancelled');
  end if;
  if v_event.event_type='cancelled' then
    -- A cancellation for work that was never admitted must not manufacture a
    -- shift merely to cancel it. Retain the verified source fact for audit.
    update public.nurse_appointment_source_events set
      status='ignored',processed_at=clock_timestamp(),failure_code='no_active_source_link'
    where tenant_id=p_tenant_id and id=v_event.id;
    return jsonb_build_object('source_event_id',v_event.id,'status','ignored_unlinked_cancellation');
  end if;
  select * into v_appointment from public.appointments appointment where appointment.tenant_id=p_tenant_id
    and appointment.acuity_appointment_id=v_event.source_appointment_id for share;
  if not found or v_appointment.service_mode<>'mobile' then
    raise exception using errcode='P0001',message='mobile_appointment_required';
  end if;
  if v_event.event_type='changed' and coalesce(v_policy.rules->>'raw_changed_mode','')<>'reconcile_canonical' then
    raise exception using errcode='P0001',message='changed_mapping_policy_required';
  end if;
  v_mapping:=v_policy.rules->'protocols'->v_appointment.protocol_key;
  if v_mapping is null or jsonb_typeof(v_mapping)<>'object'
    or coalesce((v_mapping->>'mobile_enabled')::boolean,false) is not true then
    raise exception using errcode='P0001',message='appointment_protocol_mapping_required';
  end if;
  v_duration_minutes:=nullif(v_mapping->>'duration_minutes','')::integer;
  if v_appointment.starts_at is null or v_duration_minutes not between 1 and 1440
    or nullif(trim(v_mapping->>'role_required'),'') is null
    or nullif(trim(v_mapping->>'manifest_key'),'') is null then
    raise exception using errcode='P0001',message='appointment_mapping_incomplete';
  end if;
  select version.* into v_manifest
  from public.nurse_supply_manifests manifest
  join public.nurse_supply_manifest_versions version
    on version.tenant_id=manifest.tenant_id and version.manifest_id=manifest.id
  where manifest.tenant_id=p_tenant_id and manifest.manifest_key=v_mapping->>'manifest_key'
    and manifest.active and version.status='approved'
  order by version.version desc limit 1;
  if not found then raise exception using errcode='P0001',message='approved_supply_manifest_required'; end if;
  if not exists(
    select 1 from public.shift_guide_templates template
    join public.shift_guide_versions guide on guide.tenant_id=template.tenant_id and guide.template_id=template.id
    where template.tenant_id=p_tenant_id and template.active and template.work_kind='mobile_appointment'
      and lower(trim(template.protocol_key))=lower(trim(v_appointment.protocol_key))
      and guide.publication_status='published'
  ) then raise exception using errcode='P0001',message='published_appointment_guide_required'; end if;
  if lower(coalesce(v_appointment.gfe_status,'')) not in
      ('approved','clear','cleared','complete','completed','not_required') then
    raise exception using errcode='P0001',message='gfe_not_ready';
  end if;
  if lower(coalesce(v_appointment.payment_status,'')) not in
      ('authorized','captured','paid','deposit_paid','succeeded','not_required','waived','complete','completed') then
    raise exception using errcode='P0001',message='patient_payment_not_ready';
  end if;
  if v_appointment.patient_person_id is not null and exists(
    select 1 from public.do_not_treat_flags flag
    where flag.tenant_id=p_tenant_id and flag.patient_person_id=v_appointment.patient_person_id
      and flag.active and flag.resolved_at is null
  ) then raise exception using errcode='P0001',message='active_safety_hold'; end if;
  if v_link.id is null then
    insert into public.operational_shifts(tenant_id,appointment_id,title,starts_at,ends_at,timezone,
      role_required,status,created_by)
    values(p_tenant_id,v_appointment.id,'Mobile clinical appointment',v_appointment.starts_at,
      v_appointment.starts_at+make_interval(mins=>v_duration_minutes),
      coalesce(nullif(v_mapping->>'timezone',''),'America/Los_Angeles'),v_mapping->>'role_required','draft',v_policy.approved_by)
    returning * into v_shift;
    insert into public.nurse_work_source_links(tenant_id,source_provider,source_appointment_id,
      appointment_id,shift_id,last_source_event_id,last_source_revision,status)
    values(p_tenant_id,v_event.source_provider,v_event.source_appointment_id,v_appointment.id,v_shift.id,
      v_event.id,v_event.source_revision,'active') returning * into v_link;
  else
    if exists(
      select 1 from public.operational_shift_assignments assignment
      where assignment.tenant_id=p_tenant_id and assignment.shift_id=v_link.shift_id
        and assignment.status in ('claimed','assigned')
    ) or exists(
      select 1 from public.operational_shifts shift
      where shift.tenant_id=p_tenant_id and shift.id=v_link.shift_id
        and shift.status in ('assigned','in_progress')
    ) then
      raise exception using errcode='P0001',
        message='assigned_source_revision_requires_material_amendment';
    end if;
    update public.operational_shifts set starts_at=v_appointment.starts_at,
      ends_at=v_appointment.starts_at+make_interval(mins=>v_duration_minutes),
      timezone=coalesce(nullif(v_mapping->>'timezone',''),'America/Los_Angeles'),
      role_required=v_mapping->>'role_required',status='draft',version=version+1,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_link.shift_id and status not in ('completed','cancelled')
    returning * into v_shift;
    if not found then raise exception using errcode='P0001',message='closed_shift_revision_prohibited'; end if;
    update public.nurse_shift_readiness_snapshots set invalidated_at=coalesce(invalidated_at,clock_timestamp()),
      invalidation_reason=coalesce(invalidation_reason,'source_revised')
    where tenant_id=p_tenant_id and shift_id=v_link.shift_id and invalidated_at is null;
    update public.nurse_shift_offers set status='revoked',revoked_at=clock_timestamp(),
      revocation_code='source_revised',version=version+1
    where tenant_id=p_tenant_id and shift_id=v_link.shift_id and status in ('pending','offered','delivered','viewed');
    update public.nurse_work_source_links set status='active',last_source_event_id=v_event.id,
      last_source_revision=v_event.source_revision where tenant_id=p_tenant_id and id=v_link.id;
  end if;
  update public.nurse_shift_supply_requirements set invalidated_at=clock_timestamp(),invalidation_code='source_revised'
  where tenant_id=p_tenant_id and shift_id=v_shift.id and invalidated_at is null
    and manifest_version_id<>v_manifest.id;
  insert into public.nurse_shift_supply_requirements(
    tenant_id,shift_id,manifest_version_id,requirements_hash,pinned_by
  ) select p_tenant_id,v_shift.id,v_manifest.id,
      coalesce(v_manifest.requirements_hash,v_manifest.content_hash),v_policy.approved_by
  where not exists(select 1 from public.nurse_shift_supply_requirements pinned
    where pinned.tenant_id=p_tenant_id and pinned.shift_id=v_shift.id and pinned.invalidated_at is null);
  -- Admission to OPEN is the explicit result of canonical appointment, patient,
  -- guide, and manifest checks above. Provider-specific readiness is still
  -- evaluated separately before any offer is issued.
  update public.operational_shifts set status='open',version=version+1,updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=v_shift.id and status='draft'
  returning * into v_shift;
  if not found then raise exception using errcode='P0001',message='shift_activation_failed'; end if;
  insert into public.nurse_marketplace_transitions(
    tenant_id,entity_type,entity_id,from_status,to_status,reason_code,
    actor_profile_id,correlation_id,metadata
  ) values(
    p_tenant_id,'shift',v_shift.id,'draft','open','canonical_appointment_admitted',
    v_policy.approved_by,v_event.id,
    jsonb_build_object('source_event_id',v_event.id,'source_revision',v_event.source_revision,
      'manifest_version_id',v_manifest.id,'shift_version',v_shift.version)
  );
  update public.nurse_appointment_source_events set status='processed',processed_at=clock_timestamp(),
    lease_owner=null,lease_expires_at=null
  where tenant_id=p_tenant_id and id=v_event.id;
  return jsonb_build_object('source_event_id',v_event.id,'appointment_id',v_appointment.id,
    'shift_id',v_shift.id,'status',case when v_link.created_at=v_link.updated_at then 'created' else 'revised' end);
end;
$$;

create or replace function public.evaluate_nurse_marketplace_readiness_v1(
  p_tenant_id uuid, p_job_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- The canonical evaluator is the authenticated server evaluator because it
  -- joins credential, patient, scheduling, inventory, route, and policy truth.
  -- A SQL worker cannot self-clear those domains.
  raise exception using errcode='P0001',message='canonical_server_readiness_evaluator_required';
end;
$$;

create or replace function public.distribute_nurse_shift_offers_v1(
  p_tenant_id uuid, p_job_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_available numeric(14,3);
  v_candidate record;
  v_committed numeric(14,3);
  v_count integer:=0;
  v_item jsonb;
  v_kit_location_id uuid;
  v_offer public.nurse_shift_offers%rowtype;
  v_offer_expires_at timestamptz;
  v_policy public.nurse_marketplace_policies%rowtype;
  v_remaining numeric(14,3);
  v_requirement record;
  v_shift public.operational_shifts%rowtype;
  v_terms public.nurse_offer_terms%rowtype;
begin
  select * into v_policy from public.nurse_marketplace_policies policy
  where policy.tenant_id=p_tenant_id and policy.policy_type='offer_wave'
    and policy.status='approved' and policy.effective_at<=clock_timestamp()
  order by policy.version desc limit 1;
  if not found then
    raise exception using errcode='P0001',message='approved_offer_wave_policy_required';
  end if;
  if jsonb_typeof(v_policy.rules->'allowed_wave_keys')<>'array'
     or jsonb_typeof(v_policy.rules->'allowed_cohort_keys')<>'array'
     or jsonb_typeof(v_policy.rules->'pickup_location_ids')<>'array' then
    raise exception using errcode='P0001',message='offer_wave_inventory_policy_incomplete';
  end if;
  if jsonb_typeof(p_payload->'offers')<>'array'
     or jsonb_array_length(p_payload->'offers')=0 then
    raise exception using errcode='22023',message='approved_offer_candidates_required';
  end if;
  for v_item in select value from jsonb_array_elements(p_payload->'offers') value loop
    if nullif(trim(v_item->>'wave_key'),'') is null
       or not (v_policy.rules->'allowed_wave_keys' ? (v_item->>'wave_key'))
       or nullif(trim(v_item->>'cohort_key'),'') is null
       or not (v_policy.rules->'allowed_cohort_keys' ? (v_item->>'cohort_key')) then
      raise exception using errcode='P0001',message='offer_wave_or_cohort_not_approved';
    end if;
    select * into v_shift from public.operational_shifts shift
    where shift.tenant_id=p_tenant_id and shift.id=(v_item->>'shift_id')::uuid
    for update;
    if not found or v_shift.status<>'open' then
      raise exception using errcode='P0001',message='open_shift_required';
    end if;
    select * into v_terms from public.nurse_offer_terms terms
    where terms.tenant_id=p_tenant_id and terms.id=(v_item->>'offer_terms_id')::uuid
      and terms.shift_id=v_shift.id
      and terms.provider_profile_id=(v_item->>'provider_profile_id')::uuid
    for share;
    if not found or v_terms.status<>'proposed' or v_terms.expires_at<=clock_timestamp()
       or v_terms.terms_hash is null
       or v_terms.terms_hash<>app_private.nurse_offer_terms_hash(v_terms) then
      raise exception using errcode='P0001',message='canonical_proposed_offer_terms_required';
    end if;
    if v_terms.engagement_model<>'approved_contractor' then
      raise exception using errcode='P0001',message='w2_offer_distribution_prohibited';
    end if;
    v_offer_expires_at:=(v_item->>'expires_at')::timestamptz;
    if v_offer_expires_at is null or v_offer_expires_at<=clock_timestamp()
       or v_offer_expires_at>v_terms.expires_at then
      raise exception using errcode='P0001',message='offer_expiry_invalid';
    end if;
    if not exists(
      select 1 from public.nurse_shift_readiness_snapshots readiness
      where readiness.tenant_id=p_tenant_id and readiness.id=(v_item->>'readiness_snapshot_id')::uuid
        and readiness.shift_id=(v_item->>'shift_id')::uuid
        and readiness.provider_profile_id=(v_item->>'provider_profile_id')::uuid
        and readiness.evaluation_stage='offer' and readiness.overall_status='ready'
        and readiness.claim_allowed and readiness.source_shift_version=v_shift.version
        and readiness.invalidated_at is null and readiness.expires_at>clock_timestamp()
    ) then raise exception using errcode='P0001',message='fresh_offer_readiness_required'; end if;
    if not exists(
      select 1 from public.nurse_shift_supply_requirements pinned
      join public.nurse_supply_manifest_versions manifest
        on manifest.tenant_id=pinned.tenant_id and manifest.id=pinned.manifest_version_id
      where pinned.tenant_id=p_tenant_id and pinned.shift_id=v_shift.id
        and pinned.invalidated_at is null and manifest.status='approved'
    ) then raise exception using errcode='P0001',message='approved_supply_manifest_required'; end if;
    if not exists(
      select 1 from public.appointments appointment
      join public.shift_guide_templates template on template.tenant_id=appointment.tenant_id
        and template.active and template.work_kind='mobile_appointment'
        and lower(trim(template.protocol_key))=lower(trim(appointment.protocol_key))
      join public.shift_guide_versions guide on guide.tenant_id=template.tenant_id
        and guide.template_id=template.id and guide.publication_status='published'
      where appointment.tenant_id=p_tenant_id and appointment.id=v_shift.appointment_id
    ) then raise exception using errcode='P0001',message='published_appointment_guide_required'; end if;
    select assignment.location_id into v_kit_location_id
    from public.os_inventory_location_assignments assignment
    join public.os_inventory_locations location
      on location.tenant_id=assignment.tenant_id and location.id=assignment.location_id
    where assignment.tenant_id=p_tenant_id
      and assignment.provider_profile_id=v_terms.provider_profile_id
      and assignment.assignment_status='accepted' and assignment.is_primary
      and location.location_type='nurse_kit' and location.status='active'
    for share of assignment,location;
    if v_kit_location_id is null then
      raise exception using errcode='P0001',message='accepted_nurse_kit_required';
    end if;
    insert into public.nurse_shift_offers(tenant_id,shift_id,provider_profile_id,offer_terms_id,
      readiness_snapshot_id,wave_key,cohort_key,status,expires_at,created_by)
    values(p_tenant_id,(v_item->>'shift_id')::uuid,(v_item->>'provider_profile_id')::uuid,
      (v_item->>'offer_terms_id')::uuid,(v_item->>'readiness_snapshot_id')::uuid,
      v_item->>'wave_key',v_item->>'cohort_key','offered',v_offer_expires_at,v_policy.approved_by)
    on conflict (tenant_id,shift_id,provider_profile_id,offer_terms_id) do nothing returning * into v_offer;
    if found then
      for v_requirement in
        select requirement.*
        from public.nurse_shift_supply_requirements pinned
        join public.nurse_supply_manifest_requirements requirement
          on requirement.tenant_id=pinned.tenant_id
          and requirement.manifest_version_id=pinned.manifest_version_id
        where pinned.tenant_id=p_tenant_id and pinned.shift_id=v_shift.id
          and pinned.invalidated_at is null
        order by requirement.sort_order,requirement.id
      loop
        v_remaining:=v_requirement.quantity;
        for v_candidate in
          select balance.location_id,balance.item_id,balance.variant_id,balance.lot_id,
            balance.quantity_on_hand,lot.expires_on
          from public.os_inventory_location_balances balance
          join public.os_inventory_locations location
            on location.tenant_id=balance.tenant_id and location.id=balance.location_id
            and location.status='active'
          left join public.os_inventory_lots lot
            on lot.tenant_id=balance.tenant_id and lot.id=balance.lot_id
          where balance.tenant_id=p_tenant_id and balance.item_id=v_requirement.item_id
            and balance.variant_id is not distinct from v_requirement.variant_id
            and balance.quantity_on_hand>0
            and (balance.location_id=v_kit_location_id or (
              v_requirement.pickup_allowed
              and v_policy.rules->'pickup_location_ids' ? balance.location_id::text
              and exists(select 1 from public.nurse_inventory_location_route_locations evidence
                where evidence.tenant_id=p_tenant_id
                  and evidence.inventory_location_id=balance.location_id
                  and evidence.invalidated_at is null and evidence.expires_at>clock_timestamp())
            ))
            and (not v_requirement.lot_required or balance.lot_id is not null)
            and (balance.lot_id is null or (
              lot.disposition_status='available'
              and (lot.expires_on is null or lot.expires_on>=current_date)
              and (not v_requirement.temperature_evidence_required
                or (lot.temperature_controlled and lot.temperature_evidence_expires_at>clock_timestamp()))
              and (not v_requirement.calibration_evidence_required
                or (lot.calibration_required and lot.calibration_expires_at>clock_timestamp()))
            ))
          order by (balance.location_id=v_kit_location_id) desc,lot.expires_on nulls last,
            balance.location_id,balance.lot_id
        loop
          exit when v_remaining<=0;
          perform pg_advisory_xact_lock(hashtextextended(
            p_tenant_id::text||':'||v_candidate.location_id::text||':'||v_candidate.item_id::text||':'||
            coalesce(v_candidate.variant_id::text,'-')||':'||coalesce(v_candidate.lot_id::text,'-'),0));
          select coalesce(sum(balance.quantity_on_hand),0) into v_available
          from public.os_inventory_location_balances balance
          where balance.tenant_id=p_tenant_id and balance.location_id=v_candidate.location_id
            and balance.item_id=v_candidate.item_id
            and balance.variant_id is not distinct from v_candidate.variant_id
            and balance.lot_id is not distinct from v_candidate.lot_id;
          select coalesce(sum(reservation.quantity),0) into v_committed
          from public.nurse_inventory_reservations reservation
          where reservation.tenant_id=p_tenant_id and reservation.location_id=v_candidate.location_id
            and reservation.item_id=v_candidate.item_id
            and reservation.variant_id is not distinct from v_candidate.variant_id
            and reservation.lot_id is not distinct from v_candidate.lot_id
            and reservation.status in ('prepared','reserved')
            and reservation.expires_at>clock_timestamp();
          v_available:=greatest(v_available-v_committed,0);
          if v_available>0 then
            insert into public.nurse_inventory_reservations(
              tenant_id,shift_id,offer_id,provider_profile_id,requirement_id,
              location_id,item_id,variant_id,lot_id,quantity,status,expires_at
            ) values(
              p_tenant_id,v_shift.id,v_offer.id,v_terms.provider_profile_id,v_requirement.id,
              v_candidate.location_id,v_candidate.item_id,v_candidate.variant_id,v_candidate.lot_id,
              least(v_available,v_remaining),'prepared',v_offer_expires_at
            );
            v_remaining:=v_remaining-least(v_available,v_remaining);
          end if;
        end loop;
        if v_remaining>0 then
          raise exception using errcode='P0001',message='inventory_unserviceable';
        end if;
      end loop;
      insert into public.nurse_offer_deliveries(tenant_id,offer_id,provider_profile_id,channel,status,idempotency_key)
      values(p_tenant_id,v_offer.id,v_offer.provider_profile_id,'in_app','queued',
        'offer:'||v_offer.id::text||':in_app');
      v_count:=v_count+1;
    end if;
  end loop;
  return jsonb_build_object('distributed',v_count);
end;
$$;

create or replace function public.deliver_nurse_in_app_offer_v1(
  p_tenant_id uuid, p_job_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_delivery public.nurse_offer_deliveries%rowtype;
begin
  select * into v_delivery from public.nurse_offer_deliveries delivery where delivery.tenant_id=p_tenant_id
    and delivery.id=nullif(p_payload->>'delivery_id','')::uuid for update;
  if not found then raise exception using errcode='P0002',message='offer_delivery_required'; end if;
  update public.nurse_offer_deliveries set status='delivered',delivered_at=clock_timestamp(),
    lease_owner=null,lease_expires_at=null,attempts=attempts+1 where tenant_id=p_tenant_id and id=v_delivery.id;
  update public.nurse_shift_offers set status=case when status in ('pending','offered') then 'delivered' else status end,
    version=case when status in ('pending','offered') then version+1 else version end
  where tenant_id=p_tenant_id and id=v_delivery.offer_id;
  return jsonb_build_object('delivery_id',v_delivery.id,'status','delivered');
end;
$$;

create or replace function public.run_nurse_marketplace_daily_sweep_v1(
  p_tenant_id uuid, p_job_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  perform public.purge_nurse_typed_origin_retention_v1(p_tenant_id,24);
  insert into public.nurse_marketplace_jobs(tenant_id,job_type,idempotency_key,payload,status,available_at)
  select p_tenant_id,'readiness_evaluate','daily:'||current_date::text||':'||assignment.shift_id::text||':'||assignment.provider_profile_id::text,
    jsonb_build_object('shiftId',assignment.shift_id,'providerProfileId',assignment.provider_profile_id,'stage','route_release'),
    'pending',clock_timestamp()
  from public.operational_shift_assignments assignment
  join public.operational_shifts shift on shift.tenant_id=assignment.tenant_id and shift.id=assignment.shift_id
  where assignment.tenant_id=p_tenant_id and assignment.status in ('claimed','assigned')
    and shift.status not in ('completed','cancelled') and shift.starts_at<clock_timestamp()+interval '48 hours'
  on conflict (tenant_id,job_type,idempotency_key) do nothing;
  get diagnostics v_count=row_count;
  return jsonb_build_object('enqueued',v_count,'sweep_date',current_date);
end;
$$;

-- Stage hardening for the pre-existing run/time RPCs. Events keep their
-- legacy approved guide path; mobile appointment runs require published guides.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.start_nurse_shift_run(uuid,uuid,uuid,uuid,integer)'::regprocedure) into v_definition;
  if position('and claim_allowed and overall_status = ''ready''' in v_definition)=0
     or position('and gv.status = ''approved''' in v_definition)=0 then
    raise exception using errcode='P0001',message='start_nurse_shift_run_contract_changed';
  end if;
  v_definition:=replace(v_definition,
    'and claim_allowed and overall_status = ''ready''',
    'and evaluation_stage = ''run_start'' and claim_allowed and overall_status = ''ready''');
  v_definition:=replace(v_definition,
    'and gv.status = ''approved''',
    'and ((v_shift.event_container_id is not null and gv.status = ''approved'') or (v_shift.event_container_id is null and gv.publication_status = ''published''))');
  execute v_definition;
  select pg_get_functiondef('public.record_nurse_time_event(uuid,uuid,uuid,text,uuid,timestamptz,text,jsonb)'::regprocedure) into v_definition;
  if position('and claim_allowed and overall_status = ''ready''' in v_definition)=0 then
    raise exception using errcode='P0001',message='record_nurse_time_event_contract_changed';
  end if;
  v_definition:=replace(v_definition,
    'and claim_allowed and overall_status = ''ready''',
    'and evaluation_stage = ''run_start'' and claim_allowed and overall_status = ''ready''');
  execute v_definition;
end $$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'nurse_guide_publication_history', 'nurse_marketplace_jobs',
    'nurse_marketplace_dead_letters', 'nurse_w2_assignment_idempotency'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

-- The only browser-readable V1 relation is the privacy-safe offer envelope.
-- Terms are still returned through authenticated server APIs.
grant select on table public.nurse_shift_offers to authenticated;
drop policy if exists nurse_shift_offers_self_select on public.nurse_shift_offers;
create policy nurse_shift_offers_self_select on public.nurse_shift_offers
  for select to authenticated
  using (
    exists (
      select 1 from public.provider_profiles provider
      where provider.tenant_id = nurse_shift_offers.tenant_id
        and provider.id = nurse_shift_offers.provider_profile_id
        and provider.profile_id = auth.uid()
        and provider.active
    )
  );

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception using errcode = 'P0001', message = 'supabase_realtime_publication_required';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'nurse_shift_offers'
  ) then
    alter publication supabase_realtime add table public.nurse_shift_offers;
  end if;
end $$;

revoke all on function public.lease_nurse_marketplace_jobs_v1(text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_nurse_route_provider_quota_v1(uuid,uuid,uuid,text,uuid,text,integer,integer) from public, anon, authenticated;
revoke all on function public.claim_nurse_shift_offer_v1(uuid,uuid,uuid,uuid,integer,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.act_on_nurse_shift_offer_v1(uuid,uuid,uuid,uuid,integer,integer,uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.transition_nurse_route_day_v1(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.assign_w2_nurse_shift_v1(uuid,uuid,uuid,uuid,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.set_nurse_route_origin_v1(uuid,uuid,uuid,uuid,integer,uuid,text,text,text,double precision,double precision) from public, anon, authenticated;
revoke all on function public.prepare_nurse_route_plan_v1(uuid,uuid,uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.get_nurse_route_plan_request_v1(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.persist_nurse_route_plan_v1(uuid,uuid,uuid,uuid,integer,uuid,text,text,text,double precision,double precision,text,text,text,text,uuid,text,jsonb,text[],jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.reserve_nurse_route_plan_request_v1(uuid,uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.fail_nurse_route_plan_request_v1(uuid,uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_nurse_route_stop_v1(uuid,uuid,uuid,uuid,uuid,integer,uuid) from public, anon, authenticated;
revoke all on function public.complete_nurse_route_stop_v1(uuid,uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.reconcile_nurse_route_stop_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.admin_release_nurse_route_v1(uuid,uuid,uuid,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_recover_nurse_route_v1(uuid,uuid,uuid,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.resolve_nurse_pickup_task_v1(uuid,uuid,uuid,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_nurse_pickup_task_v1(uuid,uuid,uuid,uuid,integer,uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.report_nurse_pickup_mismatch_v1(uuid,uuid,uuid,uuid,integer,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.recheck_nurse_inventory_v1(uuid,uuid,uuid,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.transition_nurse_guide_version_v1(uuid,uuid,uuid,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.prepare_nurse_offer_candidate_v1(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,text,text,integer,integer,text,integer,integer,integer,integer,text,text,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.reconcile_nurse_appointment_event_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.evaluate_nurse_marketplace_readiness_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.distribute_nurse_shift_offers_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.deliver_nurse_in_app_offer_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.run_nurse_marketplace_daily_sweep_v1(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.lease_nurse_marketplace_jobs_v1(text, integer, integer) to service_role;
grant execute on function public.consume_nurse_route_provider_quota_v1(uuid,uuid,uuid,text,uuid,text,integer,integer) to service_role;
grant execute on function public.claim_nurse_shift_offer_v1(uuid,uuid,uuid,uuid,integer,integer,uuid,text,text) to service_role;
grant execute on function public.act_on_nurse_shift_offer_v1(uuid,uuid,uuid,uuid,integer,integer,uuid,text,text,text,jsonb) to service_role;
grant execute on function public.transition_nurse_route_day_v1(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text) to service_role;
grant execute on function public.assign_w2_nurse_shift_v1(uuid,uuid,uuid,uuid,integer,uuid,text) to service_role;
grant execute on function public.set_nurse_route_origin_v1(uuid,uuid,uuid,uuid,integer,uuid,text,text,text,double precision,double precision) to service_role;
grant execute on function public.prepare_nurse_route_plan_v1(uuid,uuid,uuid,uuid,integer) to service_role;
grant execute on function public.get_nurse_route_plan_request_v1(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.persist_nurse_route_plan_v1(uuid,uuid,uuid,uuid,integer,uuid,text,text,text,double precision,double precision,text,text,text,text,uuid,text,jsonb,text[],jsonb,jsonb) to service_role;
grant execute on function public.reserve_nurse_route_plan_request_v1(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.fail_nurse_route_plan_request_v1(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.complete_nurse_route_stop_v1(uuid,uuid,uuid,uuid,uuid,integer,uuid) to service_role;
grant execute on function public.complete_nurse_route_stop_v1(uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.reconcile_nurse_route_stop_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.admin_release_nurse_route_v1(uuid,uuid,uuid,integer,uuid,text,text) to service_role;
grant execute on function public.admin_recover_nurse_route_v1(uuid,uuid,uuid,integer,uuid,text,text) to service_role;
grant execute on function public.resolve_nurse_pickup_task_v1(uuid,uuid,uuid,integer,uuid,text,text) to service_role;
grant execute on function public.complete_nurse_pickup_task_v1(uuid,uuid,uuid,uuid,integer,uuid,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.report_nurse_pickup_mismatch_v1(uuid,uuid,uuid,uuid,integer,uuid,text,jsonb) to service_role;
grant execute on function public.recheck_nurse_inventory_v1(uuid,uuid,uuid,integer,uuid,text,text) to service_role;
grant execute on function public.transition_nurse_guide_version_v1(uuid,uuid,uuid,integer,uuid,text,text) to service_role;
grant execute on function public.prepare_nurse_offer_candidate_v1(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,text,text,integer,integer,text,integer,integer,integer,integer,text,text,timestamptz,text,text) to service_role;
grant execute on function public.reconcile_nurse_appointment_event_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.evaluate_nurse_marketplace_readiness_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.distribute_nurse_shift_offers_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.deliver_nurse_in_app_offer_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.run_nurse_marketplace_daily_sweep_v1(uuid,uuid,jsonb) to service_role;

comment on function public.claim_nurse_shift_offer_v1(uuid,uuid,uuid,uuid,integer,integer,uuid,text,text) is
  'One-winner offer acceptance with fresh claim readiness, exact accepted terms, stock locks, reservations, competitor revocation, and idempotency.';
comment on function public.lease_nurse_marketplace_jobs_v1(text, integer, integer) is
  'Leases bounded durable work with SKIP LOCKED; expired leases are recoverable.';

commit;
