/**
 * Door + station scanner backend (ET5, blueprint §6.2). Staff-only.
 *   POST /api/events/serve { slug, station, visitId? | token?, action, photoRelease? }
 *     action: 'scan'    → resolve + clearance verdict (per-service, T7 scope)
 *             'checkin' → transition confirmed→served (audited; TTF timestamp)
 *
 * Clearance rendering rule (DESIGN.md): the verdict is an enum; red means
 * clinical stop, green means cleared — the UI colors come from the shared
 * status module, this endpoint never sends colors.
 */
import { getServiceClient, requireStaff } from '../_lib/supabase-auth.js';
import { verifyVisitToken, clearanceAtStation } from '../_lib/events-qr.js';

const STATIONS = new Set(['flow', 'express', 'experience']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const caller = await requireStaff(req, res);
  if (!caller) return undefined;

  const db = await getServiceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'Service unavailable.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const station = STATIONS.has(body.station) ? body.station : 'experience';
    const action = body.action === 'checkin' ? 'checkin' : 'scan';

    let visitId = String(body.visitId || '').trim();
    let tokenPayload = null;
    if (!visitId && body.token) {
      const verdict = verifyVisitToken(body.token);
      if (!verdict.valid) {
        return res.status(200).json({ ok: true, result: 'invalid_token', reason: verdict.reason });
      }
      tokenPayload = verdict.payload;
      visitId = tokenPayload.vid;
    }
    if (!visitId) return res.status(400).json({ ok: false, error: 'visitId or token required.' });

    const { data: visit } = await db
      .from('event_visits')
      .select('id, attendee_name, status, gfe_status, gfe_scope, qr_jti, served_at, container_id, event_services:service_id (name, service_class, requires_gfe), event_containers:container_id (slug, name)')
      .eq('id', visitId)
      .maybeSingle();
    if (!visit) return res.status(200).json({ ok: true, result: 'not_found' });

    // Replay protection (T7): the token's jti must match the visit's current one.
    if (tokenPayload && visit.qr_jti && tokenPayload.jti !== visit.qr_jti) {
      return res.status(200).json({ ok: true, result: 'replayed_or_rotated_token' });
    }

    const clearance = clearanceAtStation({
      gfeStatus: visit.gfe_status,
      gfeScope: visit.gfe_scope,
      gfeRequired: Boolean(visit.event_services?.requires_gfe),
    }, station);

    const shape = {
      visitId: visit.id,
      name: visit.attendee_name || 'Guest',
      status: visit.status,
      gfeStatus: visit.gfe_status,
      serviceName: visit.event_services?.name || null,
      serviceClass: visit.event_services?.service_class || null,
      event: visit.event_containers?.name || null,
      alreadyServed: Boolean(visit.served_at),
      clearance,               // { allowed, level: 'ok'|'stop', reason? }
    };

    if (action === 'scan') {
      if (!['confirmed', 'served'].includes(visit.status)) {
        return res.status(200).json({ ok: true, result: 'verify_with_lead', reason: `status_${visit.status}`, visit: shape });
      }
      return res.status(200).json({ ok: true, result: 'scanned', visit: shape });
    }

    // checkin
    if (visit.status === 'served') {
      return res.status(200).json({ ok: true, result: 'already_served', visit: shape });
    }
    if (visit.status !== 'confirmed') {
      return res.status(200).json({ ok: true, result: 'verify_with_lead', reason: `status_${visit.status}`, visit: shape });
    }
    if (!clearance.allowed && station !== 'experience') {
      return res.status(200).json({ ok: true, result: 'clearance_stop', visit: shape });
    }

    const { data: served, error } = await db.rpc('transition_event_visit', {
      p_visit_id: visit.id, p_field: 'status', p_to: 'served',
      p_actor: caller.user?.id || null,
      p_meta: { via: 'serve', station },
    });
    if (error) throw error;
    if (typeof body.photoRelease === 'boolean') {
      await db.from('event_visits').update({ photo_release: body.photoRelease }).eq('id', visit.id);
    }
    return res.status(200).json({ ok: true, result: 'served', visit: { ...shape, status: served?.status || 'served' } });
  } catch (err) {
    console.error('[events/serve]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Serve action failed.' });
  }
}
