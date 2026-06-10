/**
 * POST /api/admin/collect-balance
 *
 * Admin dashboard action to collect a visit's remaining balance. Admin-only
 * (verified Supabase session, profiles.role = 'admin'). Shares the Stripe logic
 * with /api/charge-balance via _lib/balance-core.js.
 *
 * Body: {
 *   appointmentId?: string,        // internal appointments.id (preferred)
 *   acuityAppointmentId?: string,  // fallback lookup key
 *   amountCentsOverride?: number,
 *   mode?: 'charge' | 'link'       // default 'charge' (off-session saved card)
 * }
 */

import Stripe from 'stripe';
import { requireAdmin } from '../_lib/supabase-auth.js';
import { collectBalance } from '../_lib/balance-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const { appointmentId, acuityAppointmentId, amountCentsOverride } = req.body || {};
  if (!appointmentId && !acuityAppointmentId) {
    return res.status(400).json({ error: 'appointmentId or acuityAppointmentId is required' });
  }
  const mode = (req.body?.mode || 'charge') === 'link' ? 'link' : 'charge';

  const { db } = authed;
  let lookup = db.from('appointments')
    .select('id, stripe_customer_id, stripe_payment_method_id, balance_due_cents, payment_status, currency, acuity_appointment_id');
  lookup = appointmentId
    ? lookup.eq('id', appointmentId)
    : lookup.eq('acuity_appointment_id', String(acuityAppointmentId));

  const { data: appt, error: lookupErr } = await lookup.maybeSingle();
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
  const result = await collectBalance({
    stripe,
    db,
    appt,
    amount,
    mode,
    currency: appt.currency || 'usd',
    baseUrl,
    acuityAppointmentId: appt.acuity_appointment_id || acuityAppointmentId || appt.id,
  });
  return res.status(result.httpStatus).json(result.json);
}
