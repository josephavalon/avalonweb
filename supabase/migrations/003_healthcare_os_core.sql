-- ============================================================
-- Avalon Vitality — Production-Critical Healthcare OS Core
-- Pre-API contracts for identity, permissions, source of truth,
-- consent locking, protocol governance, reconciliation, delivery
-- proof, observability, retention, markets, BI, and tenancy.
-- ============================================================

create extension if not exists "pgcrypto";

create schema if not exists app_private;

-- ── Core tenants and profile authority ──────────────────────────────────────

create table if not exists public.tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  status          text not null default 'active' check (status in ('active', 'paused', 'archived')),
  brand_config    jsonb not null default '{}'::jsonb,
  market_config   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

insert into public.tenants (name, slug)
values ('Avalon Vitality', 'avalon-vitality')
on conflict (slug) do nothing;

alter table public.profiles add column if not exists tenant_id uuid references public.tenants(id);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text not null default 'client';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists invited_by uuid references auth.users(id);
alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists deactivation_reason text;
alter table public.profiles add column if not exists app_metadata jsonb not null default '{}'::jsonb;

update public.profiles
set tenant_id = (select id from public.tenants where slug = 'avalon-vitality')
where tenant_id is null;

create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  email           text not null,
  invited_role    text not null check (invited_role in ('client','nurse','rn','np','physician','medical_director','ops_manager','admin','founder')),
  invited_by      uuid references auth.users(id),
  status          text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, email, invited_role, status)
);

create or replace function app_private.profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and status = 'active'),
    auth.jwt() -> 'app_metadata' ->> 'role',
    'anon'
  );
$$;

create or replace function app_private.profile_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select tenant_id from public.profiles where id = auth.uid() and status = 'active'),
    null
  );
$$;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.profile_role() in ('admin', 'founder');
$$;

create or replace function app_private.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.profile_role() in ('ops_manager', 'admin', 'founder');
$$;

create or replace function app_private.is_clinical_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.profile_role() in ('np', 'physician', 'medical_director', 'admin', 'founder');
$$;

create or replace function app_private.is_provider()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.profile_role() in ('nurse', 'rn', 'np', 'physician', 'medical_director');
$$;

create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.is_operator() or app_private.is_clinical_authority() or app_private.is_provider();
$$;

