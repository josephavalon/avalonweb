-- Avalon Vendor AP and supplies-payment controls.
--
-- Purchase orders and receipts remain operational inventory evidence. A vendor
-- bill becomes payable only after structured PO/receipt matching (or a coded,
-- non-inventory exception), maker approval, independent checker approval, and
-- independent executor authorization. This migration never contacts a bank.
-- It can only place an exact, PHI-free command in the finance outbox.
-- SETTLED requires controlled provider/manual evidence plus an approved,
-- zero-variance bank reconciliation performed by a fourth human controller.

do $$
begin
  if to_regclass('public.os_inventory_vendors') is null
     or to_regclass('public.os_purchase_orders') is null
     or to_regclass('public.os_purchase_order_lines') is null
     or to_regclass('public.os_stock_transactions') is null
     or to_regclass('public.legal_entities') is null
     or to_regclass('public.finance_integration_commands') is null
     or to_regclass('public.finance_integration_events') is null
     or to_regclass('public.bank_statement_items') is null
     or to_regclass('public.reconciliation_matches') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('app_private.assert_payops_actor_role(uuid,uuid,text[])') is null
     or to_regprocedure('app_private.lock_payops_idempotency(uuid,text,text)') is null
     or to_regprocedure('app_private.lock_payops_aggregate(uuid,text,uuid)') is null
     or to_regprocedure('app_private.finance_command_checksum(jsonb)') is null
     or to_regprocedure('digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'vendor_ap_prerequisite_migrations_missing';
  end if;
end $$;

-- Bank amounts remain signed provider evidence. This generated field is the
-- canonical, adapter-independent direction used by every payment reconciler;
-- callers may match the magnitude only after proving the row is a debit.
alter table public.bank_statement_items
  add column if not exists normalized_direction text generated always as (
    case when amount_cents < 0 then 'DEBIT' else 'CREDIT' end
  ) stored;
alter table public.bank_statement_items
  alter column normalized_direction set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bank_statement_items'::regclass
      and conname = 'bank_statement_items_normalized_direction_check'
  ) then
    alter table public.bank_statement_items
      add constraint bank_statement_items_normalized_direction_check check (
        normalized_direction in ('DEBIT', 'CREDIT')
        and normalized_direction = case when amount_cents < 0 then 'DEBIT' else 'CREDIT' end
      );
  end if;
end $$;

comment on column public.bank_statement_items.normalized_direction is
  'Canonical direction derived from the immutable signed provider amount; payment settlement requires DEBIT.';

-- Terminal provider adapters populate these PHI-free values before marking an
-- event PROCESSED. Vendor and contractor settlement bind them to the bank row.
alter table public.finance_integration_events
  add column if not exists provider_transaction_id text,
  add column if not exists settlement_amount_cents bigint,
  add column if not exists settlement_currency text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.finance_integration_events'::regclass
      and conname = 'finance_integration_events_settlement_fields_check'
  ) then
    alter table public.finance_integration_events
      add constraint finance_integration_events_settlement_fields_check check (
        (provider_transaction_id is null and settlement_amount_cents is null and settlement_currency is null)
        or (
          provider_transaction_id is not null
          and settlement_amount_cents is not null
          and settlement_currency is not null
          and provider_transaction_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'
          and settlement_amount_cents > 0
          and settlement_currency ~ '^[A-Z]{3}$'
        )
      );
  end if;
end $$;

create unique index if not exists finance_events_mercury_vendor_terminal_transaction_uidx
  on public.finance_integration_events (tenant_id, provider, provider_transaction_id)
  where provider = 'mercury' and event_type = 'VENDOR_PAYMENT_SETTLED'
    and status = 'PROCESSED' and provider_transaction_id is not null;

create unique index if not exists os_inventory_vendors_tenant_id_id_uidx
  on public.os_inventory_vendors (tenant_id, id);
create unique index if not exists os_purchase_orders_tenant_id_id_uidx
  on public.os_purchase_orders (tenant_id, id);
create unique index if not exists os_purchase_order_lines_tenant_id_id_uidx
  on public.os_purchase_order_lines (tenant_id, id);
create unique index if not exists os_stock_transactions_tenant_id_id_uidx
  on public.os_stock_transactions (tenant_id, id);

create table if not exists public.vendor_finance_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inventory_vendor_id uuid not null,
  legal_entity_id uuid not null,
  legal_name text not null check (
    char_length(trim(legal_name)) between 1 and 160
    and legal_name !~ '[\r\n]'
  ),
  tax_classification text not null check (tax_classification in (
    'C_CORP', 'S_CORP', 'PARTNERSHIP', 'LLC', 'SOLE_PROPRIETOR',
    'NONPROFIT', 'GOVERNMENT', 'FOREIGN', 'OTHER_REVIEW_REQUIRED'
  )),
  tax_reporting_status text not null default 'PENDING'
    check (tax_reporting_status in ('PENDING', 'READY', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'HELD')),
  w9_status text not null default 'MISSING'
    check (w9_status in ('MISSING', 'INVITED', 'RECEIVED', 'VERIFIED', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'EXPIRED')),
  tin_match_status text not null default 'NOT_RUN'
    check (tin_match_status in ('NOT_RUN', 'PENDING', 'MATCHED', 'MANUAL_REVIEW', 'MISMATCH', 'UNAVAILABLE')),
  payment_readiness text not null default 'PENDING'
    check (payment_readiness in ('PENDING', 'READY', 'ACTION_REQUIRED', 'HELD')),
  destination_provider text not null default 'mercury'
    check (destination_provider in ('mercury', 'controlled_manual')),
  provider_recipient_id text,
  destination_masked_label text,
  destination_snapshot_hash text not null check (destination_snapshot_hash ~ '^[0-9a-f]{64}$'),
  destination_changed_at timestamptz not null default clock_timestamp(),
  destination_changed_by uuid not null,
  destination_reviewed_at timestamptz,
  destination_reviewed_by uuid,
  status text not null default 'PENDING_REVIEW'
    check (status in ('PENDING_REVIEW', 'ACTIVE', 'HELD', 'ARCHIVED')),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint vendor_finance_profiles_vendor_fk foreign key (tenant_id, inventory_vendor_id)
    references public.os_inventory_vendors(tenant_id, id) on delete restrict,
  constraint vendor_finance_profiles_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint vendor_finance_profiles_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_finance_profiles_destination_actor_fk foreign key (tenant_id, destination_changed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_finance_profiles_destination_reviewer_fk foreign key (tenant_id, destination_reviewed_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_finance_profiles_destination_review_check check (
    (destination_reviewed_at is null and destination_reviewed_by is null)
    or (destination_reviewed_at is not null and destination_reviewed_by is not null
      and destination_reviewed_at >= destination_changed_at
      and destination_reviewed_by <> destination_changed_by)
  ),
  constraint vendor_finance_profiles_ready_check check (
    status <> 'ACTIVE' or (
      payment_readiness = 'READY'
      and tax_reporting_status in ('READY', 'EXEMPT_VERIFIED')
      and w9_status in ('VERIFIED', 'EXEMPT_VERIFIED')
      and tin_match_status in ('MATCHED', 'MANUAL_REVIEW', 'UNAVAILABLE')
      and destination_reviewed_at is not null
      and destination_reviewed_by is not null
      and destination_masked_label is not null
      and (
        (destination_provider = 'mercury' and provider_recipient_id is not null)
        or destination_provider = 'controlled_manual'
      )
    )
  ),
  unique (tenant_id, inventory_vendor_id, legal_entity_id),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, destination_provider, provider_recipient_id),
  unique (tenant_id, id)
);

