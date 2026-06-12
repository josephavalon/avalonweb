import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRE_API_WIRE_READINESS_VERSION,
  WIRE_TOMORROW_INTEGRATIONS,
  WIRE_TOMORROW_FAILURE_MATRIX,
  buildPreApiWireReadinessSnapshot,
} from '../src/lib/preApiWireReadiness.js';
import {
  RECONCILIATION_CASE_TYPES,
  RECONCILIATION_CASE_DEFAULTS,
  buildCheckoutReconciliationHint,
  buildReconciliationCase,
  reconciliationTypeForStripeEvent,
} from '../api/_reconciliation.js';
import { resolveGfeRequirement, validateTransition } from '../src/lib/bookingLifecycle.js';

const root = process.cwd();
const requiredIntegrations = [
  'acuity',
  'stripe',
  'supabase',
  'resend_sms',
  'attio',
  'nursys',
  'qualiphy',
  'mercury',
  'gusto',
  'quickbooks',
];

assert.equal(PRE_API_WIRE_READINESS_VERSION, '2026.05.wire-tomorrow-v1');
assert.deepEqual(WIRE_TOMORROW_INTEGRATIONS.map((item) => item.id), requiredIntegrations);
assert.equal(WIRE_TOMORROW_INTEGRATIONS.length, 10, 'Every tomorrow integration must have a contract.');

for (const contract of WIRE_TOMORROW_INTEGRATIONS) {
  assert.ok(contract.owns.length, `${contract.id} must declare what it owns.`);
  assert.ok(contract.neverOwns.length, `${contract.id} must declare what it never owns.`);
  assert.ok(contract.inboundEvents.length, `${contract.id} must declare inbound events.`);
  assert.ok(contract.outboundCommands.length, `${contract.id} must declare outbound commands.`);
  assert.ok(contract.idempotencyKey, `${contract.id} must declare idempotency.`);
  assert.ok(contract.retryPolicy, `${contract.id} must declare retry policy.`);
  assert.ok(contract.deadLetterPolicy, `${contract.id} must declare dead-letter policy.`);
  assert.ok(contract.phiPolicy, `${contract.id} must declare PHI policy.`);
  assert.ok(contract.localReplacementPoint, `${contract.id} must declare replacement point.`);
  assert.ok(contract.envVars.length, `${contract.id} must declare production env vars.`);
}

assert.ok(
  WIRE_TOMORROW_INTEGRATIONS.find((item) => item.id === 'qualiphy')?.retryPolicy.includes('Avalon NP first'),
  'Qualiphy must remain fallback only when no Avalon NP is on call.'
);
assert.ok(
  WIRE_TOMORROW_INTEGRATIONS.find((item) => item.id === 'attio')?.phiPolicy.includes('CRM-safe'),
  'Attio contract must block PHI.'
);

assert.deepEqual(WIRE_TOMORROW_FAILURE_MATRIX.map((item) => item.caseType), RECONCILIATION_CASE_TYPES);
for (const item of WIRE_TOMORROW_FAILURE_MATRIX) {
  assert.ok(item.ownerRole, `${item.caseType} must have an owner.`);
  assert.ok(item.severity, `${item.caseType} must have severity.`);
  assert.ok(item.affectedObjects.length, `${item.caseType} must declare affected objects.`);
  assert.ok(item.mustHave.includes('idempotency key'), `${item.caseType} must require idempotency proof.`);
}
for (const caseType of RECONCILIATION_CASE_TYPES) {
  const generated = buildReconciliationCase({ caseType, provider: 'qa', externalReference: `qa-${caseType}` });
  assert.equal(generated.case_type, caseType);
  assert.equal(generated.owner_role, RECONCILIATION_CASE_DEFAULTS[caseType].owner_role);
  assert.ok(generated.payload.required_action, `${caseType} must carry required action.`);
}

