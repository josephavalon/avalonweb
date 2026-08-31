-- Avalon PayOps + nurse-pay subledger foundation.
--
-- This migration creates the durable schema but deliberately seeds no payouts,
-- engagement decisions, payroll approvals, bank recipients, tax filings, or
-- provider health claims.
-- Live providers remain disabled until their server-side flags, credentials,
-- enrollment, human approvals, sandbox evidence, and production canary exist.
-- Finance rows carry operational source identifiers only; patient, treatment,
-- diagnosis, medication, chart, GFE, and clinical free text do not belong here.

do $$
begin
  if to_regclass('public.nurse_invoices') is null
     or to_regclass('public.mobile_shift_runs') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.legal_entities') is null then
    raise exception using errcode = 'P0001', message = 'payops_prerequisite_migrations_missing';
  end if;
end $$;

-- Every finance relationship uses tenant + id, including pre-existing parents.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.legal_entities'::regclass
      and conname = 'payops_legal_entities_tenant_id_id_key'
  ) then
    alter table public.legal_entities
      add constraint payops_legal_entities_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

create table if not exists public.finance_role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  finance_role text not null check (finance_role in (
    'finance_maker', 'finance_checker', 'payroll_approver', 'hr_legal',
    'credentialing', 'accountant_controller', 'security_auditor'
  )),
  assigned_by uuid not null,
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{3,80}$'),
  assignment_key text not null check (assignment_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  effective_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason_code text check (revoke_reason_code is null or revoke_reason_code ~ '^[A-Z0-9_]{3,80}$'),
  revocation_key text check (revocation_key is null or revocation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  revocation_request_hash text check (revocation_request_hash is null or revocation_request_hash ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint finance_role_assignments_profile_fk foreign key (tenant_id, profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint finance_role_assignments_assigner_fk foreign key (tenant_id, assigned_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint finance_role_assignments_revoker_fk foreign key (tenant_id, revoked_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint finance_role_assignments_expiry_check check (expires_at is null or expires_at > effective_at),
  constraint finance_role_assignments_revoke_check check (
    (revoked_at is null and revoked_by is null and revoke_reason_code is null
      and revocation_key is null and revocation_request_hash is null)
    or (revoked_at is not null and revoked_by is not null and revoke_reason_code is not null
      and revocation_key is not null and revocation_request_hash is not null)
  ),
  unique (tenant_id, assignment_key),
  unique (tenant_id, revocation_key),
  unique (tenant_id, id)
);

create unique index if not exists finance_role_assignments_active_key
  on public.finance_role_assignments (tenant_id, profile_id, finance_role)
  where revoked_at is null;

create table if not exists public.engagement_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  worker_profile_id uuid not null,
  legal_entity_id uuid not null,
  decision_status text not null check (decision_status in (
    'PENDING_REVIEW', 'W2_EMPLOYEE', 'CONTRACTOR_APPROVED', 'SUSPENDED', 'ENDED'
  )),
  jurisdiction text not null check (char_length(trim(jurisdiction)) between 2 and 80),
  effective_from date not null,
  effective_through date,
  decision_owner_profile_id uuid not null,
  decision_reference text,
  authority_basis_code text not null check (authority_basis_code ~ '^[A-Z0-9_]{3,80}$'),
  review_due_at timestamptz,
  supersedes_decision_id uuid,
  source text not null default 'hr_legal_review' check (source in ('hr_legal_review', 'counsel_review', 'migration_review')),
  version integer not null default 1 check (version > 0),
  decided_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint engagement_decisions_worker_fk foreign key (tenant_id, worker_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint engagement_decisions_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint engagement_decisions_owner_fk foreign key (tenant_id, decision_owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint engagement_decisions_supersedes_fk foreign key (tenant_id, supersedes_decision_id)
    references public.engagement_decisions(tenant_id, id) on delete restrict,
  constraint engagement_decisions_date_check check (
    effective_through is null or effective_through >= effective_from
  ),
  constraint engagement_decisions_approval_reference_check check (
    decision_status not in ('W2_EMPLOYEE', 'CONTRACTOR_APPROVED')
    or nullif(trim(decision_reference), '') is not null
  ),
  unique (tenant_id, id)
);

create index if not exists engagement_decisions_worker_effective_idx
  on public.engagement_decisions (tenant_id, worker_profile_id, effective_from desc, decided_at desc);

create table if not exists public.payee_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  worker_profile_id uuid not null,
  legal_entity_id uuid not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  address_status text not null default 'missing' check (address_status in ('missing', 'pending', 'verified', 'action_required')),
  tax_readiness text not null default 'missing' check (tax_readiness in ('missing', 'pending', 'ready', 'action_required', 'held')),
  payment_readiness text not null default 'missing' check (payment_readiness in ('missing', 'invite_pending', 'ready', 'action_required', 'held')),
  mercury_recipient_id text,
  mercury_invite_id text,
  destination_masked_label text,
  destination_changed_at timestamptz,
  destination_change_reviewed_at timestamptz,
  destination_change_reviewed_by uuid,
  contact_consent_status text not null default 'unknown' check (contact_consent_status in ('unknown', 'granted', 'revoked')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payee_profiles_worker_fk foreign key (tenant_id, worker_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payee_profiles_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint payee_profiles_destination_reviewer_fk foreign key (tenant_id, destination_change_reviewed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, worker_profile_id, legal_entity_id),
  unique (tenant_id, id),
  unique (tenant_id, mercury_recipient_id)
);

create table if not exists public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payee_profile_id uuid not null,
  w9_status text not null default 'missing' check (w9_status in ('missing', 'invited', 'received', 'verified', 'action_required', 'expired')),
  w9_version text,
  restricted_vault_token text,
  tin_type text check (tin_type in ('SSN', 'EIN', 'ITIN', 'OTHER')),
  tin_last_four text check (tin_last_four is null or tin_last_four ~ '^[0-9]{4}$'),
  tin_match_status text not null default 'not_run' check (tin_match_status in ('not_run', 'pending', 'matched', 'mismatch', 'unavailable', 'manual_review')),
  tin_match_evidence_ref text,
  backup_withholding_status text not null default 'not_required' check (backup_withholding_status in ('not_required', 'required', 'active', 'released', 'action_required')),
  backup_withholding_basis_points integer not null default 0 check (backup_withholding_basis_points between 0 and 10000),
  backup_withholding_effective_at date,
  reporting_jurisdictions text[] not null default '{}',
  reviewed_by uuid,
  reviewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tax_profiles_payee_fk foreign key (tenant_id, payee_profile_id)
    references public.payee_profiles(tenant_id, id) on delete restrict,
  constraint tax_profiles_reviewer_fk foreign key (tenant_id, reviewed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint tax_profiles_no_raw_tin check (
    restricted_vault_token is null
    or restricted_vault_token !~ '^[0-9]{9}$'
  ),
  unique (tenant_id, payee_profile_id),
  unique (tenant_id, id)
);

create table if not exists public.earning_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  worker_profile_id uuid not null,
  legal_entity_id uuid not null,
  source_type text not null check (source_type in ('mobile_shift_run', 'approved_adjustment', 'approved_expense', 'legacy_invoice')),
  source_id uuid not null,
  source_version integer not null check (source_version > 0),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  service_date date not null,
  business_timezone text not null default 'America/Los_Angeles',
  category text not null check (category in ('regular_time', 'overtime', 'double_time', 'travel_time', 'training', 'on_call', 'meal_rest_premium', 'minimum', 'mileage', 'expense_reimbursement', 'adjustment', 'other_approved')),
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null check (unit in ('hour', 'mile', 'item', 'flat')),
  unit_amount_cents bigint not null check (unit_amount_cents >= 0),
  gross_amount_cents bigint not null check (gross_amount_cents >= 0),
  reimbursement_amount_cents bigint not null default 0 check (reimbursement_amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  rate_policy_version text not null,
  calculation_hash text not null check (calculation_hash ~ '^[0-9a-f]{64}$'),
  approval_status text not null default 'CAPTURED' check (approval_status in ('CAPTURED', 'REVIEW_REQUIRED', 'APPROVED', 'INVOICED', 'ROUTED')),
  approved_by uuid,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint earning_events_worker_fk foreign key (tenant_id, worker_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint earning_events_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint earning_events_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint earning_events_approval_check check (
    (approval_status in ('APPROVED', 'INVOICED', 'ROUTED') and approved_by is not null and approved_at is not null)
    or approval_status in ('CAPTURED', 'REVIEW_REQUIRED')
  ),
  unique (tenant_id, source_type, source_id, source_version, category),
  unique (tenant_id, source_hash, category),
  unique (tenant_id, id)
);

create table if not exists public.earning_routings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  earning_event_id uuid not null,
  engagement_decision_id uuid not null,
  rail text not null check (rail in ('CONTRACTOR_PAYABLE', 'W2_PAYROLL_INPUT')),
  routed_by uuid not null,
  routed_at timestamptz not null default clock_timestamp(),
  routing_hash text not null check (routing_hash ~ '^[0-9a-f]{64}$'),
  constraint earning_routings_earning_fk foreign key (tenant_id, earning_event_id)
    references public.earning_events(tenant_id, id) on delete restrict,
  constraint earning_routings_engagement_fk foreign key (tenant_id, engagement_decision_id)
    references public.engagement_decisions(tenant_id, id) on delete restrict,
  constraint earning_routings_actor_fk foreign key (tenant_id, routed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, earning_event_id),
  unique (tenant_id, id)
);

create table if not exists public.earning_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  earning_event_id uuid not null,
  earning_event_version integer not null check (earning_event_version > 0),
  earning_calculation_hash text not null check (earning_calculation_hash ~ '^[0-9a-f]{64}$'),
  opened_by uuid not null,
  reason_code text not null check (reason_code in ('time_missing', 'rate_question', 'mileage_missing', 'expense_missing', 'calculation_question', 'other_pay_issue')),
  safe_detail text check (safe_detail is null or char_length(safe_detail) <= 500),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'OPEN' check (status in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
  owner_profile_id uuid,
  resolution_code text,
  resolved_by uuid,
  resolved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint earning_disputes_earning_fk foreign key (tenant_id, earning_event_id)
    references public.earning_events(tenant_id, id) on delete restrict,
  constraint earning_disputes_opener_fk foreign key (tenant_id, opened_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint earning_disputes_owner_fk foreign key (tenant_id, owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint earning_disputes_resolver_fk foreign key (tenant_id, resolved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, id)
);

create unique index if not exists earning_disputes_idempotency_key
  on public.earning_disputes (tenant_id, opened_by, idempotency_key);

create table if not exists public.earning_dispute_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  dispute_id uuid not null,
  from_status text,
  to_status text not null check (to_status in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
  actor_profile_id uuid not null,
  dispute_version integer not null check (dispute_version > 0),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint earning_dispute_events_dispute_fk foreign key (tenant_id, dispute_id)
    references public.earning_disputes(tenant_id, id) on delete restrict,
  constraint earning_dispute_events_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, dispute_id, dispute_version),
  unique (tenant_id, request_hash),
  unique (tenant_id, id)
);

create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payee_profile_id uuid not null,
  engagement_decision_id uuid not null,
  source_invoice_id uuid,
  source_invoice_version integer,
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'OPEN' check (status in ('OPEN', 'APPROVED', 'READY', 'PAYOUT_REQUESTED', 'SETTLED', 'ACTION_REQUIRED', 'HELD', 'FAILED', 'RETURNED', 'REVERSED', 'RECONCILIATION_REQUIRED')),
  gross_cents bigint not null check (gross_cents >= 0),
  reimbursement_cents bigint not null default 0 check (reimbursement_cents >= 0),
  backup_withholding_cents bigint not null default 0 check (backup_withholding_cents >= 0),
  other_withholding_cents bigint not null default 0 check (other_withholding_cents >= 0),
  net_cents bigint not null check (net_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  due_date date not null,
  calculation_hash text not null check (calculation_hash ~ '^[0-9a-f]{64}$'),
  engagement_snapshot jsonb not null check (jsonb_typeof(engagement_snapshot) = 'object'),
  engagement_decision_version integer not null check (engagement_decision_version > 0),
  payee_profile_version integer not null check (payee_profile_version > 0),
  tax_profile_version integer check (tax_profile_version is null or tax_profile_version > 0),
  hold_code text,
  hold_owner_profile_id uuid,
  maker_approved_by uuid,
  maker_approved_at timestamptz,
  settled_at timestamptz,
  reconciliation_state text not null default 'UNMATCHED' check (reconciliation_state in ('UNMATCHED', 'PARTIAL', 'MATCHED', 'EXCEPTION')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payables_payee_fk foreign key (tenant_id, payee_profile_id)
    references public.payee_profiles(tenant_id, id) on delete restrict,
  constraint payables_engagement_fk foreign key (tenant_id, engagement_decision_id)
    references public.engagement_decisions(tenant_id, id) on delete restrict,
  constraint payables_invoice_fk foreign key (tenant_id, source_invoice_id)
    references public.nurse_invoices(tenant_id, id) on delete restrict,
  constraint payables_hold_owner_fk foreign key (tenant_id, hold_owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payables_maker_fk foreign key (tenant_id, maker_approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payables_math_check check (
    net_cents = gross_cents + reimbursement_cents - backup_withholding_cents - other_withholding_cents
    and backup_withholding_cents + other_withholding_cents <= gross_cents + reimbursement_cents
  ),
  constraint payables_source_pair_check check (
    (source_invoice_id is null and source_invoice_version is null)
    or (source_invoice_id is not null and source_invoice_version is not null and source_invoice_version > 0)
  ),
  constraint payables_hold_check check (
    (status = 'HELD' and hold_code is not null and hold_owner_profile_id is not null) or status <> 'HELD'
  ),
  unique (tenant_id, id)
);

create unique index if not exists payables_request_idempotency_key
  on public.payables (tenant_id, request_idempotency_key);

create unique index if not exists payables_invoice_version_key
  on public.payables (tenant_id, source_invoice_id, source_invoice_version)
  where source_invoice_id is not null;

create table if not exists public.payable_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payable_id uuid not null,
  earning_event_id uuid,
  category text not null check (category in ('compensation', 'reimbursement', 'backup_withholding', 'other_withholding', 'adjustment')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint payable_lines_payable_fk foreign key (tenant_id, payable_id)
    references public.payables(tenant_id, id) on delete restrict,
  constraint payable_lines_earning_fk foreign key (tenant_id, earning_event_id)
    references public.earning_events(tenant_id, id) on delete restrict,
  unique (tenant_id, payable_id, source_hash, category),
  unique (tenant_id, id)
);

create table if not exists public.payable_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payable_id uuid not null,
  approval_role text not null check (approval_role in ('finance_maker', 'finance_checker')),
  decision text not null check (decision in ('APPROVED', 'REJECTED', 'INVALIDATED')),
  actor_profile_id uuid not null,
  payable_version integer not null check (payable_version > 0),
  calculation_hash text not null check (calculation_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,80}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint payable_approvals_payable_fk foreign key (tenant_id, payable_id)
    references public.payables(tenant_id, id) on delete restrict,
  constraint payable_approvals_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, payable_id, approval_role, payable_version, actor_profile_id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);

create table if not exists public.payable_hold_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payable_id uuid not null,
  actor_profile_id uuid not null,
  owner_profile_id uuid not null,
  hold_code text not null check (hold_code ~ '^[A-Z0-9_]{3,100}$'),
  payable_version integer not null check (payable_version > 0),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint payable_hold_events_payable_fk foreign key (tenant_id, payable_id)
    references public.payables(tenant_id, id) on delete restrict,
  constraint payable_hold_events_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payable_hold_events_owner_fk foreign key (tenant_id, owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  batch_key text not null,
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  funding_account_ref text not null,
  funding_account_masked_label text not null,
  send_mode text not null check (send_mode in ('approval_queue', 'direct_send')),
  item_count integer not null default 0 check (item_count >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROCESSING', 'COMPLETE', 'ACTION_REQUIRED', 'CANCELLED')),
  created_by uuid not null,
  checker_approved_by uuid,
  checker_approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payout_batches_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint payout_batches_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payout_batches_checker_fk foreign key (tenant_id, checker_approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payout_batches_maker_checker_check check (
    checker_approved_by is null or checker_approved_by <> created_by
  ),
  unique (tenant_id, batch_key),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

create table if not exists public.payout_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_batch_id uuid,
  payable_id uuid not null,
  payable_version integer not null check (payable_version > 0),
  payee_profile_version integer not null check (payee_profile_version > 0),
  provider text not null default 'mercury' check (provider = 'mercury'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROVIDER_PENDING', 'SUBMITTED', 'IN_TRANSIT', 'SETTLED', 'ACTION_REQUIRED', 'HELD', 'FAILED', 'RETURNED', 'REVERSED', 'RECONCILIATION_REQUIRED', 'CANCELLED')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  stable_request_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  destination_snapshot_hash text not null check (destination_snapshot_hash ~ '^[0-9a-f]{64}$'),
  provider_approval_request_id text,
  provider_transaction_id text,
  destination_masked_label text not null,
  maker_prepared_by uuid not null,
  maker_prepared_at timestamptz not null default clock_timestamp(),
  checker_approved_by uuid,
  checker_approved_at timestamptz,
  provider_observed_at timestamptz,
  last_provider_success_at timestamptz,
  reconciliation_state text not null default 'UNMATCHED' check (reconciliation_state in ('UNMATCHED', 'PARTIAL', 'MATCHED', 'EXCEPTION')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payout_items_batch_fk foreign key (tenant_id, payout_batch_id)
    references public.payout_batches(tenant_id, id) on delete restrict,
  constraint payout_items_payable_fk foreign key (tenant_id, payable_id)
    references public.payables(tenant_id, id) on delete restrict,
  constraint payout_items_checker_fk foreign key (tenant_id, checker_approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payout_items_maker_fk foreign key (tenant_id, maker_prepared_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payout_items_maker_checker_check check (
    checker_approved_by is null or checker_approved_by <> maker_prepared_by
  ),
  unique (tenant_id, payable_id),
  unique (tenant_id, stable_request_key),
  unique (tenant_id, provider, provider_transaction_id),
  unique (tenant_id, id)
);

create table if not exists public.payout_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_item_id uuid not null,
  decision text not null check (decision in ('APPROVED', 'REJECTED', 'INVALIDATED', 'SEND_AUTHORIZED')),
  approval_role text not null check (approval_role in ('finance_checker', 'finance_executor')),
  actor_profile_id uuid not null,
  payout_item_version integer not null check (payout_item_version > 0),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint payout_approvals_item_fk foreign key (tenant_id, payout_item_id)
    references public.payout_items(tenant_id, id) on delete restrict,
  constraint payout_approvals_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, payout_item_id, decision, payout_item_version),
  unique (tenant_id, id)
);

create table if not exists public.payout_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_item_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  command_id uuid,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('QUEUED', 'ACCEPTED', 'UNKNOWN', 'REJECTED', 'FAILED')),
  safe_provider_code text,
  provider_request_id text,
  requested_at timestamptz not null default clock_timestamp(),
  responded_at timestamptz,
  constraint payout_attempts_item_fk foreign key (tenant_id, payout_item_id)
    references public.payout_items(tenant_id, id) on delete restrict,
  unique (tenant_id, payout_item_id, attempt_number),
  unique (tenant_id, id)
);

create table if not exists public.payout_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payout_item_id uuid not null,
  from_status text,
  to_status text not null,
  source text not null check (source in ('local_command', 'provider_webhook', 'provider_poll', 'reconciliation', 'human_recovery')),
  source_event_id text,
  source_checksum text not null check (source_checksum ~ '^[0-9a-f]{64}$'),
  actor_profile_id uuid,
  occurred_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  safe_reason_code text,
  constraint payout_events_item_fk foreign key (tenant_id, payout_item_id)
    references public.payout_items(tenant_id, id) on delete restrict,
  constraint payout_events_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, source, source_event_id, source_checksum),
  unique (tenant_id, id)
);

create table if not exists public.finance_integration_commands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercury', 'gusto_embedded', 'nursys', 'irs_iris', 'manual_tax')),
  command_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  stable_key text not null,
  request_checksum text not null check (request_checksum ~ '^[0-9a-f]{64}$'),
  safe_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_payload) = 'object'),
  status text not null default 'PENDING' check (status in ('PENDING', 'CLAIMED', 'SENT', 'SUCCEEDED', 'UNKNOWN', 'FAILED', 'DEAD_LETTER', 'CANCELLED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  claimed_by text,
  last_safe_error_code text,
  correlation_id uuid not null default gen_random_uuid(),
  trace_id text,
  created_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint finance_integration_commands_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, provider, stable_key),
  unique (tenant_id, id)
);

create table if not exists public.finance_integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercury', 'gusto_embedded', 'nursys', 'irs_iris', 'manual_tax')),
  provider_event_id text not null,
  event_type text not null,
  aggregate_type text,
  aggregate_id uuid,
  payload_checksum text not null check (payload_checksum ~ '^[0-9a-f]{64}$'),
  signature_valid boolean not null,
  occurred_at timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  status text not null default 'RECEIVED' check (status in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED')),
  safe_error_code text,
  correlation_id uuid,
  unique (tenant_id, provider, provider_event_id),
  unique (tenant_id, provider, payload_checksum),
  unique (tenant_id, id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payout_attempts'::regclass
      and conname = 'payout_attempts_command_fk'
  ) then
    alter table public.payout_attempts
      add constraint payout_attempts_command_fk
      foreign key (tenant_id, command_id)
      references public.finance_integration_commands(tenant_id, id) on delete restrict;
  end if;
end $$;

create table if not exists public.ledger_chart_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  version_label text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  approved_by uuid,
  approved_at timestamptz,
  effective_from date not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint ledger_chart_versions_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint ledger_chart_versions_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, legal_entity_id, version_label),
  unique (tenant_id, id)
);

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chart_version_id uuid not null,
  legal_entity_id uuid not null,
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'EXPENSE', 'REVENUE', 'CLEARING')),
  normal_balance text not null check (normal_balance in ('DEBIT', 'CREDIT')),
  parent_account_id uuid,
  reporting_mapping text,
  active boolean not null default true,
  locked_at timestamptz,
  effective_from date not null,
  effective_through date,
  created_at timestamptz not null default clock_timestamp(),
  constraint ledger_accounts_chart_fk foreign key (tenant_id, chart_version_id)
    references public.ledger_chart_versions(tenant_id, id) on delete restrict,
  constraint ledger_accounts_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint ledger_accounts_parent_fk foreign key (tenant_id, parent_account_id)
    references public.ledger_accounts(tenant_id, id) on delete restrict,
  unique (tenant_id, chart_version_id, account_code),
  unique (tenant_id, id)
);

create table if not exists public.ledger_journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  chart_version_id uuid not null,
  source_type text not null,
  source_id uuid not null,
  source_version integer not null check (source_version > 0),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  posting_date date not null,
  period_key text not null check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'POSTED', 'REVERSED')),
  total_debit_cents bigint not null default 0 check (total_debit_cents >= 0),
  total_credit_cents bigint not null default 0 check (total_credit_cents >= 0),
  prepared_by uuid not null,
  approved_by uuid,
  posted_at timestamptz,
  reversal_of_journal_id uuid,
  reversed_by_journal_id uuid,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint ledger_journals_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint ledger_journals_chart_fk foreign key (tenant_id, chart_version_id)
    references public.ledger_chart_versions(tenant_id, id) on delete restrict,
  constraint ledger_journals_preparer_fk foreign key (tenant_id, prepared_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint ledger_journals_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint ledger_journals_reversal_of_fk foreign key (tenant_id, reversal_of_journal_id)
    references public.ledger_journals(tenant_id, id) on delete restrict,
  constraint ledger_journals_reversed_by_fk foreign key (tenant_id, reversed_by_journal_id)
    references public.ledger_journals(tenant_id, id) on delete restrict,
  constraint ledger_journals_balance_check check (
    (status = 'DRAFT') or (total_debit_cents = total_credit_cents and total_debit_cents > 0)
  ),
  constraint ledger_journals_maker_checker_check check (
    approved_by is null or approved_by <> prepared_by
  ),
  unique (tenant_id, source_type, source_id, source_version),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journal_id uuid not null,
  account_id uuid not null,
  line_number integer not null check (line_number > 0),
  entry_side text not null check (entry_side in ('DEBIT', 'CREDIT')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  safe_memo_code text,
  source_ref text,
  created_at timestamptz not null default clock_timestamp(),
  constraint ledger_entries_journal_fk foreign key (tenant_id, journal_id)
    references public.ledger_journals(tenant_id, id) on delete restrict,
  constraint ledger_entries_account_fk foreign key (tenant_id, account_id)
    references public.ledger_accounts(tenant_id, id) on delete restrict,
  constraint ledger_entries_safe_memo_check check (
    safe_memo_code is null or safe_memo_code ~ '^[A-Z0-9_]{3,100}$'
  ),
  unique (tenant_id, journal_id, line_number),
  unique (tenant_id, id)
);

create table if not exists public.ledger_journal_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journal_id uuid not null,
  event_type text not null check (event_type in ('PREPARED', 'POSTED', 'REVERSED', 'POST_REJECTED')),
  actor_profile_id uuid not null,
  journal_version integer not null check (journal_version > 0),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint ledger_journal_events_journal_fk foreign key (tenant_id, journal_id)
    references public.ledger_journals(tenant_id, id) on delete restrict,
  constraint ledger_journal_events_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, journal_id, event_type, journal_version),
  unique (tenant_id, id)
);

create table if not exists public.bank_statement_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  provider text not null default 'mercury' check (provider = 'mercury'),
  provider_account_id text not null,
  provider_transaction_id text not null,
  provider_status text not null,
  amount_cents bigint not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  effective_date date not null,
  posted_at timestamptz,
  safe_description_code text,
  payload_checksum text not null check (payload_checksum ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz not null,
  last_success_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint bank_statement_items_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  unique (tenant_id, provider, provider_account_id, provider_transaction_id),
  unique (tenant_id, id)
);

create table if not exists public.finance_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exception_type text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED')),
  owner_profile_id uuid not null,
  due_at timestamptz not null,
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  linked_type text not null,
  linked_id uuid not null,
  resolution_code text,
  resolved_by uuid,
  resolved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint finance_exceptions_owner_fk foreign key (tenant_id, owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint finance_exceptions_resolver_fk foreign key (tenant_id, resolved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, id)
);

create table if not exists public.reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bank_statement_item_id uuid not null,
  payout_item_id uuid,
  payroll_run_id uuid,
  ledger_journal_id uuid,
  match_status text not null default 'PROPOSED' check (match_status in ('PROPOSED', 'APPROVED', 'REJECTED', 'REVERSED')),
  matched_amount_cents bigint not null check (matched_amount_cents > 0),
  variance_cents bigint not null default 0,
  policy_version text not null,
  proposed_by text not null check (proposed_by in ('SYSTEM', 'HUMAN')),
  approved_by uuid,
  approved_at timestamptz,
  exception_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint reconciliation_matches_bank_fk foreign key (tenant_id, bank_statement_item_id)
    references public.bank_statement_items(tenant_id, id) on delete restrict,
  constraint reconciliation_matches_payout_fk foreign key (tenant_id, payout_item_id)
    references public.payout_items(tenant_id, id) on delete restrict,
  constraint reconciliation_matches_journal_fk foreign key (tenant_id, ledger_journal_id)
    references public.ledger_journals(tenant_id, id) on delete restrict,
  constraint reconciliation_matches_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint reconciliation_matches_exception_fk foreign key (tenant_id, exception_id)
    references public.finance_exceptions(tenant_id, id) on delete restrict,
  constraint reconciliation_matches_human_approval_check check (
    match_status <> 'APPROVED' or (approved_by is not null and approved_at is not null)
  ),
  unique (tenant_id, id)
);

