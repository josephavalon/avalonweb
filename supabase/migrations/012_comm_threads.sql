-- 012_comm_threads.sql
-- Two-way client messaging store for the admin inbox (SMS today, email-ready).
-- Distinct from the in-app `messages` table (which requires a logged-in
-- auth.users sender): patients texting in are not app users, so threads are
-- keyed by their contact (E.164 phone / email), not a user id.
--
-- Written/read by the service-role API only (Quo inbound webhook + the admin
-- communications endpoints), which scope by tenant in JS. RLS is enabled with
-- no public policies so the anon/auth client cannot read PHI here.

create table if not exists public.comm_threads (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid,
  channel              text not null default 'sms' check (channel in ('sms', 'email')),
  contact              text not null,                 -- E.164 phone or email address
  customer_name        text,
  last_message_at      timestamptz,
  last_message_preview text,
  last_direction       text check (last_direction in ('inbound', 'outbound')),
  unread_count         integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (channel, contact)
);

create table if not exists public.comm_messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.comm_threads(id) on delete cascade,
  tenant_id           uuid,
  direction           text not null check (direction in ('inbound', 'outbound')),
  channel             text not null default 'sms',
  body                text not null,
  provider_message_id text,
  sent_by             uuid,                            -- profile/auth id for outbound; null for inbound
  created_at          timestamptz not null default now()
);

create index if not exists comm_messages_thread_idx on public.comm_messages (thread_id, created_at);
create index if not exists comm_threads_recent_idx on public.comm_threads (last_message_at desc nulls last);

alter table public.comm_threads  enable row level security;
alter table public.comm_messages enable row level security;
-- No policies: only the service role (which bypasses RLS) touches these tables.

-- This project grants table privileges explicitly (017 granted service_role on
-- tables that existed then; new tables must grant themselves). Without these the
-- service-role insert fails with 42501 (permission denied).
grant select, insert, update, delete on public.comm_threads  to service_role;
grant select, insert, update, delete on public.comm_messages to service_role;
