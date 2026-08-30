-- Durable contractor-invoice intake for Avalon Finance.
-- The public nurse form authenticates a shared door, not a person, so every
-- submission begins quarantined until an admin documents identity verification.

create table if not exists public.nurse_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  submission_id uuid not null,
  submission_id_source text not null default 'client'
    check (submission_id_source in ('client', 'server_legacy')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  invoice_number text not null,
  nurse_profile_id uuid references public.profiles(id) on delete set null,
  nurse_name text not null check (char_length(nurse_name) between 2 and 60),
  nurse_email text not null check (char_length(nurse_email) between 3 and 120),
  known_contractor boolean not null default false,
  identity_assurance text not null
    check (identity_assurance in (
      'shared_door_unmatched', 'shared_door_roster_match',
      'shared_door_profile_match', 'admin_verified_shared_door'
    )),
  status text not null default 'quarantined'
    check (status in ('quarantined', 'submitted', 'approved', 'correction_required', 'paid', 'rejected')),
  period_start date not null,
  period_end date not null,
  wages_cents bigint not null default 0 check (wages_cents >= 0),
  reimbursements_cents bigint not null default 0 check (reimbursements_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  pricing_contract text not null default 'avalon_nurse_invoice_v1',
  source text not null default 'shared_invoice_form',
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sending', 'sent', 'failed', 'exhausted')),
  delivery_claimed_at timestamptz,
  delivery_claim_token uuid,
  delivery_attempt_count integer not null default 0 check (delivery_attempt_count >= 0),
  delivery_last_attempt_at timestamptz,
  delivery_next_retry_at timestamptz,
  delivery_last_error_code text,
  delivery_sent_at timestamptz,
  delivery_provider_message_id text,
  receipt_storage_status text not null default 'none'
    check (receipt_storage_status in ('none', 'pending', 'complete', 'failed')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  identity_verified_by uuid references public.profiles(id) on delete set null,
  identity_verified_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (total_cents = wages_cents + reimbursements_cents),
  constraint nurse_invoices_tenant_id_id_key unique (tenant_id, id),
  unique (tenant_id, submission_id),
  unique (tenant_id, invoice_number)
);

-- Composite parent identity is required so every child relationship can prove
-- that its invoice belongs to the same tenant. The catalog guard also upgrades
-- a schema created by an earlier draft of this migration without failing on a
-- normal rerun.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nurse_invoices'::regclass
      and conname = 'nurse_invoices_tenant_id_id_key'
  ) then
    alter table public.nurse_invoices
      add constraint nurse_invoices_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

create table if not exists public.nurse_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null,
  line_type text not null check (line_type in ('shift', 'expense')),
  service_code text,
  service_date date,
  hours numeric(6, 2),
  quantity jsonb not null default '{}'::jsonb,
  description text,
  amount_cents bigint not null check (amount_cents >= 0),
  pricing_snapshot jsonb not null default '{}'::jsonb,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (invoice_id, sort_order),
  constraint nurse_invoice_lines_invoice_tenant_fk
    foreign key (tenant_id, invoice_id)
    references public.nurse_invoices(tenant_id, id) on delete cascade
);

create table if not exists public.nurse_invoice_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null,
  receipt_index integer not null check (receipt_index >= 0 and receipt_index < 20),
  storage_path text not null,
  file_name text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 1400000),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  scan_status text not null default 'quarantined'
    check (scan_status in ('quarantined', 'cleared', 'blocked')),
  scanned_at timestamptz,
  scanner_provider text,
  scanner_reference text,
  created_at timestamptz not null default now(),
  unique (invoice_id, receipt_index),
  unique (tenant_id, storage_path),
  constraint nurse_invoice_receipts_invoice_tenant_fk
    foreign key (tenant_id, invoice_id)
    references public.nurse_invoices(tenant_id, id) on delete cascade
);

