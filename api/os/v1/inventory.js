import { writeAuditEvent } from '../../_lib/audit-events.js';
import {
  fail, ok, requestId, requireOsBeta,
} from '../../_lib/os-api.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireAdmin(req, res);
  if (!authed) return;

  if (req.method === 'GET') {
    const search = text(req.query?.search, 120).replace(/[%_]/g, '');
    let query = authed.db.from('os_inventory_balances').select('*', { count: 'exact' })
      .eq('tenant_id', authed.tenantId).order('name').limit(250);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data: balances, count, error } = await query;
    if (error) return fail(res, 500, 'inventory_load_failed', 'Could not load inventory.', { requestId: id });
    const { data: expiring } = await authed.db.from('os_inventory_lots').select('id,item_id,lot_code,expires_on,unit_cost_cents')
      .eq('tenant_id', authed.tenantId).not('expires_on', 'is', null).order('expires_on').limit(100);
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'legacy_inventory_read',
      entityType: 'os_inventory_balances',
      phiTouched: false,
      payload: { route: '/api/os/v1/inventory', count: count || 0 },
    });
    return ok(res, { balances: balances || [], expiring: expiring || [], pagination: { page: 1, pageSize: 250, total: count || 0, hasMore: (count || 0) > 250 } }, { requestId: id });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
  }
  res.setHeader('Allow', 'GET');
  return fail(res, 410, 'inventory_write_route_retired', 'Inventory writes moved to the controlled Admin inventory API.', { requestId: id });
}