create table if not exists public.period_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  period_key text not null check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'OPEN' check (status in ('OPEN', 'READY_FOR_REVIEW', 'CLOSED', 'REOPENED')),
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  unresolved_exception_count integer not null default 0 check (unresolved_exception_count >= 0),
  prepared_by uuid,
  approved_by uuid,
  closed_at timestamptz,
  reopened_by uuid,
  reopened_at timestamptz,
  reopen_reason_code text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint period_closures_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint period_closures_preparer_fk foreign key (tenant_id, prepared_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint period_closures_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint period_closures_reopener_fk foreign key (tenant_id, reopened_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint period_closures_maker_checker_check check (approved_by is null or approved_by <> prepared_by),
  unique (tenant_id, legal_entity_id, period_key),
  unique (tenant_id, id)
);

create table if not exists public.payroll_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  worker_profile_id uuid not null,
  legal_entity_id uuid not null,
  gusto_company_id text,
  gusto_employee_id text,
  work_jurisdictions text[] not null default '{}',
  tax_jurisdictions text[] not null default '{}',
  onboarding_status text not null default 'NOT_STARTED' check (onboarding_status in ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'ACTION_REQUIRED')),
  coverage_status text not null default 'UNVERIFIED' check (coverage_status in ('UNVERIFIED', 'PARTIAL', 'VERIFIED', 'ACTION_REQUIRED')),
  pay_schedule_ref text,
  payment_method_status text not null default 'UNKNOWN' check (payment_method_status in ('UNKNOWN', 'PENDING', 'READY', 'ACTION_REQUIRED')),
  statement_status text not null default 'UNKNOWN' check (statement_status in ('UNKNOWN', 'PENDING', 'AVAILABLE', 'ACTION_REQUIRED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payroll_profiles_worker_fk foreign key (tenant_id, worker_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payroll_profiles_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  unique (tenant_id, worker_profile_id, legal_entity_id),
  unique (tenant_id, gusto_company_id, gusto_employee_id),
  unique (tenant_id, id)
);

create table if not exists public.payroll_calendars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  period_start date not null,
  period_end date not null,
  cutoff_at timestamptz not null,
  pay_date date not null,
  funding_date date,
  timezone text not null,
  run_type text not null default 'REGULAR' check (run_type in ('REGULAR', 'OFF_CYCLE', 'FINAL_PAY')),
  jurisdiction_policy_version text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'LOCKED', 'EXPORTED', 'CLOSED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payroll_calendars_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint payroll_calendars_date_check check (period_end >= period_start),
  unique (tenant_id, legal_entity_id, period_start, period_end, run_type),
  unique (tenant_id, id)
);

