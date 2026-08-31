-- Operational scheduling, contractor-pay, and Square reconciliation.
-- Clinical records remain in the existing care schema. These tables contain
-- operational facts only and are accessed through tenant-scoped server APIs.

create table if not exists public.operational_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  series_id uuid,
  occurrence_key text,
  event_container_id uuid references public.event_containers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Los_Angeles',
  location_name text,
  location_address text,
  service_area text,
  role_required text not null default 'RN',
  slots_required integer not null default 1 check (slots_required between 1 and 100),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  instructions text,
  recurrence jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (tenant_id, series_id, occurrence_key)
);

create table if not exists public.operational_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.operational_shifts(id) on delete cascade,
  nurse_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'offered'
    check (status in ('offered', 'claimed', 'assigned', 'declined', 'completed', 'cancelled')),
  offered_at timestamptz,
  claimed_at timestamptz,
  assigned_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, nurse_profile_id)
);

create table if not exists public.nurse_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_number text not null,
  nurse_profile_id uuid references public.profiles(id) on delete set null,
  nurse_name text not null,
  nurse_email text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'correction_required', 'paid', 'rejected')),
  period_start date not null,
  period_end date not null,
  wages_cents bigint not null default 0 check (wages_cents >= 0),
  reimbursements_cents bigint not null default 0 check (reimbursements_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source text not null default 'invoice_form',
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  paid_at timestamptz,
  payment_reference text,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (tenant_id, invoice_number)
);

create table if not exists public.nurse_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.nurse_invoices(id) on delete cascade,
  shift_id uuid references public.operational_shifts(id) on delete set null,
  event_container_id uuid references public.event_containers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  line_type text not null check (line_type in ('shift', 'expense')),
  service_code text,
  service_date date,
  hours numeric(6, 2),
  quantity jsonb not null default '{}'::jsonb,
  description text,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('square')),
  provider_payment_id text not null,
  provider_order_id text,
  provider_customer_id text,
  merchant_id text,
  location_id text,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null,
  refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'partial', 'refunded', 'failed')),
  source text,
  processed_at timestamptz,
  appointment_id uuid references public.appointments(id) on delete set null,
  event_container_id uuid references public.event_containers(id) on delete set null,
  event_service_id uuid references public.event_services(id) on delete set null,
  invoice_reference text,
  reconciliation_status text not null default 'unmatched'
    check (reconciliation_status in ('matched', 'unmatched', 'manual_review', 'ignored')),
  match_method text,
  match_confidence numeric(4, 3) check (match_confidence between 0 and 1),
  raw_summary jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, provider_payment_id)
);

create table if not exists public.client_payment_refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid references public.client_payments(id) on delete set null,
  provider text not null check (provider in ('square')),
  provider_refund_id text not null,
  provider_payment_id text not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null,
  reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, provider_refund_id)
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('square')),
  provider_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (tenant_id, provider, provider_event_id)
);

create table if not exists public.payment_reconciliation_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid not null references public.client_payments(id) on delete cascade,
  previous_status text,
  next_status text not null,
  association jsonb not null default '{}'::jsonb,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists operational_shifts_window_idx
  on public.operational_shifts (tenant_id, starts_at, status);
create index if not exists operational_shift_assignment_nurse_idx
  on public.operational_shift_assignments (tenant_id, nurse_profile_id, status);
create index if not exists nurse_invoices_queue_idx
  on public.nurse_invoices (tenant_id, status, submitted_at desc);
create index if not exists client_payments_reconciliation_idx
  on public.client_payments (tenant_id, reconciliation_status, processed_at desc);
create index if not exists client_payments_period_idx
  on public.client_payments (tenant_id, processed_at desc, status);

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'operational_shifts', 'operational_shift_assignments', 'nurse_invoices',
    'nurse_invoice_lines', 'client_payments', 'client_payment_refunds',
    'payment_webhook_events', 'payment_reconciliation_history'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
  end loop;
end $$;

drop policy if exists "operational shifts operator access" on public.operational_shifts;
create policy "operational shifts operator access" on public.operational_shifts for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "operational shifts nurse read" on public.operational_shifts;
create policy "operational shifts nurse read" on public.operational_shifts for select
  using (
    app_private.os_same_tenant(tenant_id)
    and (
      status = 'open'
      or exists (
        select 1 from public.operational_shift_assignments a
        where a.shift_id = operational_shifts.id and a.nurse_profile_id = auth.uid()
      )
    )
  );

