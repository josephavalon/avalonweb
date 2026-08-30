-- Retire the short-lived internal RobBot test-record mode without damaging
-- legitimate CRM records that may have been matched to the same company or
-- person. The production APIs already hide and refuse to execute marked test
-- prospects; this forward migration removes their executable state and only
-- archives CRM objects proven to have been created solely by test
-- reconciliation. Append-only mutation history remains intact as audit proof.

-- Keep a durable, content-minimized record of exactly which marked prospects
-- and CRM mutations this cleanup acted on. The prospect rows are deleted at
-- the end of the migration, so an append-only ledger is required to retain the
-- test-marker-to-mutation provenance needed for later manual review. It stores
-- identifiers and timestamps only; prospect copy and CRM field values remain
-- in their existing source/audit records and are not duplicated here.
create table if not exists public.robbot3k_test_retirement_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid not null,
  original_company_id uuid,
  original_person_id uuid,
  original_opportunity_id uuid,
  prospect_created_at timestamptz not null,
  prospect_updated_at timestamptz not null,
  retired_at timestamptz not null default now(),
  unique (tenant_id, prospect_id),
  unique (tenant_id, id)
);

create table if not exists public.robbot3k_test_retirement_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ledger_id uuid not null,
  prospect_id uuid not null,
  evidence_key text not null check (char_length(evidence_key) between 1 and 240),
  evidence_kind text not null check (evidence_kind in ('prospect_link', 'mutation')),
  mutation_id uuid,
  object_type text not null check (char_length(object_type) between 1 and 64),
  object_id uuid not null,
  action text not null check (char_length(action) between 1 and 96),
  request_id text,
  evidence_created_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (tenant_id, prospect_id, evidence_key),
  foreign key (tenant_id, ledger_id)
    references public.robbot3k_test_retirement_ledger(tenant_id, id) on delete restrict,
  foreign key (mutation_id) references public.bd_agent_mutations(id) on delete restrict,
  check (
    (evidence_kind = 'mutation' and mutation_id is not null and request_id is not null)
    or (evidence_kind = 'prospect_link' and mutation_id is null and request_id is null)
  )
);

create index if not exists robbot3k_test_retirement_evidence_object_idx
  on public.robbot3k_test_retirement_evidence
  (tenant_id, object_type, object_id, evidence_created_at);

alter table public.robbot3k_test_retirement_ledger enable row level security;
alter table public.robbot3k_test_retirement_evidence enable row level security;
revoke all on public.robbot3k_test_retirement_ledger,
  public.robbot3k_test_retirement_evidence
  from public, anon, authenticated, service_role;
grant select, insert on public.robbot3k_test_retirement_ledger,
  public.robbot3k_test_retirement_evidence
  to service_role;

create or replace function app_private.prevent_robbot3k_test_retirement_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'RobBot test retirement evidence is append-only';
end;
$$;

revoke all on function app_private.prevent_robbot3k_test_retirement_mutation()
  from public, anon, authenticated;

drop trigger if exists robbot3k_test_retirement_ledger_immutable
  on public.robbot3k_test_retirement_ledger;
create trigger robbot3k_test_retirement_ledger_immutable
  before update or delete on public.robbot3k_test_retirement_ledger
  for each row execute function app_private.prevent_robbot3k_test_retirement_mutation();

drop trigger if exists robbot3k_test_retirement_evidence_immutable
  on public.robbot3k_test_retirement_evidence;
create trigger robbot3k_test_retirement_evidence_immutable
  before update or delete on public.robbot3k_test_retirement_evidence
  for each row execute function app_private.prevent_robbot3k_test_retirement_mutation();

comment on table public.robbot3k_test_retirement_ledger is
  'Append-only service-role ledger retaining marked test-prospect identity and original CRM links after retirement.';
comment on table public.robbot3k_test_retirement_evidence is
  'Append-only service-role evidence mapping retired test prospects to every request-scoped CRM mutation and linked object.';

create temporary table _retired_robbot_test_prospects on commit drop as
select
  id as prospect_id,
  tenant_id,
  company_id,
  person_id,
  opportunity_id,
  created_at as prospect_created_at,
  updated_at as prospect_updated_at
from public.robbot3k_prospects
where lower(coalesce(source_payload ->> 'is_test_record', 'false')) = 'true';

insert into public.robbot3k_test_retirement_ledger (
  tenant_id,
  prospect_id,
  original_company_id,
  original_person_id,
  original_opportunity_id,
  prospect_created_at,
  prospect_updated_at
)
select
  test.tenant_id,
  test.prospect_id,
  test.company_id,
  test.person_id,
  test.opportunity_id,
  test.prospect_created_at,
  test.prospect_updated_at
