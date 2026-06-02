import Stripe from 'stripe';
import { reconciliationTypeForStripeEvent } from '../../_reconciliation.js';
import { requireLiveWebhook } from '../../_lib/pre-api-guard.js';
import { getSupabaseServiceClient } from '../../_supabase-server.js';
import { sendPaymentReceivedEmail } from '../../_booking-email.js';
import {
  checkoutPayloadFromRecord,
  checkoutPayloadFromStripeMetadata,
  createSchedulingAppointmentWithFallback,
  syncCheckoutAttioPerson,
} from '../../_checkout-fulfillment.js';

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

// Canonical record is public.appointments. Resolve by Acuity id, then Stripe session.
async function findAppointmentRecord(db, { acuityId, sessionId, appointmentRecordId }) {
  const columns = 'id, acuity_appointment_id, stripe_checkout_session_id, external_payload';
  if (appointmentRecordId) {
    const { data } = await db.from('appointments')
      .select(columns).eq('id', appointmentRecordId).maybeSingle();
    if (data) return data;
  }
  if (acuityId) {
    const { data } = await db.from('appointments')
      .select(columns).eq('acuity_appointment_id', String(acuityId)).maybeSingle();
    if (data) return data;
  }
  if (sessionId) {
    const { data } = await db.from('appointments')
      .select(columns).eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function insertReconciliationCase(db, caseRow) {
  try {
    await db.from('reconciliation_cases').insert(caseRow);
  } catch (err) {
    console.warn('[stripe/webhook] reconciliation insert failed:', err.message);
  }
}

function buildExternalPayload(existingPayload = {}, patch = {}) {
  return {
    ...existingPayload,
    fulfillment: {
      ...(existingPayload.fulfillment || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function updateStripeFulfillmentMetadata(stripe, session, patch = {}) {
  const paymentIntentId = typeof session.payment_intent === 'object'
    ? session.payment_intent?.id
    : session.payment_intent || null;
  if (!paymentIntentId) return;

  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...(typeof session.payment_intent === 'object' ? session.payment_intent?.metadata || {} : {}),
        ...patch,
      },
    });
  } catch (err) {
    console.warn('[stripe/webhook] payment intent metadata update failed:', err.message);
  }
}

async function handleCheckoutCompleted(stripe, db, session) {
  const md = session.metadata || {};
  if (session.payment_status && session.payment_status !== 'paid') {
    return { action: 'ignored_unpaid_checkout', paymentStatus: session.payment_status };
  }

  const appointmentRecordId = md.appointmentRecordId || null;
  let record = db
    ? await findAppointmentRecord(db, {
        acuityId: md.acuityAppointmentId || null,
        sessionId: session.id,
        appointmentRecordId,
      })
    : null;

  // Pull the saved card off the deposit PaymentIntent so the nurse can charge
  // the balance off-session later.
  let paymentIntent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  let paymentMethodId = null;
  const paymentIntentId = typeof session.payment_intent === 'object'
    ? session.payment_intent?.id
    : session.payment_intent || null;
  if (paymentIntentId) {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentMethodId = paymentIntent.payment_method || null;
    } catch (e) {
      console.warn('[stripe/webhook] payment_intent retrieve failed:', e.message);
    }
  }

  const now = new Date().toISOString();
  let acuityAppointment = (record?.acuity_appointment_id || md.acuityAppointmentId)
    ? { id: record?.acuity_appointment_id || md.acuityAppointmentId, alreadyCreated: true }
    : null;
  let attioPersonId = null;
  let attioSynced = false;
  let fulfillmentError = null;
  const checkout = record ? checkoutPayloadFromRecord(record) : checkoutPayloadFromStripeMetadata(md);

  if (!acuityAppointment?.id) {
    try {
      acuityAppointment = await createSchedulingAppointmentWithFallback({
        appointment: checkout.appointment || {},
        contact: checkout.contact || {},
        items: checkout.items || [],
        membership: checkout.membership || null,
        amounts: checkout.amounts || {},
        req: null,
      });
    } catch (err) {
      fulfillmentError = err;
      console.error('[stripe/webhook] Acuity fulfillment failed:', err.message, err.body || '');
    }

    if (acuityAppointment?.id && checkout.contact?.email) {
      try {
        attioPersonId = await syncCheckoutAttioPerson({
          contact: checkout.contact,
          primaryService: checkout.primaryService || md.service || 'Avalon Visit',
          appointment: checkout.appointment || {},
          items: checkout.items || [],
          membership: checkout.membership || null,
          amounts: checkout.amounts || {},
        });
        attioSynced = true;
      } catch (err) {
        console.warn('[stripe/webhook] Attio sync failed:', err.message);
      }
    }
  }

  if (!record && appointmentRecordId && db) {
    console.warn('[stripe/webhook] appointment record not found:', appointmentRecordId);
  }

  if (acuityAppointment?.id && !acuityAppointment.alreadyCreated) {
    await updateStripeFulfillmentMetadata(stripe, session, {
      acuityAppointmentId: String(acuityAppointment.id),
      fulfillmentStatus: 'acuity_created',
    });
  } else if (fulfillmentError) {
    await updateStripeFulfillmentMetadata(stripe, session, {
      fulfillmentStatus: 'acuity_failed',
      fulfillmentError: fulfillmentError.message.slice(0, 480),
    });
  }

  if (paymentIntentId && paymentIntent?.metadata?.opsPaymentEmailSent !== 'true') {
    try {
      await sendPaymentReceivedEmail({
        checkout,
        sessionId: session.id,
        paymentIntentId,
        acuityAppointmentId: acuityAppointment?.id ? String(acuityAppointment.id) : '',
        fulfillmentStatus: fulfillmentError ? 'acuity_failed' : acuityAppointment?.id ? 'acuity_created' : 'payment_received',
      });
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...(paymentIntent?.metadata || {}),
          ...(acuityAppointment?.id ? {
            acuityAppointmentId: String(acuityAppointment.id),
            fulfillmentStatus: 'acuity_created',
          } : fulfillmentError ? {
            fulfillmentStatus: 'acuity_failed',
            fulfillmentError: fulfillmentError.message.slice(0, 480),
          } : {}),
          opsPaymentEmailSent: 'true',
        },
      });
    } catch (err) {
      console.warn('[stripe/webhook] payment email failed:', err.message);
    }
  }

  const patch = {
    stripe_checkout_session_id:   session.id,
    stripe_customer_id:           session.customer || null,
    stripe_deposit_payment_intent: paymentIntentId,
    stripe_payment_method_id:     paymentMethodId,
    deposit_paid_at:              now,
    payment_status:               Number(md.balanceDueCents || 0) > 0 ? 'partial_payment' : 'paid_in_full',
    status:                       acuityAppointment?.id ? 'scheduled' : 'payment_received',
    acuity_appointment_id:         acuityAppointment?.id ? String(acuityAppointment.id) : null,
    reconciliation_status:         fulfillmentError ? 'action_required' : 'ok',
    attio_person_id:               attioPersonId || undefined,
    attio_synced_at:               attioSynced ? now : undefined,
    balance_due_cents:            md.balanceDueCents != null ? Number(md.balanceDueCents) : null,
    visit_subtotal_cents:         md.visitSubtotalCents != null ? Number(md.visitSubtotalCents) : null,
    deposit_amount_cents:         md.depositAmountCents != null ? Number(md.depositAmountCents) : Number(session.amount_total || 0),
    external_payload:              buildExternalPayload(record?.external_payload || {}, {
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      acuityAppointment,
      attioPersonId,
      error: fulfillmentError ? {
        message: fulfillmentError.message,
        status: fulfillmentError.status || null,
        body: fulfillmentError.body || null,
      } : null,
    }),
    updated_at:                   now,
  };
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  if (db && record?.id) {
    await db.from('appointments').update(patch).eq('id', record.id);
    if (fulfillmentError) {
      await insertReconciliationCase(db, {
        case_type: 'stripe_succeeded_acuity_failed',
        provider: 'stripe',
        external_reference: session.id,
        severity: 'critical',
        owner_role: 'ops_manager',
        payload: {
          required_action: 'Create or recover the scheduling appointment before dispatch.',
          local_contract: 'stripe_paid_then_acuity_attio_v1',
          appointmentRecordId: record.id,
          error: fulfillmentError.message,
        },
      });
    }
    return {
      action: fulfillmentError ? 'deposit_paid_acuity_failed' : 'deposit_paid_acuity_created',
      matched: true,
      acuityAppointmentId: acuityAppointment?.id || null,
      attioSynced,
    };
  }

  if (!db) {
    return {
      action: fulfillmentError ? 'deposit_paid_acuity_failed_no_db' : 'deposit_paid_acuity_created_no_db',
      matched: false,
      persisted: false,
      acuityAppointmentId: acuityAppointment?.id || null,
      attioSynced,
    };
  }

  // Legacy fallback for older sessions created before the paid-first flow.
  const { error } = await db.from('appointments').insert({
    acuity_appointment_id: md.acuityAppointmentId || null,
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

    const db = await getSupabaseServiceClient();

    let result = { action: 'store_for_audit' };
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(
          stripe,
          db,
          await stripe.checkout.sessions.retrieve(event.data.object.id)
        );
        break;
      case 'payment_intent.succeeded':
        if (!db) {
          result = { action: 'balance_tracking_skipped_db_not_configured' };
          break;
        }
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
      persisted: Boolean(db),
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
