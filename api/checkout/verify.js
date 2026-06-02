import Stripe from 'stripe';
import { isLiveApiEnabled } from '../_lib/pre-api-guard.js';
import { getSupabaseServiceClient } from '../_supabase-server.js';
import { sendPaymentReceivedEmail } from '../_booking-email.js';
import {
  checkoutPayloadFromRecord,
  checkoutPayloadFromStripeMetadata,
  createSchedulingAppointmentWithFallback,
  syncCheckoutAttioPerson,
} from '../_checkout-fulfillment.js';

async function findAppointmentForSession(session) {
  const db = await getSupabaseServiceClient();
  if (!db) return null;

  const columns = 'id, acuity_appointment_id, stripe_checkout_session_id, payment_status, status, external_payload';
  const { data: bySession } = await db.from('appointments')
    .select(columns)
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (bySession) return bySession;

  const appointmentRecordId = session.metadata?.appointmentRecordId;
  if (!appointmentRecordId) return null;

  const { data: byRecord } = await db.from('appointments')
    .select(columns)
    .eq('id', appointmentRecordId)
    .maybeSingle();
  return byRecord || null;
}

async function updatePaymentIntentMetadata(stripe, paymentIntentId, existingMetadata = {}, patch = {}) {
  if (!paymentIntentId) return {};
  const nextMetadata = {
    ...(existingMetadata || {}),
    ...patch,
  };
  try {
    await stripe.paymentIntents.update(paymentIntentId, { metadata: nextMetadata });
  } catch (err) {
    console.warn('[checkout/verify] payment intent metadata update failed:', err.message);
  }
  return nextMetadata;
}

async function fulfillPaidCheckoutIfNeeded({ stripe, session, appointment, paymentIntent, paymentIntentMetadata }) {
  const paymentIntentId = paymentIntent?.id || (typeof session.payment_intent === 'string' ? session.payment_intent : null);
  const existingAppointmentId = appointment?.acuity_appointment_id
    || session.metadata?.acuityAppointmentId
    || paymentIntentMetadata.acuityAppointmentId
    || null;
  let metadata = paymentIntentMetadata || {};
  let acuityAppointmentId = existingAppointmentId;
  let fulfillmentStatus = appointment?.status || metadata.fulfillmentStatus || null;
  let fulfillmentError = metadata.fulfillmentError || null;
  const checkout = appointment ? checkoutPayloadFromRecord(appointment) : checkoutPayloadFromStripeMetadata(session.metadata || {});

  if (!acuityAppointmentId && metadata.fulfillmentStatus !== 'acuity_failed') {
    metadata = await updatePaymentIntentMetadata(stripe, paymentIntentId, metadata, {
      fulfillmentStatus: 'acuity_creating',
    });

    try {
      const acuityAppointment = await createSchedulingAppointmentWithFallback({
        appointment: checkout.appointment || {},
        contact: checkout.contact || {},
        items: checkout.items || [],
        membership: checkout.membership || null,
        amounts: checkout.amounts || {},
        req: null,
      });
      if (acuityAppointment?.id) {
        acuityAppointmentId = String(acuityAppointment.id);
        fulfillmentStatus = 'acuity_created';
        metadata = await updatePaymentIntentMetadata(stripe, paymentIntentId, metadata, {
          acuityAppointmentId,
          fulfillmentStatus,
          fulfillmentError: '',
        });

        if (checkout.contact?.email) {
          try {
            await syncCheckoutAttioPerson({
              contact: checkout.contact,
              primaryService: checkout.primaryService || session.metadata?.service || 'Avalon Visit',
              appointment: checkout.appointment || {},
              items: checkout.items || [],
              membership: checkout.membership || null,
              amounts: checkout.amounts || {},
            });
          } catch (err) {
            console.warn('[checkout/verify] Attio sync failed:', err.message);
          }
        }
      }
    } catch (err) {
      fulfillmentStatus = 'acuity_failed';
      fulfillmentError = err.message || 'Acuity appointment creation failed';
      metadata = await updatePaymentIntentMetadata(stripe, paymentIntentId, metadata, {
        fulfillmentStatus,
        fulfillmentError: fulfillmentError.slice(0, 480),
      });
      console.error('[checkout/verify] Acuity fulfillment failed:', err.message, err.body || '');
    }
  }

  if (paymentIntentId && metadata.opsPaymentEmailSent !== 'true') {
    try {
      await sendPaymentReceivedEmail({
        checkout,
        sessionId: session.id,
        paymentIntentId,
        acuityAppointmentId,
        fulfillmentStatus: fulfillmentStatus || 'payment_received',
      });
      metadata = await updatePaymentIntentMetadata(stripe, paymentIntentId, metadata, {
        opsPaymentEmailSent: 'true',
      });
    } catch (err) {
      console.warn('[checkout/verify] payment email failed:', err.message);
    }
  }

  return {
    appointmentId: acuityAppointmentId,
    fulfillmentStatus,
    fulfillmentError,
    paymentIntentMetadata: metadata,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.body?.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing checkout session', paid: false });
  }

  if (!isLiveApiEnabled()) {
    return res.status(409).json({
      error: 'Live checkout verification is not enabled in pre-API mode',
      paid: false,
      preApiHardWall: true,
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured', paid: false });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    const appointment = paid ? await findAppointmentForSession(session) : null;
    const paymentIntent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
    const paymentIntentMetadata = paymentIntent
      ? session.payment_intent?.metadata || {}
      : {};
    const existingAppointmentId = appointment?.acuity_appointment_id
      || session.metadata?.acuityAppointmentId
      || paymentIntentMetadata.acuityAppointmentId
      || null;
    const fulfillment = paid
      ? await fulfillPaidCheckoutIfNeeded({
          stripe,
          session,
          appointment,
          paymentIntent,
          paymentIntentMetadata,
        })
      : {
          appointmentId: existingAppointmentId,
          fulfillmentStatus: appointment?.status || paymentIntentMetadata.fulfillmentStatus || null,
          fulfillmentError: paymentIntentMetadata.fulfillmentError || null,
          paymentIntentMetadata,
        };

    return res.status(paid ? 200 : 402).json({
      paid,
      status: session.status,
      paymentStatus: session.payment_status,
      mode: session.mode,
      customerEmail: session.customer_details?.email || session.customer_email || '',
      appointmentId: fulfillment.appointmentId,
      appointmentRecordId: appointment?.id || session.metadata?.appointmentRecordId || null,
      fulfillmentStatus: fulfillment.fulfillmentStatus || null,
      pendingFulfillment: paid && !fulfillment.appointmentId && fulfillment.fulfillmentStatus !== 'acuity_failed',
      fulfillmentError: fulfillment.fulfillmentError || null,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Could not verify checkout session',
      paid: false,
    });
  }
}
