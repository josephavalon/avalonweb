/**
 * GET /api/admin/inventory-low
 *
 * Staff/admin read-only list of inventory items whose on-hand quantity has
 * fallen at-or-below their configured reorder threshold (`min_level` on the
 * `items` table). Powers the "Low stock" banner at the top of /admin/inventory
 * so staff get a heads-up before a clinical bag/add-on runs out mid-route.
 *
 * Sort: most under-stocked first (largest deficit), then by name.
 * Cap: 100 rows.
 */

import { requireStaff } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

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
    // Load all live items; filter to qty <= min_level in JS so we can compute
    // the deficit ordering without a stored generated column.
    const { data, error } = await db.from('items')
      .select('id, name, sku, qty, min_level, unit, folder_id, updated_at')
      .is('deleted_at', null)
      .limit(2000);
    if (error) throw error;

    const rows = (data || [])
      .map((r) => ({
        id:           r.id,
        name:         r.name,
        sku:          r.sku || null,
        qty:          Number(r.qty || 0),
        minLevel:     Number(r.min_level || 0),
        unit:         r.unit || 'units',
        folderId:     r.folder_id || null,
        updatedAt:    r.updated_at || null,
        deficit:      Math.max(0, Number(r.min_level || 0) - Number(r.qty || 0)),
        out:          Number(r.qty || 0) <= 0,
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
