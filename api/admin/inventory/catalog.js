import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

const CLASSES = new Set(['general_commodity', 'medical_supply', 'regulated_device', 'prescription_drug', 'biologic', 'compounded_product', 'cold_chain', 'controlled_substance', 'hazardous_material', 'calibration_equipment', 'other_reviewed']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite();
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    if (body.action !== 'classify') throw new PayOpsError('Catalog action is invalid.', 'inventory_catalog_action_invalid', 400);
    const regulatedClass = String(body.regulatedClass || '').trim().toLowerCase();
    if (!CLASSES.has(regulatedClass)) throw new PayOpsError('Classification is invalid.', 'inventory_classification_invalid', 400);
    const storagePolicy = body.storagePolicy && typeof body.storagePolicy === 'object' && !Array.isArray(body.storagePolicy) ? body.storagePolicy : {};
    if (!['ambient', 'controlled_room_temperature', 'refrigerated', 'frozen', 'hazardous', 'calibration_controlled'].includes(String(storagePolicy.storageClass || ''))) {
      throw new PayOpsError('A reviewed storage class is required.', 'inventory_storage_class_required', 400);
    }
    const record = await rpc(authed.db, 'classify_inventory_item', {
      p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
      p_item_id: cleanUuid(body.itemId, 'itemId'), p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_regulated_class: regulatedClass, p_base_uom: String(body.baseUom || '').trim(), p_storage_policy: storagePolicy,
      p_serial_tracking_required: body.serialTrackingRequired === true,
      p_udi_tracking_applicable: body.udiTrackingApplicable === true,
      p_ndc_tracking_applicable: body.ndcTrackingApplicable === true,
      p_automation_eligible: body.automationEligible === true,
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Catalog classification could not be saved.'); }
}