create table if not exists public.payroll_inputs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_profile_id uuid not null,
  payroll_calendar_id uuid not null,
  earning_event_id uuid not null,
  category text not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  taxable boolean not null default true,
  regular_rate_component boolean not null default true,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  policy_version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'VALIDATED', 'LOCKED_TO_PAY_PERIOD', 'EXPORTED', 'ACTION_REQUIRED', 'CORRECTION_REQUIRED')),
  approved_by uuid,
  approved_at timestamptz,
  correction_of_input_id uuid,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payroll_inputs_profile_fk foreign key (tenant_id, payroll_profile_id)
    references public.payroll_profiles(tenant_id, id) on delete restrict,
  constraint payroll_inputs_calendar_fk foreign key (tenant_id, payroll_calendar_id)
    references public.payroll_calendars(tenant_id, id) on delete restrict,
  constraint payroll_inputs_earning_fk foreign key (tenant_id, earning_event_id)
    references public.earning_events(tenant_id, id) on delete restrict,
  constraint payroll_inputs_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint payroll_inputs_correction_fk foreign key (tenant_id, correction_of_input_id)
    references public.payroll_inputs(tenant_id, id) on delete restrict,
  unique (tenant_id, earning_event_id),
  unique (tenant_id, source_hash),
  unique (tenant_id, id)
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  payroll_calendar_id uuid not null,
  provider text not null default 'gusto_embedded' check (provider = 'gusto_embedded'),
  gusto_company_id text,
  gusto_payroll_id text,
  preview_version text,
  preview_hash text check (preview_hash is null or preview_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PREVIEWED', 'HUMAN_APPROVED', 'PROCESSING', 'EMPLOYER_FUNDED', 'EMPLOYEE_PAYMENT_PENDING', 'PAID', 'ACTION_REQUIRED', 'FUNDING_FAILED', 'EMPLOYEE_PAYMENT_FAILED', 'TAX_OR_FILING_FAILED', 'CANCELLED', 'CORRECTION_REQUIRED', 'OFF_CYCLE_REQUIRED', 'RECONCILIATION_REQUIRED')),
  gross_cents bigint not null default 0 check (gross_cents >= 0),
  net_cents bigint not null default 0 check (net_cents >= 0),
  employee_tax_cents bigint not null default 0 check (employee_tax_cents >= 0),
  employer_tax_cents bigint not null default 0 check (employer_tax_cents >= 0),
  deduction_cents bigint not null default 0 check (deduction_cents >= 0),
  reimbursement_cents bigint not null default 0 check (reimbursement_cents >= 0),
  employer_cost_cents bigint not null default 0 check (employer_cost_cents >= 0),
  funding_status text not null default 'NOT_STARTED',
  employee_payment_status text not null default 'NOT_STARTED',
  tax_filing_status text not null default 'NOT_STARTED',
  statement_status text not null default 'NOT_STARTED',
  approved_by uuid,
  approved_at timestamptz,
  provider_observed_at timestamptz,
  last_provider_success_at timestamptz,
  reconciliation_state text not null default 'UNMATCHED' check (reconciliation_state in ('UNMATCHED', 'PARTIAL', 'MATCHED', 'EXCEPTION')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payroll_runs_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint payroll_runs_calendar_fk foreign key (tenant_id, payroll_calendar_id)
    references public.payroll_calendars(tenant_id, id) on delete restrict,
  constraint payroll_runs_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, payroll_calendar_id, provider),
  unique (tenant_id, provider, gusto_company_id, gusto_payroll_id),
  unique (tenant_id, id)
);

