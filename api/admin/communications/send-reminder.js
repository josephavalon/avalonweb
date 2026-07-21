/**
 * POST /api/admin/communications/send-reminder
 *
 * Staff/admin: send an appointment reminder SMS to a client — but ONLY if that
 * client has opted in to text reminders (45 CFR §164.522: a patient may request
 * communication over an unsecured channel after being advised of the risk).
 * Consent is captured at booking (external_payload.contact.smsReminderConsent)
 * or recorded by staff (external_payload.smsReminderConsent). We verify consent
 * here, then send with allowConsentedPhi so a reminder that names the time/visit
 * is permitted for that consented number. Tenant-scoped. Audited (PHI touched).
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { sendSms, isSmsConfigured } from '../../_lib/send-sms.js';
import { recordOutbound } from '../../_lib/comm-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

function consentGranted(payload) {
  const fromContact = payload?.contact?.smsReminderConsent;
  const fromAdmin = payload?.smsReminderConsent;
  const truthy = (v) => v === true || (v && typeof v === 'object' && v.granted === true);
  return truthy(fromContact) || truthy(fromAdmin);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  if (!isSmsConfigured()) {
    return res.status(503).json({ error: 'Texting is not configured yet.', code: 'sms_not_configured' });
  }

  const { db, tenantId } = authed;
  const appointmentId = String(req.body?.appointmentId || '').trim();
  const customBody = String(req.body?.body || '').trim();
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required', code: 'appointment_id_required' });
  }

  let readQuery = db.from('appointments')
    .select('id, tenant_id, starts_at, external_payload')
    .eq('id', appointmentId);
  if (tenantId) readQuery = readQuery.eq('tenant_id', tenantId);
  const { data: rows, error: readError } = await readQuery.limit(1);
  if (readError) {
    console.warn('[admin/send-reminder] read failed', safeLogContext(readError, 'admin_reminder_read_failed'));
    return res.status(500).json({ error: 'Could not load booking.', code: safeErrorCode(readError, 'admin_reminder_read_failed') });
  }
  const row = rows?.[0];
  if (!row) return res.status(404).json({ error: 'Booking not found.', code: 'booking_not_found' });

  const payload = row.external_payload || {};
  if (!consentGranted(payload)) {
    return res.status(403).json({
      error: 'This client has not consented to text reminders. Record their consent first, or send a general (non-clinical) text instead.',
      code: 'sms_consent_missing',
    });
  }

  const phone = payload.contact?.phone;
  if (!phone) {
    return res.status(400).json({ error: 'No phone number on file for this booking.', code: 'no_phone_on_file' });
  }

  const body = customBody || 'Avalon Vitality reminder: your upcoming visit is confirmed. Reply here if you need to reschedule.';
  if (body.length > 480) {
    return res.status(400).json({ error: 'Message is too long.', code: 'body_too_long' });
  }

  // Consent verified above → the PHI block-list is intentionally bypassed for
  // this one consented recipient.
  const result = await sendSms({ to: phone, body }, { allowConsentedPhi: true });

  if (result.ok) {
    await recordOutbound({ tenantId: authed.tenantId, channel: 'sms', contact: result.normalizedTo || phone, name: payload.contact?.name || null, body, sentBy: authed.user?.id || null });
  }

  await writeAuditEvent(db, {
    tenantId: authed.tenantId || null,
    actorProfileId: authed.user?.id || null,
    action: 'admin_sms_reminder_send',
    entityType: 'appointments',
    phiTouched: true,
    payload: { route: 'api/admin/communications/send-reminder', appointmentId, ok: result.ok, code: result.code || null },
  });

  if (!result.ok) {
    return res.status(result.status || 502).json({ error: 'Could not send the reminder.', code: result.code || 'send_failed' });
  }
  return res.status(200).json({ ok: true });
}
