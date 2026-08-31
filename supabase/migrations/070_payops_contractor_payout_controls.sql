-- Contractor payout preparation, independent checker approval, and durable
-- provider command authorization. No function in this migration contacts
-- Mercury or claims provider acceptance, settlement, or reconciliation.

do $$
begin
  if to_regclass('public.payout_approvals') is null
     or to_regclass('public.finance_integration_commands') is null
     or to_regprocedure('app_private.assert_payops_actor_role(uuid,uuid,text[])') is null then
    raise exception using errcode = 'P0001', message = 'payops_migrations_067_069_required';
  end if;
end $$;

create or replace function app_private.contractor_payout_proposal_hash(
  p_tenant_id uuid,
  p_payable_id uuid,
  p_payable_version integer,
  p_payee_profile_id uuid,
  p_payee_profile_version integer,
  p_tax_profile_id uuid,
  p_tax_profile_version integer,
  p_engagement_decision_id uuid,
  p_engagement_decision_version integer,
  p_legal_entity_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_mercury_recipient_id text,
  p_destination_snapshot_hash text,
  p_destination_masked_label text,
  p_funding_account_ref text,
  p_funding_account_masked_label text,
  p_send_mode text
)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'payable_id', p_payable_id,
    'payable_version', p_payable_version,
    'payee_profile_id', p_payee_profile_id,
    'payee_profile_version', p_payee_profile_version,
    'tax_profile_id', p_tax_profile_id,
    'tax_profile_version', p_tax_profile_version,
    'engagement_decision_id', p_engagement_decision_id,
    'engagement_decision_version', p_engagement_decision_version,
    'legal_entity_id', p_legal_entity_id,
    'amount_cents', p_amount_cents,
    'currency', p_currency,
    'mercury_recipient_id', p_mercury_recipient_id,
    'destination_snapshot_hash', p_destination_snapshot_hash,
    'destination_masked_label', p_destination_masked_label,
    'funding_account_ref', p_funding_account_ref,
    'funding_account_masked_label', p_funding_account_masked_label,
    'send_mode', p_send_mode
  )::text, 'sha256'), 'hex')
$$;

