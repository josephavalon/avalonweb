import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BD_PIPELINE_STAGES,
  BdInputError,
  bdWebsiteUrl,
  normalizeBdDomain,
  normalizeBdEmail,
  normalizeBdTags,
  normalizeCompanyInput,
  normalizeOpportunityInput,
  normalizePersonInput,
  requireBdUuid,
} from '../api/_lib/bd-crm-core.js';
import { pacificDayWindow } from '../api/admin/bd.js';

assert.equal(normalizeBdDomain('https://WWW.Example.AI/team'), 'example.ai');
assert.equal(normalizeBdDomain('example.ai'), 'example.ai');
assert.equal(normalizeBdEmail(' CEO@Example.AI '), 'ceo@example.ai');
assert.deepEqual(bdWebsiteUrl('example.ai/team'), { url: 'https://example.ai/team', domain: 'example.ai' });
assert.throws(() => normalizeBdDomain('localhost'), BdInputError);
assert.throws(() => normalizeBdDomain('127.0.0.1'), BdInputError);
assert.throws(() => normalizeBdEmail('not-an-email'), /valid email/i);
assert.throws(() => bdWebsiteUrl('https://user:secret@example.ai'), /credentials/i);
assert.throws(() => requireBdUuid('not-a-uuid'), /valid id/i);
assert.deepEqual(normalizeBdTags(['priority', 'priority', 'wellness']), ['priority', 'wellness']);

assert.deepEqual(normalizeCompanyInput({
  name: '  Example AI  ', website: 'https://www.example.ai/about', companyType: 'Corporate',
  fitScore: 92, tags: ['AI', 'Founder-led'],
}), {
  name: 'Example AI', normalized_name: 'example ai', website_url: 'https://www.example.ai/about',
  normalized_domain: 'example.ai', company_type: 'Corporate', fit_score: 92,
  tags: ['AI', 'Founder-led'], source: 'manual',
});

assert.deepEqual(normalizePersonInput({
  fullName: ' Example Founder ', email: 'FOUNDER@EXAMPLE.AI', title: 'CEO',
}), {
  full_name: 'Example Founder', normalized_full_name: 'example founder',
  email: 'founder@example.ai', normalized_email: 'founder@example.ai', title: 'CEO', source: 'manual',
});

const opportunity = normalizeOpportunityInput({
  name: 'Example AI — Employee Wellness',
  companyId: '11111111-1111-4111-8111-111111111111',
  opportunityType: 'Employee Wellness', expectedValueCents: 6000000,
  probability: 40, pipelineStage: 'discovery', fitScore: 88,
});
assert.equal(opportunity.pipeline_stage, 'discovery');
assert.equal(opportunity.expected_value_cents, 6000000);
assert.equal(opportunity.probability, 40);
assert.deepEqual(BD_PIPELINE_STAGES, [
  'new', 'researching', 'approved', 'contacted', 'engaged',
  'discovery', 'proposal', 'negotiation', 'won', 'lost',
]);

assert.deepEqual(pacificDayWindow(new Date('2026-08-30T00:30:00.000Z')), {
  start: '2026-08-29T07:00:00.000Z',
  end: '2026-08-30T07:00:00.000Z',
});
assert.deepEqual(pacificDayWindow(new Date('2026-03-08T12:00:00.000Z')), {
  start: '2026-03-08T08:00:00.000Z',
  end: '2026-03-09T07:00:00.000Z',
});
assert.deepEqual(pacificDayWindow(new Date('2026-11-01T12:00:00.000Z')), {
  start: '2026-11-01T07:00:00.000Z',
  end: '2026-11-02T08:00:00.000Z',
});

const migration = readFileSync(new URL('../supabase/migrations/048_avalon_bd_crm.sql', import.meta.url), 'utf8');

