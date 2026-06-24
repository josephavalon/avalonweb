/**
 * POST /api/admin/communications/send-email
 *
 * Staff/admin: send a general, PHI-free email to a client through Resend
 * (api/_lib/send-email.js). Companion to send-sms.js — same compliance posture:
 * the PHI block-list is enforced, so clinical/appointment content is refused.
 * Audited; the body is not stored in the audit log.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { sendEmail, isEmailConfigured } from '../../_lib/send-email.js';

const FRIENDLY = {
  email_not_configured: 'Email is not configured yet (missing Resend credentials).',
  invalid_email: 'That email address looks invalid.',
  phi_in_email_body: 'That message looks like it contains appointment or clinical details. This channel can only carry general, non-clinical text — keep details to the secure portal.',
  provider_send_failed: 'The email provider rejected the message. Try again.',
  provider_request_failed: 'Could not reach the email provider. Try again.',
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  if (!isEmailConfigured()) {
    return res.status(503).json({ error: FRIENDLY.email_not_configured, code: 'email_not_configured' });
  }

  const to = String(req.body?.to || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!to) return res.status(400).json({ error: 'An email address is required.', code: 'email_required' });
  if (!body) return res.status(400).json({ error: 'Message text is required.', code: 'body_required' });
  if (body.length > 5000) return res.status(400).json({ error: 'Message is too long.', code: 'body_too_long' });

  // Plain-text body → simple, safe HTML (newlines to <br>).
  const html = `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 15px; line-height: 1.55; color: #111;">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`;

  const result = await sendEmail({ to, subject, html, text: body });

  await writeAuditEvent(authed.db, {
    tenantId: authed.tenantId || null,
    actorProfileId: authed.user?.id || null,
    action: 'admin_email_send',
    entityType: 'communications',
    phiTouched: false,
    payload: { route: 'api/admin/communications/send-email', ok: result.ok, code: result.code || null, bodyLength: body.length },
  });

  if (!result.ok) {
    return res.status(result.status || 502).json({ error: FRIENDLY[result.code] || 'Could not send the email.', code: result.code || 'send_failed' });
  }
  return res.status(200).json({ ok: true });
}
