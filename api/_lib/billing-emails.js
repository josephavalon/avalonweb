import { Resend } from 'resend';

// Customer-facing billing emails (confirmation, receipt, renewal, failed
// payment). ALL are PHI-FREE per docs/PHI_DATA_FLOW.md — Resend has no executed
// HIPAA BAA with Avalon, so these bodies carry only: the customer's own first
// name, a date/time, a generic "Avalon visit" service label, a plan name, and
// dollar amounts. No diagnoses, protocols, conditions, medications, allergies,
// address, or any other clinical/medical detail ever goes through Resend.
//
// Best-effort: every sender throws only when Resend itself rejects, so the
// webhook can catch + log to audit_events and still return 200. Idempotency
// (dedupe) is the caller's responsibility (audit_events), matching the existing
// welcome-email contract in webhook.js.

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function fromAddress() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  if (isProductionRuntime()) {
    throw Object.assign(new Error('RESEND_FROM_EMAIL is required in production.'), {
      code: 'resend_from_email_missing',
      reason: 'resend_from_email_missing',
      status: 500,
    });
  }
  return 'Avalon Vitality <onboarding@resend.dev>';
}

function siteBase() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

function billingUrl() {
  const base = siteBase();
  return base ? `${base}/members/billing` : '/members/billing';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function firstName(name) {
  if (!name || typeof name !== 'string') return 'there';
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

// Cents → "$X.XX" (USD). Returns '' for non-positive/invalid so callers can omit.
function formatUsd(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return '';
  return (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Human date/time for a visit. PHI-free (a calendar time is not clinical detail).
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return d.toISOString();
  }
}

function skippedEmailError(message, reason) {
  return Object.assign(new Error(message), {
    code: 'email_delivery_skipped',
    reason,
  });
}

function resendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw skippedEmailError('Billing email skipped: Resend is not configured', 'resend_not_configured');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function shell({ eyebrow = 'Avalon Vitality', heading, bodyHtml, cta }) {
  const ctaHtml = cta?.href
    ? `<p style="margin:0 0 28px;">
         <a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;">
           ${escapeHtml(cta.label || 'Open')}
         </a>
       </p>`
    : '';
  return `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#111;">
      <p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#888;margin:0 0 14px;">${escapeHtml(eyebrow)}</p>
      <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px;">${escapeHtml(heading)}</h1>
      ${bodyHtml}
      ${ctaHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px;" />
      <p style="font-size:11px;color:#888;line-height:1.5;margin:0;">
        Avalon Vitality &bull; San Francisco, CA<br />
        Questions? Reply to this email or write to support@avalonvitality.co.
      </p>
    </div>
  `;
}

function detailRows(rows = []) {
  const cells = rows
    .filter((r) => r && r.value)
    .map((r) => `
      <tr>
        <td style="padding:6px 0;color:#888;font-size:13px;">${escapeHtml(r.label)}</td>
        <td style="padding:6px 0;color:#111;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(r.value)}</td>
      </tr>`)
    .join('');
  if (!cells) return '';
  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 22px;">${cells}</table>`;
}

/**
 * Booking confirmed — sent after a visit/appointment is fulfilled.
 * PHI-free: first name, date/time, generic service label, amount only.
 *
 * @param {{ to:string, name?:string, dateTimeIso?:string, serviceLabel?:string,
 *           amountCents?:number, balanceDueCents?:number }} args
 */
export async function sendBookingConfirmedEmail({
  to,
  name = '',
  dateTimeIso = '',
  serviceLabel = 'Avalon visit',
  amountCents = 0,
  balanceDueCents = 0,
} = {}) {
  const recipient = String(to || '').trim();
  if (!recipient) throw skippedEmailError('Booking confirmation skipped: missing recipient', 'missing_recipient');
  const resend = resendClient();

  const when = formatDateTime(dateTimeIso);
  const paid = formatUsd(amountCents);
  const balance = formatUsd(balanceDueCents);
  const bodyHtml = `
    <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 18px;">
      Hi ${escapeHtml(firstName(name))}, your Avalon visit is confirmed. A registered nurse will arrive at your scheduled time.
    </p>
    ${detailRows([
      { label: 'Service', value: serviceLabel || 'Avalon visit' },
      { label: 'When', value: when },
      { label: 'Paid today', value: paid },
      { label: 'Balance due at visit', value: balance },
    ])}
    <p style="font-size:14px;line-height:1.55;color:#333;margin:0 0 18px;">
      Need to make a change? Reply to this email and our team will help.
    </p>
  `;
  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: 'Your Avalon visit is confirmed',
    html: shell({ heading: 'Your visit is confirmed', bodyHtml }),
  });
  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Booking confirmation email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}

