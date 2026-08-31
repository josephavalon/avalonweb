-- PayOps authorization, dispute, immutability, and nurse-pay subledger controls.
-- All mutations are service-only SECURITY DEFINER RPCs. Provider sends, payroll
-- submission, tax filing, and period close remain separate human-approved gates.

do $$
begin
  if to_regclass('public.finance_role_assignments') is null
     or to_regclass('public.earning_disputes') is null
     or to_regclass('public.earning_dispute_events') is null
     or to_regclass('public.ledger_journals') is null
     or to_regclass('public.ledger_journal_events') is null
     or to_regprocedure('digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'payops_migrations_067_068_required';
  end if;
end $$;

alter table public.finance_role_assignments
  drop constraint if exists finance_role_assignments_finance_role_check;
alter table public.finance_role_assignments
  add constraint finance_role_assignments_finance_role_check check (finance_role in (
    'finance_maker', 'finance_checker', 'finance_executor', 'payroll_approver',
    'hr_legal', 'credentialing', 'accountant_controller', 'security_auditor'
  ));

drop index if exists public.finance_role_assignments_active_key;
create index if not exists finance_role_assignments_profile_period_idx
  on public.finance_role_assignments (tenant_id, profile_id, finance_role, effective_at, expires_at)
  where revoked_at is null;

create or replace function app_private.guard_finance_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Serialize every assignment mutation for a tenant/profile pair. This makes
  -- the overlap check safe under concurrent INSERT/revocation transactions.
  perform pg_advisory_xact_lock(hashtextextended(
    'payops:finance-role:'
      || case when tg_op = 'INSERT' then new.tenant_id::text else old.tenant_id::text end
      || ':'
      || case when tg_op = 'INSERT' then new.profile_id::text else old.profile_id::text end,
    0
  ));

  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.finance_role_assignments existing
      where existing.tenant_id = new.tenant_id
        and existing.profile_id = new.profile_id
        and existing.revoked_at is null
        and (
          existing.finance_role = new.finance_role
          or (existing.finance_role in ('finance_maker', 'finance_checker', 'finance_executor')
            and new.finance_role in ('finance_maker', 'finance_checker', 'finance_executor'))
        )
        and tstzrange(existing.effective_at, existing.expires_at, '[)')
          && tstzrange(new.effective_at, new.expires_at, '[)')
    ) then
      raise exception using errcode = '23505', message = 'finance_role_period_conflict';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'finance_role_assignment_delete_forbidden';
  end if;

  if old.tenant_id is distinct from new.tenant_id
     or old.profile_id is distinct from new.profile_id
     or old.finance_role is distinct from new.finance_role
     or old.assigned_by is distinct from new.assigned_by
     or old.reason_code is distinct from new.reason_code
     or old.assignment_key is distinct from new.assignment_key
     or old.effective_at is distinct from new.effective_at
     or old.expires_at is distinct from new.expires_at
     or old.created_at is distinct from new.created_at then
    raise exception using errcode = 'P0001', message = 'finance_role_assignment_identity_immutable';
  end if;
  if old.revoked_at is not null
     or new.revoked_at is null
     or new.revoked_by is null
     or new.revoke_reason_code is null
     or new.revocation_key is null
     or new.revocation_request_hash is null
     or new.version <> old.version + 1 then
    raise exception using errcode = 'P0001', message = 'finance_role_revocation_invalid';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_finance_role_assignment()
  from public, anon, authenticated, service_role;

drop trigger if exists finance_role_assignments_guarded on public.finance_role_assignments;
create trigger finance_role_assignments_guarded
  before insert or update or delete on public.finance_role_assignments
  for each row execute function app_private.guard_finance_role_assignment();

