-- Avalon OS inventory, finance, and persisted-report primitives.
-- These tables intentionally sit beside the legacy inventory prototype so the
-- beta can migrate through server APIs without widening the old client-direct
-- policies. Money is integer cents and financial/stock entries are append-only.

create table if not exists public.os_inventory_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.os_inventory_folders(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  color text,
  sort_order integer not null default 0,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, parent_id, name)
);

create table if not exists public.os_inventory_vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  contact jsonb not null default '{}'::jsonb,
  terms jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.os_inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  folder_id uuid references public.os_inventory_folders(id) on delete set null,
  preferred_vendor_id uuid references public.os_inventory_vendors(id) on delete set null,
  name text not null check (char_length(name) between 1 and 240),
  sku text,
  barcode text,
  qr_code text,
  unit text not null default 'unit',
  reorder_point numeric(14, 3) not null default 0,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  photo_paths text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku),
  unique (tenant_id, barcode),
  unique (tenant_id, qr_code)
);

create table if not exists public.os_inventory_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null references public.os_inventory_items(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku),
  unique (tenant_id, barcode)
);

create table if not exists public.os_inventory_lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null references public.os_inventory_items(id) on delete cascade,
  variant_id uuid references public.os_inventory_variants(id) on delete set null,
  lot_code text,
  expires_on date,
  received_at timestamptz,
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, item_id, lot_code)
);

create table if not exists public.os_stock_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null references public.os_inventory_items(id) on delete restrict,
  variant_id uuid references public.os_inventory_variants(id) on delete restrict,
  lot_id uuid references public.os_inventory_lots(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('receive', 'consume', 'adjust', 'transfer_in', 'transfer_out', 'expire', 'shrink', 'return')),
  quantity_delta numeric(14, 3) not null check (quantity_delta <> 0),
  unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents >= 0),
  source_type text,
  source_id text,
  idempotency_key text not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists public.os_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid references public.os_inventory_vendors(id) on delete set null,
  order_number text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'partially_received', 'received', 'cancelled')),
  expected_on date,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, order_number)
);

create table if not exists public.os_purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null references public.os_purchase_orders(id) on delete cascade,
  item_id uuid not null references public.os_inventory_items(id) on delete restrict,
  variant_id uuid references public.os_inventory_variants(id) on delete restrict,
  quantity_ordered numeric(14, 3) not null check (quantity_ordered > 0),
  quantity_received numeric(14, 3) not null default 0 check (quantity_received >= 0),
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.os_finance_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entry_group_id uuid not null,
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  direction text not null check (direction in ('debit', 'credit')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  source_type text not null,
  source_id text,
  memo text,
  dimensions jsonb not null default '{}'::jsonb,
  reversal_of uuid references public.os_finance_ledger(id) on delete restrict,
  idempotency_key text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key, account_code, direction)
);

create index if not exists os_finance_ledger_period_idx
  on public.os_finance_ledger (tenant_id, occurred_at, account_type, account_code);
create index if not exists os_finance_ledger_group_idx
  on public.os_finance_ledger (tenant_id, entry_group_id);
create index if not exists os_stock_transactions_item_idx
  on public.os_stock_transactions (tenant_id, item_id, occurred_at);
create index if not exists os_inventory_items_search_idx
  on public.os_inventory_items using gin (tags);

create table if not exists public.os_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_type text not null check (report_type in (
    'inventory_value', 'inventory_turnover', 'expiry', 'shrinkage', 'vendor_spend', 'cost_analysis',
    'profit_and_loss', 'balance_sheet', 'cash_flow', 'general_ledger', 'unit_economics', 'kpi_scorecard',
    'budget_vs_actual', 'board_report', 'custom'
  )),
  period_start date,
  period_end date,
  filters jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function app_private.prevent_os_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Avalon OS ledger and stock entries are append-only; create a reversal instead';
end;
$$;

drop trigger if exists os_finance_ledger_immutable on public.os_finance_ledger;
create trigger os_finance_ledger_immutable
  before update or delete on public.os_finance_ledger
  for each row execute function app_private.prevent_os_append_only_mutation();

drop trigger if exists os_stock_transactions_immutable on public.os_stock_transactions;
create trigger os_stock_transactions_immutable
  before update or delete on public.os_stock_transactions
  for each row execute function app_private.prevent_os_append_only_mutation();

create or replace view public.os_inventory_balances
with (security_invoker = true)
as
select
  i.tenant_id,
  i.id as item_id,
  i.name,
  i.sku,
  i.reorder_point,
  coalesce(sum(t.quantity_delta), 0)::numeric(14, 3) as quantity_on_hand,
  coalesce(sum(t.quantity_delta * coalesce(t.unit_cost_cents, l.unit_cost_cents, 0)), 0)::bigint as inventory_value_cents
from public.os_inventory_items i
left join public.os_stock_transactions t on t.item_id = i.id and t.tenant_id = i.tenant_id
left join public.os_inventory_lots l on l.id = t.lot_id and l.tenant_id = i.tenant_id
where i.archived_at is null
group by i.tenant_id, i.id, i.name, i.sku, i.reorder_point;

create or replace view public.os_financial_statement_lines
with (security_invoker = true)
as
select
  tenant_id,
  date_trunc('month', occurred_at) as period,
  account_type,
  account_code,
  account_name,
  sum(case when direction = 'debit' then amount_cents else -amount_cents end)::bigint as debit_normal_cents
from public.os_finance_ledger
group by tenant_id, date_trunc('month', occurred_at), account_type, account_code, account_name;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'os_inventory_folders', 'os_inventory_vendors', 'os_inventory_items',
    'os_inventory_variants', 'os_inventory_lots', 'os_stock_transactions',
    'os_purchase_orders', 'os_purchase_order_lines', 'os_finance_ledger',
    'os_report_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
    execute format('drop policy if exists "os tenant operator access" on public.%I', tbl);
    execute format(
      'create policy "os tenant operator access" on public.%I for all using (app_private.os_same_tenant(tenant_id) and app_private.is_operator()) with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator())',
      tbl
    );
  end loop;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'os_inventory_folders', 'os_inventory_vendors', 'os_inventory_items',
    'os_inventory_variants', 'os_purchase_orders'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'trg_' || tbl || '_updated_at', tbl);
  end loop;
end $$;

grant select on public.os_inventory_balances, public.os_financial_statement_lines to authenticated, service_role;

comment on table public.os_finance_ledger is 'Immutable double-entry lines. API writes balanced entry groups and reversals.';
comment on table public.os_stock_transactions is 'Immutable stock movement history used to derive quantity and valuation.';
comment on table public.os_report_snapshots is 'Persisted evidence for scheduled, board, inventory, and finance report runs.';
