import { readFileSync } from 'node:fs';
import { allKnownRoutes } from '../src/routes/routeGroups.js';
import { noindexStaticRoutes } from '../src/data/seoArchitecture.js';
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
import { sendInviteEmail } from '../api/_lib/invite-email.js';
import { buildHubspotProperties } from '../api/_hubspot.js';
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
const authCallbackSource = readFileSync(new URL('../src/pages/AuthCallback.jsx', import.meta.url), 'utf8');
const newPasswordSource = readFileSync(new URL('../src/pages/NewPassword.jsx', import.meta.url), 'utf8');
const authStoreSource = readFileSync(new URL('../src/lib/useAuthStore.js', import.meta.url), 'utf8');
const supabaseClientSource = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const loginQaSource = readFileSync(new URL('./login-qa.mjs', import.meta.url), 'utf8');
const interactionQaSource = readFileSync(new URL('./interaction-qa.mjs', import.meta.url), 'utf8');
const bookingConfirmationSource = readFileSync(new URL('../app-modules/pages/BookingConfirmation.jsx', import.meta.url), 'utf8');
const checkoutPageSource = readFileSync(new URL('../app-modules/pages/Checkout.jsx', import.meta.url), 'utf8');
const planCheckoutSource = readFileSync(new URL('../app-modules/pages/PlanCheckout.jsx', import.meta.url), 'utf8');
const checkoutSuccessSource = readFileSync(new URL('../app-modules/source/pages/CheckoutSuccess.jsx', import.meta.url), 'utf8');
const appointmentSummarySource = readFileSync(new URL('../api/appointment-summary.js', import.meta.url), 'utf8');
const createCheckoutSource = readFileSync(new URL('../api/create-checkout-session.js', import.meta.url), 'utf8');
const checkoutFulfillmentSource = readFileSync(new URL('../api/_checkout-fulfillment.js', import.meta.url), 'utf8');
const catalogPricingSource = readFileSync(new URL('../api/_lib/catalog-pricing.js', import.meta.url), 'utf8');
const preApiGuardSource = readFileSync(new URL('../api/_lib/pre-api-guard.js', import.meta.url), 'utf8');
const checkoutVerifySource = readFileSync(new URL('../api/checkout/verify.js', import.meta.url), 'utf8');
const summaryTokenSource = readFileSync(new URL('../api/_lib/summary-token.js', import.meta.url), 'utf8');
const auditEventsSource = readFileSync(new URL('../api/_lib/audit-events.js', import.meta.url), 'utf8');
const reconciliationSource = readFileSync(new URL('../api/_reconciliation.js', import.meta.url), 'utf8');
const adminCollectBalanceSource = readFileSync(new URL('../api/admin/collect-balance.js', import.meta.url), 'utf8');
const chargeBalanceSource = readFileSync(new URL('../api/charge-balance.js', import.meta.url), 'utf8');
const balanceCoreSource = readFileSync(new URL('../api/_lib/balance-core.js', import.meta.url), 'utf8');
const bookingEmailSource = readFileSync(new URL('../api/_booking-email.js', import.meta.url), 'utf8');
const teamInviteSource = readFileSync(new URL('../api/admin/team/invite.js', import.meta.url), 'utf8');
const adminBookingsSource = readFileSync(new URL('../api/admin/bookings.js', import.meta.url), 'utf8');
const retryAcuitySource = readFileSync(new URL('../api/admin/bookings/retry-acuity.js', import.meta.url), 'utf8');
const financeSummarySource = readFileSync(new URL('../api/admin/finance/summary.js', import.meta.url), 'utf8');
const meAppointmentsSource = readFileSync(new URL('../api/me/appointments.js', import.meta.url), 'utf8');
const supabaseAuthSource = readFileSync(new URL('../api/_lib/supabase-auth.js', import.meta.url), 'utf8');
const orderLookupSource = readFileSync(new URL('../api/order-lookup.js', import.meta.url), 'utf8');
const rateLimitSource = readFileSync(new URL('../api/_lib/rate-limit.js', import.meta.url), 'utf8');
const manageOrderSource = readFileSync(new URL('../app-modules/pages/ManageOrder.jsx', import.meta.url), 'utf8');
const loginPageSource = readFileSync(new URL('../app-modules/pages/Login.jsx', import.meta.url), 'utf8');
const signupPageSource = readFileSync(new URL('../app-modules/pages/Signup.jsx', import.meta.url), 'utf8');
const forgotPasswordSource = readFileSync(new URL('../app-modules/pages/ForgotPassword.jsx', import.meta.url), 'utf8');
const memberAccountSource = readFileSync(new URL('../src/pages/members/Account.jsx', import.meta.url), 'utf8');
const memberDashboardSource = readFileSync(new URL('../app-modules/pages/members/Dashboard.jsx', import.meta.url), 'utf8');
const adminSchedulingBookingsSource = readFileSync(new URL('../app-modules/pages/admin/Bookings.jsx', import.meta.url), 'utf8');
const liveAdminBookingsSource = readFileSync(new URL('../app-modules/pages/admin/LiveBookings.jsx', import.meta.url), 'utf8');
const financeControlSource = readFileSync(new URL('../app-modules/pages/admin/FinanceControl.jsx', import.meta.url), 'utf8');
const messagingPanelSource = readFileSync(new URL('../src/components/messaging/MessagingPanel.jsx', import.meta.url), 'utf8');
const useMessagesSource = readFileSync(new URL('../src/hooks/useMessages.js', import.meta.url), 'utf8');
const sendSmsSource = readFileSync(new URL('../api/auth/send-sms.js', import.meta.url), 'utf8');
const inviteAcceptSource = readFileSync(new URL('../api/invite/accept.js', import.meta.url), 'utf8');
const verifySignupSource = readFileSync(new URL('./verify-signup.mjs', import.meta.url), 'utf8');
const verifyTeamInviteSource = readFileSync(new URL('./verify-team-invite.mjs', import.meta.url), 'utf8');
const verifyOauthSource = readFileSync(new URL('./verify-oauth.mjs', import.meta.url), 'utf8');
const verifyBookingToAcuitySource = readFileSync(new URL('./verify-booking-to-acuity.mjs', import.meta.url), 'utf8');
const verifyPasswordResetSource = readFileSync(new URL('./verify-password-reset.mjs', import.meta.url), 'utf8');
const verifyProdSource = readFileSync(new URL('./verify-prod.mjs', import.meta.url), 'utf8');
const acuityWebhookSource = readFileSync(new URL('../api/integrations/acuity/webhook.js', import.meta.url), 'utf8');
const stripeWebhookSource = readFileSync(new URL('../api/integrations/stripe/webhook.js', import.meta.url), 'utf8');
const acuityBookSource = readFileSync(new URL('../api/acuity-book.js', import.meta.url), 'utf8');
const acuityAppointmentSource = readFileSync(new URL('../api/acuity-appointment.js', import.meta.url), 'utf8');
const acuityAppointmentsSource = readFileSync(new URL('../api/acuity-appointments.js', import.meta.url), 'utf8');
const acuityAvailabilitySource = readFileSync(new URL('../api/acuity-availability.js', import.meta.url), 'utf8');
const acuitySource = readFileSync(new URL('../api/_acuity.js', import.meta.url), 'utf8');
const frontendAcuityTypesSource = readFileSync(new URL('../src/lib/acuityAppointmentTypes.js', import.meta.url), 'utf8');
const acuityTestSource = readFileSync(new URL('../api/integrations/acuity/test.js', import.meta.url), 'utf8');
const stripeTestSource = readFileSync(new URL('../api/integrations/stripe/test.js', import.meta.url), 'utf8');
const safeErrorSource = readFileSync(new URL('../api/_lib/safe-error.js', import.meta.url), 'utf8');
const hubspotSource = readFileSync(new URL('../api/_hubspot.js', import.meta.url), 'utf8');
const hubspotTestSource = readFileSync(new URL('../api/integrations/hubspot/test.js', import.meta.url), 'utf8');
const hubspotUpsertSource = readFileSync(new URL('../api/integrations/hubspot/upsert-contact.js', import.meta.url), 'utf8');
const hubspotPlaceholderSource = readFileSync(new URL('../src/lib/hubspotPlaceholder.js', import.meta.url), 'utf8');
const eventPresaleSource = readFileSync(new URL('../api/integrations/events/presale.js', import.meta.url), 'utf8');
const eventPresalePageSource = readFileSync(new URL('../app-modules/source/pages/EventPresale.jsx', import.meta.url), 'utf8');
const applySource = readFileSync(new URL('../api/apply.js', import.meta.url), 'utf8');
const waitlistSource = readFileSync(new URL('../api/waitlist.js', import.meta.url), 'utf8');
const clientAnalyticsSource = readFileSync(new URL('../src/lib/analytics.js', import.meta.url), 'utf8');
const serverAnalyticsSource = readFileSync(new URL('../api/analytics.js', import.meta.url), 'utf8');
const reverseGeocodeSource = readFileSync(new URL('../api/reverse-geocode.js', import.meta.url), 'utf8');
const viteConfigSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const messagingBaseMigrationSource = readFileSync(new URL('../supabase/migrations/002_messages.sql', import.meta.url), 'utf8');
const privateAuthTriggerMigrationSource = readFileSync(new URL('../supabase/migrations/009_private_auth_profile_trigger.sql', import.meta.url), 'utf8');
const clinicalRlsMigrationSource = readFileSync(new URL('../supabase/migrations/010_tighten_clinical_rls_and_reconciliation_cases.sql', import.meta.url), 'utf8');
const launchMessagingMigrationSource = readFileSync(new URL('../supabase/migrations/011_launch_messaging_roles.sql', import.meta.url), 'utf8');
const envExampleSource = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const authSetupSource = readFileSync(new URL('../docs/AUTH_SETUP.md', import.meta.url), 'utf8');
const acuityTypesDocSource = readFileSync(new URL('../docs/ACUITY_TYPES.md', import.meta.url), 'utf8');
const prodEnvChecklistSource = readFileSync(new URL('../docs/PROD_ENV_CHECKLIST.md', import.meta.url), 'utf8');
const goLiveStatusSource = readFileSync(new URL('../docs/GO_LIVE_STATUS.md', import.meta.url), 'utf8');
const goLiveWorkflowSource = readFileSync(new URL('../.github/workflows/go-live-verify.yml', import.meta.url), 'utf8');
const navbarSource = readFileSync(new URL('../app-modules/source/components/landing/Navbar.jsx', import.meta.url), 'utf8');
const adminLayoutSource = readFileSync(new URL('../app-modules/source/layouts/AdminLayout.jsx', import.meta.url), 'utf8');
const providerRoleOsSource = readFileSync(new URL('../app-modules/pages/provider/RoleOS.jsx', import.meta.url), 'utf8');
const communicationCenterSource = readFileSync(new URL('../app-modules/source/components/messaging/CommunicationCenter.jsx', import.meta.url), 'utf8');
const communicationHookSource = readFileSync(new URL('../src/hooks/useCommunicationCenter.js', import.meta.url), 'utf8');
const platformOpsSource = readFileSync(new URL('../app-modules/lib/platformOps.js', import.meta.url), 'utf8');
const providerCommunicationsSource = readFileSync(new URL('../app-modules/pages/provider/Communications.jsx', import.meta.url), 'utf8');
const localRepositorySource = readFileSync(new URL('../app-modules/lib/localRepository.js', import.meta.url), 'utf8');

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
assert(catalogPricingSource.includes("from '../../src/data/catalog.js'"), 'Server checkout pricing must derive from the shared catalog');
assert(!catalogPricingSource.includes('export const ITEM_PRICE_BY_KEY = new Map(Object.entries({'), 'Server item price map must not be hand-maintained');
assert(!catalogPricingSource.includes('export const ADDON_PRICE_BY_LABEL = new Map(Object.entries({'), 'Server add-on label price map must not be hand-maintained');
assert(ITEM_PRICE_BY_KEY.get('nad') === 350, 'NAD session key must use the first IV dose, not the NAD+ IM shot');
assert(ITEM_PRICE_BY_KEY.get('hydration') === IV_SESSIONS.find((item) => item.key === 'hydration')?.price, 'Server hydration price must match client catalog');
assert(ITEM_PRICE_BY_KEY.get('custom_hydration') === ITEM_PRICE_BY_KEY.get('hydration'), 'Custom hydration alias must track canonical hydration price');
assert(ADDON_PRICE_BY_LABEL.get('nad') === 80, 'NAD+ IM label must remain priced through label lookup');

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

