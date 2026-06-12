import Stripe from 'stripe';
import {
  buildReconciliationCase,
  insertReconciliationCaseOnce,
  reconciliationTypeForStripeEvent,
} from '../../_reconciliation.js';
import { requireLiveWebhook } from '../../_lib/pre-api-guard.js';
import { getDefaultTenantId, getSupabaseServiceClient } from '../../_supabase-server.js';
import { sendCustomerPaymentPendingEmail, sendPaymentReceivedEmail } from '../../_booking-email.js';
import {
  checkoutPayloadFromRecord,
  checkoutPayloadFromStripeMetadata,
  createSchedulingAppointmentWithFallback,
  claimSchedulingCreation,
  readAcuityAppointmentId,
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
  await insertReconciliationCaseOnce(db, caseRow);
}

async function insertOperationalFailureCase(db, { caseType, provider = 'avalon', externalReference, tenantId, payload = {} }) {
  if (!db || !caseType) return;
  await insertReconciliationCaseOnce(db, buildReconciliationCase({
    caseType,
    provider,
    externalReference,
    tenantId: tenantId || await getDefaultTenantId(db),
    payload,
  }));
}

async function pollAcuityAppointmentId(db, recordId, attempts = 5, delayMs = 1000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existingId = await readAcuityAppointmentId(db, recordId);
    if (existingId) return existingId;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
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
  const tenantId = db ? await getDefaultTenantId(db) : null;
  let acuityAppointment = (record?.acuity_appointment_id || md.acuityAppointmentId)
    ? { id: record?.acuity_appointment_id || md.acuityAppointmentId, alreadyCreated: true }
    : null;
  let attioPersonId = null;
  let attioSynced = false;
  let fulfillmentError = null;
  const checkout = record ? checkoutPayloadFromRecord(record) : checkoutPayloadFromStripeMetadata(md);

  let schedulingDeferred = false;
  if (!acuityAppointment?.id) {
    const wonSchedulingClaim = await claimSchedulingCreation(db, record?.id);
    if (!wonSchedulingClaim) {
      // Another path (the client return-page, or a concurrent delivery) is
      // already creating this Acuity appointment. Re-read for its id; if it
      // isn't persisted yet, defer — never create a duplicate, and don't
      // overwrite the winner's scheduling fields below.
      const existingId = await pollAcuityAppointmentId(db, record?.id);
      if (existingId) {
        acuityAppointment = { id: existingId, alreadyCreated: true };
      } else {
        schedulingDeferred = true;
      }
    } else {
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
          await insertOperationalFailureCase(db, {
            caseType: 'crm_sync_failed',
            provider: 'attio',
            externalReference: session.id,
            tenantId,
            payload: {
              appointmentRecordId: record?.id || null,
              stripeSessionId: session.id,
              error: err.message || 'Attio sync failed',
            },
          });
        }
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

  if (!schedulingDeferred && paymentIntentId && paymentIntent?.metadata?.opsPaymentEmailSent !== 'true') {
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
      await insertOperationalFailureCase(db, {
        caseType: 'operations_email_failed',
        provider: 'resend',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record?.id || null,
          stripeSessionId: session.id,
          error: err.message || 'Payment operations email failed',
        },
      });
    }
  }

  if (fulfillmentError && paymentIntentId && paymentIntent?.metadata?.customerPaymentPendingEmailSent !== 'true') {
    try {
      await sendCustomerPaymentPendingEmail({ checkout });
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...(paymentIntent?.metadata || {}),
          customerPaymentPendingEmailSent: 'true',
        },
      });
    } catch (err) {
      console.warn('[stripe/webhook] customer pending email failed:', err.message);
      await insertOperationalFailureCase(db, {
        caseType: 'customer_email_failed',
        provider: 'resend',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record?.id || null,
          stripeSessionId: session.id,
          error: err.message || 'Customer pending email failed',
        },
      });
    }
  }

  const patch = {
    tenant_id:                    tenantId,
    stripe_checkout_session_id:   session.id,
    stripe_customer_id:           session.customer || null,
    stripe_deposit_payment_intent: paymentIntentId,
    stripe_payment_method_id:     paymentMethodId,
    deposit_paid_at:              now,
    payment_status:               Number(md.balanceDueCents || 0) > 0 ? 'partial_payment' : 'paid_in_full',
    status:                       schedulingDeferred ? undefined : acuityAppointment?.id ? 'scheduled' : 'payment_received',
    acuity_appointment_id:         schedulingDeferred ? undefined : acuityAppointment?.id ? String(acuityAppointment.id) : null,
    reconciliation_status:         schedulingDeferred ? undefined : fulfillmentError ? 'action_required' : 'ok',
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
      await insertReconciliationCase(db, buildReconciliationCase({
        caseType: 'stripe_succeeded_acuity_failed',
        provider: 'stripe',
        externalReference: session.id,
        tenantId,
        payload: {
          appointmentRecordId: record.id,
          error: fulfillmentError.message,
          local_contract: 'stripe_paid_then_acuity_attio_v1',
        },
      }));
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
    tenant_id: tenantId,
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

    // Idempotency: Stripe redelivers an event (same id) on timeout / non-2xx. We
    // record an event as processed only on success (below), so a failed first
    // attempt is NOT recorded and still reprocesses correctly on redelivery.
    if (db) {
      try {
        const { data: seenEvent } = await db.from('integration_events')
          .select('id, status')
          .eq('provider', 'stripe')
          .eq('idempotency_key', event.id)
          .maybeSingle();
        if (seenEvent?.status === 'processed') {
          return res.status(200).json({ received: true, duplicate: true, id: event.id, type: event.type });
        }
      } catch (err) {
        console.warn('[stripe/webhook] idempotency check skipped:', err.message);
      }
    }

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

    // Record successful processing so a redelivery of this event short-circuits
    // the idempotency check above. Best-effort — never blocks the 200 ack.
    if (db) {
      try {
        await db.from('integration_events').insert({
          provider: 'stripe',
          event_type: event.type,
          external_event_id: event.id,
          idempotency_key: event.id,
          payload_hash: event.id,
          signature_valid: true,
          status: 'processed',
          processed_at: new Date().toISOString(),
        });
      } catch (err) {
        // Unique violation = a concurrent duplicate already recorded it; ignore.
        if (!/duplicate|unique|23505/i.test(err.message || '')) {
          console.warn('[stripe/webhook] event idempotency record failed:', err.message);
        }
      }
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