create or replace function public.assign_finance_role(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_finance_role text,
  p_reason_code text,
  p_assignment_key text,
  p_effective_at timestamptz,
  p_expires_at timestamptz
)
returns public.finance_role_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.finance_role_assignments%rowtype;
begin
  if p_finance_role not in (
    'finance_maker', 'finance_checker', 'finance_executor', 'payroll_approver', 'hr_legal',
    'credentialing', 'accountant_controller', 'security_auditor'
  ) or coalesce(p_reason_code, '') !~ '^[a-z0-9_]{3,80}$'
    or coalesce(p_assignment_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
    or p_effective_at is null
    or (p_expires_at is not null and p_expires_at <= p_effective_at) then
    raise exception using errcode = '22023', message = 'finance_role_assignment_invalid';
  end if;
  if not exists (
    select 1 from public.profiles actor
    where actor.tenant_id = p_tenant_id and actor.id = p_actor_profile_id
      and actor.status = 'active' and actor.role in ('admin', 'founder')
  ) then
    raise exception using errcode = '42501', message = 'finance_role_admin_required';
  end if;
  if not exists (
    select 1 from public.profiles target
    where target.tenant_id = p_tenant_id and target.id = p_target_profile_id
      and target.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'finance_operator_invalid';
  end if;

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'assign_finance_role', p_assignment_key
  );

  select * into v_assignment
  from public.finance_role_assignments assignment
  where assignment.tenant_id = p_tenant_id and assignment.assignment_key = p_assignment_key;
  if found then
    if v_assignment.profile_id <> p_target_profile_id
       or v_assignment.finance_role <> p_finance_role
       or v_assignment.assigned_by <> p_actor_profile_id
       or v_assignment.reason_code <> p_reason_code
       or v_assignment.effective_at <> p_effective_at
       or v_assignment.expires_at is distinct from p_expires_at then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_assignment;
  end if;

  insert into public.finance_role_assignments (
    tenant_id, profile_id, finance_role, assigned_by, reason_code,
    assignment_key, effective_at, expires_at
  ) values (
    p_tenant_id, p_target_profile_id, p_finance_role, p_actor_profile_id,
    p_reason_code, p_assignment_key, p_effective_at, p_expires_at
  ) returning * into v_assignment;

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'finance_role_assigned',
    'finance_role_assignments', v_assignment.id, false,
    encode(digest(jsonb_build_object(
      'profile_id', p_target_profile_id, 'finance_role', p_finance_role,
      'effective_at', p_effective_at, 'expires_at', p_expires_at,
      'assignment_key', p_assignment_key
    )::text, 'sha256'), 'hex'),
    jsonb_build_object(
      'profile_id', p_target_profile_id, 'finance_role', p_finance_role,
      'effective_at', p_effective_at, 'expires_at', p_expires_at
    )
  );
  return v_assignment;
end;
$$;

revoke all on function public.assign_finance_role(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.assign_finance_role(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz)
  to service_role;

create or replace function public.revoke_finance_role(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_assignment_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.finance_role_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.finance_role_assignments%rowtype;
  v_request_hash text;
begin
  if p_expected_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,80}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'finance_role_revocation_invalid';
  end if;
  if not exists (
    select 1 from public.profiles actor
    where actor.tenant_id = p_tenant_id and actor.id = p_actor_profile_id
      and actor.status = 'active' and actor.role in ('admin', 'founder')
  ) then
    raise exception using errcode = '42501', message = 'finance_role_admin_required';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'assignment_id', p_assignment_id,
    'expected_version', p_expected_version, 'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'revoke_finance_role', p_idempotency_key
  );

  select * into v_assignment
  from public.finance_role_assignments assignment
  where assignment.tenant_id = p_tenant_id and assignment.revocation_key = p_idempotency_key;
  if found then
    if v_assignment.id <> p_assignment_id or v_assignment.revocation_request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_assignment;
  end if;

  update public.finance_role_assignments
  set revoked_at = clock_timestamp(),
      revoked_by = p_actor_profile_id,
      revoke_reason_code = p_reason_code,
      revocation_key = p_idempotency_key,
      revocation_request_hash = v_request_hash,
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_assignment_id
    and version = p_expected_version and revoked_at is null
  returning * into v_assignment;
  if not found then
    raise exception using errcode = '40001', message = 'finance_role_version_conflict';
  end if;

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'finance_role_revoked',
    'finance_role_assignments', p_assignment_id, false, v_request_hash,
    jsonb_build_object(
      'profile_id', v_assignment.profile_id,
      'finance_role', v_assignment.finance_role,
      'reason_code', p_reason_code
    )
  );
  return v_assignment;
end;
$$;

