import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanCents, cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function timestamp(value, field) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400); return date.toISOString();
}

function nonNegativeInteger(value, field) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventory('manualProcurement');
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const action = String(body.action || '').trim(); const key = cleanIdempotencyKey(req);
    let record;
    if (action === 'create_item') {
      record = await rpc(authed.db, 'create_inventory_supplier_item', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_vendor_id: cleanUuid(body.vendorId, 'vendorId'), p_item_id: cleanUuid(body.itemId, 'itemId'),
        p_variant_id: optionalUuid(body.variantId, 'variantId'), p_supplier_sku: String(body.supplierSku || '').trim(),
        p_manufacturer: body.manufacturer ? String(body.manufacturer).trim().slice(0, 180) : null,
        p_pack_uom: String(body.packUom || '').trim(), p_units_per_pack: cleanQuantity(body.unitsPerPack, 'unitsPerPack'),
        p_minimum_order_packs: cleanQuantity(body.minimumOrderPacks, 'minimumOrderPacks'),
        p_order_multiple_packs: cleanQuantity(body.orderMultiplePacks, 'orderMultiplePacks'),
        p_lead_time_days: nonNegativeInteger(body.leadTimeDays, 'leadTimeDays'), p_unit_price_cents: cleanCents(body.unitPriceCents, 'unitPriceCents'),
        p_currency: String(body.currency || 'USD').trim().toUpperCase(),
        p_price_effective_at: timestamp(body.priceEffectiveAt, 'priceEffectiveAt'), p_price_expires_at: timestamp(body.priceExpiresAt, 'priceExpiresAt'),
        p_substitution_policy: String(body.substitutionPolicy || 'prohibited').trim().toLowerCase(),
        p_automation_eligible: body.automationEligible === true, p_idempotency_key: key,
      });
    } else if (action === 'approve_item') {
      record = await rpc(authed.db, 'approve_inventory_supplier_item', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_supplier_item_id: cleanUuid(body.supplierItemId, 'supplierItemId'),
        p_expected_version: cleanExpectedVersion(body.expectedVersion), p_idempotency_key: key,
      });
    } else if (action === 'review_supplier') {
      const approvedMarkets = Array.isArray(body.approvedMarkets) ? body.approvedMarkets.map((value) => String(value).trim().toUpperCase()).filter(Boolean).slice(0, 50) : [];
      const credentialEvidenceRefs = Array.isArray(body.credentialEvidenceRefs) ? body.credentialEvidenceRefs.map((value) => String(value).trim().slice(0, 200)).filter(Boolean).slice(0, 50) : [];
      record = await rpc(authed.db, 'review_inventory_supplier', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_vendor_id: cleanUuid(body.vendorId, 'vendorId'), p_expected_version: cleanExpectedVersion(body.expectedVersion),
        p_legal_name: String(body.legalName || '').trim(), p_supplier_class: String(body.supplierClass || '').trim().toLowerCase(),
        p_approved_markets: approvedMarkets, p_credential_evidence_refs: credentialEvidenceRefs,
        p_ordering_channel: String(body.orderingChannel || 'manual').trim().toLowerCase(), p_idempotency_key: key,
      });
    } else if (action === 'register_connection') {
      record = await rpc(authed.db, 'register_inventory_supplier_connection', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_vendor_id: cleanUuid(body.vendorId, 'vendorId'), p_adapter_key: String(body.adapterKey || 'manual_export').trim().toLowerCase(),
        p_secret_reference: body.secretReference ? String(body.secretReference).trim().slice(0, 200) : null,
        p_masked_account_label: body.maskedAccountLabel ? String(body.maskedAccountLabel).trim().slice(0, 100) : null,
        p_idempotency_key: key,
      });
    } else throw new PayOpsError('Supplier catalog action is invalid.', 'inventory_supplier_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Supplier catalog could not be updated.'); }
}
