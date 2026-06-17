import { Resend } from 'resend';

const DEFAULT_OPERATIONS_EMAIL = 'littonjose@gmail.com';

// Resend does not have an executed HIPAA BAA with Avalon. Ops emails are kept
// PHI-free (no name, contact, address, appointment time, balance, etc.) — staff
// click through to the admin (Supabase, BAA-covered) to view client details.
// See docs/PHI_DATA_FLOW.md for the policy.

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
  return 'Avalon Booking <onboarding@resend.dev>';
}

function adminBookingUrl(appointmentRecordId) {
  const base = String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (!appointmentRecordId) return base ? `${base}/admin/bookings` : '/admin/bookings';
  const safeId = encodeURIComponent(String(appointmentRecordId));
  return base ? `${base}/admin/bookings/${safeId}` : `/admin/bookings/${safeId}`;
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
  appointmentRecordId = '',
} = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw skippedEmailError('Payment operations email skipped: Resend is not configured', 'resend_not_configured');
  }

  const operationsEmail = process.env.AVALON_OPERATIONS_EMAIL || DEFAULT_OPERATIONS_EMAIL;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const shortId = String(appointmentRecordId || '').slice(0, 8) || 'pending';
  const adminUrl = adminBookingUrl(appointmentRecordId);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a;">
      <h2 style="font-size:20px;margin:0 0 12px;">New Avalon payment received</h2>
      <p style="margin:0 0 16px;">A booking deposit was received and an appointment is pending confirmation.</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(adminUrl)}"
           style="display:inline-block;background:#0a0a0a;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:600;">
          Open admin to review
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:12px;color:#666;margin:0;">
        Client details are intentionally omitted from this email per Avalon's HIPAA
        policy. Sign in to the admin to view the booking and reconcile.
      </p>
    </div>
  `;

  const result = await resend.emails.send({
    from: fromAddress(),
    to: operationsEmail,
    subject: `New Avalon payment received — booking #${shortId}`,
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
    from: fromAddress(),
    to,
    subject: 'Avalon payment received - appointment being confirmed',
    html,
  });

  if (result?.error) {
    throw Object.assign(new Error(result.error.message || 'Customer payment email failed'), { body: result.error });
  }
  return { sent: true, id: result?.data?.id || result?.id || null };
}
