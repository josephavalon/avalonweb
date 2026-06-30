-- 028_profile_deletion_resolution.sql
-- Companion to 022 (member-side request stamp). These columns let staff record
-- the resolution of a deletion request from /admin/deletion-requests. Without
-- them the admin POST returns 503 migration_required. Idempotent.

alter table public.profiles add column if not exists deletion_resolved_at      timestamptz;
alter table public.profiles add column if not exists deletion_resolver_id      uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists deletion_resolution_note  text;

create index if not exists profiles_deletion_open_idx
  on public.profiles (deletion_requested_at)
  where deletion_requested_at is not null and deletion_resolved_at is null;
