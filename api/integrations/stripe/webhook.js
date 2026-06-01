import Stripe from 'stripe';
import { reconciliationTypeForStripeEvent } from '../../_reconciliation.js';
import { requireLiveWebhook } from '../../_lib/pre-api-guard.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Supabase (lazy; graceful no-op until service-role key is configured) ─────
let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

// Canonical record is public.appointments. Resolve by Acuity id, then Stripe session.
async function findAppointmentId(db, { acuityId, sessionId }) {
  if (acuityId) {
    const { data } = await db.from('appointments')
      .select('id').eq('acuity_appointment_id', String(acuityId)).maybeSingle();
    if (data) return data.id;
  }
  if (sessionId) {
    const { data } = await db.from('appointments')
      .select('id').eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (data) return data.id;
  }
  return null;
}

async function handleCheckoutCompleted(stripe, db, session) {
  const md = session.metadata || {};
  const acuityId = md.acuityAppointmentId || null;

  // Pull the saved card off the deposit PaymentIntent so the nurse can charge
  // the balance off-session later.
  let paymentMethodId = null;
  const paymentIntentId = session.payment_intent || null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentMethodId = pi.payment_method || null;
    } catch (e) {
      console.warn('[stripe/webhook] payment_intent retrieve failed:', e.message);
    }
  }

  const now = new Date().toISOString();
  const patch = {
    stripe_checkout_session_id:   session.id,
    stripe_customer_id:           session.customer || null,
    stripe_deposit_payment_intent: paymentIntentId,
    stripe_payment_method_id:     paymentMethodId,
    deposit_paid_at:              now,
    payment_status:               'deposit_paid',
    balance_due_cents:            md.balanceDueCents != null ? Number(md.balanceDueCents) : null,
    visit_subtotal_cents:         md.visitSubtotalCents != null ? Number(md.visitSubtotalCents) : null,
    deposit_amount_cents:         md.depositAmountCents != null ? Number(md.depositAmountCents) : 5000,
    updated_at:                   now,
  };

  const id = await findAppointmentId(db, { acuityId, sessionId: session.id });
  if (id) {
    await db.from('appointments').update(patch).eq('id', id);
    return { action: 'deposit_paid', matched: true };
  }

  // Acuity webhook hasn't created the row yet — insert a minimal one; the Acuity
  // webhook will enrich it (idempotent on acuity_appointment_id).
  const { error } = await db.from('appointments').insert({
    acuity_appointment_id: acuityId,
    ...patch,
    created_at: now,
  });
  if (error) console.warn('[stripe/webhook] appointment insert failed:', error.message);
  return { action: 'deposit_paid', matched: false };
}

async function handleBalancePaid(db, paymentIntent) {
  // Balance charges are tagged metadata.kind='balance' by /api/charge-balance.
  const md = paymentIntent.metadata || {};
  if (md.kind !== 'balance') return { action: 'ignored_non_balance_pi' };

  const now = new Date().toISOString();
  const patch = {
    stripe_balance_payment_intent: paymentIntent.id,
    balance_paid_at:               now,
    payment_status:                'paid_in_full',
    updated_at:                    now,
  };
  if (md.acuityAppointmentId) {
    await db.from('appointments').update(patch)
      .eq('acuity_appointment_id', String(md.acuityAppointmentId));
  }
  return { action: 'balance_paid' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gate = requireLiveWebhook(req, res, {
    provider: 'Stripe',
    secretEnv: 'STRIPE_WEBHOOK_SECRET',
  });
  if (!gate) return null;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event = null;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    const db = await getSupabase();
    if (!db) {
      // Signature valid but DB not wired — ack so Stripe doesn't retry endlessly.
      return res.status(200).json({
        received: true, id: event.id, type: event.type,
        persisted: false, note: 'db_not_configured',
      });
    }

    let result = { action: 'store_for_audit' };
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(stripe, db, event.data.object);
        break;
      case 'payment_intent.succeeded':
        result = await handleBalancePaid(db, event.data.object);
        break;
      case 'checkout.session.expired':
        result = { action: 'release_scheduling_hold' };
        break;
      default:
        result = { action: 'store_for_audit' };
    }

    return res.status(200).json({
      received: true,
      id: event.id,
      type: event.type,
      persisted: true,
      reconciliationCaseType: reconciliationTypeForStripeEvent(event),
      result,
    });
  } catch (err) {
    // Before verification → 400 (Stripe should resend). After → 200 to avoid retry storms.
    if (!event) {
      return res.status(400).json({ error: err.message || 'Invalid Stripe webhook' });
    }
    console.error('[stripe/webhook] processing error:', err.message);
    return res.status(200).json({ received: true, persisted: false, error: err.message });
  }
}
