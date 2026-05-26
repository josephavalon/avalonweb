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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gate = requireLiveWebhook(req, res, {
    provider: 'Stripe',
    secretEnv: 'STRIPE_WEBHOOK_SECRET',
  });
  if (!gate.ok) return null;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    const reconciliationCaseType = reconciliationTypeForStripeEvent(event);

    const actions = {
      'checkout.session.completed': 'mark_booking_paid_and_confirm',
      'checkout.session.expired': 'release_scheduling_hold',
      'customer.subscription.created': 'sync_membership_active',
      'customer.subscription.updated': 'sync_membership_status',
      'customer.subscription.deleted': 'sync_membership_cancelled',
    };

    return res.status(200).json({
      received: true,
      id: event.id,
      type: event.type,
      action: actions[event.type] || 'store_for_audit',
      reconciliationCaseType,
      needsPersistence: true,
      note: 'Webhook signature is validated. Database writes attach when Supabase is connected.',
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid Stripe webhook' });
  }
}
