-- Avalon BD: tenant-scoped B2B system of record.
--
-- The browser never talks to these tables directly. Authenticated Avalon
-- admins use /api/admin/bd and the server uses the service role. Future agent
-- callers must be issued an explicit bd_agent_identity + permission row and
-- must record every mutation in bd_agent_mutations.

create table if not exists public.bd_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 240),
  normalized_name text not null check (normalized_name = lower(trim(normalized_name))),
  logo_url text,
  website_url text,
  normalized_domain text,
  company_type text not null default 'Other' check (company_type in (
    'Venue', 'Festival', 'Hotel', 'Record Label', 'Corporate', 'Fitness',
    'Wellness', 'Hospitality', 'Sports', 'Brand', 'Agency', 'Healthcare', 'Other'
  )),
  industry text,
  location text,
  company_size text,
  description text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  relationship_status text not null default 'unknown' check (relationship_status in (
    'unknown', 'cold', 'warm', 'active', 'partner', 'dormant', 'do_not_contact'
  )),
  source text not null default 'manual',
  fit_score smallint check (fit_score between 0 and 100),
  estimated_opportunity_value_cents bigint check (estimated_opportunity_value_cents >= 0),
  last_touch_at timestamptz,
  next_action text,
  next_action_date date,
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 30),
  version integer not null default 1 check (version > 0),
  merged_into_id uuid,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_by_agent_id uuid,
  updated_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, merged_into_id) references public.bd_companies(tenant_id, id) on delete restrict,
  check (normalized_domain is null or (
    normalized_domain = lower(trim(normalized_domain))
    and normalized_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  )),
  check (merged_into_id is null or merged_into_id <> id)
);

create unique index if not exists bd_companies_domain_unique_idx
  on public.bd_companies (tenant_id, normalized_domain)
  where normalized_domain is not null and deleted_at is null;
create unique index if not exists bd_companies_name_no_domain_unique_idx
  on public.bd_companies (tenant_id, normalized_name)
  where normalized_domain is null and deleted_at is null;
create index if not exists bd_companies_name_idx
  on public.bd_companies (tenant_id, normalized_name) where deleted_at is null;
create index if not exists bd_companies_attention_idx
  on public.bd_companies (tenant_id, next_action_date, fit_score desc) where deleted_at is null;

create table if not exists public.bd_agent_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_key text not null check (agent_key ~ '^[a-z0-9]+(?:[_-][a-z0-9]+)*$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  status text not null default 'disabled' check (status in ('active', 'disabled', 'revoked')),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, agent_key)
);

-- These foreign keys are added after bd_agent_identities exists. Catalog
-- checks are scoped to both constraint name and owning table so a normal rerun
-- cannot collide with the named constraints and cannot be fooled by the same
-- constraint name on another relation.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bd_companies'::regclass
      and conname = 'bd_companies_created_agent_fk'
  ) then
    alter table public.bd_companies
      add constraint bd_companies_created_agent_fk
      foreign key (tenant_id, created_by_agent_id)
      references public.bd_agent_identities(tenant_id, id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bd_companies'::regclass
      and conname = 'bd_companies_updated_agent_fk'
  ) then
    alter table public.bd_companies
      add constraint bd_companies_updated_agent_fk
      foreign key (tenant_id, updated_by_agent_id)
      references public.bd_agent_identities(tenant_id, id) on delete restrict;
  end if;
end $$;

create table if not exists public.bd_agent_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_identity_id uuid not null,
  object_type text not null check (object_type in (
    'company', 'person', 'opportunity', 'activity', 'task', 'note', 'file', 'list', 'call_ingestion', 'robbot_prospect'
  )),
  action text not null check (action ~ '^[a-z][a-z0-9_]{1,63}$'),
  permission_state text not null default 'denied' check (permission_state in ('allowed', 'approval_required', 'denied')),
  constraints jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_identity_id, object_type, action),
  foreign key (tenant_id, agent_identity_id) references public.bd_agent_identities(tenant_id, id) on delete cascade
);

