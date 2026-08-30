/**
 * POST /api/invoice/submit — prices and durably stores a nurse invoice.
 *
 * Structured invoice fields are contractor pay data. Receipt files are treated
 * as untrusted and potentially PHI-bearing: they remain in private quarantine
 * and are never downloadable until a separate approved scanner marks them
 * cleared. The free-text description also receives the PHI input guard.
 *
 * Also deliberately does NOT call blockFrontDoorPhiRoute(): avalonvitality.co
 * and www are both in FRONT_DOOR_HOSTS, so that guard would 409 the endpoint on
 * exactly the host this feature runs on.
 *
 * ── THE SERVER NEVER TRUSTS A CLIENT TOTAL ──────────────────────────────────
 * The accepted schema has no `total` field at all — not ignored, absent. Every
 * stored figure comes from this process's own computeInvoice() call on the raw
 * hours and counts, so the submitting device cannot set what it is paid.
 */
import crypto from 'crypto';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeLogContext } from '../_lib/safe-error.js';
import { bodyContainsPhi } from '../_lib/phi-guard.js';
import { verifyInvoiceToken } from '../_lib/invoice-token.js';
import { matchNurseByName, normalizeName, nurseInitials, roleForName } from '../../src/data/nurseRoster.js';
import {
  computeInvoice,
  MAX_EXPENSE_ROWS,
  MAX_SHIFT_ROWS,
} from '../../src/data/nurseInvoiceRates.js';
import { getDefaultTenantId, getSupabaseServiceClient } from '../_supabase-server.js';
import { deliverNurseInvoiceNotification } from '../_lib/nurse-invoice-delivery.js';
import {
  invoiceRequestHash,
  persistReceiptFiles,
  receiptExtension,
  sha256,
  sharedDoorIdentityAssurance,
  sniffReceiptType,
  validSubmissionUuid,
} from '../_lib/nurse-invoice-store.js';

const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

