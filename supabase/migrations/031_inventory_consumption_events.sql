-- 031_inventory_consumption_events.sql
-- Idempotency ledger for inventory burndown on visit completion. The Acuity
-- webhook calls decrementForAppointment after the appointment start time has
-- passed; this table's UNIQUE (appointment_id) prevents double-decrement on
-- webhook re-fires. Idempotent.

create table if not exists public.inventory_consumption_events (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments(id) on delete cascade,
  tenant_id       uuid references public.tenants(id),
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_inventory_consumption_events_tenant
  on public.inventory_consumption_events (tenant_id, created_at desc);

alter table public.inventory_consumption_events enable row level security;
grant select, insert, update, delete on public.inventory_consumption_events to service_role;
