-- 033_support_tickets.sql
-- Public customer support tickets. The public /support form POSTs to
-- /api/support, which stores the full ticket here (Supabase is BAA-covered) and
-- emails support@ only a PHI-FREE notification (id + metadata + admin link). The
-- free-text `message` may contain PHI and must NEVER ride the un-BAA'd email
-- channel — admin reads the body from /admin/support-tickets. Idempotent.

create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  category        text,                         -- enum-checked in API (billing/booking/general/other)
  subject         text,
  message         text not null,                -- may contain PHI → BAA-covered store ONLY
  is_anonymous    boolean not null default false,
  name            text,                         -- null when anonymous
  email           text,                         -- null when anonymous
  source_ip       text,
  status          text not null default 'open', -- open | resolved
  resolved_at     timestamptz,
  resolver_id     uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at      timestamptz not null default now()
);

create index if not exists support_tickets_tenant_status_idx
  on public.support_tickets (tenant_id, status, created_at desc);

alter table public.support_tickets enable row level security;
grant select, insert, update, delete on public.support_tickets to service_role;

comment on table public.support_tickets is
  'Public customer support tickets. Public /api/support inserts the full body here; support@ gets a PHI-free notification only; /admin/support-tickets reads/moderates. message may contain PHI — BAA-covered store only.';
