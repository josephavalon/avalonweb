-- Atomic PayOps authority and contractor-payable transitions.
-- Provider send, settlement, tax filing, journal posting, and period close are
-- intentionally absent here and remain disabled until their own controlled RPCs.

do $$
begin
  if to_regclass('public.payables') is null
     or to_regclass('public.payee_profiles') is null
     or to_regclass('public.engagement_decisions') is null
     or to_regclass('public.finance_role_assignments') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('digest(text,text)') is null then
    raise exception using errcode = 'P0001', message = 'migration_067_required';
  end if;
end $$;

create or replace function app_private.assert_payops_actor_role(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_required_roles text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_tenant_id is null or p_actor_profile_id is null or cardinality(p_required_roles) = 0 then
    raise exception using errcode = '22023', message = 'finance_actor_role_input_invalid';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.tenant_id = p_tenant_id
      and profile.id = p_actor_profile_id
      and profile.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'finance_actor_inactive';
  end if;

  if not exists (
    select 1
    from public.finance_role_assignments assignment
    where assignment.tenant_id = p_tenant_id
      and assignment.profile_id = p_actor_profile_id
      and assignment.finance_role = any(p_required_roles)
      and assignment.effective_at <= clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at > clock_timestamp())
      and assignment.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'finance_role_required';
  end if;
end;
$$;

revoke all on function app_private.assert_payops_actor_role(uuid, uuid, text[])
  from public, anon, authenticated, service_role;

create or replace function app_private.lock_payops_idempotency(
  p_tenant_id uuid,
  p_namespace text,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_tenant_id is null
     or nullif(trim(coalesce(p_namespace, '')), '') is null
     or nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception using errcode = '22023', message = 'payops_idempotency_lock_input_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'payops:idempotency:' || p_tenant_id::text || ':' || p_namespace || ':' || p_idempotency_key,
    0
  ));
end;
$$;

revoke all on function app_private.lock_payops_idempotency(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function app_private.lock_payops_aggregate(
  p_tenant_id uuid,
  p_aggregate_type text,
  p_aggregate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_tenant_id is null
     or nullif(trim(coalesce(p_aggregate_type, '')), '') is null
     or p_aggregate_id is null then
    raise exception using errcode = '22023', message = 'payops_aggregate_lock_input_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'payops:aggregate:' || p_tenant_id::text || ':' || p_aggregate_type || ':' || p_aggregate_id::text,
    0
  ));
end;
$$;