revoke all on function app_private.contractor_payout_proposal_hash(
  uuid, uuid, integer, uuid, integer, uuid, integer, uuid, integer, uuid,
  bigint, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function app_private.finance_command_checksum(p_safe_payload jsonb)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(extensions.digest(p_safe_payload::text, 'sha256'), 'hex')
$$;

revoke all on function app_private.finance_command_checksum(jsonb)
  from public, anon, authenticated, service_role;

create or replace function app_private.guard_payout_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'payout_record_delete_forbidden';
  end if;
  if tg_table_name = 'payout_batches' then
    if old.tenant_id is distinct from new.tenant_id
       or old.legal_entity_id is distinct from new.legal_entity_id
       or old.batch_key is distinct from new.batch_key
       or old.request_idempotency_key is distinct from new.request_idempotency_key
       or old.request_hash is distinct from new.request_hash
       or old.funding_account_ref is distinct from new.funding_account_ref
       or old.funding_account_masked_label is distinct from new.funding_account_masked_label
       or old.send_mode is distinct from new.send_mode
       or old.item_count is distinct from new.item_count
       or old.total_cents is distinct from new.total_cents
       or old.currency is distinct from new.currency
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception using errcode = 'P0001', message = 'payout_batch_identity_immutable';
    end if;
  elsif tg_table_name = 'payout_items' then
    if old.tenant_id is distinct from new.tenant_id
       or old.payout_batch_id is distinct from new.payout_batch_id
       or old.payable_id is distinct from new.payable_id
       or old.payable_version is distinct from new.payable_version
       or old.payee_profile_version is distinct from new.payee_profile_version
       or old.provider is distinct from new.provider
       or old.amount_cents is distinct from new.amount_cents
       or old.currency is distinct from new.currency
       or old.stable_request_key is distinct from new.stable_request_key
       or old.request_hash is distinct from new.request_hash
       or old.destination_snapshot_hash is distinct from new.destination_snapshot_hash
       or old.destination_masked_label is distinct from new.destination_masked_label
       or old.maker_prepared_by is distinct from new.maker_prepared_by
       or old.maker_prepared_at is distinct from new.maker_prepared_at
       or old.created_at is distinct from new.created_at then
      raise exception using errcode = 'P0001', message = 'payout_item_money_identity_immutable';
    end if;
  elsif tg_table_name = 'finance_integration_commands' then
    if old.tenant_id is distinct from new.tenant_id
       or old.provider is distinct from new.provider
       or old.command_type is distinct from new.command_type
       or old.aggregate_type is distinct from new.aggregate_type
       or old.aggregate_id is distinct from new.aggregate_id
       or old.stable_key is distinct from new.stable_key
       or old.request_checksum is distinct from new.request_checksum
       or old.safe_payload is distinct from new.safe_payload
       or old.correlation_id is distinct from new.correlation_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception using errcode = 'P0001', message = 'finance_command_identity_immutable';
    end if;

    if old.status is distinct from new.status
       and (
         (old.status = 'PENDING' and new.status not in ('CLAIMED', 'CANCELLED'))
         or old.status = 'CANCELLED'
         or (new.status = 'SENT' and old.status <> 'CLAIMED')
       ) then
      raise exception using errcode = 'P0001', message = 'finance_command_transition_invalid';
    end if;

  -- This is the final database-side worker gate immediately before provider
  -- work. A queued command cannot be claimed after a hold, role revocation,
  -- destination/tax/engagement change, or payload-checksum mismatch.
    if old.status is distinct from new.status and new.status = 'CLAIMED' then
      if old.status <> 'PENDING'
       or new.aggregate_type <> 'payout_item'
       or new.provider <> 'mercury'
       or new.command_type <> 'CREATE_APPROVAL_REQUEST'
       or new.request_checksum <> app_private.finance_command_checksum(new.safe_payload)
       or not exists (
         select 1
         from public.payout_items item
         join public.payout_batches batch
           on batch.tenant_id = item.tenant_id and batch.id = item.payout_batch_id
         join public.payables payable
           on payable.tenant_id = item.tenant_id and payable.id = item.payable_id
         join public.payee_profiles payee
           on payee.tenant_id = payable.tenant_id and payee.id = payable.payee_profile_id
         join public.tax_profiles tax
           on tax.tenant_id = payee.tenant_id and tax.payee_profile_id = payee.id
         join public.engagement_decisions engagement
           on engagement.tenant_id = payable.tenant_id
          and engagement.id = payable.engagement_decision_id
         where item.tenant_id = new.tenant_id
           and item.id = new.aggregate_id
           and item.status = 'PROVIDER_PENDING'
           and batch.status = 'PROCESSING'
           and batch.send_mode = 'approval_queue'
           and batch.created_by = item.maker_prepared_by
           and batch.checker_approved_by = item.checker_approved_by
           and payable.status = 'PAYOUT_REQUESTED'
           and payable.hold_code is null
           and payable.net_cents = item.amount_cents
           and payable.currency = item.currency
           and payee.version = item.payee_profile_version
           and payee.worker_profile_id = engagement.worker_profile_id
           and payee.legal_entity_id = engagement.legal_entity_id
           and batch.legal_entity_id = engagement.legal_entity_id
           and batch.item_count = 1
           and batch.total_cents = item.amount_cents
           and batch.currency = item.currency
           and payee.payment_readiness = 'ready'
           and payee.tax_readiness = 'ready'
           and payee.mercury_recipient_id is not null
           and payee.destination_masked_label is not null
           and tax.version is not distinct from payable.tax_profile_version
           and tax.w9_status = 'verified'
           and tax.tin_match_status in ('matched', 'manual_review')
           and (tax.tin_match_status <> 'manual_review' or (
             tax.reviewed_by is not null and tax.reviewed_at is not null
             and tax.tin_match_evidence_ref is not null
           ))
           and tax.backup_withholding_status in ('not_required', 'released')
           and (payee.destination_changed_at is null
             or (payee.destination_change_reviewed_at is not null
               and payee.destination_change_reviewed_by is not null
               and payee.destination_change_reviewed_at >= payee.destination_changed_at))
           and engagement.decision_status = 'CONTRACTOR_APPROVED'
           and engagement.version = payable.engagement_decision_version
           and engagement.effective_from <= current_date
           and (engagement.effective_through is null or engagement.effective_through >= current_date)
           and not exists (
             select 1
             from public.engagement_decisions newer
             where newer.tenant_id = engagement.tenant_id
               and newer.worker_profile_id = engagement.worker_profile_id
               and newer.legal_entity_id = engagement.legal_entity_id
               and newer.decided_at > engagement.decided_at
               and newer.effective_from <= current_date
               and (newer.effective_through is null or newer.effective_through >= current_date)
           )
           and exists (
             select 1
             from public.finance_role_assignments assignment
             where assignment.tenant_id = new.tenant_id
               and assignment.profile_id = new.created_by
               and assignment.finance_role = 'finance_executor'
               and assignment.revoked_at is null
               and assignment.effective_at <= clock_timestamp()
               and (assignment.expires_at is null or assignment.expires_at > clock_timestamp())
           )
           and exists (
             select 1
             from public.finance_role_assignments checker_assignment
             where checker_assignment.tenant_id = new.tenant_id
               and checker_assignment.profile_id = item.checker_approved_by
               and checker_assignment.finance_role = 'finance_checker'
               and checker_assignment.revoked_at is null
               and checker_assignment.effective_at <= clock_timestamp()
               and (checker_assignment.expires_at is null
                 or checker_assignment.expires_at > clock_timestamp())
           )
           and exists (
             select 1
             from public.payout_approvals checker_approval
             where checker_approval.tenant_id = item.tenant_id
               and checker_approval.payout_item_id = item.id
               and checker_approval.decision = 'APPROVED'
               and checker_approval.approval_role = 'finance_checker'
               and checker_approval.actor_profile_id = item.checker_approved_by
               and checker_approval.payout_item_version = item.version - 1
           )
           and exists (
             select 1
             from public.payout_approvals send_approval
             where send_approval.tenant_id = item.tenant_id
               and send_approval.payout_item_id = item.id
               and send_approval.decision = 'SEND_AUTHORIZED'
               and send_approval.approval_role = 'finance_executor'
               and send_approval.actor_profile_id = new.created_by
               and send_approval.payout_item_version = item.version - 1
           )
           and encode(extensions.digest(jsonb_build_object(
             'payee_profile_id', payee.id,
             'payee_profile_version', payee.version,
             'mercury_recipient_id', payee.mercury_recipient_id,
             'destination_masked_label', payee.destination_masked_label,
             'destination_changed_at', payee.destination_changed_at,
             'destination_change_reviewed_at', payee.destination_change_reviewed_at,
             'destination_change_reviewed_by', payee.destination_change_reviewed_by
           )::text, 'sha256'), 'hex') = item.destination_snapshot_hash
           and app_private.contractor_payout_proposal_hash(
             item.tenant_id, payable.id, item.payable_version,
             payee.id, payee.version, tax.id, tax.version,
             engagement.id, engagement.version, engagement.legal_entity_id,
             item.amount_cents, item.currency, payee.mercury_recipient_id,
             item.destination_snapshot_hash, payee.destination_masked_label,
             batch.funding_account_ref, batch.funding_account_masked_label, batch.send_mode
           ) = item.request_hash
           and item.request_hash = batch.request_hash
           and new.safe_payload->>'payout_item_id' = item.id::text
           and new.safe_payload->>'payable_id' = payable.id::text
           and new.safe_payload->>'payee_profile_id' = payee.id::text
           and new.safe_payload->>'legal_entity_id' = engagement.legal_entity_id::text
           and new.safe_payload->>'stable_request_key' = item.stable_request_key::text
           and new.safe_payload->>'proposal_hash' = item.request_hash
           and new.safe_payload->>'amount_cents' = item.amount_cents::text
           and new.safe_payload->>'currency' = item.currency
           and new.safe_payload->>'mercury_recipient_id' = payee.mercury_recipient_id
           and new.safe_payload->>'destination_snapshot_hash' = item.destination_snapshot_hash
           and new.safe_payload->>'destination_masked_label' = payee.destination_masked_label
           and new.safe_payload->>'funding_account_ref' = batch.funding_account_ref
           and new.safe_payload->>'funding_account_masked_label' = batch.funding_account_masked_label
           and new.safe_payload->>'send_mode' = batch.send_mode
         ) then
        raise exception using errcode = 'P0001', message = 'finance_command_worker_revalidation_failed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_payout_aggregate()
  from public, anon, authenticated, service_role;

do $$
declare
  guarded_table text;
begin
  foreach guarded_table in array array['payout_batches', 'payout_items', 'finance_integration_commands'] loop
    execute format('drop trigger if exists %I on public.%I', guarded_table || '_identity_guard', guarded_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function app_private.guard_payout_aggregate()',
      guarded_table || '_identity_guard', guarded_table
    );
  end loop;
end $$;

create or replace function public.prepare_contractor_payout(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payable_id uuid,
  p_expected_payable_version integer,
  p_funding_account_ref text,
  p_funding_account_masked_label text,
  p_idempotency_key text
)
returns public.payout_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payable public.payables%rowtype;
  v_payee public.payee_profiles%rowtype;
  v_tax public.tax_profiles%rowtype;
  v_engagement public.engagement_decisions%rowtype;
  v_batch public.payout_batches%rowtype;
  v_item public.payout_items%rowtype;
  v_request_hash text;
  v_destination_hash text;
  v_stable_request_key uuid;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_maker']::text[]
  );
  if p_expected_payable_version < 1
     or char_length(trim(coalesce(p_funding_account_ref, ''))) not between 3 and 200
     or char_length(trim(coalesce(p_funding_account_masked_label, ''))) not between 3 and 120
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payout_prepare_request_invalid';
  end if;

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'prepare_contractor_payout', p_idempotency_key
  );
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payable', p_payable_id);

  select item.* into v_item
  from public.payout_batches batch
  join public.payout_items item
    on item.tenant_id = batch.tenant_id and item.payout_batch_id = batch.id
  where batch.tenant_id = p_tenant_id
    and batch.request_idempotency_key = p_idempotency_key;
  if found then
    select * into v_batch from public.payout_batches batch
    where batch.tenant_id = p_tenant_id
      and batch.request_idempotency_key = p_idempotency_key;
    if v_item.payable_id <> p_payable_id
       or v_item.payable_version <> p_expected_payable_version
       or v_batch.created_by <> p_actor_profile_id
       or v_batch.funding_account_ref <> p_funding_account_ref
       or v_batch.funding_account_masked_label <> p_funding_account_masked_label
       or v_batch.send_mode <> 'approval_queue'
       or v_batch.request_hash <> v_item.request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_item;
  end if;

  select * into v_payable from public.payables payable
  where payable.tenant_id = p_tenant_id and payable.id = p_payable_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'payable_not_found'; end if;
  if v_payable.version <> p_expected_payable_version or v_payable.status <> 'APPROVED'
     or v_payable.hold_code is not null then
    raise exception using errcode = '40001', message = 'payable_not_ready_for_payout';
  end if;
  select * into v_payee from public.payee_profiles payee
  where payee.tenant_id = p_tenant_id and payee.id = v_payable.payee_profile_id
  for update;
  select * into v_tax from public.tax_profiles tax
  where tax.tenant_id = p_tenant_id and tax.payee_profile_id = v_payable.payee_profile_id
  for update;
  select * into v_engagement from public.engagement_decisions decision
  where decision.tenant_id = p_tenant_id and decision.id = v_payable.engagement_decision_id
    and decision.decision_status = 'CONTRACTOR_APPROVED'
    and decision.version = v_payable.engagement_decision_version
    and decision.effective_from <= current_date
    and (decision.effective_through is null or decision.effective_through >= current_date)
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
  if v_payee.id is null or v_tax.id is null or v_engagement.id is null
     or v_payee.worker_profile_id <> v_engagement.worker_profile_id
     or v_payee.legal_entity_id <> v_engagement.legal_entity_id
     or v_payee.version <> v_payable.payee_profile_version
     or v_tax.version is distinct from v_payable.tax_profile_version
     or v_payee.payment_readiness <> 'ready'
     or v_payee.tax_readiness <> 'ready'
     or v_payee.mercury_recipient_id is null
     or v_payee.destination_masked_label is null
     or v_tax.w9_status <> 'verified'
     or v_tax.tin_match_status not in ('matched', 'manual_review')
     or (v_tax.tin_match_status = 'manual_review' and (
       v_tax.reviewed_by is null or v_tax.reviewed_at is null or v_tax.tin_match_evidence_ref is null
     ))
     or v_tax.backup_withholding_status not in ('not_required', 'released')
     or (v_payee.destination_changed_at is not null and (
       v_payee.destination_change_reviewed_at is null
       or v_payee.destination_change_reviewed_by is null
       or v_payee.destination_change_reviewed_at < v_payee.destination_changed_at
     )) then
    raise exception using errcode = 'P0001', message = 'payout_authority_or_destination_not_ready';
  end if;
  if v_payable.net_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'payout_amount_invalid';
  end if;
  v_destination_hash := encode(extensions.digest(jsonb_build_object(
    'payee_profile_id', v_payee.id, 'payee_profile_version', v_payee.version,
    'mercury_recipient_id', v_payee.mercury_recipient_id,
    'destination_masked_label', v_payee.destination_masked_label,
    'destination_changed_at', v_payee.destination_changed_at,
    'destination_change_reviewed_at', v_payee.destination_change_reviewed_at,
    'destination_change_reviewed_by', v_payee.destination_change_reviewed_by
  )::text, 'sha256'), 'hex');
  v_request_hash := app_private.contractor_payout_proposal_hash(
    p_tenant_id, v_payable.id, v_payable.version,
    v_payee.id, v_payee.version, v_tax.id, v_tax.version,
    v_engagement.id, v_engagement.version, v_engagement.legal_entity_id,
    v_payable.net_cents, v_payable.currency, v_payee.mercury_recipient_id,
    v_destination_hash, v_payee.destination_masked_label,
    p_funding_account_ref, p_funding_account_masked_label, 'approval_queue'
  );
  v_stable_request_key := gen_random_uuid();

  insert into public.payout_batches (
    tenant_id, legal_entity_id, batch_key, request_idempotency_key, request_hash,
    funding_account_ref, funding_account_masked_label, send_mode, item_count,
    total_cents, currency, status, created_by
  ) values (
    p_tenant_id, v_engagement.legal_entity_id, v_stable_request_key::text,
    p_idempotency_key, v_request_hash, p_funding_account_ref,
    p_funding_account_masked_label, 'approval_queue', 1,
    v_payable.net_cents, v_payable.currency, 'APPROVAL_PENDING', p_actor_profile_id
  ) returning * into v_batch;
  insert into public.payout_items (
    tenant_id, payout_batch_id, payable_id, payable_version, payee_profile_version,
    provider, status, amount_cents, currency, stable_request_key, request_hash,
    destination_snapshot_hash, destination_masked_label, maker_prepared_by
  ) values (
    p_tenant_id, v_batch.id, v_payable.id, v_payable.version, v_payee.version,
    'mercury', 'APPROVAL_PENDING', v_payable.net_cents, v_payable.currency,
    v_stable_request_key, v_request_hash, v_destination_hash,
    v_payee.destination_masked_label, p_actor_profile_id
  ) returning * into v_item;
  update public.payables
  set status = 'READY', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_payable.id and version = v_payable.version;
  if not found then
    raise exception using errcode = '40001', message = 'payable_version_conflict';
  end if;
  insert into public.payout_events (
    tenant_id, payout_item_id, from_status, to_status, source,
    source_event_id, source_checksum, actor_profile_id, occurred_at,
    safe_reason_code
  ) values (
    p_tenant_id, v_item.id, null, 'APPROVAL_PENDING', 'local_command',
    p_idempotency_key, v_request_hash, p_actor_profile_id, clock_timestamp(),
    'FINANCE_MAKER_PREPARED'
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payout_prepared',
    'payout_items', v_item.id, false, v_request_hash,
    jsonb_build_object(
      'payable_id', v_payable.id, 'payable_version', v_payable.version,
      'amount_cents', v_payable.net_cents, 'currency', v_payable.currency,
      'legal_entity_id', v_engagement.legal_entity_id,
      'proposal_hash', v_request_hash,
      'funding_account_masked_label', p_funding_account_masked_label,
      'send_mode', 'approval_queue'
    )
  );
  return v_item;
