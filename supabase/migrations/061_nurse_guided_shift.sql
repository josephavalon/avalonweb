-- Nurse guided-shift persistence and self-service controls.
--
-- This migration deliberately does not seed work, clinical guide content,
-- credential results, kit attestations, or payment state. The nurse portal
-- consumes persisted evidence and fails closed when an owner has not supplied
-- an authoritative fact.

begin;

do $$
begin
  if to_regclass('public.operational_shifts') is null
     or to_regclass('public.operational_shift_assignments') is null then
    raise exception using errcode = 'P0001', message = 'migration_050_required';
  end if;
  if to_regclass('public.provider_route_days') is null then
    raise exception using errcode = 'P0001', message = 'migration_051_required';
  end if;
  if to_regclass('public.provider_profiles') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.audit_events') is null then
    raise exception using errcode = 'P0001', message = 'healthcare_os_core_required';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception using errcode = 'P0001', message = 'touch_updated_at_required';
  end if;
end $$;

-- Offer decisions are separate from staffing/shift state. Countered and
-- expired offers remain visible without pretending that work was accepted.
alter table public.operational_shift_assignments
  drop constraint if exists operational_shift_assignments_status_check;
alter table public.operational_shift_assignments
  add constraint operational_shift_assignments_status_check
  check (status in (
    'offered', 'claimed', 'assigned', 'declined', 'countered', 'expired',
    'completed', 'cancelled'
  ));

create table if not exists public.provider_work_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_profile_id uuid not null,
  business_profile jsonb not null default '{}'::jsonb
    check (jsonb_typeof(business_profile) = 'object'),
  availability jsonb not null default '{}'::jsonb
    check (jsonb_typeof(availability) = 'object'),
  service_preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(service_preferences) = 'object'),
  service_area jsonb not null default '{}'::jsonb
    check (jsonb_typeof(service_area) = 'object'),
  engagement_status text not null default 'w2_default'
    check (engagement_status in (
      'w2_default', 'w2_approved', 'contractor_review', 'contractor_approved'
    )),
  engagement_approved_by uuid,
  engagement_approved_at timestamptz,
  engagement_effective_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_work_preferences_tenant_id_id_key unique (tenant_id, id),
  constraint provider_work_preferences_provider_key unique (provider_profile_id),
  constraint provider_work_preferences_engagement_approval_check check (
    engagement_status not in ('w2_approved', 'contractor_approved')
    or (
      engagement_approved_by is not null
      and engagement_approved_at is not null
      and engagement_effective_at is not null
    )
  )
);

create table if not exists public.nurse_shift_domain_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  domain text not null check (domain in (
    'identity', 'license', 'schedule', 'kit', 'client', 'gfe',
    'patient_payment', 'route', 'safety'
  )),
  status text not null check (status in (
    'ready', 'blocked', 'unavailable', 'expired', 'not_required'
  )),
  reason_code text not null check (char_length(trim(reason_code)) between 1 and 100),
  source text not null check (char_length(trim(source)) between 1 and 100),
  owner_role text not null check (char_length(trim(owner_role)) between 1 and 80),
  remediation_code text check (remediation_code is null or char_length(remediation_code) <= 100),
  evidence_ref text check (evidence_ref is null or char_length(evidence_ref) <= 240),
  checked_at timestamptz not null,
  expires_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nurse_shift_domain_evidence_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_shift_domain_evidence_key unique (shift_id, provider_profile_id, domain),
  constraint nurse_shift_domain_evidence_expiry_check check (
    expires_at is null or expires_at > checked_at
  )
);

create table if not exists public.nurse_shift_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  evaluation_key uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  evaluator_version text not null check (char_length(trim(evaluator_version)) between 1 and 80),
  source_shift_version integer not null check (source_shift_version > 0),
  overall_status text not null check (overall_status in ('ready', 'blocked')),
  claim_allowed boolean not null default false,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array'),
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  invalidation_reason text check (invalidation_reason is null or char_length(invalidation_reason) <= 100),
  created_at timestamptz not null default now(),
  constraint nurse_shift_readiness_snapshots_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_shift_readiness_snapshot_evaluation_key unique (evaluation_key),
  constraint nurse_shift_readiness_snapshot_status_check check (
    claim_allowed = (overall_status = 'ready')
  ),
  constraint nurse_shift_readiness_snapshot_expiry_check check (expires_at > checked_at),
  constraint nurse_shift_readiness_snapshot_invalidation_check check (
    (invalidated_at is null and invalidation_reason is null)
    or (invalidated_at is not null and invalidation_reason is not null)
  )
);

create table if not exists public.nurse_offer_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  assignment_id uuid,
  offer_terms_id uuid not null,
  provider_profile_id uuid not null,
  request_key uuid not null,
  requested_terms jsonb not null check (jsonb_typeof(requested_terms) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nurse_offer_counters_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_offer_counters_request_key unique (provider_profile_id, request_key),
  constraint nurse_offer_counters_decision_check check (
    status = 'pending' or decided_at is not null
  )
);

create table if not exists public.nurse_offer_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  terms_version integer not null default 1 check (terms_version > 0),
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'withdrawn', 'expired', 'superseded')),
  engagement_model text not null default 'w2'
    check (engagement_model in ('w2', 'approved_contractor')),
  gross_pay_cents integer check (gross_pay_cents is null or gross_pay_cents >= 0),
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  estimated_work_minutes integer not null check (estimated_work_minutes between 1 and 1440),
  estimated_travel_minutes integer check (estimated_travel_minutes is null or estimated_travel_minutes between 0 and 1440),
  mileage_rate_cents integer check (mileage_rate_cents is null or mileage_rate_cents >= 0),
  guaranteed_minimum_cents integer check (guaranteed_minimum_cents is null or guaranteed_minimum_cents >= 0),
  cancellation_terms_code text not null check (char_length(trim(cancellation_terms_code)) between 1 and 100),
  expense_policy_code text not null check (char_length(trim(expense_policy_code)) between 1 and 100),
  created_by uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nurse_offer_terms_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_offer_terms_version_key unique (shift_id, provider_profile_id, terms_version),
  constraint nurse_offer_terms_compensation_check check (
    gross_pay_cents is not null or hourly_rate_cents is not null
  ),
  constraint nurse_offer_terms_acceptance_check check (
    status <> 'accepted' or accepted_at is not null
  )
);

create table if not exists public.shift_guide_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_key text not null check (char_length(trim(template_key)) between 1 and 100),
  name text not null check (char_length(trim(name)) between 1 and 160),
  work_kind text not null check (work_kind in ('mobile_appointment', 'event_handoff')),
  protocol_key text check (protocol_key is null or char_length(trim(protocol_key)) between 1 and 100),
  role_required text not null default 'RN' check (char_length(trim(role_required)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_guide_templates_tenant_id_id_key unique (tenant_id, id),
  constraint shift_guide_templates_key unique (tenant_id, template_key)
);

create table if not exists public.shift_guide_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  steps jsonb not null check (jsonb_typeof(steps) = 'array'),
  required_closeout_keys text[] not null default array['source_record_closed', 'kit_reconciled', 'route_reconciled'],
  source_reference text check (source_reference is null or char_length(source_reference) <= 240),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shift_guide_versions_tenant_id_id_key unique (tenant_id, id),
  constraint shift_guide_versions_template_version_key unique (template_id, version),
  constraint shift_guide_versions_approval_check check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  )
);

create table if not exists public.mobile_shift_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  assignment_id uuid not null,
  provider_profile_id uuid not null,
  route_day_id uuid,
  readiness_snapshot_id uuid not null,
  offer_terms_id uuid not null,
  guide_version_id uuid not null,
  guide_version text not null
    check (char_length(trim(guide_version)) between 1 and 160),
  status text not null default 'preflight' check (status in (
    'preflight', 'clocked_in', 'route_active', 'at_stop', 'care_active',
    'visit_closeout', 'shift_closeout', 'clocked_out', 'time_submitted',
    'exception_review', 'closed'
  )),
  current_step_key text check (current_step_key is null or char_length(current_step_key) <= 100),
  started_at timestamptz not null default now(),
  clocked_in_at timestamptz,
  clocked_out_at timestamptz,
  closed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_shift_runs_tenant_id_id_key unique (tenant_id, id),
  constraint mobile_shift_runs_shift_provider_key unique (shift_id, provider_profile_id),
  constraint mobile_shift_runs_clock_order_check check (
    clocked_out_at is null or (clocked_in_at is not null and clocked_out_at >= clocked_in_at)
  )
);

