-- Reconcile append-only activity evidence and install the active-company race
-- guards where migration 064 was already applied.

begin;

-- Fail before any lock or mutation unless the installed objects, roles, ACLs,
-- and any already-installed race guards match the reviewed contract exactly.
do $$
declare
  activities_oid oid;
  activities_owner oid;
  people_oid oid;
  people_owner oid;
  companies_oid oid;
  companies_owner oid;
  service_role_oid oid;
  expected_function record;
  function_oid oid;
  checked_role text;
begin
  select table_definition.oid, table_definition.relowner
    into activities_oid, activities_owner
  from pg_class table_definition
  join pg_namespace table_namespace on table_namespace.oid = table_definition.relnamespace
  where table_namespace.nspname = 'public'
    and table_definition.relname = 'bd_activities'
    and table_definition.relkind = 'r';
  select table_definition.oid, table_definition.relowner
    into people_oid, people_owner
  from pg_class table_definition
  join pg_namespace table_namespace on table_namespace.oid = table_definition.relnamespace
  where table_namespace.nspname = 'public'
    and table_definition.relname = 'bd_people'
    and table_definition.relkind = 'r';
  select table_definition.oid, table_definition.relowner
    into companies_oid, companies_owner
  from pg_class table_definition
  join pg_namespace table_namespace on table_namespace.oid = table_definition.relnamespace
  where table_namespace.nspname = 'public'
    and table_definition.relname = 'bd_companies'
    and table_definition.relkind = 'r';

  if activities_oid is null or people_oid is null or companies_oid is null then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_heap_tables_required';
  end if;
  if to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_roles_required';
  end if;
  if people_owner <> companies_owner then
    raise exception using errcode = 'P0001', message = 'bd_company_race_table_owner_mismatch';
  end if;

  service_role_oid := to_regrole('service_role');
  if service_role_oid in (activities_owner, people_owner, companies_owner) then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_service_role_must_not_own_tables';
  end if;
  if not coalesce((select relrowsecurity from pg_class where oid = activities_oid), false)
     or not coalesce((select relrowsecurity from pg_class where oid = people_oid), false)
     or not coalesce((select relrowsecurity from pg_class where oid = companies_oid), false) then
    raise exception using errcode = 'P0001', message = 'bd_company_race_rls_required';
  end if;
  if exists (
    select 1
    from pg_attribute column_definition
    where column_definition.attrelid = activities_oid
      and column_definition.attnum > 0
      and not column_definition.attisdropped
      and column_definition.attacl is not null
  ) then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_column_acl_forbidden';
  end if;
  if not has_table_privilege('service_role', activities_oid, 'SELECT')
     or not has_table_privilege('service_role', activities_oid, 'INSERT') then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_required_privileges_missing';
  end if;

  for expected_function in
    select *
    from (values
      ('public.bd_people_require_active_company()', 'bd_people_require_active_company', people_owner, 'd1aced673b084dbeed85e8df798047a0'),
      ('public.bd_companies_guard_archive_people()', 'bd_companies_guard_archive_people', companies_owner, 'fc8d17b3b6ae68d9ba9fdfc3e15a2567')
    ) as expected(identity, function_name, function_owner, source_md5)
  loop
    function_oid := to_regprocedure(expected_function.identity);
    if function_oid is not null and not exists (
      select 1
      from pg_proc function_definition
      join pg_namespace function_namespace on function_namespace.oid = function_definition.pronamespace
      join pg_language function_language on function_language.oid = function_definition.prolang
      where function_definition.oid = function_oid
        and function_namespace.nspname = 'public'
        and function_definition.proname = expected_function.function_name
        and function_definition.proowner = expected_function.function_owner
        and function_definition.prorettype = 'trigger'::regtype
        and function_definition.pronargs = 0
        and function_definition.prokind = 'f'
        and function_language.lanname = 'plpgsql'
        and function_definition.prosecdef
        and function_definition.provolatile = 'v'
        and function_definition.proparallel = 'u'
        and not function_definition.proleakproof
        and function_definition.proconfig = array['search_path=pg_catalog, pg_temp']::text[]
        and md5(regexp_replace(
          btrim(function_definition.prosrc, E' \t\n\r'),
          '[[:space:]]+', ' ', 'g'
        )) = expected_function.source_md5
        and not exists (
          select 1
          from aclexplode(coalesce(
            function_definition.proacl,
            acldefault('f', function_definition.proowner)
          )) expanded_acl
          where expanded_acl.grantee <> function_definition.proowner
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'bd_company_race_existing_function_mismatch',
        detail = expected_function.identity;
    end if;
    if function_oid is not null then
      foreach checked_role in array array['anon', 'authenticated', 'service_role'] loop
        if has_function_privilege(checked_role, function_oid, 'EXECUTE') then
          raise exception using
            errcode = 'P0001',
            message = 'bd_company_race_existing_function_execute_forbidden',
            detail = expected_function.identity || ':' || checked_role;
        end if;
      end loop;
    end if;
  end loop;

  function_oid := to_regprocedure('public.bd_people_require_active_company()');
  if exists (
    select 1 from pg_trigger trigger_definition
    where trigger_definition.tgrelid = people_oid
      and trigger_definition.tgname = 'trg_bd_people_active_company'
      and not trigger_definition.tgisinternal
  ) and not exists (
    select 1
    from pg_trigger trigger_definition
    where trigger_definition.tgrelid = people_oid
      and trigger_definition.tgname = 'trg_bd_people_active_company'
      and not trigger_definition.tgisinternal
      and trigger_definition.tgenabled = 'O'
      and trigger_definition.tgfoid = function_oid
      and trigger_definition.tgtype = 23
      and trigger_definition.tgqual is null
      and trigger_definition.tgnargs = 0
      and octet_length(trigger_definition.tgargs) = 0
      and trigger_definition.tgconstraint = 0
      and trigger_definition.tgconstrrelid = 0
      and not trigger_definition.tgdeferrable
      and not trigger_definition.tginitdeferred
      and cardinality(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[]) = 2
      and (select attribute.attnum from pg_attribute attribute
           where attribute.attrelid = people_oid and attribute.attname = 'company_id')
          = any(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[])
      and (select attribute.attnum from pg_attribute attribute
           where attribute.attrelid = people_oid and attribute.attname = 'tenant_id')
          = any(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[])
  ) then
    raise exception using errcode = 'P0001', message = 'bd_people_company_existing_trigger_mismatch';
  end if;

  function_oid := to_regprocedure('public.bd_companies_guard_archive_people()');
  if exists (
    select 1 from pg_trigger trigger_definition
    where trigger_definition.tgrelid = companies_oid
      and trigger_definition.tgname = 'trg_bd_companies_archive_people'
      and not trigger_definition.tgisinternal
  ) and not exists (
    select 1
    from pg_trigger trigger_definition
    where trigger_definition.tgrelid = companies_oid
      and trigger_definition.tgname = 'trg_bd_companies_archive_people'
      and not trigger_definition.tgisinternal
      and trigger_definition.tgenabled = 'O'
      and trigger_definition.tgfoid = function_oid
      and trigger_definition.tgtype = 19
      and trigger_definition.tgqual is null
      and trigger_definition.tgnargs = 0
      and octet_length(trigger_definition.tgargs) = 0
      and trigger_definition.tgconstraint = 0
      and trigger_definition.tgconstrrelid = 0
      and not trigger_definition.tgdeferrable
      and not trigger_definition.tginitdeferred
      and cardinality(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[]) = 1
      and (select attribute.attnum from pg_attribute attribute
           where attribute.attrelid = companies_oid and attribute.attname = 'deleted_at')
          = any(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[])
  ) then
    raise exception using errcode = 'P0001', message = 'bd_company_archive_existing_trigger_mismatch';
  end if;
end $$;

-- Hold both relationship tables against concurrent writes while checking old
-- installations and installing the guards.
lock table public.bd_companies, public.bd_people in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.bd_people person_record
    left join public.bd_companies company_record
      on company_record.tenant_id = person_record.tenant_id
     and company_record.id = person_record.company_id
    where person_record.deleted_at is null
      and person_record.company_id is not null
      and (company_record.id is null or company_record.deleted_at is not null)
  ) then
    raise exception using errcode = 'P0001', message = 'bd_active_person_company_violation';
  end if;
end $$;

do $install$
begin
  if to_regprocedure('public.bd_people_require_active_company()') is null then
    execute $ddl$
      create function public.bd_people_require_active_company()
      returns trigger
      language plpgsql
      security definer
      set search_path = pg_catalog, pg_temp
      as $function$
      begin
        if new.company_id is null then
          return new;
        end if;

        perform 1
        from public.bd_companies company_record
        where company_record.tenant_id = new.tenant_id
          and company_record.id = new.company_id
          and company_record.deleted_at is null
        for share;

        if not found then
          raise exception using
            errcode = 'P0001',
            message = 'bd_person_company_inactive';
        end if;

        return new;
      end;
      $function$
    $ddl$;
  end if;

  if to_regprocedure('public.bd_companies_guard_archive_people()') is null then
    execute $ddl$
      create function public.bd_companies_guard_archive_people()
      returns trigger
      language plpgsql
      security definer
      set search_path = pg_catalog, pg_temp
      as $function$
      begin
        if old.deleted_at is null
           and new.deleted_at is not null
           and exists (
             select 1
             from public.bd_people person_record
             where person_record.tenant_id = old.tenant_id
               and person_record.company_id = old.id
               and person_record.deleted_at is null
           ) then
          raise exception using
            errcode = 'P0001',
            message = 'bd_company_archive_active_people';
        end if;

        return new;
      end;
      $function$
    $ddl$;
  end if;
end;
$install$;

revoke all on function public.bd_people_require_active_company()
  from public, anon, authenticated, service_role;
revoke all on function public.bd_companies_guard_archive_people()
  from public, anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.bd_people'::regclass
      and tgname = 'trg_bd_people_active_company'
      and not tgisinternal
  ) then
    execute 'create trigger trg_bd_people_active_company before insert or update of company_id, tenant_id on public.bd_people for each row execute function public.bd_people_require_active_company()';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.bd_companies'::regclass
      and tgname = 'trg_bd_companies_archive_people'
      and not tgisinternal
  ) then
    execute 'create trigger trg_bd_companies_archive_people before update of deleted_at on public.bd_companies for each row execute function public.bd_companies_guard_archive_people()';
  end if;