-- Now that payroll_runs exists, bind the optional reconciliation reference.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reconciliation_matches'::regclass
      and conname = 'reconciliation_matches_payroll_fk'
  ) then
    alter table public.reconciliation_matches
      add constraint reconciliation_matches_payroll_fk
      foreign key (tenant_id, payroll_run_id)
      references public.payroll_runs(tenant_id, id) on delete restrict;
  end if;
end $$;

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_id uuid not null,
  payroll_profile_id uuid not null,
  gusto_employee_id text,
  gross_cents bigint not null check (gross_cents >= 0),
  net_cents bigint not null check (net_cents >= 0),
  employee_tax_cents bigint not null default 0 check (employee_tax_cents >= 0),
  employer_tax_cents bigint not null default 0 check (employer_tax_cents >= 0),
  deduction_cents bigint not null default 0 check (deduction_cents >= 0),
  reimbursement_cents bigint not null default 0 check (reimbursement_cents >= 0),
  payment_status text not null default 'PENDING'
    check (payment_status in ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'RETURNED', 'ACTION_REQUIRED', 'RECONCILIATION_REQUIRED')),
  statement_status text not null default 'PENDING'
    check (statement_status in ('PENDING', 'AVAILABLE', 'SUPERSEDED', 'ACTION_REQUIRED')),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint payroll_items_run_fk foreign key (tenant_id, payroll_run_id)
    references public.payroll_runs(tenant_id, id) on delete restrict,
  constraint payroll_items_profile_fk foreign key (tenant_id, payroll_profile_id)
    references public.payroll_profiles(tenant_id, id) on delete restrict,
  constraint payroll_items_math_check check (
    net_cents + employee_tax_cents + deduction_cents = gross_cents + reimbursement_cents
  ),
  unique (tenant_id, payroll_run_id, payroll_profile_id),
  unique (tenant_id, source_hash),
  unique (tenant_id, id)
);

