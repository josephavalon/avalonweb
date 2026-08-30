/**
 * Patient-portal subscription plan map.
 *
 * The portal's UI uses three canonical tier ids — essentials, vitality,
 * concierge — that don't 1:1 match the legacy MEMBERSHIP_PRICE_BY_NAME keys
 * (starter/pro/premium/vip). We resolve to a monthly Stripe price by mapping
 * the portal id to an env override first, falling back to a hard-coded dollar
 * amount that matches the UI tiles in app-modules/pages/members/Memberships.jsx.
 *
 * Strategy: mirror api/_checkout-fulfillment.js#createDeferredPlanSubscription
 * — build the recurring price inline via `price_data` against a freshly
 * created product so we don't need pre-provisioned Stripe Price IDs to ship.
 * An ops env override per tier (STRIPE_PRICE_ID_ESSENTIALS etc.) is honoured
 * if set so we can swap to canonical Stripe prices later without a code change.
 */

import Stripe from 'stripe';
import { safeStripeMetadata } from '../_lib/safe-stripe.js';
import { calculateCustomPlanQuote } from '../../src/lib/customPlanPricing.js';

export const PORTAL_PLAN_MAP = {
  essentials: {
    id: 'essentials',
    displayName: 'Essentials',
    monthlyDollars: 95,
    envPriceVar: 'STRIPE_PRICE_ID_ESSENTIALS',
  },
  vitality: {
    id: 'vitality',
    displayName: 'Vitality',
    monthlyDollars: 200,
    envPriceVar: 'STRIPE_PRICE_ID_VITALITY',
  },
  concierge: {
    id: 'concierge',
    displayName: 'Concierge',
    monthlyDollars: 425,
    envPriceVar: 'STRIPE_PRICE_ID_CONCIERGE',
  },
};

export function resolvePortalPlan(targetPlan) {
  const key = String(targetPlan || '').trim().toLowerCase();
  return PORTAL_PLAN_MAP[key] || null;
}

/**
 * Recurring-interval mapping for a custom plan's billing term. MUST mirror
 * api/_checkout-fulfillment.js#planRecurringInterval so a self-serve change
 * keeps the same cadence the signup subscription was created with:
 *   monthly      → { interval: 'month' }
 *   three-month  → { interval: 'month', interval_count: 3 }
 *   six-month    → { interval: 'month', interval_count: 6 }
 *   annual       → { interval: 'year' }
 */
export function customPlanRecurringInterval(billing) {
  switch (String(billing || '').trim().toLowerCase()) {
    case 'annual': return { interval: 'year' };
    case 'six-month': return { interval: 'month', interval_count: 6 };
    case 'three-month': return { interval: 'month', interval_count: 3 };
    default: return { interval: 'month' };
  }
}

/**
 * Build a custom plan from its allowlisted therapy/add-on manifest before auth
 * or Stripe is touched. The browser never chooses `monthlyCents`; that legacy
 * property below is populated exclusively from the canonical server quote and
 * retained only because resolveTargetPrice already consumes that name.
 */
export function normalizeCustomPlan(custom = {}) {
  const quote = calculateCustomPlanQuote({
    ...(custom && typeof custom === 'object' ? custom : {}),
    plan: custom?.plan,
    billing: custom?.term || custom?.billing,
  });
  return {
    custom: true,
    id: 'custom',
    monthlyCents: quote.periodPriceCents,
    monthlyPriceCents: quote.monthlyPriceCents,
    recurringPriceCents: quote.periodPriceCents,
    visitsPerCycle: quote.visitsPerCycle,
    peopleCount: quote.peopleCount,
    sessionsPerPerson: quote.sessionsPerPerson,
    billing: quote.billing,
    term: quote.term,
    displayName: quote.displayName,
    planName: quote.planName,
    plan: quote.plan,
    quote,
  };
}

/**
 * Resolve the Stripe price (id) for a portal plan. If env var is set, return
 * { priceId }. Otherwise create (or reuse) a product and return { priceData }
 * suitable for subscriptions.create({ items: [{ price_data }] }) and
 * subscriptions.update({ items: [{ price_data }] }).
 *
 * Stripe accepts price_data on subscription items, so we can ship without
 * pre-provisioned Price IDs and still let ops swap in real Prices later.
 */
export async function resolveTargetPrice(stripe, plan) {
  // ── Custom-priced plan branch ────────────────────────────────────────────
  // Signup creates custom subscriptions (inline price_data plus visit credits).
  // A custom-plan member changing their plan can't map onto the 3 fixed tiers,
  // so we build a fresh inline price here from the server-derived recurring
  // period amount. Cadence mirrors fulfillment at signup.
  if (plan.custom) {
    const monthlyCents = Math.round(plan.monthlyCents);
    const recurring = customPlanRecurringInterval(plan.billing);
    const product = await stripe.products.create(
      {
        name: plan.displayName || 'Custom Plan',
        metadata: safeStripeMetadata({ kind: 'plan_recurring' }),
      },
      // Idempotent per price+cadence so retries don't spawn duplicate products.
      { idempotencyKey: `portal-custom-product:${monthlyCents}:${recurring.interval}:${recurring.interval_count || 1}` },
    );
    return {
      priceData: {
        currency: 'usd',
        product: product.id,
        unit_amount: monthlyCents,
        recurring,
      },
    };
  }

  const envId = (process.env[plan.envPriceVar] || '').trim();
  if (envId) return { priceId: envId };

  const monthlyCents = Math.round(plan.monthlyDollars * 100);
  const product = await stripe.products.create(
    {
      name: `${plan.displayName} Plan`,
      metadata: safeStripeMetadata({ kind: 'plan_recurring', portalPlanId: plan.id }),
    },
    { idempotencyKey: `portal-plan-product:${plan.id}:${monthlyCents}` },
  );
  return {
    priceData: {
      currency: 'usd',
      product: product.id,
      unit_amount: monthlyCents,
      recurring: { interval: 'month' },
    },
  };
}

/** Build the items[] update body for stripe.subscriptions.update. */
export function subscriptionItemsPatch({ itemId, resolved }) {
  if (resolved.priceId) {
    return [{ id: itemId, price: resolved.priceId }];
  }
  return [{ id: itemId, price_data: resolved.priceData }];
}

/** Build the subscription_items[] body for stripe.invoices.retrieveUpcoming. */
export function upcomingInvoiceItems({ itemId, resolved }) {
  if (resolved.priceId) {
    return [{ id: itemId, price: resolved.priceId }];
  }
  return [{ id: itemId, price_data: resolved.priceData }];
}

// Re-export Stripe so callers don't double-import; keeps the API files focused.
export { Stripe };
