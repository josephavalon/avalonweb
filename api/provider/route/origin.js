import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { geocodeAddress, getProviderForAuth, requireRouteApproval, ROUTE_ROLES } from '../../_lib/nurse-route.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRouteApproval(res)) return;
  const authed = await requireRole(req, res, ROUTE_ROLES);
  if (!authed) return;
  try {
    const provider = await getProviderForAuth(authed);
    if (!provider?.active) return res.status(403).json({ error: 'An active provider profile is required.' });
    const address = String(req.body?.address || '').trim();
    if (address.length < 6 || address.length > 240) return res.status(422).json({ error: 'Enter a valid Home address.' });
    const coordinate = await geocodeAddress(address);
    if (!coordinate) return res.status(422).json({ error: 'Home address could not be located.' });
    const row = {
      tenant_id: authed.tenantId, owner_profile_id: authed.user.id, kind: 'home', label: 'Home', address,
      latitude: coordinate.latitude, longitude: coordinate.longitude, is_default: true,
    };
    const existing = await authed.db.from('provider_route_origins').select('id').eq('owner_profile_id', authed.user.id).eq('kind', 'home').maybeSingle();
    if (existing.error) throw existing.error;
    const result = existing.data?.id
      ? await authed.db.from('provider_route_origins').update(row).eq('id', existing.data.id).select('*').single()
      : await authed.db.from('provider_route_origins').insert(row).select('*').single();
    if (result.error) throw result.error;
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'provider_route_home_saved', entityType: 'provider_route_origin', entityId: result.data.id, phiTouched: true,
      payload: { kind: 'home' },
    });
    return res.status(200).json({ origin: { id: result.data.id, kind: 'home', label: 'Home', address: result.data.address, latitude: result.data.latitude, longitude: result.data.longitude, persisted: true } });
  } catch (error) {
    return res.status(500).json({ error: 'Could not save Home.', code: safeErrorCode(error, 'route_origin_save_failed') });
  }
}