create table if not exists public.payroll_statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_item_id uuid not null,
  payroll_profile_id uuid not null,
  provider_statement_id text not null,
  statement_status text not null default 'AVAILABLE'
    check (statement_status in ('AVAILABLE', 'SUPERSEDED', 'ACTION_REQUIRED')),
  available_at timestamptz,
  restricted_storage_ref text not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version > 0),
  supersedes_statement_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint payroll_statements_item_fk foreign key (tenant_id, payroll_item_id)
    references public.payroll_items(tenant_id, id) on delete restrict,
  constraint payroll_statements_profile_fk foreign key (tenant_id, payroll_profile_id)
    references public.payroll_profiles(tenant_id, id) on delete restrict,
  constraint payroll_statements_supersedes_fk foreign key (tenant_id, supersedes_statement_id)
    references public.payroll_statements(tenant_id, id) on delete restrict,
  unique (tenant_id, provider_statement_id),
  unique (tenant_id, payroll_item_id, version),
  unique (tenant_id, id)
);

create table if not exists public.payroll_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_id uuid not null,
  payroll_item_id uuid,
  event_type text not null,
  from_status text,
  to_status text,
  provider_event_id text,
  payload_checksum text not null check (payload_checksum ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  safe_reason_code text,
  constraint payroll_events_run_fk foreign key (tenant_id, payroll_run_id)
    references public.payroll_runs(tenant_id, id) on delete restrict,
  constraint payroll_events_item_fk foreign key (tenant_id, payroll_item_id)
    references public.payroll_items(tenant_id, id) on delete restrict,
  unique (tenant_id, provider_event_id, payload_checksum),
  unique (tenant_id, id)
);

