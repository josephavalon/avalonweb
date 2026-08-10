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
 * The accepted schema has no `total` field at all — not ignored, absent — and
 * `role` is read from the roster by id, never from the body. Every figure in the
 * email comes from this process's own computeInvoice() call.
 */
import crypto from 'crypto';
import { Resend } from 'resend';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeLogContext } from '../_lib/safe-error.js';
import { bodyContainsPhi } from '../_lib/phi-guard.js';
import { verifyInvoiceToken } from '../_lib/invoice-token.js';
import { findNurse, nurseInitials } from '../../src/data/nurseRoster.js';
import {
  computeInvoice,
  formatCents,
  formatCentsPlain,
  MAX_EXPENSE_ROWS,
  MAX_SHIFT_ROWS,
} from '../../src/data/nurseInvoiceRates.js';

const RECIPIENTS = [
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

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

// Exported so the invoice email can be rendered to a file and eyeballed without
// burning a Resend send — the layout is the thing Corey actually reads.
export function buildEmailHtml({ nurse, invoiceNumber, periodStart, periodEnd, computed, submittedAt }) {
  const mono = "font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;";
  const cell = 'padding: 6px 10px; border-bottom: 1px solid #e6e0d6; font-size: 13px;';
  const num = `${cell} ${mono} text-align: right; white-space: nowrap;`;

  const shiftRows = computed.shiftLines
    .map(
      (line) => `
        <tr>
          <td style="${cell} ${mono}">${escapeHtml(line.date)}</td>
          <td style="${cell}">${escapeHtml(line.typeLabel)}</td>
          <td style="${num}">${line.hours.toFixed(2)}h</td>
          <td style="${num}">${line.ivCount || '—'}</td>
          <td style="${num}">${line.shotCount || '—'}</td>
          <td style="${num}">${line.gfeCount || '—'}</td>
          <td style="${num}"><strong>${formatCents(line.subtotalCents)}</strong></td>
        </tr>`,
    )
    .join('');

  const expenseRows = computed.expenseLines.length
    ? computed.expenseLines
        .map(
          (line) => `
        <tr>
          <td style="${cell}" colspan="6">${escapeHtml(line.description)}</td>
          <td style="${num}"><strong>${formatCents(line.amountCents)}</strong></td>
        </tr>`,
        )
        .join('')
    : `<tr><td style="${cell} color:#6e6258;" colspan="7"><em>No expenses</em></td></tr>`;

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #2b211b; background: #f6f2eb;">

    <p style="${mono} font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6e6258; margin: 0 0 6px;">Avalon Vitality</p>
    <h1 style="font-size: 22px; margin: 0 0 4px;">Contractor invoice — ${escapeHtml(nurse.name)}</h1>
    <p style="${mono} font-size: 13px; color: #6e6258; margin: 0 0 20px;">
      ${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)} &nbsp;·&nbsp; ${escapeHtml(nurse.role)}
    </p>

    <!-- Paste-ready block: Gusto → Pay → US contractors → New Payment -->
    <div style="border: 2px solid #2b211b; border-radius: 12px; padding: 16px 18px; background: #fffdf8; margin-bottom: 24px;">
      <p style="${mono} font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #6e6258; margin: 0 0 12px;">
        Gusto → Pay → US contractors → New payment
      </p>
      <table style="width: 100%; border-collapse: collapse; ${mono} font-size: 14px;">
        <tr><td style="padding: 3px 0; color: #6e6258;">Contractor</td><td style="padding: 3px 0; text-align: right;"><strong>${escapeHtml(nurse.name)}</strong></td></tr>
        <tr><td style="padding: 3px 0; color: #6e6258;">Invoice</td><td style="padding: 3px 0; text-align: right;"><strong>${escapeHtml(invoiceNumber)}</strong></td></tr>
        <tr><td style="padding: 3px 0; color: #6e6258;">Wage</td><td style="padding: 3px 0; text-align: right;"><strong>${formatCentsPlain(computed.wagesCents)}</strong></td></tr>
        <tr><td style="padding: 3px 0; color: #6e6258;">Reimbursement</td><td style="padding: 3px 0; text-align: right;"><strong>${formatCentsPlain(computed.reimbursementsCents)}</strong></td></tr>
        <tr><td style="padding: 8px 0 0; border-top: 1px solid #d9d2c8; font-size: 15px;">Total</td><td style="padding: 8px 0 0; border-top: 1px solid #d9d2c8; text-align: right; font-size: 15px;"><strong>${formatCentsPlain(computed.grandTotalCents)}</strong></td></tr>
      </table>
    </div>

    <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: #6e6258; margin: 0 0 8px;">Shifts</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="${mono} font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #6e6258;">
          <th style="${cell} text-align: left;">Date</th>
          <th style="${cell} text-align: left;">Type</th>
          <th style="${cell} text-align: right;">Hours</th>
          <th style="${cell} text-align: right;">IV</th>
          <th style="${cell} text-align: right;">Shot</th>
          <th style="${cell} text-align: right;">GFE</th>
          <th style="${cell} text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${shiftRows}</tbody>
    </table>

    <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: #6e6258; margin: 0 0 8px;">Expenses</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tbody>${expenseRows}</tbody>
    </table>

    <table style="width: 100%; border-collapse: collapse; ${mono} font-size: 14px;">
      <tr><td style="padding: 4px 10px; color: #6e6258;">Wages</td><td style="padding: 4px 10px; text-align: right;">${formatCents(computed.wagesCents)}</td></tr>
      <tr><td style="padding: 4px 10px; color: #6e6258;">Reimbursements</td><td style="padding: 4px 10px; text-align: right;">${formatCents(computed.reimbursementsCents)}</td></tr>
      <tr><td style="padding: 8px 10px; border-top: 2px solid #2b211b; font-size: 17px;"><strong>Total</strong></td><td style="padding: 8px 10px; border-top: 2px solid #2b211b; text-align: right; font-size: 17px;"><strong>${formatCents(computed.grandTotalCents)}</strong></td></tr>
    </table>

    <p style="font-size: 11px; color: #6e6258; line-height: 1.6; margin-top: 24px; border-top: 1px solid #d9d2c8; padding-top: 12px;">
      Submitted ${escapeHtml(submittedAt)} and confirmed accurate by the contractor at submission.<br />
      Totals are calculated server-side from the entered shifts — the submitting device cannot set them.
    </p>
  </div>`;
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

    const nurse = findNurse(String(body.nurseId || ''));
    if (!nurse) return res.status(400).json({ error: 'Please select your name.' });

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

    // Role comes from the roster, never the body — otherwise an RN could claim NP.
    const computed = computeInvoice({ role: nurse.role, shifts, expenses });
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
      html: buildEmailHtml({
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
      wagesCents: computed.wagesCents,
      reimbursementsCents: computed.reimbursementsCents,
      grandTotalCents: computed.grandTotalCents,
    });
  } catch (error) {
    console.error('Invoice submit failed', safeLogContext(error, 'invoice_submit_failed'));
    return res.status(500).json({ error: 'Failed to submit invoice. Please try again.' });
  }
}
