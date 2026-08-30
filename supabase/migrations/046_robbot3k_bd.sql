-- RobBot3K: human-gated business-development research and outreach state.
--
-- These tables are intentionally server-only. The browser reaches them only
-- through authenticated admin APIs; anon/authenticated receive no table
-- privileges and there are no permissive RLS policies. `service_role` is the
-- only database role used by the server helpers.

create table if not exists public.robbot3k_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_type text not null check (run_type in ('refresh', 'outreach', 'webhook')),
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'schedule', 'webhook')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'skipped')),
  pacific_local_date date,
  source_url text,
  source_snapshot text,
  provider text,
  provider_status text,
  counts jsonb not null default '{}'::jsonb,
  error_code text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Vercel can invoke both 13:00 and 14:00 UTC to cover Pacific DST. Only one
-- scheduled refresh may be running or succeed for a given Pacific date.
-- Failed attempts leave the partial index and can be retried safely that day.
drop index if exists public.robbot3k_runs_daily_refresh_idx;
create unique index robbot3k_runs_daily_refresh_idx
  on public.robbot3k_runs (tenant_id, pacific_local_date)
  where run_type = 'refresh'
    and trigger_source = 'schedule'
    and pacific_local_date is not null
    and status in ('running', 'succeeded');

create table if not exists public.robbot3k_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  sender_display_name text,
  from_email text,
  reply_to_email text,
  calendly_url text,
  physical_postal_address text,
  provider_selection text not null default 'unconfigured'
    check (provider_selection in ('unconfigured', 'instantly')),
  provider_status text not null default 'not_configured'
    check (provider_status in ('not_configured', 'action_required', 'connected', 'disabled')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_email is null or char_length(from_email) <= 320),
  check (reply_to_email is null or char_length(reply_to_email) <= 320),
  check (sender_display_name is null or char_length(sender_display_name) <= 160),
  check (physical_postal_address is null or char_length(physical_postal_address) <= 500)
);

create table if not exists public.robbot3k_prospects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_kind text not null check (source_kind in ('atlas_event', 'atlas_target', 'manual')),
  source_id text not null,
  source_snapshot text,
  organization text not null,
  name text not null,
  segment text,
  location text,
  priority smallint not null default 1 check (priority between 1 and 3),
  verification text,
  qualification text,
  budget_signal text,
  research_summary text,
  fit_summary text,
  recommended_route text,
  public_sources jsonb not null default '[]'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  research_provider text not null default 'deterministic_source_only',
  research_status text not null default 'source_only'
    check (research_status in ('source_only', 'needs_evidence', 'enriched', 'failed')),
  draft_evidence jsonb not null default '[]'::jsonb,
  contact_name text,
  contact_role text,
  contact_email text,
  contact_manually_verified boolean not null default false,
  contact_verified_by uuid references public.profiles(id) on delete set null,
  contact_verified_at timestamptz,
  recipient_consent_status text not null default 'unknown'
    check (recipient_consent_status in ('unknown', 'opted_in', 'opted_out')),
  draft_subject text,
  draft_body text,
  draft_steps jsonb not null default '[]'::jsonb,
  draft_hash text,
  draft_source text not null default 'deterministic'
    check (draft_source in ('deterministic', 'manual')),
  status text not null default 'research'
    check (status in (
      'research', 'ready', 'approved', 'held', 'rejected', 'outreach',
      'replied', 'booked', 'suppressed', 'completed', 'archived'
    )),
  last_researched_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_kind, source_id),
  check (contact_email is null or char_length(contact_email) <= 320),
  check (draft_hash is null or draft_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists robbot3k_prospects_queue_idx
  on public.robbot3k_prospects (tenant_id, status, priority desc, updated_at desc);
create index if not exists robbot3k_prospects_email_idx
  on public.robbot3k_prospects (tenant_id, lower(contact_email))
  where contact_email is not null;

create table if not exists public.robbot3k_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid not null references public.robbot3k_prospects(id) on delete cascade,
  decision text not null check (decision in ('approved', 'held', 'rejected', 'revoked')),
  is_current boolean not null default true,
  approved_recipient text,
  approved_subject text,
  approved_body text,
  approved_steps jsonb not null default '[]'::jsonb,
  approved_evidence jsonb not null default '{}'::jsonb,
  approved_source_snapshot text,
  approved_draft_hash text,
  reason text,
  decided_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (approved_draft_hash is null or approved_draft_hash ~ '^[a-f0-9]{64}$'),
  check (decision <> 'approved' or expires_at is not null)
);

create unique index if not exists robbot3k_approvals_one_current_idx
  on public.robbot3k_approvals (prospect_id) where is_current;
create index if not exists robbot3k_approvals_history_idx
  on public.robbot3k_approvals (tenant_id, prospect_id, created_at desc);