revoke all on function public.revoke_finance_role(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.revoke_finance_role(uuid, uuid, uuid, integer, text, text)
  to service_role;

create or replace function public.open_earning_dispute(
  p_tenant_id uuid,
  p_worker_profile_id uuid,
  p_earning_event_id uuid,
  p_expected_earning_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.earning_disputes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_earning public.earning_events%rowtype;
  v_dispute public.earning_disputes%rowtype;
  v_owner_profile_id uuid;
  v_request_hash text;
begin
  if p_expected_earning_version < 1
     or p_reason_code not in (
       'time_missing', 'rate_question', 'mileage_missing', 'expense_missing',
       'calculation_question', 'other_pay_issue'
     )
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'earning_dispute_request_invalid';
  end if;
  if not exists (
    select 1 from public.profiles worker
    where worker.tenant_id = p_tenant_id and worker.id = p_worker_profile_id
      and worker.status = 'active' and worker.role in ('nurse', 'rn', 'np')
  ) then
    raise exception using errcode = '42501', message = 'nurse_pay_access_required';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'worker_profile_id', p_worker_profile_id,
    'earning_event_id', p_earning_event_id,
    'expected_earning_version', p_expected_earning_version,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'open_earning_dispute', p_idempotency_key
  );

  select * into v_dispute
  from public.earning_disputes dispute
  where dispute.tenant_id = p_tenant_id
    and dispute.opened_by = p_worker_profile_id
    and dispute.idempotency_key = p_idempotency_key;
  if found then
    if v_dispute.earning_event_id <> p_earning_event_id
       or v_dispute.earning_event_version <> p_expected_earning_version
       or v_dispute.reason_code <> p_reason_code
       or v_dispute.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_dispute;
  end if;

  select * into v_earning
  from public.earning_events earning
  where earning.tenant_id = p_tenant_id
    and earning.id = p_earning_event_id
    and earning.worker_profile_id = p_worker_profile_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'earning_not_found'; end if;
  if v_earning.version <> p_expected_earning_version then
    raise exception using errcode = '40001', message = 'earning_version_conflict';
  end if;

  select assignment.profile_id into v_owner_profile_id
  from public.finance_role_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.finance_role = 'finance_maker'
    and assignment.revoked_at is null
    and assignment.effective_at <= clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at > clock_timestamp())
  order by assignment.created_at
  limit 1;

  insert into public.earning_disputes (
    tenant_id, earning_event_id, earning_event_version, earning_calculation_hash,
    opened_by, reason_code, safe_detail, idempotency_key, request_hash,
    status, owner_profile_id
  ) values (
    p_tenant_id, v_earning.id, v_earning.version, v_earning.calculation_hash,
    p_worker_profile_id, p_reason_code, null, p_idempotency_key, v_request_hash,
    'OPEN', v_owner_profile_id
  ) returning * into v_dispute;

  insert into public.earning_dispute_events (
    tenant_id, dispute_id, from_status, to_status, actor_profile_id,
    dispute_version, reason_code, request_hash
  ) values (
    p_tenant_id, v_dispute.id, null, 'OPEN', p_worker_profile_id,
    v_dispute.version, 'NURSE_SUBMISSION', v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_worker_profile_id, 'nurse_earning_dispute_opened',
    'earning_disputes', v_dispute.id, false, v_request_hash,
    jsonb_build_object(
      'earning_event_id', v_earning.id,
      'earning_event_version', v_earning.version,
      'reason_code', p_reason_code
    )
  );
  return v_dispute;
end;
$$;