/**
 * Payment receipt — Avalon-branded receipt for a successful payment.
 * PHI-free: first name, amount, date, plan/visit label.
 *
 * @param {{ to:string, name?:string, amountCents?:number, dateIso?:string,
 *           label?:string }} args
 */
export async function sendPaymentReceiptEmail({
  to,
  name = '',
  amountCents = 0,
  dateIso = '',
  label = 'Avalon visit',
} = {}) {
  const recipient = String(to || '').trim();
  if (!recipient) throw skippedEmailError('Payment receipt skipped: missing recipient', 'missing_recipient');
  const amount = formatUsd(amountCents);
  if (!amount) throw skippedEmailError('Payment receipt skipped: no amount', 'no_amount');
  const resend = resendClient();

  const when = formatDateTime(dateIso) || formatDateTime(new Date().toISOString());
  const bodyHtml = `
    <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 18px;">
      Hi ${escapeHtml(firstName(name))}, thank you. This confirms your payment to Avalon Vitality.
    </p>
    ${detailRows([
      { label: 'Item', value: label || 'Avalon visit' },
      { label: 'Amount', value: amount },
      { label: 'Date', value: when },
    ])}
    <p style="font-size:13px;line-height:1.55;color:#888;margin:0 0 18px;">
      Keep this email for your records. You can view billing history any time from your account.
    </p>
  `;
  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: `Your Avalon receipt — ${amount}`,
    html: shell({ heading: 'Payment receipt', bodyHtml, cta: { href: billingUrl(), label: 'View billing' } }),
  });
  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Payment receipt email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}

/**
 * Subscription renewal — "Your plan renewed — N visit credits added · $X".
 * PHI-free: first name, plan name, credit count, amount.
 *
 * @param {{ to:string, name?:string, planName?:string, visitCredits?:number,
 *           amountCents?:number }} args
 */
export async function sendPlanRenewedEmail({
  to,
  name = '',
  planName = 'Avalon',
  visitCredits = 1,
  amountCents = 0,
} = {}) {
  const recipient = String(to || '').trim();
  if (!recipient) throw skippedEmailError('Plan renewal email skipped: missing recipient', 'missing_recipient');
  const resend = resendClient();

  const amount = formatUsd(amountCents);
  const credits = Math.max(1, Math.floor(Number(visitCredits) || 1));
  const creditLabel = `${credits} visit credit${credits === 1 ? '' : 's'}`;
  const safePlan = planName || 'Avalon';
  const bodyHtml = `
    <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 18px;">
      Hi ${escapeHtml(firstName(name))}, your <strong>${escapeHtml(safePlan)}</strong> plan renewed.
      We've added ${escapeHtml(creditLabel)} to your account${amount ? ` · ${escapeHtml(amount)}` : ''}.
    </p>
    ${detailRows([
      { label: 'Plan', value: safePlan },
      { label: 'Credits added', value: creditLabel },
      { label: 'Charged', value: amount },
    ])}
  `;
  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: `Your ${safePlan} plan renewed — ${creditLabel} added`,
    html: shell({ heading: 'Your plan renewed', bodyHtml, cta: { href: billingUrl(), label: 'View billing' } }),
  });
  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Plan renewal email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}

/**
 * Failed payment recovery — "Your payment didn't go through — update your card".
 * PHI-free: first name, plan name, amount, deep link to billing.
 *
 * @param {{ to:string, name?:string, planName?:string, amountCents?:number }} args
 */
export async function sendPaymentFailedEmail({
  to,
  name = '',
  planName = 'Avalon',
  amountCents = 0,
} = {}) {
  const recipient = String(to || '').trim();
  if (!recipient) throw skippedEmailError('Payment failed email skipped: missing recipient', 'missing_recipient');
  const resend = resendClient();

  const amount = formatUsd(amountCents);
  const safePlan = planName || 'Avalon';
  const bodyHtml = `
    <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 18px;">
      Hi ${escapeHtml(firstName(name))}, we tried to process your payment for your
      <strong>${escapeHtml(safePlan)}</strong> plan${amount ? ` (${escapeHtml(amount)})` : ''} and it didn't go through.
    </p>
    <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 18px;">
      This usually means a card expired or was declined. Please update your card to keep your plan active —
      we'll automatically retry once it's updated.
    </p>
  `;
  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: "Your payment didn't go through — update your card",
    html: shell({
      heading: "Update your card",
      bodyHtml,
      cta: { href: billingUrl(), label: 'Update payment method' },
    }),
  });
  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Payment failed email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}