create table if not exists public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_finance_profile_id uuid not null,
  legal_entity_id uuid not null,
  purchase_order_id uuid,
  bill_number text not null check (
    char_length(bill_number) between 1 and 120
    and bill_number ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
  ),
  invoice_date date not null,
  due_date date not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  source_document_ref text not null check (
    source_document_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
  ),
  source_document_checksum text not null check (source_document_checksum ~ '^[0-9a-f]{64}$'),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'MATCHED', 'MATCH_EXCEPTION', 'MAKER_APPROVED',
    'CHECKER_APPROVED', 'PAYMENT_QUEUED', 'PROVIDER_PENDING',
    'SETTLED', 'HELD', 'ACTION_REQUIRED', 'RECONCILIATION_REQUIRED', 'CANCELLED'
  )),
  match_status text not null default 'PENDING'
    check (match_status in ('PENDING', 'MATCHED', 'EXCEPTION', 'NOT_REQUIRED')),
  match_evidence_id uuid,
  maker_approved_by uuid,
  maker_approved_at timestamptz,
  checker_approved_by uuid,
  checker_approved_at timestamptz,
  hold_code text check (hold_code is null or hold_code ~ '^[A-Z0-9_]{3,100}$'),
  hold_owner_profile_id uuid,
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason_code text check (cancel_reason_code is null or cancel_reason_code ~ '^[A-Z0-9_]{3,100}$'),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint vendor_bills_profile_fk foreign key (tenant_id, vendor_finance_profile_id)
    references public.vendor_finance_profiles(tenant_id, id) on delete restrict,
  constraint vendor_bills_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint vendor_bills_purchase_order_fk foreign key (tenant_id, purchase_order_id)
    references public.os_purchase_orders(tenant_id, id) on delete restrict,
  constraint vendor_bills_maker_fk foreign key (tenant_id, maker_approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bills_checker_fk foreign key (tenant_id, checker_approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bills_hold_owner_fk foreign key (tenant_id, hold_owner_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bills_canceller_fk foreign key (tenant_id, cancelled_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bills_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bills_date_check check (due_date >= invoice_date),
  constraint vendor_bills_total_check check (
    total_cents = subtotal_cents + tax_cents + shipping_cents
  ),
  constraint vendor_bills_maker_checker_check check (
    checker_approved_by is null or (
      maker_approved_by is not null and checker_approved_by <> maker_approved_by
    )
  ),
  constraint vendor_bills_hold_check check (
    (status = 'HELD' and hold_code is not null and hold_owner_profile_id is not null)
    or status <> 'HELD'
  ),
  constraint vendor_bills_cancel_check check (
    (status = 'CANCELLED' and cancelled_by is not null and cancelled_at is not null and cancel_reason_code is not null)
    or status <> 'CANCELLED'
  ),
  unique (tenant_id, vendor_finance_profile_id, bill_number),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

create table if not exists public.vendor_bill_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_bill_id uuid not null,
  purchase_order_line_id uuid,
  inventory_item_id uuid,
  line_type text not null check (line_type in ('INVENTORY', 'SERVICE', 'FEE', 'OTHER')),
  line_code text not null check (line_code ~ '^[A-Z0-9_]{3,100}$'),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_amount_cents bigint not null check (unit_amount_cents >= 0),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint vendor_bill_lines_bill_fk foreign key (tenant_id, vendor_bill_id)
    references public.vendor_bills(tenant_id, id) on delete restrict,
  constraint vendor_bill_lines_po_line_fk foreign key (tenant_id, purchase_order_line_id)
    references public.os_purchase_order_lines(tenant_id, id) on delete restrict,
  constraint vendor_bill_lines_item_fk foreign key (tenant_id, inventory_item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint vendor_bill_lines_creator_fk foreign key (tenant_id, created_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bill_lines_inventory_source_check check (
    line_type <> 'INVENTORY' or (purchase_order_line_id is not null and inventory_item_id is not null)
  ),
  constraint vendor_bill_lines_noninventory_source_check check (
    line_type = 'INVENTORY' or purchase_order_line_id is null
  ),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, vendor_bill_id, source_hash),
  unique (tenant_id, id)
);

create table if not exists public.vendor_bill_match_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_bill_id uuid not null,
  vendor_bill_version integer not null check (vendor_bill_version > 0),
  purchase_order_id uuid,
  match_type text not null check (match_type in ('THREE_WAY', 'NON_PO_CONTROLLED_EXCEPTION')),
  match_status text not null check (match_status in ('MATCHED', 'EXCEPTION', 'NOT_REQUIRED')),
  purchase_order_total_cents bigint,
  bill_total_cents bigint not null check (bill_total_cents > 0),
  variance_cents bigint not null,
  tolerance_cents bigint not null default 0 check (tolerance_cents >= 0),
  receipt_count integer not null default 0 check (receipt_count >= 0),
  fully_received boolean not null default false,
  safe_exception_code text check (safe_exception_code is null or safe_exception_code ~ '^[A-Z0-9_]{3,100}$'),
  safe_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_snapshot) = 'object'),
  evidence_checksum text not null check (evidence_checksum ~ '^[0-9a-f]{64}$'),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  prepared_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint vendor_bill_match_bill_fk foreign key (tenant_id, vendor_bill_id)
    references public.vendor_bills(tenant_id, id) on delete restrict,
  constraint vendor_bill_match_po_fk foreign key (tenant_id, purchase_order_id)
    references public.os_purchase_orders(tenant_id, id) on delete restrict,
  constraint vendor_bill_match_preparer_fk foreign key (tenant_id, prepared_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_bill_match_exception_check check (
    (match_type = 'THREE_WAY' and purchase_order_id is not null and safe_exception_code is null)
    or (match_type = 'NON_PO_CONTROLLED_EXCEPTION' and purchase_order_id is null and safe_exception_code is not null)
  ),
  unique (tenant_id, vendor_bill_id, vendor_bill_version),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, id)
);

alter table public.vendor_bills
  drop constraint if exists vendor_bills_match_evidence_fk;
alter table public.vendor_bills
  add constraint vendor_bills_match_evidence_fk
  foreign key (tenant_id, match_evidence_id)
  references public.vendor_bill_match_evidence(tenant_id, id) on delete restrict;

create table if not exists public.vendor_bill_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_bill_id uuid not null,
  vendor_payment_id uuid,
  stage text not null check (stage in ('MAKER', 'CHECKER', 'EXECUTOR')),
  decision text not null check (decision in ('APPROVED', 'SEND_AUTHORIZED', 'REJECTED', 'INVALIDATED')),
  actor_profile_id uuid not null,
  aggregate_version integer not null check (aggregate_version > 0),
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint vendor_bill_approvals_bill_fk foreign key (tenant_id, vendor_bill_id)
    references public.vendor_bills(tenant_id, id) on delete restrict,
  constraint vendor_bill_approvals_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, vendor_bill_id, stage, aggregate_version),
  unique (tenant_id, id)
);

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_bill_id uuid not null,
  vendor_finance_profile_id uuid not null,
  legal_entity_id uuid not null,
  bill_version integer not null check (bill_version > 0),
  profile_version integer not null check (profile_version > 0),
  provider text not null default 'mercury' check (provider = 'mercury'),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  funding_account_ref text not null check (funding_account_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'),
  funding_account_masked_label text not null check (char_length(funding_account_masked_label) between 3 and 120),
  destination_snapshot_hash text not null check (destination_snapshot_hash ~ '^[0-9a-f]{64}$'),
  destination_masked_label text not null check (char_length(destination_masked_label) between 3 and 120),
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'APPROVAL_PENDING' check (status in (
    'APPROVAL_PENDING', 'READY', 'COMMAND_QUEUED', 'PROVIDER_PENDING',
    'SETTLED', 'HELD', 'ACTION_REQUIRED', 'RECONCILIATION_REQUIRED', 'CANCELLED'
  )),
  maker_prepared_by uuid not null,
  maker_prepared_at timestamptz not null default clock_timestamp(),
  checker_approved_by uuid,
  checker_approved_at timestamptz,
  executor_authorized_by uuid,
  executor_authorized_at timestamptz,
  command_id uuid,
  provider_transaction_id text,
  settlement_evidence_status text not null default 'NONE'
    check (settlement_evidence_status in ('NONE', 'PROVIDER_CONFIRMED', 'CONTROLLED_MANUAL')),
  reconciliation_state text not null default 'UNMATCHED'
    check (reconciliation_state in ('UNMATCHED', 'MATCHED', 'EXCEPTION')),
  settled_at timestamptz,
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint vendor_payments_bill_fk foreign key (tenant_id, vendor_bill_id)
    references public.vendor_bills(tenant_id, id) on delete restrict,
  constraint vendor_payments_profile_fk foreign key (tenant_id, vendor_finance_profile_id)
    references public.vendor_finance_profiles(tenant_id, id) on delete restrict,
  constraint vendor_payments_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint vendor_payments_maker_fk foreign key (tenant_id, maker_prepared_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_payments_checker_fk foreign key (tenant_id, checker_approved_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_payments_executor_fk foreign key (tenant_id, executor_authorized_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_payments_command_fk foreign key (tenant_id, command_id)
    references public.finance_integration_commands(tenant_id, id) on delete restrict,
  constraint vendor_payments_segregation_check check (
    (checker_approved_by is null or checker_approved_by <> maker_prepared_by)
    and (executor_authorized_by is null or (
      executor_authorized_by <> maker_prepared_by
      and executor_authorized_by <> checker_approved_by
    ))
  ),
  constraint vendor_payments_settlement_check check (
    (status = 'SETTLED'
      and settlement_evidence_status <> 'NONE'
      and reconciliation_state = 'MATCHED'
      and provider_transaction_id is not null
      and settled_at is not null)
    or status <> 'SETTLED'
  ),
  unique (tenant_id, vendor_bill_id),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, provider, provider_transaction_id),
  unique (tenant_id, id)
);

comment on column public.vendor_payments.funding_account_ref is
  'Exact Mercury provider_account_id used by the approved outbox command; it is not a label or raw bank account number.';

alter table public.vendor_bill_approvals
  drop constraint if exists vendor_bill_approvals_payment_fk;
alter table public.vendor_bill_approvals
  add constraint vendor_bill_approvals_payment_fk
  foreign key (tenant_id, vendor_payment_id)
  references public.vendor_payments(tenant_id, id) on delete restrict;

create table if not exists public.vendor_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_payment_id uuid not null,
  evidence_source text not null check (evidence_source in ('PROVIDER_CONFIRMED', 'CONTROLLED_MANUAL')),
  finance_integration_event_id uuid,
  bank_statement_item_id uuid not null,
  reconciliation_match_id uuid not null,
  provider_transaction_id text not null,
  evidence_ref text not null check (evidence_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'),
  evidence_checksum text not null check (evidence_checksum ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  recorded_by uuid not null,
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint vendor_payment_evidence_payment_fk foreign key (tenant_id, vendor_payment_id)
    references public.vendor_payments(tenant_id, id) on delete restrict,
  constraint vendor_payment_evidence_event_fk foreign key (tenant_id, finance_integration_event_id)
    references public.finance_integration_events(tenant_id, id) on delete restrict,
  constraint vendor_payment_evidence_bank_fk foreign key (tenant_id, bank_statement_item_id)
    references public.bank_statement_items(tenant_id, id) on delete restrict,
  constraint vendor_payment_evidence_reconciliation_fk foreign key (tenant_id, reconciliation_match_id)
    references public.reconciliation_matches(tenant_id, id) on delete restrict,
  constraint vendor_payment_evidence_actor_fk foreign key (tenant_id, recorded_by)
    references public.profiles(tenant_id, id) on delete restrict,
  constraint vendor_payment_evidence_source_check check (
    (evidence_source = 'PROVIDER_CONFIRMED' and finance_integration_event_id is not null)
    or (evidence_source = 'CONTROLLED_MANUAL' and finance_integration_event_id is null)
  ),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, vendor_payment_id, evidence_checksum),
  unique (tenant_id, id)
);

create table if not exists public.vendor_ap_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  aggregate_type text not null check (aggregate_type in ('VENDOR_PROFILE', 'VENDOR_BILL', 'VENDOR_PAYMENT')),
  aggregate_id uuid not null,
  from_status text,
  to_status text not null,
  actor_profile_id uuid not null,
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,100}$'),
  aggregate_version integer not null check (aggregate_version > 0),
  request_idempotency_key text not null check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint vendor_ap_events_actor_fk foreign key (tenant_id, actor_profile_id)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version, to_status),
  unique (tenant_id, id)
);

alter table public.reconciliation_matches
  add column if not exists vendor_payment_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reconciliation_matches'::regclass
      and conname = 'reconciliation_matches_vendor_payment_fk'
  ) then
    alter table public.reconciliation_matches
      add constraint reconciliation_matches_vendor_payment_fk
      foreign key (tenant_id, vendor_payment_id)
      references public.vendor_payments(tenant_id, id) on delete restrict;
  end if;
end $$;
create unique index if not exists reconciliation_matches_vendor_payment_approved_uidx
  on public.reconciliation_matches (tenant_id, vendor_payment_id)
  where vendor_payment_id is not null and match_status = 'APPROVED';

create index if not exists vendor_bills_queue_idx
  on public.vendor_bills (tenant_id, status, due_date, created_at desc);
create index if not exists vendor_bills_profile_idx
  on public.vendor_bills (tenant_id, vendor_finance_profile_id, created_at desc);
create index if not exists vendor_payments_queue_idx
  on public.vendor_payments (tenant_id, status, updated_at);
create unique index if not exists vendor_bills_one_active_bill_per_po_uidx
  on public.vendor_bills (tenant_id, purchase_order_id)
  where purchase_order_id is not null and status <> 'CANCELLED';
create unique index if not exists vendor_bill_lines_po_line_once_uidx
  on public.vendor_bill_lines (tenant_id, vendor_bill_id, purchase_order_line_id)
  where purchase_order_line_id is not null;
create unique index if not exists reconciliation_matches_bank_approved_uidx
  on public.reconciliation_matches (tenant_id, bank_statement_item_id)
  where match_status = 'APPROVED';

create or replace function app_private.prevent_vendor_ap_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'vendor_ap_append_only_record_immutable';
end;
$$;

revoke all on function app_private.prevent_vendor_ap_append_only_mutation()
  from public, anon, authenticated, service_role;

do $$
declare
  immutable_table text;
begin
  foreach immutable_table in array array[
    'vendor_bill_lines', 'vendor_bill_match_evidence', 'vendor_bill_approvals',
    'vendor_payment_evidence', 'vendor_ap_events'
  ] loop
    execute format('drop trigger if exists %I on public.%I', immutable_table || '_immutable', immutable_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function app_private.prevent_vendor_ap_append_only_mutation()',
      immutable_table || '_immutable', immutable_table
    );
  end loop;
end $$;

create or replace function app_private.vendor_payment_proposal_hash(
  p_tenant_id uuid,
  p_vendor_payment_id uuid,
  p_vendor_bill_id uuid,
  p_bill_version integer,
  p_vendor_finance_profile_id uuid,
  p_profile_version integer,
  p_legal_entity_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_provider_recipient_id text,
  p_destination_snapshot_hash text,
  p_destination_masked_label text,
  p_funding_account_ref text,
  p_funding_account_masked_label text
)
returns text
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'vendor_payment_id', p_vendor_payment_id,
    'vendor_bill_id', p_vendor_bill_id,
    'bill_version', p_bill_version,
    'vendor_finance_profile_id', p_vendor_finance_profile_id,
    'profile_version', p_profile_version,
    'legal_entity_id', p_legal_entity_id,
    'amount_cents', p_amount_cents,
    'currency', p_currency,
    'provider_recipient_id', p_provider_recipient_id,
    'destination_snapshot_hash', p_destination_snapshot_hash,
    'destination_masked_label', p_destination_masked_label,
    'funding_account_ref', p_funding_account_ref,
    'funding_account_masked_label', p_funding_account_masked_label
  )::text, 'sha256'), 'hex');
$$;

