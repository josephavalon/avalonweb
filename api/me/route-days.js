import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { NURSE_ROLES, resolveNurseProvider } from '../_lib/nurse-workflow.js';
import { hydrateRouteDay, loadOwnedRouteDay } from '../_lib/nurse-route-days.js';
import { nurseMarketplaceCapabilities } from '../_lib/nurse-marketplace.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const date = String(req.query?.date || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Route date is invalid.', code: 'invalid_route_date' });
    const provider = await resolveNurseProvider(authed);
    const day = await loadOwnedRouteDay(authed.db, {
      tenantId: authed.tenantId, providerProfileId: provider.id, routeDate: date,
    });
    const routeDay = await hydrateRouteDay(authed.db, authed.tenantId, day);
    return res.status(200).json({
      route_day: routeDay,
      route_days: routeDay ? [routeDay] : [],
      capabilities: nurseMarketplaceCapabilities(),
    });
  } catch (error) {
    console.warn('[me/route-days] failed', safeLogContext(error, 'route_days_failed'));
    return res.status(error.status || 500).json({
      error: error.expose ? error.message : 'Could not load the route day.',
      code: safeErrorCode(error, 'route_days_failed'),
    });
  }
}
