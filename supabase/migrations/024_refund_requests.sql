-- 024_refund_requests.sql
-- Self-serve refund REQUESTS (never auto-refund). api/me/refund-request.js writes
-- a row here + an audit event; staff action it. The endpoint degrades to the
-- audit event alone if this table is absent, so applying this is what enables the
-- durable row + duplicate-open-request rejection. Idempotent.

create table if not exists public.refund_requests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  profile_id     uuid references public.profiles(id),
  reason         text not null,
  status         text not null default 'requested',
  created_at     timestamptz not null default now()
);

create index if not exists refund_requests_appointment_idx
  on public.refund_requests (appointment_id, status);
create index if not exists refund_requests_tenant_idx
  on public.refund_requests (tenant_id);

-- Service-role (the API) bypasses RLS. Operators read via is_operator() like
-- other staffed tables.
alter table public.refund_requests enable row level security;
grant select, insert, update, delete on public.refund_requests to service_role;
