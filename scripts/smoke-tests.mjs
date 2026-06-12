import { readFileSync } from 'node:fs';
import { allKnownRoutes } from '../src/routes/routeGroups.js';
import {
  IV_ADDONS,
  IV_SESSIONS,
  IM_SHOTS,
  PACKAGES,
  getProduct,
  productsByCategory,
  slugify,
} from '../src/data/catalog.js';
import { ADDON_PRICE_BY_LABEL, ITEM_PRICE_BY_KEY } from '../api/_lib/catalog-pricing.js';
import { buildStripeCheckoutMetadata } from '../api/_checkout-fulfillment.js';
import { createAppointmentSummaryToken, verifyAppointmentSummaryToken } from '../api/_lib/summary-token.js';
import {
  hasValidCheckoutContact,
  isAdultCheckoutDob,
  isValidCheckoutEmail,
  isValidCheckoutPhone,
} from '../src/lib/checkoutValidation.js';
import { sanitizeErrorTelemetryEvent } from '../src/lib/errorTelemetry.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const authStoreSource = readFileSync(new URL('../src/lib/useAuthStore.js', import.meta.url), 'utf8');
const loginQaSource = readFileSync(new URL('./login-qa.mjs', import.meta.url), 'utf8');
const interactionQaSource = readFileSync(new URL('./interaction-qa.mjs', import.meta.url), 'utf8');
const appointmentSummarySource = readFileSync(new URL('../api/appointment-summary.js', import.meta.url), 'utf8');
const checkoutVerifySource = readFileSync(new URL('../api/checkout/verify.js', import.meta.url), 'utf8');
const adminCollectBalanceSource = readFileSync(new URL('../api/admin/collect-balance.js', import.meta.url), 'utf8');
const chargeBalanceSource = readFileSync(new URL('../api/charge-balance.js', import.meta.url), 'utf8');

for (const route of allKnownRoutes) {
  assert(appSource.includes(`path="${route}"`), `Route missing from App.jsx: ${route}`);
}

assert(IV_SESSIONS.length >= 10, 'Expected full IV session catalog');
assert(IV_ADDONS.length >= 10, 'Expected tiered IV add-ons');
assert(IM_SHOTS.length >= 8, 'Expected IM shot catalog');
assert(PACKAGES.length >= 4, 'Expected package catalog');

for (const [category, data] of Object.entries(productsByCategory)) {
  assert(data.treatments.length > 0, `No treatments for category ${category}`);
  for (const treatment of data.treatments) {
    const slug = slugify(treatment.name);
    assert(getProduct(category, slug), `Product lookup failed: ${category}/${slug}`);
  }
}

const nad = IV_SESSIONS.find((item) => item.key === 'nad');
const cbd = IV_SESSIONS.find((item) => item.key === 'cbd');
assert(nad.doses.find((dose) => dose.key === 'nad_1000')?.price === 800, 'NAD 1000mg canonical price drifted');
assert(cbd.doses.find((dose) => dose.key === 'cbd_33')?.price === 250, 'CBD 33mg canonical price drifted');

