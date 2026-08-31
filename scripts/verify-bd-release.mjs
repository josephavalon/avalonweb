import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { bdCrmEnabled, requireBdCrmEnabled } from '../api/_lib/bd-crm-gate.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const migration = read('../supabase/migrations/064_avalon_bd_standalone.sql');
const activityAclReconciliation = read('../supabase/migrations/065_avalon_bd_activity_acl_reconciliation.sql');
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
const migrationFinalPostflightAt = migration.lastIndexOf('\ndo $$\n');
const migrationFinalPostflight = migration.slice(migrationFinalPostflightAt + 1);
assert.equal((migration.match(/\bbegin\s*;/gi) || []).length, 1,
  'migration 064 must contain exactly one transaction BEGIN');
assert.equal((migration.match(/\bcommit\s*;/gi) || []).length, 1,
  'migration 064 must contain exactly one transaction COMMIT');
assert.ok(beginAt >= 0 && beginAt < firstWriteAt, 'migration must begin one transaction before schema writes');
assert.equal((migration.match(/set transaction isolation level read committed;/gi) || []).length, 1,
  'migration 064 must pin exactly one READ COMMITTED transaction');
assert.match(migration, /\nbegin;\nset transaction isolation level read committed;\n/,
  'migration 064 must pin READ COMMITTED immediately after BEGIN');
assert.ok(migrationFinalPostflightAt >= 0,
  'migration 064 must retain its final catalog postflight');
