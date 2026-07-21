/**
 * POST /api/admin/bookings/update
 *
 * Staff/admin: edit the editable details of a booking — customer name, email,
 * phone, service address, appointment date/time, and service label. Contact +
 * service details live inside the appointment's external_payload JSON, so we
 * read the current row, merge the supplied fields, and write it back; the
 * date/time maps to the top-level starts_at column. Tenant-scoped via the
 * authenticated profile so staff at tenant A cannot edit tenant B's rows.
 * Audited (PHI touched).
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

function cleanString(value) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const appointmentId = String(req.body?.appointmentId || '').trim();
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required', code: 'appointment_id_required' });
  }

  const name = cleanString(req.body?.name);
  const email = cleanString(req.body?.email);
  const phone = cleanString(req.body?.phone);
  const address = cleanString(req.body?.address);
  const service = cleanString(req.body?.service);
  const startsAtRaw = cleanString(req.body?.startsAt);

  let startsAtIso;
  if (startsAtRaw !== undefined && startsAtRaw !== '') {
    const parsed = new Date(startsAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'Invalid date/time.', code: 'invalid_starts_at' });
    }
    startsAtIso = parsed.toISOString();
  }

  // Read the current row so we merge into (not clobber) external_payload.
  let readQuery = db.from('appointments')
    .select('id, tenant_id, external_payload')
    .eq('id', appointmentId);
  if (tenantId) readQuery = readQuery.eq('tenant_id', tenantId);
  const { data: rows, error: readError } = await readQuery.limit(1);
  if (readError) {
    console.warn('[admin/bookings/update] read failed', safeLogContext(readError, 'admin_booking_update_read_failed'));
    return res.status(500).json({ error: 'Could not load booking.', code: safeErrorCode(readError, 'admin_booking_update_read_failed') });
  }
  const row = rows?.[0];
  if (!row) {
    return res.status(404).json({ error: 'Booking not found.', code: 'booking_not_found' });
  }

  const payload = (row.external_payload && typeof row.external_payload === 'object') ? { ...row.external_payload } : {};
  const contact = { ...(payload.contact || {}) };
  const appointment = { ...(payload.appointment || {}) };

  if (name !== undefined) {
    contact.name = name;
    // The list also falls back to firstName/lastName; clear them so the edited
    // full name is what shows (otherwise a stale firstName could win).
    delete contact.firstName;
    delete contact.lastName;
  }
  if (email !== undefined) contact.email = email;
  if (phone !== undefined) contact.phone = phone;
  if (address !== undefined) appointment.address = address;
  payload.contact = contact;
  payload.appointment = appointment;
  if (service !== undefined) payload.primaryService = service;

  // Staff-recorded SMS-reminder consent (e.g. captured verbally). Stored with a
  // timestamp + the staff member who recorded it so there's an audit trail for
  // why PHI-bearing reminders are permitted to this number.
  if (req.body?.smsConsent !== undefined) {
    payload.smsReminderConsent = req.body.smsConsent
      ? { granted: true, at: new Date().toISOString(), source: 'staff_recorded', recordedBy: authed.user?.id || null }
      : { granted: false, at: new Date().toISOString(), source: 'staff_recorded', recordedBy: authed.user?.id || null };
  }

  const update = { external_payload: payload, updated_at: new Date().toISOString() };
  if (startsAtIso) update.starts_at = startsAtIso;

  let writeQuery = db.from('appointments').update(update).eq('id', appointmentId);
  if (tenantId) writeQuery = writeQuery.eq('tenant_id', tenantId);
  const { error: writeError } = await writeQuery;
  if (writeError) {
    console.warn('[admin/bookings/update] write failed', safeLogContext(writeError, 'admin_booking_update_failed'));
    return res.status(500).json({ error: 'Could not save changes.', code: safeErrorCode(writeError, 'admin_booking_update_failed') });
  }

  await writeAuditEvent(db, {
    tenantId: authed.tenantId || null,
    actorProfileId: authed.user?.id || null,
    action: 'admin_booking_update',
    entityType: 'appointments',
    phiTouched: true,
    payload: {
      route: 'api/admin/bookings/update',
      appointmentId,
      fields: Object.keys({ name, email, phone, address, service, startsAt: startsAtIso }).filter((k) => {
        const map = { name, email, phone, address, service, startsAt: startsAtIso };
        return map[k] !== undefined;
      }),
    },
  });

  return res.status(200).json({ ok: true });
}