revoke all on function app_private.vendor_payment_proposal_hash(
  uuid, uuid, uuid, integer, uuid, integer, uuid, bigint, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function public.create_vendor_finance_profile(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_inventory_vendor_id uuid,
  p_legal_entity_id uuid,
  p_legal_name text,
  p_tax_classification text,
  p_destination_provider text,
  p_provider_recipient_id text,
  p_destination_masked_label text,
  p_idempotency_key text
)
returns public.vendor_finance_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.vendor_finance_profiles%rowtype;
  v_request_hash text;
  v_destination_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or char_length(trim(coalesce(p_legal_name, ''))) not between 1 and 160
     or p_tax_classification not in (
       'C_CORP', 'S_CORP', 'PARTNERSHIP', 'LLC', 'SOLE_PROPRIETOR',
       'NONPROFIT', 'GOVERNMENT', 'FOREIGN', 'OTHER_REVIEW_REQUIRED'
     )
     or p_destination_provider not in ('mercury', 'controlled_manual')
     or char_length(trim(coalesce(p_destination_masked_label, ''))) not between 3 and 120
     or (p_destination_provider = 'mercury'
       and char_length(trim(coalesce(p_provider_recipient_id, ''))) not between 3 and 200) then
    raise exception using errcode = '22023', message = 'vendor_finance_profile_request_invalid';
  end if;
  if not exists (
    select 1 from public.os_inventory_vendors vendor
    where vendor.tenant_id = p_tenant_id and vendor.id = p_inventory_vendor_id
      and vendor.status = 'active' and vendor.archived_at is null
  ) or not exists (
    select 1 from public.legal_entities entity
    where entity.tenant_id = p_tenant_id and entity.id = p_legal_entity_id
  ) then
    raise exception using errcode = 'P0001', message = 'vendor_or_legal_entity_invalid';
  end if;
  v_destination_hash := encode(digest(jsonb_build_object(
    'destination_provider', p_destination_provider,
    'provider_recipient_id', nullif(trim(p_provider_recipient_id), ''),
    'destination_masked_label', trim(p_destination_masked_label)
  )::text, 'sha256'), 'hex');
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'actor_profile_id', p_actor_profile_id,
    'inventory_vendor_id', p_inventory_vendor_id, 'legal_entity_id', p_legal_entity_id,
    'legal_name', trim(p_legal_name), 'tax_classification', p_tax_classification,
    'destination_provider', p_destination_provider,
    'provider_recipient_id', nullif(trim(p_provider_recipient_id), ''),
    'destination_masked_label', trim(p_destination_masked_label),
    'destination_snapshot_hash', v_destination_hash
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_profile_create', p_idempotency_key);
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.request_idempotency_key = p_idempotency_key;
  if found then
    if v_profile.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_profile;
  end if;
  insert into public.vendor_finance_profiles (
    tenant_id, inventory_vendor_id, legal_entity_id, legal_name, tax_classification,
    destination_provider, provider_recipient_id, destination_masked_label,
    destination_snapshot_hash, destination_changed_by,
    request_idempotency_key, request_hash, created_by
  ) values (
    p_tenant_id, p_inventory_vendor_id, p_legal_entity_id, trim(p_legal_name),
    p_tax_classification, p_destination_provider, nullif(trim(p_provider_recipient_id), ''),
    trim(p_destination_masked_label), v_destination_hash, p_actor_profile_id,
    p_idempotency_key, v_request_hash, p_actor_profile_id
  ) returning * into v_profile;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_PROFILE', v_profile.id, null, v_profile.status,
    p_actor_profile_id, 'VENDOR_PROFILE_CREATED', v_profile.version,
    p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_finance_profile_created',
    'vendor_finance_profiles', v_profile.id, false, v_request_hash,
    jsonb_build_object('inventory_vendor_id', p_inventory_vendor_id,
      'legal_entity_id', p_legal_entity_id, 'destination_provider', p_destination_provider)
  );
  return v_profile;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'vendor_finance_profile_already_exists';
end;
$$;

revoke all on function public.create_vendor_finance_profile(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_vendor_finance_profile(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text
) to service_role;

create or replace function public.review_vendor_finance_profile(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_finance_profile_id uuid,
  p_expected_version integer,
  p_tax_reporting_status text,
  p_w9_status text,
  p_tin_match_status text,
  p_payment_readiness text,
  p_reason_code text,
  p_idempotency_key text
)
returns public.vendor_finance_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.vendor_finance_profiles%rowtype;
  v_event public.vendor_ap_events%rowtype;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_checker']::text[]
  );
  if p_expected_version < 1
     or p_tax_reporting_status not in ('READY', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'HELD')
     or p_w9_status not in ('VERIFIED', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'EXPIRED')
     or p_tin_match_status not in ('MATCHED', 'MANUAL_REVIEW', 'MISMATCH', 'UNAVAILABLE')
     or p_payment_readiness not in ('READY', 'ACTION_REQUIRED', 'HELD')
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_finance_profile_review_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'profile_id', p_vendor_finance_profile_id,
    'expected_version', p_expected_version, 'actor_profile_id', p_actor_profile_id,
    'tax_reporting_status', p_tax_reporting_status, 'w9_status', p_w9_status,
    'tin_match_status', p_tin_match_status, 'payment_readiness', p_payment_readiness,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_profile_review', p_idempotency_key);
  select * into v_event from public.vendor_ap_events event
  where event.tenant_id = p_tenant_id and event.request_idempotency_key = p_idempotency_key;
  if found then
    if v_event.aggregate_id <> p_vendor_finance_profile_id or v_event.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_profile from public.vendor_finance_profiles profile
    where profile.tenant_id = p_tenant_id and profile.id = p_vendor_finance_profile_id;
    return v_profile;
  end if;
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = p_vendor_finance_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_finance_profile_not_found'; end if;
  if v_profile.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'vendor_finance_profile_version_conflict';
  end if;
  if v_profile.created_by = p_actor_profile_id
     or v_profile.destination_changed_by = p_actor_profile_id then
    raise exception using errcode = 'P0001', message = 'vendor_profile_maker_checker_required';
  end if;
  if p_payment_readiness = 'READY' and (
    p_tax_reporting_status not in ('READY', 'EXEMPT_VERIFIED')
    or p_w9_status not in ('VERIFIED', 'EXEMPT_VERIFIED')
    or p_tin_match_status not in ('MATCHED', 'MANUAL_REVIEW', 'UNAVAILABLE')
  ) then
    raise exception using errcode = 'P0001', message = 'vendor_tax_or_payment_not_ready';
  end if;
  update public.vendor_finance_profiles
  set tax_reporting_status = p_tax_reporting_status,
      w9_status = p_w9_status,
      tin_match_status = p_tin_match_status,
      payment_readiness = p_payment_readiness,
      destination_reviewed_at = clock_timestamp(),
      destination_reviewed_by = p_actor_profile_id,
      status = case when p_payment_readiness = 'READY' then 'ACTIVE' else 'HELD' end,
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_vendor_finance_profile_id
    and version = p_expected_version
  returning * into v_profile;
  if not found then raise exception using errcode = '40001', message = 'vendor_finance_profile_version_conflict'; end if;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_PROFILE', v_profile.id, 'PENDING_REVIEW', v_profile.status,
    p_actor_profile_id, p_reason_code, v_profile.version, p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_finance_profile_reviewed',
    'vendor_finance_profiles', v_profile.id, false, v_request_hash,
    jsonb_build_object('status', v_profile.status,
      'tax_reporting_status', p_tax_reporting_status, 'payment_readiness', p_payment_readiness)
  );
  return v_profile;
end;
$$;