revoke all on function public.open_earning_dispute(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.open_earning_dispute(uuid, uuid, uuid, integer, text, text)
  to service_role;

-- State-bearing records freeze source identity and money while allowing only
-- their explicit lifecycle/status fields to advance through controlled RPCs.
create or replace function app_private.guard_finance_state_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'finance_state_record_delete_forbidden';
  end if;
  if tg_table_name = 'finance_integration_events' and (
    old.tenant_id is distinct from new.tenant_id
    or old.provider is distinct from new.provider
    or old.provider_event_id is distinct from new.provider_event_id
    or old.event_type is distinct from new.event_type
    or old.aggregate_type is distinct from new.aggregate_type
    or old.aggregate_id is distinct from new.aggregate_id
    or old.payload_checksum is distinct from new.payload_checksum
    or old.signature_valid is distinct from new.signature_valid
    or old.occurred_at is distinct from new.occurred_at
    or old.received_at is distinct from new.received_at
  ) then raise exception using errcode = 'P0001', message = 'finance_provider_event_identity_immutable'; end if;
  if tg_table_name = 'bank_statement_items' and (
    old.tenant_id is distinct from new.tenant_id
    or old.legal_entity_id is distinct from new.legal_entity_id
    or old.provider is distinct from new.provider
    or old.provider_account_id is distinct from new.provider_account_id
    or old.provider_transaction_id is distinct from new.provider_transaction_id
    or old.amount_cents is distinct from new.amount_cents
    or old.currency is distinct from new.currency
    or old.effective_date is distinct from new.effective_date
    or old.safe_description_code is distinct from new.safe_description_code
    or old.payload_checksum is distinct from new.payload_checksum
    or old.created_at is distinct from new.created_at
  ) then raise exception using errcode = 'P0001', message = 'bank_statement_identity_immutable'; end if;
  if tg_table_name = 'payroll_items' and (
    old.tenant_id is distinct from new.tenant_id
    or old.payroll_run_id is distinct from new.payroll_run_id
    or old.payroll_profile_id is distinct from new.payroll_profile_id
    or old.gusto_employee_id is distinct from new.gusto_employee_id
    or old.gross_cents is distinct from new.gross_cents
    or old.net_cents is distinct from new.net_cents
    or old.employee_tax_cents is distinct from new.employee_tax_cents
    or old.employer_tax_cents is distinct from new.employer_tax_cents
    or old.deduction_cents is distinct from new.deduction_cents
    or old.reimbursement_cents is distinct from new.reimbursement_cents
    or old.source_hash is distinct from new.source_hash
    or old.created_at is distinct from new.created_at
  ) then raise exception using errcode = 'P0001', message = 'payroll_item_money_immutable'; end if;
  if tg_table_name = 'payroll_liabilities' and (
    old.tenant_id is distinct from new.tenant_id
    or old.payroll_run_id is distinct from new.payroll_run_id
    or old.liability_type is distinct from new.liability_type
    or old.amount_cents is distinct from new.amount_cents
    or old.currency is distinct from new.currency
    or old.due_date is distinct from new.due_date
    or old.source_hash is distinct from new.source_hash
    or old.created_at is distinct from new.created_at
  ) then raise exception using errcode = 'P0001', message = 'payroll_liability_money_immutable'; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_finance_state_record()
  from public, anon, authenticated, service_role;

do $$
declare
  state_table text;
begin
  foreach state_table in array array[
    'finance_integration_events', 'bank_statement_items', 'payroll_items', 'payroll_liabilities'
  ] loop
    execute format('drop trigger if exists %I on public.%I', state_table || '_state_guard', state_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function app_private.guard_finance_state_record()',
      state_table || '_state_guard', state_table
    );
  end loop;
end $$;

create or replace function app_private.guard_ledger_entry_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal public.ledger_journals%rowtype;
  v_account public.ledger_accounts%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = 'P0001', message = 'ledger_entry_immutable';
  end if;
  select * into v_journal from public.ledger_journals journal
  where journal.tenant_id = new.tenant_id and journal.id = new.journal_id
  for share;
  select * into v_account from public.ledger_accounts account
  where account.tenant_id = new.tenant_id and account.id = new.account_id
  for share;
  if v_journal.id is null or v_journal.status <> 'DRAFT'
     or v_account.id is null or not v_account.active
     or v_account.legal_entity_id <> v_journal.legal_entity_id
     or v_account.chart_version_id <> v_journal.chart_version_id
     or v_account.effective_from > v_journal.posting_date
     or (v_account.effective_through is not null
       and v_account.effective_through < v_journal.posting_date)
     or new.currency <> v_journal.currency then
    raise exception using errcode = 'P0001', message = 'ledger_entry_context_invalid';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_ledger_entry_write()
  from public, anon, authenticated, service_role;

drop trigger if exists ledger_entries_draft_only on public.ledger_entries;
create trigger ledger_entries_draft_only
  before insert on public.ledger_entries
  for each row execute function app_private.guard_ledger_entry_write();

create or replace function app_private.prevent_posted_journal_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'ledger_journal_delete_forbidden';
  end if;
  if old.tenant_id is distinct from new.tenant_id
     or old.legal_entity_id is distinct from new.legal_entity_id
     or old.chart_version_id is distinct from new.chart_version_id
     or old.source_type is distinct from new.source_type
     or old.source_id is distinct from new.source_id
     or old.source_version is distinct from new.source_version
     or old.source_hash is distinct from new.source_hash
     or old.request_idempotency_key is distinct from new.request_idempotency_key
     or old.request_hash is distinct from new.request_hash
     or old.posting_date is distinct from new.posting_date
     or old.period_key is distinct from new.period_key
     or old.currency is distinct from new.currency
     or old.prepared_by is distinct from new.prepared_by
     or old.reversal_of_journal_id is distinct from new.reversal_of_journal_id
     or old.created_at is distinct from new.created_at then
    raise exception using errcode = 'P0001', message = 'ledger_journal_identity_immutable';
  end if;
  if old.status = 'REVERSED' then
    raise exception using errcode = 'P0001', message = 'reversed_journal_immutable';
  end if;
  if old.status = 'POSTED' and not (
    new.status = 'REVERSED'
    and old.reversed_by_journal_id is null
    and new.reversed_by_journal_id is not null
    and new.version = old.version + 1
    and old.total_debit_cents = new.total_debit_cents
    and old.total_credit_cents = new.total_credit_cents
    and old.approved_by = new.approved_by
    and old.posted_at = new.posted_at
  ) then
    raise exception using errcode = 'P0001', message = 'posted_journal_immutable';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_posted_journal_mutation()
  from public, anon, authenticated, service_role;

create or replace function public.prepare_ledger_journal(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_legal_entity_id uuid,
  p_chart_version_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_source_version integer,
  p_source_hash text,
  p_posting_date date,
  p_currency text,
  p_entries jsonb,
  p_idempotency_key text
)
returns public.ledger_journals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal public.ledger_journals%rowtype;
  v_chart public.ledger_chart_versions%rowtype;
  v_account public.ledger_accounts%rowtype;
  v_entry jsonb;
  v_ordinality bigint;
  v_account_id uuid;
  v_side text;
  v_amount bigint;
  v_memo text;
  v_debits bigint := 0;
  v_credits bigint := 0;
  v_request_hash text;
  v_period_key text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if coalesce(p_source_type, '') !~ '^[A-Z0-9_]{3,80}$'
     or p_source_version < 1
     or coalesce(p_source_hash, '') !~ '^[0-9a-f]{64}$'
     or p_posting_date is null
     or coalesce(p_currency, '') !~ '^[A-Z]{3}$'
     or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) < 2
     or jsonb_array_length(p_entries) > 100
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'ledger_journal_request_invalid';
  end if;
  v_period_key := to_char(p_posting_date, 'YYYY-MM');
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'actor_profile_id', p_actor_profile_id,
    'legal_entity_id', p_legal_entity_id, 'chart_version_id', p_chart_version_id,
    'source_type', p_source_type, 'source_id', p_source_id,
    'source_version', p_source_version, 'source_hash', p_source_hash,
    'posting_date', p_posting_date, 'currency', p_currency, 'entries', p_entries
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'ledger_journal_event', p_idempotency_key
  );
  select * into v_journal from public.ledger_journals journal
  where journal.tenant_id = p_tenant_id and journal.request_idempotency_key = p_idempotency_key;
  if found then
    if v_journal.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_journal;
  end if;
  if exists (
    select 1 from public.ledger_journal_events event
    where event.tenant_id = p_tenant_id and event.idempotency_key = p_idempotency_key
  ) then
    raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
  end if;

  select * into v_chart from public.ledger_chart_versions chart
  where chart.tenant_id = p_tenant_id and chart.id = p_chart_version_id
    and chart.legal_entity_id = p_legal_entity_id and chart.status = 'APPROVED'
    and chart.effective_from <= p_posting_date
  for share;
  if not found then raise exception using errcode = 'P0001', message = 'approved_chart_required'; end if;
  if exists (
    select 1 from public.period_closures closure
    where closure.tenant_id = p_tenant_id and closure.legal_entity_id = p_legal_entity_id
      and closure.period_key = v_period_key and closure.status = 'CLOSED'
  ) then raise exception using errcode = 'P0001', message = 'ledger_period_closed'; end if;

  for v_entry, v_ordinality in
    select value, ordinality from jsonb_array_elements(p_entries) with ordinality
  loop
    if jsonb_typeof(v_entry) <> 'object' or exists (
      select 1 from jsonb_object_keys(v_entry) as supplied(key)
      where supplied.key not in ('accountId', 'side', 'amountCents', 'memoCode')
    ) or coalesce(v_entry->>'accountId', '') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(v_entry->>'amountCents', '') !~ '^[0-9]{1,18}$' then
      raise exception using errcode = '22023', message = 'ledger_entry_request_invalid';
    end if;
    v_account_id := (v_entry->>'accountId')::uuid;
    v_side := upper(coalesce(v_entry->>'side', ''));
    v_amount := (v_entry->>'amountCents')::bigint;
    v_memo := nullif(upper(coalesce(v_entry->>'memoCode', '')), '');
    if v_side not in ('DEBIT', 'CREDIT') or v_amount <= 0
       or (v_memo is not null and v_memo !~ '^[A-Z0-9_]{3,100}$') then
      raise exception using errcode = '22023', message = 'ledger_entry_request_invalid';
    end if;
    select * into v_account from public.ledger_accounts account
    where account.tenant_id = p_tenant_id and account.id = v_account_id
      and account.chart_version_id = p_chart_version_id
      and account.legal_entity_id = p_legal_entity_id and account.active
      and account.effective_from <= p_posting_date
      and (account.effective_through is null or account.effective_through >= p_posting_date)
    for share;
    if not found then raise exception using errcode = 'P0001', message = 'ledger_account_context_invalid'; end if;
    if v_side = 'DEBIT' then v_debits := v_debits + v_amount;
    else v_credits := v_credits + v_amount; end if;
  end loop;
  if v_debits <= 0 or v_debits <> v_credits then
    raise exception using errcode = 'P0001', message = 'ledger_journal_unbalanced';
  end if;

  insert into public.ledger_journals (
    tenant_id, legal_entity_id, chart_version_id, source_type, source_id,
    source_version, source_hash, request_idempotency_key, request_hash,
    posting_date, period_key, currency, status, total_debit_cents,
    total_credit_cents, prepared_by
  ) values (
    p_tenant_id, p_legal_entity_id, p_chart_version_id, p_source_type, p_source_id,
    p_source_version, p_source_hash, p_idempotency_key, v_request_hash,
    p_posting_date, v_period_key, p_currency, 'DRAFT', v_debits, v_credits,
    p_actor_profile_id
  ) returning * into v_journal;

  for v_entry, v_ordinality in
    select value, ordinality from jsonb_array_elements(p_entries) with ordinality
  loop
    insert into public.ledger_entries (
      tenant_id, journal_id, account_id, line_number, entry_side,
      amount_cents, currency, safe_memo_code
    ) values (
      p_tenant_id, v_journal.id, (v_entry->>'accountId')::uuid,
      v_ordinality::integer, upper(v_entry->>'side'),
      (v_entry->>'amountCents')::bigint, p_currency,
      nullif(upper(coalesce(v_entry->>'memoCode', '')), '')
    );
  end loop;
  insert into public.ledger_journal_events (
    tenant_id, journal_id, event_type, actor_profile_id, journal_version,
    idempotency_key, request_hash, reason_code
  ) values (
    p_tenant_id, v_journal.id, 'PREPARED', p_actor_profile_id, v_journal.version,
    p_idempotency_key, v_request_hash, 'SOURCE_EVIDENCE_PREPARED'
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'ledger_journal_prepared',
    'ledger_journals', v_journal.id, false, v_request_hash,
    jsonb_build_object(
      'source_type', p_source_type, 'source_id', p_source_id,
      'source_version', p_source_version, 'period_key', v_period_key,
      'total_debit_cents', v_debits, 'total_credit_cents', v_credits
    )
  );
  return v_journal;
