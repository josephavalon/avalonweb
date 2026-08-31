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
import {
  pacificDayWindow,
  preparePersonUpdatePatch,
  priorityDashboardSnapshot,
  updateCoreRecord,
} from '../api/admin/bd.js';
import './verify-bd-release.mjs';

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

function companyLookup(result) {
  const calls = [];
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    is(column, value) { calls.push(['is', column, value]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); },
  };
  return {
    calls,
    db: {
      from(table) { calls.push(['from', table]); return query; },
    },
  };
}

const personTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const activeCompanyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const personRecordId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorProfileId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const omittedCompany = companyLookup({ data: null, error: null });
assert.deepEqual(
  await preparePersonUpdatePatch(omittedCompany.db, personTenantId, { title: 'Founder' }),
  { title: 'Founder' },
);
assert.deepEqual(omittedCompany.calls, [], 'an update that omits companyId must not look up or change the link');

const explicitUnlink = companyLookup({ data: null, error: null });
const explicitUnlinkPatch = await preparePersonUpdatePatch(explicitUnlink.db, personTenantId, { companyId: null });
assert.deepEqual(explicitUnlinkPatch, { company_id: null });
assert.deepEqual(explicitUnlink.calls, [], 'an explicit null companyId must be accepted as an unlink without a lookup');

const activeCompany = companyLookup({ data: { id: activeCompanyId }, error: null });
assert.deepEqual(
  await preparePersonUpdatePatch(activeCompany.db, personTenantId, { companyId: activeCompanyId }),
  { company_id: activeCompanyId },
);
assert.deepEqual(activeCompany.calls, [
  ['from', 'bd_companies'],
  ['select', 'id'],
  ['eq', 'tenant_id', personTenantId],
  ['eq', 'id', activeCompanyId],
  ['is', 'deleted_at', null],
  ['maybeSingle'],
], 'a person company change must resolve an active company in the caller tenant');

const inactiveCompany = companyLookup({ data: null, error: null });
await assert.rejects(
  () => preparePersonUpdatePatch(inactiveCompany.db, personTenantId, { companyId: activeCompanyId }),
  (error) => error instanceof BdInputError
    && error.code === 'person_company_invalid'
    && error.status === 409
    && error.message === 'Selected company is not an active Avalon BD company.',
  'missing, cross-tenant, and soft-deleted company ids must all fail closed',
);

const inactiveCompanyThroughUpdate = companyLookup({ data: null, error: null });
await assert.rejects(
  () => updateCoreRecord(
    inactiveCompanyThroughUpdate.db,
    personTenantId,
    actorProfileId,
    'update_person',
    { id: personRecordId, expectedVersion: 1, patch: { companyId: activeCompanyId } },
  ),
  (error) => error instanceof BdInputError
    && error.code === 'person_company_invalid'
    && error.status === 409,
  'the actual update_person execution path must reject an inactive company before updating a person',
);
assert.deepEqual(inactiveCompanyThroughUpdate.calls, [
  ['from', 'bd_companies'],
  ['select', 'id'],
  ['eq', 'tenant_id', personTenantId],
  ['eq', 'id', activeCompanyId],
  ['is', 'deleted_at', null],
  ['maybeSingle'],
], 'updateCoreRecord must validate the company before reading or mutating the person row');

const lookupError = new Error('company_lookup_failed');
const failedCompanyLookup = companyLookup({ data: null, error: lookupError });
await assert.rejects(
  () => preparePersonUpdatePatch(failedCompanyLookup.db, personTenantId, { companyId: activeCompanyId }),
  (error) => error === lookupError,
  'company lookup failures must propagate instead of allowing the change',
);

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

const priorityDashboard = priorityDashboardSnapshot([
  ...Array.from({ length: 645 }, (_, index) => ({
    id: `priority-${index}`,
    priority: index % 2 ? 'high' : 'urgent',
    fit_score: index,
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `normal-${index}`,
    priority: 'normal',
    fit_score: 1000,
  })),
]);
assert.equal(priorityDashboard.count, 645,
  'dashboard summary must count every open high/urgent opportunity, not only the displayed rows');
assert.equal(priorityDashboard.rows.length, 25,
  'dashboard priority detail list must remain capped at 25 rows');
assert.equal(priorityDashboard.rows[0].id, 'priority-644',
  'dashboard priority detail rows must remain ranked by fit score');

const migration = readFileSync(new URL('../supabase/migrations/064_avalon_bd_standalone.sql', import.meta.url), 'utf8');
const activityAclReconciliation = readFileSync(
  new URL('../supabase/migrations/065_avalon_bd_activity_acl_reconciliation.sql', import.meta.url),
  'utf8',
);

function assertSqlStructure(sql, expectedTableCount) {
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
  assert.equal(
    (sql.match(/create table public\.bd_/g) || []).length,
    expectedTableCount,
    `expected ${expectedTableCount} Avalon BD table definitions`,
  );
}

