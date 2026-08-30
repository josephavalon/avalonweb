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
import { requireStaff } from '../_lib/supabase-auth.js';
import { verifyVisitToken, clearanceAtStation } from '../_lib/events-qr.js';

const STATIONS = new Set(['flow', 'express', 'experience']);

export function requireEventVisitRead(result) {
  if (result?.error) throw result.error;
  return result?.data || null;
}

export function tokenMatchesPersistedVisitJti(tokenPayload, storedJti) {
  const tokenJti = String(tokenPayload?.jti || '').trim();
  const persistedJti = String(storedJti || '').trim();
  return Boolean(tokenJti && persistedJti && tokenJti === persistedJti);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const caller = await requireStaff(req, res);
  if (!caller) return undefined;
  const { db, tenantId } = caller;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const station = STATIONS.has(body.station) ? body.station : 'experience';
    const action = body.action === 'checkin' ? 'checkin' : 'scan';
    const slug = String(body.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, error: 'Event slug is required.' });

    // Resolve the event inside the caller's tenant before accepting either a
    // raw visit id or a signed visit token. The service-role client bypasses
    // RLS, so this relationship check is the authorization boundary.
    const { data: container, error: containerError } = await db
      .from('event_containers')
      .select('id, slug, name')
      .eq('slug', slug)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (containerError) throw containerError;
    if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

    let visitId = String(body.visitId || '').trim();
    let tokenPayload = null;
    if (!visitId && body.token) {
      const verdict = verifyVisitToken(body.token);
      if (!verdict.valid) {
        return res.status(200).json({ ok: true, result: 'invalid_token', reason: verdict.reason });
      }
      tokenPayload = verdict.payload;
      visitId = tokenPayload.vid;
      if (tokenPayload.ev !== container.slug && tokenPayload.ev !== container.id) {
        return res.status(200).json({ ok: true, result: 'token_event_mismatch' });
      }
    }
    if (!visitId) return res.status(400).json({ ok: false, error: 'visitId or token required.' });

    const visitResult = await db
      .from('event_visits')
      .select('id, attendee_name, status, gfe_status, gfe_scope, qr_jti, served_at, container_id, service_id')
      .eq('id', visitId)
      .eq('tenant_id', tenantId)
      .eq('container_id', container.id)
      .maybeSingle();
    const visit = requireEventVisitRead(visitResult);
    if (!visit) return res.status(200).json({ ok: true, result: 'not_found' });

    let service = null;
    if (visit.service_id) {
      const { data, error: serviceError } = await db
        .from('event_services')
        .select('id, name, service_class, requires_gfe')
        .eq('id', visit.service_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (serviceError) throw serviceError;
      if (!data) throw new Error('event_service_scope_mismatch');
      service = data;
    }

    // Replay protection (T7): a signed token is usable only when the scoped
    // database row holds the same non-empty JTI. Missing persisted state is a
    // denial, never an invitation to trust the token payload.
    if (tokenPayload && !tokenMatchesPersistedVisitJti(tokenPayload, visit.qr_jti)) {
      return res.status(200).json({ ok: true, result: 'replayed_or_rotated_token' });
    }

    const clearance = clearanceAtStation({
      gfeStatus: visit.gfe_status,
      gfeScope: visit.gfe_scope,
      gfeRequired: Boolean(service?.requires_gfe),
    }, station);

    const shape = {
      visitId: visit.id,
      name: visit.attendee_name || 'Guest',
      status: visit.status,
      gfeStatus: visit.gfe_status,
      serviceName: service?.name || null,
      serviceClass: service?.service_class || null,
      event: container.name,
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
      const { error: photoError } = await db.from('event_visits')
        .update({ photo_release: body.photoRelease })
        .eq('id', visit.id)
        .eq('tenant_id', tenantId)
        .eq('container_id', container.id);
      if (photoError) throw photoError;
    }
    return res.status(200).json({ ok: true, result: 'served', visit: { ...shape, status: served?.status || 'served' } });
  } catch (err) {
    console.error('[events/serve]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Serve action failed.' });
  }
}