end;
$$;

revoke all on function public.prepare_contractor_payout(uuid, uuid, uuid, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_contractor_payout(uuid, uuid, uuid, integer, text, text, text)
  to service_role;

create or replace function public.approve_contractor_payout(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payout_item_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.payout_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.payout_items%rowtype;
  v_batch public.payout_batches%rowtype;
  v_payable public.payables%rowtype;
  v_payee public.payee_profiles%rowtype;
  v_tax public.tax_profiles%rowtype;
  v_engagement public.engagement_decisions%rowtype;
  v_approval public.payout_approvals%rowtype;
  v_payable_id uuid;
  v_destination_hash text;
  v_proposal_hash text;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_checker']::text[]
  );
  if p_expected_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payout_approval_request_invalid';
  end if;

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'payout_approval', p_idempotency_key
  );
  select * into v_approval from public.payout_approvals approval
  where approval.tenant_id = p_tenant_id and approval.idempotency_key = p_idempotency_key;
  if found then
    if v_approval.payout_item_id <> p_payout_item_id
       or v_approval.actor_profile_id <> p_actor_profile_id
       or v_approval.reason_code <> p_reason_code
       or v_approval.decision <> 'APPROVED'
       or v_approval.approval_role <> 'finance_checker'
       or v_approval.payout_item_version <> p_expected_version + 1 then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    select * into v_item from public.payout_items item
    where item.tenant_id = p_tenant_id and item.id = p_payout_item_id;
    return v_item;
  end if;

  select item.payable_id into v_payable_id
  from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = p_payout_item_id;
  if not found then raise exception using errcode = 'P0002', message = 'payout_item_not_found'; end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payable', v_payable_id);

  select * into v_item from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = p_payout_item_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'payout_item_not_found'; end if;
  if v_item.version <> p_expected_version or v_item.status <> 'APPROVAL_PENDING' then
    raise exception using errcode = '40001', message = 'payout_item_version_or_state_conflict';
  end if;
  if v_item.maker_prepared_by = p_actor_profile_id then
    raise exception using errcode = '42501', message = 'payout_maker_checker_required';
  end if;
  select * into v_batch from public.payout_batches batch
  where batch.tenant_id = p_tenant_id and batch.id = v_item.payout_batch_id
  for update;
  select * into v_payable from public.payables payable
  where payable.tenant_id = p_tenant_id and payable.id = v_item.payable_id
  for update;
  select * into v_payee from public.payee_profiles payee
  where payee.tenant_id = p_tenant_id and payee.id = v_payable.payee_profile_id
  for update;
  select * into v_tax from public.tax_profiles tax
  where tax.tenant_id = p_tenant_id and tax.payee_profile_id = v_payable.payee_profile_id
  for update;
  select * into v_engagement from public.engagement_decisions decision
  where decision.tenant_id = p_tenant_id and decision.id = v_payable.engagement_decision_id
    and decision.decision_status = 'CONTRACTOR_APPROVED'
    and decision.version = v_payable.engagement_decision_version
    and decision.effective_from <= current_date
    and (decision.effective_through is null or decision.effective_through >= current_date)
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
  v_destination_hash := encode(extensions.digest(jsonb_build_object(
    'payee_profile_id', v_payee.id, 'payee_profile_version', v_payee.version,
    'mercury_recipient_id', v_payee.mercury_recipient_id,
    'destination_masked_label', v_payee.destination_masked_label,
    'destination_changed_at', v_payee.destination_changed_at,
    'destination_change_reviewed_at', v_payee.destination_change_reviewed_at,
    'destination_change_reviewed_by', v_payee.destination_change_reviewed_by
  )::text, 'sha256'), 'hex');
  v_proposal_hash := app_private.contractor_payout_proposal_hash(
    p_tenant_id, v_payable.id, v_item.payable_version,
    v_payee.id, v_payee.version, v_tax.id, v_tax.version,
    v_engagement.id, v_engagement.version, v_engagement.legal_entity_id,
    v_item.amount_cents, v_item.currency, v_payee.mercury_recipient_id,
    v_destination_hash, v_payee.destination_masked_label,
    v_batch.funding_account_ref, v_batch.funding_account_masked_label, v_batch.send_mode
  );
  if v_batch.id is null or v_batch.created_by = p_actor_profile_id
     or v_batch.status <> 'APPROVAL_PENDING'
     or v_batch.send_mode <> 'approval_queue'
     or v_batch.legal_entity_id <> v_engagement.legal_entity_id
     or v_batch.item_count <> 1
     or v_batch.total_cents <> v_item.amount_cents
     or v_batch.currency <> v_item.currency
     or v_payable.status <> 'READY' or v_payable.hold_code is not null
     or v_payable.version <> v_item.payable_version + 1
     or v_payable.net_cents <> v_item.amount_cents
     or v_payable.currency <> v_item.currency
     or v_engagement.id is null
     or v_payee.worker_profile_id <> v_engagement.worker_profile_id
     or v_payee.legal_entity_id <> v_engagement.legal_entity_id
     or v_payee.version <> v_item.payee_profile_version
     or v_payee.payment_readiness <> 'ready'
     or v_payee.tax_readiness <> 'ready'
     or v_payee.mercury_recipient_id is null
     or v_payee.destination_masked_label is null
     or v_tax.id is null
     or v_tax.version is distinct from v_payable.tax_profile_version
     or v_tax.w9_status <> 'verified'
     or v_tax.tin_match_status not in ('matched', 'manual_review')
     or (v_tax.tin_match_status = 'manual_review' and (
       v_tax.reviewed_by is null or v_tax.reviewed_at is null or v_tax.tin_match_evidence_ref is null
     ))
     or v_tax.backup_withholding_status not in ('not_required', 'released')
     or (v_payee.destination_changed_at is not null and (
       v_payee.destination_change_reviewed_at is null
       or v_payee.destination_change_reviewed_by is null
       or v_payee.destination_change_reviewed_at < v_payee.destination_changed_at
     ))
     or v_destination_hash <> v_item.destination_snapshot_hash
     or v_proposal_hash is null
     or v_proposal_hash <> v_item.request_hash
     or v_proposal_hash <> v_batch.request_hash then
    raise exception using errcode = 'P0001', message = 'payout_approval_snapshot_changed';
  end if;

  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'payout_item_id', p_payout_item_id,
    'expected_version', p_expected_version,
    'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code,
    'proposal_hash', v_proposal_hash
  )::text, 'sha256'), 'hex');

  update public.payout_items
  set status = 'READY', checker_approved_by = p_actor_profile_id,
      checker_approved_at = clock_timestamp(), version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_payout_item_id and version = p_expected_version
  returning * into v_item;
  if not found then
    raise exception using errcode = '40001', message = 'payout_item_version_or_state_conflict';
  end if;
  update public.payout_batches
  set status = 'READY', checker_approved_by = p_actor_profile_id,
      checker_approved_at = clock_timestamp(), version = version + 1,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_batch.id and status = 'APPROVAL_PENDING';
  if not found then
    raise exception using errcode = '40001', message = 'payout_batch_version_or_state_conflict';
  end if;
  insert into public.payout_approvals (
    tenant_id, payout_item_id, decision, approval_role, actor_profile_id,
    payout_item_version, idempotency_key, request_hash, reason_code
  ) values (
    p_tenant_id, v_item.id, 'APPROVED', 'finance_checker', p_actor_profile_id,
    v_item.version, p_idempotency_key, v_request_hash, p_reason_code
  );
  insert into public.payout_events (
    tenant_id, payout_item_id, from_status, to_status, source,
    source_event_id, source_checksum, actor_profile_id, occurred_at,
    safe_reason_code
  ) values (
    p_tenant_id, v_item.id, 'APPROVAL_PENDING', 'READY', 'local_command',
    p_idempotency_key, v_request_hash, p_actor_profile_id, clock_timestamp(),
    p_reason_code
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payout_approved',
    'payout_items', v_item.id, false, v_request_hash,
    jsonb_build_object(
      'payout_item_version', v_item.version,
      'amount_cents', v_item.amount_cents,
      'currency', v_item.currency,
      'legal_entity_id', v_engagement.legal_entity_id,
      'proposal_hash', v_proposal_hash,
      'reason_code', p_reason_code
    )
  );
  return v_item;
