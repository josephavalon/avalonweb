-- 034_events_platform_core.sql
-- Events platform core (blueprint v1.5, eng-reviewed 2026-07-05).
--
-- PHI POSTURE (the law of this schema): events tables store POINTERS AND
-- STATUS ENUMS ONLY. GFE intake content lives in Acuity (or Qualiphy) under
-- their BAAs; `gfe_acuity_appt_id` / `gfe_qualiphy_ref` are the pointers.
-- Flag categories are pulled from the chart vendor at render time and are
-- deliberately NOT stored here. `event_applications.answers` is restricted to
-- non-medical admit questions by the form config — never add health fields.
-- (`profiles.phi` exists platform-wide from migration 019 and is governed
-- separately; the events invariant is scoped to the tables in this file.)
--
-- Scaling groundwork ("Avalon Disneyland", amendment H, trimmed per T9):
-- service_providers row #1 = Avalon; service_class enum covers flow/express
-- today and session/amenity later. NO document/contract/waiver-lifecycle
-- tables in this migration — those land with the phase that uses them.
--
-- Idempotent. All tables tenant-scoped per the 003 convention.

-- ---------------------------------------------------------------------------
-- 0. profiles.role CHECK constraint (eng review finding 3A — the column has
--    been an unconstrained text column since 003:32). NOT VALID so legacy
--    rows can't brick the migration; new writes are validated immediately.
--    'door' is deliberately NOT a role — day-of door access is a constrained
--    mode issued as a short-lived scoped token, not an account.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in (
        'client', 'nurse', 'rn', 'np', 'physician', 'medical_director',
        'ops_manager', 'staff', 'admin', 'founder', 'promoter'
      )) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Service providers (park groundwork; Avalon is row #1, the only row in v1)
--    Distinct from provider_profiles (individual clinicians): this is the
--    BUSINESS entity delivering a service line under the Avalon banner.
-- ---------------------------------------------------------------------------
create table if not exists public.service_providers (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid references public.tenants(id) on delete cascade,
  slug                      text not null unique,
  name                      text not null,
  type                      text not null default 'avalon' check (type in ('avalon', 'partner')),
  category                  text,                    -- clinical | bodywork | movement | mind | refreshments | production
  clinical                  boolean not null default false,
  supervising_clinician_id  uuid references public.provider_profiles(id) on delete set null,
  credentials               jsonb not null default '{}'::jsonb,
  insurance_ref             text,                    -- COI pointer; lifecycle enforcement lands with contracts phase
  baa_status                text,
  payout_ref                text,                    -- Stripe Connect groundwork; flow flagged off in v1
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Platform services (blueprint `service` — IV is row 1, IM shots row 2;
--    v2 services are additive rows, never migrations)
-- ---------------------------------------------------------------------------
create table if not exists public.event_services (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid references public.tenants(id) on delete cascade,
  provider_id                uuid references public.service_providers(id) on delete set null,
  slug                       text not null unique,
  name                       text not null,
  service_class              text not null default 'flow'
                             check (service_class in ('flow', 'express', 'session', 'amenity')),
  requires_clinical          boolean not null default false,
  requires_gfe               boolean not null default false,
  requires_waiver            boolean not null default false,  -- enum groundwork; waiver flow lands with first waiver service
  gfe_pathway                text default 'acuity_np'
                             check (gfe_pathway in ('acuity_np', 'qualiphy_auto')),
  protocol_ref               text,
  acuity_appointment_type_id text,
  default_price_cents        integer,
  back_on_floor_minutes      integer,                -- the 30 / 5 promise, rendered as an ESTIMATE everywhere
  active                     boolean not null default true,
  created_at                 timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Containers (events; `kind` leaves room for trips/residencies)
-- ---------------------------------------------------------------------------
create table if not exists public.event_containers (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid references public.tenants(id) on delete cascade,
  kind               text not null default 'event',
  slug               text not null unique,
  name               text not null,
  status             text not null default 'draft'
                     check (status in ('draft', 'presale', 'public', 'sold_out', 'closed')),
  capacity           integer,
  starts_at          timestamptz,
  ends_at            timestamptz,
  venue              text,                             -- neighborhood-level only; exact address lives in the private table
  venue_lat          double precision,
  venue_lng          double precision,
  clinical_lead_id   uuid references public.provider_profiles(id) on delete set null,
  host_name          text,
  cohosts            jsonb not null default '[]'::jsonb,
  description_blocks jsonb not null default '[]'::jsonb,
  gfe_overrides      jsonb not null default '{}'::jsonb, -- per-event overrides layered on GfeSettings defaults (10A)
  walk_up_gfe        boolean not null default false,
  theme_id           uuid,                             -- fk added after event_themes below
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Airbnb-style address reveal: the container row is publicly readable once
-- published, so the exact address CANNOT live on it (RLS is row-level).
-- Confirmed attendees get it via this side table; the API serves it on the
-- trip page after confirmation.
create table if not exists public.event_container_private (
  container_id  uuid primary key references public.event_containers(id) on delete cascade,
  tenant_id     uuid references public.tenants(id) on delete cascade,
  exact_address text,
  arrival_notes text,
  run_of_show   jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

create table if not exists public.event_themes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id) on delete cascade,
  name       text not null,
  tokens     jsonb not null default '{}'::jsonb,  -- live-state accents ONLY; chrome/clinical colors are not themeable
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_containers_theme_id_fkey' and conrelid = 'public.event_containers'::regclass
  ) then
    alter table public.event_containers
      add constraint event_containers_theme_id_fkey
      foreign key (theme_id) references public.event_themes(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tiers, catalog, packages
-- ---------------------------------------------------------------------------
create table if not exists public.event_tiers (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  container_id        uuid not null references public.event_containers(id) on delete cascade,
  name                text not null,
  description         text,
  price_cents         integer not null default 0,        -- 0 = free RSVP tier
  allocation          integer,                           -- held inventory; null = shares container capacity
  presale_opens_at    timestamptz,
  public_opens_at     timestamptz,
  service_id          uuid references public.event_services(id) on delete set null,
  experience_only     boolean not null default false,
  member_gated        boolean not null default false,
  application_gated   boolean not null default false,
  volume_rules        jsonb not null default '[]'::jsonb, -- [{min_qty, unit_price_cents}] — experience line only (§13.2)
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists public.event_catalog_items (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid references public.tenants(id) on delete cascade,
  provider_id           uuid references public.service_providers(id) on delete set null,
  category              text not null
                        check (category in ('clinical_menu', 'clinical_addon', 'production', 'staffing')),
  name                  text not null,
  description           text,
  pricing_model         text not null default 'flat'
                        check (pricing_model in ('per_guest', 'flat', 'hourly')),
  unit_price_cents      integer not null default 0,
  requires_clinical     boolean not null default false,
  requires_gfe          boolean not null default false,
  service_class         text check (service_class in ('flow', 'express', 'session', 'amenity')),
  back_on_floor_minutes integer,
  staffing_ratio        numeric,                        -- guests per staffer; crew is derived, never picked
  min_notice_days       integer not null default 0,
  supply_list_ref       text,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create table if not exists public.event_menu_presets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  name          text not null,                          -- Full / Half / 500ml Express / custom
  protocol_refs jsonb not null default '[]'::jsonb,
  active        boolean not null default true
);

create table if not exists public.event_package_items (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid references public.tenants(id) on delete cascade,
  container_id           uuid not null references public.event_containers(id) on delete cascade,
  catalog_item_id        uuid not null references public.event_catalog_items(id) on delete restrict,
  qty                    integer not null default 1,
  config                 jsonb not null default '{}'::jsonb,
  price_cents_at_booking integer not null default 0,
  clinical_approval      text not null default 'na'
                         check (clinical_approval in ('na', 'pending', 'approved', 'rejected')),
  approved_by            uuid references auth.users(id) on delete set null,
  approved_at            timestamptz,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Visits, orders, applications, waitlist, invites
--    visit = one attendee at one event. Pointers + enums only.
-- ---------------------------------------------------------------------------
create table if not exists public.event_visits (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete cascade,
  container_id        uuid not null references public.event_containers(id) on delete cascade,
  tier_id             uuid references public.event_tiers(id) on delete set null,
  order_id            uuid,                               -- fk added after event_orders below
  service_id          uuid references public.event_services(id) on delete set null,
  person_id           uuid references public.people(id) on delete set null,
  attendee_name       text,                               -- plus-one before account materializes (PII, not PHI)
  attendee_email      text,
  status              text not null default 'pending'
                      check (status in ('held', 'pending', 'confirmed', 'served', 'no_show', 'canceled', 'refunded')),
  hold_expires_at     timestamptz,                        -- capacity hold TTL (T3); reaper releases expired holds
  gfe_status          text not null default 'not_started'
                      check (gfe_status in ('not_started', 'invited', 'scheduled', 'in_review',
                                            'cleared', 'needs_followup', 'declined_medical')),
  gfe_pathway         text check (gfe_pathway in ('acuity_np', 'qualiphy_auto')),
  gfe_acuity_appt_id  text,                               -- pointer into Acuity (the chart)
  gfe_qualiphy_ref    text,                               -- pointer into Qualiphy
  gfe_scope           jsonb not null default '{}'::jsonb, -- what the clearance covers ({iv:true, im:true}) — NP's call
  qr_jti              text unique,                        -- single-use JWT id for replay protection (T7)
  qr_key_id           text,                               -- signing key rotation (T7)
  served_at           timestamptz,
  served_by           uuid references auth.users(id) on delete set null,
  photo_release       boolean,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.event_orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete cascade,
  container_id      uuid not null references public.event_containers(id) on delete cascade,
  buyer_person_id   uuid references public.people(id) on delete set null,
  buyer_email       text,
  total_cents       integer not null default 0,
  stripe_session_id text unique,
  stripe_payment_intent text,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'expired', 'refunded', 'partial_refund')),
  refund_status     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_visits_order_id_fkey' and conrelid = 'public.event_visits'::regclass
  ) then
    alter table public.event_visits
      add constraint event_visits_order_id_fkey
      foreign key (order_id) references public.event_orders(id) on delete set null;
  end if;
end $$;

create table if not exists public.event_applications (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  container_id uuid not null references public.event_containers(id) on delete cascade,
  tier_id      uuid references public.event_tiers(id) on delete set null,
  name         text not null,
  email        text not null,
  phone        text,
  answers      jsonb not null default '{}'::jsonb,  -- ADMIT QUESTIONS ONLY — never medical content (amendment F)
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'expired')),
  reviewer_id  uuid references auth.users(id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.event_waitlist (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.tenants(id) on delete cascade,
  container_id     uuid not null references public.event_containers(id) on delete cascade,
  tier_id          uuid references public.event_tiers(id) on delete set null,
  person_id        uuid references public.people(id) on delete set null,
  email            text,
  position         integer not null,
  promoted_at      timestamptz,
  claim_expires_at timestamptz,                      -- 4h claim window on promotion, then rolls
  created_at       timestamptz not null default now()
);

create table if not exists public.event_invites (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  container_id uuid not null references public.event_containers(id) on delete cascade,
  tier_id      uuid references public.event_tiers(id) on delete set null,
  email        text not null,
  token        text not null unique,
  expires_at   timestamptz,
  redeemed_at  timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. On-site queue. NO health content: no flag storage (pulled from the chart
--    vendor at render time, amendment F). Initials only on the public board.
-- ---------------------------------------------------------------------------
create table if not exists public.event_queue_entries (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.tenants(id) on delete cascade,
  container_id     uuid not null references public.event_containers(id) on delete cascade,
  person_id        uuid references public.people(id) on delete set null,
  visit_id         uuid references public.event_visits(id) on delete set null,
  display_initials text,                              -- "J.T." — the only identity the board ever shows
  board_opt_out    boolean not null default false,
  service_interest text,                              -- routes lane + preps the NP; not a health fact
  lane             text not null default 'flow' check (lane in ('flow', 'express')),
  status           text not null default 'waiting'
                   check (status in ('waiting', 'notified', 'called', 'at_station',
                                     'in_gfe', 'cleared', 'declined', 'left')),
  position         integer not null,
  station_id       text,                              -- assigned on call so two NPs never call the same guest
  sms_opt_in       boolean not null default false,
  phone_e164       text,
  acuity_appt_id   text,                              -- pointer to the on-site GFE record in the chart
  joined_at        timestamptz not null default now(),
  notified_at      timestamptz,
  called_at        timestamptz,
  resolved_at      timestamptz,
  call_count       integer not null default 0
);

-- ---------------------------------------------------------------------------
-- 7. Organizer assets (amendment J + T8: private bucket, renditions generated
--    at upload, EXIF stripped at ingest — enforced by the upload endpoint)
-- ---------------------------------------------------------------------------
create table if not exists public.event_assets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  container_id uuid not null references public.event_containers(id) on delete cascade,
  kind         text not null default 'gallery' check (kind in ('gallery', 'hero')),
  storage_path text not null,
  renditions   jsonb not null default '{}'::jsonb,   -- {hero_1920, card_640, thumb_320}
  uploaded_by  uuid references auth.users(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'live', 'pulled')),
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Promoter scoping (finding 3A — mirrors is_assigned_provider pattern) and
--    append-only audit log
-- ---------------------------------------------------------------------------
create table if not exists public.event_promoters (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  profile_id   uuid not null references auth.users(id) on delete cascade,
  container_id uuid not null references public.event_containers(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (profile_id, container_id)
);

create table if not exists public.event_audit_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  actor       uuid,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  from_value  text,
  to_value    text,
  meta        jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);

create or replace function app_private.is_event_promoter(row_container_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_promoters ep
    where ep.container_id = row_container_id
      and ep.profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 9. State machine: every status transition goes through this function, which
--    validates the move and writes the audit row (TTF is computed from these
--    audit timestamps — T4: server truth, not client analytics).
--    Role enforcement (e.g. only clinical clears) lives at the API/RLS layer;
--    execute is granted to service_role only.
-- ---------------------------------------------------------------------------
create or replace function public.transition_event_visit(
  p_visit_id uuid,
  p_field    text,      -- 'status' | 'gfe_status'
  p_to       text,
  p_actor    uuid default null,
  p_meta     jsonb default '{}'::jsonb
)
returns public.event_visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v      public.event_visits;
  v_from text;
  ok     boolean := false;
begin
  select * into v from public.event_visits where id = p_visit_id for update;
  if v.id is null then
    raise exception 'event visit % not found', p_visit_id;
  end if;

  if p_field = 'status' then
    v_from := v.status;
    ok := (v_from, p_to) in (
      ('held', 'pending'), ('held', 'canceled'),
      ('pending', 'confirmed'), ('pending', 'canceled'),
      ('confirmed', 'served'), ('confirmed', 'no_show'),
      ('confirmed', 'refunded'), ('confirmed', 'canceled'),
      ('pending', 'refunded'), ('no_show', 'refunded')
    );
    if not ok then
      raise exception 'illegal visit status transition % -> %', v_from, p_to;
    end if;
    update public.event_visits
      set status = p_to, updated_at = now(),
          served_at = case when p_to = 'served' then now() else served_at end,
          served_by = case when p_to = 'served' then p_actor else served_by end
      where id = p_visit_id
      returning * into v;
  elsif p_field = 'gfe_status' then
    v_from := v.gfe_status;
    ok := (v_from, p_to) in (
      ('not_started', 'invited'), ('not_started', 'cleared'),          -- returning patient auto-approve lane
      ('invited', 'scheduled'), ('invited', 'in_review'),
      ('scheduled', 'in_review'), ('scheduled', 'cleared'),
      ('in_review', 'cleared'), ('in_review', 'needs_followup'), ('in_review', 'declined_medical'),
      ('needs_followup', 'in_review'), ('needs_followup', 'cleared'), ('needs_followup', 'declined_medical'),
      ('scheduled', 'invited')                                          -- reschedule/cancel resets
    );
    if not ok then
      raise exception 'illegal gfe status transition % -> %', v_from, p_to;
    end if;
    update public.event_visits
      set gfe_status = p_to, updated_at = now()
      where id = p_visit_id
      returning * into v;
  else
    raise exception 'unknown transition field %', p_field;
  end if;

  insert into public.event_audit_log (tenant_id, actor, action, target_type, target_id, from_value, to_value, meta)
  values (v.tenant_id, p_actor, 'transition:' || p_field, 'event_visit', v.id, v_from, p_to, p_meta);

  return v;
end;
$$;

revoke all on function public.transition_event_visit(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.transition_event_visit(uuid, text, text, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Indexes (eng review 14A: hot paths are the day-of queue and door scan)
-- ---------------------------------------------------------------------------
create index if not exists event_queue_entries_board_idx
  on public.event_queue_entries (container_id, status, position);
create index if not exists event_visits_container_gfe_idx
  on public.event_visits (container_id, gfe_status);
create index if not exists event_visits_container_status_idx
  on public.event_visits (container_id, status);
create index if not exists event_visits_person_idx
  on public.event_visits (person_id);
create index if not exists event_visits_hold_reaper_idx
  on public.event_visits (hold_expires_at) where status = 'held';
create index if not exists event_assets_container_status_idx
  on public.event_assets (container_id, status);
create index if not exists event_waitlist_promotion_idx
  on public.event_waitlist (container_id, tier_id, position) where promoted_at is null;
create index if not exists event_tiers_container_idx
  on public.event_tiers (container_id);
create index if not exists event_audit_log_target_idx
  on public.event_audit_log (target_type, target_id, at);
create index if not exists event_orders_stripe_session_idx
  on public.event_orders (stripe_session_id);

-- ---------------------------------------------------------------------------
-- 11. RLS. Deny by default; service_role for API routes; narrow client reads.
--     Promoters: event content + tiers + applications + assets for THEIR
--     events only — never visits, queue, orders, or anything gfe-shaped.
-- ---------------------------------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'service_providers', 'event_services', 'event_containers', 'event_container_private',
    'event_themes', 'event_tiers', 'event_catalog_items', 'event_menu_presets',
    'event_package_items', 'event_visits', 'event_orders', 'event_applications',
    'event_waitlist', 'event_invites', 'event_queue_entries', 'event_assets',
    'event_promoters', 'event_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
  end loop;
end $$;

-- Audit log is append-only for everyone below service_role.
revoke update, delete on public.event_audit_log from authenticated, anon;

-- Published event content is public (the feed and event pages).
drop policy if exists "events public read published" on public.event_containers;
create policy "events public read published"
  on public.event_containers for select
  using (
    status in ('presale', 'public', 'sold_out')
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or app_private.is_event_promoter(id)
  );

drop policy if exists "event tiers follow container visibility" on public.event_tiers;
create policy "event tiers follow container visibility"
  on public.event_tiers for select
  using (
    exists (
      select 1 from public.event_containers c
      where c.id = container_id
        and (c.status in ('presale', 'public', 'sold_out')
             or (app_private.same_tenant(c.tenant_id) and app_private.is_staff())
             or app_private.is_event_promoter(c.id))
    )
  );

drop policy if exists "event themes public read active" on public.event_themes;
create policy "event themes public read active"
  on public.event_themes for select
  using (active or (app_private.same_tenant(tenant_id) and app_private.is_staff()));

drop policy if exists "event assets public read live" on public.event_assets;
create policy "event assets public read live"
  on public.event_assets for select
  using (
    status = 'live'
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or app_private.is_event_promoter(container_id)
  );

drop policy if exists "event services public read active" on public.event_services;
create policy "event services public read active"
  on public.event_services for select
  using (active or (app_private.same_tenant(tenant_id) and app_private.is_staff()));

drop policy if exists "service providers staff read" on public.service_providers;
create policy "service providers staff read"
  on public.service_providers for select
  using (app_private.same_tenant(tenant_id) and app_private.is_staff());

-- Exact address: staff, the event's promoter, or a CONFIRMED attendee only.
drop policy if exists "event private staff promoter or confirmed read" on public.event_container_private;
create policy "event private staff promoter or confirmed read"
  on public.event_container_private for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or app_private.is_event_promoter(container_id)
    or exists (
      select 1 from public.event_visits v
      join public.people p on p.id = v.person_id
      where v.container_id = event_container_private.container_id
        and v.status in ('confirmed', 'served')
        and p.profile_id = auth.uid()
    )
  );

drop policy if exists "event private operator write" on public.event_container_private;
create policy "event private operator write"
  on public.event_container_private for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

-- Staff manage event content; promoters edit THEIR events' content fields.
drop policy if exists "event containers operator write" on public.event_containers;
create policy "event containers operator write"
  on public.event_containers for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "event containers promoter update" on public.event_containers;
create policy "event containers promoter update"
  on public.event_containers for update
  using (app_private.is_event_promoter(id))
  with check (app_private.is_event_promoter(id));
  -- NOTE: status pushes (draft→presale→public…) are Avalon-admin-only and go
  -- through the API (service role) which checks is_platform_admin — a promoter
  -- UPDATE here cannot help them see anything, and column-level protection for
  -- status lives in the route layer (T5 route-authz tests cover it).

drop policy if exists "event tiers operator write" on public.event_tiers;
create policy "event tiers operator write"
  on public.event_tiers for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

drop policy if exists "event catalog promoter read active" on public.event_catalog_items;
create policy "event catalog promoter read active"
  on public.event_catalog_items for select
  using (
    (active and app_private.profile_role() = 'promoter')
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
  );

drop policy if exists "event catalog admin write" on public.event_catalog_items;
create policy "event catalog admin write"
  on public.event_catalog_items for all
  using (app_private.same_tenant(tenant_id) and app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) and app_private.is_platform_admin());

drop policy if exists "event menu presets staff read" on public.event_menu_presets;
create policy "event menu presets staff read"
  on public.event_menu_presets for select
  using (
    active
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
  );

-- Package items: promoters compose for their event; approvals never theirs.
drop policy if exists "event packages promoter read" on public.event_package_items;
create policy "event packages promoter read"
  on public.event_package_items for select
  using (
    app_private.is_event_promoter(container_id)
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
  );

drop policy if exists "event packages promoter compose" on public.event_package_items;
create policy "event packages promoter compose"
  on public.event_package_items for insert
  with check (
    app_private.is_event_promoter(container_id)
    and clinical_approval in ('na', 'pending')
  );

drop policy if exists "event packages promoter edit pending" on public.event_package_items;
create policy "event packages promoter edit pending"
  on public.event_package_items for update
  using (app_private.is_event_promoter(container_id) and clinical_approval in ('na', 'pending'))
  with check (app_private.is_event_promoter(container_id) and clinical_approval in ('na', 'pending'));

drop policy if exists "event packages staff write" on public.event_package_items;
create policy "event packages staff write"
  on public.event_package_items for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator_or_clinical_authority())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator_or_clinical_authority());

-- Visits: the attendee sees their own; clinical/ops see all; PROMOTERS SEE NONE.
drop policy if exists "event visits self or staff read" on public.event_visits;
create policy "event visits self or staff read"
  on public.event_visits for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (
      select 1 from public.people p
      where p.profile_id = auth.uid() and p.id = event_visits.person_id
    )
    or exists (
      select 1 from public.event_orders o
      join public.people bp on bp.id = o.buyer_person_id
      where o.id = event_visits.order_id and bp.profile_id = auth.uid()
    )
  );

-- Orders: buyer or staff.
drop policy if exists "event orders buyer or staff read" on public.event_orders;
create policy "event orders buyer or staff read"
  on public.event_orders for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or exists (
      select 1 from public.people p
      where p.profile_id = auth.uid() and p.id = event_orders.buyer_person_id
    )
  );

-- Applications: promoter reviews admit decisions for their event (answers are
-- non-medical by construction); staff see all.
drop policy if exists "event applications promoter or staff read" on public.event_applications;
create policy "event applications promoter or staff read"
  on public.event_applications for select
  using (
    app_private.is_event_promoter(container_id)
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
  );

drop policy if exists "event applications promoter decide" on public.event_applications;
create policy "event applications promoter decide"
  on public.event_applications for update
  using (app_private.is_event_promoter(container_id))
  with check (app_private.is_event_promoter(container_id));

-- Waitlist, invites: staff only (client interactions go through the API).
drop policy if exists "event waitlist staff read" on public.event_waitlist;
create policy "event waitlist staff read"
  on public.event_waitlist for select
  using (app_private.same_tenant(tenant_id) and app_private.is_staff());

drop policy if exists "event invites staff or promoter read" on public.event_invites;
create policy "event invites staff or promoter read"
  on public.event_invites for select
  using (
    app_private.is_event_promoter(container_id)
    or (app_private.same_tenant(tenant_id) and app_private.is_staff())
  );

-- Queue: clinical + ops only. Not promoters, not clients (the public board is
-- rendered by the API from initials + position only).
drop policy if exists "event queue staff read" on public.event_queue_entries;
create policy "event queue staff read"
  on public.event_queue_entries for select
  using (app_private.same_tenant(tenant_id) and app_private.is_staff());

drop policy if exists "event queue clinical write" on public.event_queue_entries;
create policy "event queue clinical write"
  on public.event_queue_entries for all
  using (app_private.same_tenant(tenant_id) and app_private.is_operator_or_clinical_authority())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator_or_clinical_authority());