revoke all on function app_private.lock_payops_aggregate(uuid, text, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.create_contractor_payable_from_invoice(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_expected_invoice_version integer,
  p_actor_profile_id uuid,
  p_idempotency_key text,
  p_due_date date
)
returns public.payables
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.nurse_invoices%rowtype;
  v_engagement public.engagement_decisions%rowtype;
  v_payee public.payee_profiles%rowtype;
  v_tax public.tax_profiles%rowtype;
  v_payable public.payables%rowtype;
  v_request_hash text;
  v_calculation_hash text;
  v_hold_code text;
  v_hold_owner uuid;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );

  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or p_expected_invoice_version < 1
     or p_due_date is null then
    raise exception using errcode = '22023', message = 'payable_request_invalid';
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'invoice_id', p_invoice_id,
    'invoice_version', p_expected_invoice_version,
    'due_date', p_due_date,
    'actor_profile_id', p_actor_profile_id
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'create_contractor_payable_from_invoice', p_idempotency_key
  );
  perform app_private.lock_payops_aggregate(p_tenant_id, 'nurse_invoice', p_invoice_id);

  select * into v_payable
  from public.payables payable
  where payable.tenant_id = p_tenant_id
    and payable.request_idempotency_key = p_idempotency_key;
  if found then
    if v_payable.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_payable;
  end if;

  select * into v_invoice
  from public.nurse_invoices invoice
  where invoice.tenant_id = p_tenant_id and invoice.id = p_invoice_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'invoice_not_found';
  end if;
  if v_invoice.version <> p_expected_invoice_version then
    raise exception using errcode = '40001', message = 'invoice_version_conflict';
  end if;
  if v_invoice.status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'invoice_not_approved';
  end if;
  if v_invoice.nurse_profile_id is null
     or v_invoice.identity_assurance <> 'admin_verified_shared_door'
     or v_invoice.identity_verified_by is null
     or v_invoice.identity_verified_at is null then
    raise exception using errcode = 'P0001', message = 'verified_nurse_identity_required';
  end if;
  if v_invoice.legal_entity_id is null then
    raise exception using errcode = 'P0001', message = 'invoice_legal_entity_required';
  end if;

  if v_invoice.payable_id is not null then
    select * into v_payable
    from public.payables payable
    where payable.tenant_id = p_tenant_id and payable.id = v_invoice.payable_id;
    if found and v_payable.source_invoice_version = v_invoice.version then
      return v_payable;
    end if;
    raise exception using errcode = 'P0001', message = 'invoice_payable_link_conflict';
  end if;

  select decision.* into v_engagement
  from public.engagement_decisions decision
  where decision.tenant_id = p_tenant_id
    and decision.worker_profile_id = v_invoice.nurse_profile_id
    and decision.legal_entity_id = v_invoice.legal_entity_id
    and decision.decision_status = 'CONTRACTOR_APPROVED'
    and decision.effective_from <= v_invoice.period_start
    and (decision.effective_through is null or decision.effective_through >= v_invoice.period_end)
    and not exists (
      select 1 from public.engagement_decisions newer
      where newer.tenant_id = decision.tenant_id
        and newer.worker_profile_id = decision.worker_profile_id
        and newer.legal_entity_id = decision.legal_entity_id
        and newer.decided_at > decision.decided_at
        and newer.effective_from <= v_invoice.period_end
        and (newer.effective_through is null or newer.effective_through >= v_invoice.period_start)
    )
  order by decision.decided_at desc
  limit 1
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'effective_contractor_decision_required';
  end if;

  select payee.* into v_payee
  from public.payee_profiles payee
  where payee.tenant_id = p_tenant_id
    and payee.worker_profile_id = v_invoice.nurse_profile_id
    and payee.legal_entity_id = v_engagement.legal_entity_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payee_profile_required';
  end if;

  select tax.* into v_tax
  from public.tax_profiles tax
  where tax.tenant_id = p_tenant_id and tax.payee_profile_id = v_payee.id
  for update;

  -- Tax calculation is intentionally not guessed. A required/active backup
  -- withholding profile needs an accountant-approved calculation policy before
  -- the payable can be released.
  if v_tax.id is null or v_payee.tax_readiness <> 'ready' then
    v_hold_code := 'TAX_READINESS_REQUIRED';
  elsif v_tax.backup_withholding_status in ('required', 'active', 'action_required') then
    v_hold_code := 'WITHHOLDING_POLICY_REVIEW_REQUIRED';
  elsif v_payee.payment_readiness <> 'ready' then
    v_hold_code := 'PAYMENT_DESTINATION_NOT_READY';
  elsif v_payee.destination_changed_at is not null
      and (v_payee.destination_change_reviewed_at is null
        or v_payee.destination_change_reviewed_by is null
        or v_payee.destination_change_reviewed_at < v_payee.destination_changed_at) then
    v_hold_code := 'DESTINATION_CHANGE_REVIEW_REQUIRED';
  end if;

  if v_hold_code is not null then
    select assignment.profile_id into v_hold_owner
    from public.finance_role_assignments assignment
    where assignment.tenant_id = p_tenant_id
      and assignment.finance_role = 'finance_maker'
      and assignment.revoked_at is null
      and assignment.effective_at <= clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at > clock_timestamp())
    order by (assignment.profile_id = p_actor_profile_id) desc, assignment.created_at
    limit 1;
    v_hold_owner := coalesce(v_hold_owner, p_actor_profile_id);
  end if;

  v_calculation_hash := encode(digest(jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_version', v_invoice.version,
    'request_hash', v_invoice.request_hash,
    'wages_cents', v_invoice.wages_cents,
    'reimbursements_cents', v_invoice.reimbursements_cents,
    'currency', v_invoice.currency,
    'engagement_decision_id', v_engagement.id,
    'engagement_decision_version', v_engagement.version,
    'payee_profile_id', v_payee.id,
    'payee_profile_version', v_payee.version,
    'tax_profile_id', v_tax.id,
    'tax_profile_version', v_tax.version,
    'legal_entity_id', v_invoice.legal_entity_id
  )::text, 'sha256'), 'hex');

  insert into public.payables (
    tenant_id, payee_profile_id, engagement_decision_id,
    source_invoice_id, source_invoice_version, request_idempotency_key, request_hash, status,
    gross_cents, reimbursement_cents, backup_withholding_cents,
    other_withholding_cents, net_cents, currency, due_date,
    calculation_hash, engagement_snapshot, engagement_decision_version,
    payee_profile_version, tax_profile_version, hold_code, hold_owner_profile_id
  ) values (
    p_tenant_id, v_payee.id, v_engagement.id,
    v_invoice.id, v_invoice.version, p_idempotency_key, v_request_hash,
    case when v_hold_code is null then 'OPEN' else 'HELD' end,
    v_invoice.wages_cents, v_invoice.reimbursements_cents, 0,
    0, v_invoice.wages_cents + v_invoice.reimbursements_cents,
    v_invoice.currency, p_due_date, v_calculation_hash,
    jsonb_build_object(
      'decision_id', v_engagement.id,
      'decision_status', v_engagement.decision_status,
      'jurisdiction', v_engagement.jurisdiction,
      'effective_from', v_engagement.effective_from,
      'effective_through', v_engagement.effective_through,
      'legal_entity_id', v_engagement.legal_entity_id
    ),
    v_engagement.version, v_payee.version, v_tax.version,
    v_hold_code, v_hold_owner
  )
  returning * into v_payable;

  if v_invoice.wages_cents > 0 then
    insert into public.payable_lines (
      tenant_id, payable_id, category, amount_cents, currency, source_hash
    ) values (
      p_tenant_id, v_payable.id, 'compensation', v_invoice.wages_cents,
      v_invoice.currency,
      encode(digest((v_calculation_hash || ':compensation')::text, 'sha256'), 'hex')
    );
  end if;
  if v_invoice.reimbursements_cents > 0 then
    insert into public.payable_lines (
      tenant_id, payable_id, category, amount_cents, currency, source_hash
    ) values (
      p_tenant_id, v_payable.id, 'reimbursement', v_invoice.reimbursements_cents,
      v_invoice.currency,
      encode(digest((v_calculation_hash || ':reimbursement')::text, 'sha256'), 'hex')
    );
  end if;

  update public.nurse_invoices
  set payable_id = v_payable.id,
      locked_version = v_invoice.version,
      locked_hash = v_calculation_hash
  where tenant_id = p_tenant_id and id = v_invoice.id and version = v_invoice.version;

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payable_created', 'payables', v_payable.id,
    false,
    encode(digest(jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_version', v_invoice.version,
      'calculation_hash', v_calculation_hash,
      'hold_code', v_hold_code
    )::text, 'sha256'), 'hex'),
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_version', v_invoice.version,
      'calculation_hash', v_calculation_hash,
      'hold_code', v_hold_code
    )
  );

  return v_payable;
