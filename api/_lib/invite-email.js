/**
 * Staff-invite + password-recovery emails via Resend. Mirrors the style of
 * api/_booking-email.js (same FROM, same escapeHtml, same skipped-email error).
 *
 * Env:
 *   RESEND_API_KEY    Resend key (required to send)
 *   RESEND_FROM_EMAIL sender; required in production, sandbox fallback only outside production
 */
import { Resend } from 'resend';

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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function skippedEmailError(message, reason) {
  return Object.assign(new Error(message), { code: 'email_delivery_skipped', reason });
}

const ROLE_LABEL = { admin: 'Full Admin', staff: 'Staff (Customer · Scheduling · Billing)' };

function shell(innerHtml) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#0a0a0a;">
      <h2 style="font-size:22px;margin:0 0 16px;letter-spacing:0.01em;">Avalon Vitality</h2>
      ${innerHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;" />
      <p style="font-size:12px;color:#888;">If you weren't expecting this, you can ignore this email.</p>
    </div>
  `;
}

/**
 * Send a staff invitation. `inviteUrl` is the magic link (carries the token);
 * `code` is the 6-digit fallback to type on the accept page. Either may be used.
 */
export async function sendInviteEmail({ to, inviteUrl, code, role, inviterName } = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw skippedEmailError('Invite email skipped: Resend is not configured', 'resend_not_configured');
  }
  const recipient = String(to || '').trim();
  if (!recipient) throw skippedEmailError('Invite email skipped: missing recipient', 'missing_recipient');

  const roleLabel = ROLE_LABEL[role] || role || 'team member';
  const by = inviterName ? `${escapeHtml(inviterName)} invited you` : 'You\'ve been invited';
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = shell(`
    <p style="font-size:15px;">${by} to the Avalon Vitality admin console as <strong>${escapeHtml(roleLabel)}</strong>.</p>
    ${inviteUrl ? `<p style="margin:24px 0;"><a href="${escapeHtml(inviteUrl)}" style="background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;display:inline-block;">Accept invite &amp; set password</a></p>` : ''}
    ${code ? `<p style="font-size:14px;">Or finish from any device: go to the accept-invite page and enter this code with your email:</p>
    <p style="font-size:26px;font-weight:700;letter-spacing:0.18em;margin:8px 0 0;">${escapeHtml(code)}</p>` : ''}
    <p style="font-size:13px;color:#666;margin-top:24px;">This invite expires in 14 days.</p>
  `);

  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: 'Your Avalon Vitality admin invite',
    html,
  });
  if (result?.error) throw Object.assign(new Error(result.error.message || 'Invite email failed'), { body: result.error });
  return { sent: true, id: result?.data?.id || result?.id || null };
}

/** Send a password-recovery link (admin-triggered reset). `recoveryUrl` from Supabase generateLink. */
export async function sendStaffRecoveryEmail({ to, recoveryUrl } = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw skippedEmailError('Recovery email skipped: Resend is not configured', 'resend_not_configured');
  }
  const recipient = String(to || '').trim();
  if (!recipient || !recoveryUrl) throw skippedEmailError('Recovery email skipped: missing recipient or link', 'missing_fields');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = shell(`
    <p style="font-size:15px;">A password reset was requested for your Avalon Vitality admin account.</p>
    <p style="margin:24px 0;"><a href="${escapeHtml(recoveryUrl)}" style="background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;display:inline-block;">Reset your password</a></p>
    <p style="font-size:13px;color:#666;">This link expires shortly. If you didn't request it, ignore this email.</p>
  `);

  const result = await resend.emails.send({
    from: fromAddress(),
    to: recipient,
    subject: 'Reset your Avalon Vitality password',
    html,
  });
  if (result?.error) throw Object.assign(new Error(result.error.message || 'Recovery email failed'), { body: result.error });
  return { sent: true, id: result?.data?.id || result?.id || null };
}