function assertSqlStructure(sql) {
  const open = [];
  let state = 'normal';
  let dollarTag = '';
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (state === 'line_comment') {
      if (char === '\n') state = 'normal';
      continue;
    }
    if (state === 'block_comment') {
      if (char === '*' && next === '/') { state = 'normal'; index += 1; }
      continue;
    }
    if (state === 'single_quote') {
      if (char === "'" && next === "'") { index += 1; continue; }
      if (char === "'") state = 'normal';
      continue;
    }
    if (state === 'double_quote') {
      if (char === '"' && next === '"') { index += 1; continue; }
      if (char === '"') state = 'normal';
      continue;
    }
    if (state === 'dollar_quote') {
      if (sql.startsWith(dollarTag, index)) { index += dollarTag.length - 1; state = 'normal'; }
      continue;
    }
    if (char === '-' && next === '-') { state = 'line_comment'; index += 1; continue; }
    if (char === '/' && next === '*') { state = 'block_comment'; index += 1; continue; }
    if (char === "'") { state = 'single_quote'; continue; }
    if (char === '"') { state = 'double_quote'; continue; }
    if (char === '$') {
      const match = sql.slice(index).match(/^\$(?:[a-z_][a-z0-9_]*)?\$/i);
      if (match) { dollarTag = match[0]; state = 'dollar_quote'; index += dollarTag.length - 1; continue; }
    }
    if (char === '(') open.push(index);
    if (char === ')') {
      assert.ok(open.length, `unmatched closing parenthesis at SQL byte ${index}`);
      open.pop();
    }
  }
  assert.equal(state, 'normal', `unterminated SQL ${state}`);
  assert.equal(open.length, 0, 'migration has unclosed parentheses');
  assert.equal((sql.match(/create table if not exists public\.bd_/g) || []).length, 15, 'expected all 15 Avalon BD tables');
}

