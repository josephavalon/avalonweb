/**
 * Send an SMS through Quo (formerly OpenPhone). Shared by the Supabase
 * "Send SMS" auth hook (api/auth/send-sms.js) and the staff-invite flow
 * (api/admin/team/invite.js) so there's one place that talks to the provider.
 *
 * Env:
 *   QUO_API_KEY      Quo API key (raw, used as the Authorization header)
 *   QUO_FROM_NUMBER  sending number, E.164 (e.g. +14155550199) or a PN… id
 *
 * Returns { ok: true } on a 2xx, or { ok: false, code, status } otherwise.
 * Never throws — callers branch on `ok`.
 */
import { safeLogContext } from './safe-error.js';

export function isSmsConfigured() {
  return Boolean(process.env.QUO_API_KEY && process.env.QUO_FROM_NUMBER);
}

function toE164(phone) {
  const value = String(phone || '').trim();
  return value.startsWith('+') ? value : `+${value}`;
}

export async function sendSms({ to, body }) {
  const apiKey = process.env.QUO_API_KEY;
  const from = process.env.QUO_FROM_NUMBER;
  if (!apiKey || !from) return { ok: false, code: 'sms_not_configured', status: 503 };

  const recipient = toE164(to);
  if (!recipient || recipient.length > 32) return { ok: false, code: 'invalid_phone', status: 400 };

  try {
    const resp = await fetch('https://api.quo.com/v1/messages', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(body || ''), from, to: [recipient] }),
    });
    if (!resp.ok) {
      await resp.text().catch(() => '');
      console.warn('[send-sms] provider send failed', { status: resp.status });
      return { ok: false, code: 'provider_send_failed', status: 502 };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[send-sms] provider request error', safeLogContext(err, 'send_sms_provider_request_failed'));
    return { ok: false, code: 'provider_request_failed', status: 502 };
  }
}
