/**
 * GET /api/me/invoices
 *
 * Returns the signed-in member's Stripe invoice history (receipts) for the
 * patient-portal Billing page, plus the next scheduled charge if the member
 * has an active subscription.
 *
 * Stripe customer id source mirrors api/me/billing-portal.js exactly:
 * profiles.stripe_customer_id (Wave 1 migration 019), backfilled from the
 * most-recent appointment carrying a customer id when the column is empty or
 * pre-dates the user. If we still can't find one we return
 * { customer:false, invoices:[] } cleanly so the UI shows an empty state
 * instead of crashing.
 *
 * No PHI is read out of Stripe here — invoice descriptions are catalog-level
 * product labels written through safeStripeMetadata at checkout.
 */
import Stripe from 'stripe';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function likeLiteral(value) {
  return String(value).replace(/([\\%_])/g, '\\$1');
}

// Read profile.stripe_customer_id. The column was added in migration 019; if
// the migration hasn't run yet the select will 42703 — treat that as "no
// customer yet" rather than a 500 so the page degrades gracefully.
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

// Find the most-recent appointment with a saved stripe_customer_id for this
// user (matched by booking-contact email). Used to backfill when the profile
// column is empty (post-migration) or to derive a customer entirely (pre).
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

function dollars(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

function isoFromUnix(unix) {
  if (!unix) return null;
  const ms = Number(unix) * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function shapeInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number || null,
    created: isoFromUnix(inv.created),
    amountDueDollars: dollars(inv.amount_due),
    amountPaidDollars: dollars(inv.amount_paid),
    status: inv.status || 'draft',
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    invoicePdf: inv.invoice_pdf || null,
    description: inv.description || inv.lines?.data?.[0]?.description || null,
  };
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
        // Best-effort backfill — a 42703 column-missing error means the
        // migration hasn't run, which is fine: appointment-side lookup keeps
        // working until it does.
        try {
          await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        } catch (err) {
          if (!/column .* does not exist|42703/i.test(err?.message || '')) {
            console.warn('[me/invoices] backfill failed', safeLogContext(err, 'stripe_customer_backfill_failed'));
          }
        }
      }
    }

    if (!customerId) {
      return res.status(200).json({ customer: false, invoices: [], nextChargeIso: null, nextChargeAmountDollars: null });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const list = await stripe.invoices.list({ customer: customerId, limit: 24 });
    const invoices = (list?.data || []).map(shapeInvoice);

    // Next charge: best-effort from the upcoming invoice. Only present when the
    // customer has an active subscription — otherwise Stripe throws
    // invoice_upcoming_none, which we swallow to null.
    let nextChargeIso = null;
    let nextChargeAmountDollars = null;
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
      if (subs?.data?.length) {
        let upcoming = null;
        try {
          if (typeof stripe.invoices.createPreview === 'function') {
            upcoming = await stripe.invoices.createPreview({ customer: customerId });
          } else if (typeof stripe.invoices.retrieveUpcoming === 'function') {
            upcoming = await stripe.invoices.retrieveUpcoming({ customer: customerId });
          }
        } catch {
          upcoming = null;
        }
        if (upcoming) {
          nextChargeIso = isoFromUnix(upcoming.next_payment_attempt || upcoming.period_end);
          nextChargeAmountDollars = dollars(upcoming.amount_due);
        }
      }
    } catch (err) {
      console.warn('[me/invoices] upcoming lookup failed', safeLogContext(err, 'upcoming_invoice_failed'));
    }

    return res.status(200).json({ customer: true, invoices, nextChargeIso, nextChargeAmountDollars });
  } catch (err) {
    console.warn('[me/invoices] failed', safeLogContext(err, 'invoices_failed'));
    return res.status(500).json({
      error: 'Could not load your billing history.',
      code: safeErrorCode(err, 'invoices_failed'),
    });
  }
}
