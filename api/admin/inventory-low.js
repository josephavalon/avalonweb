/**
 * GET /api/admin/inventory-low
 *
 * Staff/admin read-only list derived from the typed os_* inventory ledger.
 * Powers the "Low stock" banner at the top of /admin/inventory
 * so staff get a heads-up before a clinical bag/add-on runs out mid-route.
 *
 * Sort: most under-stocked first (largest deficit), then by name.
 * Cap: 100 rows.
 */

import { requireStaff } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { connectedInventoryFlags } from '../_lib/connected-inventory.js';

const MAX_ROWS = 100;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const { db } = authed;

  try {
    const catalogResult = await db.from('os_inventory_items')
      .select('id,name,sku,reorder_point,unit,folder_id,updated_at')
      .eq('tenant_id', authed.tenantId).eq('status', 'active').is('archived_at', null).limit(2000);
    if (catalogResult.error) throw catalogResult.error;
    const flags = connectedInventoryFlags();
    const balanceResult = flags.connected
      ? await db.from('os_inventory_availability').select('item_id,quantity_available').eq('tenant_id', authed.tenantId).limit(50000)
      : await db.from('os_inventory_location_balances').select('item_id,quantity_on_hand').eq('tenant_id', authed.tenantId).limit(50000);
    if (balanceResult.error) throw balanceResult.error;
    const quantities = new Map();
    for (const balance of balanceResult.data || []) {
      const value = flags.connected ? balance.quantity_available : balance.quantity_on_hand;
      quantities.set(balance.item_id, (quantities.get(balance.item_id) || 0) + Number(value || 0));
    }

    const rows = (catalogResult.data || [])
      .map((r) => ({
        id:           r.id,
        name:         r.name,
        sku:          r.sku || null,
        qty:          Number(quantities.get(r.id) || 0),
        minLevel:     Number(r.reorder_point || 0),
        unit:         r.unit || 'units',
        folderId:     r.folder_id || null,
        updatedAt:    r.updated_at || null,
        deficit:      Math.max(0, Number(r.reorder_point || 0) - Number(quantities.get(r.id) || 0)),
        out:          Number(quantities.get(r.id) || 0) <= 0,
      }))
      // Threshold rule: at-or-below configured min_level. Items with
      // min_level=0 are excluded unless they're fully out of stock (qty<=0
      // with min_level=0 means the item exists but is unconfigured AND empty
      // — surface as a hint).
      .filter((r) => (r.minLevel > 0 && r.qty <= r.minLevel) || (r.minLevel === 0 && r.qty <= 0))
      .sort((a, b) => (b.deficit - a.deficit) || a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS);

    return res.status(200).json({ rows, count: rows.length });
  } catch (err) {
    console.warn('[admin/inventory-low] failed',
      safeLogContext(err, 'admin_inventory_low_failed'));
    return res.status(500).json({
      error: 'Could not load low-stock items.',
      code: safeErrorCode(err, 'admin_inventory_low_failed'),
    });
  }
}