create or replace function app_private.same_tenant(row_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_tenant_id = app_private.profile_tenant_id() or app_private.is_platform_admin();
$$;

-- ── Patient / client / payer / member / provider source of truth ───────────

create table if not exists public.people (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  profile_id          uuid references auth.users(id) on delete set null,
  display_name        text not null,
  legal_name          text,
  email               text,
  phone               text,
  date_of_birth       date,
  source_of_truth     text not null default 'avalon_os' check (source_of_truth in ('avalon_os','acuity','manual','import')),
  phi_classification  text not null default 'phi' check (phi_classification in ('phi','non_phi','finance_no_phi')),
  status              text not null default 'active' check (status in ('active','inactive','do_not_treat','archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.person_roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  role        text not null check (role in ('customer','patient','payer','member','provider','guardian','appointment_owner')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (person_id, role)
);

create table if not exists public.person_relationships (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  subject_person_id  uuid not null references public.people(id) on delete cascade,
  object_person_id   uuid not null references public.people(id) on delete cascade,
  relationship_type  text not null check (relationship_type in ('books_for','pays_for','guardian_of','member_of','provider_for','emergency_contact_for')),
  status             text not null default 'active' check (status in ('active','inactive','expired')),
  created_at         timestamptz not null default now(),
  unique (subject_person_id, object_person_id, relationship_type)
);

create table if not exists public.provider_profiles (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  profile_id            uuid references auth.users(id) on delete set null,
  person_id             uuid references public.people(id) on delete set null,
  provider_role         text not null check (provider_role in ('rn','np','physician','medical_director')),
  credential_status     text not null default 'pending' check (credential_status in ('pending','clear','expired','restricted','deactivated')),
  nursys_status         text not null default 'placeholder' check (nursys_status in ('placeholder','clear','review','unavailable','failed')),
  scope_tags            text[] not null default '{}',
  active                boolean not null default true,
  deactivated_at        timestamptz,
  deactivation_reason   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.provider_deactivation_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  reason              text not null,
  effective_at        timestamptz not null default now(),
  actor_profile_id    uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

-- ── Appointments, bookings, and visits ──────────────────────────────────────

alter table public.appointments add column if not exists tenant_id uuid references public.tenants(id);
alter table public.appointments add column if not exists appointment_owner_person_id uuid references public.people(id);
alter table public.appointments add column if not exists customer_person_id uuid references public.people(id);
alter table public.appointments add column if not exists patient_person_id uuid references public.people(id);
alter table public.appointments add column if not exists payer_person_id uuid references public.people(id);
alter table public.appointments add column if not exists member_person_id uuid references public.people(id);
alter table public.appointments add column if not exists provider_profile_id uuid references public.provider_profiles(id);
alter table public.appointments add column if not exists market_id uuid;
alter table public.appointments add column if not exists service_mode text not null default 'mobile';
alter table public.appointments add column if not exists protocol_key text;
alter table public.appointments add column if not exists gfe_status text not null default 'not_started';
alter table public.appointments add column if not exists payment_status text not null default 'pending';
alter table public.appointments add column if not exists acuity_appointment_id text;
alter table public.appointments add column if not exists stripe_checkout_session_id text;
alter table public.appointments add column if not exists reconciliation_status text not null default 'pending';
alter table public.appointments add column if not exists external_payload jsonb not null default '{}'::jsonb;

update public.appointments
set tenant_id = (select id from public.tenants where slug = 'avalon-vitality')
where tenant_id is null;

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  role          text not null default 'customer',
  email         text,
  phone         text,
  first_name    text,
  last_name     text,
  display_name  text,
  status        text not null default 'active',
  source        text not null default 'manual',
  is_beta_user  boolean not null default false,
  is_demo_user  boolean not null default false,
  environment   text not null default 'production',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id) on delete cascade,
  user_id        uuid references public.users(id) on delete cascade,
  person_id      uuid references public.people(id) on delete set null,
  customer_type  text not null default 'registered',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.bookings (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid references public.tenants(id) on delete cascade,
  appointment_id                uuid references public.appointments(id) on delete set null,
  customer_user_id              uuid references public.users(id) on delete set null,
  source                        text not null default 'avalon_os',
  external_provider             text,
  external_appointment_id       text,
  external_calendar_id          text,
  external_appointment_type_id  text,
  scheduled_at                  timestamptz,
  status                        text not null default 'pending',
  customer_name                 text,
  customer_email                text,
  customer_phone                text,
  service_name                  text,
  location                      text,
  notes                         text,
  raw_external_json             jsonb not null default '{}'::jsonb,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (external_provider, external_appointment_id)
);

create table if not exists public.visits (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  appointment_id         uuid references public.appointments(id) on delete set null,
  patient_person_id      uuid references public.people(id) on delete set null,
  provider_profile_id    uuid references public.provider_profiles(id) on delete set null,
  status                 text not null default 'open' check (status in ('open','in_route','in_treatment','completed','canceled','locked')),
  chart_status           text not null default 'open' check (chart_status in ('open','needs_addendum','locked')),
  provider_signature_id  uuid,
  patient_signature_id   uuid,
  completed_at           timestamptz,
  locked_at              timestamptz,
  locked_by              uuid references auth.users(id),
  clinical_placeholder   boolean not null default true,
  closeout_payload       jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── Consent, signatures, and immutable medical records ─────────────────────

create table if not exists public.consent_documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  consent_type        text not null check (consent_type in ('hipaa','telehealth','general_treatment','treatment_specific','privacy','liability')),
  title               text not null,
  version             text not null,
  body_hash           text not null,
  effective_at        timestamptz not null default now(),
  retired_at          timestamptz,
  status              text not null default 'active' check (status in ('draft','active','retired')),
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  unique (tenant_id, consent_type, version)
);

create table if not exists public.consent_signatures (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  appointment_id       uuid references public.appointments(id) on delete set null,
  visit_id             uuid references public.visits(id) on delete set null,
  patient_person_id    uuid references public.people(id) on delete set null,
  provider_profile_id  uuid references public.provider_profiles(id) on delete set null,
  consent_document_id  uuid not null references public.consent_documents(id),
  signer_role          text not null check (signer_role in ('patient','payer','guardian','provider')),
  signature_hash       text not null,
  signed_at            timestamptz not null default now(),
  ip_address           inet,
  user_agent           text,
  immutable            boolean not null default true
);

create table if not exists public.medical_record_locks (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  visit_id             uuid not null references public.visits(id) on delete cascade,
  locked_by            uuid references auth.users(id),
  lock_reason          text not null default 'visit_completed',
  locked_at            timestamptz not null default now(),
  record_hash          text not null,
  unique (visit_id)
);

create table if not exists public.record_addenda (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  visit_id             uuid not null references public.visits(id) on delete cascade,
  added_by             uuid references auth.users(id),
  reason               text not null,
  addendum_hash        text not null,
  payload              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- ── Clinical protocol governance ────────────────────────────────────────────

create table if not exists public.protocols (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  protocol_key         text not null,
  label               text not null,
  modality            text not null check (modality in ('iv','im','recovery','diagnostics','aesthetics','consult','event')),
  status              text not null default 'draft' check (status in ('draft','active','retired','consult_only')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, protocol_key)
);

create table if not exists public.protocol_versions (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  protocol_id             uuid not null references public.protocols(id) on delete cascade,
  version                 text not null,
  status                  text not null default 'draft' check (status in ('draft','approved','active','retired')),
  effective_at            timestamptz,
  retired_at              timestamptz,
  ingredients             jsonb not null default '[]'::jsonb,
  dose_rules              jsonb not null default '{}'::jsonb,
  contraindications       jsonb not null default '[]'::jsonb,
  required_vitals         jsonb not null default '[]'::jsonb,
  required_documentation  jsonb not null default '[]'::jsonb,
  escalation_triggers     jsonb not null default '[]'::jsonb,
  scope_boundaries        jsonb not null default '{}'::jsonb,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  unique (protocol_id, version)
);

create table if not exists public.protocol_approvals (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  protocol_version_id    uuid not null references public.protocol_versions(id) on delete cascade,
  approved_by            uuid references auth.users(id),
  approver_role          text not null check (approver_role in ('medical_director','physician','np')),
  approval_status        text not null default 'approved' check (approval_status in ('approved','rejected','revoked')),
  approval_note          text,
  approved_at            timestamptz not null default now()
);

-- ── Escalation, adverse events, and do-not-treat flags ─────────────────────

create table if not exists public.medical_escalations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  appointment_id       uuid references public.appointments(id) on delete set null,
  visit_id             uuid references public.visits(id) on delete set null,
  patient_person_id    uuid references public.people(id) on delete set null,
  severity             text not null check (severity in ('mild','moderate','serious','emergency')),
  trigger_type         text not null,
  guidance             text not null,
  medical_director_notified_at timestamptz,
  patient_followup_due_at      timestamptz,
  qa_review_status     text not null default 'pending' check (qa_review_status in ('pending','in_review','closed')),
  status               text not null default 'open' check (status in ('open','escalated','closed')),
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.adverse_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  escalation_id        uuid references public.medical_escalations(id) on delete set null,
  visit_id             uuid references public.visits(id) on delete set null,
  event_type           text not null,
  severity             text not null check (severity in ('mild','moderate','serious','emergency')),
  report_payload       jsonb not null default '{}'::jsonb,
  qa_status            text not null default 'pending',
  created_at           timestamptz not null default now()
);

create table if not exists public.do_not_treat_flags (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  patient_person_id    uuid not null references public.people(id) on delete cascade,
  reason              text not null,
  restriction_level   text not null default 'clinical_review_required' check (restriction_level in ('clinical_review_required','do_not_treat','do_not_book')),
  active              boolean not null default true,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

-- ── API failure, webhooks, reconciliation, and outbox ──────────────────────

create table if not exists public.integration_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  provider            text not null,
  event_type          text not null,
  external_event_id   text,
  signature_valid     boolean,
  idempotency_key     text not null,
  payload_hash        text not null,
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'received' check (status in ('received','processing','processed','failed','dead_letter')),
  retry_count         integer not null default 0,
  failure_reason      text,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  unique (provider, idempotency_key)
);

create table if not exists public.acuity_events (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid references public.tenants(id) on delete cascade,
  webhook_event_hash       text not null unique,
  acuity_appointment_id    text not null,
  action                   text not null,
  calendar_id              text,
  appointment_type_id      text,
  signature_valid          boolean,
  raw_payload_json         jsonb not null default '{}'::jsonb,
  processed_status         text not null default 'pending',
  error_message            text,
  created_at               timestamptz not null default now(),
  processed_at             timestamptz
);

create table if not exists public.outbox_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  destination         text not null,
  event_type          text not null,
  aggregate_type      text not null,
  aggregate_id        uuid,
  idempotency_key     text not null,
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending' check (status in ('pending','sent','failed','dead_letter','canceled')),
  retry_count         integer not null default 0,
  next_retry_at       timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (destination, idempotency_key)
);

create table if not exists public.reconciliation_cases (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  case_type           text not null check (case_type in ('stripe_succeeded_acuity_failed','acuity_succeeded_stripe_failed','gfe_delayed','gfe_denied','nursys_unavailable','webhook_missed','webhook_duplicate','refund_accounting_mismatch','appointment_drift','payroll_sync_failed','finance_sync_failed')),
  severity            text not null default 'action' check (severity in ('watch','action','critical')),
  appointment_id       uuid references public.appointments(id) on delete set null,
  provider            text,
  external_reference  text,
  status              text not null default 'open' check (status in ('open','in_review','resolved','accepted_risk')),
  owner_role          text not null default 'ops_manager',
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

-- ── Notification delivery proof ────────────────────────────────────────────

create table if not exists public.notification_messages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  appointment_id       uuid references public.appointments(id) on delete set null,
  visit_id             uuid references public.visits(id) on delete set null,
  person_id            uuid references public.people(id) on delete set null,
  channel              text not null check (channel in ('sms','email','in_app','voice')),
  audience_role        text not null,
  priority             text not null default 'normal' check (priority in ('low','normal','urgent','critical')),
  subject              text,
  body                 text not null,
  status               text not null default 'queued' check (status in ('queued','sent','delivered','failed','retried','read','acknowledged','escalated')),
  requires_ack         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.notification_delivery_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  notification_id      uuid not null references public.notification_messages(id) on delete cascade,
  delivery_state       text not null check (delivery_state in ('sent','delivered','failed','retried','read','acknowledged','escalated')),
  provider             text,
  external_reference   text,
  failure_reason       text,
  occurred_at          timestamptz not null default now(),
  payload              jsonb not null default '{}'::jsonb
);

-- ── Observability and environment separation ───────────────────────────────

create table if not exists public.observability_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  environment         text not null check (environment in ('local','preview','staging','production')),
  event_type          text not null,
  severity            text not null default 'info' check (severity in ('info','warn','error','critical')),
  route               text,
  metric_name         text,
  metric_value        numeric,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table if not exists public.environment_registry (
  id                  uuid primary key default gen_random_uuid(),
  environment         text not null unique check (environment in ('local','preview','staging','production')),
  demo_mode           boolean not null default false,
  live_api_allowed    boolean not null default false,
  fake_data_allowed   boolean not null default true,
  sandbox_keys_only   boolean not null default true,
  admin_dev_tools     boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

insert into public.environment_registry (environment, demo_mode, live_api_allowed, fake_data_allowed, sandbox_keys_only, admin_dev_tools)
values
  ('local', true, false, true, true, true),
  ('preview', true, false, true, true, true),
  ('staging', false, false, false, true, true),
  ('production', false, true, false, false, false)
on conflict (environment) do nothing;

-- ── Retention, deletion, export, and PHI classification ────────────────────

create table if not exists public.data_assets (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  asset_key           text not null,
  asset_label         text not null,
  data_class          text not null check (data_class in ('phi','pii','finance_no_phi','ops','anonymous')),
  system_of_record    text not null,
  retention_rule      text not null,
  export_allowed      boolean not null default false,
  deletion_allowed    boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (tenant_id, asset_key)
);

create table if not exists public.data_retention_policies (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  policy_key          text not null,
  data_class          text not null,
  retain_for          interval not null,
  archive_after       interval,
  deletion_rule       text not null,
  export_rule         text not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (tenant_id, policy_key)
);

create table if not exists public.data_deletion_requests (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  person_id            uuid references public.people(id) on delete set null,
  request_type         text not null check (request_type in ('delete','archive','restrict','export')),
  status               text not null default 'open' check (status in ('open','blocked_by_retention','approved','completed','rejected')),
  decision_reason      text,
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz
);

create table if not exists public.data_exports (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  export_type          text not null check (export_type in ('patient_record','finance_no_phi','ops','audit')),
  requested_by         uuid references auth.users(id),
  phi_included         boolean not null default false,
  no_phi_enforced      boolean not null default false,
  status               text not null default 'queued' check (status in ('queued','generated','delivered','expired','blocked')),
  created_at           timestamptz not null default now()
);

-- ── Markets, multi-state, MSO/PC, tax/accounting entity mapping ────────────

create table if not exists public.legal_entities (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  entity_name          text not null,
  entity_type          text not null check (entity_type in ('mso','professional_corporation','clinical_entity','tax_entity')),
  state                text not null,
  accounting_mapping   jsonb not null default '{}'::jsonb,
  active              boolean not null default true,
  created_at           timestamptz not null default now()
);

create table if not exists public.clinical_entities (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id      uuid references public.legal_entities(id) on delete set null,
  medical_director_profile_id uuid references public.provider_profiles(id) on delete set null,
  state                text not null,
  gfe_owner            text not null default 'avalon_np_on_call' check (gfe_owner in ('avalon_np_on_call','qualiphy_fallback','manual')),
  active              boolean not null default true,
  created_at           timestamptz not null default now()
);

create table if not exists public.markets (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  market_key          text not null,
  label               text not null,
  state               text not null,
  timezone            text not null default 'America/Los_Angeles',
  clinical_entity_id   uuid references public.clinical_entities(id) on delete set null,
  tax_entity_id        uuid references public.legal_entities(id) on delete set null,
  status              text not null default 'planned' check (status in ('planned','active','paused','retired')),
  created_at           timestamptz not null default now(),
  unique (tenant_id, market_key)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_market_fk'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_market_fk
      foreign key (market_id) references public.markets(id) on delete set null
      not valid;
  end if;
end $$;

create table if not exists public.market_service_availability (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  market_id            uuid not null references public.markets(id) on delete cascade,
  protocol_id          uuid references public.protocols(id) on delete set null,
  service_key          text not null,
  status               text not null default 'available' check (status in ('available','consult_only','paused','unavailable')),
  required_provider_role text not null default 'rn',
  clinical_notes       text,
  created_at           timestamptz not null default now(),
  unique (market_id, service_key)
);

create table if not exists public.provider_license_jurisdictions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  provider_profile_id  uuid not null references public.provider_profiles(id) on delete cascade,
  state                text not null,
  license_number       text,
  license_status       text not null default 'placeholder',
  expires_on           date,
  nursys_checked_at    timestamptz,
  created_at           timestamptz not null default now(),
  unique (provider_profile_id, state)
);

-- ── Support and exceptions ─────────────────────────────────────────────────

create table if not exists public.support_cases (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  appointment_id       uuid references public.appointments(id) on delete set null,
  visit_id             uuid references public.visits(id) on delete set null,
  case_type            text not null check (case_type in ('refund_request','late_nurse','nurse_no_show','patient_unavailable','wrong_address','gfe_denied_after_payment','contraindication_on_site','vip_escalation','event_organizer_escalation')),
  priority             text not null default 'normal' check (priority in ('low','normal','high','vip','critical')),
  status               text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  owner_role           text not null default 'ops_manager',
  summary              text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.support_case_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  support_case_id      uuid not null references public.support_cases(id) on delete cascade,
  actor_profile_id     uuid references auth.users(id),
  event_type           text not null,
  note                 text,
  payload              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- ── BI / operator metrics ──────────────────────────────────────────────────

create table if not exists public.operator_metrics_daily (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  market_id                    uuid references public.markets(id) on delete set null,
  metric_date                  date not null,
  aov                          numeric(12,2),
  gross_margin_per_visit       numeric(12,2),
  nurse_utilization_pct        numeric(5,2),
  travel_minutes_avg           numeric(8,2),
  on_time_arrival_pct          numeric(5,2),
  gfe_approval_pct             numeric(5,2),
  booking_conversion_pct       numeric(5,2),
  refund_pct                   numeric(5,2),
  repeat_pct                   numeric(5,2),
  membership_conversion_pct    numeric(5,2),
  inventory_cost_per_visit     numeric(12,2),
  event_throughput_per_nurse_hour numeric(8,2),
  source_payload               jsonb not null default '{}'::jsonb,
  created_at                   timestamptz not null default now(),
  unique (tenant_id, market_id, metric_date)
);

-- ── White-label / franchise readiness ──────────────────────────────────────

create table if not exists public.tenant_brand_configs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade unique,
  brand_name          text not null,
  public_domain       text,
  theme_config        jsonb not null default '{}'::jsonb,
  compliance_copy     jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.tenant_market_configs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  market_id            uuid references public.markets(id) on delete cascade,
  service_menu_config  jsonb not null default '{}'::jsonb,
  provider_pool_config jsonb not null default '{}'::jsonb,
  inventory_config     jsonb not null default '{}'::jsonb,
  finance_config       jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, market_id)
);

-- ── Audit log and immutable guards ─────────────────────────────────────────

create table if not exists public.audit_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  actor_profile_id     uuid references auth.users(id),
  action              text not null,
  entity_type          text not null,
  entity_id            uuid,
  phi_touched          boolean not null default false,
  payload_hash         text not null,
  payload              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create or replace function app_private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'audit_events are immutable';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
  before update or delete on public.audit_events
  for each row execute procedure app_private.prevent_audit_mutation();

create or replace function app_private.prevent_locked_visit_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.locked_at is not null and not app_private.is_clinical_authority() then
    raise exception 'locked visits require an addendum';
  end if;
  return new;
end;
$$;

drop trigger if exists visits_locked_update_guard on public.visits;
create trigger visits_locked_update_guard
  before update on public.visits
  for each row execute procedure app_private.prevent_locked_visit_update();

create or replace function app_private.prevent_signature_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'signatures and medical record locks are immutable';
end;
$$;

drop trigger if exists consent_signatures_no_mutation on public.consent_signatures;
create trigger consent_signatures_no_mutation
  before update or delete on public.consent_signatures
  for each row execute procedure app_private.prevent_signature_mutation();

drop trigger if exists medical_locks_no_mutation on public.medical_record_locks;
create trigger medical_locks_no_mutation
  before update or delete on public.medical_record_locks
  for each row execute procedure app_private.prevent_signature_mutation();

-- ── RLS enablement and grants ──────────────────────────────────────────────

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'tenants','profiles','invitations','users','customer_profiles','people','person_roles','person_relationships',
    'provider_profiles','provider_deactivation_events','appointments','bookings','visits','consent_documents',
    'consent_signatures','medical_record_locks','record_addenda','protocols','protocol_versions','protocol_approvals',
    'medical_escalations','adverse_events','do_not_treat_flags','integration_events','acuity_events','outbox_events',
    'reconciliation_cases','notification_messages','notification_delivery_events','observability_events','environment_registry',
    'data_assets','data_retention_policies','data_deletion_requests','data_exports','legal_entities','clinical_entities',
    'markets','market_service_availability','provider_license_jurisdictions','support_cases','support_case_events',
    'operator_metrics_daily','tenant_brand_configs','tenant_market_configs','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end $$;

grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

-- Tenants and profiles.
drop policy if exists "tenant users can read own tenant" on public.tenants;
create policy "tenant users can read own tenant"
  on public.tenants for select
  using (id = app_private.profile_tenant_id() or app_private.is_platform_admin());

drop policy if exists "admins manage tenants" on public.tenants;
create policy "admins manage tenants"
  on public.tenants for all
  using (app_private.is_platform_admin())
  with check (app_private.is_platform_admin());

drop policy if exists "profiles self or admin read" on public.profiles;
create policy "profiles self or admin read"
  on public.profiles for select
  using (id = auth.uid() or (app_private.same_tenant(tenant_id) and app_private.is_staff()));

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
  on public.profiles for all
  using (app_private.is_operator())
  with check (app_private.is_operator());

-- Generic tenant-staff access for operational contracts.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'invitations','users','customer_profiles','person_roles','person_relationships','provider_profiles',
    'provider_deactivation_events','bookings','consent_documents','protocols','protocol_versions','protocol_approvals',
    'integration_events','acuity_events','outbox_events','reconciliation_cases','observability_events',
    'data_assets','data_retention_policies','data_deletion_requests','data_exports','legal_entities','clinical_entities',
    'markets','market_service_availability','provider_license_jurisdictions','support_cases','support_case_events',
    'operator_metrics_daily','tenant_brand_configs','tenant_market_configs'
  ] loop
    execute format('drop policy if exists "tenant staff read" on public.%I', tbl);
    execute format('create policy "tenant staff read" on public.%I for select using (app_private.same_tenant(tenant_id) and app_private.is_staff())', tbl);
    execute format('drop policy if exists "tenant operator write" on public.%I', tbl);
    execute format('create policy "tenant operator write" on public.%I for all using (app_private.same_tenant(tenant_id) and app_private.is_operator()) with check (app_private.same_tenant(tenant_id) and app_private.is_operator())', tbl);
  end loop;
end $$;

-- People and appointment-party access.
drop policy if exists "people read own or staff" on public.people;
create policy "people read own or staff"
  on public.people for select
  using (profile_id = auth.uid() or (app_private.same_tenant(tenant_id) and app_private.is_staff()));

drop policy if exists "people staff write" on public.people;
create policy "people staff write"
  on public.people for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "appointments party or staff read" on public.appointments;
create policy "appointments party or staff read"
  on public.appointments for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (
      select 1 from public.people p
      where p.profile_id = auth.uid()
      and p.id in (
        appointment_owner_person_id, customer_person_id, patient_person_id,
        payer_person_id, member_person_id
      )
    )
  );