end;
$$;

revoke all on function public.approve_contractor_payout(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_contractor_payout(uuid, uuid, uuid, integer, text, text)
  to service_role;

create or replace function public.queue_contractor_payout_command(
  p_tenant_id uuid,
  p_actor_profile_id uuid,
  p_payout_item_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_idempotency_key text
)
returns public.finance_integration_commands
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.payout_items%rowtype;
  v_batch public.payout_batches%rowtype;
  v_payable public.payables%rowtype;
  v_payee public.payee_profiles%rowtype;
  v_tax public.tax_profiles%rowtype;
  v_engagement public.engagement_decisions%rowtype;
  v_command public.finance_integration_commands%rowtype;
  v_approval public.payout_approvals%rowtype;
  v_payable_id uuid;
  v_destination_hash text;
  v_proposal_hash text;
  v_command_checksum text;
  v_safe_payload jsonb;
  v_request_hash text;
begin
  perform app_private.assert_payops_actor_role(
    p_tenant_id, p_actor_profile_id, array['finance_executor']::text[]
  );
  if p_expected_version < 1
     or coalesce(p_reason_code, '') !~ '^[A-Z0-9_]{3,100}$'
     or coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$' then
    raise exception using errcode = '22023', message = 'payout_send_request_invalid';
  end if;

  perform app_private.lock_payops_idempotency(
    p_tenant_id, 'payout_approval', p_idempotency_key
  );
  select * into v_command from public.finance_integration_commands command
  where command.tenant_id = p_tenant_id and command.provider = 'mercury'
    and command.stable_key = p_idempotency_key;
  if found then
    select * into v_approval from public.payout_approvals approval
    where approval.tenant_id = p_tenant_id and approval.idempotency_key = p_idempotency_key;
    if v_command.aggregate_id <> p_payout_item_id
       or v_command.aggregate_type <> 'payout_item'
       or v_command.command_type <> 'CREATE_APPROVAL_REQUEST'
       or v_command.request_checksum <> app_private.finance_command_checksum(v_command.safe_payload)
       or v_approval.id is null
       or v_approval.payout_item_id <> p_payout_item_id
       or v_approval.actor_profile_id <> p_actor_profile_id
       or v_approval.reason_code <> p_reason_code
       or v_approval.decision <> 'SEND_AUTHORIZED'
       or v_approval.approval_role <> 'finance_executor'
       or v_approval.payout_item_version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
    end if;
    return v_command;
  end if;

  select * into v_approval from public.payout_approvals approval
  where approval.tenant_id = p_tenant_id and approval.idempotency_key = p_idempotency_key;
  if found then
    raise exception using errcode = 'P0001', message = 'idempotency_key_reused';
  end if;

  select item.payable_id into v_payable_id
  from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = p_payout_item_id;
  if not found then raise exception using errcode = 'P0002', message = 'payout_item_not_found'; end if;
  perform app_private.lock_payops_aggregate(p_tenant_id, 'payable', v_payable_id);

  select * into v_item from public.payout_items item
  where item.tenant_id = p_tenant_id and item.id = p_payout_item_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'payout_item_not_found'; end if;
  if v_item.version <> p_expected_version or v_item.status <> 'READY'
     or v_item.checker_approved_by is null
     or v_item.checker_approved_by = p_actor_profile_id
     or v_item.maker_prepared_by = p_actor_profile_id then
    raise exception using errcode = '40001', message = 'payout_send_authorization_invalid';
  end if;
  select * into v_batch from public.payout_batches batch
  where batch.tenant_id = p_tenant_id and batch.id = v_item.payout_batch_id
  for update;
  select * into v_payable from public.payables payable
  where payable.tenant_id = p_tenant_id and payable.id = v_item.payable_id
  for update;
  select * into v_payee from public.payee_profiles payee
  where payee.tenant_id = p_tenant_id and payee.id = v_payable.payee_profile_id
  for update;
  select * into v_tax from public.tax_profiles tax
  where tax.tenant_id = p_tenant_id and tax.payee_profile_id = v_payable.payee_profile_id
  for update;
  select * into v_engagement from public.engagement_decisions decision
  where decision.tenant_id = p_tenant_id and decision.id = v_payable.engagement_decision_id
    and decision.decision_status = 'CONTRACTOR_APPROVED'
    and decision.version = v_payable.engagement_decision_version
    and decision.effective_from <= current_date
    and (decision.effective_through is null or decision.effective_through >= current_date)
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
  v_destination_hash := encode(extensions.digest(jsonb_build_object(
    'payee_profile_id', v_payee.id, 'payee_profile_version', v_payee.version,
    'mercury_recipient_id', v_payee.mercury_recipient_id,
    'destination_masked_label', v_payee.destination_masked_label,
    'destination_changed_at', v_payee.destination_changed_at,
    'destination_change_reviewed_at', v_payee.destination_change_reviewed_at,
    'destination_change_reviewed_by', v_payee.destination_change_reviewed_by
  )::text, 'sha256'), 'hex');
  v_proposal_hash := app_private.contractor_payout_proposal_hash(
    p_tenant_id, v_payable.id, v_item.payable_version,
    v_payee.id, v_payee.version, v_tax.id, v_tax.version,
    v_engagement.id, v_engagement.version, v_engagement.legal_entity_id,
    v_item.amount_cents, v_item.currency, v_payee.mercury_recipient_id,
    v_destination_hash, v_payee.destination_masked_label,
    v_batch.funding_account_ref, v_batch.funding_account_masked_label, v_batch.send_mode
  );
  if v_batch.id is null or v_batch.status <> 'READY' or v_batch.send_mode <> 'approval_queue'
     or v_batch.created_by <> v_item.maker_prepared_by
     or v_batch.checker_approved_by <> v_item.checker_approved_by
     or v_batch.legal_entity_id <> v_engagement.legal_entity_id
     or v_batch.item_count <> 1
     or v_batch.total_cents <> v_item.amount_cents
     or v_batch.currency <> v_item.currency
     or v_payable.status <> 'READY' or v_payable.hold_code is not null
     or v_payable.version <> v_item.payable_version + 1
     or v_payable.net_cents <> v_item.amount_cents
     or v_payable.currency <> v_item.currency
     or v_engagement.id is null
     or v_payee.worker_profile_id <> v_engagement.worker_profile_id
     or v_payee.legal_entity_id <> v_engagement.legal_entity_id
     or v_payee.version <> v_item.payee_profile_version
     or v_payee.payment_readiness <> 'ready'
     or v_payee.tax_readiness <> 'ready'
     or v_payee.mercury_recipient_id is null
     or v_payee.destination_masked_label is null
     or v_tax.id is null
     or v_tax.version is distinct from v_payable.tax_profile_version
     or v_tax.w9_status <> 'verified'
     or v_tax.tin_match_status not in ('matched', 'manual_review')
     or (v_tax.tin_match_status = 'manual_review' and (
       v_tax.reviewed_by is null or v_tax.reviewed_at is null or v_tax.tin_match_evidence_ref is null
     ))
     or v_tax.backup_withholding_status not in ('not_required', 'released')
     or (v_payee.destination_changed_at is not null and (
       v_payee.destination_change_reviewed_at is null
       or v_payee.destination_change_reviewed_by is null
       or v_payee.destination_change_reviewed_at < v_payee.destination_changed_at
     ))
     or v_destination_hash <> v_item.destination_snapshot_hash
     or v_proposal_hash is null
     or v_proposal_hash <> v_item.request_hash
     or v_proposal_hash <> v_batch.request_hash
     or not exists (
       select 1
       from public.finance_role_assignments checker_assignment
       where checker_assignment.tenant_id = p_tenant_id
         and checker_assignment.profile_id = v_item.checker_approved_by
         and checker_assignment.finance_role = 'finance_checker'
         and checker_assignment.revoked_at is null
         and checker_assignment.effective_at <= clock_timestamp()
         and (checker_assignment.expires_at is null
           or checker_assignment.expires_at > clock_timestamp())
     )
     or not exists (
       select 1
       from public.payout_approvals checker_approval
       where checker_approval.tenant_id = p_tenant_id
         and checker_approval.payout_item_id = v_item.id
         and checker_approval.decision = 'APPROVED'
         and checker_approval.approval_role = 'finance_checker'
         and checker_approval.actor_profile_id = v_item.checker_approved_by
         and checker_approval.payout_item_version = v_item.version
     ) then
    raise exception using errcode = 'P0001', message = 'payout_send_snapshot_changed';
  end if;

  v_safe_payload := jsonb_build_object(
    'payout_item_id', v_item.id,
    'payable_id', v_payable.id,
    'payee_profile_id', v_payee.id,
    'legal_entity_id', v_engagement.legal_entity_id,
    'stable_request_key', v_item.stable_request_key,
    'proposal_hash', v_proposal_hash,
    'amount_cents', v_item.amount_cents,
    'currency', v_item.currency,
    'mercury_recipient_id', v_payee.mercury_recipient_id,
    'destination_snapshot_hash', v_destination_hash,
    'destination_masked_label', v_payee.destination_masked_label,
    'funding_account_ref', v_batch.funding_account_ref,
    'funding_account_masked_label', v_batch.funding_account_masked_label,
    'send_mode', v_batch.send_mode
  );
  v_command_checksum := app_private.finance_command_checksum(v_safe_payload);
  v_request_hash := encode(extensions.digest(jsonb_build_object(
    'tenant_id', p_tenant_id,
    'payout_item_id', p_payout_item_id,
    'expected_version', p_expected_version,
    'actor_profile_id', p_actor_profile_id,
    'reason_code', p_reason_code,
    'command_type', 'CREATE_APPROVAL_REQUEST',
    'command_checksum', v_command_checksum,
    'proposal_hash', v_proposal_hash
  )::text, 'sha256'), 'hex');

  insert into public.payout_approvals (
    tenant_id, payout_item_id, decision, approval_role, actor_profile_id,
    payout_item_version, idempotency_key, request_hash, reason_code
  ) values (
    p_tenant_id, v_item.id, 'SEND_AUTHORIZED', 'finance_executor', p_actor_profile_id,
    v_item.version, p_idempotency_key, v_request_hash, p_reason_code
  ) returning * into v_approval;
  insert into public.finance_integration_commands (
    tenant_id, provider, command_type, aggregate_type, aggregate_id,
    stable_key, request_checksum, safe_payload, status, created_by
  ) values (
    p_tenant_id, 'mercury', 'CREATE_APPROVAL_REQUEST', 'payout_item', v_item.id,
    p_idempotency_key, v_command_checksum, v_safe_payload,
    'PENDING', p_actor_profile_id
  ) returning * into v_command;
  update public.payout_items
  set status = 'PROVIDER_PENDING', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_item.id and version = v_item.version;
  if not found then
    raise exception using errcode = '40001', message = 'payout_item_version_or_state_conflict';
  end if;
  update public.payout_batches
  set status = 'PROCESSING', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_batch.id and status = 'READY';
  if not found then
    raise exception using errcode = '40001', message = 'payout_batch_version_or_state_conflict';
  end if;
  update public.payables
  set status = 'PAYOUT_REQUESTED', version = version + 1, updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = v_payable.id and status = 'READY';
  if not found then
    raise exception using errcode = '40001', message = 'payable_version_or_state_conflict';
  end if;
  insert into public.payout_events (
    tenant_id, payout_item_id, from_status, to_status, source,
    source_event_id, source_checksum, actor_profile_id, occurred_at,
    safe_reason_code
  ) values (
    p_tenant_id, v_item.id, 'READY', 'PROVIDER_PENDING', 'local_command',
    p_idempotency_key, v_command_checksum, p_actor_profile_id, clock_timestamp(),
    p_reason_code
  );
  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id, p_actor_profile_id, 'contractor_payout_command_authorized',
    'finance_integration_commands', v_command.id, false, v_request_hash,
    jsonb_build_object(
      'payout_item_id', v_item.id,
      'command_type', v_command.command_type,
      'amount_cents', v_item.amount_cents,
      'currency', v_item.currency,
      'legal_entity_id', v_engagement.legal_entity_id,
      'proposal_hash', v_proposal_hash,
      'command_checksum', v_command_checksum,
      'send_mode', v_batch.send_mode,
      'reason_code', p_reason_code
    )
  );
  return v_command;
end;
$$;

revoke all on function public.queue_contractor_payout_command(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.queue_contractor_payout_command(uuid, uuid, uuid, integer, text, text)
  to service_role;

comment on function public.queue_contractor_payout_command(uuid, uuid, uuid, integer, text, text) is
  'Creates an approved Mercury command intent only. Provider acceptance, bank movement, settlement, and reconciliation require later evidence.';