revoke all on function public.review_vendor_finance_profile(
  uuid, uuid, uuid, integer, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.review_vendor_finance_profile(
  uuid, uuid, uuid, integer, text, text, text, text, text, text
) to service_role;

create or replace function public.create_vendor_bill(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_finance_profile_id uuid,
  p_purchase_order_id uuid,
  p_bill_number text,
  p_invoice_date date,
  p_due_date date,
  p_currency text,
  p_tax_cents bigint,
  p_shipping_cents bigint,
  p_source_document_ref text,
  p_source_document_checksum text,
  p_idempotency_key text
)
returns public.vendor_bills
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.vendor_finance_profiles%rowtype;
  v_bill public.vendor_bills%rowtype;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if coalesce(p_bill_number, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
     or p_invoice_date is null or p_due_date is null or p_due_date < p_invoice_date
     or coalesce(p_currency, '') !~ '^[A-Z]{3}$'
     or p_tax_cents is null or p_tax_cents < 0
     or p_shipping_cents is null or p_shipping_cents < 0
     or coalesce(p_source_document_ref, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
     or coalesce(p_source_document_checksum, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_bill_request_invalid';
  end if;
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = p_vendor_finance_profile_id;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_finance_profile_not_found'; end if;
  if p_purchase_order_id is not null and not exists (
    select 1 from public.os_purchase_orders purchase_order
    where purchase_order.tenant_id = p_tenant_id
      and purchase_order.id = p_purchase_order_id
      and purchase_order.vendor_id = v_profile.inventory_vendor_id
      and purchase_order.status <> 'cancelled'
  ) then
    raise exception using errcode = 'P0001', message = 'vendor_bill_purchase_order_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'actor_profile_id', p_actor_profile_id,
    'profile_id', p_vendor_finance_profile_id, 'purchase_order_id', p_purchase_order_id,
    'bill_number', p_bill_number, 'invoice_date', p_invoice_date, 'due_date', p_due_date,
    'currency', p_currency, 'tax_cents', p_tax_cents, 'shipping_cents', p_shipping_cents,
    'source_document_ref', p_source_document_ref,
    'source_document_checksum', p_source_document_checksum
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_bill_create', p_idempotency_key);
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.request_idempotency_key = p_idempotency_key;
  if found then
    if v_bill.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_bill;
  end if;
  if p_purchase_order_id is not null then
    perform app_private.lock_payops_aggregate(
      p_tenant_id, 'vendor_purchase_order_bill', p_purchase_order_id
    );
    if exists (
      select 1 from public.vendor_bills existing_bill
      where existing_bill.tenant_id = p_tenant_id
        and existing_bill.purchase_order_id = p_purchase_order_id
        and existing_bill.status <> 'CANCELLED'
    ) then
      raise exception using errcode = 'P0001', message = 'vendor_purchase_order_bill_already_exists';
    end if;
  end if;
  insert into public.vendor_bills (
    tenant_id, vendor_finance_profile_id, legal_entity_id, purchase_order_id,
    bill_number, invoice_date, due_date, currency, subtotal_cents, tax_cents,
    shipping_cents, total_cents, source_document_ref, source_document_checksum,
    request_idempotency_key, request_hash, created_by
  ) values (
    p_tenant_id, v_profile.id, v_profile.legal_entity_id, p_purchase_order_id,
    p_bill_number, p_invoice_date, p_due_date, p_currency, 0, p_tax_cents,
    p_shipping_cents, p_tax_cents + p_shipping_cents,
    p_source_document_ref, p_source_document_checksum,
    p_idempotency_key, v_request_hash, p_actor_profile_id
  ) returning * into v_bill;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_BILL', v_bill.id, null, 'DRAFT', p_actor_profile_id,
    'VENDOR_BILL_CREATED', v_bill.version, p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_bill_created', 'vendor_bills', v_bill.id,
    false, v_request_hash, jsonb_build_object('profile_id', v_profile.id,
      'purchase_order_id', p_purchase_order_id, 'bill_number', p_bill_number)
  );
  return v_bill;
end;
$$;

revoke all on function public.create_vendor_bill(
  uuid, uuid, uuid, uuid, text, date, date, text, bigint, bigint, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_vendor_bill(
  uuid, uuid, uuid, uuid, text, date, date, text, bigint, bigint, text, text, text
) to service_role;

create or replace function public.add_vendor_bill_line(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_expected_bill_version integer,
  p_purchase_order_line_id uuid,
  p_inventory_item_id uuid,
  p_line_type text,
  p_line_code text,
  p_quantity numeric,
  p_unit_amount_cents bigint,
  p_amount_cents bigint,
  p_idempotency_key text
)
returns public.vendor_bill_lines
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.vendor_bills%rowtype;
  v_line public.vendor_bill_lines%rowtype;
  v_request_hash text;
  v_source_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_expected_bill_version < 1
     or p_line_type not in ('INVENTORY', 'SERVICE', 'FEE', 'OTHER')
     or coalesce(p_line_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 3)
     or p_unit_amount_cents is null or p_unit_amount_cents < 0
     or p_amount_cents is null or p_amount_cents <= 0
     or p_amount_cents <> round(p_quantity * p_unit_amount_cents)
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or (p_line_type = 'INVENTORY' and (p_purchase_order_line_id is null or p_inventory_item_id is null))
     or (p_line_type <> 'INVENTORY' and p_purchase_order_line_id is not null) then
    raise exception using errcode = '22023', message = 'vendor_bill_line_request_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'bill_id', p_vendor_bill_id,
    'expected_bill_version', p_expected_bill_version, 'actor_profile_id', p_actor_profile_id,
    'purchase_order_line_id', p_purchase_order_line_id, 'inventory_item_id', p_inventory_item_id,
    'line_type', p_line_type, 'line_code', p_line_code, 'quantity', p_quantity,
    'unit_amount_cents', p_unit_amount_cents, 'amount_cents', p_amount_cents
  )::text, 'sha256'), 'hex');
  v_source_hash := encode(digest((v_request_hash || ':vendor_bill_line')::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_bill_line_add', p_idempotency_key);
  select * into v_line from public.vendor_bill_lines line
  where line.tenant_id = p_tenant_id and line.request_idempotency_key = p_idempotency_key;
  if found then
    if v_line.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_line;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_bill', p_vendor_bill_id);
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_bill_not_found'; end if;
  if v_bill.version <> p_expected_bill_version or v_bill.status <> 'DRAFT' then
    raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict';
  end if;
  if p_line_type = 'INVENTORY' and not exists (
    select 1 from public.os_purchase_order_lines line
    where line.tenant_id = p_tenant_id and line.id = p_purchase_order_line_id
      and line.purchase_order_id = v_bill.purchase_order_id
      and line.item_id = p_inventory_item_id
      and line.unit_cost_cents = p_unit_amount_cents
  ) then
    raise exception using errcode = 'P0001', message = 'vendor_bill_po_line_mismatch';
  end if;
  insert into public.vendor_bill_lines (
    tenant_id, vendor_bill_id, purchase_order_line_id, inventory_item_id,
    line_type, line_code, quantity, unit_amount_cents, amount_cents, currency,
    source_hash, request_idempotency_key, request_hash, created_by
  ) values (
    p_tenant_id, p_vendor_bill_id, p_purchase_order_line_id, p_inventory_item_id,
    p_line_type, p_line_code, p_quantity, p_unit_amount_cents, p_amount_cents,
    v_bill.currency, v_source_hash, p_idempotency_key, v_request_hash, p_actor_profile_id
  ) returning * into v_line;
  update public.vendor_bills
  set subtotal_cents = subtotal_cents + p_amount_cents,
      total_cents = subtotal_cents + p_amount_cents + tax_cents + shipping_cents,
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_vendor_bill_id and version = p_expected_bill_version;
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_conflict'; end if;
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_bill_line_added',
    'vendor_bill_lines', v_line.id, false, v_request_hash,
    jsonb_build_object('vendor_bill_id', p_vendor_bill_id, 'line_type', p_line_type,
      'amount_cents', p_amount_cents, 'purchase_order_line_id', p_purchase_order_line_id)
  );
  return v_line;
end;
$$;

revoke all on function public.add_vendor_bill_line(
  uuid, uuid, uuid, integer, uuid, uuid, text, text, numeric, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.add_vendor_bill_line(
  uuid, uuid, uuid, integer, uuid, uuid, text, text, numeric, bigint, bigint, text
) to service_role;

create or replace function public.match_vendor_bill(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_expected_bill_version integer,
  p_match_type text,
  p_safe_exception_code text,
  p_idempotency_key text
)
returns public.vendor_bill_match_evidence
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.vendor_bills%rowtype;
  v_profile public.vendor_finance_profiles%rowtype;
  v_evidence public.vendor_bill_match_evidence%rowtype;
  v_po public.os_purchase_orders%rowtype;
  v_po_total bigint;
  v_variance bigint;
  v_receipt_count integer;
  v_fully_received boolean;
  v_match_status text;
  v_bill_status text;
  v_request_hash text;
  v_evidence_checksum text;
  v_snapshot jsonb;
  v_line_snapshot jsonb;
  v_policy_tolerance_cents constant bigint := 0;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_expected_bill_version < 1
     or p_match_type not in ('THREE_WAY', 'NON_PO_CONTROLLED_EXCEPTION')
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or (p_match_type = 'NON_PO_CONTROLLED_EXCEPTION'
       and coalesce(p_safe_exception_code, '') !~ '^[A-Z0-9_]{3,100}$') then
    raise exception using errcode = '22023', message = 'vendor_bill_match_request_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'bill_id', p_vendor_bill_id,
    'expected_bill_version', p_expected_bill_version, 'actor_profile_id', p_actor_profile_id,
    'match_type', p_match_type, 'policy_tolerance_cents', v_policy_tolerance_cents,
    'safe_exception_code', p_safe_exception_code
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_bill_match', p_idempotency_key);
  select * into v_evidence from public.vendor_bill_match_evidence evidence
  where evidence.tenant_id = p_tenant_id and evidence.request_idempotency_key = p_idempotency_key;
  if found then
    if v_evidence.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_evidence;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_bill', p_vendor_bill_id);
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_bill_not_found'; end if;
  if v_bill.version <> p_expected_bill_version or v_bill.status <> 'DRAFT' then
    raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict';
  end if;
  if v_bill.total_cents <= 0 or not exists (
    select 1 from public.vendor_bill_lines line
    where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id
  ) then
    raise exception using errcode = 'P0001', message = 'vendor_bill_lines_required';
  end if;
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = v_bill.vendor_finance_profile_id;
  if p_match_type = 'THREE_WAY' then
    if v_bill.purchase_order_id is null then
      raise exception using errcode = 'P0001', message = 'vendor_bill_purchase_order_required';
    end if;
    select * into v_po from public.os_purchase_orders purchase_order
    where purchase_order.tenant_id = p_tenant_id and purchase_order.id = v_bill.purchase_order_id
      and purchase_order.vendor_id = v_profile.inventory_vendor_id for share;
    if not found then raise exception using errcode = 'P0001', message = 'vendor_bill_purchase_order_invalid'; end if;
    if v_po.status <> 'received' then
      raise exception using errcode = 'P0001', message = 'vendor_bill_purchase_order_not_fully_received';
    end if;
    if exists (
      select 1 from public.vendor_bill_lines line
      where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id
        and (
          line.line_type <> 'INVENTORY'
          or not exists (
          select 1 from public.os_purchase_order_lines po_line
          where po_line.tenant_id = line.tenant_id
            and po_line.id = line.purchase_order_line_id
            and po_line.purchase_order_id = v_po.id
            and po_line.item_id = line.inventory_item_id
            and po_line.unit_cost_cents = line.unit_amount_cents
            and line.quantity = po_line.quantity_ordered
            and line.quantity <= po_line.quantity_received
          )
        )
    ) then
      raise exception using errcode = 'P0001', message = 'vendor_bill_po_line_mismatch';
    end if;
    if (
      select count(*) from public.vendor_bill_lines line
      where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id
    ) <> (
      select count(*) from public.os_purchase_order_lines po_line
      where po_line.tenant_id = p_tenant_id and po_line.purchase_order_id = v_po.id
    ) or exists (
      select 1 from public.os_purchase_order_lines po_line
      where po_line.tenant_id = p_tenant_id and po_line.purchase_order_id = v_po.id
        and not exists (
          select 1 from public.vendor_bill_lines line
          where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id
            and line.purchase_order_line_id = po_line.id
        )
    ) then
      raise exception using errcode = 'P0001', message = 'vendor_bill_requires_complete_purchase_order_lines';
    end if;
    if exists (
      select 1
      from (
        select line.inventory_item_id, sum(line.quantity) as billed_quantity
        from public.vendor_bill_lines line
        where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id
        group by line.inventory_item_id
      ) billed
      where coalesce((
        select sum(transaction.quantity_delta)
        from public.os_stock_transactions transaction
        where transaction.tenant_id = p_tenant_id
          and transaction.source_type = 'purchase_order'
          and transaction.source_id = v_po.id::text
          and transaction.transaction_type = 'receive'
          and transaction.item_id = billed.inventory_item_id
      ), 0) < billed.billed_quantity
    ) then
      raise exception using errcode = 'P0001', message = 'vendor_bill_receipt_allocation_insufficient';
    end if;
    v_po_total := v_po.subtotal_cents + v_po.tax_cents + v_po.shipping_cents;
    v_variance := v_bill.total_cents - v_po_total;
    select count(*)::integer into v_receipt_count
    from public.os_stock_transactions transaction
    where transaction.tenant_id = p_tenant_id
      and transaction.source_type = 'purchase_order'
      and transaction.source_id = v_po.id::text
      and transaction.transaction_type = 'receive';
    select coalesce(bool_and(line.quantity_received >= line.quantity_ordered), false)
    into v_fully_received
    from public.os_purchase_order_lines line
    where line.tenant_id = p_tenant_id and line.purchase_order_id = v_po.id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'bill_line_id', line.id,
      'purchase_order_line_id', po_line.id,
      'inventory_item_id', line.inventory_item_id,
      'billed_quantity', line.quantity,
      'ordered_quantity', po_line.quantity_ordered,
      'received_quantity', po_line.quantity_received,
      'unit_amount_cents', line.unit_amount_cents,
      'line_amount_cents', line.amount_cents,
      'stock_received_quantity', coalesce((
        select sum(transaction.quantity_delta)
        from public.os_stock_transactions transaction
        where transaction.tenant_id = p_tenant_id
          and transaction.source_type = 'purchase_order'
          and transaction.source_id = v_po.id::text
          and transaction.transaction_type = 'receive'
          and transaction.item_id = line.inventory_item_id
      ), 0)
    ) order by po_line.id), '[]'::jsonb)
    into v_line_snapshot
    from public.vendor_bill_lines line
    join public.os_purchase_order_lines po_line
      on po_line.tenant_id = line.tenant_id
     and po_line.id = line.purchase_order_line_id
    where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id;
    v_match_status := case
      when abs(v_variance) <= v_policy_tolerance_cents and v_fully_received and v_receipt_count > 0
        then 'MATCHED'
      else 'EXCEPTION'
    end;
    v_bill_status := case when v_match_status = 'MATCHED' then 'MATCHED' else 'MATCH_EXCEPTION' end;
    v_snapshot := jsonb_build_object(
      'purchase_order_id', v_po.id, 'purchase_order_status', v_po.status,
      'purchase_order_total_cents', v_po_total, 'bill_total_cents', v_bill.total_cents,
      'variance_cents', v_variance, 'tolerance_cents', v_policy_tolerance_cents,
      'receipt_count', v_receipt_count, 'fully_received', v_fully_received,
      'line_receipt_allocations', v_line_snapshot,
      'invoice_policy', 'ONE_ACTIVE_FULL_BILL_PER_PURCHASE_ORDER'
    );
  else
    if v_bill.purchase_order_id is not null or exists (
      select 1 from public.vendor_bill_lines line
      where line.tenant_id = p_tenant_id and line.vendor_bill_id = v_bill.id
        and line.line_type = 'INVENTORY'
    ) then
      raise exception using errcode = 'P0001', message = 'inventory_bill_requires_three_way_match';
    end if;
    v_po_total := null;
    v_variance := 0;
    v_receipt_count := 0;
    v_fully_received := false;
    v_match_status := 'NOT_REQUIRED';
    v_bill_status := 'MATCH_EXCEPTION';
    v_line_snapshot := '[]'::jsonb;
    v_snapshot := jsonb_build_object(
      'controlled_exception', p_safe_exception_code,
      'bill_total_cents', v_bill.total_cents,
      'inventory_lines', 0
    );
  end if;
  v_evidence_checksum := encode(digest(jsonb_build_object(
    'bill_id', v_bill.id, 'bill_version', v_bill.version,
    'match_type', p_match_type, 'match_status', v_match_status,
    'snapshot', v_snapshot, 'request_hash', v_request_hash
  )::text, 'sha256'), 'hex');
  insert into public.vendor_bill_match_evidence (
    tenant_id, vendor_bill_id, vendor_bill_version, purchase_order_id,
    match_type, match_status, purchase_order_total_cents, bill_total_cents,
    variance_cents, tolerance_cents, receipt_count, fully_received,
    safe_exception_code, safe_snapshot, evidence_checksum,
    request_idempotency_key, request_hash, prepared_by
  ) values (
    p_tenant_id, v_bill.id, v_bill.version, v_bill.purchase_order_id,
    p_match_type, v_match_status, v_po_total, v_bill.total_cents,
    v_variance, v_policy_tolerance_cents, v_receipt_count, v_fully_received,
    case when p_match_type = 'NON_PO_CONTROLLED_EXCEPTION' then p_safe_exception_code else null end,
    v_snapshot, v_evidence_checksum, p_idempotency_key, v_request_hash, p_actor_profile_id
  ) returning * into v_evidence;
  update public.vendor_bills
  set status = v_bill_status,
      match_status = v_match_status,
      match_evidence_id = v_evidence.id,
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_bill.id and version = p_expected_bill_version;
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_conflict'; end if;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_BILL', v_bill.id, 'DRAFT', v_bill_status,
    p_actor_profile_id, case when v_match_status = 'MATCHED' then 'THREE_WAY_MATCHED' else coalesce(p_safe_exception_code, 'THREE_WAY_EXCEPTION') end,
    p_expected_bill_version + 1, p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_bill_match_recorded',
    'vendor_bill_match_evidence', v_evidence.id, false, v_evidence_checksum,
    jsonb_build_object('vendor_bill_id', v_bill.id, 'match_type', p_match_type,
      'match_status', v_match_status, 'variance_cents', v_variance,
      'receipt_count', v_receipt_count)
  );
  return v_evidence;
end;
$$;