// Receipts ride inside the request body — there is no blob storage on the front
// door — so these caps are what stops a request exceeding Vercel's 4.5 MB limit
// once base64 has inflated it by a third. The client downscales before sending;
// this is the backstop for anything that does not come from the client.
const ACCEPTED_RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_RECEIPT_BYTES = 1_400_000;
const MAX_TOTAL_RECEIPT_BYTES = 2_800_000;
const MAX_RECEIPTS = 20;
// Receipt reimbursement remains closed until Avalon connects an approved
// malware/content scanner and its worker calls record_nurse_invoice_receipt_scan.
// Keeping this server-side constant false prevents a copied client flag or a
// direct API request from creating an invoice Finance can never safely clear.
const RECEIPT_REIMBURSEMENT_INTAKE_ENABLED = false;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PERIOD_DAYS = 31;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function daysBetween(startIso, endIso) {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return NaN;
  return Math.round((end - start) / 86400000);
}
/** e.g. AV-20260815-TW-4K2P — goes straight into Gusto's Invoice column. */
function buildInvoiceNumber(nurse, periodEnd) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  const suffix = Array.from(crypto.randomBytes(4))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
  return `AV-${periodEnd.replace(/-/g, '')}-${nurseInitials(nurse.name)}-${suffix}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  const limit = await checkRateLimit({
    key: `invoice-submit:${ip}`,
    ...RATE_LIMIT,
    failClosed: process.env.VERCEL_ENV === 'production',
  });
  if (limit.unavailable) {
    return res.status(503).json({ error: 'Invoice submission is temporarily unavailable.' });
  }
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const token = verifyInvoiceToken(body.token);
    if (!token.ok) {
      const expired = token.reason === 'expired';
      return res.status(expired ? 401 : 401).json({
        error: expired ? 'Your session expired. Please unlock again.' : 'Not authorized.',
        code: expired ? 'token_expired' : 'unauthorized',
      });
    }

    // The name is typed, so it is validated for shape rather than looked up by
    // id. Role is a label resolved from the roster — never taken from the body —
    // and since GFE opened to everyone it no longer decides what anyone may bill.
    const nurseName = String(body.nurseName || '').trim().replace(/\s+/g, ' ');
    if (nurseName.length < 2 || nurseName.length > 60) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (bodyContainsPhi(nurseName)) {
      return res.status(400).json({ error: 'Please enter your name only.' });
    }
    const nurse = { name: nurseName, role: roleForName(nurseName) };
    const knownContractor = Boolean(matchNurseByName(nurseName));

    if (body.confirmed !== true) {
      return res.status(400).json({ error: 'Please confirm the invoice is accurate.' });
    }

    const periodStart = String(body.periodStart || '');
    const periodEnd = String(body.periodEnd || '');
    if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
      return res.status(400).json({ error: 'Please enter a valid pay period.' });
    }
    const span = daysBetween(periodStart, periodEnd);
    if (!Number.isFinite(span) || span < 0) {
      return res.status(400).json({ error: 'The pay period ends before it starts.' });
    }
    if (span > MAX_PERIOD_DAYS) {
      return res.status(400).json({ error: 'A pay period cannot be longer than 31 days.' });
    }

    const shifts = Array.isArray(body.shifts) ? body.shifts.slice(0, MAX_SHIFT_ROWS + 1) : [];
    const expenses = Array.isArray(body.expenses)
      ? body.expenses.slice(0, MAX_EXPENSE_ROWS + 1)
      : [];
    const rawReceipts = Array.isArray(body.receipts) ? body.receipts.slice(0, MAX_RECEIPTS) : [];

    if (!RECEIPT_REIMBURSEMENT_INTAKE_ENABLED && (expenses.length > 0 || rawReceipts.length > 0)) {
      return res.status(503).json({
        error: 'Expense reimbursement is not available in this portal yet. Submit shift pay only and contact Avalon Finance about receipts.',
        code: 'receipt_workflow_unavailable',
      });
    }

    // The only free text on the page. Run it through the PHI block-list as an
    // input validator so clinical detail is stopped at the form, not in an inbox.
    for (const expense of expenses) {
      if (bodyContainsPhi(String(expense?.description || ''))) {
        return res.status(400).json({
          error: 'Please remove client or clinical details from your expense descriptions.',
          code: 'phi_in_expense_description',
        });
      }
    }

    const computed = computeInvoice({ shifts, expenses });
    if (computed.errors.length) {
      return res.status(400).json({
        error: 'Some rows need attention before this can be submitted.',
        errors: computed.errors,
      });
    }
    if (computed.shiftLines.some((line) => line.date < periodStart || line.date > periodEnd)) {
      return res.status(400).json({
        error: 'Every shift date must fall inside the selected pay period.',
        code: 'shift_outside_pay_period',
      });
    }

    // This is an identity claim for Finance matching, not an email destination.
    // A shared-door user can type any address, so receipt-bearing mail remains
    // internal until Avalon replaces this gate with provider-authenticated intake.
    const nurseEmail = String(body.nurseEmail || '').trim().toLowerCase();
    if (!nurseEmail) {
      return res.status(400).json({ error: 'Enter the work email used for your contractor profile.' });
    }
    if (!EMAIL_RE.test(nurseEmail) || nurseEmail.length > 120) {
      return res.status(400).json({ error: 'That email address does not look right.' });
    }

    const receipts = [];
    let receiptBytes = 0;
    for (const raw of rawReceipts) {
      const contentType = String(raw?.contentType || '');
      const base64 = String(raw?.base64 || '');
      if (!ACCEPTED_RECEIPT_TYPES.has(contentType)) {
        return res.status(400).json({ error: 'Receipts must be a photo or a PDF.' });
      }
      if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
        return res.status(400).json({ error: 'That receipt could not be read. Please attach it again.' });
      }
      const buffer = Buffer.from(base64, 'base64');
      const bytes = buffer.byteLength;
      if (bytes <= 0 || bytes > MAX_RECEIPT_BYTES) {
        return res.status(400).json({ error: 'One of those receipts is too large.' });
      }
      if (sniffReceiptType(buffer) !== contentType) {
        return res.status(400).json({ error: 'A receipt file type did not match its contents.' });
      }
      receiptBytes += bytes;
      if (receiptBytes > MAX_TOTAL_RECEIPT_BYTES) {
        return res.status(400).json({ error: 'Those receipts are too large altogether.' });
      }
      // Rebuilt from scratch rather than echoing a client filename into a header.
      const index = Number(raw?.index);
      const label = Number.isInteger(index) && index >= 0 ? index + 1 : receipts.length + 1;
      const extension = receiptExtension(contentType);
      const fileName = `receipt-${label}.${extension}`;
      receipts.push({
        index: receipts.length,
        fileName,
        contentType,
        byteSize: bytes,
        checksum: sha256(buffer),
        buffer,
      });
    }

    const suppliedSubmissionId = String(body.submissionId || '').trim();
    if (suppliedSubmissionId && !validSubmissionUuid(suppliedSubmissionId)) {
      return res.status(400).json({ error: 'Submission identifier is invalid.', code: 'invalid_submission_id' });
    }
    // Old tabs that predate the client UUID remain usable, but are explicitly
    // tagged as legacy and do not claim retry idempotency.
    const submissionId = suppliedSubmissionId || crypto.randomUUID();
    const submissionIdSource = suppliedSubmissionId ? 'client' : 'server_legacy';
    const submittedAt = new Date().toISOString();
    const proposedInvoiceNumber = buildInvoiceNumber(nurse, periodEnd);
    const db = await getSupabaseServiceClient();
    const tenantId = await getDefaultTenantId(db);
    if (!db || !tenantId) {
      return res.status(503).json({ error: 'Invoice storage is not configured yet.', code: 'invoice_storage_not_configured' });
    }

    const profileResult = await db.from('profiles')
      .select('id, email, full_name, role, status')
      .eq('tenant_id', tenantId)
      .ilike('email', nurseEmail)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data || null;
    const activeProfile = Boolean(profile && profile.status === 'active' && ['nurse', 'rn', 'np'].includes(profile.role));
    const namesMatch = Boolean(activeProfile && normalizeName(profile.full_name) === normalizeName(nurseName));
    const identityAssurance = sharedDoorIdentityAssurance({ knownContractor, activeProfile, namesMatch });
    const receiptManifest = receipts.map(({ index, fileName, contentType, byteSize, checksum }) => ({
      index, fileName, contentType, byteSize, checksum,
    }));
    const requestHash = invoiceRequestHash({
      nurseName, nurseEmail, periodStart, periodEnd, shifts, expenses, receiptManifest,
    });
    const lineRows = [
      ...computed.shiftLines.map((line, index) => ({
        line_type: 'shift', service_code: line.typeKey, service_date: line.date,
        hours: line.hours, quantity: {
          ivCount: line.ivCount, shotCount: line.shotCount, gfeCount: line.gfeCount,
        },
        description: line.typeLabel, amount_cents: line.subtotalCents,
        pricing_snapshot: {
          hourlyCents: line.hourlyCents, adderCents: line.adderCents, gfeCents: line.gfeCents,
        },
        sort_order: index,
      })),
      ...computed.expenseLines.map((line, index) => ({
        line_type: 'expense', description: line.description,
        amount_cents: line.amountCents, pricing_snapshot: {},
        sort_order: computed.shiftLines.length + index,
      })),
    ];
    const createResult = await db.rpc('create_nurse_invoice', {
      p_invoice: {
        tenant_id: tenantId,
        submission_id: submissionId,
        submission_id_source: submissionIdSource,
        request_hash: requestHash,
        invoice_number: proposedInvoiceNumber,
        nurse_profile_id: activeProfile && namesMatch ? profile.id : null,
        nurse_name: nurseName,
        nurse_email: nurseEmail,
        known_contractor: knownContractor,
        identity_assurance: identityAssurance,
        period_start: periodStart,
        period_end: periodEnd,
        wages_cents: computed.wagesCents,
        reimbursements_cents: computed.reimbursementsCents,
        total_cents: computed.grandTotalCents,
        currency: 'USD',
        pricing_contract: 'avalon_nurse_invoice_v1',
        submitted_at: submittedAt,
        receipt_manifest: receiptManifest,
        payload: {
          intake: 'shared_door',
          identityClaim: 'self_asserted',
          receiptCount: receipts.length,
        },
      },
      p_lines: lineRows,
    });
    if (createResult.error) {
      if (/submission_id_reused/i.test(String(createResult.error.message || ''))) {
        return res.status(409).json({ error: 'This submission identifier was already used for different invoice data.', code: 'submission_id_reused' });
      }
      throw createResult.error;
    }
    const created = Array.isArray(createResult.data) ? createResult.data[0] : createResult.data;
    const invoiceId = created?.created_invoice_id;
    const replayed = Boolean(created?.replayed);
    if (!invoiceId) throw Object.assign(new Error('Invoice storage did not return an id.'), { code: 'invoice_id_missing' });

    const storedResult = await db.from('nurse_invoices').select('*')
      .eq('tenant_id', tenantId).eq('id', invoiceId).single();
    if (storedResult.error) throw storedResult.error;
    const stored = storedResult.data;
    const invoiceNumber = stored.invoice_number;
    const storedAt = stored.submitted_at;
    const receiptStorage = await persistReceiptFiles(db, { tenantId, invoiceId, receipts });

    const responsePayload = (extra = {}) => ({
      ok: true,
      stored: true,
      fullyDelivered: false,
      invoiceId,
      submissionId,
      replayed,
      status: stored.status,
      identityAssurance: stored.identity_assurance,
      identityReviewRequired: true,
      invoiceNumber,
      knownContractor: stored.known_contractor,
      receiptCount: receipts.length,
      receiptStorageStatus: receiptStorage.status,
      submittedAt: storedAt,
      computed,
      wagesCents: computed.wagesCents,
      reimbursementsCents: computed.reimbursementsCents,
      grandTotalCents: computed.grandTotalCents,
      ...extra,
    });

    if (receiptStorage.status === 'failed') {
      console.warn('Invoice receipt storage failed', safeLogContext(receiptStorage.error, 'invoice_receipt_storage_failed'));
    }

    // Notification delivery reads only the durable invoice row. A 202 response
    // or closed browser never requires reattaching receipts merely to alert
    // Finance; the protected cron worker can recover this same queue item.
    let delivery;
    try {
      delivery = await deliverNurseInvoiceNotification(db, { tenantId, invoiceId });
    } catch (deliveryError) {
      console.warn('Invoice notification queue failed', safeLogContext(deliveryError, 'invoice_notification_queue_failed'));
      delivery = {
        outcome: 'retry_scheduled',
        status: stored.delivery_status || 'pending',
        errorCode: 'invoice_notification_queue_failed',
      };
    }

    const notificationSent = delivery.outcome === 'sent';
    const receiptsComplete = receiptStorage.status !== 'failed';
    const fullyDelivered = notificationSent && receiptsComplete;
    const warnings = [];
    if (!receiptsComplete) {
      warnings.push('The invoice was saved, but a receipt could not be stored. Retry this same submission to complete the private receipt record.');
    }
    if (!notificationSent) {
      warnings.push(delivery.outcome === 'exhausted'
        ? 'The invoice was saved, but its generic internal Finance alert requires admin attention.'
        : 'The invoice was saved and its generic internal Finance alert is queued for protected retry.');
    }
    return res.status(fullyDelivered ? 200 : 202).json(responsePayload({
      deliveryStatus: delivery.status || stored.delivery_status,
      deliveryOutcome: delivery.outcome,
      fullyDelivered,
      ...(warnings.length ? { warning: warnings.join(' ') } : {}),
    }));
  } catch (error) {
    console.error('Invoice submit failed', safeLogContext(error, 'invoice_submit_failed'));
    return res.status(500).json({ error: 'Failed to submit invoice. Please try again.' });
  }
}
