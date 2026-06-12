/**
 * POST /api/order-lookup — redeem a post-checkout order number.
 *
 * Body: { orderNumber: "AV-7K4M2Q", email: "client@example.com", phone: "4155550199" }
 *
 * The order number alone is not enough — require both email and phone on the
 * booking so a leaked code plus one guessed contact field cannot expose details.
 * Returns visit status, schedule, and any balance still due. Powers the public
 * /order "manage your order" page.
 */

import { getSupabaseServiceClient } from './_supabase-server.js';
import { checkRateLimit, clientIp } from './_lib/rate-limit.js';

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

const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
};

const MAX_LEN = {
  orderNumber: 16,
  email: 254,
  phone: 40,
};

function boundedString(value, max) {
  const raw = String(value || '').trim();
  return { value: raw, tooLong: raw.length > max };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const limit = await checkRateLimit({
    key: `order-lookup:${clientIp(req)}`,
    windowMs: RATE_LIMIT.windowMs,
    max: RATE_LIMIT.max,
  });
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many order lookup attempts. Please try again shortly.' });
  }

  const body = req.body || {};
  const orderInput = boundedString(body.orderNumber, MAX_LEN.orderNumber);
  const emailInput = boundedString(body.email, MAX_LEN.email);
  const phoneInput = boundedString(body.phone, MAX_LEN.phone);
  if (orderInput.tooLong || emailInput.tooLong || phoneInput.tooLong) {
    return res.status(400).json({ error: 'Order lookup fields are too long.', code: 'input_too_long' });
  }

  const code = orderInput.value.toUpperCase();
  const email = normalizeEmail(emailInput.value);
  const phone = normalizePhone(phoneInput.value);

  if (!/^AV-[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter a valid order number, like AV-7K4M2Q.' });
  }
  if (!email || !phone) {
    return res.status(400).json({ error: 'Enter both the email and phone on your booking.', code: 'contact_verification_required' });
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

  const phoneMatch = phone === normalizePhone(record.customer_phone);
  const emailMatch = email === normalizeEmail(record.customer_email);
  if (!phoneMatch || !emailMatch) {
    return res.status(403).json({ error: 'Those details do not match this order.' });
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