assertSqlStructure(migration, 15);
assertSqlStructure(activityAclReconciliation, 0);
for (const table of [
  'companies', 'people', 'opportunities', 'opportunity_people', 'activities',
  'activity_people', 'tasks', 'notes', 'files', 'lists', 'list_items',
  'call_ingestions', 'agent_identities', 'agent_permissions', 'agent_mutations',
]) {
  assert.match(migration, new RegExp(`public\\.bd_${table}`), `missing bd_${table}`);
}
assert.match(migration, /bd_companies_domain_unique_idx[\s\S]*normalized_domain/);
assert.match(migration, /bd_people_email_unique_idx[\s\S]*normalized_email/);
assert.match(migration, /weighted_value_cents bigint generated always/);
assert.match(migration, /actor_type text not null check \(actor_type in \('human', 'agent', 'system'\)\)/);
assert.match(migration, /previous_value jsonb/);
assert.match(migration, /resulting_value jsonb/);
assert.match(migration, /create or replace function public\.bd_merge_records\(/);
assert.match(migration, /where id = p_actor_profile_id[\s\S]*?tenant_id = p_tenant_id[\s\S]*?role = 'admin'[\s\S]*?status = 'active'/);
assert.match(migration, /where tenant_id = p_tenant_id and id in \(p_source_id, p_target_id\)[\s\S]*?order by id for update/);
assert.match(migration, /set merged_into_id = p_target_id, deleted_at = now\(\), deleted_by = p_actor_profile_id/);

const core = readFileSync(new URL('../api/_lib/bd-crm-core.js', import.meta.url), 'utf8');
assert.match(core, /export async function assertBdAgentPermission/);
assert.match(core, /export async function executeAuthorizedBdAgentMutation/);
assert.match(core, /permission_state === 'denied'/);
assert.match(core, /agent_write_path_not_connected/);
assert.match(core, /persisted exact-payload approval is required/);
assert.match(core, /export async function recordBdMutation/);

const endpoint = readFileSync(new URL('../api/admin/bd.js', import.meta.url), 'utf8');
assert.match(endpoint, /requireAdmin\(req, res\)/);
for (const view of ['dashboard', 'companies', 'people', 'pipeline', 'tasks', 'lists', 'owners', 'search', 'record']) {
  assert.ok(endpoint.includes(`'${view}'`) || endpoint.includes(`=== '${view}'`), `missing ${view} view`);
}
for (const action of [
  'create_company', 'create_person', 'create_opportunity', 'create_activity',
  'create_task', 'add_note', 'register_file_metadata', 'create_list',
  'add_list_item', 'record_call', 'update_company', 'update_person',
  'update_opportunity', 'change_pipeline_stage', 'update_task',
  'complete_task', 'soft_delete', 'merge_records',
  'set_opportunity_contact', 'remove_opportunity_contact',
]) assert.ok(endpoint.includes(`'${action}'`), `missing ${action} action`);
for (const role of ['primary_contact', 'decision_maker', 'champion', 'influencer', 'stakeholder', 'blocker']) {
  assert.ok(endpoint.includes(`'${role}'`), `missing opportunity-contact role: ${role}`);
}
assert.match(endpoint, /relationship_conflict/);
assert.match(endpoint, /primary_contact_exists/);
assert.match(endpoint, /const source = trustedSource[\s\S]*?: 'manual'/,
  'generic activity entry must remain manually attributed');
assert.match(endpoint, /const ownerNames = await ownerNameMap\(db, tenantId, \[result\.data\]\);[\s\S]*return withOwnerName\(result\.data, ownerNames\);/,
  'versioned updates must return the selected owner name to the interface');
assert.match(endpoint, /expectedVersion/);
assert.match(endpoint, /version_conflict/);
assert.match(endpoint, /body\.stage \|\| body\.patch\?\.stage/);
assert.match(endpoint, /validateOwnerProfile/);
assert.match(endpoint, /\.eq\('tenant_id', tenantId\)\.eq\('status', 'active'\)/);
assert.match(endpoint, /\.in\('role', \['admin', 'staff'\]\)/);
assert.match(endpoint, /\.rpc\('bd_merge_records'/);
assert.match(endpoint, /archive_dependencies_active/);
assert.match(endpoint, /REOPEN_PROBABILITY/);
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
assert.match(endpoint, /storageConnected: false/);
assert.match(endpoint, /transcriptExtractionConnected: false/);
assert.doesNotMatch(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);

const adminUi = readFileSync(new URL('../app-modules/pages/admin/AvalonBD.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(adminUi, /setSourceStatus\('preview'\)/, 'a live CRM failure must never activate sample records');
for (const retiredFixture of [
  'Empire Artist Group', 'Civic Health Collective', 'Harbor House Hotels',
  'Fog City Fitness', 'Summit Live', 'Northstar Robotics',
]) {
  assert.ok(!adminUi.includes(retiredFixture), `retired fixture must not ship: ${retiredFixture}`);
}
assert.match(adminUi, /No sample data has been substituted/, 'the unavailable state must be explicit and truthful');
for (const interfaceContract of [
  'Add relationship', 'Choose contact', 'Relationship strength', 'Save activity',
  "action: 'set_opportunity_contact'", "action: 'remove_opportunity_contact'",
  "action: 'create_activity'", 'OwnerPicker',
]) assert.ok(adminUi.includes(interfaceContract), `missing relationship interface contract: ${interfaceContract}`);
for (const roleLabel of ['Primary contact', 'Decision-maker', 'Champion', 'Influencer', 'Stakeholder', 'Blocker']) {
  assert.ok(adminUi.includes(roleLabel), `missing relationship role control: ${roleLabel}`);
}
assert.match(adminUi, /expectedValue: record\.expectedValueCentsValue == null \? ''/,
  'editing another opportunity field must preserve an unknown expected value');
assert.match(adminUi, /form\.expectedValue === ''[\s\S]*record\.expectedValueCentsValue == null \? \{\} : \{ expectedValueCents: null \}/,
  'an untouched unknown opportunity value must be omitted while an intentionally cleared value becomes null');
assert.match(adminUi, /selection\.type === 'company'\) return !item\.companyId/,
  'company relationship creation must not silently move an already-linked contact');
assert.match(adminUi, /type === 'Opportunity' \? \{ primaryContactId: '' \} : \{\}/,
  'changing an opportunity company must clear any hidden primary-contact selection');
assert.match(adminUi, /primaryContact: primary\?\.name \|\| 'Unassigned'/,
  'a company with no linked contacts must not retain a stale primary-contact label');

console.log('Avalon BD CRM behavior verification passed.');
