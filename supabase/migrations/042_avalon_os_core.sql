-- Avalon OS protected-beta foundation.
-- Generic capability records back the remaining admin workflows while the
-- existing typed booking, event, wallet, messaging, and inventory tables stay
-- authoritative for their domains. All rows are tenant-scoped and synthetic
-- in beta; integration credentials remain in server environment variables.

create or replace function app_private.os_same_tenant(row_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select row_tenant_id = app_private.profile_tenant_id();
$$;

revoke all on function app_private.os_same_tenant(uuid) from public;
grant execute on function app_private.os_same_tenant(uuid) to authenticated, service_role;

create table if not exists public.os_capability_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  capability text not null,
  record_type text not null default 'record',
  title text not null,
  status text not null default 'active',
  amount_cents bigint,
  effective_at timestamptz,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_capability_records_slug_check check (capability ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint os_capability_records_status_check check (char_length(status) between 1 and 64),
  constraint os_capability_records_title_check check (char_length(title) between 1 and 240)
);

create index if not exists os_capability_records_lookup_idx
  on public.os_capability_records (tenant_id, capability, archived_at, updated_at desc);
create index if not exists os_capability_records_status_idx
  on public.os_capability_records (tenant_id, capability, status, effective_at);
create index if not exists os_capability_records_assignee_idx
  on public.os_capability_records (assigned_profile_id, status) where archived_at is null;

create table if not exists public.os_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  namespace text not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, namespace, key)
);

create table if not exists public.os_saved_filters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null,
  name text not null check (char_length(name) between 1 and 100),
  filter jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists os_saved_filters_default_idx
  on public.os_saved_filters (owner_profile_id, capability) where is_default;

create table if not exists public.os_integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  mode text not null default 'manual' check (mode in ('sandbox', 'manual', 'disabled')),
  status text not null default 'action_required'
    check (status in ('healthy', 'degraded', 'action_required', 'disconnected')),
  config jsonb not null default '{}'::jsonb,
  last_health_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table if not exists public.os_integration_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid references public.os_integration_connections(id) on delete set null,
  provider text not null,
  operation text not null check (operation in ('health', 'import', 'export', 'sync', 'retry', 'disconnect')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'action_required')),
  idempotency_key text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (tenant_id, idempotency_key)
);

create index if not exists os_integration_jobs_queue_idx
  on public.os_integration_jobs (tenant_id, status, created_at);

create table if not exists public.os_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete cascade,
  route text not null,
  key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (tenant_id, route, key)
);

create index if not exists os_idempotency_expiry_idx on public.os_idempotency_keys (expires_at);

create table if not exists public.os_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  capability text not null,
  record_id uuid not null references public.os_capability_records(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 20971520),
  checksum_sha256 text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, storage_path)
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('avalon-os-beta', 'avalon-os-beta', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'os_capability_records', 'os_settings', 'os_saved_filters',
    'os_integration_connections', 'os_integration_jobs',
    'os_idempotency_keys', 'os_attachments'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
  end loop;
end $$;

drop policy if exists "os records operator access" on public.os_capability_records;
create policy "os records operator access" on public.os_capability_records for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "os settings operator access" on public.os_settings;
create policy "os settings operator access" on public.os_settings for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "os saved filters owner access" on public.os_saved_filters;
create policy "os saved filters owner access" on public.os_saved_filters for all
  using (app_private.os_same_tenant(tenant_id) and owner_profile_id = auth.uid())
  with check (app_private.os_same_tenant(tenant_id) and owner_profile_id = auth.uid());

drop policy if exists "os connections operator access" on public.os_integration_connections;
create policy "os connections operator access" on public.os_integration_connections for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "os jobs operator access" on public.os_integration_jobs;
create policy "os jobs operator access" on public.os_integration_jobs for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "os idempotency actor read" on public.os_idempotency_keys;
create policy "os idempotency actor read" on public.os_idempotency_keys for select
  using (app_private.os_same_tenant(tenant_id) and actor_profile_id = auth.uid());

drop policy if exists "os attachments operator access" on public.os_attachments;
create policy "os attachments operator access" on public.os_attachments for all
  using (app_private.os_same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.os_same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "os attachment storage operator read" on storage.objects;
create policy "os attachment storage operator read" on storage.objects for select
  using (
    bucket_id = 'avalon-os-beta'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and app_private.os_same_tenant(((storage.foldername(name))[1])::uuid)
    and app_private.is_operator()
  );

drop policy if exists "os attachment storage operator write" on storage.objects;
create policy "os attachment storage operator write" on storage.objects for insert
  with check (
    bucket_id = 'avalon-os-beta'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and app_private.os_same_tenant(((storage.foldername(name))[1])::uuid)
    and app_private.is_operator()
  );

drop policy if exists "os attachment storage operator update" on storage.objects;
create policy "os attachment storage operator update" on storage.objects for update
  using (
    bucket_id = 'avalon-os-beta'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and app_private.os_same_tenant(((storage.foldername(name))[1])::uuid)
    and app_private.is_operator()
  )
  with check (
    bucket_id = 'avalon-os-beta'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and app_private.os_same_tenant(((storage.foldername(name))[1])::uuid)
    and app_private.is_operator()
  );

drop policy if exists "os attachment storage operator delete" on storage.objects;
create policy "os attachment storage operator delete" on storage.objects for delete
  using (
    bucket_id = 'avalon-os-beta'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and app_private.os_same_tenant(((storage.foldername(name))[1])::uuid)
    and app_private.is_operator()
  );

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'os_capability_records', 'os_settings', 'os_saved_filters', 'os_integration_connections'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'trg_' || tbl || '_updated_at', tbl);
  end loop;
end $$;

comment on table public.os_capability_records is 'Tenant-scoped persisted workflow records for Avalon OS beta capabilities.';
comment on table public.os_integration_connections is 'Provider configuration metadata only; credentials remain in server environment variables.';
comment on table public.os_integration_jobs is 'Auditable adapter operations and manual import/export jobs with idempotency.';
