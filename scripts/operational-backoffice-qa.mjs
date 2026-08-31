import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { expandShiftOccurrences, zonedLocalToIso } from '../api/_lib/operational-workflows.js';
import { normalizeSquarePayment, normalizeSquareRefund, squareWebhookSignature } from '../api/_lib/square-payments.js';

const spring = expandShiftOccurrences({
  startDate: '2026-03-02', startTime: '09:00', endTime: '17:00', timezone: 'America/Los_Angeles',
  recurrence: { mode: 'weekly', weekdays: [1], untilDate: '2026-03-16' },
});
assert.equal(spring.length, 3, 'weekly recurrence should create each selected weekday');
assert.equal(spring[0].startsAt, '2026-03-02T17:00:00.000Z', 'pre-DST wall time should use PST');
assert.equal(spring[1].startsAt, '2026-03-09T16:00:00.000Z', 'post-DST wall time should stay at 9am PDT');
assert.equal(zonedLocalToIso('2026-11-09', '09:00', 'America/Los_Angeles'), '2026-11-09T17:00:00.000Z');

const body = JSON.stringify({ event_id: 'evt_1', type: 'payment.updated' });
const key = 'signature-key';
const url = 'https://beta.avalonvitality.co/api/integrations/square/webhook';
const signature = crypto.createHmac('sha256', key).update(`${url}${body}`).digest('base64');
assert.equal(squareWebhookSignature({ rawBody: body, signature, signatureKey: key, notificationUrl: url }), true);
assert.equal(squareWebhookSignature({ rawBody: `${body} `, signature, signatureKey: key, notificationUrl: url }), false, 'signature must bind the exact raw body');

const payment = normalizeSquarePayment({ event_id: 'evt_1', merchant_id: 'merchant', data: { object: { payment: { id: 'pay_1', status: 'COMPLETED', order_id: 'order_1', amount_money: { amount: 12500, currency: 'USD' }, refunded_money: { amount: 2500, currency: 'USD' }, updated_at: '2026-08-14T12:00:00Z' } } } });
assert.equal(payment.amount_cents, 12500);
assert.equal(payment.status, 'completed');
assert.equal(payment.refund_status, 'partial');
const refund = normalizeSquareRefund({ data: { object: { refund: { id: 'refund_1', payment_id: 'pay_1', status: 'COMPLETED', amount_money: { amount: 2500, currency: 'USD' } } } } });
assert.equal(refund.provider_payment_id, 'pay_1');

const migration = fs.readFileSync(new URL('../supabase/migrations/044_operational_backoffice.sql', import.meta.url), 'utf8');
for (const table of ['operational_shifts', 'operational_shift_assignments', 'nurse_invoices', 'nurse_invoice_lines', 'client_payments', 'payment_webhook_events']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} must be migrated`);
}
assert.match(migration, /for update;/, 'shift claiming must lock the shift row');
assert.match(migration, /enable row level security/g, 'operational tables must enable RLS');
assert.match(migration, /unique \(tenant_id, provider, provider_event_id\)/, 'Square events must be idempotent');

const invoiceApi = fs.readFileSync(new URL('../api/invoice/submit.js', import.meta.url), 'utf8');
assert.match(invoiceApi, /computeInvoice\(\{ shifts, expenses \}\)/, 'server invoice calculator must remain authoritative');
assert.match(invoiceApi, /nurse_invoice_lines/, 'invoice submissions must persist their lines');
assert.match(invoiceApi, /linkedShiftById/, 'invoice lines must tenant-validate shift links');
const webhookApi = fs.readFileSync(new URL('../api/integrations/square/webhook.js', import.meta.url), 'utf8');
assert.match(webhookApi, /bodyParser: false/, 'Square signature validation requires the raw request body');
assert.match(webhookApi, /processing_status.*failed/s, 'failed Square events must be retryable');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
for (const route of ['/provider/shifts', '/provider/invoices', '/admin/scheduling', '/admin/client-payments', '/admin/nurse-invoices', '/admin/accounting']) {
  assert.match(app, new RegExp(route.replaceAll('/', '\\/')), `${route} must be routed`);
}

console.log('Operational backoffice QA passed: DST recurrence, Square signatures, persistence, tenant links, RLS, idempotency, and routes verified.');