create table if not exists public.bd_people (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid,
  full_name text not null check (char_length(trim(full_name)) between 1 and 240),
  normalized_full_name text not null check (normalized_full_name = lower(trim(normalized_full_name))),
  title text,
  email text,
  normalized_email text,
  phone text,
  linkedin_url text,
  social_profiles jsonb not null default '{}'::jsonb,
  location text,
  relationship_strength text not null default 'unknown' check (relationship_strength in (
    'unknown', 'cold', 'warm', 'strong'
  )),
  decision_maker_status text not null default 'unknown' check (decision_maker_status in (
    'unknown', 'influencer', 'decision_maker', 'champion', 'blocker'
  )),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  source text not null default 'manual',
  last_contact_at timestamptz,
  next_action text,
  next_action_date date,
  notes_summary text,
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 30),
  version integer not null default 1 check (version > 0),
  merged_into_id uuid,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_by_agent_id uuid,
  updated_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, updated_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, merged_into_id) references public.bd_people(tenant_id, id) on delete restrict,
  check (normalized_email is null or normalized_email = lower(trim(normalized_email))),
  check (merged_into_id is null or merged_into_id <> id)
);

create unique index if not exists bd_people_email_unique_idx
  on public.bd_people (tenant_id, normalized_email)
  where normalized_email is not null and deleted_at is null;
create unique index if not exists bd_people_company_name_no_email_unique_idx
  on public.bd_people (tenant_id, company_id, normalized_full_name)
  where company_id is not null and normalized_email is null and deleted_at is null;
create index if not exists bd_people_company_name_idx
  on public.bd_people (tenant_id, company_id, normalized_full_name) where deleted_at is null;

create table if not exists public.bd_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 240),
  normalized_name text not null check (normalized_name = lower(trim(normalized_name))),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  opportunity_type text not null default 'Other' check (opportunity_type in (
    'Event Wellness', 'Artist Wellness', 'Employee Wellness', 'Corporate Wellness',
    'Venue Partnership', 'Hospitality Partnership', 'Retainer', 'Activation',
    'Strategic Partnership', 'Other'
  )),
  pipeline_stage text not null default 'new' check (pipeline_stage in (
    'new', 'researching', 'approved', 'contacted', 'engaged', 'discovery',
    'proposal', 'negotiation', 'won', 'lost'
  )),
  expected_value_cents bigint check (expected_value_cents >= 0),
  probability smallint not null default 10 check (probability between 0 and 100),
  weighted_value_cents bigint generated always as (
    case when expected_value_cents is null then null else (expected_value_cents * probability) / 100 end
  ) stored,
  source text not null default 'manual',
  fit_score smallint check (fit_score between 0 and 100),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  expected_close_date date,
  last_activity_at timestamptz,
  next_action text,
  next_action_date date,
  description text,
  notes_summary text,
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 30),
  lost_reason text,
  handoff_status text not null default 'not_ready' check (handoff_status in ('not_ready', 'ready', 'handed_off')),
  handoff_record_id uuid,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_by_agent_id uuid,
  updated_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, updated_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (pipeline_stage = 'lost' or lost_reason is null),
  check (pipeline_stage <> 'won' or probability = 100),
  check (pipeline_stage <> 'lost' or probability = 0)
);

create index if not exists bd_opportunities_pipeline_idx
  on public.bd_opportunities (tenant_id, pipeline_stage, priority, updated_at desc) where deleted_at is null;
create index if not exists bd_opportunities_company_idx
  on public.bd_opportunities (tenant_id, company_id, updated_at desc) where deleted_at is null;
create unique index if not exists bd_opportunities_robbot_source_unique_idx
  on public.bd_opportunities (tenant_id, company_id, normalized_name)
  where deleted_at is null and source = 'robbot3k';
create index if not exists bd_opportunities_attention_idx
  on public.bd_opportunities (tenant_id, next_action_date, priority, fit_score desc) where deleted_at is null;

create table if not exists public.bd_opportunity_people (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid not null,
  person_id uuid not null,
  relationship_role text not null default 'stakeholder' check (relationship_role in (
    'primary_contact', 'decision_maker', 'champion', 'influencer', 'stakeholder', 'blocker'
  )),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, opportunity_id, person_id),
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.bd_people(tenant_id, id) on delete cascade
);

create unique index if not exists bd_opportunity_primary_contact_idx
  on public.bd_opportunity_people (tenant_id, opportunity_id)
  where relationship_role = 'primary_contact';