revoke all on function public.match_vendor_bill(
  uuid, uuid, uuid, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.match_vendor_bill(
  uuid, uuid, uuid, integer, text, text, text
) to service_role;

create or replace function public.maker_approve_vendor_bill(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_expected_bill_version integer,
  p_funding_account_ref text,
  p_funding_account_masked_label text,
  p_reason_code text,
  p_idempotency_key text
)
returns public.vendor_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.vendor_bills%rowtype;
  v_profile public.vendor_finance_profiles%rowtype;
  v_evidence public.vendor_bill_match_evidence%rowtype;
  v_payment public.vendor_payments%rowtype;
  v_payment_id uuid := gen_random_uuid();
  v_proposal_hash text;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_expected_bill_version < 1
     or coalesce(p_funding_account_ref, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
     or char_length(trim(coalesce(p_funding_account_masked_label, ''))) not between 3 and 120
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_bill_maker_approval_invalid';
  end if;
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_bill_maker_approve', p_idempotency_key);
  select * into v_payment from public.vendor_payments payment
  where payment.tenant_id = p_tenant_id and payment.request_idempotency_key = p_idempotency_key;
  if found then
    if v_payment.vendor_bill_id <> p_vendor_bill_id
       or v_payment.bill_version <> p_expected_bill_version + 1
       or v_payment.maker_prepared_by <> p_actor_profile_id
       or v_payment.funding_account_ref <> p_funding_account_ref
       or v_payment.funding_account_masked_label <> trim(p_funding_account_masked_label)
       or not exists (
         select 1 from public.vendor_bill_approvals approval
         where approval.tenant_id = p_tenant_id
           and approval.vendor_payment_id = v_payment.id
           and approval.stage = 'MAKER'
           and approval.actor_profile_id = p_actor_profile_id
           and approval.reason_code = p_reason_code
           and approval.request_idempotency_key = p_idempotency_key
       ) then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_payment;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_bill', p_vendor_bill_id);
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_bill_not_found'; end if;
  if v_bill.version <> p_expected_bill_version
     or not (
       (v_bill.status = 'MATCHED' and v_bill.match_status = 'MATCHED')
       or (v_bill.status = 'MATCH_EXCEPTION' and v_bill.match_status = 'NOT_REQUIRED')
     ) or v_bill.total_cents <= 0 or v_bill.match_evidence_id is null then
    raise exception using errcode = '40001', message = 'vendor_bill_not_approvable';
  end if;
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = v_bill.vendor_finance_profile_id for share;
  select * into v_evidence from public.vendor_bill_match_evidence evidence
  where evidence.tenant_id = p_tenant_id and evidence.id = v_bill.match_evidence_id;
  if v_profile.status <> 'ACTIVE'
     or v_profile.payment_readiness <> 'READY'
     or v_profile.tax_reporting_status not in ('READY', 'EXEMPT_VERIFIED')
     or v_profile.w9_status not in ('VERIFIED', 'EXEMPT_VERIFIED')
     or v_profile.destination_reviewed_at < v_profile.destination_changed_at
     or v_profile.destination_reviewed_by = p_actor_profile_id
     or v_evidence.id is null then
    raise exception using errcode = 'P0001', message = 'vendor_profile_or_match_not_ready';
  end if;
  v_proposal_hash := app_private.vendor_payment_proposal_hash(
    p_tenant_id, v_payment_id, v_bill.id, v_bill.version + 1,
    v_profile.id, v_profile.version, v_bill.legal_entity_id,
    v_bill.total_cents, v_bill.currency, v_profile.provider_recipient_id,
    v_profile.destination_snapshot_hash, v_profile.destination_masked_label,
    p_funding_account_ref, trim(p_funding_account_masked_label)
  );
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'vendor_bill_id', v_bill.id,
    'expected_bill_version', p_expected_bill_version, 'actor_profile_id', p_actor_profile_id,
    'funding_account_ref', p_funding_account_ref,
    'funding_account_masked_label', trim(p_funding_account_masked_label),
    'proposal_hash', v_proposal_hash, 'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  update public.vendor_bills
  set status = 'MAKER_APPROVED', maker_approved_by = p_actor_profile_id,
      maker_approved_at = clock_timestamp(), version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_bill.id and version = p_expected_bill_version
  returning * into v_bill;
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_conflict'; end if;
  insert into public.vendor_payments (
    id, tenant_id, vendor_bill_id, vendor_finance_profile_id, legal_entity_id,
    bill_version, profile_version, amount_cents, currency,
    funding_account_ref, funding_account_masked_label,
    destination_snapshot_hash, destination_masked_label, proposal_hash,
    maker_prepared_by, request_idempotency_key, request_hash
  ) values (
    v_payment_id, p_tenant_id, v_bill.id, v_profile.id, v_bill.legal_entity_id,
    v_bill.version, v_profile.version, v_bill.total_cents, v_bill.currency,
    p_funding_account_ref, trim(p_funding_account_masked_label),
    v_profile.destination_snapshot_hash, v_profile.destination_masked_label,
    v_proposal_hash, p_actor_profile_id, p_idempotency_key, v_request_hash
  ) returning * into v_payment;
  insert into public.vendor_bill_approvals (
    tenant_id, vendor_bill_id, vendor_payment_id, stage, decision,
    actor_profile_id, aggregate_version, proposal_hash, reason_code,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, v_bill.id, v_payment.id, 'MAKER', 'APPROVED',
    p_actor_profile_id, v_bill.version, v_proposal_hash, p_reason_code,
    p_idempotency_key, v_request_hash
  );
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_PAYMENT', v_payment.id, null, 'APPROVAL_PENDING',
    p_actor_profile_id, p_reason_code, v_payment.version,
    'event:' || p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_bill_maker_approved',
    'vendor_payments', v_payment.id, false, v_request_hash,
    jsonb_build_object('vendor_bill_id', v_bill.id, 'amount_cents', v_payment.amount_cents,
      'currency', v_payment.currency, 'proposal_hash', v_proposal_hash)
  );
  return v_payment;
end;
$$;

revoke all on function public.maker_approve_vendor_bill(
  uuid, uuid, uuid, integer, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.maker_approve_vendor_bill(
  uuid, uuid, uuid, integer, text, text, text, text
) to service_role;

create or replace function public.checker_approve_vendor_payment(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_vendor_payment_id uuid,
  p_expected_payment_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.vendor_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.vendor_payments%rowtype;
  v_bill public.vendor_bills%rowtype;
  v_profile public.vendor_finance_profiles%rowtype;
  v_approval public.vendor_bill_approvals%rowtype;
  v_request_hash text;
  v_proposal_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_checker']::text[]
  );
  if p_expected_payment_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_payment_checker_approval_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'vendor_bill_id', p_vendor_bill_id,
    'vendor_payment_id', p_vendor_payment_id,
    'expected_payment_version', p_expected_payment_version,
    'actor_profile_id', p_actor_profile_id, 'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_payment_checker_approve', p_idempotency_key);
  select * into v_approval from public.vendor_bill_approvals approval
  where approval.tenant_id = p_tenant_id and approval.request_idempotency_key = p_idempotency_key;
  if found then
    if v_approval.vendor_bill_id <> p_vendor_bill_id
       or v_approval.vendor_payment_id <> p_vendor_payment_id
       or v_approval.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_payment from public.vendor_payments payment
    where payment.tenant_id = p_tenant_id and payment.id = p_vendor_payment_id
      and payment.vendor_bill_id = p_vendor_bill_id;
    return v_payment;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_payment', p_vendor_payment_id);
  select * into v_payment from public.vendor_payments payment
  where payment.tenant_id = p_tenant_id and payment.id = p_vendor_payment_id
    and payment.vendor_bill_id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_payment_not_found'; end if;
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = v_payment.vendor_finance_profile_id for share;
  v_proposal_hash := app_private.vendor_payment_proposal_hash(
    v_payment.tenant_id, v_payment.id, v_payment.vendor_bill_id, v_payment.bill_version,
    v_payment.vendor_finance_profile_id, v_payment.profile_version,
    v_payment.legal_entity_id, v_payment.amount_cents, v_payment.currency,
    v_profile.provider_recipient_id, v_payment.destination_snapshot_hash,
    v_payment.destination_masked_label, v_payment.funding_account_ref,
    v_payment.funding_account_masked_label
  );
  if v_payment.version <> p_expected_payment_version
     or v_payment.status <> 'APPROVAL_PENDING'
     or v_bill.status <> 'MAKER_APPROVED'
     or v_bill.maker_approved_by <> v_payment.maker_prepared_by
     or v_payment.maker_prepared_by = p_actor_profile_id
     or v_profile.status <> 'ACTIVE'
     or v_profile.version <> v_payment.profile_version
     or v_profile.payment_readiness <> 'READY'
     or v_profile.tax_reporting_status not in ('READY', 'EXEMPT_VERIFIED')
     or v_profile.destination_reviewed_at < v_profile.destination_changed_at
     or v_proposal_hash <> v_payment.proposal_hash then
    raise exception using errcode = 'P0001', message = 'vendor_payment_checker_snapshot_changed';
  end if;
  update public.vendor_payments
  set status = 'READY', checker_approved_by = p_actor_profile_id,
      checker_approved_at = clock_timestamp(), version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_vendor_payment_id
    and version = p_expected_payment_version
  returning * into v_payment;
  if not found then raise exception using errcode = '40001', message = 'vendor_payment_version_conflict'; end if;
  update public.vendor_bills
  set status = 'CHECKER_APPROVED', checker_approved_by = p_actor_profile_id,
      checker_approved_at = clock_timestamp(), version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_bill.id and status = 'MAKER_APPROVED'
  returning * into v_bill;
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict'; end if;
  insert into public.vendor_bill_approvals (
    tenant_id, vendor_bill_id, vendor_payment_id, stage, decision,
    actor_profile_id, aggregate_version, proposal_hash, reason_code,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, v_bill.id, v_payment.id, 'CHECKER', 'APPROVED',
    p_actor_profile_id, v_payment.version, v_payment.proposal_hash, p_reason_code,
    p_idempotency_key, v_request_hash
  );
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_PAYMENT', v_payment.id, 'APPROVAL_PENDING', 'READY',
    p_actor_profile_id, p_reason_code, v_payment.version,
    'event:' || p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_payment_checker_approved',
    'vendor_payments', v_payment.id, false, v_request_hash,
    jsonb_build_object('vendor_bill_id', v_bill.id, 'amount_cents', v_payment.amount_cents,
      'proposal_hash', v_payment.proposal_hash)
  );
  return v_payment;
end;
$$;