-- Assets: promoter uploads for their event (pending by default), admin audits.
drop policy if exists "event assets promoter upload" on public.event_assets;
create policy "event assets promoter upload"
  on public.event_assets for insert
  with check (
    (app_private.is_event_promoter(container_id) and status = 'pending')
    or (app_private.same_tenant(tenant_id) and app_private.is_operator())
  );

drop policy if exists "event assets operator write" on public.event_assets;
create policy "event assets operator write"
  on public.event_assets for update
  using (app_private.same_tenant(tenant_id) and app_private.is_operator())
  with check (app_private.same_tenant(tenant_id) and app_private.is_operator());

-- Promoter assignments: admins manage; a promoter can see their own rows.
drop policy if exists "event promoters admin manage" on public.event_promoters;
create policy "event promoters admin manage"
  on public.event_promoters for all
  using (app_private.same_tenant(tenant_id) and app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) and app_private.is_platform_admin());

drop policy if exists "event promoters self read" on public.event_promoters;
create policy "event promoters self read"
  on public.event_promoters for select
  using (profile_id = auth.uid());

-- Audit log: platform admin reads; writes happen inside definer functions.
drop policy if exists "event audit admin read" on public.event_audit_log;
create policy "event audit admin read"
  on public.event_audit_log for select
  using (app_private.same_tenant(tenant_id) and app_private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 12. Seeds: Avalon as service provider #1; IV (flow, back in ~30) and IM
--     shots (express, back in ~5) as the two v1 services. Uses the default
--     tenant when present; safe no-op otherwise. Idempotent via slugs.
-- ---------------------------------------------------------------------------
do $$
declare t uuid;
begin
  select id into t from public.tenants where status = 'active' order by created_at asc limit 1;

  insert into public.service_providers (tenant_id, slug, name, type, category, clinical, active)
  values (t, 'avalon', 'Avalon Vitality', 'avalon', 'clinical', true, true)
  on conflict (slug) do nothing;

  insert into public.event_services
    (tenant_id, provider_id, slug, name, service_class, requires_clinical, requires_gfe,
     gfe_pathway, back_on_floor_minutes, active)
  values
    (t, (select id from public.service_providers where slug = 'avalon'),
     'iv-drip', 'IV Drip', 'flow', true, true, 'acuity_np', 30, true),
    (t, (select id from public.service_providers where slug = 'avalon'),
     'im-shot', 'IM Shot', 'express', true, true, 'acuity_np', 5, true)
  on conflict (slug) do nothing;
end $$;
