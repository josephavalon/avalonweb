-- RobBot3K safety controls: fail-closed pause state and sender-bound approvals.

alter table public.robbot3k_settings
  add column if not exists global_pause boolean not null default true;

alter table public.robbot3k_approvals
  add column if not exists approved_sender_settings jsonb not null default '{}'::jsonb;

alter table public.robbot3k_approvals
  drop constraint if exists robbot3k_approvals_sender_settings_object;
alter table public.robbot3k_approvals
  add constraint robbot3k_approvals_sender_settings_object
  check (jsonb_typeof(approved_sender_settings) = 'object');

-- Existing approvals keep the empty default. The runtime treats an absent or
-- empty sender snapshot as a mismatch, so they fail closed without rewriting
-- production records during the migration.
create or replace function public.robbot3k_approve_prospect(
  p_tenant_id uuid,
  p_prospect_id uuid,
  p_actor_profile_id uuid,
  p_expected_draft_hash text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prospect_row public.robbot3k_prospects%rowtype;
  settings_row public.robbot3k_settings%rowtype;
  approval_id uuid;
  recipient text;
  recipient_domain text;
  evidence_snapshot jsonb;
  sender_snapshot jsonb;
  expected_days smallint[] := array[0, 3, 7, 14]::smallint[];
  step_index integer;
  step jsonb;
begin
  select *
  into prospect_row
  from public.robbot3k_prospects
  where id = p_prospect_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'prospect_not_found';
  end if;
  if prospect_row.status not in ('research', 'ready') then
    raise exception using errcode = 'P0001', message = 'prospect_not_approvable';
  end if;
  if p_expected_draft_hash is null
     or p_expected_draft_hash !~ '^[a-f0-9]{64}$'
     or prospect_row.draft_hash is distinct from p_expected_draft_hash then
    raise exception using errcode = 'P0001', message = 'reviewed_draft_changed';
  end if;

  recipient := lower(trim(coalesce(prospect_row.contact_email, '')));
  if recipient = ''
     or recipient !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
     or not prospect_row.contact_manually_verified then
    raise exception using errcode = 'P0001', message = 'verified_recipient_required';
  end if;

  if jsonb_typeof(prospect_row.public_sources) <> 'array'
     or jsonb_array_length(prospect_row.public_sources) = 0
     or (prospect_row.source_kind = 'atlas_event' and lower(coalesce(prospect_row.verification, '')) <> 'source_linked')
     or (
       prospect_row.source_kind <> 'atlas_event'
       and lower(coalesce(prospect_row.verification, '')) <> 'verified'
       and lower(coalesce(prospect_row.verification, '')) not like 'official%'
       and lower(coalesce(prospect_row.verification, '')) not like 'live-confirmed%'
     ) then
    raise exception using errcode = 'P0001', message = 'official_evidence_required';
  end if;

  if jsonb_typeof(prospect_row.draft_steps) <> 'array'
     or jsonb_array_length(prospect_row.draft_steps) <> 4 then
    raise exception using errcode = 'P0001', message = 'four_drafts_required';
  end if;

  for step_index in 0..3 loop
    step := prospect_row.draft_steps -> step_index;
    if coalesce(step ->> 'subject', '') = ''
       or coalesce(step ->> 'body', '') = ''
       or coalesce(step ->> 'day', step ->> 'delayDays', '') <> expected_days[step_index + 1]::text
       or lower(coalesce(step ->> 'body', '')) !~ '(no thanks|unsubscribe|stop hearing|we will stop|we.ll stop)' then
      raise exception using errcode = 'P0001', message = 'approved_step_invalid';
    end if;
  end loop;

  recipient_domain := split_part(recipient, '@', 2);
  if exists (
    select 1 from public.robbot3k_suppressions
    where tenant_id = p_tenant_id
      and (lower(email) = recipient or lower(domain) = recipient_domain)
  ) then
    raise exception using errcode = 'P0001', message = 'recipient_suppressed';
  end if;
  if exists (
    select 1 from public.robbot3k_messages
    where tenant_id = p_tenant_id and prospect_id = p_prospect_id and direction = 'inbound'
  ) or exists (
    select 1 from public.robbot3k_meetings
    where tenant_id = p_tenant_id and prospect_id = p_prospect_id and status in ('scheduled', 'completed')
  ) then
    raise exception using errcode = 'P0001', message = 'reply_or_booking_exists';
  end if;

  evidence_snapshot := jsonb_build_object(
    'sourceKind', coalesce(prospect_row.source_kind, ''),
    'sourceId', coalesce(prospect_row.source_id, ''),
    'sourceSnapshot', coalesce(prospect_row.source_snapshot, ''),
    'verification', coalesce(prospect_row.verification, ''),
    'researchSummary', coalesce(prospect_row.research_summary, ''),
    'fitSummary', coalesce(prospect_row.fit_summary, ''),
    'recommendedRoute', coalesce(prospect_row.recommended_route, ''),
    'publicSources', prospect_row.public_sources
  );

  select *
  into settings_row
  from public.robbot3k_settings
  where tenant_id = p_tenant_id
  for share;

  if not found
     or trim(coalesce(settings_row.sender_display_name, '')) = ''
     or trim(coalesce(settings_row.from_email, '')) = ''
     or trim(coalesce(settings_row.reply_to_email, '')) = ''
     or trim(coalesce(settings_row.calendly_url, '')) = ''
     or trim(coalesce(settings_row.physical_postal_address, '')) = '' then
    raise exception using errcode = 'P0001', message = 'sender_settings_required';
  end if;

  sender_snapshot := jsonb_build_object(
    'senderDisplayName', trim(coalesce(settings_row.sender_display_name, '')),
    'fromEmail', lower(trim(coalesce(settings_row.from_email, ''))),
    'replyToEmail', lower(trim(coalesce(settings_row.reply_to_email, ''))),
    'calendlyUrl', trim(coalesce(settings_row.calendly_url, '')),
    'physicalPostalAddress', trim(coalesce(settings_row.physical_postal_address, '')),
    'providerSelection', lower(trim(coalesce(settings_row.provider_selection, ''))),
    'providerStatus', lower(trim(coalesce(settings_row.provider_status, '')))
  );

  update public.robbot3k_approvals
  set is_current = false
  where prospect_id = p_prospect_id and tenant_id = p_tenant_id and is_current;

  update public.robbot3k_sequences
  set status = 'cancelled', stop_reason = 'superseded_by_new_approval'
  where prospect_id = p_prospect_id
    and tenant_id = p_tenant_id
    and status in ('ready', 'active', 'paused');

  insert into public.robbot3k_approvals (
    tenant_id, prospect_id, decision, is_current, approved_recipient,
    approved_subject, approved_body, approved_steps, approved_evidence,
    approved_source_snapshot, approved_draft_hash, approved_sender_settings,
    reason, decided_by, expires_at
  ) values (
    p_tenant_id, p_prospect_id, 'approved', true, recipient,
    prospect_row.draft_steps -> 0 ->> 'subject',
    prospect_row.draft_steps -> 0 ->> 'body',
    prospect_row.draft_steps, evidence_snapshot,
    prospect_row.source_snapshot, p_expected_draft_hash, sender_snapshot,
    left(p_reason, 1000), p_actor_profile_id, now() + interval '7 days'
  ) returning id into approval_id;

  insert into public.robbot3k_sequences (
    tenant_id, prospect_id, approval_id, status, cadence_days,
    current_step, sent_count, started_at, next_due_at
  ) values (
    p_tenant_id, p_prospect_id, approval_id, 'ready', expected_days,
    0, 0, now(), now()
  );

  update public.robbot3k_prospects
  set status = 'approved', updated_by = p_actor_profile_id
  where id = p_prospect_id and tenant_id = p_tenant_id;

  return approval_id;
end;
$$;

revoke all on function public.robbot3k_approve_prospect(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.robbot3k_approve_prospect(uuid, uuid, uuid, text, text) to service_role;

comment on column public.robbot3k_settings.global_pause is
  'Fail-closed operator kill switch. Live RobBot outreach is blocked unless explicitly false.';
comment on column public.robbot3k_approvals.approved_sender_settings is
  'Exact sender, reply-to, scheduling, postal, and provider snapshot authorized by the human approval.';
