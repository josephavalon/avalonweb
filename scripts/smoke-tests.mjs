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
import { buildPersonValues } from '../api/_attio.js';
import { RECONCILIATION_CASE_DEFAULTS, RECONCILIATION_CASE_TYPES } from '../api/_reconciliation.js';
import { validateBalanceReturnBaseUrl } from '../api/_lib/balance-core.js';
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
const createCheckoutSource = readFileSync(new URL('../api/create-checkout-session.js', import.meta.url), 'utf8');
const checkoutVerifySource = readFileSync(new URL('../api/checkout/verify.js', import.meta.url), 'utf8');
const adminCollectBalanceSource = readFileSync(new URL('../api/admin/collect-balance.js', import.meta.url), 'utf8');
const chargeBalanceSource = readFileSync(new URL('../api/charge-balance.js', import.meta.url), 'utf8');
const orderLookupSource = readFileSync(new URL('../api/order-lookup.js', import.meta.url), 'utf8');
const manageOrderSource = readFileSync(new URL('../app-modules/pages/ManageOrder.jsx', import.meta.url), 'utf8');
const loginPageSource = readFileSync(new URL('../app-modules/pages/Login.jsx', import.meta.url), 'utf8');
const sendSmsSource = readFileSync(new URL('../api/auth/send-sms.js', import.meta.url), 'utf8');
const acuityWebhookSource = readFileSync(new URL('../api/integrations/acuity/webhook.js', import.meta.url), 'utf8');
const stripeWebhookSource = readFileSync(new URL('../api/integrations/stripe/webhook.js', import.meta.url), 'utf8');
const acuityBookSource = readFileSync(new URL('../api/acuity-book.js', import.meta.url), 'utf8');
const acuitySource = readFileSync(new URL('../api/_acuity.js', import.meta.url), 'utf8');
const attioSource = readFileSync(new URL('../api/_attio.js', import.meta.url), 'utf8');
const eventPresaleSource = readFileSync(new URL('../api/integrations/events/presale.js', import.meta.url), 'utf8');
const viteConfigSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const privateAuthTriggerMigrationSource = readFileSync(new URL('../supabase/migrations/009_private_auth_profile_trigger.sql', import.meta.url), 'utf8');
const clinicalRlsMigrationSource = readFileSync(new URL('../supabase/migrations/010_tighten_clinical_rls_and_reconciliation_cases.sql', import.meta.url), 'utf8');

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

