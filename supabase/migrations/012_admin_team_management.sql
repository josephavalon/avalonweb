-- Admin Team & User Settings: wire the staff-invite flow and add the `staff`
-- access tier on top of the launch role model (admin / client / nurse).
--
-- The `public.invitations` table has existed since 003 but was never used. This
-- migration extends it for the custom invite-token flow (one record powers both
-- an email magic-link and an SMS short code), adds a `staff` tier that can read
-- customer / scheduling / billing data (operator-level) without being a platform
-- admin, and adds the force-set-temp-password flag.

-- ── invitations: custom-token columns ─────────────────────────────────────
alter table public.invitations add column if not exists token_hash text;
alter table public.invitations add column if not exists code_hash  text;
alter table public.invitations add column if not exists phone      text;
alter table public.invitations add column if not exists full_name  text;

-- Widen the invited_role check to include the new `staff` tier. The constraint
-- was created inline in 003, so it carries Postgres's auto-generated name.
alter table public.invitations drop constraint if exists invitations_invited_role_check;
alter table public.invitations add constraint invitations_invited_role_check
  check (invited_role in (
    'client','nurse','rn','np','physician','medical_director','ops_manager','staff','admin','founder'
  ));

-- Token/code lookups hit these on every accept attempt.
create index if not exists invitations_token_hash_idx on public.invitations (token_hash);
create index if not exists invitations_code_lookup_idx on public.invitations (lower(email), code_hash);

-- ── profiles: force-set-temp-password flag (D3) ───────────────────────────
alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- ── Permission helpers: `staff` is operator-level for data reads ──────────
-- Adding `staff` to is_operator() flows through to is_staff() and every RLS
-- policy that gates on operator access, so a staff member can read the
-- customer / scheduling / billing data they manage. is_platform_admin() is
-- deliberately left unchanged — team management, role changes, and
-- deactivation stay admin/founder only.
create or replace function app_private.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.profile_role() in ('ops_manager', 'staff', 'admin', 'founder');
$$;

-- is_staff() already unions operator + clinical + provider; recreated here so
-- the definition is co-located with the role change above (it now picks up
-- `staff` transitively through is_operator()).
create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.is_operator() or app_private.is_clinical_authority() or app_private.is_provider();
$$;
