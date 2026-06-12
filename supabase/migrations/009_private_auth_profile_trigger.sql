-- Move the auth bootstrap trigger function out of the exposed public schema.
-- Supabase exposes public through the Data API; privileged SECURITY DEFINER
-- functions should live in a private schema and be non-callable by API roles.

create schema if not exists app_private;

create or replace function app_private.handle_new_user()
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

revoke execute on function app_private.handle_new_user() from public;
revoke execute on function app_private.handle_new_user() from anon;
revoke execute on function app_private.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

drop function if exists public.handle_new_user();
