/**
 * GET /api/me/appointments
 *
 * The signed-in client's own visits. Booking is anonymous (no login required),
 * so appointments are matched to the caller by the email on their Supabase
 * session — the same email they used at checkout. Auth is the user's Supabase
 * access token (Authorization: Bearer …); see _lib/supabase-auth.js.
 */

import { getAuthedUser } from '../_lib/supabase-auth.js';

// Escape LIKE wildcards so an email containing `_` or `%` matches literally.
function likeLiteral(value) {
  return String(value).replace(/([\\%_])/g, '\\$1');
}

function dollarsFromCents(cents) {
  if (cents == null) return null;
  return Math.round(Number(cents)) / 100;
}

// Shape to a safe summary — never leak the raw external_payload (dob, address…).
function shapeAppointment(row) {
  const payload = row.external_payload || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    id: row.id,
    status: row.status,
    startsAt: row.starts_at,
    service: payload.primaryService || row.protocol_key || 'Avalon Visit',
    items: items.map((it) => it?.name || it?.title).filter(Boolean).slice(0, 12),
    isMembership: !!payload.membership,
    paymentStatus: row.payment_status,
    visitSubtotal: dollarsFromCents(row.visit_subtotal_cents),
    depositPaid: dollarsFromCents(row.deposit_amount_cents),
    balanceDue: dollarsFromCents(row.balance_due_cents),
    depositPaidAt: row.deposit_paid_at,
    balancePaidAt: row.balance_paid_at,
    acuityAppointmentId: row.acuity_appointment_id,
    createdAt: row.created_at,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  if (!authed.email) return res.status(200).json({ appointments: [] });

  const { db, email } = authed;
  const { data, error } = await db.from('appointments')
    .select('id, status, starts_at, protocol_key, payment_status, visit_subtotal_cents, deposit_amount_cents, balance_due_cents, deposit_paid_at, balance_paid_at, acuity_appointment_id, external_payload, created_at')
    .ilike('external_payload->contact->>email', likeLiteral(email))
    .order('starts_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ appointments: (data || []).map(shapeAppointment) });
}
