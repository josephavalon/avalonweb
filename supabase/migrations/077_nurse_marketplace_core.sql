-- Nurse marketplace source-of-work, offers, immutable decisions, and policy controls.
-- No work, policy, approval, or fixture data is seeded. All browser writes remain denied.

begin;

do $$
begin
  if to_regclass('public.operational_shifts') is null
     or to_regclass('public.operational_shift_assignments') is null
     or to_regclass('public.nurse_offer_terms') is null
     or to_regclass('public.nurse_shift_readiness_snapshots') is null
     or to_regclass('public.provider_profiles') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.appointments') is null
     or to_regprocedure('public.touch_updated_at()') is null
     or to_regprocedure('app_private.prevent_os_append_only_mutation()') is null
     or to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception using errcode = 'P0001', message = 'nurse_marketplace_dependencies_required';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shifts'::regclass
      and conname = 'operational_shifts_tenant_id_id_key'
      and contype = 'u' and convalidated
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.operational_shift_assignments'::regclass
      and conname = 'operational_shift_assignments_tenant_id_id_key'
      and contype = 'u' and convalidated
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nurse_offer_terms'::regclass
      and conname = 'nurse_offer_terms_tenant_id_id_key'
      and contype = 'u' and convalidated
  ) then
    raise exception using errcode = 'P0001', message = 'nurse_marketplace_composite_identity_required';
  end if;
end $$;

alter table public.nurse_shift_readiness_snapshots
  add column if not exists evaluation_stage text not null default 'claim';

alter table public.nurse_shift_readiness_snapshots
  drop constraint if exists nurse_shift_readiness_snapshot_status_check;
alter table public.nurse_shift_readiness_snapshots
  add constraint nurse_shift_readiness_snapshot_status_check check (
    not claim_allowed
    or (
      overall_status = 'ready'
      and evaluation_stage in ('offer','claim','run_start')
    )
  );

alter table public.nurse_offer_terms
  add column if not exists terms_hash text,
  add column if not exists accepted_terms_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nurse_shift_readiness_snapshots'::regclass
      and conname = 'nurse_shift_readiness_stage_check'
  ) then
    alter table public.nurse_shift_readiness_snapshots
      add constraint nurse_shift_readiness_stage_check
      check (evaluation_stage in ('offer', 'claim', 'route_release', 'run_start'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_offer_terms'::regclass and conname = 'nurse_offer_terms_hash_check') then
    alter table public.nurse_offer_terms add constraint nurse_offer_terms_hash_check check (
      (terms_hash is null or terms_hash ~ '^[0-9a-f]{64}$')
      and (accepted_terms_hash is null or accepted_terms_hash ~ '^[0-9a-f]{64}$')
    );
  end if;
end $$;

create table if not exists public.nurse_marketplace_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  policy_type text not null check (policy_type in (
    'appointment_mapping', 'offer_wave', 'offer_expiry', 'offer_terms', 'engagement',
    'amendment_materiality', 'route_release', 'recovery', 'supply_manifest',
    'guide_publishing', 'geolocation', 'notification'
  )),
  market_key text not null default 'default'
    check (char_length(trim(market_key)) between 1 and 80),
  version integer not null check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'retired')),
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  rules_hash text not null check (rules_hash ~ '^[0-9a-f]{64}$'),
  approved_by uuid,
  approved_at timestamptz,
  effective_at timestamptz,
  retired_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_marketplace_policies_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_marketplace_policies_version_key unique (tenant_id, policy_type, market_key, version),
  constraint nurse_marketplace_policies_approval_check check (
    status <> 'approved'
    or (approved_by is not null and approved_at is not null and effective_at is not null)
  ),
  constraint nurse_marketplace_policies_retirement_check check (
    status <> 'retired' or retired_at is not null
  ),
  constraint nurse_marketplace_policies_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint nurse_marketplace_policies_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict
);

create unique index if not exists nurse_marketplace_policies_active_uidx
  on public.nurse_marketplace_policies (tenant_id, policy_type, market_key)
  where status = 'approved' and retired_at is null;

create table if not exists public.nurse_appointment_source_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_provider text not null check (char_length(trim(source_provider)) between 1 and 80),
  source_appointment_id text not null check (char_length(trim(source_appointment_id)) between 1 and 180),
  source_revision text not null check (char_length(trim(source_revision)) between 1 and 180),
  event_type text not null check (event_type in (
    'scheduled', 'rescheduled', 'changed', 'service_changed', 'cancelled', 'provider_changed', 'repair_snapshot'
  )),
  event_occurred_at timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  signature_verified_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'processed', 'ignored', 'failed', 'dead_letter')),
  lease_owner text,
  lease_expires_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 100),
  next_attempt_at timestamptz not null default clock_timestamp(),
  processed_at timestamptz,
  failure_code text check (failure_code is null or char_length(failure_code) <= 100),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_appointment_source_events_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_appointment_source_events_revision_key
    unique (tenant_id, source_provider, source_appointment_id, source_revision, event_type),
  constraint nurse_appointment_source_events_lease_check check (
    (status = 'leased' and lease_owner is not null and lease_expires_at is not null)
    or status <> 'leased'
  )
);

