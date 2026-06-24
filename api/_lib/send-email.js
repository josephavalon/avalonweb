/**
 * Send a general email through Resend. Shared by admin-initiated communications.
 *
 * Env:
 *   RESEND_API_KEY     Resend API key
 *   RESEND_FROM_EMAIL  verified sender, e.g. "Avalon Vitality <hello@avalon...>"
 *
 * Returns { ok: true } on success, or { ok: false, code, status } otherwise.
 * Never throws — callers branch on `ok`.
 *
 * ── HIPAA POLICY ─────────────────────────────────────────────────────────────
 * Resend has no executed BAA with Avalon, so general email must stay PHI-free —
 * same posture as SMS (see api/_lib/send-sms.js). The shared block-list
 * (phi-guard.js) is enforced here as defense-in-depth. The consented-reminder
 * path may pass { allowConsentedPhi: true } after verifying a patient's opt-in
 * (45 CFR §164.522). See docs/PHI_DATA_FLOW.md.
 */
import { Resend } from 'resend';
import { safeLogContext } from './safe-error.js';
import { bodyContainsPhi } from './phi-guard.js';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress() {
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (from) return from;
  return 'Avalon Vitality <onboarding@resend.dev>';
}

export async function sendEmail({ to, subject, html, text }, opts = {}) {
  if (!process.env.RESEND_API_KEY) return { ok: false, code: 'email_not_configured', status: 503 };

  const recipient = String(to || '').trim();
  if (!recipient || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
    return { ok: false, code: 'invalid_email', status: 400 };
  }

  const guardText = `${subject || ''}\n${text || ''}\n${html || ''}`;
  if (!opts.allowConsentedPhi && bodyContainsPhi(guardText)) {
    console.error('[send-email] refusing to send: body contains PHI-shaped tokens (see docs/PHI_DATA_FLOW.md)');
    return { ok: false, code: 'phi_in_email_body', status: 422 };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: fromAddress(),
      to: recipient,
      subject: String(subject || '').trim() || 'A message from Avalon Vitality',
      html: html || undefined,
      text: text || undefined,
    });
    if (result?.error) {
      console.warn('[send-email] provider send failed', { code: result.error?.name || 'resend_error' });
      return { ok: false, code: 'provider_send_failed', status: 502 };
    }
    return { ok: true, id: result?.data?.id };
  } catch (err) {
    console.warn('[send-email] provider request error', safeLogContext(err, 'send_email_provider_request_failed'));
    return { ok: false, code: 'provider_request_failed', status: 502 };
  }
}