create table if not exists public.bd_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  activity_type text not null check (activity_type in (
    'email', 'call', 'meeting', 'dm', 'note', 'research', 'rob_bot_action',
    'proposal', 'follow_up', 'status_change', 'file', 'internal_comment', 'task'
  )),
  company_id uuid,
  primary_person_id uuid,
  opportunity_id uuid,
  content text not null check (char_length(trim(content)) between 1 and 20000),
  source text not null default 'manual',
  attachment_metadata jsonb not null default '[]'::jsonb,
  actor_type text not null check (actor_type in ('human', 'agent', 'system')),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  agent_identity_id uuid,
  model_used text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  approval_status text not null default 'not_required' check (approval_status in (
    'not_required', 'pending', 'human_approved', 'rejected'
  )),
  external_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, primary_person_id) references public.bd_people(tenant_id, id) on delete restrict,
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, agent_identity_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (num_nonnulls(company_id, primary_person_id, opportunity_id) > 0),
  check (
    (actor_type = 'human' and actor_profile_id is not null and agent_identity_id is null and model_used is null)
    or (actor_type = 'agent' and agent_identity_id is not null and model_used is not null)
    or (actor_type = 'system' and actor_profile_id is null and agent_identity_id is null)
  )
);

create index if not exists bd_activities_timeline_idx
  on public.bd_activities (tenant_id, opportunity_id, occurred_at desc);
create index if not exists bd_activities_company_timeline_idx
  on public.bd_activities (tenant_id, company_id, occurred_at desc);
create unique index if not exists bd_activities_external_unique_idx
  on public.bd_activities (tenant_id, source, external_id);

create table if not exists public.bd_activity_people (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  activity_id uuid not null,
  person_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, activity_id, person_id),
  foreign key (tenant_id, activity_id) references public.bd_activities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.bd_people(tenant_id, id) on delete cascade
);

create table if not exists public.bd_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  company_id uuid,
  person_id uuid,
  opportunity_id uuid,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  source text not null default 'manual',
  notes text,
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_by_agent_id uuid,
  updated_by_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references public.bd_people(tenant_id, id) on delete restrict,
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, updated_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (num_nonnulls(company_id, person_id, opportunity_id) > 0),
  check ((status = 'completed') = (completed_at is not null))
);

create index if not exists bd_tasks_due_idx
  on public.bd_tasks (tenant_id, status, due_at, priority) where deleted_at is null;

create table if not exists public.bd_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid,
  person_id uuid,
  opportunity_id uuid,
  title text,
  content text not null check (char_length(trim(content)) between 1 and 50000),
  source text not null default 'manual',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_by_agent_id uuid,
  updated_by_agent_id uuid,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.bd_people(tenant_id, id) on delete cascade,
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, created_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, updated_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (num_nonnulls(company_id, person_id, opportunity_id) = 1)
);

create table if not exists public.bd_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid,
  person_id uuid,
  opportunity_id uuid,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text,
  size_bytes bigint check (size_bytes between 0 and 52428800),
  storage_provider text not null default 'unconnected',
  storage_path text,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  document_type text not null default 'other' check (document_type in ('proposal', 'contract', 'deck', 'transcript', 'recording', 'other')),
  storage_status text not null default 'metadata_only' check (storage_status in ('metadata_only', 'stored', 'unavailable')),
  source text not null default 'manual',
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_by_agent_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.bd_people(tenant_id, id) on delete cascade,
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, created_by_agent_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (num_nonnulls(company_id, person_id, opportunity_id) = 1),
  check (storage_status <> 'stored' or (storage_path is not null and storage_provider <> 'unconnected'))
);

create table if not exists public.bd_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  list_mode text not null default 'manual' check (list_mode in ('manual', 'saved_filter')),
  entity_type text not null check (entity_type in ('company', 'person', 'opportunity')),
  filter_definition jsonb not null default '{}'::jsonb,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index if not exists bd_lists_name_unique_idx
  on public.bd_lists (tenant_id, owner_profile_id, lower(name)) where deleted_at is null;

