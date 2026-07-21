/**
 * GET /api/me/payment-methods
 *
 * Lists the signed-in member's saved card payment methods for the
 * patient-portal Billing page, flagging the customer's default. Read-only:
 * raw card collection (add/remove) is intentionally NOT built here — that's a
 * PCI surface handled inside the Stripe Customer Billing Portal via
 * /api/me/billing-portal. We only list + identify the default.
 *
 * Stripe customer id source mirrors api/me/billing-portal.js exactly:
 * profiles.stripe_customer_id (Wave 1 migration 019), backfilled from the
 * most-recent appointment with a customer id. Returns
 * { customer:false, paymentMethods:[] } cleanly if no Stripe customer.
 */
import Stripe from 'stripe';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function likeLiteral(value) {
  return String(value).replace(/([\\%_])/g, '\\$1');
}

async function readProfileCustomerId(db, userId, email) {
  try {
    let { data, error } = await db
      .from('profiles')
      .select('id, stripe_customer_id, tenant_id')
      .eq('id', userId)
      .maybeSingle();
    if (error && !/column .* does not exist|42703/i.test(error.message || '')) throw error;
    if (!data && email) {
      ({ data, error } = await db
        .from('profiles')
        .select('id, stripe_customer_id, tenant_id')
        .eq('email', email)
        .maybeSingle());
      if (error && !/column .* does not exist|42703/i.test(error.message || '')) throw error;
    }
    return {
      profileId: data?.id || null,
      customerId: data?.stripe_customer_id || null,
      tenantId: data?.tenant_id || null,
    };
  } catch {
    return { profileId: null, customerId: null, tenantId: null };
  }
}

async function findCustomerIdFromAppointments(db, email, tenantId) {
  if (!email) return null;
  let q = db
    .from('appointments')
    .select('stripe_customer_id, tenant_id')
    .not('stripe_customer_id', 'is', null)
    .ilike('external_payload->contact->>email', likeLiteral(email))
    .order('created_at', { ascending: false })
    .limit(1);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error || !data?.length) return null;
  return data[0].stripe_customer_id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_secret_missing' });
  }

  const { db, user, email, tenantId } = authed;
  try {
    const profileRead = await readProfileCustomerId(db, user.id, email);
    let customerId = profileRead.customerId;

    if (!customerId) {
      const fromAppointments = await findCustomerIdFromAppointments(db, email, tenantId);
      if (fromAppointments) {
        customerId = fromAppointments;
        try {
          await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        } catch (err) {
          if (!/column .* does not exist|42703/i.test(err?.message || '')) {
            console.warn('[me/payment-methods] backfill failed', safeLogContext(err, 'stripe_customer_backfill_failed'));
          }
        }
      }
    }

    if (!customerId) {
      return res.status(200).json({ customer: false, paymentMethods: [] });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Resolve the default payment method id from the customer's invoice
    // settings (falls back to the legacy default_source for older customers).
    let defaultPmId = null;
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted) {
        defaultPmId = customer.invoice_settings?.default_payment_method
          || customer.default_source
          || null;
      }
    } catch (err) {
      console.warn('[me/payment-methods] customer retrieve failed', safeLogContext(err, 'customer_retrieve_failed'));
    }

    const list = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 24 });
    const paymentMethods = (list?.data || []).map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || null,
      expMonth: pm.card?.exp_month || null,
      expYear: pm.card?.exp_year || null,
      isDefault: !!defaultPmId && pm.id === defaultPmId,
    }));

    return res.status(200).json({ customer: true, paymentMethods });
  } catch (err) {
    console.warn('[me/payment-methods] failed', safeLogContext(err, 'payment_methods_failed'));
    return res.status(500).json({
      error: 'Could not load your payment methods.',
      code: safeErrorCode(err, 'payment_methods_failed'),
    });
  }
}
