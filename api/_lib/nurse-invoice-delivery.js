import { Resend } from 'resend';

export const NURSE_INVOICE_DELIVERY_MAX_ATTEMPTS = 5;
export const NURSE_INVOICE_DELIVERY_LEASE_SECONDS = 10 * 60;

const BACKOFF_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
];
const INTERNAL_AVALON_EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@avalonvitality\.co$/i;

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function financeRecipients() {
  const values = String(process.env.FINANCE_NOTIFICATION_RECIPIENTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!values.length || values.some((value) => !INTERNAL_AVALON_EMAIL_RE.test(value))) return [];
  return [...new Set(values)];
}

export function nurseInvoiceNotificationConfiguration() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim()
    || (isProductionRuntime() ? '' : 'Avalon Invoices <onboarding@resend.dev>');
  const recipients = financeRecipients();
  if (!apiKey) return { ready: false, reason: 'resend_not_configured' };
  if (!from) return { ready: false, reason: 'resend_from_email_missing' };
  if (!recipients.length) return { ready: false, reason: 'finance_recipients_not_configured' };
  return { ready: true, apiKey, from, recipients };
}

export function deliveryRetryDelayMs(attemptCount) {
  const index = Math.max(0, Math.min(BACKOFF_MS.length - 1, Number(attemptCount || 1) - 1));
  return BACKOFF_MS[index];
}

function safeDeliveryErrorCode(error) {
  return String(error?.code || error?.name || 'invoice_notification_failed')
    .trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 100)
    || 'invoice_notification_failed';
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function currentDeliveryState(db, { tenantId, invoiceId }) {
  let query = db.from('nurse_invoices')
    .select('id, delivery_status, delivery_attempt_count, delivery_next_retry_at, delivery_last_error_code')
    .eq('id', invoiceId);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return { outcome: 'not_found', invoiceId };
  const status = result.data.delivery_status;
  const outcome = status === 'sent' ? 'sent'
    : status === 'exhausted' ? 'exhausted'
      : status === 'sending' ? 'processing'
        : status === 'failed' ? 'retry_scheduled' : 'queued';
  return {
    outcome,
    invoiceId,
    status,
    attemptCount: Number(result.data.delivery_attempt_count || 0),
    nextRetryAt: result.data.delivery_next_retry_at || null,
    errorCode: result.data.delivery_last_error_code || null,
  };
}
async function failDeliveryClaim(db, invoice, error) {
  const attemptCount = Number(invoice.delivery_attempt_count || 0);
  const exhausted = attemptCount >= NURSE_INVOICE_DELIVERY_MAX_ATTEMPTS;
  const nextRetryAt = exhausted ? null : new Date(Date.now() + deliveryRetryDelayMs(attemptCount)).toISOString();
  const errorCode = safeDeliveryErrorCode(error);
  const failed = await db.from('nurse_invoices').update({
    delivery_status: exhausted ? 'exhausted' : 'failed',
    delivery_claimed_at: null,
    delivery_claim_token: null,
    delivery_next_retry_at: nextRetryAt,
    delivery_last_error_code: errorCode,
  })
    .eq('tenant_id', invoice.tenant_id)
    .eq('id', invoice.id)
    .eq('delivery_claim_token', invoice.delivery_claim_token)
    .select('id').maybeSingle();
  if (failed.error) throw failed.error;
  if (!failed.data) return currentDeliveryState(db, { tenantId: invoice.tenant_id, invoiceId: invoice.id });
  return {
    outcome: exhausted ? 'exhausted' : 'retry_scheduled',
    invoiceId: invoice.id,
    status: exhausted ? 'exhausted' : 'failed',
    attemptCount,
    nextRetryAt,
    errorCode,
  };
}

/**
 * Claims and sends one generic internal Finance alert. No nurse identity,
 * invoice amount, invoice number, line item, or receipt data leaves Avalon.
 * Finance staff must sign in to the protected admin queue for those details.
 */
export async function deliverNurseInvoiceNotification(db, { tenantId = null, invoiceId = null } = {}) {
  const configuration = nurseInvoiceNotificationConfiguration();
  if (!configuration.ready) {
    return { outcome: 'not_configured', invoiceId, status: 'pending', errorCode: configuration.reason };
  }
  const claim = await db.rpc('claim_nurse_invoice_notification', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_lease_seconds: NURSE_INVOICE_DELIVERY_LEASE_SECONDS,
    p_max_attempts: NURSE_INVOICE_DELIVERY_MAX_ATTEMPTS,
  });
  if (claim.error) throw claim.error;
  const invoice = firstRow(claim.data);
  if (!invoice) {
    return invoiceId
      ? currentDeliveryState(db, { tenantId, invoiceId })
      : { outcome: 'idle', invoiceId: null, status: null };
  }

  let providerResult;
  try {
    const resend = new Resend(configuration.apiKey);
    providerResult = await resend.emails.send({
      from: configuration.from,
      to: configuration.recipients,
      subject: 'New invoice waiting in Avalon Finance',
      html: '<p>A new contractor invoice is stored in Avalon Finance.</p><p>Sign in to Avalon Admin and open <strong>Finance → Nurse invoices</strong> to review it. Receipts, if any, remain private and quarantined until an approved scanner clears them.</p>',
      text: 'A new contractor invoice is stored in Avalon Finance. Sign in to Avalon Admin and open Finance > Nurse invoices to review it. Receipts, if any, remain private and quarantined until an approved scanner clears them.',
    }, {
      idempotencyKey: `avalon-nurse-invoice-${invoice.id}`,
    });
    if (providerResult?.error) throw providerResult.error;
  } catch (error) {
    return failDeliveryClaim(db, invoice, error);
  }

  const delivered = await db.from('nurse_invoices').update({
    delivery_status: 'sent',
    delivery_claimed_at: null,
    delivery_claim_token: null,
    delivery_next_retry_at: null,
    delivery_last_error_code: null,
    delivery_sent_at: new Date().toISOString(),
    delivery_provider_message_id: providerResult?.data?.id || null,
  })
    .eq('tenant_id', invoice.tenant_id)
    .eq('id', invoice.id)
    .eq('delivery_claim_token', invoice.delivery_claim_token)
    .select('id').maybeSingle();
  if (delivered.error) {
    return {
      outcome: 'reconciliation_required',
      invoiceId: invoice.id,
      status: 'sending',
      attemptCount: Number(invoice.delivery_attempt_count || 0),
      errorCode: 'delivery_finalize_failed',
    };
  }
  if (!delivered.data) return currentDeliveryState(db, { tenantId: invoice.tenant_id, invoiceId: invoice.id });
  return {
    outcome: 'sent',
    invoiceId: invoice.id,
    status: 'sent',
    attemptCount: Number(invoice.delivery_attempt_count || 0),
    providerMessageId: providerResult?.data?.id || null,
  };
}