create table if not exists public.bd_list_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  list_id uuid not null,
  company_id uuid,
  person_id uuid,
  opportunity_id uuid,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, list_id) references public.bd_lists(tenant_id, id) on delete cascade,
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.bd_people(tenant_id, id) on delete cascade,
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete cascade,
  check (num_nonnulls(company_id, person_id, opportunity_id) = 1)
);

create unique index if not exists bd_list_items_company_unique_idx
  on public.bd_list_items (tenant_id, list_id, company_id) where company_id is not null;
create unique index if not exists bd_list_items_person_unique_idx
  on public.bd_list_items (tenant_id, list_id, person_id) where person_id is not null;
create unique index if not exists bd_list_items_opportunity_unique_idx
  on public.bd_list_items (tenant_id, list_id, opportunity_id) where opportunity_id is not null;

create table if not exists public.bd_call_ingestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid not null,
  opportunity_id uuid not null,
  meeting_external_id text,
  occurred_at timestamptz not null,
  duration_seconds integer check (duration_seconds between 0 and 86400),
  recording_metadata jsonb not null default '{}'::jsonb,
  transcript_status text not null default 'not_connected' check (transcript_status in ('not_connected', 'reference_only', 'available')),
  transcript_storage_path text,
  transcript_checksum_sha256 text check (transcript_checksum_sha256 is null or transcript_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  manual_notes text,
  summary text,
  client_objectives jsonb not null default '[]'::jsonb,
  pain_points jsonb not null default '[]'::jsonb,
  budget_min_cents bigint check (budget_min_cents >= 0),
  budget_max_cents bigint check (budget_max_cents >= 0),
  expected_value_cents bigint check (expected_value_cents >= 0),
  expected_close_date date,
  timing text,
  decision_makers jsonb not null default '[]'::jsonb,
  stakeholders jsonb not null default '[]'::jsonb,
  services_of_interest jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  requested_deliverables jsonb not null default '[]'::jsonb,
  recommended_next_steps jsonb not null default '[]'::jsonb,
  recommended_follow_up text,
  follow_up_at timestamptz,
  deal_probability smallint check (deal_probability between 0 and 100),
  proposed_updates jsonb not null default '{}'::jsonb,
  extraction_source text not null default 'manual' check (extraction_source in ('manual', 'agent')),
  agent_identity_id uuid,
  model_used text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.bd_companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, opportunity_id) references public.bd_opportunities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, agent_identity_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (budget_max_cents is null or budget_min_cents is null or budget_max_cents >= budget_min_cents),
  check ((approval_status = 'approved') = (approved_at is not null)),
  check ((extraction_source = 'agent') = (agent_identity_id is not null and model_used is not null)),
  check (transcript_status <> 'available' or transcript_storage_path is not null)
);

create index if not exists bd_call_ingestions_opportunity_idx
  on public.bd_call_ingestions (tenant_id, opportunity_id, occurred_at desc);

create table if not exists public.bd_agent_mutations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_type text not null check (actor_type in ('human', 'agent', 'system')),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  agent_identity_id uuid,
  model_used text,
  action text not null check (action ~ '^[a-z][a-z0-9_]{1,95}$'),
  source text not null,
  confidence numeric(4,3) check (confidence between 0 and 1),
  approval_status text not null check (approval_status in ('not_required', 'pending', 'human_approved', 'rejected')),
  object_type text not null check (object_type in (
    'company', 'person', 'opportunity', 'activity', 'task', 'note', 'file', 'list', 'call_ingestion', 'robbot_prospect'
  )),
  object_id uuid not null,
  previous_value jsonb,
  resulting_value jsonb,
  request_id text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, agent_identity_id) references public.bd_agent_identities(tenant_id, id) on delete restrict,
  check (
    (actor_type = 'human' and actor_profile_id is not null and agent_identity_id is null and model_used is null)
    or (actor_type = 'agent' and agent_identity_id is not null and model_used is not null and confidence is not null)
    or (actor_type = 'system' and actor_profile_id is null and agent_identity_id is null)
  )
);

create index if not exists bd_agent_mutations_record_idx
  on public.bd_agent_mutations (tenant_id, object_type, object_id, created_at desc);
create unique index if not exists bd_agent_mutations_request_unique_idx
  on public.bd_agent_mutations (tenant_id, request_id);

