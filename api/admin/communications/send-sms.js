/**
 * POST /api/admin/communications/send-sms
 *
 * Staff/admin: send a PHI-free SMS to a client through Quo (api/_lib/send-sms.js).
 * This is the general-purpose "Communications" send — nudges, "check your email"
 * notices, payment links. It uses the standard guarded sender, so the runtime
 * PHI block-list applies: any clinical content is refused before it reaches Quo.
 * For consented appointment reminders (PHI-bearing) use send-reminder.js instead.
 * Audited; the body is NOT stored in the audit log (defense-in-depth).
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { sendSms, isSmsConfigured } from '../../_lib/send-sms.js';
import { recordOutbound } from '../../_lib/comm-store.js';

const FRIENDLY = {
  sms_not_configured: 'Texting is not configured yet (missing Quo credentials).',
  invalid_phone: 'That phone number looks invalid.',
  phi_in_sms_body: 'That message looks like it contains appointment or clinical details. SMS can only carry general, non-clinical text — keep it to a nudge and point the client to their email.',
  provider_send_failed: 'The texting provider rejected the message. Try again.',
  provider_request_failed: 'Could not reach the texting provider. Try again.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  if (!isSmsConfigured()) {
    return res.status(503).json({ error: FRIENDLY.sms_not_configured, code: 'sms_not_configured' });
  }

  const to = String(req.body?.to || '').trim();
  const body = String(req.body?.body || '').trim();
  const name = String(req.body?.name || '').trim() || null;
  if (!to) return res.status(400).json({ error: 'A phone number is required.', code: 'phone_required' });
  if (!body) return res.status(400).json({ error: 'Message text is required.', code: 'body_required' });
  if (body.length > 480) return res.status(400).json({ error: 'Message is too long.', code: 'body_too_long' });

  const result = await sendSms({ to, body });

  // Log the sent text as an outbound message so it threads in the inbox.
  if (result.ok) {
    await recordOutbound({ tenantId: authed.tenantId, channel: 'sms', contact: result.normalizedTo || to, name, body, sentBy: authed.user?.id || null });
  }

  await writeAuditEvent(authed.db, {
    tenantId: authed.tenantId || null,
    actorProfileId: authed.user?.id || null,
    action: 'admin_sms_send',
    entityType: 'communications',
    phiTouched: false, // PHI-free channel; bodies with clinical tokens are refused.
    payload: { route: 'api/admin/communications/send-sms', ok: result.ok, code: result.code || null, bodyLength: body.length },
  });

  if (!result.ok) {
    return res.status(result.status || 502).json({ error: FRIENDLY[result.code] || 'Could not send the text.', code: result.code || 'send_failed' });
  }
  return res.status(200).json({ ok: true });
}
