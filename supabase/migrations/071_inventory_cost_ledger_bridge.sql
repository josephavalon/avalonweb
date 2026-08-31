-- Supplies and inventory cost bridge.
--
-- The typed Avalon OS inventory tables remain the operational source for
-- quantities, lots, purchase orders, and immutable stock movements. Finance
-- never reads the legacy browser-written `items.price/qty` inventory as book
-- evidence. This migration snapshots a reviewed stock movement into an
-- append-only cost event and prepares a balanced journal in the controlled
-- Avalon ledger. Posting still requires a separate accountant/controller.

do $$
begin
  if to_regclass('public.os_inventory_items') is null
     or to_regclass('public.os_inventory_variants') is null
     or to_regclass('public.os_inventory_lots') is null
     or to_regclass('public.os_stock_transactions') is null
     or to_regclass('public.os_purchase_orders') is null
     or to_regclass('public.ledger_journals') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('extensions.digest(text,text)') is null
     or to_regprocedure('public.prepare_ledger_journal(uuid,uuid,uuid,uuid,text,uuid,integer,text,date,text,jsonb,text)') is null
     or to_regprocedure('app_private.assert_payops_actor_role(uuid,uuid,text[])') is null then
    raise exception using errcode = 'P0001', message = 'inventory_and_payops_migrations_required';
  end if;
end $$;

-- Composite uniqueness allows tenant-safe references without changing the
-- operational tables' existing primary keys.
create unique index if not exists os_inventory_items_tenant_id_id_uidx
  on public.os_inventory_items (tenant_id, id);
create unique index if not exists os_inventory_lots_tenant_id_id_uidx
  on public.os_inventory_lots (tenant_id, id);
create unique index if not exists os_inventory_variants_tenant_id_id_uidx
  on public.os_inventory_variants (tenant_id, id);
create unique index if not exists os_stock_transactions_tenant_id_id_uidx
  on public.os_stock_transactions (tenant_id, id);
create unique index if not exists os_purchase_orders_tenant_id_id_uidx
  on public.os_purchase_orders (tenant_id, id);