create table if not exists public.payroll_liabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_id uuid not null,
  liability_type text not null check (liability_type in ('NET_PAY', 'EMPLOYEE_WITHHOLDING', 'EMPLOYER_TAX', 'DEDUCTION', 'GARNISHMENT', 'REIMBURSEMENT', 'PROVIDER_FEE', 'CLEARING')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  provider_reference text,
  status text not null default 'OPEN' check (status in ('OPEN', 'FUNDED', 'SETTLED', 'RETURNED', 'ACTION_REQUIRED', 'CORRECTED')),
  due_date date,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint payroll_liabilities_run_fk foreign key (tenant_id, payroll_run_id)
    references public.payroll_runs(tenant_id, id) on delete restrict,
  unique (tenant_id, payroll_run_id, liability_type, source_hash),
  unique (tenant_id, id)
);

create table if not exists public.tax_reporting_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payee_profile_id uuid not null,
  form_type text not null check (form_type in ('1099_NEC', '1099_MISC', 'DE_542', 'BACKUP_WITHHOLDING_DEPOSIT', 'W2_EVIDENCE', 'OTHER_STATE')),
  tax_year integer not null check (tax_year between 2020 and 2100),
  jurisdiction text not null,
  reportable_cents bigint not null default 0 check (reportable_cents >= 0),
  withholding_cents bigint not null default 0 check (withholding_cents >= 0),
  status text not null default 'PREPARED' check (status in ('PREPARED', 'HUMAN_APPROVED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CORRECTED', 'DELIVERED')),
  filing_channel text not null check (filing_channel in ('manual', 'iris_manual', 'iris_a2a', 'provider_evidence')),
  evidence_ref text,
  approved_by uuid,
  approved_at timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  correction_of_event_id uuid,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint tax_reporting_events_payee_fk foreign key (tenant_id, payee_profile_id)
    references public.payee_profiles(tenant_id, id) on delete restrict,
  constraint tax_reporting_events_approver_fk foreign key (tenant_id, approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint tax_reporting_events_correction_fk foreign key (tenant_id, correction_of_event_id)
    references public.tax_reporting_events(tenant_id, id) on delete restrict,
  unique (tenant_id, form_type, tax_year, jurisdiction, payee_profile_id, source_hash),
  unique (tenant_id, id)
);