create table if not exists public.nurse_work_source_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_provider text not null check (char_length(trim(source_provider)) between 1 and 80),
  source_appointment_id text not null check (char_length(trim(source_appointment_id)) between 1 and 180),
  appointment_id uuid not null,
  shift_id uuid not null,
  last_source_event_id uuid not null,
  last_source_revision text not null check (char_length(trim(last_source_revision)) between 1 and 180),
  status text not null default 'active' check (status in ('active', 'cancelled', 'superseded')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_work_source_links_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_work_source_links_source_key unique (tenant_id, source_provider, source_appointment_id),
  constraint nurse_work_source_links_appointment_fk foreign key (tenant_id, appointment_id)
    references public.appointments(tenant_id, id) on delete restrict,
  constraint nurse_work_source_links_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete restrict,
  constraint nurse_work_source_links_event_fk foreign key (tenant_id, last_source_event_id)
    references public.nurse_appointment_source_events(tenant_id, id) on delete restrict
);

create table if not exists public.nurse_shift_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  offer_terms_id uuid not null,
  readiness_snapshot_id uuid not null,
  wave_key text not null check (char_length(trim(wave_key)) between 1 and 100),
  cohort_key text not null check (char_length(trim(cohort_key)) between 1 and 100),
  status text not null default 'pending' check (status in (
    'pending', 'offered', 'delivered', 'viewed', 'accepted', 'declined', 'ignored',
    'countered', 'expired', 'revoked', 'unavailable'
  )),
  version integer not null default 1 check (version > 0),
  offered_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  viewed_at timestamptz,
  acted_at timestamptz,
  revoked_at timestamptz,
  revocation_code text check (revocation_code is null or char_length(revocation_code) <= 100),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_shift_offers_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_shift_offers_shift_provider_terms_key unique (tenant_id, shift_id, provider_profile_id, offer_terms_id),
  constraint nurse_shift_offers_time_check check (expires_at > offered_at),
  constraint nurse_shift_offers_action_check check (
    status not in ('accepted', 'declined', 'ignored', 'countered') or acted_at is not null
  ),
  constraint nurse_shift_offers_revocation_check check (
    status <> 'revoked' or (revoked_at is not null and revocation_code is not null)
  ),
  constraint nurse_shift_offers_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete cascade,
  constraint nurse_shift_offers_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete cascade,
  constraint nurse_shift_offers_terms_fk foreign key (tenant_id, offer_terms_id)
    references public.nurse_offer_terms(tenant_id, id) on delete restrict,
  constraint nurse_shift_offers_readiness_fk foreign key (tenant_id, readiness_snapshot_id)
    references public.nurse_shift_readiness_snapshots(tenant_id, id) on delete restrict,
  constraint nurse_shift_offers_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict
);

create unique index if not exists nurse_shift_offers_actionable_provider_uidx
  on public.nurse_shift_offers (tenant_id, shift_id, provider_profile_id)
  where status in ('pending', 'offered', 'delivered', 'viewed');
create index if not exists nurse_shift_offers_provider_queue_idx
  on public.nurse_shift_offers (tenant_id, provider_profile_id, status, offered_at desc);

create table if not exists public.nurse_offer_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offer_id uuid not null,
  provider_profile_id uuid not null,
  channel text not null check (channel in ('in_app', 'realtime', 'poll_recovery', 'web_push', 'sms', 'email')),
  status text not null default 'queued' check (status in (
    'pending', 'queued', 'leased', 'sent', 'delivered', 'failed', 'suppressed', 'dead_letter'
  )),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 16 and 200),
  lease_owner text,
  lease_expires_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 100),
  next_attempt_at timestamptz not null default clock_timestamp(),
  provider_message_id text,
  failure_code text check (failure_code is null or char_length(failure_code) <= 100),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint nurse_offer_deliveries_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_offer_deliveries_idempotency_key unique (tenant_id, idempotency_key),
  constraint nurse_offer_deliveries_offer_fk foreign key (tenant_id, offer_id)
    references public.nurse_shift_offers(tenant_id, id) on delete cascade,
  constraint nurse_offer_deliveries_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete cascade,
  constraint nurse_offer_deliveries_lease_check check (
    (status = 'leased' and lease_owner is not null and lease_expires_at is not null)
    or status <> 'leased'
  )
);

create table if not exists public.nurse_offer_action_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offer_id uuid not null,
  provider_profile_id uuid not null,
  action text not null check (action in ('view', 'accept', 'decline', 'counter', 'ignore')),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result_status text not null check (char_length(trim(result_status)) between 1 and 100),
  result_reference_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_offer_action_idempotency_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_offer_action_idempotency_request_key unique (tenant_id, provider_profile_id, idempotency_key),
  constraint nurse_offer_action_idempotency_offer_fk foreign key (tenant_id, offer_id)
    references public.nurse_shift_offers(tenant_id, id) on delete restrict,
  constraint nurse_offer_action_idempotency_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete restrict
);

