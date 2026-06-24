/**
 * POST /api/admin/bookings/delete
 *
 * Staff/admin: permanently delete a booking row (used to clear test/junk
 * bookings out of the live list). Tenant-scoped via the authenticated profile
 * so staff at tenant A cannot delete tenant B's rows. Audited.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

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

  let query = db.from('appointments').delete().eq('id', appointmentId);
  // Service-role bypasses RLS — scope the delete to the caller's tenant.
  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { error } = await query;
  if (error) {
    console.warn('[admin/bookings/delete] delete failed', safeLogContext(error, 'admin_booking_delete_failed'));
    return res.status(500).json({
      error: 'Could not delete booking.',
      code: safeErrorCode(error, 'admin_booking_delete_failed'),
    });
  }

  await writeAuditEvent(db, {
    tenantId: authed.tenantId || null,
    actorProfileId: authed.user?.id || null,
    action: 'admin_booking_delete',
    entityType: 'appointments',
    phiTouched: true,
    payload: { route: 'api/admin/bookings/delete', appointmentId },
  });

  return res.status(200).json({ ok: true });
}