assertSqlStructure(migration);
for (const table of [
  'companies', 'people', 'opportunities', 'opportunity_people', 'activities',
  'activity_people', 'tasks', 'notes', 'files', 'lists', 'list_items',
  'call_ingestions', 'agent_identities', 'agent_permissions', 'agent_mutations',
]) {
  assert.match(migration, new RegExp(`public\\.bd_${table}`), `missing bd_${table}`);
}
assert.match(migration, /revoke all on public\.%I from anon, authenticated/);
assert.match(migration, /grant select, insert, update, delete on public\.%I to service_role/);
assert.match(migration, /revoke update, delete, truncate on public\.bd_agent_mutations from service_role/);
assert.match(migration, /revoke delete, truncate on public\.bd_companies, public\.bd_people, public\.bd_opportunities/);
assert.match(migration, /bd_companies_domain_unique_idx[\s\S]*normalized_domain/);
assert.match(migration, /bd_companies_name_no_domain_unique_idx[\s\S]*normalized_name[\s\S]*normalized_domain is null/);
assert.match(migration, /bd_people_email_unique_idx[\s\S]*normalized_email/);
assert.match(
  migration,
  /bd_people_company_name_no_email_unique_idx[\s\S]*tenant_id, company_id, normalized_full_name[\s\S]*normalized_email is null/,
);
assert.match(migration, /deleted_at timestamptz/g);
assert.match(migration, /pipeline_stage text[\s\S]*'new'[\s\S]*'won', 'lost'/);
assert.match(migration, /weighted_value_cents bigint generated always/);
assert.match(migration, /actor_type text not null check \(actor_type in \('human', 'agent', 'system'\)\)/);
assert.match(migration, /agent_identity_id uuid/);
assert.match(migration, /model_used text/);
assert.match(migration, /confidence numeric\(4,3\)/);
assert.match(migration, /approval_status text not null/);
assert.match(migration, /previous_value jsonb/);
assert.match(migration, /resulting_value jsonb/);
assert.match(migration, /foreign key \(tenant_id, company_id\) references public\.bd_companies/);
assert.match(migration, /alter table public\.robbot3k_prospects add column if not exists company_id uuid/);
assert.match(migration, /alter table public\.robbot3k_prospects add column if not exists person_id uuid/);
assert.match(migration, /alter table public\.robbot3k_prospects add column if not exists opportunity_id uuid/);
assert.match(migration, /Document metadata only\. Storage\/upload remains unconnected/);
assert.match(migration, /transcript extraction and recording storage are not connected/);
assert.match(migration, /requirements jsonb not null default '\[\]'::jsonb/);
assert.match(migration, /follow_up_at timestamptz/);
assert.match(migration, /deal_probability smallint check \(deal_probability between 0 and 100\)/);
assert.match(migration, /expected_value_cents bigint check \(expected_value_cents >= 0\)/);
assert.match(migration, /expected_close_date date/);
assert.equal(
  (migration.match(/check \(budget_max_cents is null or budget_min_cents is null or budget_max_cents >= budget_min_cents\)/g) || []).length,
  1,
  'call budget range constraint must be declared once',
);
assert.match(
  migration,
  /relationship_role text not null default 'stakeholder' check \(relationship_role in \([\s\S]*?'blocker'\s*\)\),\s*created_by/,
  'opportunity-person role check must close exactly once before the next column',
);
assert.match(migration, /create or replace function public\.bd_merge_records\(/);
assert.match(migration, /bd_merge_records\([\s\S]*?security definer[\s\S]*?set search_path = public, pg_temp/);
assert.match(migration, /where id = p_actor_profile_id[\s\S]*?tenant_id = p_tenant_id[\s\S]*?role = 'admin'[\s\S]*?status = 'active'/);
assert.match(migration, /where tenant_id = p_tenant_id and id in \(p_source_id, p_target_id\)[\s\S]*?order by id for update/);
assert.match(migration, /source_company\.version <> p_source_version or target_company\.version <> p_target_version/);
assert.match(migration, /source_person\.version <> p_source_version or target_person\.version <> p_target_version/);
for (const collision of [
  'bd_merge_opportunity_collision', 'bd_merge_person_collision', 'bd_merge_opportunity_person_collision',
  'bd_merge_activity_person_collision', 'bd_merge_list_collision',
]) assert.ok(migration.includes(collision), `missing conservative merge collision ${collision}`);
assert.match(migration, /set merged_into_id = p_target_id, deleted_at = now\(\), deleted_by = p_actor_profile_id/);
assert.match(migration, /insert into public\.bd_activities \([\s\S]*?'admin_merge'/);
assert.match(migration, /insert into public\.bd_agent_mutations \([\s\S]*?'admin_merge_rpc'/);
assert.match(
  migration,
  /revoke all on function public\.bd_merge_records\(uuid, text, uuid, uuid, integer, integer, uuid\)\s+from public, anon, authenticated;/,
);
assert.match(
  migration,
  /grant execute on function public\.bd_merge_records\(uuid, text, uuid, uuid, integer, integer, uuid\)\s+to service_role;/,
);

const core = readFileSync(new URL('../api/_lib/bd-crm-core.js', import.meta.url), 'utf8');
assert.match(core, /export async function assertBdAgentPermission/);
assert.match(core, /export async function executeAuthorizedBdAgentMutation/);
assert.match(core, /permission_state === 'denied'/);
assert.match(core, /agent_write_path_not_connected/);
assert.match(core, /persisted exact-payload approval is required/);
assert.match(core, /export async function recordBdMutation/);
assert.match(core, /export async function reconcileRobBotProspectToBd/);
assert.match(core, /No outreach was sent\./);
assert.match(core, /outreachExecuted: false/);
assert.match(core, /approvalGranted: false/);
assert.match(core, /deterministic_reconciliation_v1/);
assert.match(core, /activity_type: 'rob_bot_action'/);
assert.match(core, /create_company_from_prospect/);
assert.match(core, /create_person_from_prospect/);
assert.match(core, /create_opportunity_from_prospect/);
assert.match(core, /ensure_person_opportunity_link/);
assert.match(core, /objectType: 'robbot_prospect'/);
assert.match(core, /requestId = `robbot3k-reconcile:/);
assert.match(core, /findNamedPersonAtCompany/);
assert.match(core, /\.eq\('company_id', companyId\)[\s\S]*?\.eq\('normalized_full_name', normalizedFullName\)/);
assert.match(core, /if \(!person && personName && !email\)/);
assert.match(core, /person_company_conflict/);
assert.match(core, /person_email_conflict/);
assert.match(core, /enrich_person_from_prospect/);
assert.match(core, /company_name_ambiguous/);
assert.match(core, /company_domain_conflict/);
assert.match(core, /enrich_company_from_prospect/);

const adminApi = readFileSync(new URL('../api/admin/bd.js', import.meta.url), 'utf8');
assert.match(
  adminApi,
  /async function insertRecord[\s\S]*?recordBdMutation[\s\S]*?ownerNameMap\(db, tenantId, \[result\.data\]\)[\s\S]*?withOwnerName\(result\.data, ownerNames\)/,
  'create responses must include the resolved owner name without requiring a reload',
);
assert.match(core, /export async function recordRobBotCrmOutcome/);
for (const stage of ["approved: 'approved'", "sent: 'contacted'", "reply: 'engaged'", "booked: 'discovery'"]) {
  assert.ok(core.includes(stage), `missing RobBot CRM stage rule ${stage}`);
}
assert.match(core, /stageIndex < targetIndex/);
assert.match(core, /targetIndex <= BD_PIPELINE_STAGES\.indexOf\('discovery'\)/);
assert.match(core, /source: 'robbot3k_bridge'/);
assert.match(core, /requestId: `\$\{requestBase\}:activity`/);
assert.match(core, /requestId: `\$\{requestBase\}:opportunity`/);
assert.match(core, /actor_type: 'system'/);
assert.match(core, /model_used: 'robbot3k_workflow_v1'/);
assert.match(core, /skipped: 'crm_links_inactive'/);
assert.match(core, /from\('bd_companies'\)[\s\S]*?\.is\('deleted_at', null\)/);

const endpoint = readFileSync(new URL('../api/admin/bd.js', import.meta.url), 'utf8');
assert.match(endpoint, /requireAdmin\(req, res\)/);
for (const view of ['dashboard', 'companies', 'people', 'pipeline', 'tasks', 'lists', 'search', 'record']) {
  assert.ok(endpoint.includes(`'${view}'`) || endpoint.includes(`=== '${view}'`), `missing ${view} view`);
}
for (const action of [
  'create_company', 'create_person', 'create_opportunity', 'create_activity',
  'create_task', 'add_note', 'register_file_metadata', 'create_list',
  'add_list_item', 'record_call', 'reconcile_prospect', 'update_company',
  'update_person', 'update_opportunity', 'change_pipeline_stage',
  'update_task', 'complete_task', 'soft_delete', 'merge_records',
]) assert.ok(endpoint.includes(`'${action}'`), `missing ${action} action`);
assert.match(endpoint, /expectedVersion/);
assert.match(endpoint, /version_conflict/);
assert.match(endpoint, /body\.stage \|\| body\.patch\?\.stage/);
assert.match(endpoint, /validateOwnerProfile/);
assert.match(endpoint, /\.eq\('tenant_id', tenantId\)\.eq\('status', 'active'\)/);
assert.match(endpoint, /\.in\('role', \['admin', 'staff'\]\)/);
assert.match(endpoint, /!\['won', 'lost'\]\.includes\(stage\) \? \{ lost_reason: null \}/);
assert.match(endpoint, /callTranscriptExtraction: 'not_connected'/);
assert.match(endpoint, /storageConnected: false/);
assert.match(endpoint, /transcriptExtractionConnected: false/);
assert.match(endpoint, /No outreach was sent and no outreach approval was granted\./);
assert.match(endpoint, /\.rpc\('bd_merge_records'/);
assert.match(endpoint, /sourceExpectedVersion/);
assert.match(endpoint, /targetExpectedVersion/);
assert.match(endpoint, /String\(error\?\.code \|\| ''\)\.toUpperCase\(\) === 'P0001'/);
assert.match(endpoint, /bd_merge_version_conflict/);
assert.match(endpoint, /company_duplicate/);
assert.match(endpoint, /archive_dependencies_active/);
assert.match(endpoint, /assertNoArchiveDependencies/);
assert.match(endpoint, /REOPEN_PROBABILITY/);
assert.match(endpoint, /\['won', 'lost'\]\.includes\(currentResult\.data\.pipeline_stage\)/);
for (const field of [
  'requirements', 'follow_up_at', 'deal_probability', 'expected_value_cents', 'expected_close_date',
]) assert.ok(endpoint.includes(field), `missing call intelligence field ${field}`);
assert.match(endpoint, /applyOpportunityUpdates/);
assert.match(endpoint, /opportunityExpectedVersion/);
assert.match(endpoint, /apply_call_opportunity_updates/);
assert.match(endpoint, /normalizeFollowUpTasks/);
assert.match(endpoint, /Follow-up tasks', 10/);
assert.match(endpoint, /owner_name/);
assert.match(endpoint, /from\('profiles'\)[\s\S]*?\.eq\('tenant_id', tenantId\)\.in\('id', batch\)/);
assert.match(endpoint, /const \[companies, people, opportunities, notes, activities, tasks\]/);
assert.match(endpoint, /bd_activity_people/);
assert.match(endpoint, /relatedOpportunityIds/);
assert.match(endpoint, /combineRowQueries\(activityQueries, \{ limit: 300/);
assert.match(endpoint, /const pacificToday = pacificDayWindow\(now\)/);
assert.match(endpoint, /\.gte\('due_at', pacificToday\.start\)\.lt\('due_at', pacificToday\.end\)/);
assert.match(endpoint, /overdueActions/);
assert.match(endpoint, /overdueTasks/);
assert.match(endpoint, /select\('id, organization, name, contact_name, contact_role, company_id, person_id, opportunity_id'\)/);
assert.doesNotMatch(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);

const robbotCore = readFileSync(new URL('../api/_lib/robbot3k-core.js', import.meta.url), 'utf8');
assert.match(robbotCore, /await reconcileRobBotProspectToBd\(db, tenantId, actorProfileId, prospectId\);[\s\S]*?db\.rpc\('robbot3k_approve_prospect'/);
assert.match(robbotCore, /outcome: 'approved'[\s\S]*?invalidateApproval\(db, tenantId, prospectId, 'crm_bridge_failed'\)/);
for (const outcome of ["outcome: 'reply'", "outcome: 'booked'", "outcome: 'suppressed'"]) {
  assert.ok(robbotCore.includes(outcome), `missing RobBot CRM ${outcome}`);
}
assert.match(robbotCore, /actorType: actorProfileId \? 'human' : 'system'/);
assert.match(robbotCore, /scheduled_at_required/);
assert.match(robbotCore, /scheduledDate\.getTime\(\) <= Date\.now\(\)/);

const execution = readFileSync(new URL('../api/_lib/robbot3k-execution.js', import.meta.url), 'utf8');
assert.match(execution, /reason: 'crm_not_reconciled'/);
assert.match(execution, /reason: 'crm_links_inactive'/);
assert.match(execution, /from\('bd_companies'\)[\s\S]*?\.is\('deleted_at', null\)/);
assert.match(execution, /outcome: 'sent'/);
assert.match(execution, /actorType: 'agent'/);
assert.match(execution, /idempotencyKey: `sent:\$\{sequence\.id\}:\$\{stepIndex\}`/);
assert.match(execution, /await recordRobBotCrmOutcome\([\s\S]*?const sequencePatch/);

const contract = readFileSync(new URL('../docs/AVALON_BD_BACKEND_CONTRACT.md', import.meta.url), 'utf8');
assert.match(contract, /separate service-role requests, not one database transaction/);
assert.match(contract, /never sends outreach and never grants outreach approval/);
assert.match(contract, /consumes a persisted, exact-payload approval artifact/);
assert.match(contract, /caller-supplied approver ID is never treated as proof/);
assert.match(contract, /merge_records/);
assert.match(contract, /target record wins/i);
assert.match(contract, /America\/Los_Angeles/);
assert.match(contract, /name-only contacts[\s\S]*same tenant and company/i);
assert.match(contract, /email match belongs to another company[\s\S]*conflict/i);
assert.match(contract, /approved[\s\S]*contacted[\s\S]*engaged[\s\S]*discovery/i);
assert.match(contract, /outcome bridge[\s\S]*separate service-role requests/i);
assert.match(contract, /create_manual_prospect[\s\S]*immediately invokes/i);
assert.match(contract, /researchRecordRetained: true/);
assert.match(contract, /company_name_ambiguous/);
assert.match(contract, /archive_dependencies_active/);
assert.match(contract, /requirements[\s\S]*dealProbability[\s\S]*expectedValueCents/);
assert.match(contract, /applyOpportunityUpdates: true[\s\S]*opportunityExpectedVersion/);
assert.match(contract, /at most 10 validated linked task/i);
assert.match(contract, /disabled `robbot3k` identity is attribution/i);
assert.match(contract, /Do not enable a live outreach provider/i);

const robbotEndpoint = readFileSync(new URL('../api/admin/robbot3k.js', import.meta.url), 'utf8');
assert.match(robbotEndpoint, /reconcileRobBotProspectToBd\(db, tenantId, user\?\.id \|\| null, result\.prospect\.id\)/);
assert.match(robbotEndpoint, /researchRecordRetained: true/);
assert.match(robbotEndpoint, /manual_prospect_saved_crm_migration_required/);
assert.match(robbotEndpoint, /if \(\/\(\?:public\\\.\)\?bd_/);

console.log('Avalon BD CRM verification passed.');
