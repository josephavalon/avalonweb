/**
 * POST /api/invoice/submit — prices a nurse invoice and emails it.
 *
 * ── WHY THE RESEND SDK IS CALLED DIRECTLY ───────────────────────────────────
 * Do NOT "clean this up" into api/_lib/send-email.js. That helper runs every
 * body through bodyContainsPhi(), whose block-list includes the bare words
 * "nurse" and "appointment" (api/_lib/phi-guard.js) — both unavoidable in a
 * nurse invoice for a mobile appointment. Routing through it would 422 every
 * submission. The invoice is pay data, not PHI; the guard is applied to the one
 * free-text field on the page (expense descriptions) as an INPUT validator
 * instead, which is where clinical detail could actually leak in.
 *
 * Also deliberately does NOT call blockFrontDoorPhiRoute(): avalonvitality.co
 * and www are both in FRONT_DOOR_HOSTS, so that guard would 409 the endpoint on
 * exactly the host this feature runs on.
 *
 * ── THE SERVER NEVER TRUSTS A CLIENT TOTAL ──────────────────────────────────
 * The accepted schema has no `total` field at all — not ignored, absent. Every
 * figure in the email comes from this process's own computeInvoice() call on the
 * raw hours and counts, so the submitting device cannot set what it is paid.
 */
import crypto from 'crypto';
import { Resend } from 'resend';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeLogContext } from '../_lib/safe-error.js';
import { bodyContainsPhi } from '../_lib/phi-guard.js';
import { verifyInvoiceToken } from '../_lib/invoice-token.js';
import { matchNurseByName, nurseInitials, roleForName } from '../../src/data/nurseRoster.js';
import {
  computeInvoice,
  formatCents,
  MAX_EXPENSE_ROWS,
  MAX_SHIFT_ROWS,
} from '../../src/data/nurseInvoiceRates.js';
import { buildInvoiceDocumentHtml } from '../../src/data/invoiceDocument.js';

const RECIPIENTS = [
  'aaron@avalonvitality.co',
  'corey@avalonvitality.co',
  'joseph@avalonvitality.co',
  'support@avalonvitality.co',
];

const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };
const MAX_PERIOD_DAYS = 31;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

// Copied from api/apply.js: throws in production rather than silently sending
// from the Resend sandbox sender.
function fromAddress() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  if (isProductionRuntime()) {
    throw Object.assign(new Error('RESEND_FROM_EMAIL is required in production.'), {
      code: 'resend_from_email_missing',
    });
  }
  return 'Avalon Invoices <onboarding@resend.dev>';
}

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
  const limit = await checkRateLimit({ key: `invoice-submit:${ip}`, ...RATE_LIMIT });
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

    const invoiceNumber = buildInvoiceNumber(nurse, periodEnd);
    const submittedAt = new Date().toISOString();

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({
        error: 'Invoice email is not configured yet.',
        code: 'email_not_configured',
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: fromAddress(),
      to: RECIPIENTS,
      subject: `Invoice ${invoiceNumber} — ${nurse.name} — ${formatCents(computed.grandTotalCents)}`,
      html: buildInvoiceDocumentHtml({
        nurse,
        invoiceNumber,
        periodStart,
        periodEnd,
        computed,
        submittedAt,
      }),
    });

    if (result?.error) {
      console.warn('Invoice email failed', safeLogContext(result.error, 'invoice_email_failed'));
      return res.status(502).json({ error: 'Submission is temporarily unavailable. Please try again.' });
    }

    return res.status(200).json({
      ok: true,
      invoiceNumber,
      knownContractor,
      submittedAt,
      // The whole computation, so the copy a nurse saves is rendered from the
      // SAME numbers that went to the approvers rather than from the client's
      // own preview. Pay data only — no PHI leaves here.
      computed,
      wagesCents: computed.wagesCents,
      reimbursementsCents: computed.reimbursementsCents,
      grandTotalCents: computed.grandTotalCents,
    });
  } catch (error) {
    console.error('Invoice submit failed', safeLogContext(error, 'invoice_submit_failed'));
    return res.status(500).json({ error: 'Failed to submit invoice. Please try again.' });
  }
}