revoke all on function public.checker_approve_vendor_payment(
  uuid, uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated;
grant execute on function public.checker_approve_vendor_payment(
  uuid, uuid, uuid, uuid, integer, text, text
) to service_role;

create or replace function public.queue_vendor_payment_command(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_vendor_payment_id uuid,
  p_expected_payment_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.finance_integration_commands
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.vendor_payments%rowtype;
  v_bill public.vendor_bills%rowtype;
  v_profile public.vendor_finance_profiles%rowtype;
  v_command public.finance_integration_commands%rowtype;
  v_approval public.vendor_bill_approvals%rowtype;
  v_proposal_hash text;
  v_safe_payload jsonb;
  v_command_checksum text;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_executor']::text[]
  );
  if p_expected_payment_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_payment_queue_request_invalid';
  end if;
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_payment_queue', p_idempotency_key);
  select * into v_command from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id and command.provider = 'mercury'
    and command.stable_key = p_idempotency_key;
  if found then
    if v_command.aggregate_type <> 'vendor_payment'
       or v_command.aggregate_id <> p_vendor_payment_id
       or v_command.command_type <> 'CREATE_VENDOR_PAYMENT'
       or v_command.safe_payload->>'vendor_bill_id' <> p_vendor_bill_id::text then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_command;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_payment', p_vendor_payment_id);
  select * into v_payment from public.vendor_payments payment
  where payment.tenant_id = p_tenant_id and payment.id = p_vendor_payment_id
    and payment.vendor_bill_id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_payment_not_found'; end if;
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  select * into v_profile from public.vendor_finance_profiles profile
  where profile.tenant_id = p_tenant_id and profile.id = v_payment.vendor_finance_profile_id for share;
  v_proposal_hash := app_private.vendor_payment_proposal_hash(
    v_payment.tenant_id, v_payment.id, v_payment.vendor_bill_id, v_payment.bill_version,
    v_payment.vendor_finance_profile_id, v_payment.profile_version,
    v_payment.legal_entity_id, v_payment.amount_cents, v_payment.currency,
    v_profile.provider_recipient_id, v_payment.destination_snapshot_hash,
    v_payment.destination_masked_label, v_payment.funding_account_ref,
    v_payment.funding_account_masked_label
  );
  if v_payment.version <> p_expected_payment_version
     or v_payment.status <> 'READY' or v_bill.status <> 'CHECKER_APPROVED'
     or v_payment.checker_approved_by is null
     or p_actor_profile_id in (v_payment.maker_prepared_by, v_payment.checker_approved_by)
     or v_profile.status <> 'ACTIVE' or v_profile.version <> v_payment.profile_version
     or v_profile.provider_recipient_id is null
     or v_proposal_hash <> v_payment.proposal_hash
     or not exists (
       select 1 from public.vendor_bill_approvals approval
       where approval.tenant_id = p_tenant_id
         and approval.vendor_payment_id = v_payment.id
         and approval.stage = 'CHECKER' and approval.decision = 'APPROVED'
         and approval.actor_profile_id = v_payment.checker_approved_by
         and approval.aggregate_version = v_payment.version
     ) then
    raise exception using errcode = 'P0001', message = 'vendor_payment_queue_snapshot_changed';
  end if;
  v_safe_payload := jsonb_build_object(
    'vendor_payment_id', v_payment.id,
    'vendor_bill_id', v_bill.id,
    'vendor_finance_profile_id', v_profile.id,
    'legal_entity_id', v_payment.legal_entity_id,
    'proposal_hash', v_payment.proposal_hash,
    'amount_cents', v_payment.amount_cents,
    'currency', v_payment.currency,
    'provider_recipient_id', v_profile.provider_recipient_id,
    'destination_snapshot_hash', v_payment.destination_snapshot_hash,
    'destination_masked_label', v_payment.destination_masked_label,
    'funding_account_ref', v_payment.funding_account_ref,
    'funding_account_masked_label', v_payment.funding_account_masked_label,
    'send_mode', 'approval_queue'
  );
  v_command_checksum := app_private.finance_command_checksum(v_safe_payload);
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'vendor_bill_id', p_vendor_bill_id,
    'vendor_payment_id', p_vendor_payment_id,
    'expected_payment_version', p_expected_payment_version,
    'actor_profile_id', p_actor_profile_id, 'reason_code', p_reason_code,
    'command_checksum', v_command_checksum, 'proposal_hash', v_payment.proposal_hash
  )::text, 'sha256'), 'hex');
  insert into public.vendor_bill_approvals (
    tenant_id, vendor_bill_id, vendor_payment_id, stage, decision,
    actor_profile_id, aggregate_version, proposal_hash, reason_code,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, v_bill.id, v_payment.id, 'EXECUTOR', 'SEND_AUTHORIZED',
    p_actor_profile_id, v_payment.version, v_payment.proposal_hash, p_reason_code,
    p_idempotency_key, v_request_hash
  ) returning * into v_approval;
  insert into public.finance_integration_commands (
    tenant_id, provider, command_type, aggregate_type, aggregate_id,
    stable_key, request_checksum, safe_payload, status, created_by
  ) values (
    p_tenant_id, 'mercury', 'CREATE_VENDOR_PAYMENT', 'vendor_payment', v_payment.id,
    p_idempotency_key, v_command_checksum, v_safe_payload, 'PENDING', p_actor_profile_id
  ) returning * into v_command;
  update public.vendor_payments
  set status = 'COMMAND_QUEUED', executor_authorized_by = p_actor_profile_id,
      executor_authorized_at = clock_timestamp(), command_id = v_command.id,
      version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_payment.id and version = p_expected_payment_version
  returning * into v_payment;
  if not found then raise exception using errcode = '40001', message = 'vendor_payment_version_conflict'; end if;
  update public.vendor_bills
  set status = 'PAYMENT_QUEUED', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_bill.id and status = 'CHECKER_APPROVED';
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict'; end if;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_PAYMENT', v_payment.id, 'READY', 'COMMAND_QUEUED',
    p_actor_profile_id, p_reason_code, v_payment.version,
    'event:' || p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_payment_command_authorized',
    'finance_integration_commands', v_command.id, false, v_request_hash,
    jsonb_build_object('vendor_payment_id', v_payment.id,
      'amount_cents', v_payment.amount_cents, 'currency', v_payment.currency,
      'proposal_hash', v_payment.proposal_hash, 'command_checksum', v_command_checksum)
  );
  return v_command;
end;
$$;

revoke all on function public.queue_vendor_payment_command(
  uuid, uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated;
grant execute on function public.queue_vendor_payment_command(
  uuid, uuid, uuid, uuid, integer, text, text
) to service_role;

create or replace function public.set_vendor_bill_hold(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_expected_bill_version integer,
  p_hold boolean,
  p_reason_code text,
  p_idempotency_key text
)
returns public.vendor_bills
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.vendor_bills%rowtype;
  v_payment public.vendor_payments%rowtype;
  v_command public.finance_integration_commands%rowtype;
  v_event public.vendor_ap_events%rowtype;
  v_request_hash text;
  v_next_bill_status text;
  v_next_payment_status text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker', 'finance_checker']::text[]
  );
  if p_expected_bill_version < 1 or p_hold is null
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_bill_hold_request_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'bill_id', p_vendor_bill_id,
    'expected_bill_version', p_expected_bill_version, 'actor_profile_id', p_actor_profile_id,
    'hold', p_hold, 'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_bill_hold', p_idempotency_key);
  select * into v_event from public.vendor_ap_events event
  where event.tenant_id = p_tenant_id and event.request_idempotency_key = p_idempotency_key;
  if found then
    if v_event.aggregate_id <> p_vendor_bill_id or v_event.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_bill from public.vendor_bills bill
    where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id;
    return v_bill;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_bill', p_vendor_bill_id);
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_bill_not_found'; end if;
  if v_bill.version <> p_expected_bill_version
     or v_bill.status in ('SETTLED', 'CANCELLED')
     or (p_hold and v_bill.status = 'HELD')
     or (not p_hold and v_bill.status <> 'HELD') then
    raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict';
  end if;
  select * into v_payment from public.vendor_payments payment
  where payment.tenant_id = p_tenant_id and payment.vendor_bill_id = v_bill.id for update;
  if found and v_payment.command_id is not null then
    select * into v_command from public.finance_integration_commands command
    where command.tenant_id = p_tenant_id and command.id = v_payment.command_id for update;
    if p_hold and v_command.status = 'PENDING' then
      update public.finance_integration_commands
      set status = 'CANCELLED', last_safe_error_code = 'VENDOR_BILL_HELD_BEFORE_DISPATCH',
          updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_command.id and status = 'PENDING';
    elsif p_hold and v_command.status not in ('CANCELLED', 'FAILED', 'DEAD_LETTER') then
      raise exception using errcode = 'P0001', message = 'vendor_payment_dispatch_started_hold_requires_recovery';
    end if;
  end if;
  if p_hold then
    v_next_bill_status := 'HELD';
    if v_payment.id is not null then
      update public.vendor_payments
      set status = 'HELD', version = version + 1, updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_payment.id;
    end if;
    update public.vendor_bills
    set status = 'HELD', hold_code = p_reason_code,
        hold_owner_profile_id = p_actor_profile_id,
        version = version + 1, updated_at = clock_timestamp()
    where tenant_id = p_tenant_id and id = v_bill.id and version = p_expected_bill_version
    returning * into v_bill;
  else
    if v_payment.id is null then
      v_next_bill_status := case
        when v_bill.match_status = 'MATCHED' then 'MATCHED'
        when v_bill.match_status = 'NOT_REQUIRED' then 'MATCH_EXCEPTION'
        else 'DRAFT'
      end;
    elsif v_payment.checker_approved_by is not null then
      v_next_bill_status := 'CHECKER_APPROVED';
      v_next_payment_status := 'READY';
    else
      v_next_bill_status := 'MAKER_APPROVED';
      v_next_payment_status := 'APPROVAL_PENDING';
    end if;
    if v_payment.id is not null then
      update public.vendor_payments
      set status = v_next_payment_status, command_id = null,
          executor_authorized_by = null, executor_authorized_at = null,
          version = version + 1, updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_payment.id;
    end if;
    update public.vendor_bills
    set status = v_next_bill_status, hold_code = null, hold_owner_profile_id = null,
        version = version + 1, updated_at = clock_timestamp()
    where tenant_id = p_tenant_id and id = v_bill.id and version = p_expected_bill_version
    returning * into v_bill;
  end if;
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_conflict'; end if;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_BILL', v_bill.id,
    case when p_hold then null else 'HELD' end, v_bill.status,
    p_actor_profile_id, p_reason_code, v_bill.version, p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id,
    case when p_hold then 'vendor_bill_held' else 'vendor_bill_hold_released' end,
    'vendor_bills', v_bill.id, false, v_request_hash,
    jsonb_build_object('status', v_bill.status, 'reason_code', p_reason_code)
  );
  return v_bill;
end;
$$;

revoke all on function public.set_vendor_bill_hold(
  uuid, uuid, uuid, integer, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.set_vendor_bill_hold(
  uuid, uuid, uuid, integer, boolean, text, text
) to service_role;

create or replace function public.cancel_vendor_bill(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_expected_bill_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.vendor_bills
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.vendor_bills%rowtype;
  v_payment public.vendor_payments%rowtype;
  v_command public.finance_integration_commands%rowtype;
  v_event public.vendor_ap_events%rowtype;
  v_request_hash text;
  v_from_status text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_checker']::text[]
  );
  if p_expected_bill_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'vendor_bill_cancel_request_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'bill_id', p_vendor_bill_id,
    'expected_bill_version', p_expected_bill_version,
    'actor_profile_id', p_actor_profile_id, 'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_bill_cancel', p_idempotency_key);
  select * into v_event from public.vendor_ap_events event
  where event.tenant_id = p_tenant_id and event.request_idempotency_key = p_idempotency_key;
  if found then
    if v_event.aggregate_id <> p_vendor_bill_id or v_event.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_bill from public.vendor_bills bill
    where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id;
    return v_bill;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_bill', p_vendor_bill_id);
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_bill_not_found'; end if;
  if v_bill.version <> p_expected_bill_version or v_bill.status in ('SETTLED', 'CANCELLED') then
    raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict';
  end if;
  if v_bill.maker_approved_by = p_actor_profile_id then
    raise exception using errcode = 'P0001', message = 'vendor_bill_cancel_independent_checker_required';
  end if;
  v_from_status := v_bill.status;
  select * into v_payment from public.vendor_payments payment
  where payment.tenant_id = p_tenant_id and payment.vendor_bill_id = v_bill.id for update;
  if found and v_payment.command_id is not null then
    select * into v_command from public.finance_integration_commands command
    where command.tenant_id = p_tenant_id and command.id = v_payment.command_id for update;
    if v_command.status = 'PENDING' then
      update public.finance_integration_commands
      set status = 'CANCELLED', last_safe_error_code = 'VENDOR_BILL_CANCELLED_BEFORE_DISPATCH',
          updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_command.id and status = 'PENDING';
    elsif v_command.status not in ('CANCELLED', 'FAILED', 'DEAD_LETTER') then
      raise exception using errcode = 'P0001', message = 'vendor_payment_dispatch_started_cancel_requires_recovery';
    end if;
  end if;
  if v_payment.id is not null then
    update public.vendor_payments
    set status = 'CANCELLED', version = version + 1, updated_at = clock_timestamp()
    where tenant_id = p_tenant_id and id = v_payment.id;
  end if;
  update public.vendor_bills
  set status = 'CANCELLED', cancelled_by = p_actor_profile_id,
      cancelled_at = clock_timestamp(), cancel_reason_code = p_reason_code,
      version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_bill.id and version = p_expected_bill_version
  returning * into v_bill;
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_conflict'; end if;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_BILL', v_bill.id, v_from_status, 'CANCELLED',
    p_actor_profile_id, p_reason_code, v_bill.version, p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_bill_cancelled',
    'vendor_bills', v_bill.id, false, v_request_hash,
    jsonb_build_object('from_status', v_from_status, 'reason_code', p_reason_code)
  );
  return v_bill;
end;
$$;

