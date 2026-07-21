/**
 * POST /api/me/pay-balance
 *
 * Charge the outstanding balance on a single appointment off-session against
 * the card we saved at checkout. Wave 2 of the patient portal — the
 * Dashboard's "Pay $X now" button calls this directly so a discharged client
 * can settle their post-visit balance without staff intervention.
 *
 * Auth: Supabase access-token. The appointment must belong to the caller
 * (matched by booking-contact email, mirroring /api/me/appointments).
 *
 * Idempotency: re-calls with a paid-in-full appointment are a no-op 400, so
 * the React button cannot double-charge if the user double-taps.
 */
import Stripe from 'stripe';
import { getAuthedUser } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

function emailFromPayload(payload = {}) {
  return String(payload?.contact?.email || '').trim().toLowerCase();
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
  const { appointmentId } = (req.body && typeof req.body === 'object') ? req.body : {};
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required', code: 'appointment_id_missing' });
  }

  try {
    let query = db.from('appointments')
      .select('id, tenant_id, payment_status, balance_due_cents, stripe_customer_id, stripe_payment_method_id, stripe_balance_payment_intent, external_payload')
      .eq('id', appointmentId);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data: appt, error: readErr } = await query.maybeSingle();
    if (readErr) throw readErr;
    if (!appt) return res.status(404).json({ error: 'Appointment not found', code: 'appointment_not_found' });

    // Authorization boundary: the booking-contact email must match the
    // signed-in session. Booking is anonymous so this is the only tie back to
    // a patient. Mirror the comparison /api/me/appointments uses.
    const bookingEmail = emailFromPayload(appt.external_payload);
    if (!bookingEmail || bookingEmail !== String(email || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Not your appointment', code: 'appointment_not_yours' });
    }

    const balanceCents = Number(appt.balance_due_cents || 0);
    if (appt.payment_status === 'paid_in_full' || balanceCents <= 0) {
      return res.status(400).json({
        error: 'No outstanding balance on this appointment.',
        code: 'no_balance_due',
      });
    }
    if (!appt.stripe_payment_method_id || !appt.stripe_customer_id) {
      return res.status(400).json({
        error: 'Add a card first via the billing portal.',
        code: 'no_saved_card',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let paymentIntent = null;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: balanceCents,
        currency: 'usd',
        customer: appt.stripe_customer_id,
        payment_method: appt.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          kind: 'balance',
          appointmentRecordId: appt.id,
          source: 'self_pay_balance',
        },
      }, {
        // Cap accidental double-clicks at one charge per appointment per
        // current balance. If the user pays a different balance later (e.g.
        // an add-on) the amount changes, so the key naturally rotates.
        idempotencyKey: `self-pay-balance:${appt.id}:${balanceCents}`,
      });
    } catch (err) {
      // 3DS / authentication required — surface clientSecret so the front-end
      // can run stripe.confirmCardPayment().
      if (err?.code === 'authentication_required' && err.raw?.payment_intent?.client_secret) {
        return res.status(402).json({
          error: 'Card requires verification.',
          code: 'requires_action',
          clientSecret: err.raw.payment_intent.client_secret,
        });
      }
      throw err;
    }

    if (paymentIntent.status === 'requires_action' && paymentIntent.client_secret) {
      return res.status(402).json({
        error: 'Card requires verification.',
        code: 'requires_action',
        clientSecret: paymentIntent.client_secret,
      });
    }
    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        error: 'Payment was not completed.',
        code: 'payment_not_completed',
        status: paymentIntent.status,
      });
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await db.from('appointments').update({
      payment_status: 'paid_in_full',
      balance_due_cents: 0,
      balance_paid_at: now,
      stripe_balance_payment_intent: paymentIntent.id,
      updated_at: now,
    }).eq('id', appt.id);
    if (updateErr) {
      console.warn('[me/pay-balance] appointment update failed after charge', safeLogContext(updateErr, 'pay_balance_appointment_update_failed'));
    }

    await writeAuditEvent(db, {
      tenantId: appt.tenant_id || tenantId || null,
      actorProfileId: user?.id || null,
      action: 'self_pay_balance',
      entityType: 'appointment',
      entityId: appt.id,
      phiTouched: false,
      payload: {
        amountCents: balanceCents,
        paymentIntentId: paymentIntent.id,
      },
    });

    return res.status(200).json({ ok: true, paymentIntentId: paymentIntent.id });
  } catch (err) {
    console.warn('[me/pay-balance] failed', safeLogContext(err, 'self_pay_balance_failed'));
    return res.status(500).json({
      error: 'Could not charge the balance. Please try again or contact Avalon.',
      code: safeErrorCode(err, 'self_pay_balance_failed'),
    });
  }
}
