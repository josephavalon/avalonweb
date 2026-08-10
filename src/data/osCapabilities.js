const GROUPS = Object.freeze({
  communications: [
    'Broadcasts', 'SMS Templates',
  ],
  finance: [
    'KPI Scorecard', 'Cash Position', 'Runway', 'Financial Calendar',
    'Revenue Dashboard', 'Sales', 'Memberships', 'Packages', 'Gift Cards',
    'Transactions', 'Deposits', 'Outstanding Balances', 'Invoices', 'Chargebacks',
    'Cash Flow', 'Bank Accounts', 'Transfers', 'Bank Reconciliation',
    'Profit & Loss', 'Balance Sheet', 'Cash Flow Statement', 'General Ledger',
    'Journal Entries', 'Chart of Accounts', 'Closing Periods', 'Mercury', 'QuickBooks',
    'Operating Expenses', 'Vendor Bills', 'Employee Reimbursements', 'Mileage',
    'Corporate Cards', 'Employees', 'Contractors', 'Payroll Runs', 'Benefits',
    'Payroll Taxes', 'Tax Documents', 'Gusto',
    'Inventory Value', 'COGS', 'Purchase Orders', 'Vendor Spend',
    'Inventory Turnover', 'Expired Inventory', 'Shrinkage', 'Cost Analysis',
    'Financial Metrics', 'Growth Metrics', 'Unit Economics', 'Revenue per Nurse',
    'Revenue per Visit', 'Gross Margin by Service', 'Gross Margin by Market',
    'Revenue Forecast', 'Cash Forecast', 'Budget', 'Budget vs Actual',
    'Hiring Forecast', 'Scenario Planning',
    'Executive Reports', 'Financial Statements', 'Revenue Reports', 'Expense Reports',
    'Payroll Reports', 'Inventory Reports', 'Tax Reports', 'Custom Reports',
    'Financial Model', 'Cap Table', 'SAFE Notes', 'Investors', 'Data Room', 'Board Reports',
  ],
  people: [
    'Clinical Staff', 'Nurse Records', 'Credentialing', 'Contracts', 'Insurance',
    'Employees', 'Contractors', 'Benefits', 'Payroll Runs', 'Payroll Taxes',
  ],
  clinical: [
    'Nursing Manual', 'SOPs', 'Standing Orders', 'Policies', 'Forms & Templates',
    'Quality Assurance', 'Incident Reports', 'Audits', 'Training', 'Clinical Inventory',
  ],
  inventory: [
    'Inventory', 'Clinical Inventory', 'Inventory Value', 'COGS', 'Purchase Orders',
    'Vendor Spend', 'Inventory Turnover', 'Expired Inventory', 'Shrinkage', 'Cost Analysis',
    'Inventory Reports',
  ],
  events: [
    'Upcoming Events', 'Event Service', 'Event GFE Queue', 'Event Orders',
    'Event Proposals', 'Past Events',
  ],
  system: ['Settings', 'Tools', 'Profile', 'Activity'],
  integrations: ['Mercury', 'QuickBooks', 'Gusto', 'Nursys', 'Qualiphy'],
});

const REPORT_WORDS = /dashboard|report|statement|scorecard|metrics|position|runway|flow|forecast|margin|economics|turnover|value|analysis|model|actual/i;
const DOCUMENT_WORDS = /manual|sop|order|polic|form|template|contract|insurance|document|safe note|data room/i;
const LEDGER_WORDS = /transaction|deposit|balance|invoice|chargeback|expense|bill|reimbursement|mileage|card|payroll|tax|cogs|journal|ledger|account|transfer|sales/i;

export function capabilitySlug(label = '') {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function primaryDomain(label) {
  if (GROUPS.integrations.includes(label)) return 'integrations';
  if (GROUPS.events.includes(label)) return 'events';
  if (GROUPS.inventory.includes(label)) return 'inventory';
  if (GROUPS.clinical.includes(label)) return 'clinical';
  if (GROUPS.people.includes(label)) return 'people';
  if (GROUPS.communications.includes(label)) return 'communications';
  if (GROUPS.system.includes(label)) return 'system';
  return 'finance';
}

function capabilityKind(label) {
  if (GROUPS.integrations.includes(label)) return 'integration';
  if (REPORT_WORDS.test(label)) return 'report';
  if (DOCUMENT_WORDS.test(label)) return 'document';
  if (LEDGER_WORDS.test(label)) return 'ledger';
  return 'workflow';
}

const labels = [...new Set(Object.values(GROUPS).flat())];

export const OS_CAPABILITIES = Object.freeze(labels.map((label) => Object.freeze({
  slug: capabilitySlug(label),
  label,
  domain: primaryDomain(label),
  kind: capabilityKind(label),
  description: `${label} records, workflow state, assignments, attachments, and audit history.`,
})));

export const OS_CAPABILITY_BY_SLUG = Object.freeze(Object.fromEntries(
  OS_CAPABILITIES.map((capability) => [capability.slug, capability]),
));

export function osCapabilityPath(label) {
  return `/admin/os/${capabilitySlug(label)}`;
}

export function getOsCapability(slug) {
  return OS_CAPABILITY_BY_SLUG[String(slug || '').trim().toLowerCase()] || null;
}

export const OS_CAPABILITY_COUNT = OS_CAPABILITIES.length;
