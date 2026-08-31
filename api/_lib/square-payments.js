import crypto from 'crypto';

export const SQUARE_PAYMENT_EVENTS = new Set(['payment.created', 'payment.updated']);
export const SQUARE_REFUND_EVENTS = new Set(['refund.created', 'refund.updated']);

export function squareWebhookSignature({ rawBody, signature, signatureKey, notificationUrl }) {
  if (!rawBody || !signature || !signatureKey || !notificationUrl) return false;
  const expected = crypto.createHmac('sha256', signatureKey)
    .update(`${notificationUrl}${rawBody}`, 'utf8')
    .digest('base64');
  const suppliedBuffer = Buffer.from(String(signature), 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return suppliedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function readRawBody(req, maxBytes = 512 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw Object.assign(new Error('Webhook body is too large.'), { status: 413, code: 'body_too_large' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function paymentObject(event = {}) {
  return event?.data?.object?.payment || null;
}

function refundObject(event = {}) {
  return event?.data?.object?.refund || null;
}

export function normalizeSquarePayment(event = {}) {
  const payment = paymentObject(event);
  if (!payment?.id) return null;
  const amount = payment.amount_money || {};
  const refunded = payment.refunded_money || {};
  return {
    provider: 'square',
    provider_payment_id: String(payment.id),
    provider_order_id: payment.order_id || null,
    provider_customer_id: payment.customer_id || null,
    merchant_id: event.merchant_id || null,
    location_id: payment.location_id || null,
    amount_cents: Math.max(0, Number(amount.amount) || 0),
    refunded_cents: Math.max(0, Number(refunded.amount) || 0),
    currency: String(amount.currency || refunded.currency || 'USD').toUpperCase(),
    status: String(payment.status || 'UNKNOWN').toLowerCase(),
    refund_status: Number(refunded.amount || 0) > 0
      ? Number(refunded.amount) >= Number(amount.amount || 0) ? 'refunded' : 'partial'
      : 'none',
    source: String(payment.source_type || 'unknown').toLowerCase(),
    processed_at: payment.updated_at || payment.created_at || event.created_at || new Date().toISOString(),
    raw_summary: {
      referenceId: payment.reference_id || null,
      receiptUrl: payment.receipt_url || null,
      receiptNumber: payment.receipt_number || null,
      versionToken: payment.version_token || null,
    },
  };
}

export function normalizeSquareRefund(event = {}) {
  const refund = refundObject(event);
  if (!refund?.id || !refund?.payment_id) return null;
  const amount = refund.amount_money || {};
  return {
    provider: 'square',
    provider_refund_id: String(refund.id),
    provider_payment_id: String(refund.payment_id),
    amount_cents: Math.max(0, Number(amount.amount) || 0),
    currency: String(amount.currency || 'USD').toUpperCase(),
    status: String(refund.status || 'UNKNOWN').toLowerCase(),
    reason: String(refund.reason || '').slice(0, 240) || null,
    processed_at: refund.updated_at || refund.created_at || event.created_at || new Date().toISOString(),
  };
}

export function squareEventHash(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

export function squareMatchKeys(payment = {}) {
  return [...new Set([
    payment.provider_order_id,
    payment.raw_summary?.referenceId,
  ].map((value) => String(value || '').trim()).filter(Boolean))];
}

