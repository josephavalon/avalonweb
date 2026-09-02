import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventory(); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    const result = await authed.db.from('os_inventory_supplier_connections')
      .select('id,vendor_id,adapter_key,status,masked_account_label,health_code,last_validated_at,version,updated_at')
      .eq('tenant_id', authed.tenantId).order('updated_at', { ascending: false }).limit(500);
    if (result.error) throw result.error;
    return res.status(200).json({ status: 'NON_EXECUTABLE_V1', connections: result.data || [] });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Supplier connection health is unavailable.'); }
}
