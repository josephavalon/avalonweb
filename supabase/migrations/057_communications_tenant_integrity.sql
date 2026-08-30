-- Tenant integrity for the service-role communications store.
--
-- Existing null-tenant or mismatched rows are intentionally not guessed,
-- deleted, or backfilled here. NOT VALID constraints protect every new/changed
-- row immediately while leaving historical exceptions available for an
-- explicit ownership inventory and reviewed reconciliation before validation.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comm_threads_tenant_id_required'
      and conrelid = 'public.comm_threads'::regclass
  ) then
    alter table public.comm_threads
      add constraint comm_threads_tenant_id_required
      check (tenant_id is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'comm_messages_tenant_id_required'
      and conrelid = 'public.comm_messages'::regclass
  ) then
    alter table public.comm_messages
      add constraint comm_messages_tenant_id_required
      check (tenant_id is not null) not valid;
  end if;
end $$;

-- The same contact may legitimately exist in separate tenants. The partial
-- index excludes only unreconciled historical null-tenant rows; the check above
-- prevents any new null-tenant thread from being inserted or updated.
create unique index if not exists comm_threads_tenant_channel_contact_uidx
  on public.comm_threads (tenant_id, channel, contact)
  where tenant_id is not null;

-- Retire the original global uniqueness rule only after the tenant-scoped rule
-- exists. Migration 012 created this as a table constraint with this name; the
-- index drop also handles an environment where it drifted into a plain index.
alter table public.comm_threads
  drop constraint if exists comm_threads_channel_contact_key;
drop index if exists public.comm_threads_channel_contact_key;

-- PostgreSQL requires the referenced column set itself to be unique before a
-- composite foreign key can target it. `id` is already the primary key, so this
-- adds no data-risk while making the tenant relationship explicit.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comm_threads_id_tenant_id_key'
      and conrelid = 'public.comm_threads'::regclass
  ) then
    alter table public.comm_threads
      add constraint comm_threads_id_tenant_id_key unique (id, tenant_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comm_messages_thread_tenant_fkey'
      and conrelid = 'public.comm_messages'::regclass
  ) then
    alter table public.comm_messages
      add constraint comm_messages_thread_tenant_fkey
      foreign key (thread_id, tenant_id)
      references public.comm_threads (id, tenant_id)
      on delete cascade
      not valid;
  end if;
end $$;

create index if not exists comm_threads_tenant_recent_idx
  on public.comm_threads (tenant_id, last_message_at desc nulls last);

create index if not exists comm_messages_tenant_thread_idx
  on public.comm_messages (tenant_id, thread_id, created_at);

comment on constraint comm_threads_tenant_id_required on public.comm_threads is
  'New and changed communication threads require an owning tenant; validate after historical null rows are explicitly reconciled.';

comment on constraint comm_messages_tenant_id_required on public.comm_messages is
  'New and changed communication messages require an owning tenant; validate after historical null rows are explicitly reconciled.';

comment on constraint comm_messages_thread_tenant_fkey on public.comm_messages is
  'A communication message must belong to a thread in the same tenant; historical rows remain pending explicit validation.';