drop policy if exists "appointments operator write" on public.appointments;
create policy "appointments operator write"
  on public.appointments for all
  using (app_private.same_tenant(tenant_id) and (app_private.is_operator() or app_private.is_clinical_authority()))
  with check (app_private.same_tenant(tenant_id) and (app_private.is_operator() or app_private.is_clinical_authority()));

drop policy if exists "visits party provider or staff read" on public.visits;
create policy "visits party provider or staff read"
  on public.visits for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (select 1 from public.people p where p.id = patient_person_id and p.profile_id = auth.uid())
    or exists (select 1 from public.provider_profiles pp where pp.id = provider_profile_id and pp.profile_id = auth.uid())
  );

drop policy if exists "visits clinical or provider write" on public.visits;
create policy "visits clinical or provider write"
  on public.visits for all
  using (app_private.same_tenant(tenant_id) and (app_private.is_clinical_authority() or app_private.is_provider() or app_private.is_operator()))
  with check (app_private.same_tenant(tenant_id) and (app_private.is_clinical_authority() or app_private.is_provider() or app_private.is_operator()));

-- Consent and medical records.
drop policy if exists "consent signatures read party or clinical" on public.consent_signatures;
create policy "consent signatures read party or clinical"
  on public.consent_signatures for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (select 1 from public.people p where p.id = patient_person_id and p.profile_id = auth.uid())
  );

