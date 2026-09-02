import { requireRole } from '../../../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../../../_lib/safe-error.js';
import { NURSE_ROLES, parseJsonBody, requireUuid, resolveNurseProvider } from '../../../_lib/nurse-workflow.js';
import { hydrateRouteDay, loadOwnedRouteDay, planOwnedRouteDay } from '../../../_lib/nurse-route-days.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const provider = await resolveNurseProvider(authed);
    const routeDay = await loadOwnedRouteDay(authed.db, {
      tenantId: authed.tenantId,
      providerProfileId: provider.id,
      routeDayId: requireUuid(req.query?.id, 'Route day id'),
    });
    const body = parseJsonBody(req);
    if (body.consent !== true && body.origin?.consent !== true) {
      return res.status(400).json({ error: 'Fresh origin consent is required.', code: 'route_origin_consent_required' });
    }
    const result = await planOwnedRouteDay(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      providerProfileId: provider.id,
      routeDay,
      body,
    });
    const refreshed = await loadOwnedRouteDay(authed.db, {
      tenantId: authed.tenantId, providerProfileId: provider.id, routeDayId: routeDay.id,
    });
    return res.status(200).json({ ok: true, result, route_day: await hydrateRouteDay(authed.db, authed.tenantId, refreshed) });
  } catch (error) {
    console.warn('[me/route-days/plan] failed', safeLogContext(error, 'route_plan_failed'));
    return res.status(error.status || 500).json({
      error: error.expose ? error.message : 'Could not plan this route.',
      code: safeErrorCode(error, 'route_plan_failed'),
    });
  }
}