assert.equal(
  createHash('sha256').update(migrationFinalPostflight).digest('hex'),
  'c3f0face999ff0b41261d91aa3105e3a92e5122106523b8250f8f379fbc204bc',
  'migration 064 final postflight, reviewed comments, and COMMIT must remain an exact mutation-free release seal',
);
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
assert.doesNotMatch(migration, /\bexecute\s+(?:format\s*\(\s*)?['$][^;]*\bgrant\b/i,
  'dynamic GRANT statements are not permitted in the standalone migration');
const migrationDynamicLines = migration.split('\n')
  .map((line) => normalizeSql(line))
  .filter((line) => /^execute\s+/.test(line))
  .sort();
assert.deepEqual(migrationDynamicLines, [
  "execute format('alter table public.%i enable row level security', tbl);",
  "execute format('create trigger %i before update on public.%i for each row execute function public.touch_updated_at()', 'trg_' || tbl || '_updated_at', tbl);",
  "execute format('revoke all on public.%i from public, anon, authenticated, service_role', tbl);",
].sort(), 'migration 064 dynamic SQL must be limited to reviewed RLS, revoke, and updated-at statements');
assert.equal((migration.match(/\bexecute\b/gi) || []).length, 8,
  'migration 064 cannot hide an additional dynamic EXECUTE statement');
const topLevelGrants = [...migration.matchAll(/(?:^|\n)\s*grant\s+[\s\S]*?;/gi)]
  .map((match) => normalizeSql(match[0]));
const expectedTopLevelGrants = [
  'grant execute on function public.bd_merge_records(uuid, text, uuid, uuid, integer, integer, uuid) to service_role;',
  'grant select, insert, update on public.bd_companies, public.bd_people, public.bd_opportunities, public.bd_tasks, public.bd_notes, public.bd_files, public.bd_lists, public.bd_call_ingestions, public.bd_agent_identities, public.bd_agent_permissions to service_role;',
  'grant select, insert on public.bd_activities to service_role;',
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
assert.doesNotMatch(
  migration,
  /grant\s+[^;]*\bupdate\b[^;]*\bon\b[^;]*\bpublic\.bd_activities\b[^;]*\bto service_role;/i,
  'bd_activities evidence must not be updateable by service_role',
);
assert.doesNotMatch(migration, /grant\s+[^;]*(truncate|references|trigger)[^;]*to service_role/i);
assert.doesNotMatch(migration, /grant\s+[^;]*(update|delete)[^;]*public\.bd_agent_mutations/i);

const reconciliationBeginAt = activityAclReconciliation.indexOf('\nbegin;');
const reconciliationRevokeAt = activityAclReconciliation.indexOf('revoke update on table public.bd_activities from service_role;');
const reconciliationPostflightAt = activityAclReconciliation.indexOf('-- Verify the exact table and column privilege boundary');
const reconciliationPostflight = activityAclReconciliation.slice(reconciliationPostflightAt);
assert.equal((activityAclReconciliation.match(/\bbegin\s*;/gi) || []).length, 1,
  'migration 065 must contain exactly one transaction BEGIN');
assert.equal((activityAclReconciliation.match(/\bcommit\s*;/gi) || []).length, 1,
  'migration 065 must contain exactly one transaction COMMIT');
assert.ok(reconciliationBeginAt >= 0 && reconciliationBeginAt < reconciliationRevokeAt,
  'migration 065 must begin one transaction before its ACL mutation');
assert.equal((activityAclReconciliation.match(/set transaction isolation level read committed;/gi) || []).length, 1,
  'migration 065 must pin exactly one READ COMMITTED transaction');
assert.match(activityAclReconciliation, /\nbegin;\nset transaction isolation level read committed;\n/,
  'migration 065 must pin READ COMMITTED immediately after BEGIN');
assert.ok(reconciliationPostflightAt > reconciliationRevokeAt,
  'migration 065 must verify the reconciled table and column ACL after the revoke');
assert.equal(
  createHash('sha256').update(reconciliationPostflight).digest('hex'),
  '21dc8b490e7a998967c5e44a9c5d851ce4722e296cf3630c065f22d553d019eb',
  'migration 065 final postflight and COMMIT must remain an exact mutation-free release seal',
);
assert.match(activityAclReconciliation.trim(), /commit;$/);
assert.equal((reconciliationPostflight.match(/(?:^|\n)do \$\$/g) || []).length, 1,
  'migration 065 must have exactly one final postflight block');
assert.equal((reconciliationPostflight.match(/(?:^|\n)end \$\$;/g) || []).length, 1,
  'migration 065 final postflight must close exactly once');
const reconciliationPostflightEndAt = reconciliationPostflight.lastIndexOf('\nend $$;');
assert.ok(reconciliationPostflightEndAt >= 0, 'migration 065 final postflight must close before commit');
assert.equal(
  reconciliationPostflight.slice(reconciliationPostflightEndAt).trim(),
  'end $$;\n\ncommit;',
  'migration 065 must commit immediately after the final postflight with no executable statement in between',
);
const reconciliationRevokes = [...activityAclReconciliation.matchAll(/(?:^|\n)\s*revoke\s+[\s\S]*?;/gi)]
  .map((match) => normalizeSql(match[0]))
  .sort();
assert.deepEqual(reconciliationRevokes, [
  'revoke all on function public.bd_companies_guard_archive_people() from public, anon, authenticated, service_role;',
  'revoke all on function public.bd_people_require_active_company() from public, anon, authenticated, service_role;',
  'revoke update on table public.bd_activities from service_role;',
].sort(), 'migration 065 must contain only the reviewed revokes');
assert.doesNotMatch(
  activityAclReconciliation,
  /\bgrant\b/i,
  'migration 065 must never contain a privilege or role-membership GRANT',
);
assert.doesNotMatch(activityAclReconciliation, /execute\s+format\s*\(/i,
  'migration 065 must not hide ACL mutations in formatted SQL');
const reconciliationExecuteStatements = [...activityAclReconciliation.matchAll(/(?:^|;)\s*execute\s+/gim)];
assert.equal(reconciliationExecuteStatements.length, 4,
  'migration 065 dynamic SQL must be limited to two reviewed functions and two reviewed triggers');
assert.equal((activityAclReconciliation.match(/\bexecute\b/gi) || []).length, 8,
  'migration 065 cannot hide an additional dynamic EXECUTE statement');
for (const expectedDynamicDdl of [
  /execute\s+\$ddl\$\s*create function public\.bd_people_require_active_company\(\)/i,
  /execute\s+\$ddl\$\s*create function public\.bd_companies_guard_archive_people\(\)/i,
  /execute\s+'create trigger trg_bd_people_active_company before insert or update of company_id, tenant_id, deleted_at on public\.bd_people for each row execute function public\.bd_people_require_active_company\(\)'/i,
  /execute\s+'create trigger trg_bd_companies_archive_people before update of deleted_at on public\.bd_companies for each row execute function public\.bd_companies_guard_archive_people\(\)'/i,
]) {
  assert.equal((activityAclReconciliation.match(expectedDynamicDdl) || []).length, 1,
    'migration 065 contains an unexpected dynamic DDL statement');
}
assert.doesNotMatch(activityAclReconciliation, /table_definition\.relkind in \(/,
  'migration 065 cannot accept partitioned tables');
assert.ok((activityAclReconciliation.match(/table_definition\.relkind = 'r'/g) || []).length >= 6,
  'migration 065 must require ordinary heap tables in preflight and postflight');
assert.ok((activityAclReconciliation.match(/table_definition\.relpersistence = 'p'/g) || []).length >= 6,
  'migration 065 must require permanent heap tables in preflight and postflight');
assert.ok((activityAclReconciliation.match(/not table_definition\.relispartition/g) || []).length >= 6,
  'migration 065 must reject leaf partitions in preflight and postflight');
assert.ok((activityAclReconciliation.match(/from pg_inherits table_lineage/g) || []).length >= 6,
  'migration 065 must reject both inheritance parents and children');
const activitiesCatalogLookups = [...activityAclReconciliation.matchAll(
  /select\s+table_definition\.oid[\s\S]*?into\s+activities_oid[\s\S]*?;/gi,
)];
assert.equal(activitiesCatalogLookups.length, 2,
  'migration 065 must resolve public.bd_activities exactly once before and after reconciliation');
for (const lookup of activitiesCatalogLookups) {
  assert.match(lookup[0], /table_namespace\.nspname = 'public'/);
  assert.match(lookup[0], /table_definition\.relname = 'bd_activities'/);
  assert.match(lookup[0], /table_definition\.relkind = 'r'/);
  assert.match(lookup[0], /table_definition\.relpersistence = 'p'/);
  assert.match(lookup[0], /not table_definition\.relispartition/);
  assert.match(lookup[0], /table_lineage\.inhrelid = table_definition\.oid[\s\S]*table_lineage\.inhparent = table_definition\.oid/);
}
for (const tableName of ['bd_people', 'bd_companies']) {
  const lookups = [...activityAclReconciliation.matchAll(new RegExp(
    `select\\s+table_definition\\.oid[\\s\\S]*?into\\s+${tableName === 'bd_people' ? 'people' : 'companies'}_oid[\\s\\S]*?;`,
    'gi',
  ))];
  assert.equal(lookups.length, 2, `migration 065 must resolve public.${tableName} before and after reconciliation`);
  for (const lookup of lookups) {
    assert.match(lookup[0], new RegExp(`table_definition\\.relname = '${tableName}'`));
    assert.match(lookup[0], /table_definition\.relkind = 'r'/);
    assert.match(lookup[0], /table_definition\.relpersistence = 'p'/);
    assert.match(lookup[0], /not table_definition\.relispartition/);
    assert.match(lookup[0], /table_lineage\.inhrelid = table_definition\.oid[\s\S]*table_lineage\.inhparent = table_definition\.oid/);
  }
}
for (const role of ['anon', 'authenticated', 'service_role']) {
  assert.ok(activityAclReconciliation.includes(`to_regrole('${role}')`),
    `migration 065 must preflight ${role}`);
}
assert.match(activityAclReconciliation, /column_definition\.attnum > 0[\s\S]*not column_definition\.attisdropped[\s\S]*column_definition\.attacl is not null[\s\S]*bd_activity_acl_column_acl_forbidden/);
assert.match(activityAclReconciliation, /bd_activity_acl_postflight_column_acl_forbidden/);
assert.ok((activityAclReconciliation.match(/column_definition\.attacl is not null/g) || []).length >= 2,
  'migration 065 must reject column ACL entries before and after reconciliation');
assert.match(activityAclReconciliation, /has_table_privilege\('service_role', activities_oid, 'SELECT'\)[\s\S]*has_table_privilege\('service_role', activities_oid, 'INSERT'\)[\s\S]*bd_activity_acl_required_privileges_missing/);
assert.match(activityAclReconciliation, /array_agg\(expanded_acl\.privilege_type order by expanded_acl\.privilege_type\)[\s\S]*array\['INSERT', 'SELECT'\]::text\[\][\s\S]*bd_activity_acl_direct_service_privileges_mismatch/);
assert.match(activityAclReconciliation, /has_any_column_privilege\('service_role', activities_oid, 'UPDATE'\)[\s\S]*has_any_column_privilege\('service_role', activities_oid, 'REFERENCES'\)[\s\S]*bd_activity_acl_effective_service_column_privilege_forbidden/);
assert.match(activityAclReconciliation, /array\['anon', 'authenticated'\][\s\S]*array\['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'\][\s\S]*has_any_column_privilege\(checked_role, activities_oid, checked_privilege\)[\s\S]*bd_activity_acl_effective_browser_column_privilege_forbidden/);
assert.match(activityAclReconciliation, /lock table public\.bd_companies, public\.bd_people in share row exclusive mode;/);
assert.match(activityAclReconciliation, /oid = activities_oid[\s\S]*oid = people_oid[\s\S]*oid = companies_oid[\s\S]*bd_company_race_rls_required/);
assert.match(activityAclReconciliation, /oid = people_oid[\s\S]*oid = companies_oid[\s\S]*bd_company_race_postflight_rls_required/);
for (const sql of [migration, activityAclReconciliation]) {
  assert.ok(sql.includes("btrim(function_definition.prosrc, E' \\t\\n\\r')"),
    'trigger function catalog checks must trim surrounding newlines before canonicalization');
}

const canonicalBody = (value) => value.trim().replace(/\s+/g, ' ');
function triggerFunctionBody(sql, functionName) {
  const match = sql.match(new RegExp(`create function public\\.${functionName}\\(\\)[\\s\\S]*?as \\$function\\$([\\s\\S]*?)\\$function\\$`, 'i'));
  assert.ok(match, `missing ${functionName} function body`);
  return canonicalBody(match[1]);
}
const raceFunctions = [
  ['bd_people_require_active_company', '50c5a24940b092a1134945935a4f75e8'],
  ['bd_companies_guard_archive_people', 'ea209b74da6a02a8657b2f51b6c922ac'],
];
for (const [functionName, expectedHash] of raceFunctions) {
  const freshBody = triggerFunctionBody(migration, functionName);
  const reconciliationBody = triggerFunctionBody(activityAclReconciliation, functionName);
  assert.equal(reconciliationBody, freshBody, `${functionName} must be identical in migrations 064 and 065`);
  assert.equal(createHash('md5').update(freshBody).digest('hex'), expectedHash,
    `${functionName} catalog source checksum must match migration 065`);
  assert.equal((activityAclReconciliation.match(new RegExp(expectedHash, 'g')) || []).length, 2,
    `${functionName} checksum must guard existing objects and postflight`);
  const declaration = new RegExp(`create function public\\.${functionName}\\(\\)[\\s\\S]*?returns trigger[\\s\\S]*?language plpgsql[\\s\\S]*?security definer[\\s\\S]*?set search_path = pg_catalog, pg_temp[\\s\\S]*?as \\$function\\$`, 'i');
  assert.match(migration, declaration);
  assert.match(activityAclReconciliation, declaration);
  const revoke = new RegExp(`revoke all on function public\\.${functionName}\\(\\)\\s+from public, anon, authenticated, service_role;`, 'i');
  assert.match(migration, revoke);
  assert.match(activityAclReconciliation, revoke);
}
assert.equal((activityAclReconciliation.match(/\)\)\s*=\s*expected_function\.source_md5/g) || []).length, 2,
  'migration 065 must enforce the reviewed function-source hash before and after reconciliation');
const expectedTouchHashFinalPredicate = normalizeSql(`
  and md5(regexp_replace(
    btrim(function_definition.prosrc, E' \\t\\n\\r'),
    '[[:space:]]+', ' ', 'g'
  )) = '0146fd32790ffdead7f8c61f46267c34'
) then
`);
for (const sql of [migration, activityAclReconciliation]) {
  assert.equal(normalizeSql(sql).split(expectedTouchHashFinalPredicate).length - 1, 2,
    'touch_updated_at must finish both catalog predicates with the exact reviewed equality hash check');
}
assert.match(triggerFunctionBody(migration, 'bd_people_require_active_company'), /new\.deleted_at is not null[\s\S]*new\.company_id is null[\s\S]*return new/i);
assert.match(triggerFunctionBody(migration, 'bd_people_require_active_company'), /tenant_id = new\.tenant_id[\s\S]*id = new\.company_id[\s\S]*deleted_at is null[\s\S]*for share[\s\S]*bd_person_company_inactive/i);
assert.match(triggerFunctionBody(migration, 'bd_companies_guard_archive_people'), /old\.deleted_at is null[\s\S]*new\.deleted_at is not null[\s\S]*person_record\.tenant_id = old\.tenant_id[\s\S]*person_record\.company_id = old\.id[\s\S]*person_record\.deleted_at is null[\s\S]*bd_company_archive_active_people/i);
for (const functionName of raceFunctions.map(([name]) => name)) {
  for (const sql of [migration, activityAclReconciliation]) {
    const body = triggerFunctionBody(sql, functionName);
    assert.match(body, /current_setting\('transaction_isolation'\) <> 'read committed'/,
      `${functionName} must fail closed outside READ COMMITTED`);
    assert.match(body, /bd_company_race_read_committed_required/,
      `${functionName} must expose the reviewed isolation failure code`);
  }
}
for (const sql of [migration, activityAclReconciliation]) {
  assert.match(sql, /before insert or update of company_id, tenant_id, deleted_at on public\.bd_people[\s\S]*execute function public\.bd_people_require_active_company\(\)/i);
  assert.match(sql, /before update of deleted_at on public\.bd_companies[\s\S]*execute function public\.bd_companies_guard_archive_people\(\)/i);
  assert.match(sql, /trigger_definition\.tgfoid = function_oid[\s\S]*trigger_definition\.tgtype = 23[\s\S]*cardinality\(string_to_array\(btrim\(trigger_definition\.tgattr::text\), ' '\)::smallint\[\]\) = 3[\s\S]*attribute\.attname = 'company_id'[\s\S]*attribute\.attname = 'tenant_id'[\s\S]*attribute\.attname = 'deleted_at'/);
  assert.match(sql, /trigger_definition\.tgtype = 19[\s\S]*cardinality\(string_to_array\(btrim\(trigger_definition\.tgattr::text\), ' '\)::smallint\[\]\) = 1[\s\S]*attribute\.attname = 'deleted_at'/);
  assert.match(sql, /function_definition\.prosecdef[\s\S]*function_definition\.proconfig = array\['search_path=pg_catalog, pg_temp'\]::text\[\][\s\S]*function_definition\.prosrc/);
  assert.match(sql, /aclexplode\(coalesce\([\s\S]*function_definition\.proacl[\s\S]*expanded_acl\.grantee <> function_definition\.proowner/);
  assert.match(sql, /has_function_privilege\(checked_role, function_oid, 'EXECUTE'\)/);
  assert.match(sql, /person_record\.deleted_at is null[\s\S]*company_record\.deleted_at is not null[\s\S]*bd_active_person_company_violation/);
  assert.match(sql, /to_regprocedure\('public\.touch_updated_at\(\)'\)[\s\S]*trg_bd_people_updated_at[\s\S]*trg_bd_companies_updated_at/);
  assert.equal((sql.match(/0146fd32790ffdead7f8c61f46267c34/g) || []).length, 2,
    'the live touch_updated_at body hash must be pinned before and after the BD schema mutation');
  assert.match(sql, /function_definition\.proname = 'touch_updated_at'[\s\S]*function_definition\.prorettype = 'trigger'::regtype[\s\S]*function_definition\.pronargs = 0[\s\S]*function_definition\.prokind = 'f'[\s\S]*function_language\.lanname = 'plpgsql'/);
  assert.match(sql, /not function_definition\.prosecdef[\s\S]*function_definition\.provolatile = 'v'[\s\S]*function_definition\.proparallel = 'u'[\s\S]*not function_definition\.proleakproof[\s\S]*function_definition\.proconfig is null[\s\S]*function_definition\.proacl is null[\s\S]*0146fd32790ffdead7f8c61f46267c34/);
  assert.match(sql, /\(trigger_definition\.tgtype & 2\) = 2[\s\S]*trg_bd_people_active_company[\s\S]*trg_bd_people_updated_at[\s\S]*trg_bd_companies_archive_people[\s\S]*trg_bd_companies_updated_at[\s\S]*bd_company_race_unreviewed_before_trigger/);
}
assert.match(migration, /function_definition\.proowner = to_regrole\(current_user\)/,
  'fresh migration preflight must require the timestamp trigger to be owned by the migration role');
assert.match(migration, /function_definition\.proowner = \(select relowner from pg_class where oid = people_oid\)[\s\S]*function_definition\.proowner = \(select relowner from pg_class where oid = companies_oid\)/,
  'fresh migration postflight must bind the timestamp trigger owner to both guarded tables');
assert.ok((activityAclReconciliation.match(/function_definition\.proowner = people_owner/g) || []).length >= 2,
  'reconciliation must bind the timestamp trigger owner to the people table before and after mutation');
assert.ok((activityAclReconciliation.match(/function_definition\.proowner = companies_owner/g) || []).length >= 2,
  'reconciliation must bind the timestamp trigger owner to the companies table before and after mutation');
for (const functionName of raceFunctions.map(([name]) => name)) {
  assert.match(activityAclReconciliation, new RegExp(`if to_regprocedure\\('public\\.${functionName}\\(\\)'\\) is null then[\\s\\S]*create function public\\.${functionName}`),
    `migration 065 must install ${functionName} only when absent`);
}
assert.match(activityAclReconciliation, /bd_company_race_existing_function_mismatch/);
assert.match(activityAclReconciliation, /bd_people_company_existing_trigger_mismatch/);
assert.match(activityAclReconciliation, /bd_company_archive_existing_trigger_mismatch/);

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
assert.match(endpoint, /async function assertPersonCompanyChangeValid[\s\S]*Object\.hasOwn\(fields, 'company_id'\)[\s\S]*fields\.company_id === null[\s\S]*db\.from\('bd_companies'\)\.select\('id'\)[\s\S]*?\.eq\('tenant_id', tenantId\)\.eq\('id', fields\.company_id\)\.is\('deleted_at', null\)\.maybeSingle\(\)/,
  'person company changes must share an active, tenant-scoped company validator with explicit unlink support');
assert.match(endpoint, /export async function preparePersonUpdatePatch[\s\S]*normalizePersonInput\(input \|\| \{\}, \{ partial: true \}\)[\s\S]*await assertPersonCompanyChangeValid\(db, tenantId, patch\)[\s\S]*return patch/,
  'the exported person-update preparation path must perform normalization and company validation');
const createPersonSource = endpoint.slice(endpoint.indexOf('async function createPerson'), endpoint.indexOf('async function createOpportunity'));
assert.match(createPersonSource, /await assertPersonCompanyChangeValid\(db, tenantId, row\)/,
  'person creation must use the shared company-change validator');
const updateCoreSource = endpoint.slice(endpoint.indexOf('async function updateCoreRecord'), endpoint.indexOf('async function changeStage'));
assert.match(endpoint, /export async function updateCoreRecord/,
  'the real update path must remain behavior-testable');
assert.match(updateCoreSource, /config\.objectType === 'person'[\s\S]*await preparePersonUpdatePatch\(db, tenantId, body\.patch\)/,
  'updateCoreRecord must execute the tested person-update preparation path');
assert.match(endpoint, /person_company_invalid/);
assert.match(endpoint, /bd_company_archive_active_people: 'Archive blocked because active people still reference this company\. Unlink or archive those people first\.'/);
assert.match(endpoint, /bd_company_race_read_committed_required: 'This protected company update requires the standard database isolation mode\. Retry the request\.'/);
assert.match(endpoint, /if \(messages\[code\]\) return res\.status\(409\)/,
  'database race guards must map to an operator-actionable 409 response');
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
assert.match(ui, /tasks\.length === 0 \? <EmptyRows>No tasks are recorded yet\./,
  'the first-task empty state must be based on all persisted tasks, including cancelled records');
assert.match(ui, /tasks\.length > 0 && open\.length === 0 && done\.length === 0 \? <EmptyRows>No active tasks\. Cancelled tasks are hidden/,
  'cancelled-only queues must not claim that no task records exist');
const hydrateWorkspaceSource = ui.slice(
  ui.indexOf('function hydrateWorkspace('),
  ui.indexOf('function deriveCompanyRollups('),
);
assert.ok(hydrateWorkspaceSource.startsWith('function hydrateWorkspace('),
  'the reviewed workspace hydrator must remain present');
assert.equal(
  createHash('sha256').update(hydrateWorkspaceSource).digest('hex'),
  'cbbc91ce9bd2b9ca9dba7b6052b32f3b2b02b4dfab4828bcacf7f658df8afe7f',
  'workspace hydration must preserve the exact reviewed no-filter task path',
);
assert.match(ui, /const normalizedTasks = taskRows\.map\([\s\S]*return \{ companies, people: normalizedPeople, opportunities: normalizedOpportunities, tasks: normalizedTasks \};/,
  'workspace hydration must preserve every persisted task, including cancelled records');
assert.match(ui, /fetchBdCollection\('tasks', 'tasks'\),[\s\S]*\.then\(\(\[dashboardPayload, companyRows, peopleRows, opportunityRows, taskRows\]\) =>/,
  'the raw persisted task collection must remain bound to taskRows');
assert.match(ui, /const workspace = hydrateWorkspace\(\s*companyRows,\s*peopleRows,\s*opportunityRows,\s*taskRows,\s*\);/,
  'workspace hydration must receive the unfiltered persisted task collection');
assert.match(ui, /setTasks\(workspace\.tasks\)/,
  'the live workspace must retain the complete hydrated task collection');
assert.match(ui, /view === 'tasks' \? <TasksView tasks=\{tasks\} onToggle=\{toggleTask\} \/> : null/,
  'TasksView must receive the complete persisted task collection without call-site filtering');
for (const surface of [app, shell, access]) {
  assert.doesNotMatch(surface, /admin\/robbot3k|AdminRobBot3K|Rob Bot/);
}
assert.match(app, /path="\/admin\/bd\/\*"/);

assert.match(contract, /064_avalon_bd_standalone\.sql/i);
assert.match(contract, /065_avalon_bd_activity_acl_reconciliation\.sql/i);
assert.match(contract, /bd_activities[\s\S]*append-only/i);
assert.match(contract, /seeds no rows/i);
assert.match(contract, /There is no prospect-reconciliation or outbound mutation action/i);
assert.match(contract, /business-row request[\s\S]*bd_agent_mutations[\s\S]*separate service-role requests/i);
assert.match(contract, /business row may already be committed/i);
assert.match(contract, /Agent BD must not receive autonomous CRM[\s\S]*transactional RPC[\s\S]*exact-payload[\s\S]*authorization/i);
assert.match(contract, /immutable mutation entry in one transaction/i,
  'merge must remain the explicit atomic exception');

console.log('Avalon BD standalone release verification passed.');
