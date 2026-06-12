-- Tighten launch RLS to minimum-necessary clinical access and align
-- reconciliation case constraints with the server failure taxonomy.

create or replace function app_private.is_assigned_provider(row_provider_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provider_profiles pp
    where pp.id = row_provider_profile_id
      and pp.profile_id = auth.uid()
      and pp.active = true
  );
$$;

create or replace function app_private.is_operator_or_clinical_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.is_operator() or app_private.is_clinical_authority();
$$;

create or replace function app_private.is_current_profile_person(row_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.people p
    where p.id = row_person_id
      and p.profile_id = auth.uid()
  );
$$;

create or replace function app_private.is_assigned_to_person(row_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where app_private.is_assigned_provider(a.provider_profile_id)
      and row_person_id in (
        a.appointment_owner_person_id,
        a.customer_person_id,
        a.patient_person_id,
        a.payer_person_id,
        a.member_person_id
      )
  )
  or exists (
    select 1
    from public.visits v
    where app_private.is_assigned_provider(v.provider_profile_id)
      and v.patient_person_id = row_person_id
  );
$$;

create or replace function app_private.can_read_appointment_id(row_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where a.id = row_appointment_id
      and (
        (
          app_private.same_tenant(a.tenant_id)
          and app_private.is_operator_or_clinical_authority()
        )
        or app_private.is_assigned_provider(a.provider_profile_id)
        or app_private.is_current_profile_person(a.appointment_owner_person_id)
        or app_private.is_current_profile_person(a.customer_person_id)
        or app_private.is_current_profile_person(a.patient_person_id)
        or app_private.is_current_profile_person(a.payer_person_id)
        or app_private.is_current_profile_person(a.member_person_id)
      )
  );
$$;

-- Appointment parties keep self access. Operators and clinical authorities keep
-- deliberate tenant-wide access. Nurses/providers are limited to assigned rows.
drop policy if exists "people read own or staff" on public.people;
drop policy if exists "people read own or assigned staff" on public.people;
create policy "people read own or assigned staff"
  on public.people for select
  using (
    profile_id = auth.uid()
    or (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_to_person(id)
  );

drop policy if exists "appointments party or staff read" on public.appointments;
drop policy if exists "appointments party assigned or authority read" on public.appointments;
create policy "appointments party assigned or authority read"
  on public.appointments for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_provider(provider_profile_id)
    or app_private.is_current_profile_person(appointment_owner_person_id)
    or app_private.is_current_profile_person(customer_person_id)
    or app_private.is_current_profile_person(patient_person_id)
    or app_private.is_current_profile_person(payer_person_id)
    or app_private.is_current_profile_person(member_person_id)
  );

drop policy if exists "visits party provider or staff read" on public.visits;
drop policy if exists "visits party assigned or authority read" on public.visits;
create policy "visits party assigned or authority read"
  on public.visits for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_provider(provider_profile_id)
    or app_private.is_current_profile_person(patient_person_id)
  );

drop policy if exists "consent signatures read party or clinical" on public.consent_signatures;
drop policy if exists "consent signatures read party assigned or authority" on public.consent_signatures;
create policy "consent signatures read party assigned or authority"
  on public.consent_signatures for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_provider(provider_profile_id)
    or app_private.is_current_profile_person(patient_person_id)
    or app_private.can_read_appointment_id(appointment_id)
  );

drop policy if exists "consent signatures insert party or clinical" on public.consent_signatures;
drop policy if exists "consent signatures insert party assigned or authority" on public.consent_signatures;
create policy "consent signatures insert party assigned or authority"
  on public.consent_signatures for insert
  with check (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_provider(provider_profile_id)
    or app_private.is_current_profile_person(patient_person_id)
    or app_private.can_read_appointment_id(appointment_id)
  );

drop policy if exists "clinical staff read" on public.medical_record_locks;
drop policy if exists "medical locks authority read" on public.medical_record_locks;
drop policy if exists "medical locks assigned or authority read" on public.medical_record_locks;
create policy "medical locks assigned or authority read"
  on public.medical_record_locks for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or exists (
      select 1
      from public.visits v
      where v.id = visit_id
        and (
          app_private.is_assigned_provider(v.provider_profile_id)
          or app_private.is_current_profile_person(v.patient_person_id)
        )
    )
  );