-- RobBot discoveries can be reconciled into native CRM records without
-- changing or deleting their original source/evidence history.
alter table public.robbot3k_prospects add column if not exists company_id uuid;
alter table public.robbot3k_prospects add column if not exists person_id uuid;
alter table public.robbot3k_prospects add column if not exists opportunity_id uuid;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.robbot3k_prospects'::regclass
      and conname = 'robbot3k_prospects_bd_company_fk'
  ) then
    alter table public.robbot3k_prospects
      add constraint robbot3k_prospects_bd_company_fk
      foreign key (tenant_id, company_id)
      references public.bd_companies(tenant_id, id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.robbot3k_prospects'::regclass
      and conname = 'robbot3k_prospects_bd_person_fk'
  ) then
    alter table public.robbot3k_prospects
      add constraint robbot3k_prospects_bd_person_fk
      foreign key (tenant_id, person_id)
      references public.bd_people(tenant_id, id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.robbot3k_prospects'::regclass
      and conname = 'robbot3k_prospects_bd_opportunity_fk'
  ) then
    alter table public.robbot3k_prospects
      add constraint robbot3k_prospects_bd_opportunity_fk
      foreign key (tenant_id, opportunity_id)
      references public.bd_opportunities(tenant_id, id) on delete restrict;
  end if;
end $$;

create index if not exists robbot3k_prospects_bd_company_idx
  on public.robbot3k_prospects (tenant_id, company_id) where company_id is not null;
create index if not exists robbot3k_prospects_bd_opportunity_idx
  on public.robbot3k_prospects (tenant_id, opportunity_id) where opportunity_id is not null;

