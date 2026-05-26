import Stripe from 'stripe';
import { isLiveApiEnabled } from '../_lib/pre-api-guard.js';

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
    return res.status(paid ? 200 : 402).json({
      paid,
      status: session.status,
      paymentStatus: session.payment_status,
      mode: session.mode,
      customerEmail: session.customer_details?.email || session.customer_email || '',
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Could not verify checkout session',
      paid: false,
    });
  }
}
