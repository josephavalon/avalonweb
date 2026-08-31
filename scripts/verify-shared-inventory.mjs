import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('supabase/migrations/072_shared_inventory_and_nurse_kits.sql');
const costMigration = read('supabase/migrations/071_inventory_cost_ledger_bridge.sql');
const adminApi = read('api/admin/inventory.js');
const nurseApi = read('api/me/kit.js');
const loader = read('api/_lib/shared-inventory.js');
const adminPage = read('app-modules/pages/admin/SharedInventory.jsx');
const nursePage = read('app-modules/pages/provider/NurseKit.jsx');
const sharedPage = read('src/components/inventory/SharedInventoryWorkspace.jsx');
const routes = read('src/App.jsx');
const access = read('src/lib/adminAccess.js');
const nav = read('src/lib/nursePortalNav.js');
const finance = read('app-modules/pages/admin/FinanceControl.jsx');
const env = read('.env.example');
const legacyApi = read('api/os/v1/inventory.js');
const adapters = read('api/_lib/os-adapters.js');

for (const table of [
  'os_inventory_locations',
  'os_inventory_location_assignments',
  'os_inventory_location_par_levels',
  'os_inventory_restock_requests',
  'os_inventory_restock_request_lines',
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} must be created forward-only`);
  assert.ok(migration.includes(`'${table}'`), `${table} must be included in the protected table list`);
}
assert.match(migration, /revoke all on public\.%I from anon, authenticated, service_role/, 'protected tables must fail closed to browser roles');

for (const fn of [
  'create_inventory_location',
  'record_admin_inventory_movement',
  'transfer_inventory_to_location',
  'set_inventory_par_level',
  'transition_inventory_restock_request',
  'fulfill_inventory_restock_request',
  'create_inventory_item',
  'create_inventory_variant',
  'create_inventory_lot',
  'create_inventory_vendor',
  'create_draft_purchase_order',
  'create_purchase_order_line',
  'receive_purchase_order_line',
  'accept_nurse_kit_assignment',
  'record_nurse_kit_movement',
  'create_nurse_kit_restock_request',
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${fn}\\(`), `${fn} RPC is required`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`), `${fn} must be service-role-only`);
}

assert.match(migration, /create or replace view public\.os_inventory_location_balances/, 'location balances must derive from append-only movements');
assert.match(migration, /transfer_out[\s\S]*transfer_in/, 'transfers must write both sides');
assert.match(migration, /inventory_transfer_insufficient_stock/, 'transfers must reject insufficient stock');
assert.match(migration, /inventory_expired_lot_consumption_prohibited/, 'expired lots must not be consumed');
assert.match(migration, /inventory_expired_lot_care_transfer_prohibited/, 'expired lots must not move into care locations');
assert.match(migration, /inventory_costed_stock_lot_required/, 'costed stock must remain lot-backed');
assert.match(migration, /from_location_id/, 'stock transactions must retain source location');
assert.match(migration, /to_location_id/, 'stock transactions must retain destination location');
assert.match(costMigration, /create table if not exists public\.inventory_cost_events/, 'inventory costs need a controlled bridge');
assert.match(costMigration, /prepare_inventory_cost_event/, 'cost events must be prepared through a controlled RPC');
assert.match(costMigration, /prepare_ledger_journal/, 'cost preparation must use the controlled ledger');

assert.match(adminApi, /requireAdmin\(req, res\)/, 'full inventory must remain admin-only');
assert.match(adminApi, /cleanIdempotencyKey/, 'admin mutations require idempotency');
assert.match(adminApi, /action === 'transfer'/, 'admin API must expose atomic transfers');
assert.match(adminApi, /record_admin_inventory_movement/, 'admin movements must use the serialized database RPC');
assert.doesNotMatch(adminApi, /from\('os_stock_transactions'\)\.insert/, 'admin API must not write stock rows directly');
assert.match(adminApi, /set_inventory_par_level/, 'admin API must expose versioned par controls');
assert.match(adminApi, /transition_inventory_restock_request/, 'admin API must expose controlled restock transitions');
assert.match(adminApi, /action === 'fulfill_restock'[\s\S]*fulfill_inventory_restock_request/, 'admin fulfillment must use one atomic database RPC');
assert.match(adminApi, /create_purchase_order_line/, 'admin API must expose controlled PO lines');
assert.match(adminApi, /receive_purchase_order_line/, 'admin API must expose PO-linked receipts');
assert.doesNotMatch(adminApi, /from\('os_inventory_(?:items|variants|lots|vendors)'\)\.insert|from\('os_purchase_orders'\)\.insert/, 'admin creates must use transactional idempotent RPCs');
assert.match(adminApi, /writeAuditEvent/, 'admin inventory access must be audited');
assert.match(nurseApi, /requireRole\(req, res, NURSE_ROLES\)/, 'My Kit must require nurse authentication');
assert.match(nurseApi, /resolveNurseProvider/, 'kit ownership must be server-derived');
assert.match(nurseApi, /record_nurse_kit_movement/, 'nurse use must pass through the controlled RPC');
assert.match(nurseApi, /create_nurse_kit_restock_request/, 'nurse restock must pass through the controlled RPC');
assert.match(nurseApi, /accept_nurse_kit_assignment/, 'nurses must explicitly accept kit custody');
assert.match(nurseApi, /assignmentStatus !== 'accepted'/, 'kit mutations must remain disabled before custody acceptance');
assert.match(nurseApi, /lines\.length !== 1/, 'nurse restock requests must stay tied to one exact transfer line');
assert.match(loader, /includeCost: false/, 'nurse kit loader must omit valuation');
assert.doesNotMatch(nurseApi, /os_purchase_orders|os_inventory_vendors|unit_cost_cents/, 'nurse endpoint must not query finance or vendor data');

assert.match(adminPage, /Sortly-style stock control/, 'admin must receive the full shared workspace');
assert.match(adminPage, /Transfer stock/, 'admin must be able to transfer stock to kits and locations');
assert.match(adminPage, /Nurse kit restock queue/, 'admin must see structured nurse restock requests');
assert.match(adminPage, /Transfer and fulfill restock/, 'admin fulfillment must transfer stock before closing the request');
assert.match(adminPage, /fulfillmentReference/, 'admin fulfillment must retain a structured reference');
assert.match(adminPage, /action: 'fulfill_restock'/, 'admin UI must submit one atomic restock action');
assert.doesNotMatch(adminPage, /transferIdempotencyKey|transitionIdempotencyKey/, 'admin UI must not chain two client-side fulfillment writes');
assert.match(adminPage, /Add purchase order line/, 'admin procurement must capture controlled PO lines');
assert.match(adminPage, /Receive purchase order stock/, 'admin procurement must receive stock against the PO and lot');
assert.match(sharedPage, /Search item, SKU, or lot/, 'shared workspace needs Sortly-like search');
assert.match(sharedPage, /Grid view/, 'shared workspace needs a grid view');
assert.match(sharedPage, /List view/, 'shared workspace needs a list view');
assert.match(nursePage, /This nurse view intentionally excludes prices, vendors, purchase orders, central inventory, and every other nurse kit/, 'nurse UI must state and enforce its reduced scope');
assert.match(nursePage, /Confirm item used/, 'destructive nurse count changes need confirmation');
assert.match(nursePage, /structured restock request/i, 'nurse restock must be structured');
assert.doesNotMatch(nursePage, /unitCostCents|purchaseOrders|vendorId|inventoryValueCents/, 'nurse UI must not retain cost or global procurement fields');

assert.match(routes, /path="\/provider\/kit"/, 'My Kit route must be live');
assert.match(routes, /path="\/provider\/kits"[\s\S]*Navigate to="\/provider\/kit"/, 'legacy provider kit links must reconcile');
assert.match(routes, /path="\/admin\/inventory"[\s\S]*AdminSharedInventory/, 'admin inventory route must be live');
assert.match(routes, /path="\/admin\/kits"[\s\S]*Navigate to="\/admin\/inventory\?view=kits"/, 'legacy admin kit links must reconcile');
assert.match(access, /'\/admin\/inventory'/, 'admin route gate must know inventory');
assert.match(nav, /label: 'Kit'[\s\S]*to: '\/provider\/kit'/, 'nurse navigation must include My Kit');
assert.match(finance, /Supplies &amp; inventory/, 'Finance must surface supply and inventory cost');
assert.match(env, /AVALON_INVENTORY_COSTS_ENABLED=false/, 'inventory cost preparation must default off');
assert.match(legacyApi, /requireAdmin\(req, res\)/, 'legacy inventory reads must no longer be staff-wide');
assert.match(legacyApi, /inventory_write_route_retired/, 'legacy inventory writes must be retired');
assert.doesNotMatch(legacyApi, /os_stock_transactions'\)\.insert|from\(table\)\.insert/, 'legacy inventory must not bypass controlled mutation RPCs');
assert.doesNotMatch(adapters, /quickbooks:\s*\{/, 'QuickBooks must not remain an active adapter');

console.log('Shared inventory QA passed: one typed source, full Admin controls, reduced My Kit, atomic transfers, restock workflow, and controlled cost bridge.');
