-- ============================================================
-- Avalon Vitality — Inventory System Database
-- Paste this entire file into the Supabase SQL Editor and run.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  parent_id   uuid references folders(id) on delete cascade,
  color       text not null default '#6b7280',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists settings (
  id                  integer primary key default 1,
  org_name            text not null default 'Avalon Vitality',
  currency            text not null default 'USD',
  low_stock_threshold text not null default 'auto',
  id_prefix           text not null default 'AVOT',
  id_counter          integer not null default 22,
  email_alerts        boolean not null default false,
  alert_email         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Single-row constraint: only allow id = 1
create or replace rule settings_single_row as
  on insert to settings
  where (select count(*) from settings) >= 1
  do instead nothing;

create table if not exists items (
  id                uuid primary key default gen_random_uuid(),
  sortly_id         text unique,                        -- auto-set by trigger
  name              text not null,
  sku               text,
  category          text,
  folder_id         uuid references folders(id) on delete set null,
  qty               integer not null default 0,
  unit              text not null default 'units',
  min_level         integer not null default 0,
  price             numeric(10,2) not null default 0,
  supplier          text,
  expiration_date   date,
  refrigeration     boolean not null default false,
  notes             text,
  is_new            boolean not null default true,
  alert_enabled     boolean not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

create table if not exists item_photos (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references items(id) on delete cascade,
  storage_path  text not null,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#60a5fa',
  created_at  timestamptz not null default now()
);

create table if not exists item_tags (
  item_id  uuid not null references items(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

create table if not exists custom_field_definitions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  field_type  text not null check (field_type in ('text','number','date','checkbox','dropdown')),
  options     jsonb,          -- for dropdown: ["Option A", "Option B"]
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists custom_field_values (
  item_id   uuid not null references items(id) on delete cascade,
  field_id  uuid not null references custom_field_definitions(id) on delete cascade,
  value     text,
  primary key (item_id, field_id)
);

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid references items(id) on delete cascade,
  item_name   text not null,
  type        text not null check (type in (
                'check_in','check_out','move','edit','create','delete','restore'
              )),
  qty_before  integer,
  qty_after   integer,
  qty_delta   integer generated always as (qty_after - qty_before) stored,
  folder_from uuid references folders(id) on delete set null,
  folder_to   uuid references folders(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  user_name   text
);

-- ── Auto Sortly ID trigger ────────────────────────────────────────────────────
-- Atomically reads id_prefix + id_counter from settings, formats the ID,
-- then increments the counter. Generates "AVOT0022", "AVOT0023", etc.

create or replace function generate_sortly_id()
returns trigger language plpgsql as $$
declare
  v_prefix  text;
  v_counter integer;
  v_id      text;
begin
  -- Lock the settings row so concurrent inserts don't collide
  select id_prefix, id_counter
    into v_prefix, v_counter
    from settings
    where id = 1
    for update;

  v_id := v_prefix || lpad(v_counter::text, 4, '0');

  new.sortly_id := v_id;

  update settings set id_counter = v_counter + 1 where id = 1;

  return new;
end;
$$;

drop trigger if exists trg_sortly_id on items;
create trigger trg_sortly_id
  before insert on items
  for each row
  when (new.sortly_id is null)
  execute function generate_sortly_id();

-- ── updated_at auto-update ────────────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_items_updated_at on items;
create trigger trg_items_updated_at
  before update on items
  for each row execute function touch_updated_at();

drop trigger if exists trg_folders_updated_at on folders;
create trigger trg_folders_updated_at
  before update on folders
  for each row execute function touch_updated_at();

-- ── Item count view ───────────────────────────────────────────────────────────
-- Optional helper view for folder item counts
create or replace view folder_item_counts as
  select
    folder_id,
    count(*) as item_count
  from items
  where deleted_at is null
  group by folder_id;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on all tables
alter table folders                   enable row level security;
alter table items                     enable row level security;
alter table item_photos               enable row level security;
alter table tags                      enable row level security;
alter table item_tags                 enable row level security;
alter table custom_field_definitions  enable row level security;
alter table custom_field_values       enable row level security;
alter table transactions              enable row level security;
alter table settings                  enable row level security;

-- Authenticated users: full read/write on all tables
-- (Tighten to role-based when you add staff roles)

create policy "auth_all_folders"      on folders                  for all using (auth.role() = 'authenticated');
create policy "auth_all_items"        on items                    for all using (auth.role() = 'authenticated');
create policy "auth_all_photos"       on item_photos              for all using (auth.role() = 'authenticated');
create policy "auth_all_tags"         on tags                     for all using (auth.role() = 'authenticated');
create policy "auth_all_item_tags"    on item_tags                for all using (auth.role() = 'authenticated');
create policy "auth_all_cfd"          on custom_field_definitions for all using (auth.role() = 'authenticated');
create policy "auth_all_cfv"          on custom_field_values      for all using (auth.role() = 'authenticated');
create policy "auth_insert_tx"        on transactions             for insert with check (auth.role() = 'authenticated');
create policy "auth_select_tx"        on transactions             for select using (auth.role() = 'authenticated');
create policy "auth_read_settings"    on settings                 for select using (auth.role() = 'authenticated');
create policy "auth_write_settings"   on settings                 for update using (auth.role() = 'authenticated');

-- ── Seed settings row ────────────────────────────────────────────────────────
insert into settings (id) values (1) on conflict (id) do nothing;

-- ── Supabase Storage bucket ───────────────────────────────────────────────────
-- Run this separately in the Storage section of Supabase dashboard,
-- or uncomment if your project supports storage API:
--
-- insert into storage.buckets (id, name, public)
--   values ('item-photos', 'item-photos', true)
--   on conflict do nothing;
