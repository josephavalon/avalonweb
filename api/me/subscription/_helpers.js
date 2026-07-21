/**
 * Shared helpers for /api/me/subscription/*.
 *
 * Each endpoint needs the same prologue — auth, resolve the caller's Stripe
 * customer, find their active subscription — so factor it once and keep the
 * endpoint files focused on the action they actually take (change/cancel/pause).
 */

import { getAuthedUser } from '../../_lib/supabase-auth.js';

function likeLiteral(value) {
  return String(value).replace(/([\\%_])/g, '\\$1');
}

/**
 * Resolve the caller's Stripe customer id from profiles.stripe_customer_id,
 * with the same column-missing fallback /api/me/billing-portal uses (migration
 * 019 may not have been applied yet on every environment) and a backfill from
 * the appointments table when profiles is empty.
 */
export async function resolveCustomerId(db, { userId, email, tenantId }) {
  let customerId = null;
  try {
    let q = db.from('profiles').select('stripe_customer_id').eq('id', userId);
    let { data, error } = await q.maybeSingle();
    if (error && !/column .* does not exist|42703/i.test(error.message || '')) throw error;
    if (data?.stripe_customer_id) customerId = data.stripe_customer_id;
    if (!customerId && email) {
      ({ data, error } = await db.from('profiles').select('stripe_customer_id').eq('email', email).maybeSingle());
      if (error && !/column .* does not exist|42703/i.test(error.message || '')) throw error;
      if (data?.stripe_customer_id) customerId = data.stripe_customer_id;
    }
  } catch {
    // Column missing → treat as no-customer; the appointment lookup is the
    // backstop for users who pre-date migration 019.
  }
  if (!customerId && email) {
    let q = db.from('appointments')
      .select('stripe_customer_id')
      .not('stripe_customer_id', 'is', null)
      .ilike('external_payload->contact->>email', likeLiteral(email))
      .order('created_at', { ascending: false })
      .limit(1);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    if (data?.[0]?.stripe_customer_id) customerId = data[0].stripe_customer_id;
  }
  return customerId;
}

/**
 * Find the caller's active Stripe subscription. Returns { subscription, item }
 * or null. Most members have at most one active plan, so we just pull the
 * first 'active' subscription from stripe.subscriptions.list.
 */
export async function findActiveSubscription(stripe, customerId) {
  if (!customerId) return null;
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });
  const subscription = list.data?.[0];
  if (!subscription) return null;
  const item = subscription.items?.data?.[0];
  if (!item) return null;
  return { subscription, item };
}

/** One-shot prologue: auth + Stripe key + customer + active sub. */
export async function authAndActiveSubscription(req, res, Stripe) {
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_secret_missing' });
    return null;
  }
  const authed = await getAuthedUser(req);
  if (!authed) { res.status(401).json({ error: 'Sign in required' }); return null; }
  const customerId = await resolveCustomerId(authed.db, {
    userId: authed.user.id,
    email: authed.email,
    tenantId: authed.tenantId,
  });
  if (!customerId) {
    res.status(404).json({
      error: 'No billing account yet.',
      code: 'no_customer',
    });
    return null;
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const found = await findActiveSubscription(stripe, customerId);
  if (!found) {
    res.status(404).json({ error: 'No active subscription found.', code: 'no_subscription' });
    return null;
  }
  return { authed, stripe, customerId, ...found };
}