drop policy if exists "clinical staff read" on public.record_addenda;
drop policy if exists "record addenda authority read" on public.record_addenda;
drop policy if exists "record addenda assigned or authority read" on public.record_addenda;
create policy "record addenda assigned or authority read"
  on public.record_addenda for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or exists (
      select 1
      from public.visits v
      where v.id = visit_id
        and (
          app_private.is_assigned_provider(v.provider_profile_id)
          or app_private.is_current_profile_person(v.patient_person_id)
        )
    )
  );

drop policy if exists "clinical staff read" on public.medical_escalations;
drop policy if exists "medical escalations assigned or authority read" on public.medical_escalations;
create policy "medical escalations assigned or authority read"
  on public.medical_escalations for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_to_person(patient_person_id)
    or app_private.can_read_appointment_id(appointment_id)
  );

drop policy if exists "clinical staff read" on public.adverse_events;
drop policy if exists "adverse events assigned or authority read" on public.adverse_events;
create policy "adverse events assigned or authority read"
  on public.adverse_events for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or exists (
      select 1
      from public.visits v
      where v.id = visit_id
        and (
          app_private.is_assigned_provider(v.provider_profile_id)
          or app_private.is_current_profile_person(v.patient_person_id)
        )
    )
  );

drop policy if exists "clinical staff read" on public.do_not_treat_flags;
drop policy if exists "do not treat assigned or authority read" on public.do_not_treat_flags;
create policy "do not treat assigned or authority read"
  on public.do_not_treat_flags for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_to_person(patient_person_id)
    or app_private.is_current_profile_person(patient_person_id)
  );

drop policy if exists "tenant staff read" on public.bookings;
drop policy if exists "bookings appointment party assigned or authority read" on public.bookings;
create policy "bookings appointment party assigned or authority read"
  on public.bookings for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.can_read_appointment_id(appointment_id)
  );

drop policy if exists "tenant staff read" on public.reconciliation_cases;
drop policy if exists "reconciliation authority or assigned appointment read" on public.reconciliation_cases;
create policy "reconciliation authority or assigned appointment read"
  on public.reconciliation_cases for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.can_read_appointment_id(appointment_id)
  );

drop policy if exists "notifications party or staff read" on public.notification_messages;
drop policy if exists "notifications party assigned or authority read" on public.notification_messages;
create policy "notifications party assigned or authority read"
  on public.notification_messages for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or app_private.is_assigned_to_person(person_id)
    or exists (select 1 from public.people p where p.id = person_id and p.profile_id = auth.uid())
    or app_private.can_read_appointment_id(appointment_id)
  );

drop policy if exists "delivery proof staff read" on public.notification_delivery_events;
drop policy if exists "delivery proof notification authority read" on public.notification_delivery_events;
create policy "delivery proof notification authority read"
  on public.notification_delivery_events for select
  using (
    (
      app_private.same_tenant(tenant_id)
      and app_private.is_operator_or_clinical_authority()
    )
    or exists (
      select 1
      from public.notification_messages nm
      where nm.id = notification_id
        and (
          app_private.is_assigned_to_person(nm.person_id)
          or app_private.can_read_appointment_id(nm.appointment_id)
        )
    )
  );

-- Keep the database constraint in lockstep with api/_reconciliation.js.
do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.reconciliation_cases'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%case_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.reconciliation_cases drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.reconciliation_cases
  add constraint reconciliation_cases_case_type_check
  check (case_type in (
    'stripe_succeeded_acuity_failed',
    'acuity_succeeded_stripe_failed',
    'gfe_delayed',
    'gfe_denied',
    'nursys_unavailable',
    'webhook_missed',
    'webhook_duplicate',
    'refund_accounting_mismatch',
    'appointment_drift',
    'payroll_sync_failed',
    'finance_sync_failed',
    'crm_sync_failed',
    'operations_email_failed',
    'customer_email_failed'
  ));
