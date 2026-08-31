import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { assignmentChange, getProviderForAuth, loadAssignedAppointments, requireRouteApproval, ROUTE_ROLES, shapeAssignedAppointment } from '../../_lib/nurse-route.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRouteApproval(res)) return;
  const authed = await requireRole(req, res, ROUTE_ROLES);
  if (!authed) return;
  try {
    const provider = await getProviderForAuth(authed);
    if (!provider?.active) return res.status(403).json({ error: 'An active provider profile is required.' });
    const { date, rows } = await loadAssignedAppointments({ db: authed.db, tenantId: authed.tenantId, providerId: provider.id, date: req.query?.date });
    const { data: origins, error: originsError } = await authed.db.from('provider_route_origins')
      .select('id, kind, label, address, latitude, longitude, is_default')
      .eq('tenant_id', authed.tenantId)
      .or(`kind.eq.office,owner_profile_id.eq.${authed.user.id}`)
      .order('is_default', { ascending: false });
    if (originsError) throw originsError;
    const { data: routeDay, error: dayError } = await authed.db.from('provider_route_days')
      .select('*').eq('provider_profile_id', provider.id).eq('route_date', date).maybeSingle();
    if (dayError) throw dayError;
    let savedStops = [];
    if (routeDay) {
      const result = await authed.db.from('provider_route_day_stops').select('*').eq('route_day_id', routeDay.id);
      if (result.error) throw result.error;
      savedStops = result.data || [];
    }
    const byAppointment = new Map(savedStops.map((stop) => [stop.appointment_id, stop]));
    const appointments = rows.map((row) => shapeAssignedAppointment(row, byAppointment.get(row.id)));
    const change = assignmentChange(rows, routeDay, savedStops);
    change.addedAppointments = appointments
      .filter((item) => change.addedAppointmentIds.includes(item.appointmentId))
      .map(({ appointmentId, clientDisplayName, scheduledAt }) => ({ appointmentId, clientDisplayName, scheduledAt }));
    change.removedAppointments = [];
    if (change.removedAppointmentIds.length) {
      const { data: removedRows } = await authed.db.from('appointments')
        .select('id, status, starts_at, protocol_key, payment_status, gfe_status, external_payload')
        .eq('tenant_id', authed.tenantId).in('id', change.removedAppointmentIds);
      change.removedAppointments = (removedRows || [])
        .map((row) => shapeAssignedAppointment(row))
        .map(({ appointmentId, clientDisplayName, scheduledAt }) => ({ appointmentId, clientDisplayName, scheduledAt }));
    }
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'provider_route_day_read', entityType: 'provider_route_day', entityId: routeDay?.id || null, phiTouched: true,
      payload: { routeDate: date, appointmentCount: appointments.length, changePending: change.needsAcknowledgement },
    });
    return res.status(200).json({
      date,
      provider: { id: provider.id, name: provider.profiles?.full_name || 'Nurse' },
      appointments,
      origins: (origins || []).map((origin) => ({ ...origin, persisted: true })),
      routeDay,
      assignmentChange: change,
    });
  } catch (error) {
    console.warn('[nurse-route] route day load failed', safeLogContext(error, 'route_day_load_failed'));
    return res.status(500).json({ error: 'Could not load the route day.', code: safeErrorCode(error, 'route_day_load_failed') });
  }
}
