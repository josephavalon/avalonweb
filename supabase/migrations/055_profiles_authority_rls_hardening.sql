-- Close the authenticated profiles escalation path left by the original
-- operator policy. Migration 012 intentionally included `staff` in
-- app_private.is_operator(), while migration 003 used is_operator() for an
-- unrestricted `for all` policy on profiles. Together those definitions let a
-- staff session update authority fields (including role and tenant_id) on any
-- profile visible through the Data API.
--
-- Profile administration and self-service edits belong behind server-owned
-- service-role APIs. Authenticated browser sessions must not update profiles
-- directly, including their own clinical JSON fields.

drop policy if exists "admins manage profiles" on public.profiles;

-- Migration 019 introduced this direct self-update policy. Remove it entirely:
-- the authenticated role retains its table grant, but RLS now exposes no
-- profile UPDATE policy to a browser session.
drop policy if exists "profiles self update" on public.profiles;

-- Password rotation can only be completed by the server after the password
-- provider confirms the password write. The old authenticated SECURITY
-- DEFINER RPC could clear this flag without changing the password.
revoke execute on function public.clear_own_password_rotation_flag() from authenticated;
drop function if exists public.clear_own_password_rotation_flag();

create or replace function app_private.guard_profile_authority_update()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  -- Preserve the intended server-owned service-role path for profile
  -- administration; its authorization controls remain at the API boundary.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Fail closed even if a later migration accidentally introduces another
  -- authenticated UPDATE policy or security-definer write path.
  raise exception 'Profiles can only be changed through an authorized server API.'
    using errcode = '42501';
end;
$$;

revoke all on function app_private.guard_profile_authority_update() from public;

-- Recreate the trigger explicitly so the latest guard remains the enforcement
-- point even if an environment missed migration 041's trigger installation.
drop trigger if exists profiles_guard_authority_update on public.profiles;
create trigger profiles_guard_authority_update
  before update on public.profiles
  for each row execute function app_private.guard_profile_authority_update();

comment on function app_private.guard_profile_authority_update() is
  'Allows service-role API writes only; all browser-authenticated profile mutations are denied.';