const hubspotProps = buildHubspotProperties({
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
const hubspotBlob = JSON.stringify(hubspotProps);
for (const leaked of ['1980-01-01', '123 Health St', 'NAD+', 'Emergency Person', '94107', 'Partial payment', 'GFE', 'Clinical', 'AV-123', 'apt_123']) {
  assert(!hubspotBlob.includes(leaked), `HubSpot CRM payload leaked PHI/intake detail: ${leaked}`);
}
assert(hubspotProps.email === 'jane@example.com',                 'HubSpot payload dropped email');
assert(hubspotProps.avalon_source === 'Avalon Booking',           'HubSpot payload dropped avalon_source');
assert(hubspotProps.avalon_lifecycle_stage === 'Booked',          'HubSpot payload dropped avalon_lifecycle_stage');
assert(hubspotProps.city === 'San Francisco',                     'HubSpot payload dropped city');
assert(hubspotProps.avalon_plan_interest === 'Membership',        'HubSpot payload dropped avalon_plan_interest');
assert(hubspotProps.avalon_visit_count === 2,                     'HubSpot payload dropped avalon_visit_count');

process.env.APPOINTMENT_SUMMARY_TOKEN_SECRET = 'smoke-summary-secret';
assert(isAppointmentSummaryTokenConfigured(), 'Summary token helper must report dedicated secret configuration');
const summaryToken = createAppointmentSummaryToken({ sessionId: 'cs_test_123', appointmentRecordId: 'appt_123', appointmentId: 'acuity_123' });
assert(verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_test_123', appointmentRecordId: 'appt_123' }), 'Summary token should verify');
assert(!verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_other' }), 'Summary token should reject wrong session');
assert(!verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_test_123', appointmentRecordId: 'appt_other' }), 'Summary token should reject wrong appointment record');
assert(!verifyAppointmentSummaryToken(summaryToken, { sessionId: 'cs_test_123', appointmentId: 'acuity_other' }), 'Summary token should reject wrong Acuity appointment');
const sessionOnlySummaryToken = createAppointmentSummaryToken({ sessionId: 'cs_test_123' });
assert(!verifyAppointmentSummaryToken(sessionOnlySummaryToken, { sessionId: 'cs_test_123', appointmentRecordId: 'appt_123' }), 'Session-only summary token must not authorize record-bound appointment details');
assert(!verifyAppointmentSummaryToken(sessionOnlySummaryToken, { sessionId: 'cs_test_123', appointmentId: 'acuity_123' }), 'Session-only summary token must not authorize Acuity-bound appointment details');
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
assert(appointmentSummarySource.includes("SUMMARY_STAFF_ROLES = new Set(['admin', 'nurse'])"), 'appointment-summary staff access must match launch roles only');
for (const retiredRole of ["'provider'", "'np'", "'physician'"]) {
  const staffRoleSource = appointmentSummarySource.slice(
    appointmentSummarySource.indexOf('SUMMARY_STAFF_ROLES'),
    appointmentSummarySource.indexOf('function summaryToken')
  );
  assert(!staffRoleSource.includes(retiredRole), `appointment-summary staff access must not include retired role ${retiredRole}`);
}
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
for (const rawPersistedError of [
  "error: err.message || 'HubSpot sync failed'",
  "error: err.message || 'Payment operations email failed'",
  "error: err.message || 'Customer pending email failed'",
  'message: fulfillment.fulfillmentError',
]) {
  assert(!checkoutVerifySource.includes(rawPersistedError), `checkout/verify must not persist raw operational errors: ${rawPersistedError}`);
}
assert(checkoutVerifySource.includes('appointment_confirmation_pending'), 'checkout/verify must return a customer-safe fulfillment issue code');
assert(checkoutVerifySource.includes('scheduling_lock_at: failed ? null : undefined'), 'checkout/verify must release the scheduling lock after a persisted Acuity failure');
assert(checkoutVerifySource.includes('safeLogContext'), 'checkout/verify must sanitize fulfillment error log context');
assert(!checkoutVerifySource.includes("console.error('[checkout/verify] Acuity fulfillment failed:', err.message"), 'checkout/verify must not log raw Acuity fulfillment errors');
assert(!checkoutVerifySource.includes("console.warn('[checkout/verify] HubSpot sync failed:', err.message"), 'checkout/verify must not log raw HubSpot errors');
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
assert(createCheckoutSource.includes('sessionAppointmentRecordId') && createCheckoutSource.includes('canonicalAppointmentRecordId'), 'Checkout route must reuse the canonical appointment record on Stripe idempotency replay');
assert(createCheckoutSource.includes("provider: 'avalon_checkout_duplicate'"), 'Checkout route must sanitize duplicate pending records created by Stripe idempotency replay');
assert(createCheckoutSource.includes('checkout_duplicate_mark_failed'), 'Checkout duplicate-record cleanup failures must use sanitized log context');
assert(createCheckoutSource.includes('safeLogContext'), 'Checkout route must sanitize checkout failure logs');
assert(createCheckoutSource.includes('CUSTOMER_SAFE_CHECKOUT_ERROR_CODES'), 'Checkout route must allowlist customer-visible error messages');
assert(!createCheckoutSource.includes('if (err.status && err.status < 500) return err.message'), 'Checkout route must not expose arbitrary provider 4xx messages');
assert(!createCheckoutSource.includes("console.error('[create-checkout-session]', err.message"), 'Checkout route must not log raw checkout errors');
assert(!createCheckoutSource.includes("err?.code || err?.message || 'unknown_error'"), 'Checkout scheduling preflight must not log raw scheduling errors');
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
assert(adminCollectBalanceSource.includes("reason: 'stripe_not_configured'"), 'Admin balance collection must audit missing Stripe configuration attempts');
assert(chargeBalanceSource.includes("reason: 'stripe_not_configured'"), 'Internal balance charge must audit missing Stripe configuration attempts');
assert(adminCollectBalanceSource.includes("reason: 'balance_lookup_failed'"), 'Admin balance collection must audit lookup failure attempts');
assert(chargeBalanceSource.includes("reason: 'balance_lookup_failed'"), 'Internal balance charge must audit lookup failure attempts');
assert(!adminCollectBalanceSource.includes('json({ error: lookupErr.message })'), 'Admin balance lookup must not return raw database errors');
assert(!chargeBalanceSource.includes('json({ error: lookupErr.message })'), 'Internal balance lookup must not return raw database errors');
assert(!bookingEmailSource.includes('return { skipped: true'), 'Fulfillment emails must not silently mark skipped sends as delivered');
assert(bookingEmailSource.includes('email_delivery_skipped'), 'Fulfillment email skips must become reconciliation-visible failures');
assert(teamInviteSource.includes('firstDeliveryError?.status || 502'), 'Team invite route must preserve hard email-delivery failure status codes');
assert(teamInviteSource.includes("firstDeliveryError?.code ? { code: firstDeliveryError.code }"), 'Team invite route must return stable delivery error codes when no channel succeeds');
assert(inviteAcceptSource.includes(".from('profiles').upsert") && inviteAcceptSource.includes("onConflict: 'id'"), 'Invite accept must upsert the promoted profile instead of assuming the auth trigger inserted it');
assert(verifyTeamInviteSource.includes('VERIFY_EMAIL_ROOT'), 'Team invite verifier must use a human-owned mailbox root for production email delivery checks');
assert(verifyTeamInviteSource.includes('Set VERIFY_EMAIL_ROOT to a human-owned mailbox'), 'Team invite verifier must fail early on production targets without VERIFY_EMAIL_ROOT');
assert(verifyTeamInviteSource.includes("method: 'token'") && verifyTeamInviteSource.includes("method: 'code'"), 'Team invite verifier must exercise both token and email-code acceptance paths');
assert(verifyOauthSource.includes('Authorization: `Bearer ${anon}`'), 'OAuth verifier must send the anon key as a bearer token as well as apikey');
assert(verifySignupSource.includes('VERIFY_EMAIL_ROOT'), 'Signup verifier must use a human-owned mailbox root for production signup checks');
assert(verifySignupSource.includes('production signup verification does not use example.test'), 'Signup verifier must fail early on production targets without VERIFY_EMAIL_ROOT');
assert(verifySignupSource.includes(".from('profiles').delete().eq('id', userId)"), 'Signup verifier must remove its temporary profile row during cleanup');
assert(verifyPasswordResetSource.includes('VERIFY_EMAIL_ROOT'), 'Password reset verifier must use a human-owned mailbox root for production email delivery checks');
assert(verifyPasswordResetSource.includes('Set VERIFY_EMAIL_ROOT to a human-owned mailbox'), 'Password reset verifier must fail early on production targets without VERIFY_EMAIL_ROOT');
assert(verifyPasswordResetSource.includes(".from('profiles').delete().eq('id', userId)"), 'Password reset verifier must remove its temporary profile row during cleanup');
assert(verifyPasswordResetSource.includes("redirect.pathname !== '/account/new-password'"), 'Password reset verifier must enforce /account/new-password as the only update target');
assert(verifyPasswordResetSource.includes('Confirm delivery in the VERIFY_EMAIL_ROOT mailbox'), 'Password reset verifier must disclose the manual hosted email-delivery confirmation');
assert(signupPageSource.includes("handleOAuth('google')") && signupPageSource.includes("handleOAuth('apple')"), 'Signup page must expose Google and Apple OAuth actions');
assert(memberAccountSource.includes('registerPasskey') && memberAccountSource.includes('Add Passkey'), 'Member account page must expose passkey enrollment');
assert(forgotPasswordSource.includes('Could not send the reset link.'), 'Forgot password page must use reset-link copy, not sign-in-link copy');
assert(verifyProdSource.includes('requiredEnv'), 'verify:prod must preflight required launch verification env');
assert(verifyProdSource.includes("startsWith('sk_test_')"), 'verify:prod must refuse live Stripe keys');
for (const verifyProdRequired of [
  'PUBLIC_SITE_URL',
  'AVALON_ENABLE_LIVE_API',
  'VITE_AVALON_ENABLE_LIVE_API',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'APPOINTMENT_SUMMARY_TOKEN_SECRET',
]) {
  assert(verifyProdSource.includes(`'${verifyProdRequired}'`), `verify:prod must require ${verifyProdRequired}`);
  assert(goLiveWorkflowSource.includes(`${verifyProdRequired}:`), `Go-live workflow must pass ${verifyProdRequired} into verify:prod`);
}
assert(verifyProdSource.includes("process.env.AVALON_ENABLE_LIVE_API !== 'true'"), 'verify:prod must require live API flags to be true');
assert(verifyProdSource.includes("startsWith('pk_')"), 'verify:prod must require a Stripe publishable key for the build');
assert(verifyProdSource.includes('ACUITY_DEFAULT_TYPE_ID') && verifyProdSource.includes('ACUITY_TYPE_HYDRATION') && verifyProdSource.includes('ACUITY_TYPE_MEMBERSHIP'), 'verify:prod must require deterministic Acuity type config');
for (const workflowStep of ['npm run lint', 'npm run typecheck', 'npm run build', 'npm run verify:prod', 'npm run test:launch-blockers']) {
  assert(goLiveWorkflowSource.includes(workflowStep), `Go-live workflow must run ${workflowStep}`);
}
assert(
  goLiveWorkflowSource.indexOf('npm run verify:prod') < goLiveWorkflowSource.indexOf('npm run build'),
  'Go-live workflow must run verify:prod before build so integration smoke gates the prebuilt artifact step'
);
assert(
  goLiveWorkflowSource.indexOf('npm run build') < goLiveWorkflowSource.indexOf('npm run test:launch-blockers'),
  'Go-live workflow must run launch-blocker checks against the built artifact'
);
assert(supabaseAuthSource.includes('tenant_id'), 'Supabase auth helper must carry tenant_id for audit policy inserts');
assert(supabaseClientSource.includes("flowType: 'pkce'"), 'Supabase browser client must use PKCE so /auth/callback receives an exchangeable code');
assert(supabaseClientSource.includes('detectSessionInUrl: true'), 'Supabase browser client must detect auth redirects in the browser');
assert(authStoreSource.includes('emailRedirectTo: `${window.location.origin}/auth/callback`'), 'Email sign-in/signup confirmations must route through /auth/callback');
assert(authStoreSource.includes('refreshSupabaseSession'), 'Auth store must expose an explicit Supabase session refresh for auth callback routes');
assert(authCallbackSource.includes('const appUser = await refreshSupabaseSession()'), 'OAuth callback must refresh the auth store before protected-route navigation');
assert(newPasswordSource.includes('await refreshSupabaseSession()'), 'Password recovery page must refresh the auth store after exchanging the recovery code');
for (const authUtilityRoute of ['/auth/callback', '/account/new-password']) {
  assert(appSource.includes(`path="${authUtilityRoute}"`), `App router must expose ${authUtilityRoute}`);
  assert(noindexStaticRoutes.some((route) => route.path === authUtilityRoute), `Static prerender must create a noindex shell for ${authUtilityRoute}`);
}
assert(appSource.includes('const { user, loading, authBackend } = useAuthStore()'), 'Protected routes must read Supabase auth loading state');
assert(appSource.includes("if (loading && authBackend === 'supabase') return <RouteFallback />"), 'Protected routes must wait for Supabase session hydration before redirecting');
assert(adminBookingsSource.includes('admin_bookings_read'), 'Admin booking PHI reads must write audit events');
assert(adminBookingsSource.includes('phiTouched: true'), 'Admin booking read audit must mark PHI touched');
assert(adminBookingsSource.includes('safeLogContext'), 'Admin booking read failures must sanitize error logs');
assert(!adminBookingsSource.includes('json({ error: error.message })'), 'Admin booking read failures must not return raw database errors');
assert((retryAcuitySource.match(/scheduling_lock_at: null/g) || []).length >= 2, 'Retry Acuity endpoint must release the scheduling lock after success and failure');
assert(retryAcuitySource.includes('admin_retry_acuity'), 'Retry Acuity endpoint must audit retry attempts');
assert(retryAcuitySource.includes('phiTouched: true'), 'Retry Acuity audit must mark PHI touched because the endpoint reads appointment contact payload');
assert(retryAcuitySource.includes("query = query.eq('tenant_id', tenantId)"), 'Retry Acuity updates must stay tenant-scoped when tenant_id is known');
assert(retryAcuitySource.includes("record.reconciliation_status !== 'action_required'"), 'Retry Acuity endpoint must reject direct calls for bookings that are not action_required');
assert(retryAcuitySource.includes('isPaymentCompleteEnoughForRetry(record.payment_status)'), 'Retry Acuity endpoint must reject direct calls before payment is confirmed');
assert(retryAcuitySource.includes('retry_payment_not_confirmed'), 'Retry Acuity payment gate must return a stable error code');
assert(financeSummarySource.includes('admin_finance_summary_read'), 'Admin finance summary reads must write audit events');
assert(financeSummarySource.includes('phiTouched: true'), 'Admin finance summary audit must mark PHI touched because outstanding rows include contact details');
assert(!financeSummarySource.includes('customerEmail') || !financeSummarySource.includes('payload: { customerEmail'), 'Admin finance summary audit payload must not store customer emails');
assert(meAppointmentsSource.includes('client_appointments_read'), 'Client appointment reads must write audit events');
assert(meAppointmentsSource.includes("match: 'session_email'"), 'Client appointment read audit must avoid storing the email value');
assert(meAppointmentsSource.includes("query = query.eq('tenant_id', tenantId)"), 'Client appointment reads must tenant-scope the service-role query when tenant_id is known');
assert(meAppointmentsSource.includes('safeLogContext'), 'Client appointment read failures must sanitize error logs');
assert(!meAppointmentsSource.includes('json({ error: error.message })'), 'Client appointment read failures must not return raw database errors');
assert(!memberDashboardSource.includes("error: err.message || 'Could not load your visits.'"), 'Member dashboard must not render raw appointment API errors');
assert(authStoreSource.includes('customerSafeAuthError'), 'Supabase auth UI must use customer-safe auth error copy');
assert(authStoreSource.includes('demoAuthErrorMessage'), 'Demo auth must keep an explicit local error allowlist');
assert(!authStoreSource.includes('const msg = err.message ||'), 'Supabase auth UI must not render raw provider error messages');
assert(!authStoreSource.includes("err.message || 'Passkey sign-in failed.'"), 'Passkey sign-in must not render raw provider errors');
assert(!authStoreSource.includes("err.message || 'Could not add a passkey.'"), 'Passkey registration must not render raw provider errors');
assert(!checkoutPageSource.includes('setError(err.message)'), 'Checkout UI must not render raw checkout/provider errors');
assert(!checkoutPageSource.includes("reason: err.message || 'checkout_request_failed'"), 'Checkout analytics must not send raw failure messages');
assert(createCheckoutSource.includes("safeLogContext(pendingError, 'appointment_record_unavailable')"), 'Checkout pending appointment-record failures must log sanitized database context');
assert(!createCheckoutSource.includes("pendingError?.message || 'missing appointment id'"), 'Checkout pending appointment-record failures must not log raw database messages');
assert(checkoutPageSource.includes('checkoutInFlightRef'), 'Checkout UI must synchronously guard rapid repeat submits');
assert(checkoutPageSource.includes('Redirecting to secure checkout'), 'Checkout UI must show a blocking redirect-pending state');
assert(checkoutPageSource.includes('window.location.assign(data.url)'), 'Checkout UI must use an explicit redirect after session creation');
assert(createCheckoutSource.includes('const requiresScheduling = hasVisitItems || Boolean(membership)'), 'Live checkout must require scheduling for both one-time visits and plans before Stripe payment');
assert(createCheckoutSource.includes('requiresScheduling && !appointment.acuityDatetime'), 'Live checkout must reject plan checkout without a first appointment time');
assert(createCheckoutSource.includes('requiresScheduling && !isAdultCheckoutDob'), 'Live checkout must reject plan checkout without an adult birthdate');
assert(planCheckoutSource.includes('contact.dob.trim()') && planCheckoutSource.includes('contact.emergencyContact.trim()'), 'Plan checkout must collect DOB and emergency contact before starting Stripe payment');
assert(planCheckoutSource.includes('dob: contact.dob.trim()') && planCheckoutSource.includes('emergencyContact: contact.emergencyContact.trim()'), 'Plan checkout must send DOB and emergency contact into the scheduling payload');
assert(checkoutPageSource.includes('10_000'), 'Checkout redirect pending state must have a retry fallback timeout');
assert(checkoutSuccessSource.includes('pendingFulfillment'), 'Checkout success page must inspect pending fulfillment state');
assert(checkoutSuccessSource.includes("fulfillmentStatus === 'acuity_failed'"), 'Checkout success page must inspect Acuity fulfillment failure state');
assert(checkoutSuccessSource.includes('Payment Received.'), 'Checkout success page must render a distinct payment-received pending headline');
assert(checkoutSuccessSource.includes('confirming your appointment'), 'Checkout success page must tell paid users when appointment confirmation is pending');
assert(clientAnalyticsSource.includes('sensitiveAnalyticsKey'), 'Client analytics must detect sensitive nested keys');
assert(clientAnalyticsSource.includes('sanitizeObject(v, depth + 1)'), 'Client analytics must recursively sanitize nested objects');
assert(clientAnalyticsSource.includes('sanitizeObject(item, depth + 1)'), 'Client analytics must recursively sanitize array object entries');
for (const sensitiveAnalyticsField of ['customerEmail', 'customerName', 'emergencyContact', 'clinicalReviewOnFile', 'gfeRequired', 'medicalNotes', 'clinicalNotes']) {
  assert(clientAnalyticsSource.includes(sensitiveAnalyticsField), `Client analytics deny-list must cover ${sensitiveAnalyticsField}`);
}
assert(serverAnalyticsSource.includes('sanitizeAnalyticsObject(rawEvent.props)'), 'Server analytics must sanitize event props before persistence');
assert(serverAnalyticsSource.includes('sanitizeAnalyticsObject(rawEvent.context)'), 'Server analytics must sanitize event context before persistence');
assert(serverAnalyticsSource.includes('sensitiveAnalyticsKey'), 'Server analytics must detect sensitive nested keys');
assert(serverAnalyticsSource.includes('sanitizeAnalyticsValue(nested, depth + 1)'), 'Server analytics must recursively sanitize nested objects');
for (const sensitiveAnalyticsField of ['customeremail', 'customername', 'emergencycontact', 'clinicalreviewonfile', 'gferequired', 'medicalnotes', 'clinicalnotes']) {
  assert(serverAnalyticsSource.includes(sensitiveAnalyticsField), `Server analytics deny-list must cover ${sensitiveAnalyticsField}`);
}
assert(!adminSchedulingBookingsSource.includes('setError(err.message)'), 'Admin scheduling bookings UI must not render raw provider errors');
assert(adminSchedulingBookingsSource.includes("authBackend === 'supabase' ? <LiveAdminBookings /> : <AdminBookings />"), '/admin/bookings must use the live payments-backed surface in Supabase mode');
assert(!financeControlSource.includes("err?.message || 'Could not load finance summary.'"), 'Admin finance UI must not render raw finance API/client errors');
assert(financeControlSource.includes("error: 'Could not load finance summary.'"), 'Admin finance UI must use customer-safe finance error copy');
assert(!liveAdminBookingsSource.includes("err.body?.error || err.message || 'Could not load bookings.'"), 'Live admin bookings UI must not render raw booking API errors');
assert(!liveAdminBookingsSource.includes("err.body?.error || err.message || 'Action failed.'"), 'Live admin booking actions must not render raw provider/API errors');
assert(!liveAdminBookingsSource.includes("err?.message || 'Acuity retry failed.'"), 'Live admin Acuity retry UI must not render raw provider/API errors');
assert(liveAdminBookingsSource.includes('Needs scheduling') && liveAdminBookingsSource.includes('Retry Acuity'), 'Live admin bookings must expose Acuity action-required retry controls');
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
assert(orderLookupSource.includes('writeAuditEvent'), 'Order lookup must audit appointment lookup attempts');
assert(orderLookupSource.includes("action: 'order_lookup_read'"), 'Order lookup must audit successful appointment reads');
assert(orderLookupSource.includes("action: 'order_lookup_denied'"), 'Order lookup must audit denied record-bound lookup attempts');
assert(orderLookupSource.includes('phiTouched: true'), 'Order lookup record-bound audits must mark PHI touched');
assert(orderLookupSource.includes("match: 'email_and_phone'"), 'Order lookup success audit must record contact match mode without contact values');
assert(orderLookupSource.includes("result: 'contact_mismatch'"), 'Order lookup denied audit must record mismatch result');
assert(orderLookupSource.includes('safeLogContext'), 'Order lookup database failures must sanitize logs');
assert(!orderLookupSource.includes('email: email,') && !orderLookupSource.includes('phone: phone,'), 'Order lookup audit payloads must not store raw submitted email or phone values');
assert(!orderLookupSource.includes('email: record.customer_email') && !orderLookupSource.includes('phone: record.customer_phone'), 'Order lookup audit payloads must not store raw record email or phone values');
assert(!orderLookupSource.includes('json({ error: err.message'), 'Order lookup must not return raw database error messages');
assert(rateLimitSource.includes('safeLogContext'), 'Rate-limit backend fallback logs must use sanitized error context');
assert(!rateLimitSource.includes("err?.message"), 'Rate-limit backend fallback must not log raw provider error messages');
for (const kvEnv of ['KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
  assert(envExampleSource.includes(kvEnv), `.env.example must document production rate-limit env ${kvEnv}`);
  assert(authSetupSource.includes(kvEnv), `Auth setup must document production rate-limit env ${kvEnv}`);
  assert(goLiveStatusSource.includes(kvEnv), `Go-live status must track production rate-limit env ${kvEnv}`);
}
for (const optionalRuntimeEnv of [
  'SUPABASE_ANON_KEY',
  'VITE_APP_VERSION',
  'VITE_HUBSPOT_CONFIGURED',
  'VITE_AVALON_DEMO_AUTH',
  'VITE_SENTRY_DSN',
]) {
  assert(envExampleSource.includes(optionalRuntimeEnv), `.env.example must document optional runtime env ${optionalRuntimeEnv}`);
  assert(prodEnvChecklistSource.includes(`\`${optionalRuntimeEnv}\``), `Production env checklist must document optional runtime env ${optionalRuntimeEnv}`);
}
assert(goLiveStatusSource.includes('GL-015') && goLiveStatusSource.includes('Rate-limit backend'), 'Go-live status must track persistent rate-limit backend readiness');
assert(manageOrderSource.includes('id="order-email"') && manageOrderSource.includes('id="order-phone"'), 'Manage order form must collect both email and phone');
assert(loginPageSource.includes('safeLoginRedirectPath'), 'Login page must sanitize redirect parameters through one helper');
assert(loginPageSource.includes("new URL(value, 'https://avalon.local')"), 'Login redirect sanitizer must parse redirects as local URLs');
assert(loginPageSource.includes("url.origin !== 'https://avalon.local'"), 'Login redirect sanitizer must reject external origins');
assert(loginPageSource.includes('decodedPath.includes(\':\')'), 'Login redirect sanitizer must reject scheme-like paths');
assert(sendSmsSource.includes('SEND_SMS_MAX_BODY_BYTES'), 'SMS auth hook must enforce a raw body size limit');
assert(sendSmsSource.includes('send_sms_body_too_large'), 'SMS auth hook must reject oversized raw bodies explicitly');
assert(sendSmsSource.includes("key: `send-sms:${clientIp(req)}`"), 'SMS auth hook must rate-limit by requester IP');
assert(sendSmsSource.includes('status: resp.status') && sendSmsSource.includes('SMS provider send failed'), 'SMS auth hook must avoid echoing provider response details');
assert(sendSmsSource.includes('safeLogContext'), 'SMS auth hook must sanitize provider request error logs');
assert(!sendSmsSource.includes('err?.message'), 'SMS auth hook must not log raw provider request error messages');
assert(!sendSmsSource.includes('secretPrefix'), 'SMS auth hook must not log webhook secret prefixes');
assert(safeErrorSource.includes('safeErrorCode') && safeErrorSource.includes('safeLogContext'), 'Server routes must have shared safe error helpers');
for (const [label, source] of Object.entries({ auditEventsSource, reconciliationSource })) {
  assert(source.includes('safeLogContext'), `Shared persistence helper must sanitize insert-failure logs: ${label}`);
  assert(source.includes('safeErrorCode'), `Shared persistence helper must return stable insert-failure codes: ${label}`);
  assert(!source.includes("err.message);"), `Shared persistence helper must not log raw insert-failure messages: ${label}`);
  assert(!source.includes('return { error: err.message }'), `Shared persistence helper must not return raw insert-failure messages: ${label}`);
}
for (const [label, source] of Object.entries({ applySource, waitlistSource })) {
  assert(source.includes('safeLogContext'), `Public form route must sanitize provider/handler logs: ${label}`);
  assert(!source.includes('.error.message ||'), `Public form route must not log raw email provider messages: ${label}`);
  assert(!source.includes('err.message || err'), `Public form route must not log raw caught email errors: ${label}`);
  assert(!source.includes("handler error:', error"), `Public form route must not log raw handler errors: ${label}`);
  assert(source.includes("return res.status(502).json({ error: '"), `Public form route must fail closed when required internal notification fails: ${label}`);
}
for (const [label, source] of Object.entries({ serverAnalyticsSource, reverseGeocodeSource, eventPresaleSource })) {
  assert(source.includes('safeLogContext'), `Public/request-context route must sanitize error logs: ${label}`);
  assert(!source.includes('console.warn') || !source.includes('err.message || err'), `Public/request-context route must not warn raw errors: ${label}`);
  assert(!source.includes("console.error('[reverse-geocode]', err.message"), `Reverse geocode must not log raw lookup errors: ${label}`);
  assert(!source.includes("console.error('[event-presale]', err.message"), `Presale ingress must not log raw scheduling errors: ${label}`);
}
assert(!reverseGeocodeSource.includes("data?.error || 'Address lookup failed'"), 'Reverse geocode must not echo upstream provider error text');
assert(!eventPresaleSource.includes('response.scheduleError = err.message'), 'Presale ingress must not return raw scheduling errors');
assert(!eventPresaleSource.includes('&email='), 'Presale redemption links must not put email in URLs');
assert(!eventPresaleSource.includes('&name='), 'Presale redemption links must not put names in URLs');
assert(!eventPresaleSource.includes('&phone='), 'Presale redemption links must not put phone numbers in URLs');
assert(!eventPresaleSource.includes('encodeURIComponent(email)'), 'Presale redemption links must not encode email into URLs');
assert(!eventPresaleSource.includes('encodeURIComponent(phone)'), 'Presale redemption links must not encode phone into URLs');
assert(eventPresaleSource.includes('const liveApi = isLiveApiEnabled()'), 'Presale ingress must evaluate live API mode before auth checks');
assert(eventPresaleSource.includes('event_presale_secret_missing'), 'Live presale ingress must fail closed when webhook secret is missing');
assert(eventPresaleSource.includes('if (liveApi && !secret)'), 'Live presale ingress must require a configured webhook secret');
assert(eventPresaleSource.includes('header !== `Bearer ${secret}`'), 'Presale ingress must require the bearer webhook secret when configured');
assert(eventPresaleSource.includes('if (!liveApi)'), 'Presale ingress must only use local queued scheduling in pre-API mode');
for (const queryField of ["query.get('name')", "query.get('email')", "query.get('phone')"]) {
  assert(!eventPresalePageSource.includes(queryField), `Presale page must not prefill contact data from URLs: ${queryField}`);
}
for (const [label, source] of Object.entries({ acuityTestSource, hubspotTestSource, hubspotUpsertSource })) {
  assert(source.includes('requireAdmin'), `Live integration diagnostic route must require admin auth: ${label}`);
  assert(source.includes('safeLogContext'), `Live integration diagnostic route must sanitize error logs: ${label}`);
  assert(source.includes('safeErrorCode'), `Live integration diagnostic route must return stable error codes: ${label}`);
  assert(!source.includes("console.error('[acuity/test]', err.message"), `Acuity connection test must not log raw provider errors: ${label}`);
  assert(!source.includes("console.error('[hubspot/test]', err.message"), `HubSpot connection test must not log raw provider errors: ${label}`);
  assert(!source.includes("console.error('[hubspot/upsert-contact]', err.message"), `HubSpot upsert route must not log raw provider errors: ${label}`);
  assert(!source.includes('error: err.message'), `Live integration diagnostic route must not return raw provider errors: ${label}`);
}
assert(stripeTestSource.includes('requireAdmin'), 'Stripe integration diagnostic route must require admin auth in live mode');
assert(stripeTestSource.includes('isLiveApiEnabled'), 'Stripe integration diagnostic route must keep the pre-API hard wall');
assert(!stripeTestSource.includes('STRIPE_SECRET_KEY:') && !stripeTestSource.includes('process.env.STRIPE_SECRET_KEY,'), 'Stripe integration diagnostic route must never return secret values');
assert(hubspotPlaceholderSource.includes('apiGet') && hubspotPlaceholderSource.includes('apiPost'), 'HubSpot admin client helper must attach Supabase auth to integration calls');
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
assert(viteConfigSource.includes('redactDemoPasswordPlugin'), 'Vite build must redact demo password from launch-sensitive bundles');
assert(viteConfigSource.includes('VITE_AVALON_DEMO_PASSWORD:""'), 'Live API build redaction must blank the demo password env key');
assert(privateAuthTriggerMigrationSource.includes('function app_private.handle_new_user()'), 'Auth profile trigger must live in the private schema');
assert(privateAuthTriggerMigrationSource.includes('drop function if exists public.handle_new_user()'), 'Auth profile trigger migration must remove the public security definer function');
assert(privateAuthTriggerMigrationSource.includes('revoke execute on function app_private.handle_new_user() from authenticated'), 'Private auth trigger must not be directly executable by authenticated API roles');
assert(!messagingBaseMigrationSource.includes('cp.conversation_id = conversation_id'), 'Base messaging RLS must not compare participant rows to their own conversation_id');
assert(messagingBaseMigrationSource.includes('cp.conversation_id = conversations.id'), 'Conversation RLS must qualify the outer conversation id');
assert(messagingBaseMigrationSource.includes('cp.conversation_id = conversation_participants.conversation_id'), 'Participant-list RLS must qualify the outer participant conversation id');
assert(messagingBaseMigrationSource.includes('cp.conversation_id = messages.conversation_id'), 'Message RLS must qualify the outer message conversation id');
assert(launchMessagingMigrationSource.includes("app_private.profile_role() in ('admin', 'client', 'nurse')"), 'Messaging RLS must allow launch client/admin/nurse conversation creation');
assert(launchMessagingMigrationSource.includes("app_private.profile_role() = 'client'"), 'Messaging RLS must support client-started support conversations');
assert(launchMessagingMigrationSource.includes("role in ('admin', 'nurse')"), 'Messaging support directory must target launch nurse/admin roles');
assert(!launchMessagingMigrationSource.includes("'provider'"), 'Messaging launch RLS must not depend on the retired provider role');
assert(!launchMessagingMigrationSource.includes("'rn'"), 'Messaging launch RLS must not grant the retired RN alias directly');
assert(messagingPanelSource.includes("? ['admin', 'nurse']"), 'Client message picker must target launch support roles');
assert(messagingPanelSource.includes("? ['client', 'nurse']"), 'Admin message picker must target client/nurse launch roles');
assert(messagingPanelSource.includes(".select('id, full_name, role')"), 'Message picker must avoid selecting support emails for the contact directory');
assert(!messagingPanelSource.includes("['admin', 'provider']"), 'Message picker must not target retired provider contacts');
assert(!useMessagesSource.includes('admin/provider'), 'Messaging hook copy must not describe retired provider-only behavior');
assert(!useMessagesSource.includes('setError(err.message)'), 'Messaging hook must not render raw Supabase errors');
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
assert(acuityWebhookSource.includes('ACUITY_WEBHOOK_MAX_BODY_BYTES'), 'Acuity webhook must enforce a payload size limit');
assert(acuityWebhookSource.includes('acuity_webhook_body_too_large'), 'Acuity webhook must reject oversized payloads explicitly');
assert(acuityWebhookSource.includes('ACUITY_WEBHOOK_FETCH_TIMEOUT_MS'), 'Acuity webhook must bound external appointment fetch latency');
assert(acuityWebhookSource.includes("withTimeout(getAppointment(apptId), 'acuity appointment fetch')"), 'Acuity webhook must wrap appointment fetch in a timeout');
assert(acuityWebhookSource.includes('safeLogContext'), 'Acuity webhook must sanitize error log context');
assert(!acuityWebhookSource.includes("console.error('[acuity/webhook] fetch appt failed:', err.message"), 'Acuity webhook must not log raw appointment fetch errors');
assert(!acuityWebhookSource.includes("console.warn('[acuity/webhook] HubSpot sync failed:', e.message"), 'Acuity webhook must not log raw HubSpot errors');
assert(acuityWebhookSource.includes("caseType: 'crm_sync_failed'"), 'Acuity webhook HubSpot failures must create a reconciliation case');
assert(acuityWebhookSource.includes("provider: 'hubspot'"), 'Acuity webhook CRM reconciliation must identify HubSpot as the provider');
assert(acuityWebhookSource.includes("errorCode: safeErrorCode(e, 'hubspot_sync_failed')"), 'Acuity webhook CRM reconciliation must store stable error codes');
assert(!acuityWebhookSource.includes('ok: false, error: err.message'), 'Acuity webhook must not return raw unhandled errors');
assert(!acuityWebhookSource.includes('error_message: err.message'), 'Acuity webhook must not persist raw appointment fetch errors');
assert(!acuityWebhookSource.includes('error: err.message'), 'Acuity webhook reconciliation payloads must use stable error codes');
assert(acuitySource.includes('no explicit appointment type match found'), 'Acuity live type resolver must not silently choose an unrelated type');
assert(!acuitySource.includes('using first active Acuity type'), 'Acuity live type resolver must not fall back to the first active type');
assert(acuitySource.includes('process.env.VERCEL || process.env.VERCEL_ENV'), 'Acuity credentials must fail loud in any Vercel runtime, not only Vercel production');
assert(acuitySource.includes('ACUITY_USER_ID + ACUITY_API_KEY are required'), 'Acuity missing-credential failure must be explicit');
const acuityTypeEnvRefs = new Set(`${acuitySource}\n${frontendAcuityTypesSource}\n${envExampleSource}`.match(/\b(?:VITE_)?ACUITY_TYPE_[A-Z0-9_]+\b/g) || []);
for (const envName of acuityTypeEnvRefs) {
  assert(acuityTypesDocSource.includes(`\`${envName}\``), `docs/ACUITY_TYPES.md must map ${envName}`);
}
assert(stripeWebhookSource.includes('STRIPE_WEBHOOK_MAX_BODY_BYTES'), 'Stripe webhook must enforce a raw body size limit');
assert(stripeWebhookSource.includes('webhook_body_too_large'), 'Stripe webhook must reject oversized raw bodies explicitly');
assert(stripeWebhookSource.includes('STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS'), 'Stripe webhook must enforce a processing timeout');
assert(stripeWebhookSource.includes("caseType: 'webhook_missed'"), 'Stripe webhook timeout must create a reconciliation case');
assert(stripeWebhookSource.includes("action: 'duplicate_already_processed'"), 'Stripe webhook duplicate acknowledgements must log a structured result');
assert(stripeWebhookSource.includes("action: 'processing_timeout'"), 'Stripe webhook timeout acknowledgements must log a structured result');
assert(stripeWebhookSource.includes("action: 'processing_error'"), 'Stripe webhook error acknowledgements must log a structured result');
assert(stripeWebhookSource.includes('acuity_missing_appointment_id'), 'Stripe webhook fulfillment must fail closed when Acuity returns no appointment id');
assert(checkoutVerifySource.includes('acuity_missing_appointment_id'), 'Checkout verify fulfillment must fail closed when Acuity returns no appointment id');
assert(checkoutFulfillmentSource.includes('export async function createDeferredPlanSubscription'), 'Deferred plan subscription creation must live in the shared checkout fulfillment module');
assert(stripeWebhookSource.includes('createDeferredPlanSubscription'), 'Stripe webhook must create the deferred plan subscription after Acuity succeeds');
assert(checkoutVerifySource.includes('createDeferredPlanSubscription'), 'Checkout verify must create the deferred plan subscription when it wins the scheduling race');
assert(verifyBookingToAcuitySource.includes('Plan webhook + checkout verify race'), 'Booking-to-Acuity verifier must exercise the plan webhook/checkout-verify race');
assert(verifyBookingToAcuitySource.includes('planSubscriptionId'), 'Booking-to-Acuity verifier must assert the plan race persists a subscription id');
assert(!stripeWebhookSource.includes('fulfillmentError.body'), 'Stripe webhook must not persist raw fulfillment response bodies');
assert(!stripeWebhookSource.includes('fulfillmentError: fulfillmentError.message.slice'), 'Stripe webhook must not write raw fulfillment errors into Stripe metadata');
for (const rawPersistedError of [
  "error: err.message || 'HubSpot sync failed'",
  "error: err.message || 'Payment operations email failed'",
  "error: err.message || 'Customer pending email failed'",
  'message: fulfillmentError.message',
  'error: fulfillmentError.message',
  'error: err.message',
]) {
  assert(!stripeWebhookSource.includes(rawPersistedError), `Stripe webhook must not persist raw operational errors: ${rawPersistedError}`);
}
assert(stripeWebhookSource.includes("fulfillmentIssue: 'appointment_confirmation_pending'"), 'Stripe webhook must write customer-safe fulfillment issue codes');
assert(stripeWebhookSource.includes('scheduling_lock_at:            fulfillmentError ? null : undefined'), 'Stripe webhook must release the scheduling lock after a persisted Acuity failure');
assert(stripeWebhookSource.includes('safeLogContext'), 'Stripe webhook must sanitize fulfillment error log context');
assert(!stripeWebhookSource.includes("console.error('[stripe/webhook] Acuity fulfillment failed:', err.message"), 'Stripe webhook must not log raw Acuity fulfillment errors');
assert(!stripeWebhookSource.includes("console.warn('[stripe/webhook] HubSpot sync failed:', err.message"), 'Stripe webhook must not log raw HubSpot errors');
assert(!stripeWebhookSource.includes("error: err.message || 'Invalid Stripe webhook'"), 'Stripe webhook must not return raw invalid-webhook errors');
assert(!stripeWebhookSource.includes('persisted: false, error: err.message'), 'Stripe webhook must not return raw processing errors');
assert(hubspotSource.includes('ALLOWED_HUBSPOT_PROPERTIES'), 'HubSpot CRM payload must use an explicit allowlist');
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
const dashboardPathSource = navbarSource.slice(
  navbarSource.indexOf('const dashboardPathFor'),
  navbarSource.indexOf('export default function Navbar')
);
assert(dashboardPathSource.includes("user.role === 'nurse'"), 'Navbar dashboard redirect must recognize the launch nurse role');
for (const retiredRole of ["'provider'", "'np'", "'physician'"]) {
  assert(!dashboardPathSource.includes(retiredRole), `Navbar dashboard redirect must not route retired role ${retiredRole}`);
}
const adminNavSource = adminLayoutSource.slice(
  adminLayoutSource.indexOf('const NAV'),
  adminLayoutSource.indexOf('const BOTTOM_TAB_COUNT')
);
assert(adminNavSource.includes("roles: ['nurse']"), 'Admin layout must expose provider navigation to the launch nurse role');
for (const retiredRole of ["'provider'", "'np'", "'physician'", "'superadmin'"]) {
  assert(!adminNavSource.includes(retiredRole), `Admin layout launch nav must not include retired role ${retiredRole}`);
}
const roleBadgeSource = adminLayoutSource.slice(
  adminLayoutSource.indexOf('const ROLE_BADGE'),
  adminLayoutSource.indexOf('const EASE')
);
assert(roleBadgeSource.includes("nurse:      'Nurse'"), 'Admin layout role badge must label the launch nurse role');
for (const retiredRole of ['provider:', 'np:', 'physician:', 'superadmin:']) {
  assert(!roleBadgeSource.includes(retiredRole), `Admin layout role badge must not include retired role ${retiredRole}`);
}
assert(providerRoleOsSource.includes("const role = normalize(user?.role || 'nurse')"), 'Provider RoleOS must default to the launch nurse role');
assert(providerRoleOsSource.includes("const canClear = ['admin', 'nurse'].includes(role)"), 'Provider RoleOS clearance must fold into the launch nurse role');
assert(!providerRoleOsSource.includes("['admin', 'np', 'physician']"), 'Provider RoleOS must not require retired prescriber roles for clearance');
assert(communicationCenterSource.includes("const isAdmin = role === 'admin'"), 'Communication center admin checks must match launch admin role');
assert(!communicationCenterSource.includes("role === 'admin' || role === 'superadmin'"), 'Communication center must not include retired superadmin role');
assert(communicationCenterSource.includes("role === 'nurse' ? 'nurse' : 'all'"), 'Communication announcement defaults must target the launch nurse role');
assert(communicationCenterSource.includes('<option value="nurse">Nurses</option>'), 'Communication announcement audience must use the launch nurse role value');
assert(!communicationCenterSource.includes("role === 'provider' ? 'provider' : 'all'"), 'Communication announcements must not default to retired provider audience');
assert(!communicationCenterSource.includes('<option value="provider">Nurses</option>'), 'Communication announcements must not use retired provider audience values');
assert(communicationHookSource.includes("role === 'nurse' ? 'Dispatch' : 'Operations'"), 'Communication hook must treat launch nurse as the field sender');
assert(!communicationHookSource.includes("role === 'provider' ?"), 'Communication hook must not branch on retired provider role');
assert(!platformOpsSource.includes("role === 'admin' || role === 'superadmin'"), 'Platform communications must not include retired superadmin read paths');
assert(!platformOpsSource.includes("audience: ['admin', 'provider'"), 'Default platform communications must not publish to retired provider audiences');
assert(!platformOpsSource.includes("'admin,provider'"), 'Default platform communication strings must not target retired provider audiences');
assert(!platformOpsSource.includes("alertAudience: item.kind === 'incident' ? 'admin,provider,clinical' : 'admin,provider'"), 'Comms escalation sweep must not alert retired provider audiences');
assert(!platformOpsSource.includes("['admin', 'provider', 'np', 'clinical']"), 'GFE routing alerts must target launch nurse role instead of retired provider/NP roles');
assert(providerCommunicationsSource.includes("const isNurse = user?.role === 'nurse'"), 'Provider communications page must recognize the launch nurse role');
assert(!providerCommunicationsSource.includes("user?.role === 'provider'"), 'Provider communications page must not branch on retired provider role');
assert(!localRepositorySource.includes("role === 'provider'"), 'Local repository role visibility must not map retired provider role');
assert(!localRepositorySource.includes("role === 'np' || role === 'physician'"), 'Local repository role visibility must not map retired prescriber roles');
assert(preApiGuardSource.includes('AVALON_ENABLE_LIVE_API'), 'Server live API guard must support the server live flag');
assert(preApiGuardSource.includes('VITE_AVALON_ENABLE_LIVE_API'), 'Server live API guard must recognize the production browser live flag');

const customerPendingEmailSource = bookingEmailSource.slice(
  bookingEmailSource.indexOf('export async function sendCustomerPaymentPendingEmail'),
);
const customerPendingEmailContentSource = customerPendingEmailSource.slice(
  customerPendingEmailSource.indexOf('const html ='),
  customerPendingEmailSource.indexOf('const result ='),
);
for (const forbiddenCustomerEmailNeedle of [
  'sessionId',
  'paymentIntentId',
  'acuityAppointmentId',
  'fulfillmentStatus',
  'appointment.address',
  'appointment.zip',
  'amounts.balanceDueCents',
  'amounts.depositAmountCents',
  'Stripe session',
  'PaymentIntent',
  'Clinical',
  'GFE',
  'error',
]) {
  assert(!customerPendingEmailContentSource.includes(forbiddenCustomerEmailNeedle), `Customer pending email must not include internal/PHI detail: ${forbiddenCustomerEmailNeedle}`);
}
assert(customerPendingEmailContentSource.includes('appointment details') && customerPendingEmailContentSource.includes('registered nurse will follow up shortly'), 'Customer pending email must keep customer-safe confirmation copy');
assert(checkoutVerifySource.includes("fulfillmentStatus === 'acuity_failed'"), 'checkout/verify must send customer pending email only after Acuity fulfillment failure');
assert(stripeWebhookSource.includes('if (fulfillmentError && paymentIntentId'), 'Stripe webhook must send customer pending email only after fulfillment error');

const originalResendKey = process.env.RESEND_API_KEY;
const originalResendFrom = process.env.RESEND_FROM_EMAIL;
const originalNodeEnv = process.env.NODE_ENV;
delete process.env.RESEND_API_KEY;
for (const [label, fn] of [
  ['operations', () => sendPaymentReceivedEmail({ appointmentRecordId: 'smoke-test' })],
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

process.env.RESEND_API_KEY = originalResendKey || 'smoke_resend_key';
delete process.env.RESEND_FROM_EMAIL;
process.env.NODE_ENV = 'production';
for (const [label, fn] of [
  ['invite', () => sendInviteEmail({ to: 'invite@example.test', inviteUrl: 'https://example.test/invite', code: '123456', role: 'staff' })],
  ['operations', () => sendPaymentReceivedEmail({ appointmentRecordId: 'smoke-test' })],
  ['customer', () => sendCustomerPaymentPendingEmail({ checkout: { contact: { email: 'client@example.com' } } })],
]) {
  let rejected = false;
  try {
    await fn();
  } catch (err) {
    rejected = err?.code === 'resend_from_email_missing' && err?.status === 500;
  }
  assert(rejected, `${label} email must fail closed when RESEND_FROM_EMAIL is missing in production`);
}

if (originalResendKey) process.env.RESEND_API_KEY = originalResendKey;
else delete process.env.RESEND_API_KEY;
if (originalResendFrom) process.env.RESEND_FROM_EMAIL = originalResendFrom;
else delete process.env.RESEND_FROM_EMAIL;
if (originalNodeEnv) process.env.NODE_ENV = originalNodeEnv;
else delete process.env.NODE_ENV;

console.log('Smoke tests passed.');
