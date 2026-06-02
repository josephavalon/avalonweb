import Stripe from 'stripe';
import { isLiveApiEnabled } from '../_lib/pre-api-guard.js';
import { getSupabaseServiceClient } from '../_supabase-server.js';

async function findAppointmentForSession(session) {
  const db = await getSupabaseServiceClient();
  if (!db) return null;

  const columns = 'id, acuity_appointment_id, stripe_checkout_session_id, payment_status, status';
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
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    const appointment = paid ? await findAppointmentForSession(session) : null;
    const appointmentId = appointment?.acuity_appointment_id || session.metadata?.acuityAppointmentId || null;

    return res.status(paid ? 200 : 402).json({
      paid,
      status: session.status,
      paymentStatus: session.payment_status,
      mode: session.mode,
      customerEmail: session.customer_details?.email || session.customer_email || '',
      appointmentId,
      appointmentRecordId: appointment?.id || session.metadata?.appointmentRecordId || null,
      fulfillmentStatus: appointment?.status || null,
      pendingFulfillment: paid && !appointmentId,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Could not verify checkout session',
      paid: false,
    });
  }
}