-- Transactional, human-admin-only merge for the two duplicate-prone identity
-- objects in V1. The target record is preserved; the source is soft-deleted
-- only after every relationship is repointed. Potential uniqueness collisions
-- are rejected before any write rather than silently deleting relationship
-- history. The mutation + timeline activity commit in the same transaction.
create or replace function public.bd_merge_records(
  p_tenant_id uuid,
  p_record_type text,
  p_source_id uuid,
  p_target_id uuid,
  p_source_version integer,
  p_target_version integer,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_company public.bd_companies%rowtype;
  target_company public.bd_companies%rowtype;
  source_person public.bd_people%rowtype;
  target_person public.bd_people%rowtype;
  merged_source jsonb;
  merged_target jsonb;
  before_snapshot jsonb;
  activity_id uuid;
  affected integer;
  counts jsonb := '{}'::jsonb;
  merge_request_id text;
begin
  if p_tenant_id is null or p_source_id is null or p_target_id is null or p_actor_profile_id is null then
    raise exception using errcode = 'P0001', message = 'bd_merge_context_required';
  end if;
  if p_source_id = p_target_id then
    raise exception using errcode = 'P0001', message = 'bd_merge_same_record';
  end if;
  if p_source_version is null or p_source_version < 1 or p_target_version is null or p_target_version < 1 then
    raise exception using errcode = 'P0001', message = 'bd_merge_version_required';
  end if;
  if p_record_type not in ('company', 'person') then
    raise exception using errcode = 'P0001', message = 'bd_merge_type_invalid';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_profile_id
      and tenant_id = p_tenant_id
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'bd_merge_admin_required';
  end if;

  merge_request_id := 'bd-merge:' || p_record_type || ':' || p_source_id::text || ':' || p_target_id::text;

  if p_record_type = 'company' then
    -- Deterministic lock order prevents reciprocal merge requests deadlocking.
    perform id from public.bd_companies
      where tenant_id = p_tenant_id and id in (p_source_id, p_target_id)
      order by id for update;

    select * into source_company from public.bd_companies
      where tenant_id = p_tenant_id and id = p_source_id;
    select * into target_company from public.bd_companies
      where tenant_id = p_tenant_id and id = p_target_id;
    if source_company.id is null then
      raise exception using errcode = 'P0001', message = 'bd_merge_source_not_found';
    end if;
    if target_company.id is null then
      raise exception using errcode = 'P0001', message = 'bd_merge_target_not_found';
    end if;
    if source_company.deleted_at is not null or source_company.merged_into_id is not null
       or target_company.deleted_at is not null or target_company.merged_into_id is not null then
      raise exception using errcode = 'P0001', message = 'bd_merge_active_records_required';
    end if;
    if source_company.version <> p_source_version or target_company.version <> p_target_version then
      raise exception using errcode = 'P0001', message = 'bd_merge_version_conflict';
    end if;

    -- Moving these rows would violate explicit active-record uniqueness.
    if exists (
      select 1
      from public.bd_opportunities source_opportunity
      join public.bd_opportunities target_opportunity
        on target_opportunity.tenant_id = source_opportunity.tenant_id
       and target_opportunity.company_id = p_target_id
       and target_opportunity.normalized_name = source_opportunity.normalized_name
       and target_opportunity.source = 'robbot3k'
       and target_opportunity.deleted_at is null
      where source_opportunity.tenant_id = p_tenant_id
        and source_opportunity.company_id = p_source_id
        and source_opportunity.source = 'robbot3k'
        and source_opportunity.deleted_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_opportunity_collision';
    end if;
    if exists (
      select 1
      from public.bd_people source_person_record
      join public.bd_people target_person_record
        on target_person_record.tenant_id = source_person_record.tenant_id
       and target_person_record.company_id = p_target_id
       and target_person_record.normalized_full_name = source_person_record.normalized_full_name
       and target_person_record.normalized_email is null
       and target_person_record.deleted_at is null
      where source_person_record.tenant_id = p_tenant_id
        and source_person_record.company_id = p_source_id
        and source_person_record.normalized_email is null
        and source_person_record.deleted_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_person_collision';
    end if;
    if exists (
      select 1
      from public.bd_list_items source_item
      join public.bd_list_items target_item
        on target_item.tenant_id = source_item.tenant_id
       and target_item.list_id = source_item.list_id
       and target_item.company_id = p_target_id
      where source_item.tenant_id = p_tenant_id
        and source_item.company_id = p_source_id
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_list_collision';
    end if;

    before_snapshot := jsonb_build_object('source', to_jsonb(source_company), 'target', to_jsonb(target_company));

    update public.bd_people set company_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('people', affected);
    update public.bd_opportunities set company_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('opportunities', affected);
    update public.bd_activities set company_id = p_target_id
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('activities', affected);
    update public.bd_tasks set company_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('tasks', affected);
    update public.bd_notes set company_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('notes', affected);
    update public.bd_files set company_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('files', affected);
    update public.bd_list_items set company_id = p_target_id
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('listItems', affected);
    update public.bd_call_ingestions set company_id = p_target_id
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('calls', affected);
    update public.robbot3k_prospects set company_id = p_target_id, updated_by = p_actor_profile_id
      where tenant_id = p_tenant_id and company_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('robbotProspects', affected);
    update public.bd_companies set merged_into_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and merged_into_id = p_source_id;

    update public.bd_companies
      set version = version + 1, updated_by = p_actor_profile_id
      where tenant_id = p_tenant_id and id = p_target_id and version = p_target_version;
    if not found then
      raise exception using errcode = 'P0001', message = 'bd_merge_version_conflict';
    end if;
    update public.bd_companies
      set merged_into_id = p_target_id, deleted_at = now(), deleted_by = p_actor_profile_id,
          version = version + 1, updated_by = p_actor_profile_id
      where tenant_id = p_tenant_id and id = p_source_id and version = p_source_version;
    if not found then
      raise exception using errcode = 'P0001', message = 'bd_merge_version_conflict';
    end if;

    insert into public.bd_activities (
      tenant_id, activity_type, company_id, content, source,
      actor_type, actor_profile_id, approval_status, external_id
    ) values (
      p_tenant_id, 'status_change', p_target_id,
      'Merged company "' || source_company.name || '" into "' || target_company.name || '".',
      'admin_merge', 'human', p_actor_profile_id, 'human_approved', merge_request_id
    ) returning id into activity_id;

    select to_jsonb(row_value) into merged_source from (
      select * from public.bd_companies where tenant_id = p_tenant_id and id = p_source_id
    ) row_value;
    select to_jsonb(row_value) into merged_target from (
      select * from public.bd_companies where tenant_id = p_tenant_id and id = p_target_id
    ) row_value;
  else
    perform id from public.bd_people
      where tenant_id = p_tenant_id and id in (p_source_id, p_target_id)
      order by id for update;

    select * into source_person from public.bd_people
      where tenant_id = p_tenant_id and id = p_source_id;
    select * into target_person from public.bd_people
      where tenant_id = p_tenant_id and id = p_target_id;
    if source_person.id is null then
      raise exception using errcode = 'P0001', message = 'bd_merge_source_not_found';
    end if;
    if target_person.id is null then
      raise exception using errcode = 'P0001', message = 'bd_merge_target_not_found';
    end if;
    if source_person.deleted_at is not null or source_person.merged_into_id is not null
       or target_person.deleted_at is not null or target_person.merged_into_id is not null then
      raise exception using errcode = 'P0001', message = 'bd_merge_active_records_required';
    end if;
    if source_person.version <> p_source_version or target_person.version <> p_target_version then
      raise exception using errcode = 'P0001', message = 'bd_merge_version_conflict';
    end if;

    if exists (
      select 1
      from public.bd_opportunity_people source_link
      join public.bd_opportunity_people target_link
        on target_link.tenant_id = source_link.tenant_id
       and target_link.opportunity_id = source_link.opportunity_id
       and target_link.person_id = p_target_id
      where source_link.tenant_id = p_tenant_id and source_link.person_id = p_source_id
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_opportunity_person_collision';
    end if;
    if exists (
      select 1
      from public.bd_activity_people source_link
      join public.bd_activity_people target_link
        on target_link.tenant_id = source_link.tenant_id
       and target_link.activity_id = source_link.activity_id
       and target_link.person_id = p_target_id
      where source_link.tenant_id = p_tenant_id and source_link.person_id = p_source_id
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_activity_person_collision';
    end if;
    if exists (
      select 1
      from public.bd_list_items source_item
      join public.bd_list_items target_item
        on target_item.tenant_id = source_item.tenant_id
       and target_item.list_id = source_item.list_id
       and target_item.person_id = p_target_id
      where source_item.tenant_id = p_tenant_id and source_item.person_id = p_source_id
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_list_collision';
    end if;
    if exists (
      select 1
      from public.bd_activities activity
      where activity.tenant_id = p_tenant_id
        and (
          (activity.primary_person_id = p_source_id and exists (
            select 1 from public.bd_activity_people link
            where link.tenant_id = p_tenant_id and link.activity_id = activity.id and link.person_id = p_target_id
          ))
          or (activity.primary_person_id = p_target_id and exists (
            select 1 from public.bd_activity_people link
            where link.tenant_id = p_tenant_id and link.activity_id = activity.id and link.person_id = p_source_id
          ))
        )
    ) then
      raise exception using errcode = 'P0001', message = 'bd_merge_activity_person_collision';
    end if;

    before_snapshot := jsonb_build_object('source', to_jsonb(source_person), 'target', to_jsonb(target_person));

    update public.bd_opportunity_people set person_id = p_target_id
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('opportunityPeople', affected);
    update public.bd_activities set primary_person_id = p_target_id
      where tenant_id = p_tenant_id and primary_person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('primaryActivities', affected);
    update public.bd_activity_people set person_id = p_target_id
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('activityPeople', affected);
    update public.bd_tasks set person_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('tasks', affected);
    update public.bd_notes set person_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('notes', affected);
    update public.bd_files set person_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('files', affected);
    update public.bd_list_items set person_id = p_target_id
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('listItems', affected);
    update public.robbot3k_prospects set person_id = p_target_id, updated_by = p_actor_profile_id
      where tenant_id = p_tenant_id and person_id = p_source_id;
    get diagnostics affected = row_count;
    counts := counts || jsonb_build_object('robbotProspects', affected);
    update public.bd_people set merged_into_id = p_target_id, updated_by = p_actor_profile_id, version = version + 1
      where tenant_id = p_tenant_id and merged_into_id = p_source_id;

    update public.bd_people
      set version = version + 1, updated_by = p_actor_profile_id
      where tenant_id = p_tenant_id and id = p_target_id and version = p_target_version;
    if not found then
      raise exception using errcode = 'P0001', message = 'bd_merge_version_conflict';
    end if;
    update public.bd_people
      set merged_into_id = p_target_id, deleted_at = now(), deleted_by = p_actor_profile_id,
          version = version + 1, updated_by = p_actor_profile_id
      where tenant_id = p_tenant_id and id = p_source_id and version = p_source_version;
    if not found then
      raise exception using errcode = 'P0001', message = 'bd_merge_version_conflict';
    end if;

    insert into public.bd_activities (
      tenant_id, activity_type, company_id, primary_person_id, content, source,
      actor_type, actor_profile_id, approval_status, external_id
    ) values (
      p_tenant_id, 'status_change', target_person.company_id, p_target_id,
      'Merged person "' || source_person.full_name || '" into "' || target_person.full_name || '".',
      'admin_merge', 'human', p_actor_profile_id, 'human_approved', merge_request_id
    ) returning id into activity_id;

    select to_jsonb(row_value) into merged_source from (
      select * from public.bd_people where tenant_id = p_tenant_id and id = p_source_id
    ) row_value;
    select to_jsonb(row_value) into merged_target from (
      select * from public.bd_people where tenant_id = p_tenant_id and id = p_target_id
    ) row_value;
  end if;

  insert into public.bd_agent_mutations (
    tenant_id, actor_type, actor_profile_id, action, source, approval_status,
    object_type, object_id, previous_value, resulting_value, request_id
  ) values (
    p_tenant_id, 'human', p_actor_profile_id, 'merge_' || p_record_type,
    'admin_merge_rpc', 'human_approved', p_record_type, p_target_id,
    before_snapshot,
    jsonb_build_object('source', merged_source, 'target', merged_target, 'counts', counts, 'activityId', activity_id),
    merge_request_id
  );

  return jsonb_build_object(
    'recordType', p_record_type,
    'sourceId', p_source_id,
    'targetId', p_target_id,
    'sourceVersion', p_source_version + 1,
    'targetVersion', p_target_version + 1,
    'activityId', activity_id,
    'counts', counts,
    'source', merged_source,
    'target', merged_target
  );
end;
$$;

revoke all on function public.bd_merge_records(uuid, text, uuid, uuid, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.bd_merge_records(uuid, text, uuid, uuid, integer, integer, uuid)
  to service_role;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'bd_companies', 'bd_agent_identities', 'bd_agent_permissions', 'bd_people',
    'bd_opportunities', 'bd_opportunity_people', 'bd_activities', 'bd_activity_people',
    'bd_tasks', 'bd_notes', 'bd_files', 'bd_lists', 'bd_list_items',
    'bd_call_ingestions', 'bd_agent_mutations'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl);
  end loop;
end $$;

-- Mutation history is append-only, including for service_role callers.
revoke update, delete, truncate on public.bd_agent_mutations from service_role;

-- V1 uses soft deletion for business records and preserves timeline/call
-- evidence. Junction rows remain service-manageable for relationship edits.
revoke delete, truncate on public.bd_companies, public.bd_people, public.bd_opportunities,
  public.bd_tasks, public.bd_notes, public.bd_files, public.bd_lists,
  public.bd_activities, public.bd_call_ingestions, public.bd_agent_identities,
  public.bd_agent_permissions from service_role;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'bd_companies', 'bd_agent_identities', 'bd_agent_permissions', 'bd_people',
    'bd_opportunities', 'bd_tasks', 'bd_notes', 'bd_files', 'bd_lists', 'bd_call_ingestions'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated_at', tbl);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'trg_' || tbl || '_updated_at', tbl);
  end loop;
end $$;

comment on table public.bd_companies is 'Avalon BD company records. normalized_domain is the strongest active-company duplicate key.';
comment on table public.bd_people is 'Avalon BD people. normalized_email is unique per tenant for active records.';
comment on table public.bd_opportunities is 'Avalon BD revenue pipeline with fixed, intentionally small V1 stages.';
comment on table public.bd_files is 'Document metadata only. Storage/upload remains unconnected until a provider is configured.';
comment on table public.bd_call_ingestions is 'Structured call intelligence; transcript extraction and recording storage are not connected by this migration.';
comment on table public.bd_agent_permissions is 'Permissions are independent of human profile roles and default to denied.';
comment on table public.bd_agent_mutations is 'Append-only attribution history for every human, agent, or system mutation made through Avalon BD APIs.';