create table if not exists public.inventory_cost_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legal_entity_id uuid not null,
  stock_transaction_id uuid not null,
  inventory_item_id uuid not null,
  inventory_variant_id uuid,
  inventory_lot_id uuid,
  purchase_order_id uuid,
  cost_event_type text not null check (cost_event_type in (
    'RECEIPT', 'CONSUMPTION', 'EXPIRY', 'SHRINKAGE',
    'RETURN_TO_VENDOR', 'ADJUSTMENT_GAIN', 'ADJUSTMENT_LOSS'
  )),
  quantity_abs numeric(14, 3) not null check (quantity_abs > 0),
  unit_cost_cents bigint not null check (unit_cost_cents > 0),
  total_cost_cents bigint not null check (total_cost_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  posting_date date not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  ledger_journal_id uuid not null,
  request_idempotency_key text not null
    check (request_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  prepared_by uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint inventory_cost_events_entity_fk foreign key (tenant_id, legal_entity_id)
    references public.legal_entities(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_stock_fk foreign key (tenant_id, stock_transaction_id)
    references public.os_stock_transactions(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_item_fk foreign key (tenant_id, inventory_item_id)
    references public.os_inventory_items(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_variant_fk foreign key (tenant_id, inventory_variant_id)
    references public.os_inventory_variants(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_lot_fk foreign key (tenant_id, inventory_lot_id)
    references public.os_inventory_lots(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_po_fk foreign key (tenant_id, purchase_order_id)
    references public.os_purchase_orders(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_journal_fk foreign key (tenant_id, ledger_journal_id)
    references public.ledger_journals(tenant_id, id) on delete restrict,
  constraint inventory_cost_events_preparer_fk foreign key (tenant_id, prepared_by)
    references public.profiles(tenant_id, id) on delete restrict,
  unique (tenant_id, stock_transaction_id),
  unique (tenant_id, request_idempotency_key),
  unique (tenant_id, ledger_journal_id),
  unique (tenant_id, id)
);

create index if not exists inventory_cost_events_period_idx
  on public.inventory_cost_events (tenant_id, legal_entity_id, posting_date desc, cost_event_type);
create index if not exists inventory_cost_events_item_idx
  on public.inventory_cost_events (tenant_id, inventory_item_id, posting_date desc);

create or replace function app_private.prevent_inventory_cost_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'inventory_cost_event_immutable';
end;
$$;

revoke all on function app_private.prevent_inventory_cost_event_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists inventory_cost_events_immutable on public.inventory_cost_events;
create trigger inventory_cost_events_immutable
  before update or delete on public.inventory_cost_events
  for each row execute function app_private.prevent_inventory_cost_event_mutation();

alter table public.inventory_cost_events enable row level security;
revoke all on public.inventory_cost_events from public, anon, authenticated, service_role;
grant select on public.inventory_cost_events to service_role;

create or replace view public.inventory_cost_event_status
with (security_invoker = true)
as
select
  event.id,
  event.tenant_id,
  event.legal_entity_id,
  event.stock_transaction_id,
  event.inventory_item_id,
  event.inventory_variant_id,
  event.inventory_lot_id,
  event.purchase_order_id,
  event.cost_event_type,
  event.quantity_abs,
  event.unit_cost_cents,
  event.total_cost_cents,
  event.currency,
  event.posting_date,
  event.source_hash,
  event.ledger_journal_id,
  journal.status as journal_status,
  journal.prepared_by,
  journal.approved_by,
  journal.posted_at,
  journal.reversed_by_journal_id,
  event.version,
  event.created_at
from public.inventory_cost_events event
join public.ledger_journals journal
  on journal.tenant_id = event.tenant_id and journal.id = event.ledger_journal_id;

revoke all on public.inventory_cost_event_status
  from public, anon, authenticated, service_role;
grant select on public.inventory_cost_event_status to service_role;

create or replace function public.prepare_inventory_cost_event(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_stock_transaction_id uuid,
  p_legal_entity_id uuid,
  p_chart_version_id uuid,
  p_debit_account_id uuid,
  p_credit_account_id uuid,
  p_posting_date date,
  p_currency text,
  p_idempotency_key text
)
returns public.inventory_cost_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.os_stock_transactions%rowtype;
  v_item public.os_inventory_items%rowtype;
  v_variant public.os_inventory_variants%rowtype;
  v_lot public.os_inventory_lots%rowtype;
  v_debit public.ledger_accounts%rowtype;
  v_credit public.ledger_accounts%rowtype;
  v_journal public.ledger_journals%rowtype;
  v_existing public.inventory_cost_events%rowtype;
  v_event public.inventory_cost_events%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_event_type text;
  v_memo_code text;
  v_unit_cost bigint;
  v_total_cost bigint;
  v_quantity numeric(14, 3);
  v_effective_variant_id uuid;
  v_source_hash text;
  v_request_hash text;
  v_purchase_order_id uuid;
  v_entries jsonb;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_stock_transaction_id is null
     or p_legal_entity_id is null
     or p_chart_version_id is null
     or p_debit_account_id is null
     or p_credit_account_id is null
     or p_posting_date is null
     or coalesce(p_currency, '') !~ '^[A-Z]{3}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'inventory_cost_request_invalid';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'actor_profile_id', p_actor_profile_id,
    'stock_transaction_id', p_stock_transaction_id,
    'legal_entity_id', p_legal_entity_id,
    'chart_version_id', p_chart_version_id,
    'debit_account_id', p_debit_account_id,
    'credit_account_id', p_credit_account_id,
    'posting_date', p_posting_date,
    'currency', p_currency
  )::text, 'sha256'), 'hex');

  -- Serialize retries before reading or creating either the cost event or its
  -- prepared journal. The unique constraints remain the final backstop, while
  -- this lock makes a concurrent replay return the original evidence instead
  -- of surfacing a transient uniqueness failure.
  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_cost_event:' || p_tenant_id::text || ':' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.inventory_cost_events event
  where event.tenant_id = p_tenant_id
    and event.request_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.stock_transaction_id <> p_stock_transaction_id
       or v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_existing;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'inventory_cost_stock_transaction:' || p_tenant_id::text || ':' || p_stock_transaction_id::text,
    0
  ));
  select * into v_existing
  from public.inventory_cost_events event
  where event.tenant_id = p_tenant_id
    and event.stock_transaction_id = p_stock_transaction_id;
  if found then
    raise exception using errcode = 'P0001', message = 'inventory_cost_event_already_prepared';
  end if;

  select * into v_transaction
  from public.os_stock_transactions movement
  where movement.tenant_id = p_tenant_id and movement.id = p_stock_transaction_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_stock_transaction_not_found';
  end if;
  select * into v_item
  from public.os_inventory_items item
  where item.tenant_id = p_tenant_id and item.id = v_transaction.item_id;
  if not found or v_item.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'inventory_item_not_finance_ready';
  end if;

  if v_transaction.variant_id is not null then
    select * into v_variant
    from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = v_transaction.variant_id
      and variant.item_id = v_transaction.item_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'inventory_variant_context_invalid';
    end if;
  end if;
  if v_transaction.lot_id is not null then
    select * into v_lot
    from public.os_inventory_lots lot
    where lot.tenant_id = p_tenant_id
      and lot.id = v_transaction.lot_id
      and lot.item_id = v_transaction.item_id
      and (v_transaction.variant_id is null or lot.variant_id = v_transaction.variant_id);
    if not found then
      raise exception using errcode = 'P0001', message = 'inventory_lot_context_invalid';
    end if;
  end if;
  if v_transaction.variant_id is null and v_lot.variant_id is not null then
    select * into v_variant
    from public.os_inventory_variants variant
    where variant.tenant_id = p_tenant_id
      and variant.id = v_lot.variant_id
      and variant.item_id = v_transaction.item_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'inventory_lot_variant_context_invalid';
    end if;
  end if;

  v_effective_variant_id := coalesce(v_transaction.variant_id, v_lot.variant_id);

  v_quantity := abs(v_transaction.quantity_delta);
  -- A lot is the acquisition-cost boundary. Never infer finance value from a
  -- legacy movement snapshot when there is no lot, and never let a mutable
  -- "latest movement" convention override the durable lot/variant cost.
  v_unit_cost := case when v_transaction.lot_id is not null then coalesce(
    nullif(v_lot.unit_cost_cents, 0),
    nullif(v_variant.unit_cost_cents, 0),
    0
  ) else 0 end;
  v_total_cost := round(v_quantity * v_unit_cost)::bigint;
  if v_unit_cost <= 0 or v_total_cost <= 0 then
    raise exception using errcode = 'P0001', message = 'inventory_cost_snapshot_required';
  end if;
  if nullif(v_transaction.unit_cost_cents, 0) is not null
     and v_transaction.unit_cost_cents <> v_unit_cost then
    raise exception using errcode = 'P0001', message = 'inventory_cost_snapshot_mismatch';
  end if;

  case v_transaction.transaction_type
    when 'receive' then
      if v_transaction.quantity_delta <= 0 then
        raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
      end if;
      v_event_type := 'RECEIPT'; v_memo_code := 'INVENTORY_RECEIPT';
    when 'consume' then
      if v_transaction.quantity_delta >= 0 then
        raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
      end if;
      v_event_type := 'CONSUMPTION'; v_memo_code := 'INVENTORY_CONSUMED';
    when 'expire' then
      if v_transaction.quantity_delta >= 0 then
        raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
      end if;
      v_event_type := 'EXPIRY'; v_memo_code := 'INVENTORY_EXPIRED';
    when 'shrink' then
      if v_transaction.quantity_delta >= 0 then
        raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
      end if;
      v_event_type := 'SHRINKAGE'; v_memo_code := 'INVENTORY_SHRINKAGE';
    when 'return' then
      if v_transaction.quantity_delta >= 0 then
        raise exception using errcode = 'P0001', message = 'inventory_movement_direction_invalid';
      end if;
      v_event_type := 'RETURN_TO_VENDOR'; v_memo_code := 'INVENTORY_VENDOR_RETURN';
    when 'adjust' then
      if v_transaction.quantity_delta > 0 then
        v_event_type := 'ADJUSTMENT_GAIN'; v_memo_code := 'INVENTORY_COUNT_GAIN';
      else
        v_event_type := 'ADJUSTMENT_LOSS'; v_memo_code := 'INVENTORY_COUNT_LOSS';
      end if;
    else
      raise exception using errcode = 'P0001', message = 'inventory_transfer_requires_entity_workflow';
  end case;

  select * into v_debit
  from public.ledger_accounts account
  where account.tenant_id = p_tenant_id and account.id = p_debit_account_id
    and account.legal_entity_id = p_legal_entity_id
    and account.chart_version_id = p_chart_version_id and account.active;
  select * into v_credit
  from public.ledger_accounts account
  where account.tenant_id = p_tenant_id and account.id = p_credit_account_id
    and account.legal_entity_id = p_legal_entity_id
    and account.chart_version_id = p_chart_version_id and account.active;
  if v_debit.id is null or v_credit.id is null or v_debit.id = v_credit.id then
    raise exception using errcode = 'P0001', message = 'inventory_cost_account_context_invalid';
  end if;
  if v_event_type = 'RECEIPT' and (
       v_debit.account_type <> 'ASSET'
       or v_credit.account_type not in ('LIABILITY', 'CLEARING', 'ASSET')
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_receipt_account_mapping_invalid';
  elsif v_event_type in ('CONSUMPTION', 'EXPIRY', 'SHRINKAGE', 'ADJUSTMENT_LOSS') and (
       v_debit.account_type <> 'EXPENSE' or v_credit.account_type <> 'ASSET'
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_expense_account_mapping_invalid';
  elsif v_event_type = 'RETURN_TO_VENDOR' and (
       v_debit.account_type not in ('ASSET', 'LIABILITY', 'CLEARING')
       or v_credit.account_type <> 'ASSET'
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_return_account_mapping_invalid';
  elsif v_event_type = 'ADJUSTMENT_GAIN' and (
       v_debit.account_type <> 'ASSET'
       or v_credit.account_type not in ('EXPENSE', 'REVENUE', 'CLEARING')
     ) then
    raise exception using errcode = 'P0001', message = 'inventory_gain_account_mapping_invalid';
  end if;

  if lower(coalesce(v_transaction.source_type, '')) in ('purchase_order', 'po') then
    if v_transaction.transaction_type <> 'receive'
       or coalesce(v_transaction.source_id, '') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode = 'P0001', message = 'inventory_purchase_order_source_invalid';
    end if;
    -- Cast only after the complete UUID syntax check. Keeping the cast in a
    -- separate PL/pgSQL branch avoids relying on SQL boolean evaluation order.
    v_purchase_order_id := v_transaction.source_id::uuid;
    if not exists (
      select 1 from public.os_purchase_orders purchase_order
      where purchase_order.tenant_id = p_tenant_id
        and purchase_order.id = v_purchase_order_id
    ) then
      raise exception using errcode = 'P0001', message = 'inventory_purchase_order_source_invalid';
    end if;
  end if;

  v_source_hash := encode(extensions.digest(jsonb_build_object(
    'stock_transaction_id', v_transaction.id,
    'inventory_item_id', v_transaction.item_id,
    'inventory_variant_id', v_effective_variant_id,
    'inventory_lot_id', v_transaction.lot_id,
    'transaction_type', v_transaction.transaction_type,
    'quantity_delta', v_transaction.quantity_delta,
    'unit_cost_cents', v_unit_cost,
    'total_cost_cents', v_total_cost,
    'from_location_id', to_jsonb(v_transaction)->'from_location_id',
    'to_location_id', to_jsonb(v_transaction)->'to_location_id',
    'occurred_at', v_transaction.occurred_at,
    'purchase_order_id', v_purchase_order_id
  )::text, 'sha256'), 'hex');
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'accountId', p_debit_account_id::text,
      'side', 'DEBIT',
      'amountCents', v_total_cost::text,
      'memoCode', v_memo_code
    ),
    jsonb_build_object(
      'accountId', p_credit_account_id::text,
      'side', 'CREDIT',
      'amountCents', v_total_cost::text,
      'memoCode', v_memo_code
    )
  );

  select * into v_journal
  from public.prepare_ledger_journal(
    p_tenant_id,
    p_actor_profile_id,
    p_legal_entity_id,
    p_chart_version_id,
    'INVENTORY_COST',
    v_event_id,
    1,
    v_source_hash,
    p_posting_date,
    p_currency,
    v_entries,
    p_idempotency_key
  );

  insert into public.inventory_cost_events (
    id, tenant_id, legal_entity_id, stock_transaction_id, inventory_item_id,
    inventory_variant_id, inventory_lot_id, purchase_order_id,
    cost_event_type, quantity_abs, unit_cost_cents, total_cost_cents,
    currency, posting_date, source_hash, ledger_journal_id,
    request_idempotency_key, request_hash, prepared_by
  ) values (
    v_event_id, p_tenant_id, p_legal_entity_id, v_transaction.id,
    v_transaction.item_id, v_effective_variant_id, v_transaction.lot_id,
    v_purchase_order_id, v_event_type, v_quantity, v_unit_cost,
    v_total_cost, p_currency, p_posting_date, v_source_hash, v_journal.id,
    p_idempotency_key, v_request_hash, p_actor_profile_id
  ) returning * into v_event;

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'inventory_cost_event_prepared',
    'inventory_cost_events', v_event.id, false, v_source_hash,
    jsonb_build_object(
      'cost_event_type', v_event_type,
      'stock_transaction_id', v_transaction.id,
      'inventory_item_id', v_transaction.item_id,
      'total_cost_cents', v_total_cost,
      'currency', p_currency,
      'ledger_journal_id', v_journal.id
    )
  );
  return v_event;
end;
$$;

revoke all on function public.prepare_inventory_cost_event(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_inventory_cost_event(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, text)
  to service_role;

comment on table public.inventory_cost_events is
  'Append-only finance snapshots of reviewed typed inventory movements. Contains no appointment, patient, service, protocol, or treatment data.';
comment on view public.inventory_cost_event_status is
  'Inventory cost events joined to controlled ledger journal state; POSTED is the accounting proof boundary.';
