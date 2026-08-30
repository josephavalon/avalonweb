import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { assertApiResponse } from '../src/lib/apiResponse.js';

const root = process.cwd();
const failures = [];

assert.doesNotThrow(() => assertApiResponse({ rows: [], meta: { ready: true, total: 0 } }, {
  arrays: ['rows'], objects: ['meta'], booleans: ['meta.ready'], numbers: ['meta.total'],
}));
for (const malformed of [null, [], {}, { rows: null }, { rows: [], meta: { ready: 'yes', total: 0 } }]) {
  assert.throws(
    () => assertApiResponse(malformed, { arrays: ['rows'], objects: ['meta'], booleans: ['meta.ready'], numbers: ['meta.total'] }),
    (error) => error?.body?.code === 'invalid_api_response',
    'malformed 2xx payloads must fail the operational response contract',
  );
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function forbid(relativePath, patterns) {
  const source = read(relativePath);
  for (const pattern of patterns) {
    if (source.includes(pattern)) failures.push(`${relativePath} still contains ${JSON.stringify(pattern)}`);
  }
}

function requireText(relativePath, patterns) {
  const source = read(relativePath);
  for (const pattern of patterns) {
    if (!source.includes(pattern)) failures.push(`${relativePath} is missing ${JSON.stringify(pattern)}`);
  }
}

function requireProductionGate(relativePath) {
  requireText(relativePath, [
    'if (import.meta.env.PROD)',
    'OperationalSourceUnavailable',
  ]);
}

requireText('src/lib/adminAccess.js', [
  'if (import.meta.env?.PROD) return false;',
]);
requireText('src/components/admin/AdminShell.jsx', [
  "!import.meta.env.PROD && import.meta.env.VITE_ADMIN_PREVIEW === '1'",
]);
requireText('src/lib/apiResponse.js', [
  'export function assertApiResponse',
  "error.body = { code: 'invalid_api_response' };",
  'export function hasObjectRows',
]);
requireText('src/lib/apiClient.js', [
  'if (res.ok && invalidJson)',
  "code: 'invalid_api_response'",
]);

forbid('app-modules/pages/admin/EventsBackend.jsx', [
  'DEMO_EVENT',
  'demo-event-',
  'updateDemo',
  'After Hours Recovery Club',
]);
requireText('app-modules/pages/admin/EventsBackend.jsx', [
  "useState([])",
  "sourceStatus !== 'ready'",
  'No sample or locally invented events are shown.',
]);

forbid('app-modules/source/hooks/useInventoryData.js', [
  'inventorySeed',
  'SEED_ITEMS',
  'SEED_FOLDERS',
  'SEED_TAGS',
]);
requireText('app-modules/source/hooks/useInventoryData.js', [
  "backendStatus === 'ready'",
  'Inventory changes are disabled until the live source is connected.',
]);

forbid('app-modules/pages/admin/Inventory.jsx', [
  "item:'NAD+ 250mg vial'",
  "name:'Joseph L.'",
  "name:'Stephanie W.'",
]);
requireText('app-modules/pages/admin/Inventory.jsx', [
  'No sample stock, transactions, alerts, or activity are shown.',
  'No live transaction ledger is connected for this report.',
  'No live user-activity summary is connected for this report.',
]);

forbid('app-modules/pages/provider/Clients.jsx', [
  'PREVIEW_CLIENTS',
  '@avalon.local',
  'readQuickPatients',
  'QuickPatientAdd',
  'CLIENTS.length',
]);
requireText('app-modules/pages/provider/Clients.jsx', [
  'export function ClientsPreview()',
  'export default function Clients()',
  'OperationalSourceUnavailable',
  'No patient count, sample records, loading simulation, or local patient mutations are shown.',
]);

for (const relativePath of [
  'app-modules/pages/admin/AcuityControl.jsx',
  'app-modules/pages/admin/KitControl.jsx',
]) {
  forbid(relativePath, ['SEED_ITEMS']);
  requireProductionGate(relativePath);
}

forbid('app-modules/pages/admin/Command.jsx', ['SEED_ITEMS']);

forbid('app-modules/pages/admin/Bookings.jsx', [
  'LOCAL_PREVIEW_APPOINTMENTS',
  'QuickPatientAdd',
  'patientToAppointmentPreview',
  '@avalon.local',
]);
requireText('app-modules/pages/admin/Bookings.jsx', [
  "authBackend === 'supabase' ? <LiveAdminBookings /> : <BookingsUnavailable />",
  'No sample appointments or locally entered patient previews are shown.',
]);

forbid('app-modules/pages/admin/NurseInvoices.jsx', [
  'PREVIEW_INVOICES',
  'PREVIEW_METRICS',
  'state.preview',
  'preview-invoice',
]);
requireText('app-modules/pages/admin/NurseInvoices.jsx', [
  'Nurse invoice source unavailable',
  'No zeroed or sample finance metrics are shown',
]);

forbid('src/pages/admin/TeamSettings.jsx', [
  'sample-roster',
  'teamClient.list(true)',
  'isDemo =',
]);
requireText('src/pages/admin/TeamSettings.jsx', [
  "const sourceUnavailable = authBackend !== 'supabase';",
  'const [sourceReady, setSourceReady] = useState(false);',
  'const verifiedUnavailable = sourceUnavailable || (!loading && !sourceReady);',
  'No sample staff, pending invitations, local account changes, or false empty roster are shown.',
]);
forbid('src/lib/teamClient.js', [
  'teamMockData',
  'TEAM_MEMBERS',
  'PENDING_INVITES',
]);
requireText('src/lib/teamClient.js', [
  'members: [],',
  'invites: [],',
]);

forbid('src/pages/admin/AdminEssentials.jsx', [
  'QuickPatientAdd',
  'clientIntakeStore',
]);

// Production admin templates must not expose preview/test records or sends.
forbid('app-modules/pages/admin/EmailTemplates.jsx', [
  'PreviewModal',
  'openPreview',
  'sendTest',
  'testTo',
  'send-test',
]);
forbid('api/admin/email-templates.js', [
  'SAMPLE_VARS',
  "action === 'preview'",
  "action === 'send-test'",
  'email_template_test_sent',
]);

for (const relativePath of [
  'app-modules/pages/admin/CredentialControl.jsx',
  'app-modules/pages/admin/DispatchControl.jsx',
  'app-modules/pages/admin/FieldControl.jsx',
  'app-modules/pages/admin/TrainingControl.jsx',
  'app-modules/pages/admin/ShiftMarketplace.jsx',
  'app-modules/pages/provider/Accounting.jsx',
  'app-modules/pages/provider/Appointments.jsx',
  'app-modules/pages/provider/Communications.jsx',
  'app-modules/pages/provider/Staff.jsx',
  'app-modules/pages/provider/Invoicing.jsx',
  'app-modules/pages/provider/Settings.jsx',
]) {
  requireProductionGate(relativePath);
}

for (const [relativePath, unavailableCopy] of [
  ['app-modules/pages/admin/FinanceControl.jsx', 'No zeroed or sample finance metrics are shown'],
  ['app-modules/pages/admin/Memberships.jsx', 'No zeroed or sample membership totals are shown'],
  ['app-modules/pages/admin/PatientRecords.jsx', 'No zeroed or sample clinical totals are shown'],
  ['app-modules/pages/admin/LiveBookings.jsx', 'No zeroed or sample booking totals are shown'],
  ['app-modules/pages/admin/SchedulingControl.jsx', 'No queue counts or records are shown'],
  ['app-modules/pages/provider/NurseInvoices.jsx', 'No invoice records are shown'],
  ['app-modules/pages/provider/NurseSchedule.jsx', 'No queue records are shown'],
  ['app-modules/pages/admin/PromoCodes.jsx', 'No empty or sample code list is shown'],
  ['app-modules/pages/admin/Refunds.jsx', 'No clear queue or sample requests are shown'],
  ['app-modules/pages/admin/DeletionRequests.jsx', 'No clear queue or sample requests are shown'],
  ['app-modules/pages/admin/SupportTickets.jsx', 'No clear queue or sample tickets are shown'],
  ['app-modules/pages/admin/Reviews.jsx', 'No zeroed metrics, clear queue, or sample reviews are shown'],
  ['app-modules/pages/admin/Reconciliation.jsx', 'No zeroed issue count, clear queue, or sample failures are shown'],
  ['app-modules/pages/admin/Inbox.jsx', 'No empty or sample inbox is shown'],
  ['app-modules/pages/admin/ExpiringCredits.jsx', 'No zeroed or sample credit count is shown'],
  ['app-modules/pages/admin/RobBot3K.jsx', 'No zeroed engine state or default controls are shown'],
]) {
  requireText(relativePath, ['OperationalSourceUnavailable', unavailableCopy]);
}

requireText('app-modules/pages/admin/RobBot3K.jsx', [
  'const [sourceReady, setSourceReady] = useState(false);',
  'if (!sourceReady)',
]);
requireText('app-modules/pages/admin/AvalonBD.jsx', [
  "if (sourceStatus !== 'live')",
  'OperationalSourceUnavailable',
  'No empty or sample CRM views are shown',
]);
requireText('app-modules/pages/admin/Reconciliation.jsx', [
  'byKind.renewals.sourceReady ?',
  'byKind.acuity_sync.sourceReady ?',
  'byKind.payment_failures.sourceReady ?',
]);

// A malformed-but-2xx response must never be normalized into a verified empty
// operational queue or a source-ready state with actions enabled.
for (const relativePath of [
  'src/pages/admin/AdminEssentials.jsx',
  'src/pages/admin/TeamSettings.jsx',
  'src/pages/admin/OsCapability.jsx',
  'app-modules/pages/admin/PatientRecords.jsx',
  'app-modules/pages/admin/ClientDetail.jsx',
  'app-modules/pages/admin/Memberships.jsx',
  'app-modules/pages/admin/Messages.jsx',
  'app-modules/pages/admin/LiveBookings.jsx',
  'app-modules/pages/admin/Inbox.jsx',
  'app-modules/pages/admin/GfeSettings.jsx',
  'app-modules/pages/admin/FinanceControl.jsx',
  'app-modules/pages/admin/NurseInvoices.jsx',
  'app-modules/pages/admin/SchedulingControl.jsx',
  'app-modules/pages/admin/EmailTemplates.jsx',
  'app-modules/pages/admin/PromoCodes.jsx',
  'app-modules/pages/admin/Refunds.jsx',
  'app-modules/pages/admin/DeletionRequests.jsx',
  'app-modules/pages/admin/ExpiringCredits.jsx',
  'app-modules/pages/admin/Reviews.jsx',
  'app-modules/pages/admin/AvalonBD.jsx',
  'app-modules/pages/admin/RobBot3K.jsx',
  'app-modules/pages/admin/SupportTickets.jsx',
  'app-modules/pages/admin/Reconciliation.jsx',
  'app-modules/pages/provider/NurseSchedule.jsx',
  'app-modules/pages/provider/NurseInvoices.jsx',
]) {
  requireText(relativePath, ['assertApiResponse']);
}
requireText('app-modules/pages/admin/SchedulingControl.jsx', [
  "arrays: ['shifts', 'nurses', 'events', 'appointments']",
  'available: true',
]);
requireText('app-modules/pages/admin/Reviews.jsx', [
  "{ arrays: ['reviews'] }",
  'setSourceReady(true)',
]);
requireText('app-modules/pages/provider/NurseSchedule.jsx', [
  "{ arrays: ['shifts'] }",
]);
requireText('app-modules/pages/provider/NurseInvoices.jsx', [
  "{ arrays: ['invoices'] }",
]);

forbid('app-modules/pages/provider/Services.jsx', [
  "@/fixtures/commandMockData",
  'MEMBERSHIPS',
  'LEADS',
  'internal_cost',
  'margin',
  'base_price',
  'Follow the current clinician-authorized protocol',
]);
requireText('app-modules/pages/provider/Services.jsx', [
  "apiGet('/api/me/catalog?audience=nurse')",
  "payload.source !== 'live'",
  'SAFE_NURSE_KEYS',
  'normalizeNurseCatalog',
  '!instructions',
  'No cached menu, pricing, costs, or sample protocols are shown.',
  "{ label: 'Services', to: '/provider/services'",
]);
requireText('src/pages/ConsumerMenu.jsx', [
  "fetch('/api/catalog?audience=client'",
  "payload.source !== 'live'",
  'VITE_CATALOG_PUBLIC_CUTOVER',
  'if (!PUBLIC_CATALOG_CUTOVER) return undefined;',
  'SAFE_CLIENT_KEYS',
  'priceCents <= 0',
  'no stale menu is being shown',
]);
requireText('.env.example', [
  'VITE_CATALOG_PUBLIC_CUTOVER=false',
]);
forbid('src/lib/eventsApi.js', [
  "import { fallbackList, fallbackEvent } from './eventsFallback'",
]);
requireText('src/lib/eventsApi.js', [
  'if (!import.meta.env.DEV) return null;',
  "await import('./eventsFallback')",
  'export function fetchEventSync()',
  'return null;',
]);

if (failures.length) {
  console.error('Live operational fixture verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Live Admin/Nurse operational fixture verification passed.');
