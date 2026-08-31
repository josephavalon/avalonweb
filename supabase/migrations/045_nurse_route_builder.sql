-- Nurse assignment + fixed-appointment route builder.
-- GPS samples are intentionally absent: foreground coordinates remain in memory.

create table if not exists public.provider_route_origins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_profile_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('home', 'office')),
  label text not null,
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'office' and owner_profile_id is null) or (kind = 'home' and owner_profile_id is not null))
);

create table if not exists public.provider_route_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  route_date date not null,
  origin_kind text not null check (origin_kind in ('home', 'office', 'current', 'manual')),
  origin_id uuid references public.provider_route_origins(id) on delete set null,
  origin_label text not null,
  origin_address text,
  origin_latitude double precision,
  origin_longitude double precision,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  assignment_revision timestamptz not null default now(),
  acknowledged_revision timestamptz,
  active_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_profile_id, route_date),
  check ((origin_latitude is null and origin_longitude is null) or (origin_latitude between -90 and 90 and origin_longitude between -180 and 180)),
  check (origin_kind <> 'current' or (origin_latitude is null and origin_longitude is null))
);

create table if not exists public.provider_route_day_stops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_day_id uuid not null references public.provider_route_days(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  assigned_provider_profile_id uuid not null references public.provider_profiles(id) on delete cascade,
  selected boolean not null default true,
  omission_reason text check (omission_reason in ('timing_conflict', 'unavailable', 'duplicate_cancelled', 'admin_review', 'other')),
  omission_note text,
  assignment_snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_day_id, appointment_id),
  check (selected or omission_reason is not null),
  check (omission_reason <> 'other' or nullif(trim(omission_note), '') is not null)
);

create index if not exists idx_provider_route_origins_owner on public.provider_route_origins(owner_profile_id, kind);
create unique index if not exists idx_provider_route_origins_unique_home on public.provider_route_origins(owner_profile_id, kind) where owner_profile_id is not null;
create index if not exists idx_provider_route_days_provider_date on public.provider_route_days(provider_profile_id, route_date);
create index if not exists idx_provider_route_stops_day on public.provider_route_day_stops(route_day_id, appointment_id);

drop trigger if exists trg_provider_route_origins_updated_at on public.provider_route_origins;
create trigger trg_provider_route_origins_updated_at before update on public.provider_route_origins
for each row execute function public.touch_updated_at();
drop trigger if exists trg_provider_route_days_updated_at on public.provider_route_days;
create trigger trg_provider_route_days_updated_at before update on public.provider_route_days
for each row execute function public.touch_updated_at();
drop trigger if exists trg_provider_route_day_stops_updated_at on public.provider_route_day_stops;
create trigger trg_provider_route_day_stops_updated_at before update on public.provider_route_day_stops
for each row execute function public.touch_updated_at();

alter table public.provider_route_origins enable row level security;
alter table public.provider_route_days enable row level security;
alter table public.provider_route_day_stops enable row level security;

create policy "route origins tenant operator access" on public.provider_route_origins
for all using (app_private.same_tenant(tenant_id) and app_private.is_operator())
with check (app_private.same_tenant(tenant_id) and app_private.is_operator());
create policy "providers see own home and office origins" on public.provider_route_origins
for select using (
  app_private.same_tenant(tenant_id)
  and app_private.is_provider()
  and (kind = 'office' or owner_profile_id = auth.uid())
);
create policy "providers manage own home origins" on public.provider_route_origins
for all using (app_private.same_tenant(tenant_id) and app_private.is_provider() and kind = 'home' and owner_profile_id = auth.uid())
with check (app_private.same_tenant(tenant_id) and app_private.is_provider() and kind = 'home' and owner_profile_id = auth.uid());

create policy "route days tenant operator access" on public.provider_route_days
for all using (app_private.same_tenant(tenant_id) and app_private.is_operator())
with check (app_private.same_tenant(tenant_id) and app_private.is_operator());
create policy "providers manage own route days" on public.provider_route_days
for all using (
  app_private.same_tenant(tenant_id)
  and exists (select 1 from public.provider_profiles pp where pp.id = provider_profile_id and pp.profile_id = auth.uid() and pp.active)
) with check (
  app_private.same_tenant(tenant_id)
  and exists (select 1 from public.provider_profiles pp where pp.id = provider_profile_id and pp.profile_id = auth.uid() and pp.active)
);

create policy "route stops tenant operator access" on public.provider_route_day_stops
for all using (app_private.same_tenant(tenant_id) and app_private.is_operator())
with check (app_private.same_tenant(tenant_id) and app_private.is_operator());
create policy "providers manage own route stops" on public.provider_route_day_stops
for all using (
  app_private.same_tenant(tenant_id)
  and exists (
    select 1 from public.provider_route_days rd
    join public.provider_profiles pp on pp.id = rd.provider_profile_id
    where rd.id = route_day_id and pp.profile_id = auth.uid() and pp.active
  )
) with check (
  app_private.same_tenant(tenant_id)
  and exists (
    select 1 from public.provider_route_days rd
    join public.provider_profiles pp on pp.id = rd.provider_profile_id
    where rd.id = route_day_id and pp.profile_id = auth.uid() and pp.active
  )
);

revoke all on public.provider_route_origins, public.provider_route_days, public.provider_route_day_stops from anon;
grant select, insert, update, delete on public.provider_route_origins, public.provider_route_days, public.provider_route_day_stops to authenticated, service_role;