from _retired_robbot_test_prospects test
on conflict (tenant_id, prospect_id) do nothing;

-- Reconciliation is intentionally idempotent, but its Data API writes are not
-- one database transaction. A company/person/opportunity may therefore have
-- been created or enriched before an error prevented its id from being copied
-- back onto robbot3k_prospects. Derive the authoritative affected-object set
-- from the immutable request-id namespace as well as the final prospect links.
create temporary table _retired_robbot_test_mutations on commit drop as
select
  test.prospect_id,
  mutation.id as mutation_id,
  mutation.tenant_id,
  mutation.action,
  mutation.object_type,
  mutation.object_id,
  mutation.previous_value,
  mutation.resulting_value,
  mutation.request_id,
  mutation.created_at
from _retired_robbot_test_prospects test
join public.bd_agent_mutations mutation
  on mutation.tenant_id = test.tenant_id
 and mutation.request_id like (
   'robbot3k-reconcile:' || test.prospect_id::text || ':%'
 );

insert into public.robbot3k_test_retirement_evidence (
  tenant_id,
  ledger_id,
  prospect_id,
  evidence_key,
  evidence_kind,
  mutation_id,
  object_type,
  object_id,
  action,
  request_id,
  evidence_created_at
)
select
  mutation.tenant_id,
  ledger.id,
  mutation.prospect_id,
  'mutation:' || mutation.mutation_id::text,
  'mutation',
  mutation.mutation_id,
  mutation.object_type,
  mutation.object_id,
  mutation.action,
  mutation.request_id,
  mutation.created_at
from _retired_robbot_test_mutations mutation
join public.robbot3k_test_retirement_ledger ledger
  on ledger.tenant_id = mutation.tenant_id
 and ledger.prospect_id = mutation.prospect_id
on conflict (tenant_id, prospect_id, evidence_key) do nothing;

-- Preserve the prospect's final foreign-key links independently of mutation
-- evidence. This covers successful links without an audit row as well as
-- partial reconciliations whose mutation exists but whose link was never saved.
insert into public.robbot3k_test_retirement_evidence (
  tenant_id,
  ledger_id,
  prospect_id,
  evidence_key,
  evidence_kind,
  object_type,
  object_id,
  action,
  evidence_created_at
)
select
  link.tenant_id,
  ledger.id,
  link.prospect_id,
  'prospect-link:' || link.object_type || ':' || link.object_id::text,
  'prospect_link',
  link.object_type,
  link.object_id,
  'prospect_link_snapshot',
  link.prospect_updated_at
from (
  select
    test.tenant_id,
    test.prospect_id,
    'company'::text as object_type,
    test.company_id as object_id,
    test.prospect_updated_at
  from _retired_robbot_test_prospects test

  union all

  select
    test.tenant_id,
    test.prospect_id,
    'person'::text as object_type,
    test.person_id as object_id,
    test.prospect_updated_at
  from _retired_robbot_test_prospects test

  union all

  select
    test.tenant_id,
    test.prospect_id,
    'opportunity'::text as object_type,
    test.opportunity_id as object_id,
    test.prospect_updated_at
  from _retired_robbot_test_prospects test
) link
join public.robbot3k_test_retirement_ledger ledger
  on ledger.tenant_id = link.tenant_id
 and ledger.prospect_id = link.prospect_id
where link.object_id is not null
on conflict (tenant_id, prospect_id, evidence_key) do nothing;

create temporary table _retired_robbot_test_crm_objects on commit drop as
with candidates as (
  select
    test.prospect_id,
    test.tenant_id,
    'company'::text as object_type,
    test.company_id as object_id,
    null::text as mutation_action
  from _retired_robbot_test_prospects test

  union all

  select
    test.prospect_id,
    test.tenant_id,
    'person'::text as object_type,
    test.person_id as object_id,
    null::text as mutation_action
  from _retired_robbot_test_prospects test

  union all

  select
    test.prospect_id,
    test.tenant_id,
    'opportunity'::text as object_type,
    test.opportunity_id as object_id,
    null::text as mutation_action
  from _retired_robbot_test_prospects test

  union all

  select
    mutation.prospect_id,
    mutation.tenant_id,
    mutation.object_type,
    mutation.object_id,
    mutation.action as mutation_action
  from _retired_robbot_test_mutations mutation
  where mutation.object_type in ('company', 'person', 'opportunity', 'activity')
)
select
  candidate.tenant_id,
  candidate.object_type,
  candidate.object_id,
  array_agg(distinct candidate.prospect_id) as test_prospect_ids,
  coalesce(bool_or(
    (candidate.object_type = 'company' and candidate.mutation_action = 'create_company_from_prospect')
    or (candidate.object_type = 'person' and candidate.mutation_action = 'create_person_from_prospect')
    or (candidate.object_type = 'opportunity' and candidate.mutation_action = 'create_opportunity_from_prospect')
    or (candidate.object_type = 'activity' and candidate.mutation_action = 'create_reconciliation_activity')
  ), false) as created_by_test_reconciliation
