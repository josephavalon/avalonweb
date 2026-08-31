import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { getProviderForAuth, requireRouteApproval, ROUTE_ROLES } from '../../_lib/nurse-route.js';

const TRANSITIONS = {
  assigned: new Set(['en_route']),
  confirmed: new Set(['en_route']),
  scheduled: new Set(['en_route']),
  booked: new Set(['en_route']),
  pending: new Set(['en_route']),
  paid: new Set(['en_route']),
  en_route: new Set(['arrived']),
  arrived: new Set(['started', 'in_treatment']),
  started: new Set(['completed']),
  in_treatment: new Set(['completed']),
};

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRouteApproval(res)) return;
  const authed = await requireRole(req, res, ROUTE_ROLES);
  if (!authed) return;
  try {
    const provider = await getProviderForAuth(authed);
    const appointmentId = String(req.body?.appointmentId || '');
    const nextStatus = req.body?.status === 'started' ? 'in_treatment' : String(req.body?.status || '');
    const { data: appointment, error } = await authed.db.from('appointments')
      .select('id, status, provider_profile_id, tenant_id')
      .eq('id', appointmentId).eq('tenant_id', authed.tenantId).eq('provider_profile_id', provider?.id).maybeSingle();
    if (error) throw error;
    if (!appointment) return res.status(404).json({ error: 'Assigned appointment not found.' });
    if (!TRANSITIONS[String(appointment.status || '').toLowerCase()]?.has(nextStatus)) return res.status(409).json({ error: `Cannot move from ${appointment.status} to ${nextStatus}.` });
    const update = await authed.db.from('appointments').update({ status: nextStatus }).eq('id', appointment.id).eq('provider_profile_id', provider.id).select('id, status').single();
    if (update.error) throw update.error;
    const routeDayId = req.body?.routeDayId;
    if (routeDayId) {
      let dayPatch = nextStatus === 'completed' ? { active_appointment_id: null } : { active_appointment_id: appointment.id, status: 'active' };
      if (nextStatus === 'completed') {
        const { data: remainingStops } = await authed.db.from('provider_route_day_stops')
          .select('appointment_id, appointments!inner(status)').eq('route_day_id', routeDayId).eq('selected', true);
        const hasRemaining = (remainingStops || []).some((stop) => stop.appointment_id !== appointment.id && String(stop.appointments?.status || '').toLowerCase() !== 'completed');
        if (!hasRemaining) dayPatch = { ...dayPatch, status: 'completed' };
      }
      await authed.db.from('provider_route_days').update(dayPatch).eq('id', routeDayId).eq('provider_profile_id', provider.id);
    }
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id, action: `provider_route_stop_${nextStatus}`, entityType: 'appointment', entityId: appointment.id, phiTouched: true,
      payload: { previousStatus: appointment.status, nextStatus },
    });
    return res.status(200).json({ appointment: update.data });
  } catch (error) {
    return res.status(500).json({ error: 'Could not update the stop.', code: safeErrorCode(error, 'route_stop_update_failed') });
  }
}
