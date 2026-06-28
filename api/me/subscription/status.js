/**
 * GET /api/me/subscription/status
 *
 * Returns the member's REAL current plan, read live from Stripe, so the portal
 * Memberships page can stop rendering hardcoded stubs ($200 / Jul 8 / Visa
 * 4242). Shape (all money in dollars):
 *
 *   {
 *     hasPlan: boolean,
 *     name: string,                 // plan/product name, e.g. "Custom Plan"
 *     priceDollars: number,         // recurring unit_amount / 100
 *     billing: 'monthly'|'three-month'|'six-month'|'annual',
 *     visitsPerCycle: number,       // from subscription.metadata.visits_per_cycle
 *     status: string,               // Stripe subscription.status
 *     nextChargeIso: string|null,   // current_period_end
 *     nextChargeAmountDollars: number, // the recurring price (best estimate)
 *     defaultPaymentMethod: { brand, last4 } | null,
 *     cancelAtPeriodEnd: boolean,
 *   }
 *
 * Uses the same auth + customer + active-subscription primitives the
 * change/pause/cancel endpoints share (api/me/subscription/_helpers.js), but
 * composes them directly so a member with no plan gets a clean { hasPlan:false }
 * instead of a 404.
 */

import Stripe from 'stripe';
import { getAuthedUser } from '../../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { resolveCustomerId, findActiveSubscription } from './_helpers.js';

// Invert the recurring interval back to the builder's billing-term vocabulary.
// Mirrors api/_checkout-fulfillment.js#planRecurringInterval and
// api/me/_subscription-plans.js#customPlanRecurringInterval (year → annual,
// month×6/3 → six-/three-month, plain month → monthly).
function billingFromRecurring(recurring = {}) {
  const interval = recurring.interval;
  const count = Number(recurring.interval_count || 1);
  if (interval === 'year') return 'annual';
  if (interval === 'month' && count === 6) return 'six-month';
  if (interval === 'month' && count === 3) return 'three-month';
  return 'monthly';
}

function dollarsFromCents(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_secret_missing' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });

  try {
    const customerId = await resolveCustomerId(authed.db, {
      userId: authed.user.id,
      email: authed.email,
      tenantId: authed.tenantId,
    });
    if (!customerId) {
      return res.status(200).json({ hasPlan: false });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const found = await findActiveSubscription(stripe, customerId);
    if (!found) {
      return res.status(200).json({ hasPlan: false });
    }
    const { subscription, item } = found;
    const price = item.price || {};

    // Plan name: prefer the metadata planName written at signup/change, then
    // the Stripe product name, then a generic fallback.
    let productName = '';
    const product = price.product;
    if (product && typeof product === 'object' && product.name) {
      productName = product.name;
    }
    const name =
      (subscription.metadata && subscription.metadata.planName) ||
      productName ||
      'Avalon Plan';

    const recurring = price.recurring || {};
    const billing = billingFromRecurring(recurring);
    const priceDollars = dollarsFromCents(price.unit_amount);
    const visitsPerCycle = Math.max(
      1,
      Math.floor(Number(subscription.metadata?.visits_per_cycle) || 1),
    );

    // Default payment method — read the customer's invoice-settings default,
    // falling back to the subscription's own default. expand() pulls the card
    // brand/last4 without a second round trip.
    let defaultPaymentMethod = null;
    try {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      let pm = customer && !customer.deleted
        ? customer.invoice_settings?.default_payment_method
        : null;
      // Subscription-level default takes precedence when set explicitly.
      if (subscription.default_payment_method && typeof subscription.default_payment_method === 'object') {
        pm = subscription.default_payment_method;
      }
      if (pm && pm.card) {
        defaultPaymentMethod = { brand: pm.card.brand || null, last4: pm.card.last4 || null };
      }
    } catch (err) {
      // Non-fatal — a missing/uncardable PM just renders "No card on file".
      console.warn('[me/subscription/status] payment method read failed', safeLogContext(err, 'status_pm_failed'));
    }

    return res.status(200).json({
      hasPlan: true,
      name,
      priceDollars,
      billing,
      visitsPerCycle,
      status: subscription.status,
      nextChargeIso: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      // The recurring price is the best estimate of the next charge. Proration
      // / outstanding balances are surfaced separately by the change preview.
      nextChargeAmountDollars: priceDollars,
      defaultPaymentMethod,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });
  } catch (err) {
    console.warn('[me/subscription/status] failed', safeLogContext(err, 'subscription_status_failed'));
    return res.status(500).json({
      error: 'Could not load your plan.',
      code: safeErrorCode(err, 'subscription_status_failed'),
    });
  }
}
