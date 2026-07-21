/**
 * POST /api/me/billing-portal
 *
 * Mints a one-time Stripe Customer Billing Portal session for the signed-in
 * member. The portal handles card management, billing-address updates, and
 * historical invoice downloads — anything we don't (yet) build into the
 * patient portal directly.
 *
 * Stripe customer id source: profiles.stripe_customer_id (Wave 1 migration
 * 019). If the column hasn't been migrated yet, or the user pre-dates the
 * column, we backfill from the most-recent appointment with a customer id.
 * If we still can't find one, this is a returnable 404 with code 'no_customer'
 * — the UI shows a "make your first purchase" message instead of crashing.
 */
import Stripe from 'stripe';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function likeLiteral(value) {
  return String(value).replace(/([\\%_])/g, '\\$1');
}

// Read profile.stripe_customer_id. The column was added in migration 019; if
// the migration hasn't run yet the select will 42703 — treat that as "no
// customer yet" rather than a 500 so the portal degrades gracefully.
async function readProfileCustomerId(db, userId, email) {
  try {
    let q = db.from('profiles').select('id, stripe_customer_id, tenant_id').eq('id', userId);
    let { data, error } = await q.maybeSingle();
    if (error && !/column .* does not exist|42703/i.test(error.message || '')) throw error;
    if (!data && email) {
      ({ data, error } = await db.from('profiles').select('id, stripe_customer_id, tenant_id').eq('email', email).maybeSingle());
      if (error && !/column .* does not exist|42703/i.test(error.message || '')) throw error;
    }
    return { profileId: data?.id || null, customerId: data?.stripe_customer_id || null, tenantId: data?.tenant_id || null };
  } catch {
    return { profileId: null, customerId: null, tenantId: null };
  }
}

// Find the most-recent appointment with a saved stripe_customer_id for this
// user (matched by booking-contact email). Used to backfill profile when the
// column is empty (post-migration) or to derive a customer entirely (pre).
async function findCustomerIdFromAppointments(db, email, tenantId) {
  if (!email) return null;
  let q = db.from('appointments')
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

function originFromReq(req) {
  const configured = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.host || '';
  return host ? `${proto}://${host}` : 'https://snooches.avalonvitality.co';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
        // Backfill profiles.stripe_customer_id if the column exists. Best-effort
        // — a 42703 column-missing error here means the migration hasn't run,
        // which is fine: the appointment-side lookup keeps working until it does.
        try {
          await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        } catch (err) {
          if (!/column .* does not exist|42703/i.test(err?.message || '')) {
            console.warn('[me/billing-portal] backfill failed', safeLogContext(err, 'stripe_customer_backfill_failed'));
          }
        }
      }
    }

    if (!customerId) {
      return res.status(404).json({
        error: 'No billing account yet — make your first purchase to enable the customer portal.',
        code: 'no_customer',
      });
    }

    const origin = originFromReq(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/members/billing`,
    });

    await writeAuditEvent(db, {
      tenantId: profileRead.tenantId || tenantId || null,
      actorProfileId: user?.id || null,
      action: 'self_billing_portal_session',
      entityType: 'profile',
      entityId: user?.id || null,
      phiTouched: false,
      payload: { stripeCustomerId: customerId },
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    console.warn('[me/billing-portal] failed', safeLogContext(err, 'billing_portal_failed'));
    return res.status(500).json({
      error: 'Could not open the billing portal.',
      code: safeErrorCode(err, 'billing_portal_failed'),
    });
  }
}
