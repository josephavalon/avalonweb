import { Resend } from 'resend';

const FROM_INTERNAL = process.env.RESEND_FROM_EMAIL || 'Avalon Booking <onboarding@resend.dev>';
const DEFAULT_OPERATIONS_EMAIL = 'littonjose@gmail.com';

function dollarsFromCents(cents = 0) {
  return (Number(cents || 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function skippedEmailError(message, reason) {
  return Object.assign(new Error(message), {
    code: 'email_delivery_skipped',
    reason,
  });
}

export async function sendPaymentReceivedEmail({
  checkout = {},
  sessionId = '',
  paymentIntentId = '',
  acuityAppointmentId = '',
  fulfillmentStatus = '',
} = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw skippedEmailError('Payment operations email skipped: Resend is not configured', 'resend_not_configured');
  }

  const contact = checkout.contact || {};
  const appointment = checkout.appointment || {};
  const amounts = checkout.amounts || {};
  const items = checkout.items || [];
  const operationsEmail = process.env.AVALON_OPERATIONS_EMAIL || DEFAULT_OPERATIONS_EMAIL;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const customerName = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Avalon client';
  const service = checkout.primaryService || items[0]?.label || 'Avalon visit';
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0a0a0a;">
      <h2 style="font-size:22px;margin:0 0 16px;">Payment received</h2>
      <p><strong>Client:</strong> ${escapeHtml(customerName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(contact.email || '')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(contact.phone || '')}</p>
      <p><strong>Service:</strong> ${escapeHtml(service)}</p>
      <p><strong>When:</strong> ${escapeHtml(appointment.timeLabel || appointment.acuityDatetime || '')}</p>
      <p><strong>Where:</strong> ${escapeHtml([appointment.address, appointment.zip].filter(Boolean).join(' · '))}</p>
      <p><strong>Paid online:</strong> ${escapeHtml(dollarsFromCents(amounts.depositAmountCents))}</p>
      <p><strong>Balance due:</strong> ${escapeHtml(dollarsFromCents(amounts.balanceDueCents))}</p>
      <p><strong>Acuity:</strong> ${escapeHtml(acuityAppointmentId || fulfillmentStatus || 'Pending')}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:12px;color:#666;">
        Stripe session: ${escapeHtml(sessionId)}<br />
        PaymentIntent: ${escapeHtml(paymentIntentId)}
      </p>
    </div>
  `;

  const result = await resend.emails.send({
    from: FROM_INTERNAL,
    to: operationsEmail,
    replyTo: contact.email || operationsEmail,
    subject: `Avalon payment received - ${customerName}`,
    html,
  });

  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Payment email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}

export async function sendCustomerPaymentPendingEmail({
  checkout = {},
} = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw skippedEmailError('Customer payment email skipped: Resend is not configured', 'resend_not_configured');
  }

  const contact = checkout.contact || {};
  const to = String(contact.email || '').trim();
  if (!to) {
    throw skippedEmailError('Customer payment email skipped: missing customer email', 'missing_customer_email');
  }

  const customerName = contact.firstName || String(contact.name || '').trim().split(/\s+/)[0] || 'there';
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0a0a0a;">
      <h2 style="font-size:22px;margin:0 0 16px;">Payment received</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Your payment was received. We are confirming your appointment details and an Avalon registered nurse will follow up shortly.</p>
      <p>If anything changes, reply to this email and our team will help.</p>
    </div>
  `;

  const result = await resend.emails.send({
    from: FROM_INTERNAL,
    to,
    subject: 'Avalon payment received - appointment being confirmed',
    html,
  });

  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Customer payment email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}
