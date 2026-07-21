-- 021_team_messaging.sql
-- Internal team inbox (admin <-> admin, staff <-> staff — NEVER patients).
--
-- This REPLACES the RLS-gated conversations/messages approach (011/020) for the
-- internal "My inbox" surface. Those tables require a logged-in auth.users sender
-- and a tangle of participant-scoped policies that failed to send. These tables
-- are written/read by the service-role API only (api/admin/team-messages/*),
-- which scopes every query by tenant_id in JS — mirroring comm_threads (012).
--
-- RLS is enabled with NO policies so the anon/auth client cannot read them; only
-- the service role (which bypasses RLS) touches these tables. Recipients always
-- come from the staff/admin roster (team-core) — there is no patient path here.
--
-- Supports 1:1 direct threads AND group threads (subject + 2+ participants),
-- image attachments on messages, message editing, and per-message delete
-- (delete-for-everyone tombstone via team_messages.deleted_at; delete-for-me via
-- the team_message_hidden join table).

create table if not exists public.team_threads (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  subject          text,
  created_by       uuid,                          -- profile/auth id of the starter
  last_message_at  timestamptz,
  last_preview     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.team_thread_participants (
  id                 uuid primary key default gen_random_uuid(),
  thread_id          uuid not null references public.team_threads(id) on delete cascade,
  tenant_id          uuid not null,
  member_profile_id  uuid,                         -- nullable: teammate may not have finished signup
  member_email       text,
  member_name        text,
  last_read_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (thread_id, member_profile_id)
);

create table if not exists public.team_messages (
  id                 uuid primary key default gen_random_uuid(),
  thread_id          uuid not null references public.team_threads(id) on delete cascade,
  tenant_id          uuid not null,
  sender_profile_id  uuid,
  sender_name        text,
  -- Body may be empty when the message carries attachments; cap at 4000 chars.
  body               text not null default '' check (char_length(body) <= 4000),
  attachments        jsonb not null default '[]'::jsonb,  -- [{ url, name, type, width?, height? }]
  status             text not null default 'sent' check (status in ('sent', 'draft', 'scheduled')),
  send_at            timestamptz,                  -- scheduled-send time when status='scheduled'
  edited_at          timestamptz,
  deleted_at         timestamptz,                  -- delete-for-everyone tombstone (row kept)
  created_at         timestamptz not null default now()
);

-- Delete-for-me: a per-member hide. A message with rows here is filtered out for
-- those members only; everyone else still sees it. Cascades with the message.
create table if not exists public.team_message_hidden (
  id                 uuid primary key default gen_random_uuid(),
  message_id         uuid not null references public.team_messages(id) on delete cascade,
  member_profile_id  uuid not null,
  tenant_id          uuid not null,
  created_at         timestamptz not null default now(),
  unique (message_id, member_profile_id)
);

create index if not exists team_messages_thread_idx       on public.team_messages (thread_id, created_at);
create index if not exists team_threads_recent_idx        on public.team_threads (tenant_id, last_message_at desc);
create index if not exists team_participants_member_idx   on public.team_thread_participants (tenant_id, member_profile_id);
create index if not exists team_participants_thread_idx   on public.team_thread_participants (thread_id);
create index if not exists team_messages_due_idx          on public.team_messages (status, send_at);
create index if not exists team_message_hidden_member_idx on public.team_message_hidden (tenant_id, member_profile_id);
create index if not exists team_message_hidden_msg_idx    on public.team_message_hidden (message_id);

alter table public.team_threads             enable row level security;
alter table public.team_thread_participants enable row level security;
alter table public.team_messages            enable row level security;
alter table public.team_message_hidden      enable row level security;
-- No policies: only the service role (which bypasses RLS) touches these tables.

-- New tables must grant the service role explicitly (017 only covered tables that
-- existed then). Without these the service-role insert fails with 42501.
grant select, insert, update, delete on public.team_threads             to service_role;
grant select, insert, update, delete on public.team_thread_participants to service_role;
grant select, insert, update, delete on public.team_messages            to service_role;
grant select, insert, update, delete on public.team_message_hidden      to service_role;

-- Storage bucket for inbox image attachments. Private; the API hands out signed
-- URLs via the service-role client. Created here so the migration is the single
-- source of truth handed to the user. (Safe to run repeatedly.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-inbox',
  'team-inbox',
  false,
  10485760,                                        -- 10 MB
  array['image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif']
)
on conflict (id) do nothing;