-- Email is a compatibility key for legacy profile rows, not an authority key.
-- Resolve it only through exact canonical equality inside one tenant. Limiting
-- the candidate set to two lets the caller distinguish exactly one row from
-- zero/ambiguous rows without ever interpreting `%` or `_` as wildcards.
create or replace function public.resolve_unique_profile_id_by_email(
  p_tenant_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ids uuid[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'Profile identity resolution requires the service role.'
      using errcode = '42501';
  end if;
  if p_tenant_id is null or v_email = '' then
    return null;
  end if;

  select array_agg(candidate.id order by candidate.id)
  into v_ids
  from (
    select profile.id
    from public.profiles as profile
    where profile.tenant_id = p_tenant_id
      and lower(btrim(profile.email)) = v_email
    limit 2
  ) as candidate;

  if coalesce(cardinality(v_ids), 0) <> 1 then
    return null;
  end if;
  return v_ids[1];
end;
$$;

revoke all on function public.resolve_unique_profile_id_by_email(uuid, text) from public;
revoke all on function public.resolve_unique_profile_id_by_email(uuid, text) from anon, authenticated;
grant execute on function public.resolve_unique_profile_id_by_email(uuid, text) to service_role;

comment on function public.resolve_unique_profile_id_by_email(uuid, text) is
  'Service-role-only exact canonical email resolver; returns null for zero or ambiguous tenant-bound matches.';

-- Apply patient-owned profile fields in one row-locked UPDATE. The incoming
-- `phi` object never supplies clinician notes or review markers; those keys are
-- copied from the current row inside the UPDATE expression, so a concurrent
-- clinical write cannot be overwritten by a stale API read.
create or replace function public.update_patient_profile_fields(
  p_profile_id uuid,
  p_tenant_id uuid,
  p_patch jsonb
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_unknown_key text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Patient profile updates require the service role.'
      using errcode = '42501';
  end if;
  if p_profile_id is null or p_tenant_id is null then
    raise exception 'Profile and tenant are required.'
      using errcode = '22023';
  end if;

  p_patch := coalesce(p_patch, '{}'::jsonb);
  if jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'A non-empty profile patch object is required.'
      using errcode = '22023';
  end if;

  select key
  into v_unknown_key
  from jsonb_object_keys(p_patch) as patch_key(key)
  where key <> all (array[
    'full_name', 'preferred_name', 'address', 'date_of_birth', 'phone',
    'emergency_contact', 'phi', 'comm_prefs'
  ]::text[])
  limit 1;
  if v_unknown_key is not null then
    raise exception 'Profile field is not patient-editable.'
      using errcode = '42501';
  end if;

  if p_patch ? 'phi' and jsonb_typeof(p_patch->'phi') not in ('object', 'null') then
    raise exception 'Profile phi must be an object or null.'
      using errcode = '22023';
  end if;
  if p_patch ? 'emergency_contact'
     and jsonb_typeof(p_patch->'emergency_contact') not in ('object', 'null') then
    raise exception 'Emergency contact must be an object or null.'
      using errcode = '22023';
  end if;
  if p_patch ? 'comm_prefs' and jsonb_typeof(p_patch->'comm_prefs') not in ('object', 'null') then
    raise exception 'Communication preferences must be an object or null.'
      using errcode = '22023';
  end if;

  update public.profiles as profile
  set full_name = case when p_patch ? 'full_name' then p_patch->>'full_name' else profile.full_name end,
      preferred_name = case when p_patch ? 'preferred_name' then p_patch->>'preferred_name' else profile.preferred_name end,
      address = case when p_patch ? 'address' then p_patch->>'address' else profile.address end,
      date_of_birth = case when p_patch ? 'date_of_birth' then nullif(p_patch->>'date_of_birth', '')::date else profile.date_of_birth end,
      phone = case when p_patch ? 'phone' then p_patch->>'phone' else profile.phone end,
      emergency_contact = case
        when not (p_patch ? 'emergency_contact') then profile.emergency_contact
        when p_patch->'emergency_contact' = 'null'::jsonb then null
        else p_patch->'emergency_contact'
      end,
      comm_prefs = case
        when not (p_patch ? 'comm_prefs') then profile.comm_prefs
        when p_patch->'comm_prefs' = 'null'::jsonb then null
        else p_patch->'comm_prefs'
      end,
      phi = case
        when not (p_patch ? 'phi') then profile.phi
        else nullif(
          (
            case
              when p_patch->'phi' = 'null'::jsonb then '{}'::jsonb
              else p_patch->'phi' - array['nurseNotes', 'lastReviewedAt', 'lastReviewedBy']::text[]
            end
          )
          || case when coalesce(profile.phi, '{}'::jsonb) ? 'nurseNotes'
            then jsonb_build_object('nurseNotes', profile.phi->'nurseNotes') else '{}'::jsonb end
          || case when coalesce(profile.phi, '{}'::jsonb) ? 'lastReviewedAt'
            then jsonb_build_object('lastReviewedAt', profile.phi->'lastReviewedAt') else '{}'::jsonb end
          || case when coalesce(profile.phi, '{}'::jsonb) ? 'lastReviewedBy'
            then jsonb_build_object('lastReviewedBy', profile.phi->'lastReviewedBy') else '{}'::jsonb end,
          '{}'::jsonb
        )
      end,
      updated_at = now()
  where profile.id = p_profile_id
    and profile.tenant_id = p_tenant_id
  returning profile.* into v_profile;

  if v_profile.id is null then
    raise exception 'Profile not found in tenant.'
      using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.update_patient_profile_fields(uuid, uuid, jsonb) from public;
revoke all on function public.update_patient_profile_fields(uuid, uuid, jsonb) from anon, authenticated;
grant execute on function public.update_patient_profile_fields(uuid, uuid, jsonb) to service_role;

comment on function public.update_patient_profile_fields(uuid, uuid, jsonb) is
  'Service-role-only, tenant/id-bound patient profile update that atomically preserves clinician-owned PHI keys.';
