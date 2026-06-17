/**
 * safeStripeMetadata — HIPAA route-around guard for Stripe metadata.
 *
 * Stripe does NOT sign a BAA with Avalon. To keep using Stripe under HIPAA we
 * must guarantee PHI never enters Stripe's API surface: not in `metadata`, not
 * in `description`, not in `line_items[].price_data.product_data.metadata`,
 * not in `payment_intent_data.metadata`, not in receipts.
 *
 * This module is the single chokepoint every Stripe metadata write must pass
 * through. It enforces:
 *
 *   1. Whitelist of allowed keys. Anything not on the list is dropped — even
 *      if its value happens to be harmless today, the schema can change.
 *   2. Deny-pattern on key names. A key whose name even *looks* PHI-shaped is
 *      refused (belt-and-suspenders against typos like `Dob`, `Address1`, etc.)
 *   3. 500-char cap per Stripe's metadata limit.
 *
 * Adding a key to STRIPE_METADATA_ALLOWED_KEYS REQUIRES a PHI review: the
 * value must never contain DOB, address, allergies, medications, intake notes,
 * GFE answers, emergency contact, clinical notes, or any other identifiable
 * health information. Confirm with a maintainer before adding.
 *
 * See docs/PHI_DATA_FLOW.md and tests/no-phi-in-stripe.test.js.
 */

const STRIPE_METADATA_ALLOWED_KEYS = new Set([
  // Routing + reconciliation
  'fulfillment',
  'appointmentRecordId',
  'idempotencyKey',
  'tenantId',
  // Payment shape (amounts + flow)
  'paymentMethod',
  'depositType',
  'visitSubtotalCents',
  'depositAmountCents',
  'balanceDueCents',
  // Catalog-level: generic product labels (NAD+, Vitamin D, etc.). These exist
  // outside healthcare contexts and are not patient-specific, so they're safe.
  'service',
  'itemLabels',
  'itemKeys',
  'itemTypes',
  // Scheduling routing — operational IDs that Stripe cannot decode into PHI
  'acuityTypeId',
  'guests',
  'locationType',
  'orderType',
  'paymentType',
  'peopleCount',
  // Membership / plan recurring
  'membershipName',
  'membershipBilling',
  'planSignup',
  'planName',
  'planMonthlyPriceCents',
  'planFirstVisitDate',
  'stripeCheckoutSessionId',
  // Fulfillment-state breadcrumbs written back to PaymentIntent metadata
  'kind',
  'opsPaymentEmailSent',
  'customerPaymentPendingEmailSent',
  'acuityAppointmentId',
  'fulfillmentStatus',
  'fulfillmentIssue',
  'fulfillmentError',
]);

const STRIPE_METADATA_DENY_PATTERNS = [
  /dob/i,
  /birth/i,
  /address/i,
  /\bzip\b/i,
  /allerg/i,
  /medication/i,
  /intake/i,
  /\bgfe\b/i,
  /emergency/i,
  /clinical/i,
  /condition/i,
  /\bnotes?\b/i,
  /diagnos/i,
  /symptom/i,
  /manifest/i,
];

const STRIPE_METADATA_VALUE_MAX = 500;

export function safeStripeMetadata(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const [key, raw] of Object.entries(input)) {
    if (raw === null || raw === undefined || raw === '') continue;
    if (!STRIPE_METADATA_ALLOWED_KEYS.has(key)) continue;
    if (STRIPE_METADATA_DENY_PATTERNS.some((re) => re.test(key))) continue;
    const value = typeof raw === 'string' ? raw : String(raw);
    out[key] = value.length > STRIPE_METADATA_VALUE_MAX
      ? value.slice(0, STRIPE_METADATA_VALUE_MAX)
      : value;
  }
  return out;
}

export const __testing = {
  STRIPE_METADATA_ALLOWED_KEYS,
  STRIPE_METADATA_DENY_PATTERNS,
};
