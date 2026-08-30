-- Reconcile least-privilege table ACLs for Nurse guided-shift installations
-- where migration 062 was already applied.

begin;

do $$
declare
  v_table text;
  v_tables constant text[] := array[
    'provider_work_preferences', 'nurse_shift_domain_evidence',
    'nurse_shift_readiness_snapshots', 'nurse_offer_counters', 'nurse_offer_terms',
    'shift_guide_templates', 'shift_guide_versions',
    'mobile_shift_runs', 'mobile_shift_time_events',
    'mobile_shift_step_events', 'shift_exceptions'
  ];
begin
  if to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception using errcode = 'P0001', message = 'supabase_data_api_roles_required';
  end if;

  -- Preflight the complete table set before changing any ACL or RLS flag.
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception using
        errcode = 'P0001',
        message = 'nurse_guided_shift_tables_required',
        detail = format('missing public.%I', v_table);
    end if;
  end loop;

  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      v_table
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to service_role',
      v_table
    );
  end loop;
end $$;

commit;
