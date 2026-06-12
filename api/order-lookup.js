/**
 * POST /api/order-lookup — redeem a post-checkout order number.
 *
 * Body: { orderNumber: "AV-7K4M2Q", contact: "<phone or email on the booking>" }
 *
 * The order number alone is not enough — we require a matching phone/email so a
 * leaked code can't expose someone's booking. Returns the visit status, schedule,
 * and any balance still due. Powers the public /order "manage your order" page.
 */

import { getSupabaseServiceClient } from './_supabase-server.js';

const COLUMNS = [
  'id',
  'order_number',
  'status',
  'payment_status',
  'protocol_key',
  'starts_at',
  'visit_subtotal_cents',
  'deposit_amount_cents',
  'balance_due_cents',
  'customer_email',
  'customer_phone',
].join(', ');

const normalizePhone = (v) => String(v || '').replace(/\D/g, '').slice(-10);
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const code = String(body.orderNumber || '').trim().toUpperCase();
  const verifier = String(body.contact || '').trim();

  if (!/^AV-[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter a valid order number, like AV-7K4M2Q.' });
  }
  if (!verifier) {
    return res.status(400).json({ error: 'Enter the phone or email on your booking.' });
  }

  const db = await getSupabaseServiceClient();
  if (!db) {
    return res.status(503).json({ error: 'Order lookup is not available yet.' });
  }

  let record;
  try {
    const { data, error } = await db
      .from('appointments')
      .select(COLUMNS)
      .eq('order_number', code)
      .maybeSingle();
    if (error) throw error;
    record = data;
  } catch {
    return res.status(500).json({ error: 'Could not look up that order. Try again shortly.' });
  }

  if (!record) {
    return res.status(404).json({ error: 'No order found with that number.' });
  }

  const phoneMatch = normalizePhone(verifier) && normalizePhone(verifier) === normalizePhone(record.customer_phone);
  const emailMatch = normalizeEmail(verifier) && normalizeEmail(verifier) === normalizeEmail(record.customer_email);
  if (!phoneMatch && !emailMatch) {
    return res.status(403).json({ error: 'That phone or email does not match this order.' });
  }

  return res.status(200).json({
    orderNumber: record.order_number,
    status: record.status || 'pending',
    paymentStatus: record.payment_status || 'pending',
    protocol: record.protocol_key || '',
    startsAt: record.starts_at || null,
    subtotalCents: record.visit_subtotal_cents ?? null,
    depositCents: record.deposit_amount_cents ?? null,
    balanceDueCents: record.balance_due_cents ?? null,
    appointmentId: record.id,
  });
}