const attioValues = buildPersonValues({
  firstName: 'Jane',
  lastName: 'Patient',
  email: 'jane@example.com',
  phone: '4155551212',
  source: 'Avalon Booking',
  lifecycleStage: 'Booked',
  city: 'San Francisco',
  planInterest: 'Membership',
  visitCount: 2,
  service: 'NAD+',
  bookingId: 'apt_123',
  bookingReference: 'AV-123',
  dob: '1980-01-01',
  emergencyContact: 'Emergency Person',
  address: '123 Health St',
  zip: '94107',
  appointmentTime: 'June 12 at 2pm',
  itemLabels: 'NAD+ (1000mg)',
  clinicalReviewOnFile: true,
  gfeRequired: true,
  membership: 'Recovery',
  depositPaid: '$50.00',
  balanceDue: '$750.00',
  paymentStatus: 'Partial payment; balance due at visit',
});
const attioDescription = attioValues.description || '';
for (const leaked of ['DOB:', 'Emergency contact:', 'Address:', 'ZIP:', 'Requested time:', 'Items:', 'Clinical review', 'GFE required', 'Requested:', 'Booking ID:', 'Payment status:', '1980-01-01', '123 Health St', 'NAD+']) {
  assert(!attioDescription.includes(leaked), `Attio CRM payload leaked PHI/intake detail: ${leaked}`);
}
for (const expected of ['Source: Avalon Booking', 'Lifecycle: Booked', 'City: San Francisco', 'Plan interest: Membership', 'Visit count: 2']) {
  assert(attioDescription.includes(expected), `Attio CRM payload dropped safe operational field: ${expected}`);
}

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
assert(createCheckoutSource.includes('CHECKOUT_INPUT_LIMITS'), 'Checkout route must declare server-side input length caps');
assert(createCheckoutSource.includes('sanitizeCheckoutInputFields'), 'Checkout route must sanitize contact and appointment fields before fulfillment');
assert(createCheckoutSource.includes('checkout_input_too_long'), 'Checkout route must reject oversized intake fields');
assert(createCheckoutSource.includes('appointment.notes') && createCheckoutSource.includes('CHECKOUT_INPUT_LIMITS.notes'), 'Checkout route must cap appointment notes');
assert(createCheckoutSource.includes('resolveCheckoutSchedulingTypeId'), 'Checkout route must preflight scheduling type before Stripe checkout');
assert(createCheckoutSource.includes('appointment_type_unavailable'), 'Checkout route must reject unmapped scheduling types before payment');
assert(createCheckoutSource.includes('appointment.acuityTypeId = String(appointmentTypeId)'), 'Checkout route must carry the resolved scheduling type into fulfillment');
assert(adminCollectBalanceSource.includes('override_exceeds_balance'), 'Admin balance collection must reject over-balance overrides');
assert(chargeBalanceSource.includes('override_exceeds_balance'), 'Internal balance charge must reject over-balance overrides');
assert(adminCollectBalanceSource.includes('writeAuditEvent'), 'Admin balance collection must write audit events');
assert(chargeBalanceSource.includes('writeAuditEvent'), 'Internal balance charge must write audit events');
assert(chargeBalanceSource.includes('key: `charge-balance:${internalTokenFingerprint(req)}`'), 'Internal balance charge must rate-limit by internal token fingerprint');
assert(chargeBalanceSource.includes("reason: 'rate_limited'"), 'Internal balance charge must audit rate-limited attempts');
assert(chargeBalanceSource.includes('status(429)'), 'Internal balance charge must return 429 when rate limited');
assert(validateBalanceReturnBaseUrl('https://avalonvitality.co/').baseUrl === 'https://avalonvitality.co', 'Balance links must accept canonical HTTPS return URL');
assert(validateBalanceReturnBaseUrl('').code === 'public_site_url_invalid', 'Balance links must reject missing PUBLIC_SITE_URL');
assert(validateBalanceReturnBaseUrl('http://avalonvitality.co').code === 'public_site_url_unsafe', 'Balance links must reject non-HTTPS public return URL');
for (const code of ['missing_appointment_lookup', 'appointment_not_found', 'already_paid']) {
  assert(adminCollectBalanceSource.includes(code), `Admin balance collection must audit ${code} attempts`);
  assert(chargeBalanceSource.includes(code), `Internal balance charge must audit ${code} attempts`);
}
assert(orderLookupSource.includes("key: `order-lookup:${clientIp(req)}`"), 'Order lookup must rate-limit by requester IP');
assert(orderLookupSource.includes('status(429)'), 'Order lookup must reject rate-limited probes');
assert(orderLookupSource.includes('15 * 60 * 1000'), 'Order lookup rate-limit window must be 15 minutes');
assert(orderLookupSource.includes('max: 5'), 'Order lookup rate-limit max must be 5 attempts per window');
assert(orderLookupSource.includes('contact_verification_required'), 'Order lookup must require both contact factors');
assert(orderLookupSource.includes('!phoneMatch || !emailMatch'), 'Order lookup must require phone and email to match');
assert(orderLookupSource.includes('input_too_long'), 'Order lookup must cap input field lengths');
assert(manageOrderSource.includes('id="order-email"') && manageOrderSource.includes('id="order-phone"'), 'Manage order form must collect both email and phone');
assert(loginPageSource.includes('safeLoginRedirectPath'), 'Login page must sanitize redirect parameters through one helper');
assert(loginPageSource.includes("new URL(value, 'https://avalon.local')"), 'Login redirect sanitizer must parse redirects as local URLs');
assert(loginPageSource.includes("url.origin !== 'https://avalon.local'"), 'Login redirect sanitizer must reject external origins');
assert(loginPageSource.includes('decodedPath.includes(\':\')'), 'Login redirect sanitizer must reject scheme-like paths');
assert(sendSmsSource.includes('SEND_SMS_MAX_BODY_BYTES'), 'SMS auth hook must enforce a raw body size limit');
assert(sendSmsSource.includes('send_sms_body_too_large'), 'SMS auth hook must reject oversized raw bodies explicitly');
assert(sendSmsSource.includes("key: `send-sms:${clientIp(req)}`"), 'SMS auth hook must rate-limit by requester IP');
assert(sendSmsSource.includes('status: resp.status') && sendSmsSource.includes('SMS provider send failed'), 'SMS auth hook must avoid echoing provider response details');
assert(viteConfigSource.includes('redactLiveDemoPasswordPlugin'), 'Vite build must redact demo password from live API bundles');
assert(viteConfigSource.includes('VITE_AVALON_DEMO_PASSWORD:""'), 'Live API build redaction must blank the demo password env key');
assert(privateAuthTriggerMigrationSource.includes('function app_private.handle_new_user()'), 'Auth profile trigger must live in the private schema');
assert(privateAuthTriggerMigrationSource.includes('drop function if exists public.handle_new_user()'), 'Auth profile trigger migration must remove the public security definer function');
assert(privateAuthTriggerMigrationSource.includes('revoke execute on function app_private.handle_new_user() from authenticated'), 'Private auth trigger must not be directly executable by authenticated API roles');
for (const caseType of RECONCILIATION_CASE_TYPES) {
  assert(clinicalRlsMigrationSource.includes(`'${caseType}'`), `Reconciliation case type missing from DB constraint migration: ${caseType}`);
}
for (const [caseType, defaults] of Object.entries(RECONCILIATION_CASE_DEFAULTS)) {
  assert(['watch', 'action', 'critical'].includes(defaults.severity), `Reconciliation severity must match DB constraint vocabulary: ${caseType}`);
}
for (const invariant of [
  'app_private.is_assigned_provider',
  'app_private.is_operator_or_clinical_authority',
  'appointments party assigned or authority read',
  'visits party assigned or authority read',
  'medical escalations assigned or authority read',
  'reconciliation authority or assigned appointment read',
]) {
  assert(clinicalRlsMigrationSource.includes(invariant), `Clinical RLS migration missing invariant: ${invariant}`);
}
assert(!clinicalRlsMigrationSource.includes('app_private.is_staff()'), 'Clinical RLS tightening must not use broad staff access for PHI-bearing reads');
assert(acuityWebhookSource.includes(".eq('acuity_appointment_id', String(apptId))"), 'Acuity webhook must dedupe by appointment id');
assert(acuityWebhookSource.includes(".eq('action', action)"), 'Acuity webhook must dedupe by action');
assert(!acuityWebhookSource.includes(".eq('webhook_event_hash', hash)"), 'Acuity webhook must not use payload hash as event identity');
assert(acuityWebhookSource.includes('duplicate event hash drift'), 'Acuity webhook must retain payload hash as an integrity signal');
assert(acuitySource.includes('no explicit appointment type match found'), 'Acuity live type resolver must not silently choose an unrelated type');
assert(!acuitySource.includes('using first active Acuity type'), 'Acuity live type resolver must not fall back to the first active type');
assert(stripeWebhookSource.includes('STRIPE_WEBHOOK_MAX_BODY_BYTES'), 'Stripe webhook must enforce a raw body size limit');
assert(stripeWebhookSource.includes('webhook_body_too_large'), 'Stripe webhook must reject oversized raw bodies explicitly');
assert(stripeWebhookSource.includes('STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS'), 'Stripe webhook must enforce a processing timeout');
assert(stripeWebhookSource.includes("caseType: 'webhook_missed'"), 'Stripe webhook timeout must create a reconciliation case');
assert(!stripeWebhookSource.includes('fulfillmentError.body'), 'Stripe webhook must not persist raw fulfillment response bodies');
assert(attioSource.includes('crmSafeDescription'), 'Attio CRM payload must use an explicit safe description allowlist');
for (const [label, source] of Object.entries({
  checkoutVerifySource,
  stripeWebhookSource,
  acuityBookSource,
  eventPresaleSource,
})) {
  assert(!source.includes('err.body'), `PHI-sensitive vendor error logging must not print raw response bodies: ${label}`);
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
for (const [label, source] of Object.entries({ authStoreSource, interactionQaSource })) {
  assert(!source.includes("mfa: 'placeholder'"), `Ambiguous MFA placeholder remains in ${label}`);
  assert(source.includes('not_required_demo_local'), `Demo MFA state must be explicit in ${label}`);
}
assert(authStoreSource.includes('function supabaseMfaState'), 'Supabase auth must record MFA enforcement state explicitly');
assert(authStoreSource.includes("status: verified ? 'verified' : 'not_enforced'"), 'Supabase MFA state must not imply enforcement by default');
assert(authStoreSource.includes("role: 'nurse'"), 'Demo roster must include the launch nurse role');
for (const retiredRole of ["role: 'np'", "role: 'physician'", 'NP001', 'MD001', 'PHYSICIAN001']) {
  assert(!authStoreSource.includes(retiredRole), `Retired prescriber demo role remains in auth store: ${retiredRole}`);
}
assert(loginQaSource.includes("expectedRole: 'nurse'"), 'Login QA must cover the launch nurse role');

console.log('Smoke tests passed.');