exception
  when unique_violation then
    select * into v_payable
    from public.payables payable
    where payable.tenant_id = p_tenant_id
      and payable.request_idempotency_key = p_idempotency_key;
    if found and v_payable.request_hash = v_request_hash then return v_payable; end if;
    raise;
end;
$$;

revoke all on function public.create_contractor_payable_from_invoice(uuid, uuid, integer, uuid, text, date)
  from public, anon, authenticated;
grant execute on function public.create_contractor_payable_from_invoice(uuid, uuid, integer, uuid, text, date)
  to service_role;

create or replace function public.approve_contractor_payable(
  p_tenant_id uuid,
  p_payable_id uuid,
  p_expected_version integer,
  p_actor_profile_id uuid,
  p_idempotency_key text,
  p_reason_code text
)
returns public.payables
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payable public.payables%rowtype;
  v_engagement public.engagement_decisions%rowtype;
  v_payee public.payee_profiles%rowtype;
  v_tax public.tax_profiles%rowtype;
  v_request_hash text;
  v_line_gross bigint;
  v_line_reimbursement bigint;
  v_line_backup_withholding bigint;
  v_line_other_withholding bigint;
  v_line_adjustment bigint;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_expected_version < 1
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,80}$' then
    raise exception using errcode = '22023', message = 'payable_approval_invalid';
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'payable_id', p_payable_id,
    'expected_version', p_expected_version,
    'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'approve_contractor_payable', p_idempotency_key
  );
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payable', p_payable_id);

  select payable.* into v_payable
  from public.payable_approvals approval
  join public.payables payable
    on payable.tenant_id = approval.tenant_id and payable.id = approval.payable_id
  where approval.tenant_id = p_tenant_id
    and approval.idempotency_key = p_idempotency_key;
  if found then
    if v_payable.id <> p_payable_id or not exists (
      select 1 from public.payable_approvals replay
      where replay.tenant_id = p_tenant_id
        and replay.idempotency_key = p_idempotency_key
        and replay.request_hash = v_request_hash
    ) then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_payable;
  end if;

  select * into v_payable
  from public.payables payable
  where payable.tenant_id = p_tenant_id and payable.id = p_payable_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'payable_not_found'; end if;
  if v_payable.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'payable_version_conflict';
  end if;
  if v_payable.status <> 'OPEN' then
    raise exception using errcode = 'P0001', message = 'payable_not_open';
  end if;
  if v_payable.hold_code is not null then
    raise exception using errcode = 'P0001', message = 'payable_hold_unresolved';
  end if;

  select * into v_payee
  from public.payee_profiles payee
  where payee.tenant_id = p_tenant_id and payee.id = v_payable.payee_profile_id
  for update;
  select * into v_tax
  from public.tax_profiles tax
  where tax.tenant_id = p_tenant_id and tax.payee_profile_id = v_payable.payee_profile_id
  for update;
  select * into v_engagement
  from public.engagement_decisions decision
  where decision.tenant_id = p_tenant_id
    and decision.id = v_payable.engagement_decision_id
    and decision.decision_status = 'CONTRACTOR_APPROVED'
    and decision.version = v_payable.engagement_decision_version
    and not exists (
      select 1 from public.engagement_decisions newer
      where newer.tenant_id = decision.tenant_id
        and newer.worker_profile_id = decision.worker_profile_id
        and newer.legal_entity_id = decision.legal_entity_id
        and newer.decided_at > decision.decided_at
        and newer.effective_from <= current_date
        and (newer.effective_through is null or newer.effective_through >= current_date)
    )
  for update;
  if v_engagement.id is null
     or v_payee.worker_profile_id <> v_engagement.worker_profile_id
     or v_payee.legal_entity_id <> v_engagement.legal_entity_id
     or v_payee.version <> v_payable.payee_profile_version
     or v_tax.version is distinct from v_payable.tax_profile_version then
    raise exception using errcode = 'P0001', message = 'payable_authority_snapshot_changed';
  end if;
  if v_payee.payment_readiness <> 'ready' or v_payee.tax_readiness <> 'ready'
     or v_tax.id is null or v_tax.w9_status <> 'verified'
     or v_tax.tin_match_status not in ('matched', 'manual_review')
     or (v_tax.tin_match_status = 'manual_review' and (
       v_tax.reviewed_by is null or v_tax.reviewed_at is null or v_tax.tin_match_evidence_ref is null
     ))
     or v_tax.backup_withholding_status not in ('not_required', 'released')
     or v_payee.mercury_recipient_id is null
     or v_payee.destination_masked_label is null
     or (v_payee.destination_changed_at is not null and (
       v_payee.destination_change_reviewed_at is null
       or v_payee.destination_change_reviewed_by is null
       or v_payee.destination_change_reviewed_at < v_payee.destination_changed_at
     )) then
    raise exception using errcode = 'P0001', message = 'payee_tax_or_payment_not_ready';
  end if;

  select
    coalesce(sum(line.amount_cents) filter (where line.category = 'compensation'), 0),
    coalesce(sum(line.amount_cents) filter (where line.category = 'reimbursement'), 0),
    coalesce(sum(line.amount_cents) filter (where line.category = 'backup_withholding'), 0),
    coalesce(sum(line.amount_cents) filter (where line.category = 'other_withholding'), 0),
    coalesce(sum(line.amount_cents) filter (where line.category = 'adjustment'), 0)
  into v_line_gross, v_line_reimbursement, v_line_backup_withholding,
    v_line_other_withholding, v_line_adjustment
  from public.payable_lines line
  where line.tenant_id = p_tenant_id and line.payable_id = p_payable_id;
  if v_line_gross <> v_payable.gross_cents
     or v_line_reimbursement <> v_payable.reimbursement_cents
     or v_line_backup_withholding <> v_payable.backup_withholding_cents
     or v_line_other_withholding <> v_payable.other_withholding_cents
     or v_line_adjustment <> 0
     or v_payable.net_cents <> v_payable.gross_cents + v_payable.reimbursement_cents
       - v_payable.backup_withholding_cents - v_payable.other_withholding_cents then
    raise exception using errcode = 'P0001', message = 'payable_totals_do_not_reconcile';
  end if;

  update public.payables
  set status = 'APPROVED',
      maker_approved_by = p_actor_profile_id,
      maker_approved_at = clock_timestamp(),
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_payable_id and version = p_expected_version
  returning * into v_payable;
  if not found then raise exception using errcode = '40001', message = 'payable_version_conflict'; end if;

  insert into public.payable_approvals (
    tenant_id, payable_id, approval_role, decision, actor_profile_id,
    payable_version, calculation_hash, idempotency_key, request_hash, reason_code
  ) values (
    p_tenant_id, p_payable_id, 'finance_maker', 'APPROVED', p_actor_profile_id,
    v_payable.version, v_payable.calculation_hash, p_idempotency_key, v_request_hash, p_reason_code
  );

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payable_approved', 'payables', p_payable_id,
    false,
    encode(digest(jsonb_build_object(
      'payable_version', v_payable.version,
      'calculation_hash', v_payable.calculation_hash,
      'reason_code', p_reason_code
    )::text, 'sha256'), 'hex'),
    jsonb_build_object(
      'payable_version', v_payable.version,
      'calculation_hash', v_payable.calculation_hash,
      'reason_code', p_reason_code
    )
  );
  return v_payable;
