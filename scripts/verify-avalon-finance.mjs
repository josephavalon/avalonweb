import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

for (const migration of [
  '067_payops_finance_core.sql',
  '068_payops_finance_transitions.sql',
  '069_payops_controls_and_ledger.sql',
  '070_payops_contractor_payout_controls.sql',
  '071_inventory_cost_ledger_bridge.sql',
  '072_shared_inventory_and_nurse_kits.sql',
  '073_vendor_accounts_payable.sql',
  '074_employee_management_payroll_controls.sql',
  '075_contractor_payout_settlement_reconciliation.sql',
]) {
  assert.ok(existsSync(new URL(`supabase/migrations/${migration}`, root)), `${migration} is required`);
}

const routes = read('src/App.jsx');
const access = read('src/lib/adminAccess.js');
const navigation = read('src/components/admin/AdminShell.jsx');
const finance = read('app-modules/pages/admin/FinanceControl.jsx');
const contractor = read('app-modules/pages/admin/Payables.jsx');
const vendor = read('app-modules/pages/admin/VendorPayments.jsx');
const payroll = read('app-modules/pages/admin/Payroll.jsx');
const vendorMigration = read('supabase/migrations/073_vendor_accounts_payable.sql');
const payrollMigration = read('supabase/migrations/074_employee_management_payroll_controls.sql');
const settlementMigration = read('supabase/migrations/075_contractor_payout_settlement_reconciliation.sql');
const settlementApi = read('api/admin/payouts/[id]/settle.js');
const env = read('.env.example');

for (const [path, component] of [
  ['/admin/payables', 'AdminPayables'],
  ['/admin/vendor-payments', 'AdminVendorPayments'],
  ['/admin/payroll', 'AdminPayroll'],
  ['/admin/inventory-costs', 'AdminInventoryCosts'],
]) {
  assert.match(
    routes,
    new RegExp(`path="${path.replaceAll('/', '\\/')}" element=\\{PAYOPS_FINANCE_CORE_ENABLED \\? <RequireAuth allowedRoles=\\{\\['admin'\\]\\}><${component}`),
    `${path} must fail closed behind the shared finance browser gate and remain admin-only`,
  );
  assert.ok(access.includes(`'${path}'`), `${path} must be in the gated Admin allow-list`);
}

assert.match(env, /VITE_PAYOPS_FINANCE_CORE_ENABLED=false/, 'finance UI must default off for code-first deployment');
assert.match(env, /migrations 067-075/, 'activation instructions must name the complete migration range');
assert.match(access, /PAYOPS_FINANCE_CORE_ENABLED \? \[[\s\S]*'\/admin\/payables'[\s\S]*'\/admin\/payroll'[\s\S]*'\/admin\/vendor-payments'[\s\S]*'\/admin\/inventory-costs'/, 'all outgoing payment routes must remain inside the fail-closed allow-list branch');
assert.match(navigation, /W-2 Payroll'[\s\S]*PAYOPS_FINANCE_CORE_ENABLED \? '\/admin\/payroll'/, 'payroll navigation must use the live controlled route only when enabled');
assert.match(navigation, /Vendor Bills'[\s\S]*PAYOPS_FINANCE_CORE_ENABLED \? '\/admin\/vendor-payments'/, 'vendor navigation must use the live controlled route only when enabled');
assert.match(navigation, /Vendor Spend'[\s\S]*PAYOPS_FINANCE_CORE_ENABLED \? '\/admin\/vendor-payments'/, 'supply spend must route to Vendor AP when enabled');

for (const lane of ['Nurses', 'Supplies', 'Vendors', 'Employees & management']) {
  assert.ok(finance.includes(`label: '${lane}'`), `Finance control must expose the ${lane} payment lane`);
}
assert.match(finance, /PAYOPS_FINANCE_CORE_ENABLED && canManageFinance \?/, 'payment operations must be hidden from staff on the shared Finance page');
assert.match(finance, /to="\/admin\/vendor-payments"/, 'Finance control must link supply and vendor payments');
assert.match(finance, /to="\/admin\/payroll"/, 'Finance control must link employee and management payroll');
assert.match(contractor, /Contractor payout|1099/i, 'nurse contractor payment workflow must be visible');
assert.match(contractor, /Reconcile existing settlement evidence/, 'nurse payments must expose evidence-backed reconciliation');
assert.match(vendor, /Vendor Payments/, 'vendor and supply payment workflow must be visible');
assert.match(payroll, /Employee & Management Payroll/, 'employee and management payroll workflow must be visible');
assert.match(settlementMigration, /reconcile_contractor_payout_settlement/, 'nurse payouts need a final settlement RPC');
assert.match(settlementApi, /accountant_controller[\s\S]*requireAal2: true/, 'nurse settlement must require an AAL2 accountant/controller');
assert.doesNotMatch(settlementApi, /status\s*:\s*['"]SETTLED['"]|fetch\(|axios|mercury\.com/i, 'nurse settlement API must not write paid or call Mercury');
for (const [name, migration] of [['vendor', vendorMigration], ['payroll', payrollMigration], ['nurse', settlementMigration]]) {
  assert.match(migration, /normalized_direction\s*=\s*'DEBIT'/, `${name} settlement must require an outbound bank debit`);
  assert.match(migration, /provider_account_id/, `${name} settlement must bind a provider funding account`);
}

console.log('Avalon Finance QA passed: nurse, supply, vendor, employee, and management payment controls are routed behind one fail-closed activation gate.');