end;
$$;

revoke all on function public.prepare_ledger_journal(uuid, uuid, uuid, uuid, text, uuid, integer, text, date, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.prepare_ledger_journal(uuid, uuid, uuid, uuid, text, uuid, integer, text, date, text, jsonb, text)
  to service_role;

create or replace function public.post_ledger_journal(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_journal_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.ledger_journals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal public.ledger_journals%rowtype;
  v_original public.ledger_journals%rowtype;
  v_event public.ledger_journal_events%rowtype;
  v_debits bigint;
  v_credits bigint;
  v_count integer;
  v_total_count integer;
  v_request_hash text;
  v_original_event_key text;
  v_original_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['accountant_controller']::text[]
  );
  if p_expected_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'ledger_post_request_invalid';
  end if;
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'journal_id', p_journal_id,
    'expected_version', p_expected_version, 'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'ledger_journal_event', p_idempotency_key
  );
  select * into v_event from public.ledger_journal_events event
  where event.tenant_id = p_tenant_id and event.idempotency_key = p_idempotency_key;
  if found then
    if v_event.journal_id <> p_journal_id or v_event.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_journal from public.ledger_journals journal
    where journal.tenant_id = p_tenant_id and journal.id = p_journal_id;
    return v_journal;
  end if;

  select * into v_journal from public.ledger_journals journal
  where journal.tenant_id = p_tenant_id and journal.id = p_journal_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ledger_journal_not_found'; end if;
  if v_journal.version <> p_expected_version or v_journal.status <> 'DRAFT' then
    raise exception using errcode = '40001', message = 'ledger_journal_version_or_state_conflict';
  end if;
  if v_journal.prepared_by = p_actor_profile_id then
    raise exception using errcode = '42501', message = 'ledger_maker_checker_required';
  end if;
  if exists (
    select 1 from public.period_closures closure
    where closure.tenant_id = p_tenant_id and closure.legal_entity_id = v_journal.legal_entity_id
      and closure.period_key = v_journal.period_key and closure.status = 'CLOSED'
  ) then raise exception using errcode = 'P0001', message = 'ledger_period_closed'; end if;
  perform chart.id
  from public.ledger_chart_versions chart
  where chart.tenant_id = p_tenant_id and chart.id = v_journal.chart_version_id
    and chart.legal_entity_id = v_journal.legal_entity_id and chart.status = 'APPROVED'
    and chart.effective_from <= v_journal.posting_date
  for share;
  if not found then raise exception using errcode = 'P0001', message = 'approved_chart_required'; end if;

  -- Lock every referenced account before revalidating it. Account deactivation
  -- or effective-date edits must wait until this posting transaction completes.
  perform account.id
  from public.ledger_accounts account
  join (
    select distinct entry.account_id
    from public.ledger_entries entry
    where entry.tenant_id = p_tenant_id and entry.journal_id = p_journal_id
  ) referenced on referenced.account_id = account.id
  where account.tenant_id = p_tenant_id
  order by account.id
  for share of account;

  select count(*)::integer into v_total_count
  from public.ledger_entries entry
  where entry.tenant_id = p_tenant_id and entry.journal_id = p_journal_id;

  select
    coalesce(sum(entry.amount_cents) filter (where entry.entry_side = 'DEBIT'), 0),
    coalesce(sum(entry.amount_cents) filter (where entry.entry_side = 'CREDIT'), 0),
    count(*)::integer
  into v_debits, v_credits, v_count
  from public.ledger_entries entry
  join public.ledger_accounts account
    on account.tenant_id = entry.tenant_id and account.id = entry.account_id
  where entry.tenant_id = p_tenant_id and entry.journal_id = p_journal_id
    and account.legal_entity_id = v_journal.legal_entity_id
    and account.chart_version_id = v_journal.chart_version_id
    and account.active
    and account.effective_from <= v_journal.posting_date
    and (account.effective_through is null or account.effective_through >= v_journal.posting_date)
    and entry.currency = v_journal.currency;
  if v_total_count < 2 or v_count <> v_total_count
     or v_debits <= 0 or v_debits <> v_credits then
    raise exception using errcode = 'P0001', message = 'ledger_journal_unbalanced';
  end if;

  update public.ledger_journals
  set status = 'POSTED', total_debit_cents = v_debits, total_credit_cents = v_credits,
      approved_by = p_actor_profile_id, posted_at = clock_timestamp(), version = version + 1
  where tenant_id = p_tenant_id and id = p_journal_id and version = p_expected_version
  returning * into v_journal;
  if not found then raise exception using errcode = '40001', message = 'ledger_journal_version_or_state_conflict'; end if;

  insert into public.ledger_journal_events (
    tenant_id, journal_id, event_type, actor_profile_id, journal_version,
    idempotency_key, request_hash, reason_code
  ) values (
    p_tenant_id, p_journal_id, 'POSTED', p_actor_profile_id, v_journal.version,
    p_idempotency_key, v_request_hash, p_reason_code
  );

  if v_journal.reversal_of_journal_id is not null then
    select * into v_original from public.ledger_journals original
    where original.tenant_id = p_tenant_id and original.id = v_journal.reversal_of_journal_id
    for update;
    if not found or v_original.status <> 'POSTED' or v_original.reversed_by_journal_id is not null then
      raise exception using errcode = 'P0001', message = 'ledger_reversal_original_invalid';
    end if;
    update public.ledger_journals
    set status = 'REVERSED', reversed_by_journal_id = v_journal.id, version = version + 1
    where tenant_id = p_tenant_id and id = v_original.id and status = 'POSTED'
    returning * into v_original;
    v_original_event_key := encode(digest((p_idempotency_key || ':original')::text, 'sha256'), 'hex');
    v_original_request_hash := encode(digest(jsonb_build_object(
      'original_journal_id', v_original.id, 'reversal_journal_id', v_journal.id,
      'actor_profile_id', p_actor_profile_id
    )::text, 'sha256'), 'hex');
    insert into public.ledger_journal_events (
      tenant_id, journal_id, event_type, actor_profile_id, journal_version,
      idempotency_key, request_hash, reason_code
    ) values (
      p_tenant_id, v_original.id, 'REVERSED', p_actor_profile_id, v_original.version,
      v_original_event_key, v_original_request_hash, p_reason_code
    );
  end if;

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'ledger_journal_posted',
    'ledger_journals', p_journal_id, false, v_request_hash,
    jsonb_build_object(
      'journal_version', v_journal.version,
      'total_debit_cents', v_debits,
      'total_credit_cents', v_credits,
      'reason_code', p_reason_code
    )
  );
  return v_journal;