from candidates candidate
where candidate.object_id is not null
group by candidate.tenant_id, candidate.object_type, candidate.object_id;

-- Exact reconciliation activities are derived artifacts, not human-authored
-- CRM history. Remove activities identified by immutable mutation provenance.
-- The external-id fallback also catches a crash after inserting the activity
-- but before its mutation audit row was written. Activity-person links cascade.
delete from public.bd_activities activity
where activity.source = 'robbot3k_reconciliation'
  and (
    exists (
      select 1
      from _retired_robbot_test_crm_objects candidate
      where candidate.tenant_id = activity.tenant_id
        and candidate.object_type = 'activity'
        and candidate.object_id = activity.id
        and candidate.created_by_test_reconciliation
    )
    or exists (
      select 1
      from _retired_robbot_test_prospects test
      where test.tenant_id = activity.tenant_id
        and test.opportunity_id is not null
        and activity.external_id = (
          'robbot3k-reconcile:' || test.prospect_id::text || ':' || test.opportunity_id::text
        )
    )
  );

-- Archive only opportunities whose immutable mutation history proves a marked
-- test prospect created them. Mutation-derived candidates include objects left
-- behind by a partial reconciliation before prospect foreign keys were saved.
-- Any non-test prospect, downstream record, handoff, human/adoptive mutation,
-- or relationship not created by the same test reconciliation preserves it.
update public.bd_opportunities opportunity
set
  deleted_at = coalesce(opportunity.deleted_at, now()),
  updated_at = now(),
  version = opportunity.version + 1
where opportunity.deleted_at is null
  and opportunity.source = 'robbot3k'
  and exists (
    select 1
    from _retired_robbot_test_crm_objects candidate
    where candidate.tenant_id = opportunity.tenant_id
      and candidate.object_type = 'opportunity'
      and candidate.object_id = opportunity.id
      and candidate.created_by_test_reconciliation
  )
  and opportunity.handoff_status = 'not_ready'
  and opportunity.handoff_record_id is null
  and not exists (
    select 1
    from public.robbot3k_prospects other
    where other.tenant_id = opportunity.tenant_id
      and other.opportunity_id = opportunity.id
      and not exists (
        select 1
        from _retired_robbot_test_prospects test
        where test.tenant_id = other.tenant_id
          and test.prospect_id = other.id
      )
  )
  and not exists (
    select 1
    from public.bd_agent_mutations mutation
    where mutation.tenant_id = opportunity.tenant_id
      and mutation.object_type = 'opportunity'
      and mutation.object_id = opportunity.id
      and not exists (
        select 1
        from _retired_robbot_test_mutations test_mutation
        where test_mutation.mutation_id = mutation.id
      )
  )
  and not exists (
    select 1
    from public.bd_opportunity_people link
    where link.tenant_id = opportunity.tenant_id
      and link.opportunity_id = opportunity.id
      and not exists (
        select 1
        from _retired_robbot_test_mutations test_mutation
        where test_mutation.tenant_id = link.tenant_id
          and test_mutation.object_type = 'opportunity'
          and test_mutation.object_id = link.opportunity_id
          and test_mutation.action = 'ensure_person_opportunity_link'
          and test_mutation.resulting_value ->> 'personId' = link.person_id::text
      )
  )
  and not exists (select 1 from public.bd_activities row where row.tenant_id = opportunity.tenant_id and row.opportunity_id = opportunity.id)
  and not exists (select 1 from public.bd_tasks row where row.tenant_id = opportunity.tenant_id and row.opportunity_id = opportunity.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_notes row where row.tenant_id = opportunity.tenant_id and row.opportunity_id = opportunity.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_files row where row.tenant_id = opportunity.tenant_id and row.opportunity_id = opportunity.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_list_items row where row.tenant_id = opportunity.tenant_id and row.opportunity_id = opportunity.id)
  and not exists (select 1 from public.bd_call_ingestions row where row.tenant_id = opportunity.tenant_id and row.opportunity_id = opportunity.id);

-- Apply the same provenance-and-no-live-use rule to people. A person linked to
-- a non-test prospect, active opportunity, human mutation, activity, task,
-- note, file, list, or merge remains live.
update public.bd_people person
set
  deleted_at = coalesce(person.deleted_at, now()),
  updated_at = now(),
  version = person.version + 1