create table if not exists public.mobile_shift_time_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_run_id uuid not null,
  provider_profile_id uuid not null,
  event_type text not null check (event_type in (
    'clock_in', 'break_start', 'break_end', 'clock_out',
    'correction_request', 'offline_sync'
  )),
  idempotency_key uuid not null,
  device_occurred_at timestamptz,
  occurred_at timestamptz not null default clock_timestamp(),
  reason_code text check (reason_code is null or char_length(reason_code) <= 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint mobile_shift_time_events_tenant_id_id_key unique (tenant_id, id),
  constraint mobile_shift_time_events_idempotency_key unique (shift_run_id, idempotency_key)
);

create table if not exists public.mobile_shift_step_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_run_id uuid not null,
  provider_profile_id uuid not null,
  step_key text not null check (char_length(trim(step_key)) between 1 and 100),
  resolution text not null check (resolution in (
    'completed', 'not_applicable', 'patient_declined',
    'clinically_contraindicated', 'blocked_by_safety', 'blocked_by_system',
    'handed_off', 'supervisor_override'
  )),
  reason_code text check (reason_code is null or char_length(reason_code) <= 100),
  idempotency_key uuid not null,
  device_occurred_at timestamptz,
  occurred_at timestamptz not null default clock_timestamp(),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint mobile_shift_step_events_tenant_id_id_key unique (tenant_id, id),
  constraint mobile_shift_step_events_idempotency_key unique (shift_run_id, idempotency_key),
  constraint mobile_shift_step_events_reason_check check (
    resolution = 'completed' or nullif(trim(reason_code), '') is not null
  )
);

create table if not exists public.shift_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_run_id uuid not null,
  provider_profile_id uuid not null,
  kind text not null check (kind in (
    'safety', 'clinical', 'route', 'kit', 'client', 'time', 'system', 'emergency'
  )),
  severity text not null default 'operational'
    check (severity in ('operational', 'urgent', 'emergency')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'closed')),
  reason_code text not null check (char_length(trim(reason_code)) between 1 and 100),
  owner_role text not null check (char_length(trim(owner_role)) between 1 and 80),
  note text check (note is null or char_length(note) <= 500),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  constraint shift_exceptions_tenant_id_id_key unique (tenant_id, id),
  constraint shift_exceptions_idempotency_key unique (shift_run_id, idempotency_key),
  constraint shift_exceptions_resolution_check check (
    status not in ('resolved', 'closed') or (resolved_at is not null and resolved_by is not null)
  )
);