end;
$$;

revoke all on function public.approve_contractor_payable(uuid, uuid, integer, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_contractor_payable(uuid, uuid, integer, uuid, text, text)
  to service_role;

create or replace function public.set_contractor_payable_hold(
  p_tenant_id uuid,
  p_payable_id uuid,
  p_expected_version integer,
  p_actor_profile_id uuid,
  p_idempotency_key text,
  p_hold_code text,
  p_owner_profile_id uuid
)
returns public.payables
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payable public.payables%rowtype;
  v_item public.payout_items%rowtype;
  v_batch public.payout_batches%rowtype;
  v_previous_item_status text;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker', 'finance_checker']::text[]
  );
  if p_expected_version < 1
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$'
     or coalesce(p_hold_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or p_owner_profile_id is null then
    raise exception using errcode = '22023', message = 'payable_hold_invalid';
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'payable_id', p_payable_id,
    'expected_version', p_expected_version,
    'actor_profile_id', p_actor_profile_id,
    'hold_code', p_hold_code,
    'owner_profile_id', p_owner_profile_id
  )::text, 'sha256'), 'hex');

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'set_contractor_payable_hold', p_idempotency_key
  );
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payable', p_payable_id);

  select payable.* into v_payable
  from public.payable_hold_events hold_event
  join public.payables payable
    on payable.tenant_id = hold_event.tenant_id and payable.id = hold_event.payable_id
  where hold_event.tenant_id = p_tenant_id
    and hold_event.idempotency_key = p_idempotency_key;
  if found then
    if v_payable.id <> p_payable_id or not exists (
      select 1 from public.payable_hold_events replay
      where replay.tenant_id = p_tenant_id
        and replay.idempotency_key = p_idempotency_key
        and replay.request_hash = v_request_hash
    ) then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_payable;
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.tenant_id = p_tenant_id and profile.id = p_owner_profile_id and profile.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'payable_hold_owner_invalid';
  end if;

  -- Use the same item -> batch -> payable lock order as payout approval and
  -- command authorization. The advisory payable lock also closes the race with
  -- payout preparation, which begins before a payout item exists.
  select * into v_item
  from public.payout_items item
  where item.tenant_id = p_tenant_id and item.payable_id = p_payable_id
  for update;
  if v_item.id is not null then
    select * into v_batch
    from public.payout_batches batch
    where batch.tenant_id = p_tenant_id and batch.id = v_item.payout_batch_id
    for update;
  end if;

  select * into v_payable
  from public.payables payable
  where payable.tenant_id = p_tenant_id and payable.id = p_payable_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'payable_not_found'; end if;
  if v_payable.version <> p_expected_version
     or v_payable.status in ('SETTLED', 'REVERSED', 'RETURNED') then
    raise exception using errcode = '40001', message = 'payable_version_or_state_conflict';
  end if;

  if v_item.id is not null then
    perform command.id
    from public.finance_integration_commands command
    where command.tenant_id = p_tenant_id
      and command.aggregate_type = 'payout_item'
      and command.aggregate_id = v_item.id
    order by command.id
    for update;

    if v_item.status not in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROVIDER_PENDING', 'CANCELLED')
       or (v_batch.id is not null and v_batch.status not in (
         'DRAFT', 'APPROVAL_PENDING', 'READY', 'PROCESSING', 'CANCELLED'
       ))
       or exists (
         select 1
         from public.finance_integration_commands command
         where command.tenant_id = p_tenant_id
           and command.aggregate_type = 'payout_item'
           and command.aggregate_id = v_item.id
           and command.status not in ('PENDING', 'CANCELLED')
       )
       or (v_item.status = 'PROVIDER_PENDING' and not exists (
         select 1
         from public.finance_integration_commands command
         where command.tenant_id = p_tenant_id
           and command.aggregate_type = 'payout_item'
           and command.aggregate_id = v_item.id
           and command.status in ('PENDING', 'CANCELLED')
       )) then
      raise exception using errcode = 'P0001', message = 'payout_dispatch_started_hold_requires_recovery';
    end if;

    update public.finance_integration_commands
    set status = 'CANCELLED',
        last_safe_error_code = 'PAYABLE_HELD_BEFORE_DISPATCH',
        updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and aggregate_type = 'payout_item'
      and aggregate_id = v_item.id
      and status = 'PENDING';

    if v_item.status <> 'CANCELLED' then
      v_previous_item_status := v_item.status;
      update public.payout_items
      set status = 'CANCELLED', version = version + 1, updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_item.id
        and status in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROVIDER_PENDING');
      if not found then
        raise exception using errcode = '40001', message = 'payout_item_hold_conflict';
      end if;

      insert into public.payout_events (
        tenant_id, payout_item_id, from_status, to_status, source,
        source_event_id, source_checksum, actor_profile_id, occurred_at,
        safe_reason_code
      ) values (
        p_tenant_id, v_item.id, v_previous_item_status, 'CANCELLED', 'human_recovery',
        p_idempotency_key, v_request_hash, p_actor_profile_id, clock_timestamp(),
        p_hold_code
      );
    end if;

    if v_batch.id is not null and v_batch.status <> 'CANCELLED' then
      update public.payout_batches
      set status = 'CANCELLED', version = version + 1, updated_at = clock_timestamp()
      where tenant_id = p_tenant_id and id = v_batch.id
        and status in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROCESSING');
      if not found then
        raise exception using errcode = '40001', message = 'payout_batch_hold_conflict';
      end if;
    end if;
  end if;

  update public.payables
  set status = 'HELD',
      hold_code = p_hold_code,
      hold_owner_profile_id = p_owner_profile_id,
      version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_payable_id
    and version = p_expected_version
    and status not in ('SETTLED', 'REVERSED', 'RETURNED')
  returning * into v_payable;
  if not found then raise exception using errcode = '40001', message = 'payable_version_or_state_conflict'; end if;

  insert into public.payable_hold_events (
    tenant_id, payable_id, actor_profile_id, owner_profile_id,
    hold_code, payable_version, idempotency_key, request_hash
  ) values (
    p_tenant_id, p_payable_id, p_actor_profile_id, p_owner_profile_id,
    p_hold_code, v_payable.version, p_idempotency_key, v_request_hash
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payable_held', 'payables', p_payable_id,
    false, v_request_hash,
    jsonb_build_object(
      'payable_version', v_payable.version,
      'hold_code', p_hold_code,
      'owner_profile_id', p_owner_profile_id
    )
  );
  return v_payable;
end;
$$;

revoke all on function public.set_contractor_payable_hold(uuid, uuid, integer, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_contractor_payable_hold(uuid, uuid, integer, uuid, text, text, uuid)
  to service_role;

comment on function public.create_contractor_payable_from_invoice(uuid, uuid, integer, uuid, text, date) is
  'Creates one tenant-safe contractor payable candidate from a locked approved invoice. It never sends money or claims settlement.';
comment on function public.approve_contractor_payable(uuid, uuid, integer, uuid, text, text) is
  'Finance-maker approval after recalculation and tax/payment readiness. It does not create or approve a payout.';
