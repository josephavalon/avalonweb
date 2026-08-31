import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { getProviderForAuth, latestRevision, loadAssignedAppointments, requireRouteApproval, ROUTE_ROLES } from '../../_lib/nurse-route.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRouteApproval(res)) return;
  const authed = await requireRole(req, res, ROUTE_ROLES);
  if (!authed) return;
  try {
    const provider = await getProviderForAuth(authed);
    const { date, rows } = await loadAssignedAppointments({ db: authed.db, tenantId: authed.tenantId, providerId: provider?.id, date: req.body?.date });
    const revision = latestRevision(rows);
    const { data: day, error } = await authed.db.from('provider_route_days')
      .update({ acknowledged_revision: revision, assignment_revision: revision, status: 'active' })
      .eq('provider_profile_id', provider.id).eq('route_date', date).select('id, active_appointment_id').single();
    if (error) throw error;
    const assignedIds = new Set(rows.map((row) => row.id));
    const { data: saved } = await authed.db.from('provider_route_day_stops').select('appointment_id').eq('route_day_id', day.id);
    const removed = (saved || []).filter((stop) => !assignedIds.has(stop.appointment_id)).map((stop) => stop.appointment_id);
    if (removed.length) await authed.db.from('provider_route_day_stops').delete().eq('route_day_id', day.id).in('appointment_id', removed);
    const existing = new Set((saved || []).map((stop) => stop.appointment_id));
    const added = rows.filter((row) => !existing.has(row.id)).map((row) => ({ tenant_id: authed.tenantId, route_day_id: day.id, appointment_id: row.id, assigned_provider_profile_id: provider.id, selected: true, assignment_snapshot_at: revision }));
    if (added.length) await authed.db.from('provider_route_day_stops').insert(added);
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'provider_route_change_acknowledged', entityType: 'provider_route_day', entityId: day.id, phiTouched: true,
      payload: { routeDate: date, addedCount: added.length, removedCount: removed.length },
    });
    return res.status(200).json({ acknowledged: true, revision, activeStopRemoved: removed.includes(day.active_appointment_id) });
  } catch (error) {
    return res.status(500).json({ error: 'Could not acknowledge the route change.', code: safeErrorCode(error, 'route_ack_failed') });
  }
}
