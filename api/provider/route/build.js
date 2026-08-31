import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { createRoutePlan, geocodeAddress, getProviderForAuth, latestRevision, loadAssignedAppointments, OMIT_REASONS, requireRouteApproval, ROUTE_ROLES, shapeAssignedAppointment } from '../../_lib/nurse-route.js';

function validCoordinate(value) {
  return Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude)) && Math.abs(Number(value.latitude)) <= 90 && Math.abs(Number(value.longitude)) <= 180;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRouteApproval(res)) return;
  const authed = await requireRole(req, res, ROUTE_ROLES);
  if (!authed) return;
  try {
    const provider = await getProviderForAuth(authed);
    if (!provider?.active) return res.status(403).json({ error: 'An active provider profile is required.' });
    const { date, rows } = await loadAssignedAppointments({ db: authed.db, tenantId: authed.tenantId, providerId: provider.id, date: req.body?.date });
    const submittedIds = new Set(Array.isArray(req.body?.selectedAppointmentIds) ? req.body.selectedAppointmentIds : []);
    const omissions = req.body?.omissions && typeof req.body.omissions === 'object' ? req.body.omissions : {};
    const assignedIds = new Set(rows.map((row) => row.id));
    if ([...submittedIds].some((id) => !assignedIds.has(id))) return res.status(403).json({ error: 'The route contains an appointment not assigned to this nurse.' });
    const shaped = rows.map((row) => shapeAssignedAppointment(row));
    for (const stop of shaped) {
      stop.selected = stop.eligible && submittedIds.has(stop.appointmentId);
      if (stop.eligible && !stop.selected) {
        const omission = omissions[stop.appointmentId] || {};
        if (!OMIT_REASONS.has(omission.reason) || (omission.reason === 'other' && !String(omission.note || '').trim())) {
          return res.status(422).json({ error: 'Every omitted eligible appointment requires a reason.', appointmentId: stop.appointmentId });
        }
        stop.omissionReason = omission.reason;
        stop.omissionNote = String(omission.note || '').trim();
      }
    }
    let origin = req.body?.origin || {};
    if (origin.id) {
      const result = await authed.db.from('provider_route_origins').select('*').eq('id', origin.id).eq('tenant_id', authed.tenantId).maybeSingle();
      if (result.error) throw result.error;
      const saved = result.data;
      if (!saved || (saved.kind === 'home' && saved.owner_profile_id !== authed.user.id)) return res.status(403).json({ error: 'Origin is not available to this nurse.' });
      origin = { id: saved.id, kind: saved.kind, label: saved.label, address: saved.address, latitude: saved.latitude, longitude: saved.longitude, persisted: true };
    } else {
      if (origin.kind === 'manual' && !validCoordinate(origin)) {
        const coordinate = await geocodeAddress(String(origin.address || ''));
        if (coordinate) origin = { ...origin, ...coordinate };
      }
      if (!['current', 'manual'].includes(origin.kind) || !validCoordinate(origin)) return res.status(422).json({ error: 'Choose a valid route origin.' });
      origin = { kind: origin.kind, label: origin.kind === 'current' ? 'Current Location' : String(origin.label || 'Manual origin'), address: origin.kind === 'current' ? '' : String(origin.address || ''), latitude: Number(origin.latitude), longitude: Number(origin.longitude), persisted: false };
    }
    const plan = await createRoutePlan({ date, origin, stops: shaped });
    const revision = latestRevision(rows);
    const persistedOrigin = origin.kind === 'current' ? { origin_latitude: null, origin_longitude: null, origin_address: null } : { origin_latitude: origin.latitude, origin_longitude: origin.longitude, origin_address: origin.address || null };
    const dayResult = await authed.db.from('provider_route_days').upsert({
      tenant_id: authed.tenantId, provider_profile_id: provider.id, route_date: date, origin_kind: origin.kind, origin_id: origin.id || null, origin_label: origin.label,
      ...persistedOrigin, status: 'active', assignment_revision: revision, acknowledged_revision: revision,
    }, { onConflict: 'provider_profile_id,route_date' }).select('id').single();
    if (dayResult.error) throw dayResult.error;
    const routeDayId = dayResult.data.id;
    const stopRows = shaped.map((stop) => ({
      tenant_id: authed.tenantId, route_day_id: routeDayId, appointment_id: stop.appointmentId, assigned_provider_profile_id: provider.id, selected: stop.selected,
      omission_reason: stop.selected ? null : (stop.omissionReason || 'unavailable'), omission_note: stop.omissionNote || null, assignment_snapshot_at: revision,
    }));
    if (stopRows.length) {
      const result = await authed.db.from('provider_route_day_stops').upsert(stopRows, { onConflict: 'route_day_id,appointment_id' });
      if (result.error) throw result.error;
    }
    plan.id = routeDayId;
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'provider_route_built', entityType: 'provider_route_day', entityId: routeDayId, phiTouched: true,
      payload: { routeDate: date, selectedCount: plan.stops.length, omittedCount: shaped.length - plan.stops.length, originKind: origin.kind, trafficState: plan.trafficState },
    });
    return res.status(200).json({ plan });
  } catch (error) {
    return res.status(500).json({ error: 'Could not build the route. The appointment list is unchanged.', code: safeErrorCode(error, 'route_build_failed') });
  }
}
