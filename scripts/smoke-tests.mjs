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
import { sendCustomerPaymentPendingEmail, sendPaymentReceivedEmail } from '../api/_booking-email.js';
import { buildPersonValues } from '../api/_attio.js';
import { RECONCILIATION_CASE_DEFAULTS, RECONCILIATION_CASE_TYPES } from '../api/_reconciliation.js';
import { validateBalanceReturnBaseUrl } from '../api/_lib/balance-core.js';
import { createAppointmentSummaryToken, isAppointmentSummaryTokenConfigured, verifyAppointmentSummaryToken } from '../api/_lib/summary-token.js';
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
const bookingConfirmationSource = readFileSync(new URL('../app-modules/pages/BookingConfirmation.jsx', import.meta.url), 'utf8');
const appointmentSummarySource = readFileSync(new URL('../api/appointment-summary.js', import.meta.url), 'utf8');
const createCheckoutSource = readFileSync(new URL('../api/create-checkout-session.js', import.meta.url), 'utf8');
const checkoutFulfillmentSource = readFileSync(new URL('../api/_checkout-fulfillment.js', import.meta.url), 'utf8');
const checkoutVerifySource = readFileSync(new URL('../api/checkout/verify.js', import.meta.url), 'utf8');
const summaryTokenSource = readFileSync(new URL('../api/_lib/summary-token.js', import.meta.url), 'utf8');
const adminCollectBalanceSource = readFileSync(new URL('../api/admin/collect-balance.js', import.meta.url), 'utf8');
const chargeBalanceSource = readFileSync(new URL('../api/charge-balance.js', import.meta.url), 'utf8');
const balanceCoreSource = readFileSync(new URL('../api/_lib/balance-core.js', import.meta.url), 'utf8');
const bookingEmailSource = readFileSync(new URL('../api/_booking-email.js', import.meta.url), 'utf8');
const adminBookingsSource = readFileSync(new URL('../api/admin/bookings.js', import.meta.url), 'utf8');
const meAppointmentsSource = readFileSync(new URL('../api/me/appointments.js', import.meta.url), 'utf8');
const supabaseAuthSource = readFileSync(new URL('../api/_lib/supabase-auth.js', import.meta.url), 'utf8');
const orderLookupSource = readFileSync(new URL('../api/order-lookup.js', import.meta.url), 'utf8');
const manageOrderSource = readFileSync(new URL('../app-modules/pages/ManageOrder.jsx', import.meta.url), 'utf8');
const loginPageSource = readFileSync(new URL('../app-modules/pages/Login.jsx', import.meta.url), 'utf8');
const messagingPanelSource = readFileSync(new URL('../src/components/messaging/MessagingPanel.jsx', import.meta.url), 'utf8');
const useMessagesSource = readFileSync(new URL('../src/hooks/useMessages.js', import.meta.url), 'utf8');
const sendSmsSource = readFileSync(new URL('../api/auth/send-sms.js', import.meta.url), 'utf8');
const acuityWebhookSource = readFileSync(new URL('../api/integrations/acuity/webhook.js', import.meta.url), 'utf8');
const stripeWebhookSource = readFileSync(new URL('../api/integrations/stripe/webhook.js', import.meta.url), 'utf8');
const acuityBookSource = readFileSync(new URL('../api/acuity-book.js', import.meta.url), 'utf8');
const acuityAppointmentSource = readFileSync(new URL('../api/acuity-appointment.js', import.meta.url), 'utf8');
const acuityAppointmentsSource = readFileSync(new URL('../api/acuity-appointments.js', import.meta.url), 'utf8');
const acuityAvailabilitySource = readFileSync(new URL('../api/acuity-availability.js', import.meta.url), 'utf8');
const acuitySource = readFileSync(new URL('../api/_acuity.js', import.meta.url), 'utf8');
const safeErrorSource = readFileSync(new URL('../api/_lib/safe-error.js', import.meta.url), 'utf8');
const attioSource = readFileSync(new URL('../api/_attio.js', import.meta.url), 'utf8');
const eventPresaleSource = readFileSync(new URL('../api/integrations/events/presale.js', import.meta.url), 'utf8');
const viteConfigSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const privateAuthTriggerMigrationSource = readFileSync(new URL('../supabase/migrations/009_private_auth_profile_trigger.sql', import.meta.url), 'utf8');
const clinicalRlsMigrationSource = readFileSync(new URL('../supabase/migrations/010_tighten_clinical_rls_and_reconciliation_cases.sql', import.meta.url), 'utf8');
const launchMessagingMigrationSource = readFileSync(new URL('../supabase/migrations/011_launch_messaging_roles.sql', import.meta.url), 'utf8');

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
assert(isAppointmentSummaryTokenConfigured(), 'Summary token helper must report dedicated secret configuration');
const summaryToken = createAppointmentSummaryToken({ sessionId: 'cs_test_123', appointmentRecordId: 'appt_123', appointmentId: 'acuity_123' });
assert(verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_test_123', appointmentRecordId: 'appt_123' }), 'Summary token should verify');
assert(!verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_other' }), 'Summary token should reject wrong session');
assert(!summaryTokenSource.includes('STRIPE_SECRET_KEY'), 'Summary tokens must not fall back to the Stripe secret');
assert(!summaryTokenSource.includes('AVALON_INTERNAL_API_SECRET'), 'Summary tokens must not fall back to the internal API secret');
assert(summaryTokenSource.includes('APPOINTMENT_SUMMARY_TOKEN_SECRET ||'), 'Summary tokens must require a dedicated server secret');
assert(checkoutVerifySource.includes('isAppointmentSummaryTokenConfigured'), 'checkout/verify must preflight summary-token signing config');
assert(checkoutVerifySource.includes('summary_token_secret_missing'), 'checkout/verify must fail explicitly when summary-token signing is not configured');

assert(appointmentSummarySource.includes('summary_auth_required'), 'appointment-summary must gate identifiable summary access');
assert(appointmentSummarySource.includes('verifyAppointmentSummaryToken'), 'appointment-summary must verify signed summary tokens');
assert(appointmentSummarySource.includes('appointment_summary_read'), 'appointment-summary must audit identifiable summary reads');
assert(appointmentSummarySource.includes('appointment_summary_denied'), 'appointment-summary must audit denied identifiable summary reads');
assert(appointmentSummarySource.includes('phiTouched: true'), 'appointment-summary read audit must mark PHI touched');
assert(appointmentSummarySource.includes("req.headers?.['x-appointment-summary-token']"), 'appointment-summary must read signed summary tokens from a header');
assert(!appointmentSummarySource.includes('req.query?.summary_token\\n    ||'), 'appointment-summary must not accept signed summary tokens from query strings');
assert(appointmentSummarySource.includes('summary_token_query'), 'appointment-summary must audit unsafe query-token attempts without honoring them');
assert(appointmentSummarySource.includes('safeSummaryErrorCode'), 'appointment-summary must sanitize error log context');
assert(!appointmentSummarySource.includes("console.error('[appointment-summary]', err.message"), 'appointment-summary must not log raw summary failure messages');
assert(!appointmentSummarySource.includes("console.warn('[appointment-summary] acuity summary unavailable:', err.message"), 'appointment-summary must not log raw Acuity summary errors');
assert(bookingConfirmationSource.includes("'x-appointment-summary-token': summaryToken"), 'Booking confirmation must pass summary token in a header');
assert(!bookingConfirmationSource.includes("query.set('summary_token'"), 'Booking confirmation must not put summary tokens in URLs');
assert(!checkoutVerifySource.includes('customerEmail:'), 'checkout/verify must not return customer email to bearer session-id callers');
assert(!checkoutVerifySource.includes('fulfillmentError: fulfillment.fulfillmentError'), 'checkout/verify must not return raw fulfillment errors to customers');
assert(!checkoutVerifySource.includes('fulfillmentError: fulfillmentError.slice'), 'checkout/verify must not write raw fulfillment errors into Stripe metadata');
assert(checkoutVerifySource.includes('appointment_confirmation_pending'), 'checkout/verify must return a customer-safe fulfillment issue code');
assert(checkoutVerifySource.includes('safeLogContext'), 'checkout/verify must sanitize fulfillment error log context');
assert(!checkoutVerifySource.includes("console.error('[checkout/verify] Acuity fulfillment failed:', err.message"), 'checkout/verify must not log raw Acuity fulfillment errors');
assert(!checkoutVerifySource.includes("console.warn('[checkout/verify] Attio sync failed:', err.message"), 'checkout/verify must not log raw Attio errors');
assert(!checkoutVerifySource.includes("error: err.message || 'Could not verify checkout session'"), 'checkout/verify must not return raw verification errors');
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
assert(createCheckoutSource.includes('safeLogContext'), 'Checkout route must sanitize checkout failure logs');
assert(createCheckoutSource.includes('CUSTOMER_SAFE_CHECKOUT_ERROR_CODES'), 'Checkout route must allowlist customer-visible error messages');
assert(!createCheckoutSource.includes('if (err.status && err.status < 500) return err.message'), 'Checkout route must not expose arbitrary provider 4xx messages');
assert(!createCheckoutSource.includes("console.error('[create-checkout-session]', err.message"), 'Checkout route must not log raw checkout errors');
assert(!createCheckoutSource.includes('rollbackErr.message || rollbackErr'), 'Checkout rollback must not log raw rollback errors');
assert(adminCollectBalanceSource.includes('override_exceeds_balance'), 'Admin balance collection must reject over-balance overrides');
assert(chargeBalanceSource.includes('override_exceeds_balance'), 'Internal balance charge must reject over-balance overrides');
assert(adminCollectBalanceSource.includes('writeAuditEvent'), 'Admin balance collection must write audit events');
assert(chargeBalanceSource.includes('writeAuditEvent'), 'Internal balance charge must write audit events');
assert(adminCollectBalanceSource.includes('appointmentId: appt.id'), 'Admin balance audit payloads must include appointmentId without PHI');
assert(chargeBalanceSource.includes('appointmentId: appt.id'), 'Internal balance audit payloads must include appointmentId without PHI');
assert(adminCollectBalanceSource.includes('resultCode: result.json?.code'), 'Admin balance attempt audit must include a result code');
assert(chargeBalanceSource.includes('resultCode: result.json?.code'), 'Internal balance attempt audit must include a result code');
assert(balanceCoreSource.includes('balanceProviderError'), 'Balance core must use generic provider error responses');
assert(!balanceCoreSource.includes('json: { error: err.message }'), 'Balance core must not return raw Stripe errors');
assert(!balanceCoreSource.includes('json: { error: linkErr.message'), 'Balance core must not return raw balance-link errors');
assert(adminCollectBalanceSource.includes('safeLogContext'), 'Admin balance lookup failures must sanitize error logs');
assert(chargeBalanceSource.includes('safeLogContext'), 'Internal balance lookup failures must sanitize error logs');
assert(!adminCollectBalanceSource.includes('json({ error: lookupErr.message })'), 'Admin balance lookup must not return raw database errors');
assert(!chargeBalanceSource.includes('json({ error: lookupErr.message })'), 'Internal balance lookup must not return raw database errors');
assert(!bookingEmailSource.includes('return { skipped: true'), 'Fulfillment emails must not silently mark skipped sends as delivered');
assert(bookingEmailSource.includes('email_delivery_skipped'), 'Fulfillment email skips must become reconciliation-visible failures');
assert(supabaseAuthSource.includes('tenant_id'), 'Supabase auth helper must carry tenant_id for audit policy inserts');
assert(adminBookingsSource.includes('admin_bookings_read'), 'Admin booking PHI reads must write audit events');
assert(adminBookingsSource.includes('phiTouched: true'), 'Admin booking read audit must mark PHI touched');
assert(adminBookingsSource.includes('safeLogContext'), 'Admin booking read failures must sanitize error logs');
assert(!adminBookingsSource.includes('json({ error: error.message })'), 'Admin booking read failures must not return raw database errors');
assert(meAppointmentsSource.includes('client_appointments_read'), 'Client appointment reads must write audit events');
assert(meAppointmentsSource.includes("match: 'session_email'"), 'Client appointment read audit must avoid storing the email value');
assert(meAppointmentsSource.includes('safeLogContext'), 'Client appointment read failures must sanitize error logs');
assert(!meAppointmentsSource.includes('json({ error: error.message })'), 'Client appointment read failures must not return raw database errors');
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
assert(safeErrorSource.includes('safeErrorCode') && safeErrorSource.includes('safeLogContext'), 'Server routes must have shared safe error helpers');
for (const [label, source] of Object.entries({
  acuityBookSource,
  acuityAppointmentSource,
  acuityAppointmentsSource,
  acuityAvailabilitySource,
})) {
  assert(source.includes('safeLogContext'), `Direct scheduling route must sanitize error logs: ${label}`);
  assert(source.includes('safeErrorCode'), `Direct scheduling route must return stable error codes: ${label}`);
  assert(!source.includes('return res.status(err.status || 500).json({ error: err.message'), `Direct scheduling route must not return raw vendor errors: ${label}`);
  assert(!source.includes('console.error') || !source.includes('err.message'), `Direct scheduling route must not log raw vendor errors: ${label}`);
}
assert(viteConfigSource.includes('redactLiveDemoPasswordPlugin'), 'Vite build must redact demo password from live API bundles');
assert(viteConfigSource.includes('VITE_AVALON_DEMO_PASSWORD:""'), 'Live API build redaction must blank the demo password env key');
assert(privateAuthTriggerMigrationSource.includes('function app_private.handle_new_user()'), 'Auth profile trigger must live in the private schema');
assert(privateAuthTriggerMigrationSource.includes('drop function if exists public.handle_new_user()'), 'Auth profile trigger migration must remove the public security definer function');
assert(privateAuthTriggerMigrationSource.includes('revoke execute on function app_private.handle_new_user() from authenticated'), 'Private auth trigger must not be directly executable by authenticated API roles');
assert(launchMessagingMigrationSource.includes("app_private.profile_role() in ('admin', 'client', 'nurse', 'rn')"), 'Messaging RLS must allow launch client/admin/nurse conversation creation');
assert(launchMessagingMigrationSource.includes("app_private.profile_role() = 'client'"), 'Messaging RLS must support client-started support conversations');
assert(launchMessagingMigrationSource.includes("role in ('admin', 'nurse', 'rn')"), 'Messaging support directory must target launch nurse/admin roles');
assert(!launchMessagingMigrationSource.includes("'provider'"), 'Messaging launch RLS must not depend on the retired provider role');
assert(messagingPanelSource.includes("? ['admin', 'nurse']"), 'Client message picker must target launch support roles');
assert(messagingPanelSource.includes("? ['client', 'nurse']"), 'Admin message picker must target client/nurse launch roles');
assert(messagingPanelSource.includes(".select('id, full_name, role')"), 'Message picker must avoid selecting support emails for the contact directory');
assert(!messagingPanelSource.includes("['admin', 'provider']"), 'Message picker must not target retired provider contacts');
assert(!useMessagesSource.includes('admin/provider'), 'Messaging hook copy must not describe retired provider-only behavior');
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
assert(acuityWebhookSource.includes('safeLogContext'), 'Acuity webhook must sanitize error log context');
assert(!acuityWebhookSource.includes("console.error('[acuity/webhook] fetch appt failed:', err.message"), 'Acuity webhook must not log raw appointment fetch errors');
assert(!acuityWebhookSource.includes("console.warn('[acuity/webhook] Attio sync failed:', e.message"), 'Acuity webhook must not log raw Attio errors');
assert(!acuityWebhookSource.includes('ok: false, error: err.message'), 'Acuity webhook must not return raw unhandled errors');
assert(acuitySource.includes('no explicit appointment type match found'), 'Acuity live type resolver must not silently choose an unrelated type');
assert(!acuitySource.includes('using first active Acuity type'), 'Acuity live type resolver must not fall back to the first active type');
assert(stripeWebhookSource.includes('STRIPE_WEBHOOK_MAX_BODY_BYTES'), 'Stripe webhook must enforce a raw body size limit');
assert(stripeWebhookSource.includes('webhook_body_too_large'), 'Stripe webhook must reject oversized raw bodies explicitly');
assert(stripeWebhookSource.includes('STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS'), 'Stripe webhook must enforce a processing timeout');
assert(stripeWebhookSource.includes("caseType: 'webhook_missed'"), 'Stripe webhook timeout must create a reconciliation case');
assert(!stripeWebhookSource.includes('fulfillmentError.body'), 'Stripe webhook must not persist raw fulfillment response bodies');
assert(!stripeWebhookSource.includes('fulfillmentError: fulfillmentError.message.slice'), 'Stripe webhook must not write raw fulfillment errors into Stripe metadata');
assert(stripeWebhookSource.includes("fulfillmentIssue: 'appointment_confirmation_pending'"), 'Stripe webhook must write customer-safe fulfillment issue codes');
assert(stripeWebhookSource.includes('safeLogContext'), 'Stripe webhook must sanitize fulfillment error log context');
assert(!stripeWebhookSource.includes("console.error('[stripe/webhook] Acuity fulfillment failed:', err.message"), 'Stripe webhook must not log raw Acuity fulfillment errors');
assert(!stripeWebhookSource.includes("console.warn('[stripe/webhook] Attio sync failed:', err.message"), 'Stripe webhook must not log raw Attio errors');
assert(!stripeWebhookSource.includes("error: err.message || 'Invalid Stripe webhook'"), 'Stripe webhook must not return raw invalid-webhook errors');
assert(!stripeWebhookSource.includes('persisted: false, error: err.message'), 'Stripe webhook must not return raw processing errors');
assert(attioSource.includes('crmSafeDescription'), 'Attio CRM payload must use an explicit safe description allowlist');
assert(checkoutFulfillmentSource.includes('membership_recurrence_failed'), 'Membership recurrence failures must use stable log codes');
assert(!checkoutFulfillmentSource.includes('failed:`, err.message'), 'Membership recurrence failures must not log raw Acuity errors');
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

const originalResendKey = process.env.RESEND_API_KEY;
delete process.env.RESEND_API_KEY;
for (const [label, fn] of [
  ['operations', () => sendPaymentReceivedEmail({ checkout: { contact: { email: 'ops@example.com' } } })],
  ['customer', () => sendCustomerPaymentPendingEmail({ checkout: { contact: { email: 'client@example.com' } } })],
]) {
  let rejected = false;
  try {
    await fn();
  } catch (err) {
    rejected = err?.code === 'email_delivery_skipped' && err?.reason === 'resend_not_configured';
  }
  assert(rejected, `${label} fulfillment email must reject when Resend is not configured`);
}
if (originalResendKey) process.env.RESEND_API_KEY = originalResendKey;
else delete process.env.RESEND_API_KEY;

console.log('Smoke tests passed.');
