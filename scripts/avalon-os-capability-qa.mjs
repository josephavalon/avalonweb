import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OS_CAPABILITIES,
  OS_CAPABILITY_COUNT,
  capabilitySlug,
} from '../src/data/osCapabilities.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (condition) return;
  failed = true;
  console.error(`FAIL: ${message}`);
}

const app = read('src/App.jsx');
const nav = read('src/components/admin/AdminShell.jsx');
const access = read('src/lib/adminAccess.js');
const capabilityApi = read('api/os/v1/capabilities/[slug].js');
const integrationApi = read('api/os/v1/integrations/[provider].js');
const coreMigration = read('supabase/migrations/042_avalon_os_core.sql');
const operationsMigration = read('supabase/migrations/043_avalon_os_operations.sql');

assert(OS_CAPABILITY_COUNT >= 103, `expected at least 103 OS capabilities, found ${OS_CAPABILITY_COUNT}`);
assert(new Set(OS_CAPABILITIES.map(({ slug }) => slug)).size === OS_CAPABILITY_COUNT, 'capability slugs must be unique');
assert(OS_CAPABILITIES.every(({ slug }) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)), 'every capability needs a stable URL-safe slug');

const navLabels = [...nav.matchAll(/soon\('([^']+)'\)/g)].map((match) => match[1]);
const registeredSlugs = new Set(OS_CAPABILITIES.map(({ slug }) => slug));
for (const label of navLabels) {
  assert(registeredSlugs.has(capabilitySlug(label)), `navigation capability is not registered: ${label}`);
}
assert(new Set(navLabels).size >= 100, 'the complete hidden admin capability inventory must stay registered in navigation');

for (const [name, source] of [['App routes', app], ['admin navigation', nav], ['admin access', access]]) {
  assert(!source.includes('/admin/soon'), `${name} still references /admin/soon`);
}
assert(app.includes('path="/admin/os/:capability"'), 'Avalon OS capability route is missing');
assert(app.includes('AVALON_OS_BETA_ENABLED ? <RequireAuth'), 'Avalon OS route must be beta-flag gated');
assert(access.includes("matchesAllowList(normalized, ['/admin/os']) && !avalonOsBetaEnabled()"), 'admin access must reject OS routes outside beta');

for (const [name, source] of [['capability API', capabilityApi], ['integration API', integrationApi]]) {
  assert(source.includes('requireOsBeta'), `${name} must be disabled outside beta`);
  assert(source.includes('requireOsOperator'), `${name} must derive tenant and actor from an authenticated operator session`);
  assert(source.includes('idempotencyKey'), `${name} mutations must require idempotency`);
  assert(source.includes('requestId'), `${name} must emit request IDs`);
  assert(source.includes('writeAuditEvent'), `${name} mutations must append audit evidence`);
}

for (const table of [
  'os_capability_records', 'os_settings', 'os_saved_filters',
  'os_integration_connections', 'os_integration_jobs',
  'os_idempotency_keys', 'os_attachments',
]) {
  assert(coreMigration.includes(`create table if not exists public.${table}`), `core migration is missing ${table}`);
  assert(coreMigration.includes(`'${table}'`), `${table} must be included in the RLS/grant loop`);
}
assert(coreMigration.includes('create or replace function app_private.os_same_tenant'), 'OS tables need a strict tenant predicate without platform-admin bypass');
assert(coreMigration.includes("app_private.os_same_tenant(((storage.foldername(name))[1])::uuid)"), 'attachment storage must enforce tenant-scoped paths');
assert(coreMigration.includes("values ('avalon-os-beta', 'avalon-os-beta', false"), 'OS attachment bucket must stay private');

for (const domain of ['care', 'people', 'events', 'inventory', 'finance', 'reports', 'settings']) {
  const endpoint = `api/os/v1/${domain}.js`;
  assert(fs.existsSync(path.join(repoRoot, endpoint)), `${endpoint} is missing`);
  const source = read(endpoint);
  assert(source.includes('createOsDomainHandler') || source.includes('requireOsBeta'), `${endpoint} must use the protected OS API contract`);
}
for (const table of [
  'os_inventory_folders', 'os_inventory_vendors', 'os_inventory_items',
  'os_inventory_variants', 'os_inventory_lots', 'os_stock_transactions',
  'os_purchase_orders', 'os_purchase_order_lines', 'os_finance_ledger',
  'os_report_snapshots',
]) {
  assert(operationsMigration.includes(`create table if not exists public.${table}`), `operations migration is missing ${table}`);
  assert(operationsMigration.includes(`'${table}'`), `${table} must be included in tenant RLS`);
}
assert(operationsMigration.includes('os_finance_ledger_immutable'), 'finance ledger needs an immutable trigger');
assert(operationsMigration.includes('os_stock_transactions_immutable'), 'stock transactions need an immutable trigger');
assert(operationsMigration.includes('with (security_invoker = true)'), 'reporting views must invoke tenant RLS');
assert(!operationsMigration.includes('app_private.same_tenant(tenant_id)'), 'OS operations must not use the legacy platform-admin tenant bypass');

if (failed) process.exit(1);
console.log(`Avalon OS capability QA passed ${OS_CAPABILITY_COUNT} capabilities and ${new Set(navLabels).size} registered destinations.`);
