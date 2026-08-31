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
 *
 * ── HIPAA POLICY ─────────────────────────────────────────────────────────────
 * Quo signs a BAA but SMS/MMS is explicitly NOT covered under it (Quo support
 * docs, 2026-06). To stay inside HIPAA without expanding scope we restrict
 * outbound SMS to:
 *
 *   1. Authentication codes (OTP) sent on the user's request.
 *   2. Staff-only operational invite codes.
 *
 * Message bodies MUST NOT contain a patient name, appointment time, address,
 * service/protocol identifier, dosage, or any other PHI. The block-list below
 * is enforced at runtime as defense-in-depth — a caller that tries to send a
 * PHI-shaped body gets refused before the message hits Quo's network.
 *
 * See docs/PHI_DATA_FLOW.md.
 */
import { safeLogContext } from './safe-error.js';
import { bodyContainsPhi } from './phi-guard.js';

export function isSmsConfigured() {
  return Boolean(process.env.QUO_API_KEY && process.env.QUO_FROM_NUMBER);
}

// Normalize human-typed input to E.164. The auth hook always passed a clean
// E.164 number, but the admin Communications page accepts free-form input like
// "(415) 555-0100" or "415-555-0100", so strip formatting and default a bare
// 10-digit number to US/CA (+1).
export function toE164(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// Internal alert fan-out list. ADMIN_ALERT_PHONES is a comma-separated E.164
// list of the admins who should get a buzz when a new request lands on the
// site. Deliberately NOT VITE_-prefixed: a VITE_ var is inlined into the public
// bundle, which would publish the founders' mobile numbers.
//
// Capped at 5 so a fat-fingered env value cannot fan a paid SMS out to an
// unbounded list, and validated strictly so one bad entry drops itself instead
// of failing the whole send.
export const MAX_ADMIN_ALERT_PHONES = 5;

export function adminAlertPhones(env = process.env) {
  const seen = new Set();
  for (const raw of String(env.ADMIN_ALERT_PHONES || '').split(',')) {
    const candidate = toE164(raw);
    if (!/^\+[1-9]\d{6,14}$/.test(candidate)) continue; // strict E.164
    seen.add(candidate);
    if (seen.size >= MAX_ADMIN_ALERT_PHONES) break;
  }
  return [...seen];
}

/**
 * @param {object}  message
 * @param {string}  message.to    recipient phone
 * @param {string}  message.body  message text
 * @param {object}  [opts]
 * @param {boolean} [opts.allowConsentedPhi=false]
 *   Skip the PHI block-list. This is ONLY for appointment reminders to a patient
 *   who has opted in to unsecured SMS (45 CFR §164.522 — a patient may request
 *   communication by an unsecured channel after being advised of the risk). The
 *   CALLER must have verified stored consent on the appointment before setting
 *   this; the OTP and staff-invite paths never set it. See docs/PHI_DATA_FLOW.md.
 */
export async function sendSms({ to, body }, opts = {}) {
  const apiKey = process.env.QUO_API_KEY;
  const from = process.env.QUO_FROM_NUMBER;
  if (!apiKey || !from) return { ok: false, code: 'sms_not_configured', status: 503 };

  const recipient = toE164(to);
  if (!recipient || recipient.length > 32) return { ok: false, code: 'invalid_phone', status: 400 };

  if (!opts.allowConsentedPhi && bodyContainsPhi(body)) {
    console.error('[send-sms] refusing to send: body contains PHI-shaped tokens (see docs/PHI_DATA_FLOW.md)');
    return { ok: false, code: 'phi_in_sms_body', status: 422 };
  }

  try {
    const resp = await fetch('https://api.quo.com/v1/messages', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(body || ''), from, to: [recipient] }),
    });
    if (!resp.ok) {
      // Capture the provider's error so SMS failures are diagnosable (no PHI —
      // this is Quo's own validation/auth message, e.g. bad number or key).
      const detail = await resp.text().catch(() => '');
      console.warn('[send-sms] provider send failed', { status: resp.status, detail: String(detail).slice(0, 400) });
      return { ok: false, code: 'provider_send_failed', status: 502, providerStatus: resp.status };
    }
    return { ok: true, normalizedTo: recipient };
  } catch (err) {
    console.warn('[send-sms] provider request error', safeLogContext(err, 'send_sms_provider_request_failed'));
    return { ok: false, code: 'provider_request_failed', status: 502 };
  }
}