end $$;

revoke update on table public.bd_activities from service_role;

-- Verify the exact table and column privilege boundary plus the installed
-- functions/triggers. Any mismatch rolls back the entire reconciliation.
do $$
declare
  activities_oid oid;
  activities_owner oid;
  activities_acl aclitem[];
  people_oid oid := 'public.bd_people'::regclass;
  people_owner oid;
  companies_oid oid := 'public.bd_companies'::regclass;
  companies_owner oid;
  service_role_oid oid := to_regrole('service_role');
  expected_function record;
  function_oid oid;
  checked_role text;
  checked_privilege text;
begin
  select table_definition.oid, table_definition.relowner, table_definition.relacl
    into activities_oid, activities_owner, activities_acl
  from pg_class table_definition
  join pg_namespace table_namespace on table_namespace.oid = table_definition.relnamespace
  where table_namespace.nspname = 'public'
    and table_definition.relname = 'bd_activities'
    and table_definition.relkind = 'r'
    and table_definition.relrowsecurity;
  select relowner into people_owner from pg_class where oid = people_oid;
  select relowner into companies_owner from pg_class where oid = companies_oid;

  if activities_oid is null then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_postflight_object_mismatch';
  end if;
  if not coalesce((select relrowsecurity from pg_class where oid = people_oid), false)
     or not coalesce((select relrowsecurity from pg_class where oid = companies_oid), false) then
    raise exception using errcode = 'P0001', message = 'bd_company_race_postflight_rls_required';
  end if;
  if exists (
    select 1
    from pg_attribute column_definition
    where column_definition.attrelid = activities_oid
      and column_definition.attnum > 0
      and not column_definition.attisdropped
      and column_definition.attacl is not null
  ) then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_postflight_column_acl_forbidden';
  end if;
  if (
    select array_agg(expanded_acl.privilege_type order by expanded_acl.privilege_type)
    from aclexplode(coalesce(activities_acl, acldefault('r', activities_owner))) expanded_acl
    where expanded_acl.grantee = service_role_oid
  ) is distinct from array['INSERT', 'SELECT']::text[] then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_direct_service_privileges_mismatch';
  end if;
  if exists (
    select 1
    from aclexplode(coalesce(activities_acl, acldefault('r', activities_owner))) expanded_acl
    where (expanded_acl.grantee = service_role_oid and expanded_acl.is_grantable)
       or (expanded_acl.grantee <> activities_owner and expanded_acl.grantee <> service_role_oid)
  ) then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_unreviewed_direct_privilege';
  end if;

  foreach checked_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ] loop
    if has_table_privilege('service_role', activities_oid, checked_privilege)
       is distinct from (checked_privilege in ('SELECT', 'INSERT')) then
      raise exception using errcode = 'P0001', message = 'bd_activity_acl_effective_service_privileges_mismatch';
    end if;
  end loop;
  if has_any_column_privilege('service_role', activities_oid, 'UPDATE')
     or has_any_column_privilege('service_role', activities_oid, 'REFERENCES') then
    raise exception using errcode = 'P0001', message = 'bd_activity_acl_effective_service_column_privilege_forbidden';
  end if;

  foreach checked_role in array array['anon', 'authenticated'] loop
    foreach checked_privilege in array array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] loop
      if has_table_privilege(checked_role, activities_oid, checked_privilege) then
        raise exception using errcode = 'P0001', message = 'bd_activity_acl_effective_browser_privilege_forbidden';
      end if;
    end loop;
    foreach checked_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
      if has_any_column_privilege(checked_role, activities_oid, checked_privilege) then
        raise exception using errcode = 'P0001', message = 'bd_activity_acl_effective_browser_column_privilege_forbidden';
      end if;
    end loop;
  end loop;

  for expected_function in
    select *
    from (values
      ('public.bd_people_require_active_company()', 'bd_people_require_active_company', people_owner, 'd1aced673b084dbeed85e8df798047a0'),
      ('public.bd_companies_guard_archive_people()', 'bd_companies_guard_archive_people', companies_owner, 'fc8d17b3b6ae68d9ba9fdfc3e15a2567')
    ) as expected(identity, function_name, function_owner, source_md5)
  loop
    function_oid := to_regprocedure(expected_function.identity);
    if function_oid is null or not exists (
      select 1
      from pg_proc function_definition
      join pg_namespace function_namespace on function_namespace.oid = function_definition.pronamespace
      join pg_language function_language on function_language.oid = function_definition.prolang
      where function_definition.oid = function_oid
        and function_namespace.nspname = 'public'
        and function_definition.proname = expected_function.function_name
        and function_definition.proowner = expected_function.function_owner
        and function_definition.prorettype = 'trigger'::regtype
        and function_definition.pronargs = 0
        and function_definition.prokind = 'f'
        and function_language.lanname = 'plpgsql'
        and function_definition.prosecdef
        and function_definition.provolatile = 'v'
        and function_definition.proparallel = 'u'
        and not function_definition.proleakproof
        and function_definition.proconfig = array['search_path=pg_catalog, pg_temp']::text[]
        and md5(regexp_replace(
          btrim(function_definition.prosrc, E' \t\n\r'),
          '[[:space:]]+', ' ', 'g'
        )) = expected_function.source_md5
        and not exists (
          select 1
          from aclexplode(coalesce(
            function_definition.proacl,
            acldefault('f', function_definition.proowner)
          )) expanded_acl
          where expanded_acl.grantee <> function_definition.proowner
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'bd_company_race_function_postflight_mismatch',
        detail = expected_function.identity;
    end if;
    foreach checked_role in array array['anon', 'authenticated', 'service_role'] loop
      if has_function_privilege(checked_role, function_oid, 'EXECUTE') then
        raise exception using
          errcode = 'P0001',
          message = 'bd_company_race_function_execute_forbidden',
          detail = expected_function.identity || ':' || checked_role;
      end if;
    end loop;
  end loop;

  function_oid := to_regprocedure('public.bd_people_require_active_company()');
  if not exists (
    select 1
    from pg_trigger trigger_definition
    where trigger_definition.tgrelid = people_oid
      and trigger_definition.tgname = 'trg_bd_people_active_company'
      and not trigger_definition.tgisinternal
      and trigger_definition.tgenabled = 'O'
      and trigger_definition.tgfoid = function_oid
      and trigger_definition.tgtype = 23
      and trigger_definition.tgqual is null
      and trigger_definition.tgnargs = 0
      and octet_length(trigger_definition.tgargs) = 0
      and trigger_definition.tgconstraint = 0
      and trigger_definition.tgconstrrelid = 0
      and not trigger_definition.tgdeferrable
      and not trigger_definition.tginitdeferred
      and cardinality(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[]) = 2
      and (select attribute.attnum from pg_attribute attribute
           where attribute.attrelid = people_oid and attribute.attname = 'company_id')
          = any(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[])
      and (select attribute.attnum from pg_attribute attribute
           where attribute.attrelid = people_oid and attribute.attname = 'tenant_id')
          = any(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[])
  ) then
    raise exception using errcode = 'P0001', message = 'bd_people_company_trigger_postflight_mismatch';
  end if;

  function_oid := to_regprocedure('public.bd_companies_guard_archive_people()');
  if not exists (
    select 1
    from pg_trigger trigger_definition
    where trigger_definition.tgrelid = companies_oid
      and trigger_definition.tgname = 'trg_bd_companies_archive_people'
      and not trigger_definition.tgisinternal
      and trigger_definition.tgenabled = 'O'
      and trigger_definition.tgfoid = function_oid
      and trigger_definition.tgtype = 19
      and trigger_definition.tgqual is null
      and trigger_definition.tgnargs = 0
      and octet_length(trigger_definition.tgargs) = 0
      and trigger_definition.tgconstraint = 0
      and trigger_definition.tgconstrrelid = 0
      and not trigger_definition.tgdeferrable
      and not trigger_definition.tginitdeferred
      and cardinality(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[]) = 1
      and (select attribute.attnum from pg_attribute attribute
           where attribute.attrelid = companies_oid and attribute.attname = 'deleted_at')
          = any(string_to_array(btrim(trigger_definition.tgattr::text), ' ')::smallint[])
  ) then
    raise exception using errcode = 'P0001', message = 'bd_company_archive_trigger_postflight_mismatch';
  end if;
end $$;

commit;