const expectedNadPrices = {
  nad_250: 350,
  nad_500: 500,
  nad_750: 650,
  nad_1000: 800,
  nad_1250: 1000,
  nad_1500: 1200,
};
for (const [key, price] of Object.entries(expectedNadPrices)) {
  assert(ITEM_PRICE_BY_KEY.get(key) === price, `Server NAD key price drifted: ${key}`);
  const label = `nad ${key.replace('nad_', '')}mg`;
  assert(ADDON_PRICE_BY_LABEL.get(label) === price, `Server NAD label price drifted: ${label}`);
}
for (const addon of IV_ADDONS.filter((item) => item.group === 'nad')) {
  const label = addon.label.toLowerCase().replace(/\+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  assert(ADDON_PRICE_BY_LABEL.get(label) === addon.price, `Client/server add-on price drifted: ${addon.label}`);
}

const metadata = buildStripeCheckoutMetadata({
  appointmentRecordId: 'appt_123',
  contact: {
    name: 'Jane Patient',
    email: 'jane@example.com',
    phone: '5551234567',
    dob: '1980-01-01',
  },
  appointment: {
    address: '123 Health St',
    notes: 'clinical note',
    emergencyContact: 'Emergency Person',
    clinicalReviewOnFile: true,
    gfeRequired: true,
    paymentType: 'one_time_deposit',
  },
  items: [{ key: 'nad_1000', cartKey: 'nad_1000', label: 'NAD+ (1000mg)', type: 'addon', price: 800 }],
  paymentMethod: 'card',
  primaryService: 'NAD+ (1000mg)',
  visitSubtotalCents: 80000,
  depositCents: 5000,
  balanceDueCents: 75000,
});
for (const key of ['customerName', 'customerEmail', 'firstName', 'lastName', 'phone', 'dob', 'emergencyContact', 'address', 'zip', 'notes', 'clientType', 'clinicalReviewOnFile', 'gfeRequired', 'itemPrices']) {
  assert(!(key in metadata), `Stripe metadata contains PHI/high-risk field: ${key}`);
}
assert(metadata.appointmentRecordId === 'appt_123', 'Stripe metadata must retain appointmentRecordId');
assert(metadata.balanceDueCents === '75000', 'Stripe metadata must retain amount fields');

process.env.APPOINTMENT_SUMMARY_TOKEN_SECRET = 'smoke-summary-secret';
const summaryToken = createAppointmentSummaryToken({ sessionId: 'cs_test_123', appointmentRecordId: 'appt_123', appointmentId: 'acuity_123' });
assert(verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_test_123', appointmentRecordId: 'appt_123' }), 'Summary token should verify');
assert(!verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_other' }), 'Summary token should reject wrong session');

assert(appointmentSummarySource.includes('summary_auth_required'), 'appointment-summary must gate identifiable summary access');
assert(appointmentSummarySource.includes('verifyAppointmentSummaryToken'), 'appointment-summary must verify signed summary tokens');
assert(!checkoutVerifySource.includes('customerEmail:'), 'checkout/verify must not return customer email to bearer session-id callers');
assert(isValidCheckoutEmail('a+tag@sub.domain.org'), 'Valid tagged email should pass checkout validation');
assert(!isValidCheckoutEmail('test@'), 'Incomplete email should fail checkout validation');
assert(isValidCheckoutPhone('(415) 555-1212'), 'Valid US phone should pass checkout validation');
assert(!isValidCheckoutPhone('555'), 'Short phone should fail checkout validation');
assert(isAdultCheckoutDob('01/01/1990'), 'Adult DOB should pass checkout validation');
assert(!isAdultCheckoutDob('2999-01-01'), 'Future DOB should fail checkout validation');
assert(!isAdultCheckoutDob(new Date().toISOString().slice(0, 10)), 'Under-18 DOB should fail checkout validation');
assert(hasValidCheckoutContact({ firstName: 'Ava', email: 'ava@example.com', phone: '4155551212' }), 'Complete contact should pass checkout validation');
assert(adminCollectBalanceSource.includes('override_exceeds_balance'), 'Admin balance collection must reject over-balance overrides');
assert(chargeBalanceSource.includes('override_exceeds_balance'), 'Internal balance charge must reject over-balance overrides');
assert(adminCollectBalanceSource.includes('writeAuditEvent'), 'Admin balance collection must write audit events');
assert(chargeBalanceSource.includes('writeAuditEvent'), 'Internal balance charge must write audit events');
for (const code of ['missing_appointment_lookup', 'appointment_not_found', 'already_paid']) {
  assert(adminCollectBalanceSource.includes(code), `Admin balance collection must audit ${code} attempts`);
  assert(chargeBalanceSource.includes(code), `Internal balance charge must audit ${code} attempts`);
}

const telemetryEvent = sanitizeErrorTelemetryEvent({
  message: 'Failed for jane@example.com at 415-555-1212 DOB 1980-01-01',
  user: { id: 'user_123', email: 'jane@example.com' },
  request: {
    url: 'https://avalon.example/booking/confirmation?session_id=cs_test&email=jane@example.com',
    headers: { authorization: 'Bearer secret', cookie: 'av.session=secret' },
    data: { address: '123 Health St', phone: '4155551212' },
  },
  extra: {
    contactEmail: 'jane@example.com',
    notes: 'client prefers back door',
  },
});
const telemetryJson = JSON.stringify(telemetryEvent);
for (const leaked of ['jane@example.com', '415-555-1212', '4155551212', '1980-01-01', '123 Health St', 'client prefers back door', 'session_id=']) {
  assert(!telemetryJson.includes(leaked), `Error telemetry scrubber leaked PHI/query data: ${leaked}`);
}
assert(telemetryJson.includes('[redacted]'), 'Error telemetry scrubber should mark sensitive fields redacted');

const oldDemoPassword = ['Jon', 'Jones', '1986'].join('');
for (const [label, source] of Object.entries({ authStoreSource, loginQaSource, interactionQaSource })) {
  assert(!source.includes(oldDemoPassword), `Hardcoded demo password remains in ${label}`);
}

console.log('Smoke tests passed.');