create table if not exists public.finance_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  export_type text not null check (export_type in ('CHART', 'JOURNALS', 'GENERAL_LEDGER', 'TRIAL_BALANCE', 'PAYABLES', 'PAYOUTS', 'PAYROLL_REGISTER', 'LIABILITIES', 'BANK_RECONCILIATION', 'NURSE_PAY_SCHEDULES', 'TAX_READINESS', 'CONTROL_AUDIT')),
  format text not null check (format in ('CSV', 'JSON', 'PDF_READY_JSON')),
  period_start date,
  period_end date,
  as_of_at timestamptz not null,
  chart_version text,
  policy_version text not null,
  generation_id uuid not null default gen_random_uuid(),
  requested_by uuid not null,
  source_totals jsonb not null default '{}'::jsonb check (jsonb_typeof(source_totals) = 'object'),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  storage_ref text,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint finance_exports_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint finance_exports_requester_fk foreign key (tenant_id, requested_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, generation_id),
  unique (tenant_id, id)
);

-- Compatibility fields classify legacy invoice rows without treating typed
-- payment_reference text as provider settlement evidence.
alter table public.nurse_invoices
  add column if not exists legal_entity_id uuid,
  add column if not exists payable_id uuid,
  add column if not exists locked_version integer,
  add column if not exists locked_hash text,
  add column if not exists settlement_evidence_status text not null default 'none'
    check (settlement_evidence_status in ('none', 'provider_confirmed', 'controlled_manual', 'reconciliation_required')),
  add column if not exists legacy_payment_classification text
    check (legacy_payment_classification in ('provider_confirmed', 'controlled_manual', 'reconciliation_required'));

update public.nurse_invoices
set settlement_evidence_status = 'reconciliation_required',
    legacy_payment_classification = 'reconciliation_required'
where status = 'paid'
  and settlement_evidence_status = 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nurse_invoices'::regclass
      and conname = 'nurse_invoices_legal_entity_fk'
  ) then
    alter table public.nurse_invoices
      add constraint nurse_invoices_legal_entity_fk
      foreign key (tenant_id, legal_entity_id)
      references public.legal_entities(tenant_id, id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nurse_invoices'::regclass
      and conname = 'nurse_invoices_payable_fk'
  ) then
    alter table public.nurse_invoices
      add constraint nurse_invoices_payable_fk
      foreign key (tenant_id, payable_id)
      references public.payables(tenant_id, id) on delete restrict;
  end if;
end $$;

create index if not exists payables_review_queue_idx on public.payables (tenant_id, status, due_date, created_at);
create index if not exists payables_payee_created_idx on public.payables (tenant_id, payee_profile_id, created_at desc, id desc);
create index if not exists earning_events_worker_created_idx on public.earning_events (tenant_id, worker_profile_id, created_at desc, id desc);
create index if not exists earning_disputes_worker_created_idx on public.earning_disputes (tenant_id, opened_by, earning_event_id, created_at desc);
create index if not exists payout_items_provider_queue_idx on public.payout_items (tenant_id, status, updated_at);
create index if not exists finance_commands_queue_idx on public.finance_integration_commands (provider, status, next_attempt_at, created_at);
create index if not exists finance_events_queue_idx on public.finance_integration_events (provider, status, received_at);
create index if not exists ledger_journals_period_idx on public.ledger_journals (tenant_id, legal_entity_id, period_key, status, posting_date);
create index if not exists ledger_entries_account_idx on public.ledger_entries (tenant_id, account_id, journal_id);
create index if not exists bank_statement_items_date_idx on public.bank_statement_items (tenant_id, legal_entity_id, effective_date, provider_status);
create index if not exists finance_exceptions_queue_idx on public.finance_exceptions (tenant_id, status, severity, due_at);
create index if not exists payroll_inputs_queue_idx on public.payroll_inputs (tenant_id, status, payroll_calendar_id, created_at);
create index if not exists payroll_inputs_profile_calendar_idx on public.payroll_inputs (tenant_id, payroll_profile_id, payroll_calendar_id, created_at);
create index if not exists payroll_runs_queue_idx on public.payroll_runs (tenant_id, status, updated_at);
create index if not exists payroll_items_profile_created_idx on public.payroll_items (tenant_id, payroll_profile_id, created_at desc, id desc);

-- Finance data is server-only. Browser clients use authenticated APIs that
-- independently enforce tenant, role, version, and step-up checks.
do $$
declare
  finance_table text;
