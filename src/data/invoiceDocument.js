/**
 * The invoice document — one HTML rendering used by three consumers:
 *
 *   api/invoice/submit.js  the email sent to the approvers
 *   /invoice sent screen   the print / Save-as-PDF copy
 *   /invoice sent screen   the downloadable Word file
 *
 * Deliberately one function so a nurse's saved copy and the email an approver
 * reads can never disagree about what was submitted. Same discipline as
 * nurseInvoiceRates.js: pure, no '@/' alias, no import.meta.env, explicit .js
 * extensions, so it loads from both the Vercel function and the Vite bundle.
 *
 * Inline styles throughout, not classes — email clients strip <style> blocks,
 * and a downloaded file has no stylesheet to link to.
 */
import { formatCents, formatCentsPlain } from './nurseInvoiceRates.js';

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const MONO = "font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;";
const CELL = 'padding: 6px 10px; border-bottom: 1px solid #e6e0d6; font-size: 13px;';
const NUM = `${CELL} ${MONO} text-align: right; white-space: nowrap;`;

export function buildInvoiceDocumentHtml({
  nurse,
  invoiceNumber,
  periodStart,
  periodEnd,
  computed,
  submittedAt,
}) {
  const shiftRows = computed.shiftLines
    .map(
      (line) => `
        <tr>
          <td style="${CELL} ${MONO}">${escapeHtml(line.date)}</td>
          <td style="${CELL}">${escapeHtml(line.typeLabel)}</td>
          <td style="${NUM}">${line.hours.toFixed(2)}h</td>
          <td style="${NUM}">${line.ivCount || '—'}</td>
          <td style="${NUM}">${line.shotCount || '—'}</td>
          <td style="${NUM}">${line.gfeCount || '—'}</td>
          <td style="${NUM}"><strong>${formatCents(line.subtotalCents)}</strong></td>
        </tr>`,
    )
    .join('');

  const expenseRows = computed.expenseLines.length
    ? computed.expenseLines
        .map(
          (line) => `
        <tr>
          <td style="${CELL}" colspan="6">${escapeHtml(line.description)}</td>
          <td style="${NUM}"><strong>${formatCents(line.amountCents)}</strong></td>
        </tr>`,
        )
        .join('')
    : `<tr><td style="${CELL} color:#6e6258;" colspan="7"><em>No expenses</em></td></tr>`;

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #2b211b; background: #f6f2eb;">

    <p style="${MONO} font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6e6258; margin: 0 0 6px;">Avalon Vitality</p>
    <h1 style="font-size: 22px; margin: 0 0 4px;">Contractor invoice — ${escapeHtml(nurse.name)}</h1>
    <p style="${MONO} font-size: 13px; color: #6e6258; margin: 0 0 20px;">
      ${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)} &nbsp;·&nbsp; ${escapeHtml(nurse.role)}
    </p>

    <!-- Paste-ready block: Gusto → Pay → US contractors → New Payment -->
    <div style="border: 2px solid #2b211b; border-radius: 12px; padding: 16px 18px; background: #fffdf8; margin-bottom: 24px;">
      <p style="${MONO} font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #6e6258; margin: 0 0 12px;">
        Gusto → Pay → US contractors → New payment
      </p>
      <table style="width: 100%; border-collapse: collapse; ${MONO} font-size: 14px;">
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
        <tr style="${MONO} font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #6e6258;">
          <th style="${CELL} text-align: left;">Date</th>
          <th style="${CELL} text-align: left;">Type</th>
          <th style="${CELL} text-align: right;">Hours</th>
          <th style="${CELL} text-align: right;">IV</th>
          <th style="${CELL} text-align: right;">Shot</th>
          <th style="${CELL} text-align: right;">GFE</th>
          <th style="${CELL} text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${shiftRows}</tbody>
    </table>

    <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: #6e6258; margin: 0 0 8px;">Expenses</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tbody>${expenseRows}</tbody>
    </table>

    <table style="width: 100%; border-collapse: collapse; ${MONO} font-size: 14px;">
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

/** A complete standalone file, for download rather than embedding in an email. */
export function buildInvoiceFileHtml(params) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>Avalon invoice ${escapeHtml(params.invoiceNumber)}</title>
</head><body style="margin:0;background:#f6f2eb;">
${buildInvoiceDocumentHtml(params)}
</body></html>`;
}
