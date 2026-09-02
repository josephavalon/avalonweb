import { loadConnectedNurseKit, requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    requireConnectedInventory();
    requireInventoryCanaryProfile(authed.user.id);
    const provider = await resolveNurseProvider(authed);
    if (!provider.active) return res.status(403).json({ error: 'An active provisioned RN/NP profile is required.', code: 'nurse_kit_provider_inactive' });
    const kit = await loadConnectedNurseKit(authed.db, authed.tenantId, authed.user.id);
    return res.status(200).json({ status: 'AVAILABLE', kit });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Your connected kit is unavailable.');
  }
}