drop policy if exists "consent signatures insert party or clinical" on public.consent_signatures;
create policy "consent signatures insert party or clinical"
  on public.consent_signatures for insert
  with check (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (select 1 from public.people p where p.id = patient_person_id and p.profile_id = auth.uid())
  );

do $$
declare
  tbl text;
begin
  foreach tbl in array array['medical_record_locks','record_addenda','medical_escalations','adverse_events','do_not_treat_flags'] loop
    execute format('drop policy if exists "clinical staff read" on public.%I', tbl);
    execute format('create policy "clinical staff read" on public.%I for select using (app_private.same_tenant(tenant_id) and (app_private.is_clinical_authority() or app_private.is_provider() or app_private.is_operator()))', tbl);
    execute format('drop policy if exists "clinical authority write" on public.%I', tbl);
    execute format('create policy "clinical authority write" on public.%I for all using (app_private.same_tenant(tenant_id) and app_private.is_clinical_authority()) with check (app_private.same_tenant(tenant_id) and app_private.is_clinical_authority())', tbl);
  end loop;
end $$;

-- Notifications: user can read own person notifications; operators can see all tenant notifications.
drop policy if exists "notifications party or staff read" on public.notification_messages;
create policy "notifications party or staff read"
  on public.notification_messages for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (select 1 from public.people p where p.id = person_id and p.profile_id = auth.uid())
  );

