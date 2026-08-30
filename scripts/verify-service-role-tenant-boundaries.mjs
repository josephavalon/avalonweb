/**
 * Static regression guard for service-role API tenant/object authorization.
 *
 * These handlers intentionally use Supabase's service role, which bypasses
 * RLS. Authentication alone is therefore insufficient: the caller's tenant
 * and the authorized parent object must be present in every sensitive query.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import quoInboundHandler from '../api/webhooks/quo-inbound.js';
import { ensurePersistedVisitJti } from '../api/events/manifest.js';
import { requireEventVisitRead, tokenMatchesPersistedVisitJti } from '../api/events/serve.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const communicationThread = read('api/admin/communications/thread.js');
const communicationThreads = read('api/admin/communications/threads.js');
const communicationStore = read('api/_lib/comm-store.js');
const quoInbound = read('api/webhooks/quo-inbound.js');
const communicationMigration = read('supabase/migrations/057_communications_tenant_integrity.sql');
const eventManifest = read('api/events/manifest.js');
const eventServe = read('api/events/serve.js');

function queryStatements(source, table) {
  const marker = `.from('${table}')`;
  const statements = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) break;
    const end = source.indexOf(';', start);
    assert.notEqual(end, -1, `${table} query must end with a semicolon`);
    statements.push(source.slice(start, end));
    cursor = end + 1;
  }
  return statements;
}

function assertTenantAndParentScope(source, table, parentExpression) {
  const statements = queryStatements(source, table);
  assert.ok(statements.length > 0, `${table} must be queried`);
  for (const statement of statements) {
    assert.match(statement, /\.eq\('tenant_id', tenantId\)/, `${table} query is missing caller tenant scope`);
    assert.match(statement, parentExpression, `${table} query is missing its authorized parent scope`);
  }
}

function jtiQuery(result, calls) {
  const query = {
    eq(field, value) { calls.push(['eq', field, value]); return query; },
    is(field, value) { calls.push(['is', field, value]); return query; },
    select(columns) { calls.push(['select', columns]); return query; },
    async maybeSingle() { return result; },
  };
  return query;
}

function jtiDb({ claimResult = { data: null, error: null }, winnerResult = { data: null, error: null } } = {}) {
  const calls = [];
  return {
    calls,
    db: {
      from(table) {
        assert.equal(table, 'event_visits');
        return {
          update(patch) {
            calls.push(['update', patch]);
            return jtiQuery(claimResult, calls);
          },
          select(columns) {
            calls.push(['read', columns]);
            return jtiQuery(winnerResult, calls);
          },
        };
      },
    },
  };
}

// Communications: authorize the parent thread inside the caller's tenant,
// then derive message and unread mutations from that authorized object.
assert.match(communicationThread, /const \{ db, tenantId \} = authed/);
const communicationThreadQueries = queryStatements(communicationThread, 'comm_threads');
assert.equal(communicationThreadQueries.length, 2, 'thread detail should read and mark one authorized thread');
for (const statement of communicationThreadQueries) {
  assert.match(statement, /\.eq\('tenant_id', tenantId\)/, 'comm_threads access must be tenant scoped');
}
assert.match(communicationThreadQueries[0], /\.eq\('id', threadId\)/, 'parent lookup must bind the requested thread id');
assert.doesNotMatch(communicationThreadQueries[0], /tenant_id\.is\.null/, 'unassigned threads must fail closed');
assert.match(communicationThreadQueries[1], /\.eq\('id', thread\.id\)/, 'unread mutation must use the authorized parent id');
const communicationMessages = queryStatements(communicationThread, 'comm_messages');
assert.equal(communicationMessages.length, 1);
assert.match(communicationMessages[0], /\.eq\('thread_id', thread\.id\)/, 'message history must derive from the authorized parent');
assert.match(communicationMessages[0], /\.eq\('tenant_id', tenantId\)/, 'message history must be tenant scoped independently of its parent');

const communicationListQueries = queryStatements(communicationThreads, 'comm_threads');
assert.equal(communicationListQueries.length, 1, 'thread list should issue one tenant-scoped query');
assert.match(communicationListQueries[0], /\.eq\('tenant_id', tenantId\)/, 'thread list must require the caller tenant');
assert.doesNotMatch(communicationListQueries[0], /tenant_id\.is\.null|\.or\(/, 'thread list must never expose null-tenant rows');

// The shared store is the service-role write boundary: tenant is mandatory in
// both exported APIs, thread resolution/update uses tenant+channel+contact, and
// child messages always carry the same tenant.
assert.doesNotMatch(communicationStore, /tenantId\s*=\s*null/, 'communication store must not default tenant ownership to null');
assert.match(communicationStore, /if \(!db \|\| !tenantId \|\| !contact \|\| !body\) return null/,
  'inbound and outbound persistence must fail closed without tenant ownership');
const storeThreads = queryStatements(communicationStore, 'comm_threads');
assert.equal(storeThreads.length, 3, 'comm-store should tenant-resolve, tenant-update, or tenant-create one thread');
assert.match(storeThreads[0], /\.eq\('tenant_id', tenantId\)[\s\S]*\.eq\('channel', channel\)[\s\S]*\.eq\('contact', contact\)/,
  'thread resolution must use tenant, channel, and contact');
assert.match(storeThreads[1], /\.eq\('id', row\.id\)[\s\S]*\.eq\('tenant_id', tenantId\)[\s\S]*\.eq\('channel', channel\)[\s\S]*\.eq\('contact', contact\)/,
  'thread update must preserve the resolved tenant, channel, and contact boundary');
assert.match(storeThreads[2], /tenant_id:\s*tenantId/, 'new threads must have explicit tenant ownership');
for (const statement of queryStatements(communicationStore, 'comm_messages')) {
  assert.match(statement, /tenant_id:\s*tenantId/, 'new messages must have explicit tenant ownership');
}

assert.match(quoInbound, /process\.env\.QUO_TENANT_ID/, 'Quo inbound must require an explicit tenant binding');
assert.match(quoInbound, /if \(!tenantId\)[\s\S]*quo_tenant_not_configured/,
  'Quo inbound must fail closed when its tenant binding is absent');
assert.match(quoInbound, /recordInbound\(\{\s*tenantId,/, 'Quo inbound must pass the configured tenant to persistence');

const priorQuoSecret = process.env.QUO_WEBHOOK_SECRET;
const priorQuoTenant = process.env.QUO_TENANT_ID;
try {
  process.env.QUO_WEBHOOK_SECRET = 'tenant-boundary-test-secret';
  delete process.env.QUO_TENANT_ID;
  const responseState = { status: 200, body: null };
  const response = {
    status(code) { responseState.status = code; return this; },
    json(body) { responseState.body = body; return this; },
  };
  await quoInboundHandler({
    method: 'POST',
    query: { secret: 'tenant-boundary-test-secret' },
    headers: {},
    body: { type: 'message.received', data: { object: { from: '+14155550101', body: 'test' } } },
  }, response);
  assert.equal(responseState.status, 503, 'Quo inbound must reject an authenticated callback with no tenant binding');
  assert.equal(responseState.body?.code, 'quo_tenant_not_configured');
} finally {
  if (priorQuoSecret === undefined) delete process.env.QUO_WEBHOOK_SECRET;
  else process.env.QUO_WEBHOOK_SECRET = priorQuoSecret;
  if (priorQuoTenant === undefined) delete process.env.QUO_TENANT_ID;
  else process.env.QUO_TENANT_ID = priorQuoTenant;
}

// Migration 057 keeps unknown historical ownership untouched while enforcing
// tenant integrity for every new/changed row.
assert.match(communicationMigration, /comm_threads_tenant_id_required[\s\S]*check \(tenant_id is not null\) not valid/i);
assert.match(communicationMigration, /comm_messages_tenant_id_required[\s\S]*check \(tenant_id is not null\) not valid/i);
assert.match(communicationMigration, /unique index[\s\S]*\(tenant_id, channel, contact\)[\s\S]*where tenant_id is not null/i,
  'thread uniqueness must be tenant scoped and leave unknown historical rows for review');
assert.match(communicationMigration, /drop constraint if exists comm_threads_channel_contact_key/i,
  'the original global contact uniqueness constraint must be retired');
assert.match(communicationMigration, /unique \(id, tenant_id\)/i,
  'the parent must expose a composite unique key for tenant-bound references');
assert.match(communicationMigration, /foreign key \(thread_id, tenant_id\)[\s\S]*references public\.comm_threads \(id, tenant_id\)[\s\S]*not valid/i,
  'messages must reference a thread in the same tenant without guessing historical ownership');
assert.doesNotMatch(communicationMigration, /\b(?:delete\s+from|update\s+public\.comm_(?:threads|messages)\s+set)\b/i,
  'the integrity migration must not delete or backfill unknown communication ownership');

// Manifest: every visit read/write is scoped to both the caller's tenant and
// the already-authorized event container. Referenced services are resolved by
// their own tenant-scoped query instead of an unscoped nested join.
assert.doesNotMatch(eventManifest, /getServiceClient/, 'manifest must reuse the authenticated caller context');
assert.match(eventManifest, /const \{ db, tenantId \} = caller/);
const manifestContainers = queryStatements(eventManifest, 'event_containers');
assert.equal(manifestContainers.length, 1);
assert.match(manifestContainers[0], /\.eq\('slug', slug\)/);
assert.match(manifestContainers[0], /\.eq\('tenant_id', tenantId\)/);
assertTenantAndParentScope(eventManifest, 'event_visits', /\.eq\('container_id', (?:container\.id|containerId)\)/);
const manifestServices = queryStatements(eventManifest, 'event_services');
assert.equal(manifestServices.length, 1);
assert.match(manifestServices[0], /\.eq\('tenant_id', tenantId\)/);
assert.match(eventManifest, /event_service_scope_mismatch/, 'cross-tenant service references must fail closed');
assert.doesNotMatch(eventManifest, /winner\?\.qr_jti \|\| candidate/,
  'manifest must never mint with a candidate that was not confirmed in storage');

const jtiScope = {
  tenantId: 'tenant-a',
  containerId: 'event-a',
  visit: { id: 'visit-a', qr_jti: null },
};
const claimedJti = 'claimed-jti';
const claimed = jtiDb({ claimResult: { data: { qr_jti: claimedJti }, error: null } });
assert.equal(await ensurePersistedVisitJti({
  ...jtiScope,
  db: claimed.db,
  createJti: () => claimedJti,
}), claimedJti, 'manifest must return the exact JTI confirmed by its conditional write');
assert.equal(claimed.calls.some(([kind]) => kind === 'read'), false, 'a successful claim should not need a winner read');

const winningJti = 'concurrent-winner-jti';
const raced = jtiDb({
  claimResult: { data: null, error: null },
  winnerResult: { data: { qr_jti: winningJti }, error: null },
});
assert.equal(await ensurePersistedVisitJti({
  ...jtiScope,
  db: raced.db,
  createJti: () => 'losing-candidate-jti',
}), winningJti, 'a concurrent claim loser must use only the persisted winner');

const claimReadError = new Error('claim read failed');
await assert.rejects(
  ensurePersistedVisitJti({
    ...jtiScope,
    db: jtiDb({ claimResult: { data: null, error: claimReadError } }).db,
    createJti: () => 'candidate-jti',
  }),
  claimReadError,
  'a conditional write/read error must stop token issuance',
);

const winnerReadError = new Error('winner read failed');
await assert.rejects(
  ensurePersistedVisitJti({
    ...jtiScope,
    db: jtiDb({
      claimResult: { data: null, error: null },
      winnerResult: { data: null, error: winnerReadError },
    }).db,
    createJti: () => 'candidate-jti',
  }),
  winnerReadError,
  'a concurrent-winner read error must stop token issuance',
);

await assert.rejects(
  ensurePersistedVisitJti({
    ...jtiScope,
    db: jtiDb().db,
    createJti: () => 'unpersisted-candidate-jti',
  }),
  /event_visit_jti_not_persisted/,
  'a missing persisted winner must never fall back to the generated candidate',
);

// Serve: require and authorize the event slug first, then bind visit lookup,
// service lookup, token use, and the photo-release mutation to that event.
assert.doesNotMatch(eventServe, /getServiceClient/, 'serve must reuse the authenticated caller context');
assert.match(eventServe, /const \{ db, tenantId \} = caller/);
assert.match(eventServe, /if \(!slug\).*Event slug is required/);
const serveContainers = queryStatements(eventServe, 'event_containers');
assert.equal(serveContainers.length, 1);
assert.match(serveContainers[0], /\.eq\('slug', slug\)/);
assert.match(serveContainers[0], /\.eq\('tenant_id', tenantId\)/);
assertTenantAndParentScope(eventServe, 'event_visits', /\.eq\('container_id', container\.id\)/);
const serveServices = queryStatements(eventServe, 'event_services');
assert.equal(serveServices.length, 1);
assert.match(serveServices[0], /\.eq\('tenant_id', tenantId\)/);
assert.match(eventServe, /tokenPayload\.ev !== container\.slug && tokenPayload\.ev !== container\.id/);
assert.equal(tokenMatchesPersistedVisitJti({ jti: 'same-jti' }, 'same-jti'), true,
  'serve must accept an exact non-empty persisted JTI match');
assert.equal(tokenMatchesPersistedVisitJti({ jti: 'token-jti' }, null), false,
  'serve must reject a validly signed token when the visit has no persisted JTI');
assert.equal(tokenMatchesPersistedVisitJti({ jti: 'token-jti' }, 'stored-jti'), false,
  'serve must reject rotated or replayed JTIs');
assert.throws(
  () => requireEventVisitRead({ data: { id: 'visit-a', qr_jti: 'same-jti' }, error: new Error('visit read failed') }),
  /visit read failed/,
  'serve must fail closed on a scoped visit read error even if data is also present',
);
assert.equal(requireEventVisitRead({ data: { id: 'visit-a' }, error: null })?.id, 'visit-a');
assert.ok(
  eventServe.indexOf(".from('event_visits')") < eventServe.indexOf(".rpc('transition_event_visit'"),
  'the tenant/event-scoped visit lookup must precede the service-role transition RPC',
);

console.log('PASS: service-role communication and event APIs preserve tenant and parent-object authorization.');
