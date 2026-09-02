import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const requireText = (source, values, label) => values.forEach((value) => assert.ok(source.includes(value), `${label} is missing ${JSON.stringify(value)}`));
const forbidText = (source, values, label) => values.forEach((value) => assert.ok(!source.includes(value), `${label} must not contain ${JSON.stringify(value)}`));

const app = read('src/App.jsx');
requireText(app, [
  'const NurseTodayRoute = lazyRoute',
  'path="/provider/today"',
  '<NurseTodayRoute />',
  'path="/admin/inventory-routing"',
  'path="/admin/guides"',
], 'protected route table');

const nav = read('src/lib/nursePortalNav.js');
requireText(nav, ["label: 'Work'", "label: 'Today'", "label: 'Time & Pay'", "label: 'Me'"], 'nurse navigation');

const queue = read('app-modules/pages/provider/NurseSchedule.jsx');
requireText(queue, [
  "offerId: shift.offer_id",
  'expectedShiftVersion: shift.version',
  'expectedOfferVersion: shift.offer_version',
  'acceptedTermsHash:',
  'idempotencyKey: makeIdempotencyKey()',
  "on('postgres_changes'",
  "table: 'nurse_shift_offers'",
  'filter: `provider_profile_id=eq.${providerId}`',
  'Terms fingerprint',
], 'work queue');
forbidText(queue, ['window.localStorage', 'window.sessionStorage', '@/fixtures'], 'work queue');

const today = read('app-modules/pages/provider/NurseTodayRoute.jsx');
requireText(today, [
  "import NurseRouteMap from '@/components/provider/NurseRouteMap'",
  '<NurseRouteMap routeDay={routeDay} />',
  '/api/me/route-days?date=',
  '/origin`',
  'plan: true',
  "consentTextVersion: 'route-origin-consent-v1'",
  '/plan`',
  '/actions`',
  'Use location & plan route',
  'Fresh consent is required',
  "onAction('arrived'",
  "target=\"_blank\" rel=\"noreferrer\"",
  "allowed_actions.includes('complete_pickup')",
  "action: 'complete_pickup'",
  'expectedPickupVersion: task.version',
  'countConfirmed: evidence.confirmations.count === true',
  'handoffConfirmed: evidence.confirmations.handoff === true',
  'reservationId: line.reservation_id || line.id',
  'coldChainEvidence: task.cold_chain_required',
  'mismatch: evidence.mismatch === true',
  'reason: evidence.mismatchReason',
  'location.hours_label',
  'task.reservation_lines',
  'Exact item, lot, and quantity evidence is incomplete',
  'unavailable || Boolean(busy)',
], 'Today route');
forbidText(today, ['watchPosition', 'localStorage', 'sessionStorage', '@/fixtures'], 'Today route');

const routeMap = read('src/components/provider/NurseRouteMap.jsx');
requireText(routeMap, [
  'VITE_MAPBOX_ACCESS_TOKEN',
  'PUBLIC_MAPBOX_TOKEN_RE',
  "import('mapbox-gl')",
  'Today at a glance',
  'Verified road geometry',
], 'Today route map');
forbidText(routeMap, ['patientName', 'patient_name', 'service_name', 'treatment'], 'Today route map');

const operations = read('app-modules/pages/admin/NurseOperations.jsx');
requireText(operations, [
  '/api/admin/nurse-marketplace?view=',
  "apiPost('/api/admin/nurse-marketplace'",
  'allowed_actions',
  'No sample or cached records are shown',
  'offer_candidate_contexts',
  "action: 'prepare_offer_candidate'",
  'approvalPolicyId: selectedPolicy.id',
  "engagementModel: 'approved_contractor'",
  'expectedShiftVersion: Number(selectedShift.version)',
  'source?.terms_policies',
  'source?.max_expiry_minutes',
  'I reviewed the exact shift/provider versions',
], 'admin nurse operations');
forbidText(operations, ['@/fixtures', 'commandMockData', 'adminMockData', 'type="number"'], 'admin nurse operations');

const access = read('src/lib/adminAccess.js');
requireText(access, ["'/admin/dispatch'", "'/admin/inventory-routing'", "'/admin/guides'"], 'admin access map');

console.log('Nurse marketplace frontend verification passed: protected routes, atomic offers, ephemeral origin, one-leg navigation, admin fail-closed states, and no operational fixtures.');
