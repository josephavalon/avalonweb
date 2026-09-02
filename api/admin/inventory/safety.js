import crypto from 'node:crypto';
import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { assertInventoryEvidenceSafe, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

const HOLD_TYPES = new Set(['recall', 'suspect_product', 'temperature_excursion', 'calibration', 'damage', 'count_variance', 'custody_dispute', 'manual_safety']);

function evidence(body) {
  const value = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  assertInventoryEvidenceSafe(value); return value;
}

function evidenceHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite(); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const action = String(body.action || '').trim();
    const common = { p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id, p_idempotency_key: cleanIdempotencyKey(req) };
    let record;
    if (action === 'place_hold') {
      const holdType = String(body.holdType || '').trim().toLowerCase();
      if (!HOLD_TYPES.has(holdType)) throw new PayOpsError('Hold type is invalid.', 'inventory_hold_type_invalid', 400);
      const safeEvidence = evidence(body.evidence);
      record = await rpc(authed.db, 'place_inventory_hold', {
        ...common, p_hold_type: holdType, p_item_id: optionalUuid(body.itemId, 'itemId'),
        p_variant_id: optionalUuid(body.variantId, 'variantId'), p_lot_id: optionalUuid(body.lotId, 'lotId'),
        p_location_id: optionalUuid(body.locationId, 'locationId'), p_kit_id: optionalUuid(body.kitId, 'kitId'),
        p_reason_code: cleanReasonCode(body.reasonCode), p_evidence: safeEvidence,
      });
    } else if (action === 'release_hold') {
      record = await rpc(authed.db, 'release_inventory_hold', {
        ...common, p_hold_id: cleanUuid(body.holdId, 'holdId'), p_expected_version: cleanExpectedVersion(body.expectedVersion),
        p_reason_code: cleanReasonCode(body.reasonCode),
      });
    } else if (action === 'record_recall') {
      const targets = Array.isArray(body.targets) ? body.targets.slice(0, 500).map((target) => ({
        itemId: cleanUuid(target?.itemId, 'itemId'), variantId: optionalUuid(target?.variantId, 'variantId'), lotId: optionalUuid(target?.lotId, 'lotId'),
      })) : [];
      if (!targets.length) throw new PayOpsError('Recall targets are required.', 'inventory_recall_targets_required', 400);
      record = await rpc(authed.db, 'record_inventory_recall', {
        ...common, p_source_type: String(body.sourceType || '').trim().toLowerCase(),
        p_source_reference: String(body.sourceReference || '').trim().slice(0, 200),
        p_classification: String(body.classification || 'pending_review').trim().toLowerCase(),
        p_summary_code: cleanReasonCode(body.summaryCode), p_targets: targets,
      });
    } else if (action === 'record_temperature') {
      const safeEvidence = evidence(body.evidence); const observedAt = new Date(body.observedAt || '');
      const evidenceExpiresAt = body.evidenceExpiresAt ? new Date(body.evidenceExpiresAt) : null;
      if (!Number.isFinite(observedAt.getTime()) || (evidenceExpiresAt && !Number.isFinite(evidenceExpiresAt.getTime()))) throw new PayOpsError('Temperature evidence dates are invalid.', 'inventory_temperature_dates_invalid', 400);
      const temperatureC = body.temperatureC === null || body.temperatureC === undefined ? null : Number(body.temperatureC);
      if (temperatureC !== null && !Number.isFinite(temperatureC)) throw new PayOpsError('Temperature is invalid.', 'inventory_temperature_invalid', 400);
      record = await rpc(authed.db, 'record_inventory_temperature_event', {
        ...common, p_lot_id: cleanUuid(body.lotId, 'lotId'), p_location_id: optionalUuid(body.locationId, 'locationId'),
        p_event_type: String(body.eventType || '').trim().toLowerCase(), p_temperature_c: temperatureC,
        p_observed_at: observedAt.toISOString(), p_evidence_hash: evidenceHash(safeEvidence),
        p_evidence_expires_at: evidenceExpiresAt?.toISOString() || null,
      });
    } else if (action === 'record_calibration') {
      const safeEvidence = evidence(body.evidence); const effectiveAt = new Date(body.effectiveAt || '');
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (!Number.isFinite(effectiveAt.getTime()) || (expiresAt && !Number.isFinite(expiresAt.getTime()))) throw new PayOpsError('Calibration evidence dates are invalid.', 'inventory_calibration_dates_invalid', 400);
      record = await rpc(authed.db, 'record_inventory_calibration_event', {
        ...common, p_item_id: cleanUuid(body.itemId, 'itemId'), p_variant_id: optionalUuid(body.variantId, 'variantId'),
        p_lot_id: optionalUuid(body.lotId, 'lotId'), p_event_type: String(body.eventType || '').trim().toLowerCase(),
        p_effective_at: effectiveAt.toISOString(), p_expires_at: expiresAt?.toISOString() || null,
        p_evidence_hash: evidenceHash(safeEvidence),
      });
    } else throw new PayOpsError('Safety action is invalid.', 'inventory_safety_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Inventory safety action could not be completed.'); }
}