revoke all on function public.cancel_vendor_bill(
  uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated;
grant execute on function public.cancel_vendor_bill(
  uuid, uuid, uuid, integer, text, text
) to service_role;

create or replace function public.settle_vendor_payment(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_vendor_bill_id uuid,
  p_vendor_payment_id uuid,
  p_expected_payment_version integer,
  p_evidence_source text,
  p_finance_integration_event_id uuid,
  p_bank_statement_item_id uuid,
  p_provider_transaction_id text,
  p_evidence_ref text,
  p_reason_code text,
  p_idempotency_key text
)
returns public.vendor_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.vendor_payments%rowtype;
  v_bill public.vendor_bills%rowtype;
  v_command public.finance_integration_commands%rowtype;
  v_bank public.bank_statement_items%rowtype;
  v_integration_event public.finance_integration_events%rowtype;
  v_reconciliation public.reconciliation_matches%rowtype;
  v_evidence public.vendor_payment_evidence%rowtype;
  v_request_hash text;
  v_evidence_checksum text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['accountant_controller']::text[]
  );
  if p_expected_payment_version < 1
     or p_evidence_source not in ('PROVIDER_CONFIRMED', 'CONTROLLED_MANUAL')
     or char_length(trim(coalesce(p_provider_transaction_id, ''))) not between 3 and 200
     or coalesce(p_evidence_ref, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or (p_evidence_source = 'PROVIDER_CONFIRMED' and p_finance_integration_event_id is null)
     or (p_evidence_source = 'CONTROLLED_MANUAL' and p_finance_integration_event_id is not null) then
    raise exception using errcode = '22023', message = 'vendor_payment_settlement_request_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'vendor_bill_id', p_vendor_bill_id,
    'vendor_payment_id', p_vendor_payment_id,
    'expected_payment_version', p_expected_payment_version,
    'actor_profile_id', p_actor_profile_id, 'evidence_source', p_evidence_source,
    'finance_integration_event_id', p_finance_integration_event_id,
    'bank_statement_item_id', p_bank_statement_item_id,
    'provider_transaction_id', p_provider_transaction_id,
    'evidence_ref', p_evidence_ref,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');
  perform app_private.lock_payops_idempotency(p_tenant_id, 'vendor_payment_settle', p_idempotency_key);
  select * into v_evidence from public.vendor_payment_evidence evidence
  where evidence.tenant_id = p_tenant_id and evidence.request_idempotency_key = p_idempotency_key;
  if found then
    if v_evidence.vendor_payment_id <> p_vendor_payment_id
       or v_evidence.request_hash <> v_request_hash
       or not exists (
         select 1 from public.vendor_payments scoped_payment
         where scoped_payment.tenant_id = p_tenant_id
           and scoped_payment.id = p_vendor_payment_id
           and scoped_payment.vendor_bill_id = p_vendor_bill_id
       ) then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_payment from public.vendor_payments payment
    where payment.tenant_id = p_tenant_id and payment.id = p_vendor_payment_id
      and payment.vendor_bill_id = p_vendor_bill_id;
    return v_payment;
  end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'vendor_payment', p_vendor_payment_id);
  select * into v_payment from public.vendor_payments payment
  where payment.tenant_id = p_tenant_id and payment.id = p_vendor_payment_id
    and payment.vendor_bill_id = p_vendor_bill_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'vendor_payment_not_found'; end if;
  if v_payment.version <> p_expected_payment_version
     or v_payment.status not in ('COMMAND_QUEUED', 'PROVIDER_PENDING', 'RECONCILIATION_REQUIRED')
     or p_actor_profile_id in (
       v_payment.maker_prepared_by, v_payment.checker_approved_by, v_payment.executor_authorized_by
     ) then
    raise exception using errcode = 'P0001', message = 'vendor_payment_settlement_authority_invalid';
  end if;
  select * into v_bill from public.vendor_bills bill
  where bill.tenant_id = p_tenant_id and bill.id = p_vendor_bill_id for update;
  select * into v_command from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id and command.id = v_payment.command_id for update;
  if v_command.id is null then
    raise exception using errcode = 'P0001', message = 'vendor_payment_command_required';
  end if;
  if p_evidence_source = 'PROVIDER_CONFIRMED' then
    select * into v_integration_event from public.finance_integration_events event
    where event.tenant_id = p_tenant_id and event.id = p_finance_integration_event_id
      and event.provider = 'mercury' and event.signature_valid
      and event.event_type = 'VENDOR_PAYMENT_SETTLED'
      and event.status = 'PROCESSED'
      and event.safe_error_code is null
      and event.aggregate_type = 'vendor_payment'
      and event.aggregate_id = v_payment.id
      and event.correlation_id = v_command.correlation_id
      and event.provider_transaction_id = p_provider_transaction_id
      and event.settlement_amount_cents = v_payment.amount_cents
      and event.settlement_currency = v_payment.currency;
    if not found or v_command.status <> 'SUCCEEDED' then
      raise exception using errcode = 'P0001', message = 'verified_provider_settlement_evidence_required';
    end if;
  else
    if v_command.status = 'PENDING' then
      update public.finance_integration_commands
      set status = 'CANCELLED', last_safe_error_code = 'CONTROLLED_MANUAL_VENDOR_SETTLEMENT',
          updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_command.id and status = 'PENDING';
    elsif v_command.status not in ('CANCELLED', 'SUCCEEDED') then
      raise exception using errcode = 'P0001', message = 'manual_settlement_command_state_invalid';
    end if;
  end if;
  select * into v_bank from public.bank_statement_items bank
  where bank.tenant_id = p_tenant_id and bank.id = p_bank_statement_item_id
    and bank.legal_entity_id = v_payment.legal_entity_id
    and bank.provider = 'mercury'
    and bank.provider_account_id = v_payment.funding_account_ref
    and bank.provider_transaction_id = p_provider_transaction_id
    and bank.currency = v_payment.currency
    and bank.normalized_direction = 'DEBIT'
    and abs(bank.amount_cents) = v_payment.amount_cents
    and lower(bank.provider_status) in ('posted', 'settled', 'completed')
    and bank.posted_at is not null
    and bank.last_success_at is not null
    and not exists (
      select 1 from public.reconciliation_matches allocated
      where allocated.tenant_id = p_tenant_id
        and allocated.bank_statement_item_id = bank.id
        and allocated.match_status = 'APPROVED'
    )
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'vendor_payment_bank_evidence_mismatch';
  end if;
  v_evidence_checksum := encode(digest(jsonb_build_object(
    'vendor_payment_id', v_payment.id,
    'vendor_bill_id', v_payment.vendor_bill_id,
    'evidence_source', p_evidence_source,
    'command_id', v_command.id,
    'command_request_checksum', v_command.request_checksum,
    'finance_integration_event_id', p_finance_integration_event_id,
    'provider_event_payload_checksum', case
      when p_evidence_source = 'PROVIDER_CONFIRMED' then v_integration_event.payload_checksum
      else null
    end,
    'bank_statement_item_id', v_bank.id,
    'bank_payload_checksum', v_bank.payload_checksum,
    'bank_provider_account_id', v_bank.provider_account_id,
    'bank_normalized_direction', v_bank.normalized_direction,
    'provider_transaction_id', p_provider_transaction_id,
    'amount_cents', v_payment.amount_cents,
    'currency', v_payment.currency,
    'evidence_ref', p_evidence_ref
  )::text, 'sha256'), 'hex');
  insert into public.reconciliation_matches (
    tenant_id, bank_statement_item_id, vendor_payment_id,
    match_status, matched_amount_cents, variance_cents, policy_version,
    proposed_by, approved_by, approved_at
  ) values (
    p_tenant_id, v_bank.id, v_payment.id, 'APPROVED',
    v_payment.amount_cents, 0, 'vendor_ap_v1_exact',
    'HUMAN', p_actor_profile_id, clock_timestamp()
  ) returning * into v_reconciliation;
  insert into public.vendor_payment_evidence (
    tenant_id, vendor_payment_id, evidence_source, finance_integration_event_id,
    bank_statement_item_id, reconciliation_match_id, provider_transaction_id,
    evidence_ref, evidence_checksum, reason_code, recorded_by,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, v_payment.id, p_evidence_source, p_finance_integration_event_id,
    v_bank.id, v_reconciliation.id, p_provider_transaction_id,
    p_evidence_ref, v_evidence_checksum, p_reason_code, p_actor_profile_id,
    p_idempotency_key, v_request_hash
  ) returning * into v_evidence;
  update public.vendor_payments
  set status = 'SETTLED', provider_transaction_id = p_provider_transaction_id,
      settlement_evidence_status = p_evidence_source,
      reconciliation_state = 'MATCHED', settled_at = clock_timestamp(),
      version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_payment.id and version = p_expected_payment_version
  returning * into v_payment;
  if not found then raise exception using errcode = '40001', message = 'vendor_payment_version_conflict'; end if;
  update public.vendor_bills
  set status = 'SETTLED', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_bill.id
    and status in ('PAYMENT_QUEUED', 'PROVIDER_PENDING', 'RECONCILIATION_REQUIRED');
  if not found then raise exception using errcode = '40001', message = 'vendor_bill_version_or_state_conflict'; end if;
  insert into public.vendor_ap_events (
    tenant_id, aggregate_type, aggregate_id, from_status, to_status,
    actor_profile_id, reason_code, aggregate_version,
    request_idempotency_key, request_hash
  ) values (
    p_tenant_id, 'VENDOR_PAYMENT', v_payment.id, null, 'SETTLED',
    p_actor_profile_id, p_reason_code, v_payment.version,
    'event:' || p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'vendor_payment_settled',
    'vendor_payments', v_payment.id, false, v_request_hash,
    jsonb_build_object('evidence_source', p_evidence_source,
      'bank_statement_item_id', v_bank.id, 'reconciliation_match_id', v_reconciliation.id,
      'amount_cents', v_payment.amount_cents, 'currency', v_payment.currency)
  );
  return v_payment;
end;
$$;

