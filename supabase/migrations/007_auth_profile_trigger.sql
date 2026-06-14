-- ─── Auth → Profiles bootstrap ────────────────────────────────────────────────
-- Every new auth.users row gets a matching public.profiles row with
-- role='client', status='active', and the avalon-vitality tenant. Admins are
-- promoted manually after signup:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- This trigger is idempotent (ON CONFLICT DO NOTHING) so existing rows from the
-- demo fallback in src/lib/useAuthStore.js are left untouched.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_tenant uuid;
  meta_full_name text;
begin
  select id into default_tenant
  from public.tenants
  where slug = 'avalon-vitality'
  limit 1;

  meta_full_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  )), '');

  insert into public.profiles (id, email, phone, full_name, role, status, tenant_id)
  values (
    new.id,
    new.email,
    new.phone,
    meta_full_name,
    'client',
    'active',
    default_tenant
  )
  on conflict (id) do update
    set email      = coalesce(excluded.email, public.profiles.email),
        phone      = coalesce(excluded.phone, public.profiles.phone),
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        tenant_id  = coalesce(public.profiles.tenant_id, excluded.tenant_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh on profile edits ---------------------------------------
create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();