begin
  foreach finance_table in array array[
    'finance_role_assignments', 'engagement_decisions', 'payee_profiles', 'tax_profiles',
    'earning_events', 'earning_routings', 'earning_disputes', 'earning_dispute_events', 'payables', 'payable_lines',
    'payable_approvals', 'payable_hold_events', 'payout_batches', 'payout_items', 'payout_approvals', 'payout_attempts', 'payout_events',
    'finance_integration_commands', 'finance_integration_events', 'ledger_chart_versions',
    'ledger_accounts', 'ledger_journals', 'ledger_entries', 'ledger_journal_events', 'bank_statement_items',
    'finance_exceptions', 'reconciliation_matches', 'period_closures', 'payroll_profiles',
    'payroll_calendars', 'payroll_inputs', 'payroll_runs', 'payroll_items', 'payroll_statements',
    'payroll_events', 'payroll_liabilities', 'tax_reporting_events', 'finance_exports'
  ] loop
    execute format('alter table public.%I enable row level security', finance_table);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', finance_table);
  end loop;
end $$;

grant select on public.finance_role_assignments, public.engagement_decisions,
  public.payee_profiles, public.tax_profiles, public.earning_events, public.earning_routings,
  public.earning_disputes, public.earning_dispute_events, public.payables, public.payable_lines,
  public.payable_approvals, public.payable_hold_events, public.payout_batches, public.payout_items,
  public.payout_approvals,
  public.payout_attempts, public.payout_events, public.finance_integration_commands,
  public.finance_integration_events, public.ledger_chart_versions, public.ledger_accounts,
  public.ledger_journals, public.ledger_entries, public.ledger_journal_events, public.bank_statement_items,
  public.finance_exceptions, public.reconciliation_matches, public.period_closures,
  public.payroll_profiles, public.payroll_calendars, public.payroll_inputs, public.payroll_runs,
  public.payroll_items, public.payroll_statements, public.payroll_events, public.payroll_liabilities,
  public.tax_reporting_events, public.finance_exports to service_role;

create or replace function app_private.prevent_finance_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'finance_append_only_record_immutable';
end;
$$;

revoke all on function app_private.prevent_finance_append_only_mutation()
  from public, anon, authenticated, service_role;

do $$
declare
  immutable_table text;
begin
  foreach immutable_table in array array[
    'engagement_decisions', 'earning_routings', 'earning_dispute_events', 'payable_lines',
    'payable_approvals', 'payable_hold_events', 'payout_approvals', 'payout_attempts', 'payout_events',
    'ledger_entries', 'ledger_journal_events', 'payroll_statements', 'payroll_events'
  ] loop
    execute format('drop trigger if exists %I on public.%I', immutable_table || '_immutable', immutable_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function app_private.prevent_finance_append_only_mutation()',
      immutable_table || '_immutable', immutable_table
    );
  end loop;
end $$;

create or replace function app_private.prevent_posted_journal_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('POSTED', 'REVERSED') then
    raise exception using errcode = 'P0001', message = 'posted_journal_immutable';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_posted_journal_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists ledger_journals_posted_immutable on public.ledger_journals;
create trigger ledger_journals_posted_immutable
  before update or delete on public.ledger_journals
  for each row execute function app_private.prevent_posted_journal_mutation();

create or replace function app_private.prevent_locked_payable_money_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'OPEN' and (
    old.tenant_id is distinct from new.tenant_id
    or old.payee_profile_id is distinct from new.payee_profile_id
    or old.engagement_decision_id is distinct from new.engagement_decision_id
    or old.source_invoice_id is distinct from new.source_invoice_id
    or old.source_invoice_version is distinct from new.source_invoice_version
    or old.gross_cents is distinct from new.gross_cents
    or old.reimbursement_cents is distinct from new.reimbursement_cents
    or old.backup_withholding_cents is distinct from new.backup_withholding_cents
    or old.other_withholding_cents is distinct from new.other_withholding_cents
    or old.net_cents is distinct from new.net_cents
    or old.currency is distinct from new.currency
    or old.calculation_hash is distinct from new.calculation_hash
    or old.engagement_snapshot is distinct from new.engagement_snapshot
  ) then
    raise exception using errcode = 'P0001', message = 'approved_payable_money_immutable';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_locked_payable_money_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists payables_money_immutable on public.payables;
create trigger payables_money_immutable
  before update on public.payables
  for each row execute function app_private.prevent_locked_payable_money_mutation();

create or replace function app_private.prevent_earning_source_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.tenant_id is distinct from new.tenant_id
    or old.worker_profile_id is distinct from new.worker_profile_id
    or old.legal_entity_id is distinct from new.legal_entity_id
    or old.source_type is distinct from new.source_type
    or old.source_id is distinct from new.source_id
    or old.source_version is distinct from new.source_version
    or old.source_hash is distinct from new.source_hash
    or old.service_date is distinct from new.service_date
    or old.category is distinct from new.category
    or old.quantity is distinct from new.quantity
    or old.unit is distinct from new.unit
    or old.unit_amount_cents is distinct from new.unit_amount_cents
    or old.gross_amount_cents is distinct from new.gross_amount_cents
    or old.reimbursement_amount_cents is distinct from new.reimbursement_amount_cents
    or old.currency is distinct from new.currency
    or old.rate_policy_version is distinct from new.rate_policy_version
    or old.calculation_hash is distinct from new.calculation_hash then
    raise exception using errcode = 'P0001', message = 'earning_source_money_immutable';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_earning_source_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists earning_events_source_immutable on public.earning_events;
create trigger earning_events_source_immutable
  before update on public.earning_events
  for each row execute function app_private.prevent_earning_source_mutation();

comment on table public.engagement_decisions is
  'Append-only HR/Legal worker engagement decisions. Nurses cannot self-select a pay rail.';
comment on table public.payee_profiles is
  'Payee readiness and masked Mercury references only. Raw bank details are never stored here.';
comment on table public.tax_profiles is
  'Restricted tax readiness and masked TIN evidence. Raw TIN belongs only in an approved vault or hosted workflow.';
comment on table public.ledger_journals is
  'Avalon nurse-pay subledger journals only; not Avalon complete company books.';
comment on table public.finance_integration_commands is
  'Transactional outbox intent for finance providers. It is not evidence a provider accepted, funded, paid, or filed.';
comment on table public.finance_integration_events is
  'PHI-minimized immutable finance provider inbox metadata and checksums; raw webhook bodies are not stored here.';
