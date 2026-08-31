import {
  normalizeSquarePayment,
  normalizeSquareRefund,
  readRawBody,
  squareEventHash,
  squareMatchKeys,
  squareWebhookSignature,
  SQUARE_PAYMENT_EVENTS,
  SQUARE_REFUND_EVENTS,
} from '../../_lib/square-payments.js';
import { postBalancedLedger } from '../../_lib/operational-workflows.js';
import { getDefaultTenantId, getSupabaseServiceClient } from '../../_supabase-server.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export const config = { api: { bodyParser: false } };

function matchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function appointmentKeys(row = {}) {
  const payload = row.external_payload || {};
  return [
    row.id, row.order_number, payload.squareOrderId, payload.square_order_id,
    payload.referenceId, payload.reference_id, payload.appointmentId, payload.bookingId,
  ].map(matchValue).filter(Boolean);
}

async function findAutomaticMatch(db, tenantId, payment) {
  const keys = squareMatchKeys(payment).map(matchValue);
  if (!keys.length) return null;
  const appointmentsResult = await db.from('appointments')
    .select('id, order_number, external_payload').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).limit(1000);
  if (!appointmentsResult.error) {
    const appointment = (appointmentsResult.data || []).find((row) => appointmentKeys(row).some((key) => keys.includes(key)));
    if (appointment) return { appointment_id: appointment.id, reconciliation_status: 'matched', match_method: 'exact_reference', match_confidence: 1 };
  }
  const eventResult = await db.from('event_containers').select('id, slug').eq('tenant_id', tenantId).limit(500);
  if (!eventResult.error) {
    const event = (eventResult.data || []).find((row) => [row.id, row.slug].map(matchValue).some((key) => keys.includes(key)));
    if (event) return { event_container_id: event.id, reconciliation_status: 'matched', match_method: 'exact_event_reference', match_confidence: 1 };
  }
  return null;
}

async function processPayment(db, tenantId, event) {
  const normalized = normalizeSquarePayment(event);
  if (!normalized) return { ignored: true, reason: 'missing_payment' };
  const existing = await db.from('client_payments').select('*').eq('tenant_id', tenantId)
    .eq('provider', 'square').eq('provider_payment_id', normalized.provider_payment_id).maybeSingle();
  if (existing.error) throw existing.error;
  const lockedManualMatch = existing.data && ['manual', 'ignored'].includes(existing.data.match_method);
  const automatic = lockedManualMatch ? null : await findAutomaticMatch(db, tenantId, normalized);
  const association = lockedManualMatch ? {
    appointment_id: existing.data.appointment_id,
    event_container_id: existing.data.event_container_id,
    event_service_id: existing.data.event_service_id,
    invoice_reference: existing.data.invoice_reference,
    reconciliation_status: existing.data.reconciliation_status,
    match_method: existing.data.match_method,
    match_confidence: existing.data.match_confidence,
  } : automatic || {
    reconciliation_status: 'unmatched', match_method: null, match_confidence: null,
  };
  const row = { tenant_id: tenantId, ...normalized, ...association, version: Number(existing.data?.version || 0) + 1 };
  const upsert = await db.from('client_payments').upsert(row, {
    onConflict: 'tenant_id,provider,provider_payment_id',
  }).select('*').single();
  if (upsert.error) throw upsert.error;
  if (normalized.status === 'completed') {
    await postBalancedLedger(db, {
      tenantId, sourceType: 'square_payment', sourceId: normalized.provider_payment_id,
      occurredAt: normalized.processed_at, amountCents: normalized.amount_cents,
      currency: normalized.currency,
      debit: { account_code: '1000', account_name: 'Cash clearing', account_type: 'asset' },
      credit: { account_code: '4000', account_name: 'Client service revenue', account_type: 'revenue' },
      memo: 'Square client payment', dimensions: { provider: 'square', location_id: normalized.location_id },
    });
  }
  return { payment: upsert.data, ignored: false };
}