create table if not exists public.robbot3k_sequences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid not null references public.robbot3k_prospects(id) on delete cascade,
  approval_id uuid not null references public.robbot3k_approvals(id) on delete restrict,
  status text not null default 'ready'
    check (status in ('ready', 'active', 'paused', 'replied', 'booked', 'completed', 'suppressed', 'cancelled')),
  cadence_days smallint[] not null default array[0, 3, 7, 14]::smallint[],
  current_step smallint not null default 0 check (current_step between 0 and 4),
  sent_count smallint not null default 0 check (sent_count between 0 and 4),
  started_at timestamptz not null default now(),
  next_due_at timestamptz,
  last_sent_at timestamptz,
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prospect_id, approval_id),
  check (cardinality(cadence_days) = 4 and cadence_days = array[0, 3, 7, 14]::smallint[])
);

create index if not exists robbot3k_sequences_due_idx
  on public.robbot3k_sequences (tenant_id, next_due_at)
  where status in ('ready', 'active');

create table if not exists public.robbot3k_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid not null references public.robbot3k_prospects(id) on delete cascade,
  sequence_id uuid references public.robbot3k_sequences(id) on delete set null,
  approval_id uuid references public.robbot3k_approvals(id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound', 'system')),
  channel text not null default 'email' check (channel in ('email', 'calendar', 'system')),
  step_index smallint check (step_index is null or step_index between 0 and 3),
  provider text,
  provider_message_id text,
  idempotency_key text not null,
  from_email text,
  to_email text,
  subject text,
  body text,
  status text not null
    check (status in ('queued', 'sending', 'sent', 'delivered', 'replied', 'bounced', 'failed', 'cancelled', 'blocked')),
  event_payload jsonb not null default '{}'::jsonb,
  error_code text,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create unique index if not exists robbot3k_messages_provider_id_idx
  on public.robbot3k_messages (provider, provider_message_id)
  where provider_message_id is not null;
create unique index if not exists robbot3k_messages_sequence_step_idx
  on public.robbot3k_messages (sequence_id, step_index)
  where sequence_id is not null and direction = 'outbound' and step_index is not null;

create table if not exists public.robbot3k_suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid references public.robbot3k_prospects(id) on delete set null,
  email text,
  domain text,
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'admin', 'recipient_request', 'other')),
  source text not null default 'admin',
  details jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (email is not null or domain is not null)
);

create unique index if not exists robbot3k_suppressions_email_idx
  on public.robbot3k_suppressions (tenant_id, lower(email)) where email is not null;
create unique index if not exists robbot3k_suppressions_domain_idx
  on public.robbot3k_suppressions (tenant_id, lower(domain)) where domain is not null;

create table if not exists public.robbot3k_meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid not null references public.robbot3k_prospects(id) on delete cascade,
  provider text not null default 'manual',
  external_id text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  scheduled_at timestamptz,
  booking_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists robbot3k_meetings_external_idx
  on public.robbot3k_meetings (tenant_id, provider, external_id)
  where external_id is not null;
create index if not exists robbot3k_meetings_prospect_idx
  on public.robbot3k_meetings (tenant_id, prospect_id, status, scheduled_at);

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'robbot3k_runs', 'robbot3k_settings', 'robbot3k_prospects', 'robbot3k_approvals',
    'robbot3k_sequences', 'robbot3k_messages', 'robbot3k_suppressions',
    'robbot3k_meetings'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
  end loop;
end $$;

-- Atomically bind a human approval to the locked prospect row, its exact
-- recipient/copy/evidence hash, and the bounded execution sequence. This RPC
-- is server-only and fails closed if any stop condition appeared after the
-- admin loaded the review screen.
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
  approval_id uuid;
  recipient text;
  recipient_domain text;
  evidence_snapshot jsonb;
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
    approved_source_snapshot, approved_draft_hash, reason, decided_by,
    expires_at
  ) values (
    p_tenant_id, p_prospect_id, 'approved', true, recipient,
    prospect_row.draft_steps -> 0 ->> 'subject',
    prospect_row.draft_steps -> 0 ->> 'body',
    prospect_row.draft_steps, evidence_snapshot,
    prospect_row.source_snapshot, p_expected_draft_hash,
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

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'robbot3k_settings', 'robbot3k_prospects', 'robbot3k_sequences', 'robbot3k_messages', 'robbot3k_meetings'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'trg_' || tbl || '_updated_at', tbl
    );
  end loop;
end $$;

comment on table public.robbot3k_approvals is
  'Human authorization of an exact outreach draft snapshot. Approval is not recipient consent.';
comment on table public.robbot3k_sequences is
  'Durable bounded state machine for day 0/3/7/14 outreach; no graph database is required.';
comment on column public.robbot3k_prospects.recipient_consent_status is
  'Separate recipient signal. Never infer opt-in from an Avalon operator approval.';