end;
$$;

revoke all on function public.post_ledger_journal(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.post_ledger_journal(uuid, uuid, uuid, integer, text, text)
  to service_role;

create or replace function public.prepare_ledger_reversal(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_original_journal_id uuid,
  p_posting_date date,
  p_reason_code text,
  p_idempotency_key text
)
returns public.ledger_journals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.ledger_journals%rowtype;
  v_reversal public.ledger_journals%rowtype;
  v_request_hash text;
  v_period_key text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_posting_date is null
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'ledger_reversal_request_invalid';
  end if;
  v_period_key := to_char(p_posting_date, 'YYYY-MM');
  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id, 'original_journal_id', p_original_journal_id,
    'posting_date', p_posting_date, 'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'ledger_journal_event', p_idempotency_key
  );
  select * into v_reversal from public.ledger_journals journal
  where journal.tenant_id = p_tenant_id and journal.request_idempotency_key = p_idempotency_key;
  if found then
    if v_reversal.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_reversal;
  end if;
  if exists (
    select 1 from public.ledger_journal_events event
    where event.tenant_id = p_tenant_id and event.idempotency_key = p_idempotency_key
  ) then
    raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
  end if;
  select * into v_original from public.ledger_journals original
  where original.tenant_id = p_tenant_id and original.id = p_original_journal_id
  for update;
  if not found or v_original.status <> 'POSTED' or v_original.reversed_by_journal_id is not null then
    raise exception using errcode = 'P0001', message = 'ledger_reversal_original_invalid';
  end if;
  if exists (
    select 1 from public.period_closures closure
    where closure.tenant_id = p_tenant_id and closure.legal_entity_id = v_original.legal_entity_id
      and closure.period_key = v_period_key and closure.status = 'CLOSED'
  ) then raise exception using errcode = 'P0001', message = 'ledger_period_closed'; end if;

  insert into public.ledger_journals (
    tenant_id, legal_entity_id, chart_version_id, source_type, source_id,
    source_version, source_hash, request_idempotency_key, request_hash,
    posting_date, period_key, currency, status, total_debit_cents,
    total_credit_cents, prepared_by, reversal_of_journal_id
  ) values (
    p_tenant_id, v_original.legal_entity_id, v_original.chart_version_id,
    'LEDGER_REVERSAL', v_original.id, v_original.version,
    encode(digest((v_original.source_hash || ':' || p_reason_code)::text, 'sha256'), 'hex'),
    p_idempotency_key, v_request_hash, p_posting_date, v_period_key,
    v_original.currency, 'DRAFT', v_original.total_credit_cents,
    v_original.total_debit_cents, p_actor_profile_id, v_original.id
  ) returning * into v_reversal;
  insert into public.ledger_entries (
    tenant_id, journal_id, account_id, line_number, entry_side,
    amount_cents, currency, safe_memo_code, source_ref
  )
  select entry.tenant_id, v_reversal.id, entry.account_id, entry.line_number,
    case entry.entry_side when 'DEBIT' then 'CREDIT' else 'DEBIT' end,
    entry.amount_cents, entry.currency, 'CONTROLLED_REVERSAL', entry.source_ref
  from public.ledger_entries entry
  where entry.tenant_id = p_tenant_id and entry.journal_id = v_original.id
  order by entry.line_number;
  insert into public.ledger_journal_events (
    tenant_id, journal_id, event_type, actor_profile_id, journal_version,
    idempotency_key, request_hash, reason_code
  ) values (
    p_tenant_id, v_reversal.id, 'PREPARED', p_actor_profile_id, v_reversal.version,
    p_idempotency_key, v_request_hash, p_reason_code
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'ledger_reversal_prepared',
    'ledger_journals', v_reversal.id, false, v_request_hash,
    jsonb_build_object(
      'original_journal_id', v_original.id,
      'posting_date', p_posting_date,
      'reason_code', p_reason_code
    )
  );
  return v_reversal;
end;
$$;

revoke all on function public.prepare_ledger_reversal(uuid, uuid, uuid, date, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_ledger_reversal(uuid, uuid, uuid, date, text, text)
  to service_role;

comment on function public.open_earning_dispute(uuid, uuid, uuid, integer, text, text) is
  'Opens one structured nurse pay dispute and atomically records immutable dispute and audit evidence.';
comment on function public.post_ledger_journal(uuid, uuid, uuid, integer, text, text) is
  'Checker-only balanced posting into the Avalon nurse-pay subledger. It is not complete company books.';