-- Existing installations may already have the original invoice_id-only
-- foreign keys. Keep those harmless constraints in place and add the stronger
-- tenant-aware relationships. NOT VALID minimizes the initial lock; the
-- immediate validation fails closed if historical rows cross tenant bounds.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nurse_invoice_lines'::regclass
      and conname = 'nurse_invoice_lines_invoice_tenant_fk'
  ) then
    alter table public.nurse_invoice_lines
      add constraint nurse_invoice_lines_invoice_tenant_fk
      foreign key (tenant_id, invoice_id)
      references public.nurse_invoices(tenant_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nurse_invoice_receipts'::regclass
      and conname = 'nurse_invoice_receipts_invoice_tenant_fk'
  ) then
    alter table public.nurse_invoice_receipts
      add constraint nurse_invoice_receipts_invoice_tenant_fk
      foreign key (tenant_id, invoice_id)
      references public.nurse_invoices(tenant_id, id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.nurse_invoice_lines
  validate constraint nurse_invoice_lines_invoice_tenant_fk;
alter table public.nurse_invoice_receipts
  validate constraint nurse_invoice_receipts_invoice_tenant_fk;

create index if not exists nurse_invoices_review_queue_idx
  on public.nurse_invoices (tenant_id, status, submitted_at desc);
create index if not exists nurse_invoices_delivery_queue_idx
  on public.nurse_invoices (delivery_status, delivery_next_retry_at, submitted_at)
  where delivery_status in ('pending', 'failed', 'sending');
create index if not exists nurse_invoice_lines_invoice_idx
  on public.nurse_invoice_lines (tenant_id, invoice_id, sort_order);
create index if not exists nurse_invoice_receipts_invoice_idx
  on public.nurse_invoice_receipts (tenant_id, invoice_id, receipt_index);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nurse-invoice-receipts', 'nurse-invoice-receipts', false, 1400000,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.nurse_invoices enable row level security;
alter table public.nurse_invoice_lines enable row level security;
alter table public.nurse_invoice_receipts enable row level security;

grant select, insert, update, delete on public.nurse_invoices to service_role;
grant select, insert, update, delete on public.nurse_invoice_lines to service_role;
grant select, insert, update, delete on public.nurse_invoice_receipts to service_role;

-- Finance data is service-only. Admin reads must pass through requireAdmin(),
-- the production AAL2 gate, tenant scoping, receipt signing, and read auditing.
revoke all on public.nurse_invoices, public.nurse_invoice_lines, public.nurse_invoice_receipts from anon, authenticated;
drop policy if exists "nurse invoices admin read" on public.nurse_invoices;
drop policy if exists "nurse invoice lines admin read" on public.nurse_invoice_lines;
drop policy if exists "nurse invoice receipts admin read" on public.nurse_invoice_receipts;

create table if not exists public.nurse_invoice_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null,
  from_status text,
  to_status text not null,
  invoice_version integer not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  review_note text,
  payment_reference text,
  created_at timestamptz not null default now(),
  constraint nurse_invoice_status_events_invoice_tenant_fk
    foreign key (tenant_id, invoice_id)
    references public.nurse_invoices(tenant_id, id) on delete cascade
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nurse_invoice_status_events'::regclass
      and conname = 'nurse_invoice_status_events_invoice_tenant_fk'
  ) then
    alter table public.nurse_invoice_status_events
      add constraint nurse_invoice_status_events_invoice_tenant_fk
      foreign key (tenant_id, invoice_id)
      references public.nurse_invoices(tenant_id, id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.nurse_invoice_status_events
  validate constraint nurse_invoice_status_events_invoice_tenant_fk;

create index if not exists nurse_invoice_status_events_invoice_idx
  on public.nurse_invoice_status_events (tenant_id, invoice_id, created_at desc);

alter table public.nurse_invoice_status_events enable row level security;
grant select, insert on public.nurse_invoice_status_events to service_role;
revoke all on public.nurse_invoice_status_events from anon, authenticated;

create or replace function app_private.capture_nurse_invoice_status_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.nurse_invoice_status_events (
      tenant_id, invoice_id, from_status, to_status, invoice_version,
      actor_profile_id, review_note, payment_reference
    ) values (
      new.tenant_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      new.version,
      new.reviewed_by,
      new.review_note,
      case when new.status = 'paid' then new.payment_reference else null end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists nurse_invoice_status_event on public.nurse_invoices;
create trigger nurse_invoice_status_event
  after insert or update of status on public.nurse_invoices
  for each row execute function app_private.capture_nurse_invoice_status_event();

create or replace function app_private.prevent_nurse_invoice_status_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'nurse invoice status events are immutable';
end;
$$;

drop trigger if exists nurse_invoice_status_events_immutable on public.nurse_invoice_status_events;
create trigger nurse_invoice_status_events_immutable
  before update or delete on public.nurse_invoice_status_events
  for each row execute function app_private.prevent_nurse_invoice_status_event_mutation();

create or replace function app_private.prevent_nurse_invoice_financial_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.tenant_id is distinct from new.tenant_id
    or old.submission_id is distinct from new.submission_id
    or old.submission_id_source is distinct from new.submission_id_source
    or old.request_hash is distinct from new.request_hash
    or old.invoice_number is distinct from new.invoice_number
    or old.nurse_name is distinct from new.nurse_name
    or old.nurse_email is distinct from new.nurse_email
    or old.known_contractor is distinct from new.known_contractor
    or old.period_start is distinct from new.period_start
    or old.period_end is distinct from new.period_end
    or old.wages_cents is distinct from new.wages_cents
    or old.reimbursements_cents is distinct from new.reimbursements_cents
    or old.total_cents is distinct from new.total_cents
    or old.currency is distinct from new.currency
    or old.pricing_contract is distinct from new.pricing_contract
    or old.source is distinct from new.source
    or old.submitted_at is distinct from new.submitted_at
  then
    raise exception 'Submitted invoice financial and source fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists nurse_invoices_financial_immutable on public.nurse_invoices;
create trigger nurse_invoices_financial_immutable
  before update on public.nurse_invoices
  for each row execute function app_private.prevent_nurse_invoice_financial_mutation();

create or replace function app_private.prevent_nurse_invoice_delete_or_line_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Submitted invoice records are append-only';
end;
$$;

drop trigger if exists nurse_invoices_no_delete on public.nurse_invoices;
create trigger nurse_invoices_no_delete before delete on public.nurse_invoices
  for each row execute function app_private.prevent_nurse_invoice_delete_or_line_mutation();
drop trigger if exists nurse_invoice_lines_immutable on public.nurse_invoice_lines;
create trigger nurse_invoice_lines_immutable before update or delete on public.nurse_invoice_lines
  for each row execute function app_private.prevent_nurse_invoice_delete_or_line_mutation();
drop trigger if exists nurse_invoice_receipts_immutable on public.nurse_invoice_receipts;
create trigger nurse_invoice_receipts_immutable before update or delete on public.nurse_invoice_receipts
  for each row execute function app_private.prevent_nurse_invoice_delete_or_line_mutation();

drop trigger if exists trg_nurse_invoices_updated_at on public.nurse_invoices;
create trigger trg_nurse_invoices_updated_at before update on public.nurse_invoices
  for each row execute function public.touch_updated_at();

-- Header and computed lines are inserted in one database transaction. The
-- function is service-role-only and treats a matching submission UUID/hash as
-- an idempotent replay while rejecting UUID reuse for different invoice data.
create or replace function public.create_nurse_invoice(
  p_invoice jsonb,
  p_lines jsonb
)
returns table(created_invoice_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_existing_hash text;
begin
  select id, request_hash into v_id, v_existing_hash
  from public.nurse_invoices
  where tenant_id = (p_invoice->>'tenant_id')::uuid
    and submission_id = (p_invoice->>'submission_id')::uuid;

  if v_id is not null then
    if v_existing_hash <> p_invoice->>'request_hash' then
      raise exception 'submission_id_reused';
    end if;
    return query select v_id, true;
    return;
  end if;

  begin
    insert into public.nurse_invoices (
      tenant_id, submission_id, submission_id_source, request_hash,
      invoice_number, nurse_profile_id, nurse_name, nurse_email,
      known_contractor, identity_assurance, status, period_start, period_end,
      wages_cents, reimbursements_cents, total_cents, currency,
      pricing_contract, delivery_status, receipt_storage_status,
      submitted_at, payload
    ) values (
      (p_invoice->>'tenant_id')::uuid,
      (p_invoice->>'submission_id')::uuid,
      p_invoice->>'submission_id_source',
      p_invoice->>'request_hash',
      p_invoice->>'invoice_number',
      nullif(p_invoice->>'nurse_profile_id', '')::uuid,
      p_invoice->>'nurse_name',
      p_invoice->>'nurse_email',
      coalesce((p_invoice->>'known_contractor')::boolean, false),
      p_invoice->>'identity_assurance',
      'quarantined',
      (p_invoice->>'period_start')::date,
      (p_invoice->>'period_end')::date,
      (p_invoice->>'wages_cents')::bigint,
      (p_invoice->>'reimbursements_cents')::bigint,
      (p_invoice->>'total_cents')::bigint,
      coalesce(p_invoice->>'currency', 'USD'),
      coalesce(p_invoice->>'pricing_contract', 'avalon_nurse_invoice_v1'),
      'pending',
      case when jsonb_array_length(coalesce(p_invoice->'receipt_manifest', '[]'::jsonb)) > 0 then 'pending' else 'none' end,
      (p_invoice->>'submitted_at')::timestamptz,
      coalesce(p_invoice->'payload', '{}'::jsonb)
    ) returning id into v_id;
  exception when unique_violation then
    select id, request_hash into v_id, v_existing_hash
    from public.nurse_invoices
    where tenant_id = (p_invoice->>'tenant_id')::uuid
      and submission_id = (p_invoice->>'submission_id')::uuid;
    if v_id is null or v_existing_hash <> p_invoice->>'request_hash' then
      raise exception 'submission_id_reused';
    end if;
    return query select v_id, true;
    return;
  end;

  insert into public.nurse_invoice_lines (
    tenant_id, invoice_id, line_type, service_code, service_date,
    hours, quantity, description, amount_cents, pricing_snapshot, sort_order
  )
  select
    (p_invoice->>'tenant_id')::uuid,
    v_id,
    line->>'line_type',
    nullif(line->>'service_code', ''),
    nullif(line->>'service_date', '')::date,
    nullif(line->>'hours', '')::numeric,
    coalesce(line->'quantity', '{}'::jsonb),
    nullif(line->>'description', ''),
    (line->>'amount_cents')::bigint,
    coalesce(line->'pricing_snapshot', '{}'::jsonb),
    (line->>'sort_order')::integer
  from jsonb_array_elements(p_lines) as line;

  return query select v_id, false;
end;
$$;

revoke all on function public.create_nurse_invoice(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_nurse_invoice(jsonb, jsonb) to service_role;

-- Notification delivery is deliberately independent of the browser request.
-- A worker claims one persisted invoice at a time with a database row lock,
-- making concurrent cron invocations safe. Attempts are incremented at claim
-- time, abandoned leases are reclaimable, and a fifth abandoned claim is
-- terminal instead of retrying forever.
create or replace function public.claim_nurse_invoice_notification(
  p_tenant_id uuid default null,
  p_invoice_id uuid default null,
  p_lease_seconds integer default 600,
  p_max_attempts integer default 5
)
returns setof public.nurse_invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'invalid_delivery_lease';
  end if;
  if p_max_attempts < 1 or p_max_attempts > 10 then
    raise exception 'invalid_delivery_attempt_limit';
  end if;

  -- Resend's idempotency window is 24 hours. If a worker disappeared after an
  -- uncertain provider response and recovery was offline nearly that long,
  -- stop for human reconciliation instead of risking a duplicate alert.
  update public.nurse_invoices
  set delivery_status = 'exhausted',
      delivery_claim_token = null,
      delivery_claimed_at = null,
      delivery_next_retry_at = null,
      delivery_last_error_code = 'delivery_reconciliation_window_expired'
  where delivery_status = 'sending'
    and (delivery_claimed_at is null
      or delivery_claimed_at < clock_timestamp() - interval '23 hours')
    and (p_tenant_id is null or tenant_id = p_tenant_id)
    and (p_invoice_id is null or id = p_invoice_id);

  update public.nurse_invoices
  set delivery_status = 'exhausted',
      delivery_claim_token = null,
      delivery_claimed_at = null,
      delivery_next_retry_at = null,
      delivery_last_error_code = coalesce(delivery_last_error_code, 'delivery_attempts_exhausted')
  where delivery_status in ('failed', 'sending')
    and delivery_attempt_count >= p_max_attempts
    and (delivery_status = 'failed'
      or delivery_claimed_at is null
      or delivery_claimed_at < clock_timestamp() - make_interval(secs => p_lease_seconds))
    and (p_tenant_id is null or tenant_id = p_tenant_id)
    and (p_invoice_id is null or id = p_invoice_id);

  select invoice.id into v_id
  from public.nurse_invoices invoice
  where invoice.delivery_attempt_count < p_max_attempts
    and (p_tenant_id is null or invoice.tenant_id = p_tenant_id)
    and (p_invoice_id is null or invoice.id = p_invoice_id)
    and (
      (
        invoice.delivery_status in ('pending', 'failed')
        and coalesce(invoice.delivery_next_retry_at, invoice.submitted_at) <= clock_timestamp()
      )
      or (
        invoice.delivery_status = 'sending'
        and (invoice.delivery_claimed_at is null
          or invoice.delivery_claimed_at < clock_timestamp() - make_interval(secs => p_lease_seconds))
      )
    )
  order by coalesce(invoice.delivery_next_retry_at, invoice.submitted_at), invoice.submitted_at
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.nurse_invoices invoice
  set delivery_status = 'sending',
      delivery_claimed_at = clock_timestamp(),
      delivery_claim_token = gen_random_uuid(),
      delivery_attempt_count = invoice.delivery_attempt_count + 1,
      delivery_last_attempt_at = clock_timestamp(),
      delivery_next_retry_at = null,
      delivery_last_error_code = null
  where invoice.id = v_id
  returning invoice.*;
end;
$$;

revoke all on function public.claim_nurse_invoice_notification(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_nurse_invoice_notification(uuid, uuid, integer, integer)
  to service_role;

create or replace function public.nurse_invoice_metrics(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'quarantined', count(*) filter (where status = 'quarantined'),
    'submitted', count(*) filter (where status = 'submitted'),
    'correctionRequired', count(*) filter (where status = 'correction_required'),
    'approvedCents', coalesce(sum(total_cents) filter (where status = 'approved'), 0),
    'paidCents', coalesce(sum(total_cents) filter (where status = 'paid'), 0),
    'rejected', count(*) filter (where status = 'rejected')
  )
  from public.nurse_invoices
  where tenant_id = p_tenant_id;
$$;

revoke all on function public.nurse_invoice_metrics(uuid) from public, anon, authenticated;
grant execute on function public.nurse_invoice_metrics(uuid) to service_role;

comment on table public.nurse_invoices is
  'Immutable structured contractor invoices; shared-door submissions remain quarantined until admin identity verification.';
comment on table public.nurse_invoice_receipts is
  'Metadata for receipts stored in the private nurse-invoice-receipts bucket; bytes are accessed through short-lived admin signed URLs.';