async function processRefund(db, tenantId, event) {
  const normalized = normalizeSquareRefund(event);
  if (!normalized) return { ignored: true, reason: 'missing_refund' };
  const paymentResult = await db.from('client_payments').select('id, amount_cents')
    .eq('tenant_id', tenantId).eq('provider', 'square')
    .eq('provider_payment_id', normalized.provider_payment_id).maybeSingle();
  if (paymentResult.error) throw paymentResult.error;
  const upsert = await db.from('client_payment_refunds').upsert({
    tenant_id: tenantId, payment_id: paymentResult.data?.id || null, ...normalized,
  }, { onConflict: 'tenant_id,provider,provider_refund_id' }).select('*').single();
  if (upsert.error) throw upsert.error;
  if (paymentResult.data?.id) {
    const refunds = await db.from('client_payment_refunds').select('amount_cents, status')
      .eq('tenant_id', tenantId).eq('provider_payment_id', normalized.provider_payment_id);
    if (refunds.error) throw refunds.error;
    const completedCents = (refunds.data || []).filter((row) => row.status === 'completed')
      .reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
    const refundStatus = completedCents <= 0 ? normalized.status === 'failed' ? 'failed' : 'pending'
      : completedCents >= Number(paymentResult.data.amount_cents || 0) ? 'refunded' : 'partial';
    await db.from('client_payments').update({ refunded_cents: completedCents, refund_status: refundStatus })
      .eq('tenant_id', tenantId).eq('id', paymentResult.data.id);
  }
  if (normalized.status === 'completed') {
    await postBalancedLedger(db, {
      tenantId, sourceType: 'square_refund', sourceId: normalized.provider_refund_id,
      occurredAt: normalized.processed_at, amountCents: normalized.amount_cents,
      currency: normalized.currency,
      debit: { account_code: '4090', account_name: 'Client refunds', account_type: 'revenue' },
      credit: { account_code: '1000', account_name: 'Cash clearing', account_type: 'asset' },
      memo: 'Square client refund', dimensions: { provider: 'square', payment_id: normalized.provider_payment_id },
    });
  }
  return { refund: upsert.data, ignored: false };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let rawBody = '';
  let event = null;
  let eventRowId = null;
  try {
    rawBody = await readRawBody(req);
    const signature = req.headers?.['x-square-hmacsha256-signature'];
    const notificationUrl = String(process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || '');
    const signatureKey = String(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '');
    if (!signatureKey || !notificationUrl) return res.status(503).json({ error: 'Square webhook is not configured.' });
    if (!squareWebhookSignature({ rawBody, signature, signatureKey, notificationUrl })) {
      return res.status(403).json({ error: 'Invalid Square signature.' });
    }
    event = JSON.parse(rawBody);
    if (!event?.event_id || !event?.type) return res.status(400).json({ error: 'Invalid Square event.' });
    const db = await getSupabaseServiceClient();
    if (!db) return res.status(503).json({ error: 'Database is not configured.' });
    const tenantId = await getDefaultTenantId(db);
    if (!tenantId) return res.status(503).json({ error: 'Avalon tenant is not configured.' });

    const inserted = await db.from('payment_webhook_events').insert({
      tenant_id: tenantId, provider: 'square', provider_event_id: event.event_id,
      event_type: event.type, payload_hash: squareEventHash(rawBody), processing_status: 'received',
    }).select('id').maybeSingle();
    if (inserted.error) {
      if (inserted.error.code === '23505') {
        const prior = await db.from('payment_webhook_events').select('id, payload_hash, processing_status')
          .eq('tenant_id', tenantId).eq('provider', 'square').eq('provider_event_id', event.event_id).maybeSingle();
        if (prior.error) throw prior.error;
        if (!prior.data || prior.data.payload_hash !== squareEventHash(rawBody)) {
          return res.status(409).json({ error: 'Square event id was reused with a different payload.' });
        }
        if (['processed', 'ignored'].includes(prior.data.processing_status)) {
          return res.status(200).json({ ok: true, duplicate: true });
        }
        eventRowId = prior.data.id;
        await db.from('payment_webhook_events').update({ processing_status: 'received', error_code: null, processed_at: null }).eq('id', eventRowId);
      } else {
        throw inserted.error;
      }
    }
    if (!eventRowId) eventRowId = inserted.data?.id || null;
    let result;
    if (SQUARE_PAYMENT_EVENTS.has(event.type)) result = await processPayment(db, tenantId, event);
    else if (SQUARE_REFUND_EVENTS.has(event.type)) result = await processRefund(db, tenantId, event);
    else result = { ignored: true, reason: 'unsupported_event' };
    await db.from('payment_webhook_events').update({
      processing_status: result.ignored ? 'ignored' : 'processed', processed_at: new Date().toISOString(),
    }).eq('id', eventRowId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.warn('[square/webhook] failed', safeLogContext(error, 'square_webhook_failed'));
    if (eventRowId) {
      try {
        const db = await getSupabaseServiceClient();
        await db?.from('payment_webhook_events').update({ processing_status: 'failed', error_code: safeErrorCode(error), processed_at: new Date().toISOString() }).eq('id', eventRowId);
      } catch { /* the original failure is the useful one */ }
    }
    return res.status(error.status || 500).json({ error: 'Square webhook processing failed.', code: safeErrorCode(error, 'square_webhook_failed') });
  }
}