drop policy if exists "notifications operator write" on public.notification_messages;
create policy "notifications operator write"
  on public.notification_messages for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "delivery proof staff read" on public.notification_delivery_events;
create policy "delivery proof staff read"
  on public.notification_delivery_events for select
  using (app_private.same_tenant(tenant_id) and app_private.is_staff());

drop policy if exists "delivery proof operator write" on public.notification_delivery_events;
create policy "delivery proof operator write"
  on public.notification_delivery_events for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

-- Audit: append only, admin/operator/clinical read, actor read.
drop policy if exists "audit read own or staff" on public.audit_events;
create policy "audit read own or staff"
  on public.audit_events for select
  using (actor_profile_id = auth.uid() or (app_private.same_tenant(tenant_id) and app_private.is_staff()));

drop policy if exists "environment admin read" on public.environment_registry;
create policy "environment admin read"
  on public.environment_registry for select
  using (app_private.is_operator());

drop policy if exists "environment admin write" on public.environment_registry;
create policy "environment admin write"
  on public.environment_registry for all
  using (app_private.is_platform_admin())
  with check (app_private.is_platform_admin());

-- Tighten legacy inventory RLS from "any authenticated user" to staff/operator.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'folders','items','item_photos','tags','item_tags','custom_field_definitions','custom_field_values','settings'
  ] loop
    execute format('drop policy if exists "inventory staff read" on public.%I', tbl);
    execute format('create policy "inventory staff read" on public.%I for select using (app_private.is_staff())', tbl);
    execute format('drop policy if exists "inventory operator write" on public.%I', tbl);
    execute format('create policy "inventory operator write" on public.%I for all using (app_private.is_operator()) with check (app_private.is_operator())', tbl);
  end loop;
