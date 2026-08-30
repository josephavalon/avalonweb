import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bdCrmEnabled, requireBdCrmEnabled } from '../api/_lib/bd-crm-gate.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const migration = read('../supabase/migrations/064_avalon_bd_standalone.sql');
const endpoint = read('../api/admin/bd.js');
const gate = read('../api/_lib/bd-crm-gate.js');
const env = read('../.env.example');
const ui = read('../app-modules/pages/admin/AvalonBD.jsx');
const app = read('../src/App.jsx');
const shell = read('../src/components/admin/AdminShell.jsx');
const access = read('../src/lib/adminAccess.js');
const contract = read('../docs/AVALON_BD_BACKEND_CONTRACT.md');

const expectedTables = [
  'bd_activities',
  'bd_activity_people',
  'bd_agent_identities',
  'bd_agent_mutations',
  'bd_agent_permissions',
  'bd_call_ingestions',
  'bd_companies',
  'bd_files',
  'bd_list_items',
  'bd_lists',
  'bd_notes',
  'bd_opportunities',
  'bd_opportunity_people',
  'bd_people',
  'bd_tasks',
].sort();

const createdTables = [...migration.matchAll(/create table public\.(bd_[a-z_]+)\s*\(/g)]
  .map((match) => match[1])
  .sort();
assert.deepEqual(createdTables, expectedTables, 'migration 064 must create exactly the 15 reviewed BD tables');

function loopTables(marker) {
  const markerAt = migration.indexOf(marker);
  const arrayAt = migration.lastIndexOf('foreach tbl in array array[', markerAt);
  const loopAt = migration.indexOf('] loop', arrayAt);
  assert.ok(markerAt > 0 && arrayAt > 0 && loopAt > arrayAt, `missing table loop for ${marker}`);
  return [...migration.slice(arrayAt, loopAt).matchAll(/'(bd_[a-z_]+)'/g)]
    .map((match) => match[1])
    .sort();
}

const beginAt = migration.indexOf('\nbegin;');
const firstWriteAt = migration.indexOf('create table public.bd_companies');
assert.ok(beginAt >= 0 && beginAt < firstWriteAt, 'migration must begin one transaction before schema writes');
assert.match(migration.trim(), /commit;$/);
assert.match(migration, /to_regclass\('public\.tenants'\)/);
assert.match(migration, /to_regclass\('public\.profiles'\)/);
assert.match(migration, /to_regprocedure\('public\.touch_updated_at\(\)'\)/);
assert.match(migration, /to_regprocedure\('gen_random_uuid\(\)'\)/);
for (const role of ['anon', 'authenticated', 'service_role']) {
  assert.match(migration, new RegExp(`array\\['anon', 'authenticated', 'service_role'\\]`));
  assert.ok(migration.includes(`bd_preflight_role_missing_`));
  assert.ok(role.length > 0);
}
for (const column of ['tenants', 'profiles', 'tenant_id', 'role', 'status']) {
  assert.ok(migration.includes(`'${column}'`), `preflight must require ${column}`);
}
assert.match(migration, /profile_key\.contype in \('p', 'u'\)/);
assert.match(migration, /profile_key\.convalidated/);
assert.match(migration, /= array\['tenant_id', 'id'\]::text\[\]/);
assert.match(migration, /bd_preflight_profiles_tenant_id_id_key_missing/);

assert.doesNotMatch(migration, /robbot3k_|public\.robbot|rob_bot/i, 'standalone migration cannot reference outreach objects');
assert.doesNotMatch(migration, /\b053\b|retire_robbot/i, 'standalone migration cannot depend on the retirement migration');
assert.doesNotMatch(migration, /create table if not exists public\.bd_/i, 'preflight must not mask an existing BD table');
assert.doesNotMatch(migration, /create\s+(?:unique\s+)?index\s+if\s+not\s+exists/i,
  'fresh migration must fail atomically on every index-name collision');

const profileColumnsByTable = {
  bd_companies: ['owner_profile_id', 'deleted_by', 'created_by', 'updated_by'],
  bd_agent_identities: ['created_by'],
  bd_agent_permissions: ['granted_by'],
  bd_people: ['owner_profile_id', 'deleted_by', 'created_by', 'updated_by'],
  bd_opportunities: ['owner_profile_id', 'deleted_by', 'created_by', 'updated_by'],
  bd_opportunity_people: ['created_by'],
  bd_activities: ['actor_profile_id'],
  bd_tasks: ['owner_profile_id', 'created_by', 'updated_by'],
  bd_notes: ['created_by', 'updated_by'],
  bd_files: ['created_by', 'updated_by'],
  bd_lists: ['owner_profile_id', 'created_by', 'updated_by'],
  bd_list_items: ['added_by'],
  bd_call_ingestions: ['approved_by', 'created_by'],
  bd_agent_mutations: ['actor_profile_id'],
};
assert.doesNotMatch(migration, /references public\.profiles\(id\)/,
  'single-column profile references can cross tenant boundaries');
for (const [table, columns] of Object.entries(profileColumnsByTable)) {
  const body = migration.match(new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`))?.[1] || '';
  assert.ok(body, `missing table body for ${table}`);
  for (const column of columns) {
    assert.match(body, new RegExp(`\\b${column} uuid[,\\n]`), `${table}.${column} must remain an explicit nullable profile column`);
    assert.match(
      body,
      new RegExp(`foreign key \\(tenant_id, ${column}\\) references public\\.profiles\\(tenant_id, id\\) on delete restrict`),
      `${table}.${column} must be constrained to a profile in the same tenant`,
    );
  }
}

const mergeStart = migration.indexOf('create or replace function public.bd_merge_records(');
const mergeEnd = migration.indexOf('revoke all on function public.bd_merge_records');
assert.ok(mergeStart > firstWriteAt && mergeEnd > mergeStart, 'merge RPC must be defined before its ACL');
for (const match of migration.matchAll(/insert into public\.bd_[a-z_]+/gi)) {
  assert.ok(match.index > mergeStart && match.index < mergeEnd, 'migration cannot seed BD rows outside the merge RPC body');
}
assert.equal([...migration.matchAll(/insert into public\.bd_[a-z_]+/gi)].length, 3, 'only runtime merge activity/audit inserts are allowed');
assert.match(migration, /source_person\.company_id is null[\s\S]*target_person\.company_id is null[\s\S]*source_person\.company_id <> target_person\.company_id[\s\S]*bd_merge_person_company_mismatch/,
  'person merge must require the same non-null company');

assert.match(migration, /security definer\s+set search_path = public, pg_temp/);
assert.match(
  migration,
  /revoke all on function public\.bd_merge_records\(uuid, text, uuid, uuid, integer, integer, uuid\)\s+from public, anon, authenticated, service_role;/,
);
assert.match(
  migration,
  /grant execute on function public\.bd_merge_records\(uuid, text, uuid, uuid, integer, integer, uuid\)\s+to service_role;/,
);

assert.match(migration, /alter table public\.%I enable row level security/);
assert.match(migration, /revoke all on public\.%I from public, anon, authenticated, service_role/);
assert.deepEqual(loopTables('alter table public.%I enable row level security'), expectedTables,
  'RLS and full privilege revocation must cover exactly all 15 BD tables');
const normalizeSql = (statement) => statement.replace(/\s+/g, ' ').trim().toLowerCase();
assert.doesNotMatch(migration, /execute\s+format\(\s*'grant\b/i,
  'dynamic GRANT statements are not permitted in the standalone migration');
const topLevelGrants = [...migration.matchAll(/(?:^|\n)\s*grant\s+[\s\S]*?;/gi)]
  .map((match) => normalizeSql(match[0]));
const expectedTopLevelGrants = [
  'grant execute on function public.bd_merge_records(uuid, text, uuid, uuid, integer, integer, uuid) to service_role;',
  'grant select, insert, update on public.bd_companies, public.bd_people, public.bd_opportunities, public.bd_tasks, public.bd_notes, public.bd_files, public.bd_lists, public.bd_activities, public.bd_call_ingestions, public.bd_agent_identities, public.bd_agent_permissions to service_role;',
  'grant select, insert, update, delete on public.bd_opportunity_people, public.bd_activity_people, public.bd_list_items to service_role;',
  'grant select, insert on public.bd_agent_mutations to service_role;',
].sort();
assert.deepEqual([...topLevelGrants].sort(), expectedTopLevelGrants,
  'migration must expose exactly the reviewed top-level grants');
const tableRevokeAt = migration.indexOf("execute format('revoke all on public.%I from public, anon, authenticated, service_role', tbl)");
const tableGrantIndexes = [...migration.matchAll(/(?:^|\n)\s*grant\s+[^;]*\bon\s+public\.bd_[^;]*;/gi)]
  .map((match) => match.index);
const firstTableGrantAt = tableGrantIndexes.length ? Math.min(...tableGrantIndexes) : -1;
assert.ok(tableRevokeAt >= 0 && firstTableGrantAt > tableRevokeAt,
  'all table privileges must be revoked before the reviewed service-role table grants');
for (const statement of topLevelGrants) {
  assert.doesNotMatch(statement, /\bto\s+(?:public|anon|authenticated)\b/,
    'PUBLIC, anon, and authenticated cannot receive a BD grant');
}
const serviceDeleteTables = topLevelGrants
  .filter((statement) => /grant\s+[\w, ]*\bdelete\b[\w, ]*\bon\b/.test(statement) && /\bto service_role;/.test(statement))
  .flatMap((statement) => [...statement.matchAll(/public\.(bd_[a-z_]+)/g)].map((match) => match[1]))
  .sort();
assert.deepEqual(serviceDeleteTables, ['bd_activity_people', 'bd_list_items', 'bd_opportunity_people'].sort(),
  'service_role DELETE must be limited to the three reviewed junction tables');
assert.doesNotMatch(migration, /grant\s+[^;]*(truncate|references|trigger)[^;]*to service_role/i);
assert.doesNotMatch(migration, /grant\s+[^;]*(update|delete)[^;]*public\.bd_agent_mutations/i);

const triggerTables = [
  'bd_companies', 'bd_agent_identities', 'bd_agent_permissions', 'bd_people',
  'bd_opportunities', 'bd_tasks', 'bd_notes', 'bd_files', 'bd_lists', 'bd_call_ingestions',
].sort();
assert.deepEqual(loopTables('create trigger %I before update'), triggerTables,
  'updated-at triggers must cover exactly the ten mutable timestamped tables');
assert.match(migration, /execute function public\.touch_updated_at\(\)/);
assert.doesNotMatch(migration, /drop trigger/i, 'fresh standalone tables do not need destructive trigger replacement');

assert.match(gate, /AVALON_BD_CRM_ENABLED/);
assert.match(gate, /code: 'bd_crm_disabled'/);
assert.equal(bdCrmEnabled({}), false);
assert.equal(bdCrmEnabled({ AVALON_BD_CRM_ENABLED: 'false' }), false);
assert.equal(bdCrmEnabled({ AVALON_BD_CRM_ENABLED: '1' }), false);
assert.equal(bdCrmEnabled({ AVALON_BD_CRM_ENABLED: ' TRUE ' }), true);
let gateStatus = null;
let gateBody = null;
const gateHeaders = new Map();
assert.equal(requireBdCrmEnabled({
  setHeader(name, value) { gateHeaders.set(name, value); },
  status(code) { gateStatus = code; return this; },
  json(value) { gateBody = value; return this; },
}, {}), false);
assert.equal(gateStatus, 503);
assert.equal(gateHeaders.get('Cache-Control'), 'no-store');
assert.equal(gateBody?.code, 'bd_crm_disabled');
assert.match(endpoint, /requireBdCrmEnabled\(res\)/);
assert.doesNotMatch(endpoint, /requireBdDataReview|AVALON_BD_DATA_REVIEWED/);
assert.doesNotMatch(endpoint, /robbot3k|rob_bot|reconcile_prospect/i, 'BD API must not query or mutate outreach records');
const endpointHandler = endpoint.slice(endpoint.indexOf('export default async function handler'));
const authGateAt = endpointHandler.indexOf('requireAdmin(req, res)');
const crmGateAt = endpointHandler.indexOf('requireBdCrmEnabled(res)');
const firstBdOperationAt = endpointHandler.indexOf('const { db, tenantId, user } = authed');
assert.ok(authGateAt >= 0 && authGateAt < crmGateAt,
  'BD endpoint must authenticate before revealing the CRM gate state');
assert.ok(crmGateAt < firstBdOperationAt,
  'BD endpoint must enforce the CRM gate before its first database operation');
assert.match(endpoint, /db\.from\('bd_activities'\)[\s\S]*?\.eq\('activity_type', 'meeting'\)/);
assert.match(endpoint, /action === 'create_person'/);
assert.match(endpoint, /db\.from\('bd_companies'\)\.select\('id'\)[\s\S]*?\.eq\('tenant_id', tenantId\)\.eq\('id', row\.company_id\)\.is\('deleted_at', null\)\.maybeSingle\(\)/,
  'person creation must validate the selected company id in the active tenant');
assert.match(endpoint, /person_company_invalid/);
assert.match(endpoint, /\.rpc\('bd_merge_records'/);
assert.match(endpoint, /bd_merge_person_company_mismatch: 'Both people must be linked to the same company before they can be merged\.'/);
assert.match(endpoint, /database migration 064 is required/);

assert.match(env, /^AVALON_BD_CRM_ENABLED=false$/m);
assert.match(env, /^AVALON_BD_DATA_REVIEWED=false$/m);
assert.match(env, /^ROBBOT3K_LIVE_SEND_ENABLED=false$/m);
assert.match(env, /^ROBBOT3K_GENERIC_WEBHOOK_ENABLED=false$/m);

const gatedOutreachEntrypoints = [
  '../api/admin/robbot3k.js',
  '../api/cron/robbot3k-outreach.js',
  '../api/cron/robbot3k-refresh.js',
  '../api/webhooks/robbot3k.js',
];
for (const path of gatedOutreachEntrypoints) {
  const source = read(path);
  assert.match(source, /requireBdDataReview\(res\)/, `${path} must remain fail-closed behind data review`);
}
assert.match(read('../api/cron/robbot3k-morning.js'), /from '\.\/robbot3k-refresh\.js'/);
assert.match(read('../api/cron/robbot3k-execute.js'), /from '\.\/robbot3k-outreach\.js'/);

assert.doesNotMatch(ui, /robbot3k|Rob Bot|RobBot|rob-bot/i);
assert.match(ui, /action: 'create_person'/);
const personCreateFields = ui.slice(ui.indexOf('Person: ['), ui.indexOf('Opportunity: ['));
assert.match(personCreateFields, /key: 'companyId'[\s\S]*companySelector: true/);
assert.doesNotMatch(personCreateFields, /key: 'company'/,
  'direct person creation cannot use a free-text company name');
assert.match(ui, /<option value="">Unlinked<\/option>/);
assert.match(ui, /<option key=\{company\.id\} value=\{company\.id\}>\{company\.label\}<\/option>/);
assert.match(ui, /nameCounts[\s\S]*normalized_domain[\s\S]*company\.location/,
  'duplicate company names must be disambiguated with live domain or location data');
assert.match(ui, /selectedCompanyId[\s\S]*companies\.find\(\(item\) => item\.id === selectedCompanyId\)[\s\S]*if \(selectedCompanyId && !linkedCompany\) return false;/,
  'person creation must reject a selected id that is not in the live company collection');
assert.match(ui, /companyId: selectedCompanyId \|\| null/);
assert.match(ui, /setPeople\(nextPeople\)/);
assert.match(ui, /No meetings are scheduled in the next 7 days\./);
for (const emptyState of [
  'No opportunities are recorded yet.',
  'No companies match this view.',
  'No people match this view.',
  'No tasks are recorded yet.',
]) assert.ok(ui.includes(emptyState), `missing truthful empty state: ${emptyState}`);
for (const surface of [app, shell, access]) {
  assert.doesNotMatch(surface, /admin\/robbot3k|AdminRobBot3K|Rob Bot/);
}
assert.match(app, /path="\/admin\/bd\/\*"/);

assert.match(contract, /064_avalon_bd_standalone\.sql/i);
assert.match(contract, /seeds no rows/i);
assert.match(contract, /There is no prospect-reconciliation or outbound mutation action/i);
assert.match(contract, /business-row request[\s\S]*bd_agent_mutations[\s\S]*separate service-role requests/i);
assert.match(contract, /business row may already be committed/i);
assert.match(contract, /Agent BD must not receive autonomous CRM[\s\S]*transactional RPC[\s\S]*exact-payload[\s\S]*authorization/i);
assert.match(contract, /immutable mutation entry in one transaction/i,
  'merge must remain the explicit atomic exception');

console.log('Avalon BD standalone release verification passed.');