-- Composite tenant/entity foreign keys prevent a service-role bug from linking
-- a nurse, shift, run, route, or assignment across tenants.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_work_preferences'::regclass and conname = 'provider_work_preferences_provider_tenant_fk') then
    alter table public.provider_work_preferences add constraint provider_work_preferences_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provider_work_preferences'::regclass and conname = 'provider_work_preferences_approver_tenant_fk') then
    alter table public.provider_work_preferences add constraint provider_work_preferences_approver_tenant_fk
      foreign key (tenant_id, engagement_approved_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_shift_domain_evidence'::regclass and conname = 'nurse_shift_domain_evidence_shift_tenant_fk') then
    alter table public.nurse_shift_domain_evidence add constraint nurse_shift_domain_evidence_shift_tenant_fk
      foreign key (tenant_id, shift_id) references public.operational_shifts(tenant_id, id) on delete cascade;
    alter table public.nurse_shift_domain_evidence add constraint nurse_shift_domain_evidence_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_shift_readiness_snapshots'::regclass and conname = 'nurse_shift_readiness_shift_tenant_fk') then
    alter table public.nurse_shift_readiness_snapshots add constraint nurse_shift_readiness_shift_tenant_fk
      foreign key (tenant_id, shift_id) references public.operational_shifts(tenant_id, id) on delete cascade;
    alter table public.nurse_shift_readiness_snapshots add constraint nurse_shift_readiness_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_offer_counters'::regclass and conname = 'nurse_offer_counters_shift_tenant_fk') then
    alter table public.nurse_offer_counters add constraint nurse_offer_counters_shift_tenant_fk
      foreign key (tenant_id, shift_id) references public.operational_shifts(tenant_id, id) on delete cascade;
    alter table public.nurse_offer_counters add constraint nurse_offer_counters_assignment_tenant_fk
      foreign key (tenant_id, assignment_id) references public.operational_shift_assignments(tenant_id, id) on delete restrict;
    alter table public.nurse_offer_counters add constraint nurse_offer_counters_offer_terms_tenant_fk
      foreign key (tenant_id, offer_terms_id) references public.nurse_offer_terms(tenant_id, id) on delete restrict;
    alter table public.nurse_offer_counters add constraint nurse_offer_counters_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_offer_terms'::regclass and conname = 'nurse_offer_terms_shift_tenant_fk') then
    alter table public.nurse_offer_terms add constraint nurse_offer_terms_shift_tenant_fk
      foreign key (tenant_id, shift_id) references public.operational_shifts(tenant_id, id) on delete cascade;
    alter table public.nurse_offer_terms add constraint nurse_offer_terms_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete cascade;
    alter table public.nurse_offer_terms add constraint nurse_offer_terms_creator_tenant_fk
      foreign key (tenant_id, created_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_guide_versions'::regclass and conname = 'shift_guide_versions_template_tenant_fk') then
    alter table public.shift_guide_versions add constraint shift_guide_versions_template_tenant_fk
      foreign key (tenant_id, template_id) references public.shift_guide_templates(tenant_id, id) on delete cascade;
    alter table public.shift_guide_versions add constraint shift_guide_versions_approver_tenant_fk
      foreign key (tenant_id, approved_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mobile_shift_runs'::regclass and conname = 'mobile_shift_runs_shift_tenant_fk') then
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_shift_tenant_fk
      foreign key (tenant_id, shift_id) references public.operational_shifts(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_assignment_tenant_fk
      foreign key (tenant_id, assignment_id) references public.operational_shift_assignments(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_route_day_tenant_fk
      foreign key (tenant_id, route_day_id) references public.provider_route_days(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_readiness_tenant_fk
      foreign key (tenant_id, readiness_snapshot_id) references public.nurse_shift_readiness_snapshots(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_offer_terms_tenant_fk
      foreign key (tenant_id, offer_terms_id) references public.nurse_offer_terms(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_runs add constraint mobile_shift_runs_guide_version_tenant_fk
      foreign key (tenant_id, guide_version_id) references public.shift_guide_versions(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mobile_shift_time_events'::regclass and conname = 'mobile_shift_time_events_run_tenant_fk') then
    alter table public.mobile_shift_time_events add constraint mobile_shift_time_events_run_tenant_fk
      foreign key (tenant_id, shift_run_id) references public.mobile_shift_runs(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_time_events add constraint mobile_shift_time_events_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mobile_shift_step_events'::regclass and conname = 'mobile_shift_step_events_run_tenant_fk') then
    alter table public.mobile_shift_step_events add constraint mobile_shift_step_events_run_tenant_fk
      foreign key (tenant_id, shift_run_id) references public.mobile_shift_runs(tenant_id, id) on delete restrict;
    alter table public.mobile_shift_step_events add constraint mobile_shift_step_events_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shift_exceptions'::regclass and conname = 'shift_exceptions_run_tenant_fk') then
    alter table public.shift_exceptions add constraint shift_exceptions_run_tenant_fk
      foreign key (tenant_id, shift_run_id) references public.mobile_shift_runs(tenant_id, id) on delete restrict;
    alter table public.shift_exceptions add constraint shift_exceptions_provider_tenant_fk
      foreign key (tenant_id, provider_profile_id) references public.provider_profiles(tenant_id, id) on delete restrict;
    alter table public.shift_exceptions add constraint shift_exceptions_resolver_tenant_fk
      foreign key (tenant_id, resolved_by) references public.profiles(tenant_id, id) on delete restrict;
  end if;
end $$;

create index if not exists nurse_shift_domain_evidence_lookup_idx
  on public.nurse_shift_domain_evidence (tenant_id, shift_id, provider_profile_id, domain);
create index if not exists nurse_shift_readiness_lookup_idx
  on public.nurse_shift_readiness_snapshots
  (tenant_id, shift_id, provider_profile_id, checked_at desc);
create index if not exists nurse_offer_terms_actionable_idx
  on public.nurse_offer_terms (tenant_id, shift_id, provider_profile_id, expires_at)
  where status in ('proposed', 'accepted');
create index if not exists shift_guide_versions_approved_idx
  on public.shift_guide_versions (tenant_id, template_id, version desc)
  where status = 'approved';
create index if not exists mobile_shift_runs_provider_idx
  on public.mobile_shift_runs (tenant_id, provider_profile_id, status, started_at desc);
create index if not exists mobile_shift_time_events_run_idx
  on public.mobile_shift_time_events (tenant_id, shift_run_id, occurred_at);
create index if not exists mobile_shift_step_events_run_idx
  on public.mobile_shift_step_events (tenant_id, shift_run_id, occurred_at);
create index if not exists shift_exceptions_open_idx
  on public.shift_exceptions (tenant_id, shift_run_id, status) where status in ('open', 'acknowledged');

drop trigger if exists touch_provider_work_preferences_updated_at on public.provider_work_preferences;
create trigger touch_provider_work_preferences_updated_at
before update on public.provider_work_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists touch_nurse_shift_domain_evidence_updated_at on public.nurse_shift_domain_evidence;
create trigger touch_nurse_shift_domain_evidence_updated_at
before update on public.nurse_shift_domain_evidence
for each row execute function public.touch_updated_at();

drop trigger if exists touch_nurse_offer_counters_updated_at on public.nurse_offer_counters;
create trigger touch_nurse_offer_counters_updated_at
before update on public.nurse_offer_counters
for each row execute function public.touch_updated_at();

drop trigger if exists touch_nurse_offer_terms_updated_at on public.nurse_offer_terms;
create trigger touch_nurse_offer_terms_updated_at
before update on public.nurse_offer_terms
for each row execute function public.touch_updated_at();

drop trigger if exists touch_shift_guide_templates_updated_at on public.shift_guide_templates;
create trigger touch_shift_guide_templates_updated_at
before update on public.shift_guide_templates
for each row execute function public.touch_updated_at();

drop trigger if exists touch_mobile_shift_runs_updated_at on public.mobile_shift_runs;
create trigger touch_mobile_shift_runs_updated_at
before update on public.mobile_shift_runs
for each row execute function public.touch_updated_at();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'provider_work_preferences', 'nurse_shift_domain_evidence',
    'nurse_shift_readiness_snapshots', 'nurse_offer_counters', 'nurse_offer_terms',
    'shift_guide_templates', 'shift_guide_versions',
    'mobile_shift_runs', 'mobile_shift_time_events',
    'mobile_shift_step_events', 'shift_exceptions'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on public.%I to service_role', v_table);
  end loop;
end $$;

create or replace function app_private.prevent_nurse_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'nurse_event_records_are_append_only';
end;
$$;

drop trigger if exists prevent_mobile_shift_time_event_mutation on public.mobile_shift_time_events;
create trigger prevent_mobile_shift_time_event_mutation
before update or delete on public.mobile_shift_time_events
for each row execute function app_private.prevent_nurse_event_mutation();

drop trigger if exists prevent_mobile_shift_step_event_mutation on public.mobile_shift_step_events;
create trigger prevent_mobile_shift_step_event_mutation
before update or delete on public.mobile_shift_step_events
for each row execute function app_private.prevent_nurse_event_mutation();

create or replace function app_private.protect_nurse_versioned_records()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'nurse_offer_terms' then
    if tg_op = 'DELETE' then
      raise exception using errcode = 'P0001', message = 'offer_terms_are_append_only';
    end if;
    if old.status = 'accepted' then
      raise exception using errcode = 'P0001', message = 'accepted_offer_terms_are_immutable';
    end if;
    return new;
  end if;
  if tg_table_name = 'shift_guide_versions' and old.status in ('approved', 'retired') then
    if tg_op = 'DELETE' then
      raise exception using errcode = 'P0001', message = 'approved_guide_version_is_immutable';
    end if;
    if new.template_id is distinct from old.template_id
       or new.version is distinct from old.version
       or new.steps is distinct from old.steps
       or new.required_closeout_keys is distinct from old.required_closeout_keys
       or new.source_reference is distinct from old.source_reference
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.status not in ('approved', 'retired') then
      raise exception using errcode = 'P0001', message = 'approved_guide_version_is_immutable';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_accepted_nurse_offer_terms on public.nurse_offer_terms;
create trigger protect_accepted_nurse_offer_terms
before update or delete on public.nurse_offer_terms
for each row execute function app_private.protect_nurse_versioned_records();

drop trigger if exists protect_approved_shift_guide_versions on public.shift_guide_versions;
create trigger protect_approved_shift_guide_versions
before update or delete on public.shift_guide_versions
for each row execute function app_private.protect_nurse_versioned_records();

create or replace function app_private.protect_nurse_readiness_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'readiness_snapshots_are_append_only';
  end if;
  if old.invalidated_at is not null
     or new.invalidated_at is null
     or new.invalidation_reason is null
     or (to_jsonb(new) - 'invalidated_at' - 'invalidation_reason')
        is distinct from
        (to_jsonb(old) - 'invalidated_at' - 'invalidation_reason') then
    raise exception using errcode = 'P0001', message = 'readiness_snapshot_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_nurse_readiness_snapshots on public.nurse_shift_readiness_snapshots;
create trigger protect_nurse_readiness_snapshots
before update or delete on public.nurse_shift_readiness_snapshots
for each row execute function app_private.protect_nurse_readiness_snapshot();

create or replace function app_private.expire_nurse_readiness_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider_profile_id uuid := coalesce(new.provider_profile_id, old.provider_profile_id);
  v_shift_id uuid;
  v_tenant_id uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if tg_table_name in ('nurse_shift_domain_evidence', 'nurse_offer_terms') then
    v_shift_id := coalesce(new.shift_id, old.shift_id);
  end if;
  update public.nurse_shift_readiness_snapshots
  set invalidated_at = clock_timestamp(),
      invalidation_reason = 'source_changed'
  where tenant_id = v_tenant_id
    and provider_profile_id = v_provider_profile_id
    and (v_shift_id is null or shift_id = v_shift_id)
    and invalidated_at is null;
  return coalesce(new, old);
end;
$$;

drop trigger if exists expire_readiness_on_domain_evidence on public.nurse_shift_domain_evidence;
create trigger expire_readiness_on_domain_evidence
after insert or update or delete on public.nurse_shift_domain_evidence
for each row execute function app_private.expire_nurse_readiness_snapshot();

drop trigger if exists expire_readiness_on_offer_terms on public.nurse_offer_terms;
create trigger expire_readiness_on_offer_terms
after insert or update or delete on public.nurse_offer_terms
for each row execute function app_private.expire_nurse_readiness_snapshot();

drop trigger if exists expire_readiness_on_work_preferences on public.provider_work_preferences;
create trigger expire_readiness_on_work_preferences
after insert or update or delete on public.provider_work_preferences
for each row execute function app_private.expire_nurse_readiness_snapshot();

create or replace function app_private.assert_nurse_operational_evidence(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1
  from public.provider_license_jurisdictions license
  where license.tenant_id = p_tenant_id
    and license.provider_profile_id = p_provider_profile_id
    and lower(license.license_status) in ('active', 'clear', 'current', 'valid')
    and (license.expires_on is null or license.expires_on >= current_date)
    and license.nursys_checked_at is not null
    and license.nursys_checked_at >= clock_timestamp() - interval '24 hours'
  limit 1
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'fresh_nursys_license_evidence_missing';
  end if;

  perform 1
  from public.nurse_shift_domain_evidence evidence
  where evidence.tenant_id = p_tenant_id
    and evidence.shift_id = p_shift_id
    and evidence.provider_profile_id = p_provider_profile_id
    and evidence.domain = 'license'
    and evidence.status = 'ready'
    and nullif(trim(evidence.source), '') is not null
    and evidence.expires_at is not null
    and evidence.expires_at > clock_timestamp()
  limit 1
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'shift_license_scope_evidence_missing';
  end if;

  perform 1
  from public.nurse_shift_domain_evidence evidence
  where evidence.tenant_id = p_tenant_id
    and evidence.shift_id = p_shift_id
    and evidence.provider_profile_id = p_provider_profile_id
    and evidence.domain = 'kit'
    and evidence.status = 'ready'
    and evidence.expires_at is not null
    and evidence.expires_at > clock_timestamp()
  limit 1
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'kit_readiness_evidence_missing';
  end if;

  if p_appointment_id is not null then
    perform 1
    from public.provider_route_day_stops stop
    join public.provider_route_days route_day
      on route_day.tenant_id = stop.tenant_id and route_day.id = stop.route_day_id
    where stop.tenant_id = p_tenant_id
      and stop.appointment_id = p_appointment_id
      and stop.assigned_provider_profile_id = p_provider_profile_id
      and stop.selected
      and route_day.provider_profile_id = p_provider_profile_id
      and route_day.status = 'active'
      and route_day.acknowledged_revision is not null
      and route_day.acknowledged_revision >= route_day.assignment_revision
    limit 1
    for share of stop, route_day;
    if not found then
      raise exception using errcode = 'P0001', message = 'route_readiness_evidence_missing';
    end if;
  end if;
end;
$$;

revoke all on function app_private.assert_nurse_operational_evidence(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.assert_nurse_patient_gate(
  p_tenant_id uuid,
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gfe_status text;
  v_patient_person_id uuid;
  v_payment_status text;
begin
  if p_appointment_id is null then return; end if;
  select appointment.gfe_status, appointment.payment_status, appointment.patient_person_id
    into v_gfe_status, v_payment_status, v_patient_person_id
  from public.appointments appointment
  where appointment.tenant_id = p_tenant_id and appointment.id = p_appointment_id
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'appointment_readiness_unavailable';
  end if;
  if lower(coalesce(v_gfe_status, '')) not in ('approved', 'clear', 'cleared', 'complete', 'completed', 'not_required') then
    raise exception using errcode = 'P0001', message = 'gfe_not_ready';
  end if;
  if lower(coalesce(v_payment_status, '')) not in ('authorized', 'captured', 'paid', 'deposit_paid', 'succeeded', 'not_required', 'waived', 'complete', 'completed') then
    raise exception using errcode = 'P0001', message = 'patient_payment_not_ready';
  end if;
  if v_patient_person_id is not null and exists (
    select 1 from public.do_not_treat_flags safety
    where safety.tenant_id = p_tenant_id
      and safety.patient_person_id = v_patient_person_id
      and safety.active and safety.resolved_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'active_safety_hold';
  end if;
end;
$$;

revoke all on function app_private.assert_nurse_patient_gate(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.assert_nurse_self(
  p_tenant_id uuid,
  p_provider_profile_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.provider_profiles pp
    join public.profiles p
      on p.id = pp.profile_id and p.tenant_id = pp.tenant_id
    where pp.tenant_id = p_tenant_id
      and pp.id = p_provider_profile_id
      and pp.profile_id = p_actor_profile_id
      and pp.active
      and pp.provider_role in ('rn', 'np')
      and p.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'provider_self_action_required';
  end if;
end;
$$;

revoke all on function app_private.assert_nurse_self(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.assert_nurse_offer_engagement(
  p_tenant_id uuid,
  p_provider_profile_id uuid,
  p_engagement_model text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.provider_work_preferences preferences
    where preferences.tenant_id = p_tenant_id
      and preferences.provider_profile_id = p_provider_profile_id
      and preferences.engagement_approved_by is not null
      and preferences.engagement_approved_at is not null
      and preferences.engagement_effective_at is not null
      and preferences.engagement_effective_at <= clock_timestamp()
      and (
        (p_engagement_model = 'w2' and preferences.engagement_status = 'w2_approved')
        or (
          p_engagement_model = 'approved_contractor'
          and preferences.engagement_status = 'contractor_approved'
        )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'engagement_model_not_approved';
  end if;
end;
$$;

revoke all on function app_private.assert_nurse_offer_engagement(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.decline_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  select * into v_shift from public.operational_shifts
    where tenant_id = p_tenant_id and id = p_shift_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_not_found'; end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  if v_shift.status not in ('open', 'assigned') then
    raise exception using errcode = 'P0001', message = 'shift_offer_not_actionable';
  end if;
  insert into public.operational_shift_assignments (
    tenant_id, shift_id, provider_profile_id, status, created_by
  ) values (
    p_tenant_id, p_shift_id, p_provider_profile_id, 'declined', p_actor_profile_id
  )
  on conflict (shift_id, provider_profile_id) do update
    set status = 'declined', updated_at = now()
    where operational_shift_assignments.status not in ('claimed', 'assigned', 'completed')
  returning * into v_assignment;
  if v_assignment.id is null then
    raise exception using errcode = 'P0001', message = 'accepted_shift_cannot_be_declined';
  end if;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_declined', p_shift_id,
    jsonb_build_object('provider_profile_id', p_provider_profile_id)
  );
  return v_assignment;
end;
$$;

create or replace function public.counter_operational_shift_offer(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer,
  p_request_key uuid,
  p_requested_terms jsonb
)
returns public.nurse_offer_counters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_counter public.nurse_offer_counters%rowtype;
  v_offer public.nurse_offer_terms%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  if p_request_key is null then raise exception using errcode = '22023', message = 'request_key_required'; end if;
  if jsonb_typeof(p_requested_terms) <> 'object' or pg_column_size(p_requested_terms) > 4096 then
    raise exception using errcode = '22023', message = 'counter_terms_invalid';
  end if;
  select * into v_shift from public.operational_shifts
    where tenant_id = p_tenant_id and id = p_shift_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_not_found'; end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  if v_shift.status not in ('open', 'assigned') then
    raise exception using errcode = 'P0001', message = 'shift_offer_not_actionable';
  end if;
  select * into v_offer from public.nurse_offer_terms
    where tenant_id = p_tenant_id and shift_id = p_shift_id
      and provider_profile_id = p_provider_profile_id
      and status = 'proposed' and expires_at > clock_timestamp()
    order by terms_version desc limit 1
    for share;
  if not found then raise exception using errcode = 'P0001', message = 'current_offer_terms_required'; end if;
  select * into v_counter from public.nurse_offer_counters
    where provider_profile_id = p_provider_profile_id and request_key = p_request_key;
  if found then
    if v_counter.shift_id <> p_shift_id or v_counter.requested_terms <> p_requested_terms then
      raise exception using errcode = '23505', message = 'counter_request_key_conflict';
    end if;
    return v_counter;
  end if;
  insert into public.operational_shift_assignments (
    tenant_id, shift_id, provider_profile_id, status, created_by
  ) values (
    p_tenant_id, p_shift_id, p_provider_profile_id, 'countered', p_actor_profile_id
  )
  on conflict (shift_id, provider_profile_id) do update
    set status = 'countered', updated_at = now()
    where operational_shift_assignments.status not in ('claimed', 'assigned', 'completed')
  returning * into v_assignment;
  if v_assignment.id is null then
    raise exception using errcode = 'P0001', message = 'accepted_shift_cannot_be_countered';
  end if;
  insert into public.nurse_offer_counters (
    tenant_id, shift_id, assignment_id, offer_terms_id, provider_profile_id,
    request_key, requested_terms
  ) values (
    p_tenant_id, p_shift_id, v_assignment.id, v_offer.id, p_provider_profile_id,
    p_request_key, p_requested_terms
  ) returning * into v_counter;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_countered', p_shift_id,
    jsonb_build_object('provider_profile_id', p_provider_profile_id, 'counter_id', v_counter.id)
  );
  return v_counter;
end;
$$;

-- Replace migration 050's narrow marketplace claim with the same row-locking
-- behavior plus the complete, fresh nurse-readiness and immutable-terms gate.
-- Credential/scope, appointment authorization/payment, safety holds, and
-- schedule conflicts are rechecked inside this transaction.
create or replace function public.claim_operational_shift(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count integer;
  v_assignment public.operational_shift_assignments%rowtype;
  v_gfe_status text;
  v_max_daily_hours numeric;
  v_max_daily_stops integer;
  v_min_turnaround_minutes integer;
  v_offer public.nurse_offer_terms%rowtype;
  v_patient_person_id uuid;
  v_payment_status text;
  v_readiness public.nurse_shift_readiness_snapshots%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  select * into v_shift
  from public.operational_shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_not_found'; end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider_profile_id::text, 0));
  select
    coalesce(nullif(preferences.availability ->> 'max_daily_hours', '')::numeric, 8),
    coalesce(nullif(preferences.service_preferences ->> 'max_daily_stops', '')::integer, 8),
    coalesce(nullif(preferences.service_preferences ->> 'minimum_turnaround_minutes', '')::integer, 15)
    into v_max_daily_hours, v_max_daily_stops, v_min_turnaround_minutes
  from public.provider_work_preferences preferences
  where preferences.tenant_id = p_tenant_id
    and preferences.provider_profile_id = p_provider_profile_id
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'provider_work_preferences_required';
  end if;
  perform app_private.assert_operational_provider(
    p_tenant_id, p_provider_profile_id, v_shift.role_required
  );
  perform app_private.assert_nurse_operational_evidence(
    p_tenant_id, p_shift_id, p_provider_profile_id, v_shift.appointment_id
  );
  select * into v_readiness
  from public.nurse_shift_readiness_snapshots
  where tenant_id = p_tenant_id
    and shift_id = p_shift_id
    and provider_profile_id = p_provider_profile_id
    and source_shift_version = p_expected_version
    and overall_status = 'ready'
    and claim_allowed
    and invalidated_at is null
    and expires_at > clock_timestamp()
  order by checked_at desc
  limit 1
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'fresh_readiness_required'; end if;
  select * into v_offer
  from public.nurse_offer_terms
  where tenant_id = p_tenant_id
    and shift_id = p_shift_id
    and provider_profile_id = p_provider_profile_id
    and status in ('proposed', 'accepted')
    and expires_at > clock_timestamp()
  order by terms_version desc
  limit 1
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'current_offer_terms_required'; end if;
  perform app_private.assert_nurse_offer_engagement(
    p_tenant_id, p_provider_profile_id, v_offer.engagement_model
  );
  if v_shift.appointment_id is not null then
    select a.gfe_status, a.payment_status, a.patient_person_id
      into v_gfe_status, v_payment_status, v_patient_person_id
    from public.appointments a
    where a.tenant_id = p_tenant_id and a.id = v_shift.appointment_id
    for share;
    if not found then raise exception using errcode = 'P0001', message = 'appointment_readiness_unavailable'; end if;
    if lower(coalesce(v_gfe_status, '')) not in ('approved', 'clear', 'cleared', 'complete', 'completed', 'not_required') then
      raise exception using errcode = 'P0001', message = 'gfe_not_ready';
    end if;
    if lower(coalesce(v_payment_status, '')) not in ('authorized', 'captured', 'paid', 'deposit_paid', 'succeeded', 'not_required', 'waived', 'complete', 'completed') then
      raise exception using errcode = 'P0001', message = 'patient_payment_not_ready';
    end if;
    if v_patient_person_id is not null and exists (
      select 1 from public.do_not_treat_flags f
      where f.tenant_id = p_tenant_id
        and f.patient_person_id = v_patient_person_id
        and f.active and f.resolved_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'active_safety_hold';
    end if;
  end if;
  if exists (
    select 1
    from public.operational_shift_assignments a
    join public.operational_shifts s
      on s.tenant_id = a.tenant_id and s.id = a.shift_id
    where a.tenant_id = p_tenant_id
      and a.provider_profile_id = p_provider_profile_id
      and a.status in ('claimed', 'assigned')
      and s.id <> p_shift_id
      and s.status not in ('completed', 'cancelled')
      and s.starts_at < v_shift.ends_at
      and s.ends_at > v_shift.starts_at
  ) then
    raise exception using errcode = 'P0001', message = 'provider_schedule_conflict';
  end if;
  if v_min_turnaround_minutes > 0 and exists (
    select 1
    from public.operational_shift_assignments assignment
    join public.operational_shifts scheduled
      on scheduled.tenant_id = assignment.tenant_id and scheduled.id = assignment.shift_id
    where assignment.tenant_id = p_tenant_id
      and assignment.provider_profile_id = p_provider_profile_id
      and assignment.status in ('claimed', 'assigned')
      and scheduled.id <> p_shift_id
      and scheduled.status not in ('completed', 'cancelled')
      and (
        (scheduled.ends_at <= v_shift.starts_at
          and scheduled.ends_at + make_interval(mins => v_min_turnaround_minutes) > v_shift.starts_at)
        or (scheduled.starts_at >= v_shift.ends_at
          and v_shift.ends_at + make_interval(mins => v_min_turnaround_minutes) > scheduled.starts_at)
      )
  ) then
    raise exception using errcode = 'P0001', message = 'minimum_turnaround_not_met';
  end if;
  select count(*) into v_active_count
  from public.operational_shift_assignments assignment
  join public.operational_shifts scheduled
    on scheduled.tenant_id = assignment.tenant_id and scheduled.id = assignment.shift_id
  where assignment.tenant_id = p_tenant_id
    and assignment.provider_profile_id = p_provider_profile_id
    and assignment.status in ('claimed', 'assigned')
    and scheduled.id <> p_shift_id
    and scheduled.status not in ('completed', 'cancelled')
    and (scheduled.starts_at at time zone v_shift.timezone)::date
      = (v_shift.starts_at at time zone v_shift.timezone)::date;
  if v_active_count + 1 > v_max_daily_stops then
    raise exception using errcode = 'P0001', message = 'maximum_daily_stops_reached';
  end if;
  if (
    coalesce((
      select sum(extract(epoch from (scheduled.ends_at - scheduled.starts_at)) / 3600.0)
      from public.operational_shift_assignments assignment
      join public.operational_shifts scheduled
        on scheduled.tenant_id = assignment.tenant_id and scheduled.id = assignment.shift_id
      where assignment.tenant_id = p_tenant_id
        and assignment.provider_profile_id = p_provider_profile_id
        and assignment.status in ('claimed', 'assigned')
        and scheduled.id <> p_shift_id
        and scheduled.status not in ('completed', 'cancelled')
        and (scheduled.starts_at at time zone v_shift.timezone)::date
          = (v_shift.starts_at at time zone v_shift.timezone)::date
    ), 0) + extract(epoch from (v_shift.ends_at - v_shift.starts_at)) / 3600.0
  ) > v_max_daily_hours then
    raise exception using errcode = 'P0001', message = 'maximum_daily_hours_exceeded';
  end if;
  select * into v_assignment
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.provider_profile_id = p_provider_profile_id
  for update;
  if found and v_assignment.status in ('claimed', 'assigned', 'completed') then
    return v_assignment;
  end if;
  if v_shift.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'shift_not_open';
  end if;
  select count(*) into v_active_count
  from public.operational_shift_assignments a
  where a.tenant_id = p_tenant_id
    and a.shift_id = p_shift_id
    and a.status in ('claimed', 'assigned', 'completed');
  if v_active_count >= v_shift.slots_required then
    raise exception using errcode = 'P0001', message = 'shift_full';
  end if;
  insert into public.operational_shift_assignments (
    tenant_id, shift_id, provider_profile_id, status, claimed_at, created_by
  ) values (
    p_tenant_id, p_shift_id, p_provider_profile_id, 'claimed', now(), p_actor_profile_id
  )
  on conflict (shift_id, provider_profile_id) do update
  set status = 'claimed', claimed_at = now(), completed_at = null,
      created_by = p_actor_profile_id, updated_at = now()
  returning * into v_assignment;
  update public.nurse_offer_terms
  set status = 'accepted', accepted_at = coalesce(accepted_at, clock_timestamp())
  where tenant_id = p_tenant_id and id = v_offer.id;
  update public.operational_shifts
  set status = case when v_active_count + 1 >= slots_required then 'assigned' else 'open' end,
      version = version + 1
  where tenant_id = p_tenant_id and id = p_shift_id;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'operational_shift_claimed', p_shift_id,
    jsonb_build_object(
      'provider_profile_id', p_provider_profile_id,
      'version', v_shift.version + 1,
      'readiness_snapshot_id', v_readiness.id,
      'offer_terms_id', v_offer.id
    )
  );
  return v_assignment;
end;
$$;

create or replace function public.start_nurse_shift_run(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_shift_id uuid,
  p_provider_profile_id uuid,
  p_expected_version integer
)
returns public.mobile_shift_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.operational_shift_assignments%rowtype;
  v_gfe_status text;
  v_guide_id uuid;
  v_guide_label text;
  v_offer public.nurse_offer_terms%rowtype;
  v_patient_person_id uuid;
  v_payment_status text;
  v_protocol_key text;
  v_readiness public.nurse_shift_readiness_snapshots%rowtype;
  v_run public.mobile_shift_runs%rowtype;
  v_shift public.operational_shifts%rowtype;
  v_route_day_id uuid;
begin
  perform app_private.assert_nurse_self(p_tenant_id, p_provider_profile_id, p_actor_profile_id);
  select * into v_shift from public.operational_shifts
    where tenant_id = p_tenant_id and id = p_shift_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_not_found'; end if;
  if p_expected_version is null or v_shift.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_version_conflict';
  end if;
  select * into v_assignment from public.operational_shift_assignments
    where tenant_id = p_tenant_id and shift_id = p_shift_id
      and provider_profile_id = p_provider_profile_id
      and status in ('claimed', 'assigned') for update;
  if not found then raise exception using errcode = '42501', message = 'accepted_assignment_required'; end if;
  select * into v_run from public.mobile_shift_runs
    where tenant_id = p_tenant_id and shift_id = p_shift_id
      and provider_profile_id = p_provider_profile_id for update;
  if found then return v_run; end if;
  perform app_private.assert_operational_provider(
    p_tenant_id, p_provider_profile_id, v_shift.role_required
  );
  perform app_private.assert_nurse_operational_evidence(
    p_tenant_id, p_shift_id, p_provider_profile_id, v_shift.appointment_id
  );
  select * into v_readiness from public.nurse_shift_readiness_snapshots
    where tenant_id = p_tenant_id and shift_id = p_shift_id
      and provider_profile_id = p_provider_profile_id
      and source_shift_version = p_expected_version
      and claim_allowed and overall_status = 'ready'
      and invalidated_at is null
      and expires_at > clock_timestamp()
    order by checked_at desc limit 1
    for share;
  if not found then raise exception using errcode = 'P0001', message = 'fresh_readiness_required'; end if;
  select * into v_offer from public.nurse_offer_terms
    where tenant_id = p_tenant_id and shift_id = p_shift_id
      and provider_profile_id = p_provider_profile_id
      and status = 'accepted'
    order by terms_version desc limit 1
    for share;
  if not found then raise exception using errcode = 'P0001', message = 'current_offer_terms_required'; end if;
  perform app_private.assert_nurse_offer_engagement(
    p_tenant_id, p_provider_profile_id, v_offer.engagement_model
  );
  if v_shift.appointment_id is not null then
    select a.gfe_status, a.payment_status, a.patient_person_id
      into v_gfe_status, v_payment_status, v_patient_person_id
    from public.appointments a
    where a.tenant_id = p_tenant_id and a.id = v_shift.appointment_id
    for share;
    if not found then raise exception using errcode = 'P0001', message = 'appointment_readiness_unavailable'; end if;
    if lower(coalesce(v_gfe_status, '')) not in ('approved', 'clear', 'cleared', 'complete', 'completed', 'not_required') then
      raise exception using errcode = 'P0001', message = 'gfe_not_ready';
    end if;
    if lower(coalesce(v_payment_status, '')) not in ('authorized', 'captured', 'paid', 'deposit_paid', 'succeeded', 'not_required', 'waived', 'complete', 'completed') then
      raise exception using errcode = 'P0001', message = 'patient_payment_not_ready';
    end if;
    if v_patient_person_id is not null and exists (
      select 1 from public.do_not_treat_flags f
      where f.tenant_id = p_tenant_id
        and f.patient_person_id = v_patient_person_id
        and f.active and f.resolved_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'active_safety_hold';
    end if;
  end if;
  if v_shift.appointment_id is not null then
    select appointment.protocol_key into v_protocol_key
    from public.appointments appointment
    where appointment.tenant_id = p_tenant_id and appointment.id = v_shift.appointment_id
    for share;
    if nullif(trim(v_protocol_key), '') is null then
      raise exception using errcode = 'P0001', message = 'appointment_protocol_guide_required';
    end if;
  end if;
  select gv.id, gt.template_key || '@' || gv.version::text
    into v_guide_id, v_guide_label
  from public.shift_guide_templates gt
  join public.shift_guide_versions gv
    on gv.tenant_id = gt.tenant_id and gv.template_id = gt.id
  where gt.tenant_id = p_tenant_id
    and gt.active
    and gv.status = 'approved'
    and gt.work_kind = case when v_shift.event_container_id is null then 'mobile_appointment' else 'event_handoff' end
    and (
      v_shift.event_container_id is not null
      or lower(trim(gt.protocol_key)) = lower(trim(v_protocol_key))
    )
    and case lower(trim(v_shift.role_required))
      when 'np' then lower(trim(gt.role_required)) in ('np', 'rn', 'nurse', 'registered nurse')
      else lower(trim(gt.role_required)) in ('rn', 'nurse', 'registered nurse')
    end
  order by gv.version desc
  limit 1;
  if v_guide_id is null then
    raise exception using errcode = 'P0001', message = 'approved_guide_required';
  end if;
  select rd.id into v_route_day_id
  from public.provider_route_days rd
  where rd.tenant_id = p_tenant_id
    and rd.provider_profile_id = p_provider_profile_id
    and rd.route_date = (v_shift.starts_at at time zone v_shift.timezone)::date
  limit 1;
  insert into public.mobile_shift_runs (
    tenant_id, shift_id, assignment_id, provider_profile_id,
    route_day_id, readiness_snapshot_id, offer_terms_id, guide_version_id, guide_version
  ) values (
    p_tenant_id, p_shift_id, v_assignment.id, p_provider_profile_id,
    v_route_day_id, v_readiness.id, v_offer.id, v_guide_id, v_guide_label
  )
  on conflict (shift_id, provider_profile_id) do nothing
  returning * into v_run;
  if not found then
    select * into v_run from public.mobile_shift_runs
      where tenant_id = p_tenant_id and shift_id = p_shift_id
        and provider_profile_id = p_provider_profile_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'shift_run_start_conflict'; end if;
    return v_run;
  end if;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'mobile_shift_run_started', p_shift_id,
    jsonb_build_object('run_id', v_run.id, 'readiness_snapshot_id', v_readiness.id)
  );
  return v_run;
end;
$$;

create or replace function public.record_nurse_time_event(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_run_id uuid,
  p_event_type text,
  p_idempotency_key uuid,
  p_device_occurred_at timestamptz default null,
  p_reason_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.mobile_shift_time_events%rowtype;
  v_open_break boolean;
  v_open_exceptions boolean;
  v_readiness public.nurse_shift_readiness_snapshots%rowtype;
  v_run public.mobile_shift_runs%rowtype;
  v_shift public.operational_shifts%rowtype;
begin
  if p_event_type not in ('clock_in', 'break_start', 'break_end', 'clock_out', 'correction_request', 'offline_sync') then
    raise exception using errcode = '22023', message = 'time_event_type_invalid';
  end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'idempotency_key_required'; end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 4096 then
    raise exception using errcode = '22023', message = 'time_event_metadata_invalid';
  end if;
  select * into v_run from public.mobile_shift_runs
    where tenant_id = p_tenant_id and id = p_run_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_run_not_found'; end if;
  perform app_private.assert_nurse_self(p_tenant_id, v_run.provider_profile_id, p_actor_profile_id);
  select * into v_event from public.mobile_shift_time_events
    where shift_run_id = p_run_id and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('event', to_jsonb(v_event), 'run', to_jsonb(v_run)); end if;
  select coalesce((
    select event_type = 'break_start'
    from public.mobile_shift_time_events
    where tenant_id = p_tenant_id and shift_run_id = p_run_id
      and event_type in ('break_start', 'break_end')
    order by occurred_at desc, created_at desc limit 1
  ), false) into v_open_break;
  if p_event_type = 'clock_in' then
    if v_run.clocked_out_at is not null then raise exception using errcode = 'P0001', message = 'shift_already_clocked_out'; end if;
    if v_run.clocked_in_at is not null then raise exception using errcode = 'P0001', message = 'shift_already_clocked_in'; end if;
    if exists (
      select 1 from public.shift_exceptions
      where tenant_id = p_tenant_id and shift_run_id = p_run_id
        and status in ('open', 'acknowledged')
    ) then
      raise exception using errcode = 'P0001', message = 'open_shift_exception';
    end if;
    select * into v_shift from public.operational_shifts
      where tenant_id = p_tenant_id and id = v_run.shift_id for share;
    if not found then raise exception using errcode = 'P0002', message = 'shift_not_found'; end if;
    perform app_private.assert_operational_provider(
      p_tenant_id, v_run.provider_profile_id, v_shift.role_required
    );
    perform app_private.assert_nurse_operational_evidence(
      p_tenant_id, v_shift.id, v_run.provider_profile_id, v_shift.appointment_id
    );
    perform app_private.assert_nurse_patient_gate(p_tenant_id, v_shift.appointment_id);
    select * into v_readiness from public.nurse_shift_readiness_snapshots
      where tenant_id = p_tenant_id and shift_id = v_shift.id
        and provider_profile_id = v_run.provider_profile_id
        and source_shift_version = v_shift.version
        and claim_allowed and overall_status = 'ready'
        and invalidated_at is null and expires_at > clock_timestamp()
      order by checked_at desc limit 1
      for share;
    if not found then raise exception using errcode = 'P0001', message = 'fresh_readiness_required'; end if;
  elsif p_event_type = 'break_start' then
    if v_run.clocked_in_at is null or v_run.clocked_out_at is not null then raise exception using errcode = 'P0001', message = 'active_clock_required'; end if;
    if v_open_break then raise exception using errcode = 'P0001', message = 'break_already_open'; end if;
    if coalesce(p_metadata ->> 'handoff_confirmed', 'false') <> 'true' then
      raise exception using errcode = 'P0001', message = 'break_handoff_confirmation_required';
    end if;
  elsif p_event_type = 'break_end' then
    if not v_open_break then raise exception using errcode = 'P0001', message = 'open_break_required'; end if;
    if v_run.clocked_out_at is not null then raise exception using errcode = 'P0001', message = 'shift_already_clocked_out'; end if;
  elsif p_event_type = 'clock_out' then
    if v_run.clocked_in_at is null then raise exception using errcode = 'P0001', message = 'clock_in_required'; end if;
    if v_run.clocked_out_at is not null then raise exception using errcode = 'P0001', message = 'shift_already_clocked_out'; end if;
  end if;
  insert into public.mobile_shift_time_events (
    tenant_id, shift_run_id, provider_profile_id, event_type,
    idempotency_key, device_occurred_at, reason_code, metadata
  ) values (
    p_tenant_id, p_run_id, v_run.provider_profile_id, p_event_type,
    p_idempotency_key, p_device_occurred_at, nullif(trim(p_reason_code), ''),
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_event;
  if p_event_type = 'correction_request' then
    if nullif(trim(p_reason_code), '') is null then
      raise exception using errcode = '22023', message = 'correction_reason_required';
    end if;
    insert into public.shift_exceptions (
      tenant_id, shift_run_id, provider_profile_id, kind, severity,
      reason_code, owner_role, idempotency_key
    ) values (
      p_tenant_id, p_run_id, v_run.provider_profile_id, 'time', 'operational',
      trim(p_reason_code), 'payroll_operations', p_idempotency_key
    ) on conflict (shift_run_id, idempotency_key) do nothing;
  end if;
  if p_event_type = 'clock_in' then
    update public.mobile_shift_runs set
      clocked_in_at = v_event.occurred_at, status = 'clocked_in',
      version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  elsif p_event_type = 'clock_out' then
    select v_open_break or exists (
      select 1 from public.shift_exceptions
      where tenant_id = p_tenant_id and shift_run_id = p_run_id
        and status in ('open', 'acknowledged')
    ) into v_open_exceptions;
    update public.mobile_shift_runs set
      clocked_out_at = v_event.occurred_at,
      status = case when v_open_exceptions then 'exception_review' else 'clocked_out' end,
      version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  else
    update public.mobile_shift_runs set version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  end if;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'mobile_shift_time_' || p_event_type,
    v_run.shift_id, jsonb_build_object('run_id', p_run_id, 'event_id', v_event.id)
  );
  return jsonb_build_object('event', to_jsonb(v_event), 'run', to_jsonb(v_run));
end;
$$;

create or replace function public.record_nurse_step_event(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_run_id uuid,
  p_step_key text,
  p_resolution text,
  p_reason_code text,
  p_idempotency_key uuid,
  p_device_occurred_at timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.mobile_shift_step_events%rowtype;
  v_run public.mobile_shift_runs%rowtype;
begin
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'idempotency_key_required'; end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_payload, '{}'::jsonb)) > 8192 then
    raise exception using errcode = '22023', message = 'step_payload_invalid';
  end if;
  select * into v_run from public.mobile_shift_runs
    where tenant_id = p_tenant_id and id = p_run_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_run_not_found'; end if;
  perform app_private.assert_nurse_self(p_tenant_id, v_run.provider_profile_id, p_actor_profile_id);
  if v_run.status in ('time_submitted', 'closed') then
    raise exception using errcode = 'P0001', message = 'shift_run_already_closed';
  end if;
  if p_resolution not in (
    'patient_declined', 'clinically_contraindicated',
    'blocked_by_safety', 'blocked_by_system', 'handed_off'
  ) and p_step_key not in ('source_record_closed', 'kit_reconciled', 'route_reconciled') then
    perform 1
    from public.nurse_shift_readiness_snapshots readiness
    join public.operational_shifts shift
      on shift.tenant_id = readiness.tenant_id and shift.id = readiness.shift_id
    where readiness.tenant_id = p_tenant_id
      and readiness.shift_id = v_run.shift_id
      and readiness.provider_profile_id = v_run.provider_profile_id
      and readiness.source_shift_version = shift.version
      and readiness.overall_status = 'ready'
      and readiness.claim_allowed
      and readiness.invalidated_at is null
      and readiness.expires_at > clock_timestamp()
    order by readiness.checked_at desc
    limit 1
    for share of readiness, shift;
    if not found then
      raise exception using errcode = 'P0001', message = 'current_readiness_blocks_care_step';
    end if;
  end if;
  if not exists (
    select 1
    from public.shift_guide_versions gv
    where gv.tenant_id = p_tenant_id
      and gv.id = v_run.guide_version_id
      and (
        trim(p_step_key) = any(gv.required_closeout_keys)
        or exists (
          select 1
          from jsonb_array_elements(gv.steps) as guide_step
          where trim(coalesce(guide_step ->> 'step_key', guide_step ->> 'key', '')) = trim(p_step_key)
        )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'guide_step_not_allowed';
  end if;
  select * into v_event from public.mobile_shift_step_events
    where shift_run_id = p_run_id and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('event', to_jsonb(v_event), 'run', to_jsonb(v_run)); end if;
  insert into public.mobile_shift_step_events (
    tenant_id, shift_run_id, provider_profile_id, step_key, resolution,
    reason_code, idempotency_key, device_occurred_at, payload
  ) values (
    p_tenant_id, p_run_id, v_run.provider_profile_id, trim(p_step_key), p_resolution,
    nullif(trim(p_reason_code), ''), p_idempotency_key, p_device_occurred_at,
    coalesce(p_payload, '{}'::jsonb)
  ) returning * into v_event;
  if p_resolution in ('blocked_by_safety', 'blocked_by_system') then
    insert into public.shift_exceptions (
      tenant_id, shift_run_id, provider_profile_id, kind, severity,
      reason_code, owner_role, note, idempotency_key
    ) values (
      p_tenant_id, p_run_id, v_run.provider_profile_id,
      case when p_resolution = 'blocked_by_safety' then 'safety' else 'system' end,
      case when p_resolution = 'blocked_by_safety' then 'urgent' else 'operational' end,
      coalesce(nullif(trim(p_reason_code), ''), p_resolution),
      case when p_resolution = 'blocked_by_safety' then 'clinical_operations' else 'operations' end,
      nullif(trim(p_payload ->> 'operational_note'), ''),
      p_idempotency_key
    );
    update public.mobile_shift_runs set
      current_step_key = trim(p_step_key), status = 'exception_review',
      version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  else
    update public.mobile_shift_runs set
      current_step_key = trim(p_step_key), version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  end if;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'mobile_shift_step_resolved',
    v_run.shift_id,
    jsonb_build_object('run_id', p_run_id, 'event_id', v_event.id, 'step_key', v_event.step_key, 'resolution', v_event.resolution)
  );
  return jsonb_build_object('event', to_jsonb(v_event), 'run', to_jsonb(v_run));
end;
$$;

create or replace function public.open_nurse_shift_exception(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_run_id uuid,
  p_kind text,
  p_severity text,
  p_reason_code text,
  p_owner_role text,
  p_note text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exception public.shift_exceptions%rowtype;
  v_run public.mobile_shift_runs%rowtype;
begin
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'idempotency_key_required'; end if;
  select * into v_run from public.mobile_shift_runs
    where tenant_id = p_tenant_id and id = p_run_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_run_not_found'; end if;
  perform app_private.assert_nurse_self(p_tenant_id, v_run.provider_profile_id, p_actor_profile_id);
  select * into v_exception from public.shift_exceptions
    where shift_run_id = p_run_id and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('exception', to_jsonb(v_exception), 'run', to_jsonb(v_run)); end if;
  insert into public.shift_exceptions (
    tenant_id, shift_run_id, provider_profile_id, kind, severity,
    reason_code, owner_role, note, idempotency_key
  ) values (
    p_tenant_id, p_run_id, v_run.provider_profile_id, p_kind,
    coalesce(nullif(trim(p_severity), ''), 'operational'), trim(p_reason_code),
    trim(p_owner_role), nullif(trim(p_note), ''), p_idempotency_key
  ) returning * into v_exception;
  if p_kind in ('safety', 'clinical', 'emergency') or p_severity in ('urgent', 'emergency') then
    update public.mobile_shift_runs set
      status = 'exception_review', version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  else
    update public.mobile_shift_runs set version = version + 1, updated_at = now()
    where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  end if;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'mobile_shift_exception_opened',
    v_run.shift_id,
    jsonb_build_object('run_id', p_run_id, 'exception_id', v_exception.id, 'kind', v_exception.kind, 'severity', v_exception.severity)
  );
  return jsonb_build_object('exception', to_jsonb(v_exception), 'run', to_jsonb(v_run));
end;
$$;

create or replace function public.close_nurse_shift_run(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_run_id uuid,
  p_expected_version integer
)
returns public.mobile_shift_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_missing text[] := '{}'::text[];
  v_open_exceptions boolean;
  v_required text;
  v_required_keys text[];
  v_run public.mobile_shift_runs%rowtype;
begin
  select * into v_run from public.mobile_shift_runs
    where tenant_id = p_tenant_id and id = p_run_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'shift_run_not_found'; end if;
  perform app_private.assert_nurse_self(p_tenant_id, v_run.provider_profile_id, p_actor_profile_id);
  if p_expected_version is null or v_run.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'shift_run_version_conflict';
  end if;
  if v_run.status in ('time_submitted', 'closed') then
    raise exception using errcode = 'P0001', message = 'shift_run_already_closed';
  end if;
  if v_run.clocked_out_at is null then raise exception using errcode = 'P0001', message = 'clock_out_required'; end if;
  select required_closeout_keys into v_required_keys
  from public.shift_guide_versions
  where tenant_id = p_tenant_id and id = v_run.guide_version_id;
  if not found then raise exception using errcode = 'P0001', message = 'approved_guide_required'; end if;
  foreach v_required in array v_required_keys loop
    if not coalesce((
      select event.resolution in ('completed', 'not_applicable', 'handed_off')
      from public.mobile_shift_step_events event
      where event.tenant_id = p_tenant_id and event.shift_run_id = p_run_id
        and event.step_key = v_required
      order by event.occurred_at desc, event.created_at desc
      limit 1
    ), false) then
      v_missing := array_append(v_missing, v_required);
    end if;
  end loop;
  select exists (
      select 1 from public.shift_exceptions
      where tenant_id = p_tenant_id and shift_run_id = p_run_id
        and status in ('open', 'acknowledged')
    ) or coalesce((
      select event_type = 'break_start'
      from public.mobile_shift_time_events
      where tenant_id = p_tenant_id and shift_run_id = p_run_id
        and event_type in ('break_start', 'break_end')
      order by occurred_at desc, created_at desc limit 1
    ), false)
  into v_open_exceptions;
  update public.mobile_shift_runs set
    status = case
      when v_open_exceptions or cardinality(v_missing) > 0 then 'exception_review'
      else 'time_submitted'
    end,
    closed_at = case when not v_open_exceptions and cardinality(v_missing) = 0 then clock_timestamp() else closed_at end,
    version = version + 1,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_run_id returning * into v_run;
  perform app_private.append_operational_audit(
    p_tenant_id, p_actor_profile_id, 'mobile_shift_closeout_submitted',
    v_run.shift_id,
    jsonb_build_object('run_id', p_run_id, 'status', v_run.status, 'missing_step_keys', v_missing)
  );
  return v_run;
end;
$$;

revoke all on function public.decline_operational_shift(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.counter_operational_shift_offer(uuid, uuid, uuid, uuid, integer, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_operational_shift(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.start_nurse_shift_run(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.record_nurse_time_event(uuid, uuid, uuid, text, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_nurse_step_event(uuid, uuid, uuid, text, text, text, uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.open_nurse_shift_exception(uuid, uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.close_nurse_shift_run(uuid, uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.decline_operational_shift(uuid, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.counter_operational_shift_offer(uuid, uuid, uuid, uuid, integer, uuid, jsonb) to service_role;
grant execute on function public.claim_operational_shift(uuid, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.start_nurse_shift_run(uuid, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.record_nurse_time_event(uuid, uuid, uuid, text, uuid, timestamptz, text, jsonb) to service_role;
grant execute on function public.record_nurse_step_event(uuid, uuid, uuid, text, text, text, uuid, timestamptz, jsonb) to service_role;
grant execute on function public.open_nurse_shift_exception(uuid, uuid, uuid, text, text, text, text, text, uuid) to service_role;
grant execute on function public.close_nurse_shift_run(uuid, uuid, uuid, integer) to service_role;

comment on table public.provider_work_preferences is
  'Nurse-controlled work preferences. Engagement status remains human-controlled and defaults to W-2.';
comment on table public.nurse_shift_domain_evidence is
  'Authoritative domain evidence used by the server readiness evaluator; no UI attestation can self-clear a domain.';
comment on table public.nurse_shift_readiness_snapshots is
  'Short-lived server readiness evidence. A stale snapshot cannot authorize claim or shift start.';
comment on table public.nurse_offer_terms is
  'Versioned PHI-free offer terms. A nurse cannot accept work until current compensation and cancellation terms exist.';
comment on table public.shift_guide_templates is
  'Role and work-kind guide identity. No clinical guide content is seeded by this migration.';
comment on table public.shift_guide_versions is
  'Human-approved, immutable-at-run guide versions; draft content cannot start a nurse run.';
comment on table public.mobile_shift_time_events is
  'Append-only actual-time events with separate device and server timestamps.';
comment on table public.mobile_shift_step_events is
  'Append-only nurse operational step resolutions. Clinical content remains in the source record.';
comment on table public.shift_exceptions is
  'Structured nurse issues and emergency paths with human ownership and immutable original nurse report.';

commit;