end $$;

drop policy if exists "auth_all_folders" on public.folders;
drop policy if exists "auth_all_items" on public.items;
drop policy if exists "auth_all_photos" on public.item_photos;
drop policy if exists "auth_all_tags" on public.tags;
drop policy if exists "auth_all_item_tags" on public.item_tags;
drop policy if exists "auth_all_cfd" on public.custom_field_definitions;
drop policy if exists "auth_all_cfv" on public.custom_field_values;
drop policy if exists "auth_read_settings" on public.settings;
drop policy if exists "auth_write_settings" on public.settings;
drop policy if exists "auth_insert_tx" on public.transactions;
drop policy if exists "auth_select_tx" on public.transactions;

drop policy if exists "transactions staff read" on public.transactions;
create policy "transactions staff read"
  on public.transactions for select
  using (app_private.is_staff());

drop policy if exists "transactions staff insert" on public.transactions;
create policy "transactions staff insert"
  on public.transactions for insert
  with check (app_private.is_staff());

drop policy if exists "audit append authenticated" on public.audit_events;
create policy "audit append authenticated"
  on public.audit_events for insert
  with check (auth.role() = 'authenticated' and (tenant_id = app_private.profile_tenant_id() or app_private.is_platform_admin()));

-- ── Production core readiness view, RLS-safe under Postgres 15+ ────────────

create or replace view public.production_core_readiness
with (security_invoker = true)
as
select
  t.id as tenant_id,
  t.slug as tenant_slug,
  (select count(*) from public.profiles p where p.tenant_id = t.id) as profiles,
  (select count(*) from public.people p where p.tenant_id = t.id) as people,
  (select count(*) from public.appointments a where a.tenant_id = t.id) as appointments,
  (select count(*) from public.consent_documents c where c.tenant_id = t.id and c.status = 'active') as active_consents,
  (select count(*) from public.protocol_versions pv where pv.tenant_id = t.id and pv.status in ('approved','active')) as governed_protocol_versions,
  (select count(*) from public.reconciliation_cases rc where rc.tenant_id = t.id and rc.status = 'open') as open_reconciliation_cases,
  (select count(*) from public.notification_messages nm where nm.tenant_id = t.id and nm.status in ('failed','escalated')) as notification_alerts,
  (select count(*) from public.support_cases sc where sc.tenant_id = t.id and sc.status not in ('resolved','closed')) as open_support_cases
from public.tenants t;

grant select on public.production_core_readiness to authenticated;
