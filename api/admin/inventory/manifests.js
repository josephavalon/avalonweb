import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function cleanRequirements(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new PayOpsError('Manifest requirements are invalid.', 'inventory_manifest_requirements_invalid', 400);
  return rows.map((row, index) => ({
    itemId: cleanUuid(row?.itemId, 'itemId'), variantId: optionalUuid(row?.variantId, 'variantId'),
    quantity: cleanQuantity(row?.quantity), lotRequired: row?.lotRequired === true,
    temperatureEvidenceRequired: row?.temperatureEvidenceRequired === true,
    calibrationEvidenceRequired: row?.calibrationEvidenceRequired === true, pickupAllowed: row?.pickupAllowed !== false,
    sortOrder: Number.isInteger(row?.sortOrder) && row.sortOrder >= 0 ? row.sortOrder : index,
    allowedAlternatives: Array.isArray(row?.allowedAlternatives) ? row.allowedAlternatives.slice(0, 20) : [],
    minimumExpiryDays: Number.isInteger(row?.minimumExpiryDays) && row.minimumExpiryDays >= 0 ? row.minimumExpiryDays : 0,
    regulatedRuleCode: row?.regulatedRuleCode ? String(row.regulatedRuleCode).trim().toUpperCase().slice(0, 100) : null,
  }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite(); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const action = String(body.action || '').trim(); const key = cleanIdempotencyKey(req);
    let record;
    if (action === 'create_version') {
      const effectiveAt = new Date(body.effectiveAt || ''); const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (!Number.isFinite(effectiveAt.getTime()) || (expiresAt && !Number.isFinite(expiresAt.getTime()))) throw new PayOpsError('Manifest effective dates are invalid.', 'inventory_manifest_dates_invalid', 400);
      record = await rpc(authed.db, 'create_supply_manifest_version', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_manifest_key: String(body.manifestKey || '').trim(), p_name: String(body.name || '').trim(),
        p_service_code: String(body.serviceCode || '').trim(), p_role_required: String(body.roleRequired || '').trim(),
        p_requirements: cleanRequirements(body.requirements), p_effective_at: effectiveAt.toISOString(),
        p_expires_at: expiresAt?.toISOString() || null, p_idempotency_key: key,
      });
    } else if (action === 'approve') {
      const hash = String(body.expectedContentHash || '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new PayOpsError('Expected content hash is invalid.', 'inventory_manifest_hash_invalid', 400);
      record = await rpc(authed.db, 'approve_supply_manifest_version', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_manifest_version_id: cleanUuid(body.manifestVersionId, 'manifestVersionId'),
        p_expected_content_hash: hash, p_idempotency_key: key,
      });
    } else throw new PayOpsError('Manifest action is invalid.', 'inventory_manifest_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Supply manifest could not be updated.'); }
}
