import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('../supabase/migrations/042_avalon_os_core.sql', import.meta.url), 'utf8');
const operations = fs.readFileSync(new URL('../supabase/migrations/043_avalon_os_operations.sql', import.meta.url), 'utf8');

const coreTables = [
  'os_capability_records', 'os_settings', 'os_saved_filters',
  'os_integration_connections', 'os_integration_jobs',
  'os_idempotency_keys', 'os_attachments',
];
const operationsTables = [
  'os_inventory_folders', 'os_inventory_vendors', 'os_inventory_items',
  'os_inventory_variants', 'os_inventory_lots', 'os_stock_transactions',
  'os_purchase_orders', 'os_purchase_order_lines', 'os_finance_ledger',
  'os_report_snapshots',
];

for (const table of [...coreTables, ...operationsTables]) {
  const source = coreTables.includes(table) ? core : operations;
  assert.match(source, new RegExp(`alter table public\\.%I enable row level security|alter table public\\.${table} enable row level security`), `${table} must enable RLS`);
  assert.ok(source.includes(`'${table}'`), `${table} must be registered in its RLS loop`);
}

assert.ok(core.includes('row_tenant_id = app_private.profile_tenant_id()'));
assert.ok(!core.includes('row_tenant_id = app_private.profile_tenant_id() or app_private.is_platform_admin()'));
assert.ok(!operations.includes('app_private.same_tenant(tenant_id)'));
assert.ok(operations.includes('app_private.os_same_tenant(tenant_id) and app_private.is_operator()'));

function canUseOperatorTable({ actorRole, actorTenant, rowTenant }) {
  return ['ops_manager', 'staff', 'admin', 'founder'].includes(actorRole) && actorTenant === rowTenant;
}

const matrix = [
  [{ actorRole: 'admin', actorTenant: 'a', rowTenant: 'a' }, true],
  [{ actorRole: 'admin', actorTenant: 'a', rowTenant: 'b' }, false],
  [{ actorRole: 'staff', actorTenant: 'a', rowTenant: 'a' }, true],
  [{ actorRole: 'staff', actorTenant: 'a', rowTenant: 'b' }, false],
  [{ actorRole: 'nurse', actorTenant: 'a', rowTenant: 'a' }, false],
  [{ actorRole: 'promoter', actorTenant: 'a', rowTenant: 'a' }, false],
  [{ actorRole: 'client', actorTenant: 'a', rowTenant: 'a' }, false],
];
for (const [input, expected] of matrix) assert.equal(canUseOperatorTable(input), expected, JSON.stringify(input));

const storagePolicyOccurrences = [...core.matchAll(/app_private\.os_same_tenant\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid\)/g)].length;
assert.equal(storagePolicyOccurrences, 5, 'read, insert, update using/check, and delete storage checks must all scope tenant paths');
assert.ok(core.includes("bucket_id = 'avalon-os-beta'"));
assert.ok(core.includes("values ('avalon-os-beta', 'avalon-os-beta', false"));

console.log(`Avalon OS RLS contract QA passed ${coreTables.length + operationsTables.length} tables, strict cross-tenant isolation, role denial, and private tenant-path storage.`);
