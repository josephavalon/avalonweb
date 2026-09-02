import { loadConnectedInventoryOverview, requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    const flags = requireConnectedInventory();
    requireInventoryCanaryProfile(authed.user.id);
    const data = await loadConnectedInventoryOverview(authed.db, authed.tenantId);
    return res.status(200).json({ status: 'AVAILABLE', flags, data });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Connected inventory is unavailable.');
  }
}
