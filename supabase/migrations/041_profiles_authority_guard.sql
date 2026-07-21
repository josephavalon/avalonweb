-- Prevent self-service profile edits from becoming role escalation.
--
-- The existing "profiles self update" RLS policy limits a member to their own
-- row, but RLS cannot restrict which columns they change. This trigger allowlists
-- ordinary self-service fields and fails closed for role, status, tenant,
-- integration, billing, and any future authority columns.

create or replace function app_private.guard_profile_authority_update()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  -- Service-role APIs and current operators retain full profile management.
  if auth.role() = 'service_role' or app_private.is_operator() then
    return new;
  end if;

  if old.id = auth.uid() and (
    to_jsonb(new) - array[
      'full_name', 'preferred_name', 'address', 'date_of_birth', 'phone',
      'emergency_contact', 'phi', 'comm_prefs', 'gfe', 'saved_address',
      'updated_at'
    ]::text[]
  ) is distinct from (
    to_jsonb(old) - array[
      'full_name', 'preferred_name', 'address', 'date_of_birth', 'phone',
      'emergency_contact', 'phi', 'comm_prefs', 'gfe', 'saved_address',
      'updated_at'
    ]::text[]
  ) then
    raise exception 'Profile authority fields cannot be changed through self-service.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_profile_authority_update() from public;

drop trigger if exists profiles_guard_authority_update on public.profiles;
create trigger profiles_guard_authority_update
  before update on public.profiles
  for each row execute function app_private.guard_profile_authority_update();

comment on function app_private.guard_profile_authority_update() is
  'Blocks self-service updates to profile authority/integration columns while preserving safe profile edits and operator/service-role management.';

-- Password rotation is the one self-service security flag the app needs to
-- clear. Expose a purpose-built function instead of leaving the column broadly
-- writable through PostgREST.
create or replace function public.clear_own_password_rotation_flag()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles
  set must_change_password = false,
      updated_at = now()
  where id = auth.uid();
$$;

revoke all on function public.clear_own_password_rotation_flag() from public;
grant execute on function public.clear_own_password_rotation_flag() to authenticated;