create table if not exists public.nurse_shift_amendments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null,
  provider_profile_id uuid not null,
  assignment_id uuid,
  supersedes_amendment_id uuid,
  amendment_version integer not null check (amendment_version > 0),
  materiality text not null check (materiality in ('non_material', 'material')),
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  changes_hash text not null check (changes_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'withdrawn', 'superseded')),
  accepted_terms_hash text check (accepted_terms_hash is null or accepted_terms_hash ~ '^[0-9a-f]{64}$'),
  proposed_by uuid not null,
  proposed_at timestamptz not null default clock_timestamp(),
  acted_at timestamptz,
  constraint nurse_shift_amendments_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_shift_amendments_version_key unique (tenant_id, shift_id, provider_profile_id, amendment_version),
  constraint nurse_shift_amendments_action_check check (
    status not in ('accepted', 'declined') or acted_at is not null
  ),
  constraint nurse_shift_amendments_material_acceptance_check check (
    not (materiality = 'material' and status = 'accepted') or accepted_terms_hash is not null
  ),
  constraint nurse_shift_amendments_shift_fk foreign key (tenant_id, shift_id)
    references public.operational_shifts(tenant_id, id) on delete restrict,
  constraint nurse_shift_amendments_provider_fk foreign key (tenant_id, provider_profile_id)
    references public.provider_profiles(tenant_id, id) on delete restrict,
  constraint nurse_shift_amendments_assignment_fk foreign key (tenant_id, assignment_id)
    references public.operational_shift_assignments(tenant_id, id) on delete restrict,
  constraint nurse_shift_amendments_parent_fk foreign key (tenant_id, supersedes_amendment_id)
    references public.nurse_shift_amendments(tenant_id, id) on delete restrict,
  constraint nurse_shift_amendments_actor_fk foreign key (tenant_id, proposed_by)
    references public.profiles(tenant_id, id) on delete restrict
);

create table if not exists public.nurse_marketplace_transitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'source_event', 'shift', 'offer', 'assignment', 'amendment', 'readiness', 'delivery',
    'pickup_task', 'route_day'
  )),
  entity_id uuid not null,
  from_status text,
  to_status text not null check (char_length(trim(to_status)) between 1 and 100),
  reason_code text not null check (char_length(trim(reason_code)) between 1 and 100),
  actor_profile_id uuid,
  correlation_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  constraint nurse_marketplace_transitions_tenant_id_id_key unique (tenant_id, id),
  constraint nurse_marketplace_transitions_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict
);

create index if not exists nurse_appointment_source_events_work_idx
  on public.nurse_appointment_source_events (status, next_attempt_at, received_at);
create index if not exists nurse_offer_deliveries_work_idx
  on public.nurse_offer_deliveries (status, next_attempt_at, created_at);
create index if not exists nurse_marketplace_transitions_entity_idx
  on public.nurse_marketplace_transitions (tenant_id, entity_type, entity_id, created_at);

drop trigger if exists touch_nurse_marketplace_policies_updated_at on public.nurse_marketplace_policies;
create trigger touch_nurse_marketplace_policies_updated_at before update on public.nurse_marketplace_policies
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_nurse_work_source_links_updated_at on public.nurse_work_source_links;
create trigger touch_nurse_work_source_links_updated_at before update on public.nurse_work_source_links
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_nurse_shift_offers_updated_at on public.nurse_shift_offers;
create trigger touch_nurse_shift_offers_updated_at before update on public.nurse_shift_offers
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_nurse_offer_deliveries_updated_at on public.nurse_offer_deliveries;
create trigger touch_nurse_offer_deliveries_updated_at before update on public.nurse_offer_deliveries
  for each row execute function public.touch_updated_at();

drop trigger if exists nurse_marketplace_transitions_immutable on public.nurse_marketplace_transitions;
create trigger nurse_marketplace_transitions_immutable before update or delete on public.nurse_marketplace_transitions
  for each row execute function app_private.prevent_os_append_only_mutation();
drop trigger if exists nurse_offer_action_idempotency_immutable on public.nurse_offer_action_idempotency;
create trigger nurse_offer_action_idempotency_immutable before update or delete on public.nurse_offer_action_idempotency
  for each row execute function app_private.prevent_os_append_only_mutation();

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'nurse_marketplace_policies', 'nurse_appointment_source_events',
    'nurse_work_source_links', 'nurse_shift_offers', 'nurse_offer_deliveries',
    'nurse_offer_action_idempotency', 'nurse_shift_amendments',
    'nurse_marketplace_transitions'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

comment on table public.nurse_appointment_source_events is
  'Verified, revisioned source inbox. Payload may contain PHI and is service-role-only.';
comment on table public.nurse_shift_offers is
  'Explicit privacy-safe offers. Decline and expiry records must never feed punitive ranking.';
comment on table public.nurse_marketplace_policies is
  'Versioned human-approved operating policy. Absence of an approved row means unavailable.';

commit;