where person.deleted_at is null
  and person.source = 'robbot3k'
  and exists (
    select 1
    from _retired_robbot_test_crm_objects candidate
    where candidate.tenant_id = person.tenant_id
      and candidate.object_type = 'person'
      and candidate.object_id = person.id
      and candidate.created_by_test_reconciliation
  )
  and not exists (
    select 1
    from public.robbot3k_prospects other
    where other.tenant_id = person.tenant_id
      and other.person_id = person.id
      and not exists (
        select 1
        from _retired_robbot_test_prospects test
        where test.tenant_id = other.tenant_id
          and test.prospect_id = other.id
      )
  )
  and not exists (
    select 1
    from public.bd_agent_mutations mutation
    where mutation.tenant_id = person.tenant_id
      and mutation.object_type = 'person'
      and mutation.object_id = person.id
      and not exists (
        select 1
        from _retired_robbot_test_mutations test_mutation
        where test_mutation.mutation_id = mutation.id
      )
  )
  and not exists (
    select 1
    from public.bd_opportunity_people link
    join public.bd_opportunities opportunity
      on opportunity.tenant_id = link.tenant_id and opportunity.id = link.opportunity_id
    where link.tenant_id = person.tenant_id
      and link.person_id = person.id
      and opportunity.deleted_at is null
  )
  and not exists (select 1 from public.bd_people row where row.tenant_id = person.tenant_id and row.merged_into_id = person.id)
  and not exists (select 1 from public.bd_activities row where row.tenant_id = person.tenant_id and row.primary_person_id = person.id)
  and not exists (select 1 from public.bd_activity_people row where row.tenant_id = person.tenant_id and row.person_id = person.id)
  and not exists (select 1 from public.bd_tasks row where row.tenant_id = person.tenant_id and row.person_id = person.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_notes row where row.tenant_id = person.tenant_id and row.person_id = person.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_files row where row.tenant_id = person.tenant_id and row.person_id = person.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_list_items row where row.tenant_id = person.tenant_id and row.person_id = person.id);

-- Companies are archived last and only when every active child/reference is
-- gone, no non-test prospect or mutation has adopted the record, and the
-- creation mutation belongs to a marked test prospect.
update public.bd_companies company
set
  deleted_at = coalesce(company.deleted_at, now()),
  updated_at = now(),
  version = company.version + 1
where company.deleted_at is null
  and company.source = 'robbot3k'
  and exists (
    select 1
    from _retired_robbot_test_crm_objects candidate
    where candidate.tenant_id = company.tenant_id
      and candidate.object_type = 'company'
      and candidate.object_id = company.id
      and candidate.created_by_test_reconciliation
  )
  and not exists (
    select 1
    from public.robbot3k_prospects other
    where other.tenant_id = company.tenant_id
      and other.company_id = company.id
      and not exists (
        select 1
        from _retired_robbot_test_prospects test
        where test.tenant_id = other.tenant_id
          and test.prospect_id = other.id
      )
  )
  and not exists (
    select 1
    from public.bd_agent_mutations mutation
    where mutation.tenant_id = company.tenant_id
      and mutation.object_type = 'company'
      and mutation.object_id = company.id
      and not exists (
        select 1
        from _retired_robbot_test_mutations test_mutation
        where test_mutation.mutation_id = mutation.id
      )
  )
  and not exists (select 1 from public.bd_companies row where row.tenant_id = company.tenant_id and row.merged_into_id = company.id)
  and not exists (select 1 from public.bd_people row where row.tenant_id = company.tenant_id and row.company_id = company.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_opportunities row where row.tenant_id = company.tenant_id and row.company_id = company.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_activities row where row.tenant_id = company.tenant_id and row.company_id = company.id)
  and not exists (select 1 from public.bd_tasks row where row.tenant_id = company.tenant_id and row.company_id = company.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_notes row where row.tenant_id = company.tenant_id and row.company_id = company.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_files row where row.tenant_id = company.tenant_id and row.company_id = company.id and row.deleted_at is null)
  and not exists (select 1 from public.bd_list_items row where row.tenant_id = company.tenant_id and row.company_id = company.id)
  and not exists (select 1 from public.bd_call_ingestions row where row.tenant_id = company.tenant_id and row.company_id = company.id);

-- Cascades remove approvals, sequences, messages, meetings and suppressions.
-- Test enrichment mutations against preexisting/shared objects intentionally do
-- not delete or rewrite those objects: their immutable before/after snapshots
-- remain in bd_agent_mutations for review, and the protections above prevent a
-- test-created record from being archived after any legitimate adoption.
delete from public.robbot3k_prospects prospect
using _retired_robbot_test_prospects test
where prospect.tenant_id = test.tenant_id
  and prospect.id = test.prospect_id;
