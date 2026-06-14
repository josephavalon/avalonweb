-- ─── Avalon OS Messaging ──────────────────────────────────────────────────────
-- Direct messaging between clients, nurses, admins, and staff.
-- Phase 1: direct (1:1) conversations only.
-- Phase 2 (future): appointment-linked group threads.

-- Compatibility foundations used by messaging RLS and later healthcare OS
-- migrations. These are intentionally minimal here so this migration can run
-- before the deeper production-core migration extends the contracts.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client',
  full_name   text,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'draft',
  starts_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Conversations ----------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  type          text not null default 'direct' check (type in ('direct', 'group')),
  appointment_id uuid references public.appointments(id) on delete set null,
  subject       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Participants -----------------------------------------------------------------
create table if not exists public.conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null,       -- 'client' | 'nurse' | 'admin' | 'staff'
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  unique (conversation_id, user_id)
);

-- Messages ---------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);

-- Indexes ----------------------------------------------------------------------
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at      on public.messages(created_at);
create index if not exists idx_cp_user_id               on public.conversation_participants(user_id);
create index if not exists idx_cp_conversation_id       on public.conversation_participants(conversation_id);

-- updated_at trigger -----------------------------------------------------------
create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_new_message_touch_conversation on public.messages;
create trigger on_new_message_touch_conversation
  after insert on public.messages
  for each row execute procedure public.touch_conversation_updated_at();

-- RLS --------------------------------------------------------------------------
alter table public.conversations            enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                 enable row level security;

-- A user can see a conversation only if they are a participant
create policy "participants can view conversation"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
    )
  );

-- A user can see participants list for conversations they belong to
create policy "participants can view participant list"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- A user can see messages in conversations they belong to
create policy "participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- A user can send messages to conversations they belong to
create policy "participants can insert messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- Admins can create conversations and add participants
create policy "admins can create conversations"
  on public.conversations for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'provider')
    )
  );

create policy "admins can insert participants"
  on public.conversation_participants for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'provider')
    )
    or user_id = auth.uid()
  );

-- Mark last_read_at (participants can update their own row)
create policy "participants can update own last_read"
  on public.conversation_participants for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Enable Realtime on messages table -------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