drop policy if exists "shift assignments operator access" on public.operational_shift_assignments;
create policy "shift assignments operator access" on public.operational_shift_assignments for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "shift assignments nurse read" on public.operational_shift_assignments;
create policy "shift assignments nurse read" on public.operational_shift_assignments for select
  using (app_private.os_same_tenant(tenant_id) and nurse_profile_id = auth.uid());

drop policy if exists "nurse invoices operator access" on public.nurse_invoices;
create policy "nurse invoices operator access" on public.nurse_invoices for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "nurse invoices owner read" on public.nurse_invoices;
create policy "nurse invoices owner read" on public.nurse_invoices for select
  using (app_private.os_same_tenant(tenant_id) and nurse_profile_id = auth.uid());

drop policy if exists "nurse invoice lines operator access" on public.nurse_invoice_lines;
create policy "nurse invoice lines operator access" on public.nurse_invoice_lines for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "nurse invoice lines owner read" on public.nurse_invoice_lines;
create policy "nurse invoice lines owner read" on public.nurse_invoice_lines for select
  using (
    app_private.os_same_tenant(tenant_id)
    and exists (
      select 1 from public.nurse_invoices i
      where i.id = nurse_invoice_lines.invoice_id and i.nurse_profile_id = auth.uid()
    )
  );

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'client_payments', 'client_payment_refunds', 'payment_webhook_events',
    'payment_reconciliation_history'
  ] loop
    execute format('drop policy if exists %I on public.%I', tbl || ' operator access', tbl);
    execute format(
      'create policy %I on public.%I for all using (app_private.os_same_tenant(tenant_id) and app_private.is_operator()) with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator())',
      tbl || ' operator access', tbl
    );
  end loop;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'operational_shifts', 'operational_shift_assignments', 'nurse_invoices',
    'client_payments', 'client_payment_refunds'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'trg_' || tbl || '_updated_at', tbl
    );
  end loop;
end $$;

create or replace function app_private.claim_operational_shift(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_nurse_profile_id uuid
)
returns public.operational_shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift public.operational_shifts;
  v_assignment public.operational_shift_assignments;
  v_active_count integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_nurse_profile_id and p.tenant_id = p_tenant_id
      and p.status = 'active' and p.role in ('nurse', 'rn', 'np', 'admin')
  ) then
    raise exception 'Nurse profile is not active for this tenant';
  end if;

  select * into v_shift from public.operational_shifts
    where id = p_shift_id and tenant_id = p_tenant_id for update;
  if not found or v_shift.status <> 'open' then
    raise exception 'Shift is not open';
  end if;

  select * into v_assignment from public.operational_shift_assignments
    where shift_id = p_shift_id and nurse_profile_id = p_nurse_profile_id;
  if found and v_assignment.status in ('claimed', 'assigned', 'completed') then
    return v_assignment;
  end if;

  select count(*) into v_active_count from public.operational_shift_assignments
    where shift_id = p_shift_id and status in ('claimed', 'assigned', 'completed');
  if v_active_count >= v_shift.slots_required then
    raise exception 'Shift is full';
  end if;

  insert into public.operational_shift_assignments (
    tenant_id, shift_id, nurse_profile_id, status, claimed_at, created_by
  ) values (
    p_tenant_id, p_shift_id, p_nurse_profile_id, 'claimed', now(), p_nurse_profile_id
  )
  on conflict (shift_id, nurse_profile_id) do update set
    status = 'claimed', claimed_at = now(), updated_at = now()
  returning * into v_assignment;

  if v_active_count + 1 >= v_shift.slots_required then
    update public.operational_shifts set status = 'assigned', version = version + 1
      where id = p_shift_id;
  end if;
  return v_assignment;
end;
$$;

revoke all on function app_private.claim_operational_shift(uuid, uuid, uuid) from public;
grant execute on function app_private.claim_operational_shift(uuid, uuid, uuid) to service_role;

comment on table public.operational_shifts is 'PHI-free workforce schedule; each recurrence occurrence is an independently editable row.';
comment on table public.nurse_invoices is 'Persisted contractor invoice lifecycle using the existing invoice calculator as authority.';
comment on table public.client_payments is 'Normalized Square payment facts and explicit reconciliation state; no card credentials.';