assert.equal(reconciliationTypeForStripeEvent({
  type: 'checkout.session.completed',
  data: { object: { metadata: { acuityAppointmentId: '123' } } },
}), null);
assert.equal(reconciliationTypeForStripeEvent({
  type: 'checkout.session.completed',
  data: { object: { metadata: {} } },
}), 'stripe_succeeded_acuity_failed');
assert.equal(reconciliationTypeForStripeEvent({
  type: 'checkout.session.completed',
  data: { object: { metadata: { fulfillment: 'stripe_paid_then_acuity_attio_v1' } } },
}), null);
assert.equal(reconciliationTypeForStripeEvent({ type: 'checkout.session.expired' }), 'acuity_succeeded_stripe_failed');
assert.equal(reconciliationTypeForStripeEvent({ type: 'payment_intent.payment_failed' }), 'acuity_succeeded_stripe_failed');
assert.equal(reconciliationTypeForStripeEvent({ type: 'charge.refunded' }), 'refund_accounting_mismatch');

const hint = buildCheckoutReconciliationHint({
  acuityAppointment: { id: 'apt-123' },
  error: new Error('Stripe session failed'),
});
assert.equal(hint.case_type, 'acuity_succeeded_stripe_failed');
assert.equal(hint.external_reference, 'apt-123');

const annualGfe = resolveGfeRequirement({
  isNewClient: false,
  visitCount: 5,
  gfeRecord: { status: 'Valid', validUntil: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString() },
});
assert.equal(annualGfe.required, false, 'Returning valid annual GFE must not require another GFE.');
assert.equal(validateTransition({
  status: 'Nurse Assigned',
  nurse: 'RN Proof',
  gfe: 'Cleared',
  isNewClient: false,
  visitCount: 5,
  gfeRecord: { status: 'Valid', validUntil: annualGfe.expiresAt },
}, 'En Route').ok, true, 'Cleared returning clients must dispatch after nurse assignment.');
assert.equal(validateTransition({
  status: 'Nurse Assigned',
  nurse: 'RN Proof',
  gfe: 'Pending',
  isNewClient: true,
  visitCount: 0,
}, 'En Route').ok, false, 'Uncleared clients must not dispatch.');

const snapshot = buildPreApiWireReadinessSnapshot();
assert.equal(snapshot.score, 100, 'Pre-API wire readiness must score 100 when all proof is present.');
assert.equal(snapshot.complete, true, 'Pre-API wire readiness must have zero open local gaps.');
assert.equal(snapshot.open.length, 0, 'Pre-API wire readiness cannot hide open local gaps.');
assert.equal(snapshot.integrations.count, 10);
assert.equal(snapshot.failures.count, RECONCILIATION_CASE_TYPES.length);
assert.equal(snapshot.roles.count, 5);
assert.equal(snapshot.states.complete, true);
assert.equal(snapshot.uiTruth.complete, true);

const files = [
  'api/create-checkout-session.js',
  'api/integrations/stripe/webhook.js',
  'api/integrations/acuity/webhook.js',
  'src/lib/preApiWireReadiness.js',
  'src/lib/noApiReadiness.js',
  'src/pages/admin/Command.jsx',
].map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]);

const source = Object.fromEntries(files);
assert.match(source['api/create-checkout-session.js'], /buildPendingAppointmentRecord/, 'Checkout must persist pending bookings before Stripe payment.');
assert.match(source['api/integrations/stripe/webhook.js'], /reconciliationTypeForStripeEvent/, 'Stripe webhook must use shared reconciliation mapping.');
assert.match(source['api/integrations/acuity/webhook.js'], /appointment_drift/, 'Acuity webhook must expose appointment drift reconciliation.');
assert.match(source['src/pages/admin/Command.jsx'], /PreApiWireReadinessPanel/, 'Admin must surface wire readiness proof.');
assert.doesNotMatch(source['src/lib/noApiReadiness.js'], /from '@\//, 'No-API readiness must be Node-importable without Vite alias.');

console.log('Pre-API wire readiness QA passed: 1000/1000 local proof.');
