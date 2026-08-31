import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  invoiceRequestHash,
  receiptStoragePath,
  sharedDoorIdentityAssurance,
  sniffReceiptType,
  validSubmissionUuid,
} from '../api/_lib/nurse-invoice-store.js';
import {
  deliveryRetryDelayMs,
  nurseInvoiceNotificationConfiguration,
} from '../api/_lib/nurse-invoice-delivery.js';

const migration = fs.readFileSync(new URL('../supabase/migrations/047_finance_nurse_invoices.sql', import.meta.url), 'utf8');
const submitApi = fs.readFileSync(new URL('../api/invoice/submit.js', import.meta.url), 'utf8');
const adminApi = fs.readFileSync(new URL('../api/admin/nurse-invoices.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../app-modules/pages/NurseInvoice.jsx', import.meta.url), 'utf8');
const adminClient = fs.readFileSync(new URL('../app-modules/pages/admin/NurseInvoices.jsx', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../api/_lib/nurse-invoice-store.js', import.meta.url), 'utf8');
const documentBuilder = fs.readFileSync(new URL('../src/data/invoiceDocument.js', import.meta.url), 'utf8');
const delivery = fs.readFileSync(new URL('../api/_lib/nurse-invoice-delivery.js', import.meta.url), 'utf8');
const deliveryCron = fs.readFileSync(new URL('../api/cron/nurse-invoice-notifications.js', import.meta.url), 'utf8');
const vercel = fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

for (const table of ['nurse_invoices', 'nurse_invoice_lines', 'nurse_invoice_receipts']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} must be migrated`);
}
assert.match(migration, /unique \(tenant_id, submission_id\)/, 'submission UUID must be tenant-idempotent');
assert.match(migration, /status in \('quarantined', 'submitted', 'approved', 'correction_required', 'paid', 'rejected'\)/, 'review lifecycle must be constrained');
assert.match(migration, /public = false/, 'receipt storage must be private');
assert.match(migration, /prevent_nurse_invoice_financial_mutation/, 'submitted financial fields must be immutable');
assert.match(migration, /create_nurse_invoice/, 'header and computed lines must use an atomic database function');
assert.match(migration, /nurse_invoice_metrics/, 'queue metrics must use an exact database aggregate');
assert.match(migration, /delivery_claimed_at timestamptz/, 'delivery claims must have a recoverable lease timestamp');
assert.match(migration, /delivery_claim_token uuid/, 'delivery completion must be fenced to its active claim');
assert.match(migration, /delivery_attempt_count integer not null default 0/, 'delivery retries must be durably counted');
assert.match(migration, /delivery_next_retry_at timestamptz/, 'delivery backoff must survive function restarts');
assert.match(migration, /delivery_status in \('pending', 'sending', 'sent', 'failed', 'exhausted'\)/, 'delivery attempts must have a terminal exhausted state');
assert.match(migration, /claim_nurse_invoice_notification/, 'a server worker must claim persisted invoice alerts');
assert.match(migration, /for update skip locked/, 'concurrent workers must not claim the same invoice');
assert.match(migration, /delivery_attempt_count < p_max_attempts/, 'database claims must enforce the attempt ceiling');
assert.match(migration, /delivery_reconciliation_window_expired/, 'uncertain sends must not retry beyond the provider idempotency window');
assert.match(migration, /revoke all on function public\.create_nurse_invoice.*anon, authenticated/, 'invoice creation RPC must be service-role-only');
assert.match(migration, /revoke all on public\.nurse_invoices, public\.nurse_invoice_lines, public\.nurse_invoice_receipts from anon, authenticated/, 'Finance tables must not bypass the admin API');
assert.match(migration, /scan_status text not null default 'quarantined'/, 'receipt evidence must begin in quarantine');
assert.match(migration, /nurse_invoice_status_events/, 'invoice transitions must have immutable database history');
assert.match(migration, /after insert or update of status/, 'transition history must be atomic with the invoice mutation');

assert.match(submitApi, /computeInvoice\(\{ shifts, expenses \}\)/, 'server calculator must remain authoritative');
assert.match(submitApi, /const RECEIPT_REIMBURSEMENT_INTAKE_ENABLED = false/, 'receipt intake must remain closed until a scanner worker exists');
assert.match(submitApi, /receipt_workflow_unavailable/, 'direct receipt or expense submissions must fail closed');
assert.match(submitApi, /db\.rpc\('create_nurse_invoice'/, 'submission must persist before email');
assert.match(submitApi, /persistReceiptFiles/, 'receipt bytes must be stored privately');
assert.match(submitApi, /identityReviewRequired: true/, 'shared-door identity must never be asserted as verified');
assert.match(submitApi, /shift_outside_pay_period/, 'shift dates must be bounded to the selected pay period');
assert.match(submitApi, /deliverNurseInvoiceNotification\(db, \{ tenantId, invoiceId \}\)/, 'the browser request must hand notification work to the durable queue');
assert.match(submitApi, /receiptStorage\.status === 'failed'[\s\S]*deliverNurseInvoiceNotification/, 'receipt failure must not prevent the generic Finance alert');
assert.match(submitApi, /failClosed: process\.env\.VERCEL_ENV === 'production'/, 'production submission limits must fail closed without persistent KV');
assert.doesNotMatch(submitApi, /attachments\s*[:,]/, 'unscanned receipt bytes must not be attached to notification email');
assert.match(documentBuilder, /stored privately in Avalon Finance and quarantined pending an approved file scan/, 'notification must explain receipt quarantine');
assert.doesNotMatch(submitApi, /new Resend|emails\.send/, 'the public request must not own provider delivery');
assert.match(client, /submissionId: state\.submissionId/, 'the browser must retain a client submission UUID');
assert.match(client, /const EXPENSE_REIMBURSEMENT_ENABLED = false/, 'the public form must not offer an unscannable reimbursement workflow');
assert.match(client, /receipt-scanning workflow is not connected/, 'the public form must explain why reimbursements are unavailable');
assert.match(client, /response\.status === 202/, 'partial storage or delivery must preserve the retry draft');
assert.match(adminClient, /quarantined until an approved scanner clears it/, 'admin receipt UI must not imply attachment safety');
assert.match(store, /scanStatus !== 'cleared'/, 'unscanned receipt evidence must not receive a signed URL');
assert.match(store, /download: row\.file_name/, 'receipt URLs must force a private download filename');
assert.match(store, /remove\(\[storagePath\]\)/, 'a metadata failure must clean up the object uploaded by that attempt');
assert.match(store, /receipt_orphan_cleanup_failed/, 'failed orphan cleanup must be explicit instead of silently ignored');

assert.match(delivery, /FINANCE_NOTIFICATION_RECIPIENTS/, 'Finance alert recipients must be explicitly configured server-side');
assert.match(delivery, /INTERNAL_AVALON_EMAIL_RE/, 'Finance alert recipients must be restricted to Avalon mailboxes');
assert.match(delivery, /NURSE_INVOICE_DELIVERY_MAX_ATTEMPTS = 5/, 'Finance alert retries must be bounded');
assert.match(delivery, /NURSE_INVOICE_DELIVERY_LEASE_SECONDS = 10 \* 60/, 'abandoned Finance alert claims must have a bounded lease');
assert.match(delivery, /idempotencyKey: `avalon-nurse-invoice-\$\{invoice\.id\}`/, 'provider retries must use a stable invoice-scoped key');
assert.match(delivery, /subject: 'New invoice waiting in Avalon Finance'/, 'notification must stay generic');
assert.doesNotMatch(delivery, /buildInvoiceDocumentHtml|nurse_invoice_lines|invoice\.nurse_name|invoice\.total_cents/, 'the email worker must not egress invoice details');
assert.doesNotMatch(delivery, /attachments\s*[:,]/, 'the retry worker must never attach receipts');
assert.match(deliveryCron, /provided === `Bearer \$\{expected\}`/, 'the recovery cron must require the exact CRON_SECRET bearer token');
assert.match(deliveryCron, /MAX_PER_RUN = 25/, 'the recovery cron must cap each run');
assert.match(vercel, /\/api\/cron\/nurse-invoice-notifications/, 'the durable Finance alert worker must be scheduled');
assert.match(envExample, /FINANCE_NOTIFICATION_RECIPIENTS=/, 'the server-only Finance recipient allowlist must be documented');

assert.match(adminApi, /requireAdmin\(req, res\)/, 'invoice review must be admin-only');
assert.match(adminApi, /\.range\(offset, offset \+ limit - 1\)/, 'the durable queue must support paging beyond the newest rows');
assert.match(adminApi, /count: 'exact'/, 'queue paging must report an exact matching total');
assert.match(adminClient, /Load older invoices/, 'admin Finance must expose older invoice pages');
assert.match(adminApi, /quarantined: \['submitted', 'rejected'\]/, 'quarantine must resolve only to submitted or rejected');
assert.doesNotMatch(adminApi, /payment_reference_required/, 'typed references are not provider settlement evidence');
assert.match(adminApi, /provider_settlement_required/, 'invoice review must reject direct paid transitions');
assert.doesNotMatch(adminClient, />Mark paid</, 'the review UI must not expose a direct paid action');
assert.match(adminApi, /\.eq\('version', expectedVersion\)/, 'status transitions must be optimistic');
assert.doesNotMatch(adminApi, /postBalancedLedger/, 'review API must not perform non-atomic ledger side effects');

const id = '018f47a0-7b56-4f89-8c44-856beb4a572d';
assert.equal(validSubmissionUuid(id), true);
assert.equal(validSubmissionUuid('not-a-uuid'), false);
assert.equal(invoiceRequestHash({ b: 2, a: 1 }), invoiceRequestHash({ a: 1, b: 2 }), 'request hashing must be key-order stable');
assert.equal(sniffReceiptType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
assert.equal(sniffReceiptType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
assert.equal(sniffReceiptType(Buffer.from('not a receipt')), '');
assert.equal(sharedDoorIdentityAssurance({ knownContractor: false, activeProfile: false, namesMatch: false }), 'shared_door_unmatched');
assert.equal(sharedDoorIdentityAssurance({ knownContractor: true, activeProfile: true, namesMatch: true }), 'shared_door_profile_match');
assert.equal(deliveryRetryDelayMs(1), 5 * 60 * 1000);
assert.equal(deliveryRetryDelayMs(2), 15 * 60 * 1000);
assert.equal(deliveryRetryDelayMs(3), 60 * 60 * 1000);
assert.equal(deliveryRetryDelayMs(4), 4 * 60 * 60 * 1000);
const originalDeliveryEnv = {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.RESEND_FROM_EMAIL,
  recipients: process.env.FINANCE_NOTIFICATION_RECIPIENTS,
};
process.env.RESEND_API_KEY = 'verification-only';
process.env.RESEND_FROM_EMAIL = 'Avalon Finance <finance@avalonvitality.co>';
process.env.FINANCE_NOTIFICATION_RECIPIENTS = 'finance@avalonvitality.co,external@example.com';
assert.equal(nurseInvoiceNotificationConfiguration().ready, false, 'one external recipient must fail the whole allowlist closed');
process.env.FINANCE_NOTIFICATION_RECIPIENTS = 'finance@avalonvitality.co,ops@avalonvitality.co';
assert.deepEqual(nurseInvoiceNotificationConfiguration().recipients, ['finance@avalonvitality.co', 'ops@avalonvitality.co']);
if (originalDeliveryEnv.apiKey === undefined) delete process.env.RESEND_API_KEY;
else process.env.RESEND_API_KEY = originalDeliveryEnv.apiKey;
if (originalDeliveryEnv.from === undefined) delete process.env.RESEND_FROM_EMAIL;
else process.env.RESEND_FROM_EMAIL = originalDeliveryEnv.from;
if (originalDeliveryEnv.recipients === undefined) delete process.env.FINANCE_NOTIFICATION_RECIPIENTS;
else process.env.FINANCE_NOTIFICATION_RECIPIENTS = originalDeliveryEnv.recipients;
assert.equal(
  receiptStoragePath({ tenantId: 'tenant', invoiceId: 'invoice', receiptIndex: 2, checksum: 'abc', contentType: 'application/pdf' }),
  'tenant/invoice/02-abc.pdf',
);

console.log('Finance invoice verification passed: durable idempotent intake, quarantine, private receipts, immutable money, and admin-only review.');