revoke all on function public.settle_vendor_payment(
  uuid, uuid, uuid, uuid, integer, text, uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.settle_vendor_payment(
  uuid, uuid, uuid, uuid, integer, text, uuid, uuid, text, text, text, text
) to service_role;

comment on table public.vendor_finance_profiles is
  'Vendor tax/payment readiness and masked destination references. Raw TIN and bank data are prohibited.';
comment on table public.vendor_bills is
  'Vendor obligations. A purchase order is a commitment, not a bill or payment.';
comment on table public.vendor_bill_match_evidence is
  'Immutable PO, receipt, and bill snapshots used for three-way match decisions.';
comment on table public.vendor_payments is
  'Human-authorized vendor payment aggregate; SETTLED requires evidence and exact bank reconciliation.';
comment on function public.queue_vendor_payment_command(uuid, uuid, uuid, uuid, integer, text, text) is
  'Queues an exact PHI-free finance outbox command only; it never contacts a provider or proves payment.';

create or replace function app_private.guard_vendor_terminal_settlement_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.provider = 'mercury'
     and old.event_type = 'VENDOR_PAYMENT_SETTLED'
     and old.status = 'PROCESSED' then
    raise exception using errcode = 'P0001', message = 'terminal_vendor_payment_event_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_vendor_terminal_settlement_event()
  from public, anon, authenticated, service_role;

drop trigger if exists finance_events_terminal_vendor_payment_immutable
  on public.finance_integration_events;
create trigger finance_events_terminal_vendor_payment_immutable
  before update or delete on public.finance_integration_events
  for each row execute function app_private.guard_vendor_terminal_settlement_event();

-- Once an approved vendor allocation exists, both sides of the bank match are
-- permanent evidence. Later payroll and contractor migrations install their
-- own narrowly named triggers without replacing these vendor guards.
create or replace function app_private.guard_vendor_settlement_allocation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'bank_statement_items' and exists (
    select 1 from public.reconciliation_matches matched
    where matched.tenant_id = old.tenant_id
      and matched.bank_statement_item_id = old.id
      and matched.vendor_payment_id is not null
      and matched.match_status = 'APPROVED'
  ) then
    raise exception using errcode = 'P0001', message = 'matched_vendor_bank_evidence_immutable';
  end if;
  if tg_table_name = 'reconciliation_matches'
     and old.vendor_payment_id is not null
     and old.match_status = 'APPROVED' then
    raise exception using errcode = 'P0001', message = 'approved_vendor_reconciliation_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_vendor_settlement_allocation()
  from public, anon, authenticated, service_role;

drop trigger if exists vendor_bank_items_after_approved_match_immutable
  on public.bank_statement_items;
create trigger vendor_bank_items_after_approved_match_immutable
  before update or delete on public.bank_statement_items
  for each row execute function app_private.guard_vendor_settlement_allocation();

drop trigger if exists vendor_approved_reconciliation_match_immutable
  on public.reconciliation_matches;
create trigger vendor_approved_reconciliation_match_immutable
  before update or delete on public.reconciliation_matches
  for each row execute function app_private.guard_vendor_settlement_allocation();





create or replace function app_private.guard_vendor_ap_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'vendor_ap_state_delete_forbidden';
  end if;
  if tg_table_name = 'vendor_finance_profiles' then
    if old.tenant_id is distinct from new.tenant_id
       or old.inventory_vendor_id is distinct from new.inventory_vendor_id
       or old.legal_entity_id is distinct from new.legal_entity_id
       or old.legal_name is distinct from new.legal_name
       or old.tax_classification is distinct from new.tax_classification
       or old.destination_provider is distinct from new.destination_provider
       or old.provider_recipient_id is distinct from new.provider_recipient_id
       or old.destination_masked_label is distinct from new.destination_masked_label
       or old.destination_snapshot_hash is distinct from new.destination_snapshot_hash
       or old.destination_changed_at is distinct from new.destination_changed_at
       or old.destination_changed_by is distinct from new.destination_changed_by
       or old.request_idempotency_key is distinct from new.request_idempotency_key
       or old.request_hash is distinct from new.request_hash
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception using errcode = 'P0001', message = 'vendor_finance_profile_identity_immutable';
    end if;
  elsif tg_table_name = 'vendor_bills' then
    if old.tenant_id is distinct from new.tenant_id
       or old.vendor_finance_profile_id is distinct from new.vendor_finance_profile_id
       or old.legal_entity_id is distinct from new.legal_entity_id
       or old.purchase_order_id is distinct from new.purchase_order_id
       or old.bill_number is distinct from new.bill_number
       or old.invoice_date is distinct from new.invoice_date
       or old.due_date is distinct from new.due_date
       or old.currency is distinct from new.currency
       or old.tax_cents is distinct from new.tax_cents
       or old.shipping_cents is distinct from new.shipping_cents
       or old.source_document_ref is distinct from new.source_document_ref
       or old.source_document_checksum is distinct from new.source_document_checksum
       or old.request_idempotency_key is distinct from new.request_idempotency_key
       or old.request_hash is distinct from new.request_hash
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception using errcode = 'P0001', message = 'vendor_bill_identity_immutable';
    end if;
    if old.status <> 'DRAFT' and (
      old.subtotal_cents is distinct from new.subtotal_cents
      or old.total_cents is distinct from new.total_cents
    ) then
      raise exception using errcode = 'P0001', message = 'vendor_bill_money_immutable';
    end if;
  elsif tg_table_name = 'vendor_payments' then
    if old.tenant_id is distinct from new.tenant_id
       or old.vendor_bill_id is distinct from new.vendor_bill_id
       or old.vendor_finance_profile_id is distinct from new.vendor_finance_profile_id
       or old.legal_entity_id is distinct from new.legal_entity_id
       or old.bill_version is distinct from new.bill_version
       or old.profile_version is distinct from new.profile_version
       or old.provider is distinct from new.provider
       or old.amount_cents is distinct from new.amount_cents
       or old.currency is distinct from new.currency
       or old.funding_account_ref is distinct from new.funding_account_ref
       or old.funding_account_masked_label is distinct from new.funding_account_masked_label
       or old.destination_snapshot_hash is distinct from new.destination_snapshot_hash
       or old.destination_masked_label is distinct from new.destination_masked_label
       or old.proposal_hash is distinct from new.proposal_hash
       or old.maker_prepared_by is distinct from new.maker_prepared_by
       or old.maker_prepared_at is distinct from new.maker_prepared_at
       or old.request_idempotency_key is distinct from new.request_idempotency_key
       or old.request_hash is distinct from new.request_hash
       or old.created_at is distinct from new.created_at then
      raise exception using errcode = 'P0001', message = 'vendor_payment_money_identity_immutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_vendor_ap_state()
  from public, anon, authenticated, service_role;

do $$
declare
  guarded_table text;
begin
  foreach guarded_table in array array['vendor_finance_profiles', 'vendor_bills', 'vendor_payments'] loop
    execute format('drop trigger if exists %I on public.%I', guarded_table || '_state_guard', guarded_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function app_private.guard_vendor_ap_state()',
      guarded_table || '_state_guard', guarded_table
    );
  end loop;
end $$;

-- Migration 070 owns the contractor worker gate. Split its shared command
-- trigger so vendor commands receive their own equally strict revalidation.
drop trigger if exists finance_integration_commands_identity_guard
  on public.finance_integration_commands;
drop trigger if exists finance_integration_commands_nonvendor_guard_update
  on public.finance_integration_commands;
drop trigger if exists finance_integration_commands_nonvendor_guard_delete
  on public.finance_integration_commands;

create trigger finance_integration_commands_nonvendor_guard_update
  before update on public.finance_integration_commands
  for each row
  when (old.aggregate_type <> 'vendor_payment' and new.aggregate_type <> 'vendor_payment')
  execute function app_private.guard_payout_aggregate();

create trigger finance_integration_commands_nonvendor_guard_delete
  before delete on public.finance_integration_commands
  for each row
  when (old.aggregate_type <> 'vendor_payment')
  execute function app_private.guard_payout_aggregate();

create or replace function app_private.guard_vendor_finance_command()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'vendor_payment_command_delete_forbidden';
  end if;
  if old.tenant_id is distinct from new.tenant_id
     or old.provider is distinct from new.provider
     or old.command_type is distinct from new.command_type
     or old.aggregate_type is distinct from new.aggregate_type
     or old.aggregate_id is distinct from new.aggregate_id
     or old.stable_key is distinct from new.stable_key
     or old.request_checksum is distinct from new.request_checksum
     or old.safe_payload is distinct from new.safe_payload
     or old.correlation_id is distinct from new.correlation_id
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at then
    raise exception using errcode = 'P0001', message = 'vendor_payment_command_identity_immutable';
  end if;
  if old.status is distinct from new.status and (
    (old.status = 'PENDING' and new.status not in ('CLAIMED', 'CANCELLED'))
    or old.status = 'CANCELLED'
    or (new.status = 'SENT' and old.status <> 'CLAIMED')
  ) then
    raise exception using errcode = 'P0001', message = 'vendor_payment_command_transition_invalid';
  end if;
  if old.status is distinct from new.status and new.status = 'CLAIMED' then
    if old.status <> 'PENDING'
       or new.aggregate_type <> 'vendor_payment'
       or new.provider <> 'mercury'
       or new.command_type <> 'CREATE_VENDOR_PAYMENT'
       or new.request_checksum <> app_private.finance_command_checksum(new.safe_payload)
       or not exists (
         select 1
         from public.vendor_payments payment
         join public.vendor_bills bill
           on bill.tenant_id = payment.tenant_id and bill.id = payment.vendor_bill_id
         join public.vendor_finance_profiles profile
           on profile.tenant_id = payment.tenant_id and profile.id = payment.vendor_finance_profile_id
         where payment.tenant_id = new.tenant_id
           and payment.id = new.aggregate_id
           and payment.status = 'COMMAND_QUEUED'
           and bill.status = 'PAYMENT_QUEUED'
           and profile.status = 'ACTIVE'
           and profile.payment_readiness = 'READY'
           and profile.tax_reporting_status in ('READY', 'EXEMPT_VERIFIED')
           and profile.w9_status in ('VERIFIED', 'EXEMPT_VERIFIED')
           and profile.destination_reviewed_at >= profile.destination_changed_at
           and profile.provider_recipient_id is not null
           and payment.profile_version = profile.version
           and payment.amount_cents = bill.total_cents
           and payment.currency = bill.currency
           and payment.maker_prepared_by = bill.maker_approved_by
           and payment.checker_approved_by = bill.checker_approved_by
           and payment.executor_authorized_by = new.created_by
           and payment.maker_prepared_by <> payment.checker_approved_by
           and payment.executor_authorized_by <> payment.maker_prepared_by
           and payment.executor_authorized_by <> payment.checker_approved_by
           and payment.command_id = new.id
           and exists (
             select 1 from public.finance_role_assignments assignment
             where assignment.tenant_id = new.tenant_id
               and assignment.profile_id = new.created_by
               and assignment.finance_role = 'finance_executor'
               and assignment.revoked_at is null
               and assignment.effective_at <= clock_timestamp()
               and (assignment.expires_at is null or assignment.expires_at > clock_timestamp())
           )
           and app_private.vendor_payment_proposal_hash(
             payment.tenant_id, payment.id, payment.vendor_bill_id, payment.bill_version,
             payment.vendor_finance_profile_id, payment.profile_version,
             payment.legal_entity_id, payment.amount_cents, payment.currency,
             profile.provider_recipient_id, payment.destination_snapshot_hash,
             payment.destination_masked_label, payment.funding_account_ref,
             payment.funding_account_masked_label
           ) = payment.proposal_hash
           and new.safe_payload->>'vendor_payment_id' = payment.id::text
           and new.safe_payload->>'vendor_bill_id' = bill.id::text
           and new.safe_payload->>'vendor_finance_profile_id' = profile.id::text
           and new.safe_payload->>'legal_entity_id' = payment.legal_entity_id::text
           and new.safe_payload->>'proposal_hash' = payment.proposal_hash
           and new.safe_payload->>'amount_cents' = payment.amount_cents::text
           and new.safe_payload->>'currency' = payment.currency
           and new.safe_payload->>'provider_recipient_id' = profile.provider_recipient_id
           and new.safe_payload->>'destination_snapshot_hash' = payment.destination_snapshot_hash
           and new.safe_payload->>'funding_account_ref' = payment.funding_account_ref
       ) then
      raise exception using errcode = 'P0001', message = 'vendor_payment_worker_revalidation_failed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_vendor_finance_command()
  from public, anon, authenticated, service_role;

drop trigger if exists finance_integration_commands_vendor_guard_update
  on public.finance_integration_commands;
create trigger finance_integration_commands_vendor_guard_update
  before update on public.finance_integration_commands
  for each row
  when (old.aggregate_type = 'vendor_payment' or new.aggregate_type = 'vendor_payment')
  execute function app_private.guard_vendor_finance_command();

drop trigger if exists finance_integration_commands_vendor_guard_delete
  on public.finance_integration_commands;
create trigger finance_integration_commands_vendor_guard_delete
  before delete on public.finance_integration_commands
  for each row
  when (old.aggregate_type = 'vendor_payment')
  execute function app_private.guard_vendor_finance_command();

-- Service-role table access is SELECT-only. This is the single bounded worker
-- path from PENDING to CLAIMED for a vendor-payment outbox row. The vendor
-- command trigger above remains the final authorization gate immediately
-- before the claim is recorded.
create or replace function public.claim_vendor_payment_command(
  p_tenant_id uuid,
  p_command_id uuid,
  p_expected_request_checksum text,
  p_claimed_by text
)
returns public.finance_integration_commands
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_command public.finance_integration_commands%rowtype;
begin
  if p_tenant_id is null
     or p_command_id is null
     or coalesce(p_expected_request_checksum, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_claimed_by, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$' then
    raise exception using errcode = '22023', message = 'vendor_payment_command_claim_request_invalid';
  end if;

  select * into v_command
  from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.id = p_command_id
    and command.provider = 'mercury'
    and command.aggregate_type = 'vendor_payment';
  if not found then
    raise exception using errcode = 'P0002', message = 'vendor_payment_command_not_found';
  end if;

  perform app_private.lock_payops_aggregate(
    p_tenant_id, 'vendor_payment', v_command.aggregate_id
  );

  select * into v_command
  from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id
    and command.id = p_command_id
    and command.provider = 'mercury'
    and command.aggregate_type = 'vendor_payment'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'vendor_payment_command_not_found';
  end if;
  if v_command.request_checksum <> p_expected_request_checksum then
    raise exception using errcode = '40001', message = 'vendor_payment_command_claim_checksum_conflict';
  end if;
  if v_command.status = 'CLAIMED'
     and v_command.claimed_by = p_claimed_by
     and v_command.claimed_at is not null then
    return v_command;
  end if;
  if v_command.status <> 'PENDING'
     or v_command.next_attempt_at > clock_timestamp() then
    raise exception using errcode = '40001', message = 'vendor_payment_command_not_claimable';
  end if;

  update public.finance_integration_commands
  set status = 'CLAIMED',
      claimed_by = p_claimed_by,
      claimed_at = clock_timestamp(),
      attempt_count = attempt_count + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and id = p_command_id
    and provider = 'mercury'
    and aggregate_type = 'vendor_payment'
    and status = 'PENDING'
    and request_checksum = p_expected_request_checksum
    and next_attempt_at <= clock_timestamp()
  returning * into v_command;
  if not found then
    raise exception using errcode = '40001', message = 'vendor_payment_command_claim_conflict';
  end if;
  return v_command;
end;
$$;

revoke all on function public.claim_vendor_payment_command(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_vendor_payment_command(uuid, uuid, text, text)
  to service_role;

-- New Vendor AP data is server-only. Browser roles receive no direct policy,
-- and service_role can read but can mutate only through SECURITY DEFINER RPCs.
do $$
declare
  finance_table text;
begin
  foreach finance_table in array array[
    'vendor_finance_profiles', 'vendor_bills', 'vendor_bill_lines',
    'vendor_bill_match_evidence', 'vendor_bill_approvals', 'vendor_payments',
    'vendor_payment_evidence', 'vendor_ap_events'
  ] loop
    execute format('alter table public.%I enable row level security', finance_table);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', finance_table);
    execute format('grant select on public.%I to service_role', finance_table);
  end loop;
end $$;
