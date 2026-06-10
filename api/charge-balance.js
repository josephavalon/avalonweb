/**
 * POST /api/charge-balance
 *
 * Nurse-triggered (no portal): charges the remaining appointment balance to the
 * card saved on file at deposit time. Off-session. If the card needs SCA
 * authentication, returns a Stripe-hosted link for the client to complete.
 *
 * Auth: behind AVALON_INTERNAL_API_SECRET + AVALON_ENABLE_LIVE_API (via
 * requireInternalAccess). Never callable from the public client bundle.
 *
 * Body: { acuityAppointmentId: string, amountCentsOverride?: number }
 */

import Stripe from 'stripe';
import { requireInternalAccess } from './_lib/pre-api-guard.js';
import { collectBalance } from './_lib/balance-core.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Live-flag + internal-secret gate. In pre-API mode this returns the hard wall.
  if (!requireInternalAccess(req, res, 'Charge appointment balance')) return;

  const { acuityAppointmentId, amountCentsOverride } = req.body || {};
  if (!acuityAppointmentId) {
    return res.status(400).json({ error: 'acuityAppointmentId is required' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const db = await getSupabase();
  if (!db) {
    return res.status(503).json({ error: 'Database is not configured', code: 'db_not_configured' });
  }

  const { data: appt, error: lookupErr } = await db.from('appointments')
    .select('id, stripe_customer_id, stripe_payment_method_id, balance_due_cents, payment_status, currency')
    .eq('acuity_appointment_id', String(acuityAppointmentId))
    .maybeSingle();

  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  if (appt.payment_status === 'paid_in_full') {
    return res.status(409).json({ error: 'Balance already paid', code: 'already_paid' });
  }

  const amount = Number(amountCentsOverride || appt.balance_due_cents || 0);
  if (!amount || amount < 50) {
    return res.status(400).json({ error: 'No balance due to charge', code: 'no_balance' });
  }
  if (!appt.stripe_customer_id) {
    return res.status(409).json({ error: 'No customer on file', code: 'no_customer' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const baseUrl = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const mode = (req.body?.mode || 'charge') === 'link' ? 'link' : 'charge';

  // Shared with /api/admin/collect-balance so both paths charge identically.
  const result = await collectBalance({
    stripe,
    db,
    appt,
    amount,
    mode,
    currency: appt.currency || 'usd',
    baseUrl,
    acuityAppointmentId,
  });
  return res.status(result.httpStatus).json(result.json);
}
