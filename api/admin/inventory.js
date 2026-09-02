import crypto from 'node:crypto';
import { writeAuditEvent } from '../_lib/audit-events.js';
import {
  cleanCents,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanUuid,
  normalizePayOpsDbError,
  PayOpsError,
  sendPayOpsError,
} from '../_lib/payops-core.js';
import {
  readIdempotentResponse,
  requestHash,
  storeIdempotentResponse,
} from '../_lib/os-api.js';
import { loadAdminInventory } from '../_lib/shared-inventory.js';
import { connectedInventoryFlags, inventoryCanaryProfileAllowed, loadConnectedInventoryOverview } from '../_lib/connected-inventory.js';
import { requireAdmin } from '../_lib/supabase-auth.js';

const MOVEMENT_TYPES = new Set(['receive', 'consume', 'adjust', 'expire', 'shrink', 'return']);
const LOCATION_TYPES = new Set(['central', 'warehouse', 'nurse_kit', 'event_kit', 'vehicle', 'quarantine']);

function parseBody(req) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; }
  catch { throw new PayOpsError('Request body must be valid JSON.', 'invalid_json', 400); }
}

function text(value, field, max = 160, { required = false } = {}) {
  const result = String(value || '').trim();
  if ((required && !result) || result.length > max) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return result;
}

function optionalUuid(value, field) {
  return value ? cleanUuid(value, field) : null;
}

function quantity(value, field = 'quantity') {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw) || Number(raw) <= 0) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return raw;
}

function nonNegativeQuantity(value, field) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw)) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return raw;
}

function dateOnly(value, field) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return raw;
}

function timestamp(value, field) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return parsed.toISOString();
}

async function mutateInventory(authed, body, key) {
  const action = String(body.action || '').trim();
  if (action === 'create_item') {
    const name = text(body.name, 'item_name', 240, { required: true });
    const unit = text(body.unit || 'unit', 'unit', 40, { required: true });
    const reorderPoint = String(body.reorderPoint ?? '0').trim();
    if (!/^\d+(?:\.\d{1,3})?$/.test(reorderPoint)) {
      throw new PayOpsError('Reorder point is invalid.', 'reorder_point_invalid', 400);
    }
    const result = await authed.db.rpc('create_inventory_item', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_name: name,
      p_sku: text(body.sku, 'sku', 120) || null,
      p_barcode: text(body.barcode, 'barcode', 160) || null,
      p_qr_code: text(body.qrCode, 'qr_code', 160) || null,
      p_unit: unit,
      p_reorder_point: reorderPoint,
      p_tags: Array.isArray(body.tags)
        ? body.tags.map((tag) => text(tag, 'tag', 80)).filter(Boolean).slice(0, 50)
        : [],
      p_preferred_vendor_id: optionalUuid(body.preferredVendorId, 'preferredVendorId'),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'create_location') {
    const locationType = String(body.locationType || '').trim().toLowerCase();
    if (!LOCATION_TYPES.has(locationType)) {
      throw new PayOpsError('Location type is invalid.', 'inventory_location_type_invalid', 400);
    }
    const result = await authed.db.rpc('create_inventory_location', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_location_type: locationType,
      p_location_code: text(body.locationCode, 'location_code', 40, { required: true }).toUpperCase(),
      p_name: text(body.name, 'location_name', 120, { required: true }),
      p_nurse_profile_id: optionalUuid(body.nurseProfileId, 'nurseProfileId'),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'create_variant') {
    const itemId = cleanUuid(body.itemId, 'itemId');
    const result = await authed.db.rpc('create_inventory_variant', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_item_id: itemId,
      p_name: text(body.name, 'variant_name', 160, { required: true }),
      p_sku: text(body.sku, 'sku', 120) || null,
      p_barcode: text(body.barcode, 'barcode', 160) || null,
      p_attributes: {},
      p_unit_cost_cents: cleanCents(body.unitCostCents ?? 0, 'unitCostCents'),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'transfer') {
    const result = await authed.db.rpc('transfer_inventory_to_location', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_from_location_id: cleanUuid(body.fromLocationId, 'fromLocationId'),
      p_to_location_id: cleanUuid(body.toLocationId, 'toLocationId'),
      p_item_id: cleanUuid(body.itemId, 'itemId'),
      p_variant_id: optionalUuid(body.variantId, 'variantId'),
      p_lot_id: optionalUuid(body.lotId, 'lotId'),
      p_quantity: quantity(body.quantity),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, transfer: result.data };
  }

  if (action === 'set_par') {
    const parQuantity = nonNegativeQuantity(body.parQuantity, 'par_quantity');
    const reorderQuantity = nonNegativeQuantity(body.reorderQuantity, 'reorder_quantity');
    if (Number(reorderQuantity) > Number(parQuantity)) {
      throw new PayOpsError('Restock quantity cannot exceed the par target.', 'inventory_par_request_invalid', 400);
    }
    const expectedVersion = Number(body.expectedVersion ?? 0);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new PayOpsError('Par version is invalid.', 'inventory_par_version_invalid', 400);
    }
    const result = await authed.db.rpc('set_inventory_par_level', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_location_id: cleanUuid(body.locationId, 'locationId'),
      p_item_id: cleanUuid(body.itemId, 'itemId'),
      p_variant_id: optionalUuid(body.variantId, 'variantId'),
      p_par_quantity: parQuantity,
      p_reorder_quantity: reorderQuantity,
      p_expected_version: expectedVersion,
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'transition_restock') {
    const nextStatus = String(body.nextStatus || '').trim().toLowerCase();
    if (!['approved', 'packing', 'fulfilled', 'rejected', 'cancelled'].includes(nextStatus)) {
      throw new PayOpsError('Restock status is invalid.', 'kit_restock_transition_invalid', 400);
    }
    const reasonCode = String(body.reasonCode || ({
      approved: 'ADMIN_APPROVED',
      packing: 'PACKING_STARTED',
      fulfilled: 'FULFILLMENT_CONFIRMED',
      rejected: 'REQUEST_REJECTED',
      cancelled: 'REQUEST_CANCELLED',
    }[nextStatus] || '')).trim().toUpperCase();
    const result = await authed.db.rpc('transition_inventory_restock_request', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_request_id: cleanUuid(body.restockRequestId, 'restockRequestId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_target_status: nextStatus,
      p_reason_code: reasonCode,
      p_fulfillment_reference: nextStatus === 'fulfilled'
        ? text(body.fulfillmentReference, 'fulfillment_reference', 160, { required: true })
        : null,
      p_fulfillment_transfer_group_id: nextStatus === 'fulfilled'
        ? cleanUuid(body.fulfillmentTransferGroupId, 'fulfillmentTransferGroupId')
        : null,
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'fulfill_restock') {
    const flags = connectedInventoryFlags();
    if (flags.connected && inventoryCanaryProfileAllowed(authed.user.id)) {
      if (flags.killSwitch) throw new PayOpsError('Connected inventory writes are paused.', 'inventory_kill_switch_active', 503);
      const requestId = cleanUuid(body.restockRequestId, 'restockRequestId');
      const requestResult = await authed.db.from('os_inventory_restock_requests')
        .select('id,location_id,status,version,os_inventory_restock_request_lines(id,item_id,variant_id,requested_quantity)')
        .eq('tenant_id', authed.tenantId).eq('id', requestId).maybeSingle();
      if (requestResult.error) throw normalizePayOpsDbError(requestResult.error);
      const request = requestResult.data;
      const lines = request?.os_inventory_restock_request_lines || [];
      if (!request || request.status !== 'packing' || request.version !== cleanExpectedVersion(body.expectedVersion) || lines.length !== 1) {
        throw new PayOpsError('This restock request needs a refresh or structured review.', 'inventory_restock_version_conflict', 409);
      }
      const kitResult = await authed.db.from('os_inventory_kits').select('id')
        .eq('tenant_id', authed.tenantId).eq('location_id', request.location_id).maybeSingle();
      if (kitResult.error) throw normalizePayOpsDbError(kitResult.error);
      if (!kitResult.data?.id) throw new PayOpsError('A physical kit is required.', 'inventory_physical_kit_required', 409);
      const result = await authed.db.rpc('dispatch_inventory_handoff', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_kit_id: kitResult.data.id, p_from_location_id: cleanUuid(body.fromLocationId, 'fromLocationId'),
        p_restock_request_id: requestId,
        p_lines: [{ itemId: lines[0].item_id, variantId: lines[0].variant_id,
          lotId: optionalUuid(body.lotId, 'lotId'), quantity: String(lines[0].requested_quantity) }],
        p_seal_code: null,
        p_idempotency_key: `restock-dispatch:${crypto.createHash('sha256').update(key).digest('hex')}`,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      return { action, record: { ...result.data, fulfillmentReference: text(body.fulfillmentReference, 'fulfillment_reference', 160, { required: true }), compatibilityLifecycle: 'dispatch_then_accept' } };
    }
    const result = await authed.db.rpc('fulfill_inventory_restock_request', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_request_id: cleanUuid(body.restockRequestId, 'restockRequestId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_from_location_id: cleanUuid(body.fromLocationId, 'fromLocationId'),
      p_lot_id: optionalUuid(body.lotId, 'lotId'),
      p_fulfillment_reference: text(body.fulfillmentReference, 'fulfillment_reference', 160, { required: true }),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'create_lot') {
    const itemId = cleanUuid(body.itemId, 'itemId');
    const variantId = optionalUuid(body.variantId, 'variantId');
    const result = await authed.db.rpc('create_inventory_lot', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_item_id: itemId,
      p_variant_id: variantId,
      p_lot_code: text(body.lotCode, 'lot_code', 120, { required: true }),
      p_expires_on: dateOnly(body.expiresOn, 'expires_on'),
      p_received_at: timestamp(body.receivedAt, 'received_at'),
      p_unit_cost_cents: cleanCents(body.unitCostCents ?? 0, 'unitCostCents'),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'create_vendor') {
    const result = await authed.db.rpc('create_inventory_vendor', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_name: text(body.name, 'vendor_name', 160, { required: true }),
      p_contact: {},
      p_terms: {},
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'create_purchase_order') {
    const vendorId = optionalUuid(body.vendorId, 'vendorId');
    const result = await authed.db.rpc('create_draft_purchase_order', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_vendor_id: vendorId,
      p_order_number: text(body.orderNumber, 'order_number', 120, { required: true }),
      p_expected_on: dateOnly(body.expectedOn, 'expected_on'),
      // The database derives subtotal from immutable PO lines. Header creation
      // never accepts a caller-authored line total.
      p_subtotal_cents: 0,
      p_tax_cents: cleanCents(body.taxCents ?? 0, 'taxCents'),
      p_shipping_cents: cleanCents(body.shippingCents ?? 0, 'shippingCents'),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'create_purchase_order_line') {
    const result = await authed.db.rpc('create_purchase_order_line', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_purchase_order_id: cleanUuid(body.purchaseOrderId, 'purchaseOrderId'),
      p_item_id: cleanUuid(body.itemId, 'itemId'),
      p_variant_id: optionalUuid(body.variantId, 'variantId'),
      p_quantity_ordered: quantity(body.quantityOrdered, 'quantityOrdered'),
      p_unit_cost_cents: cleanCents(body.unitCostCents, 'unitCostCents', { allowZero: false }),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'receive_purchase_order_line') {
    const result = await authed.db.rpc('receive_purchase_order_line', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_purchase_order_id: cleanUuid(body.purchaseOrderId, 'purchaseOrderId'),
      p_purchase_order_line_id: cleanUuid(body.purchaseOrderLineId, 'purchaseOrderLineId'),
      p_expected_purchase_order_version: cleanExpectedVersion(body.expectedPurchaseOrderVersion),
      p_location_id: cleanUuid(body.locationId, 'locationId'),
      p_lot_id: cleanUuid(body.lotId, 'lotId'),
      p_quantity: quantity(body.quantity),
      p_occurred_at: new Date().toISOString(),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  if (action === 'record_movement') {
    const movementType = String(body.movementType || '').trim().toLowerCase();
    if (!MOVEMENT_TYPES.has(movementType)) {
      throw new PayOpsError('Movement type is invalid.', 'inventory_movement_type_invalid', 400);
    }
    const amount = quantity(body.quantity);
    const adjustmentDirection = movementType === 'adjust'
      ? String(body.adjustmentDirection || '').trim().toLowerCase()
      : null;
    if (movementType === 'adjust' && !['gain', 'loss'].includes(adjustmentDirection)) {
      throw new PayOpsError('Adjustment direction is required.', 'inventory_adjustment_direction_required', 400);
    }
    const result = await authed.db.rpc('record_admin_inventory_movement', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_location_id: cleanUuid(body.locationId, 'locationId'),
      p_item_id: cleanUuid(body.itemId, 'itemId'),
      p_variant_id: optionalUuid(body.variantId, 'variantId'),
      p_lot_id: optionalUuid(body.lotId, 'lotId'),
      p_movement_type: movementType,
      p_adjustment_direction: adjustmentDirection,
      p_quantity: amount,
      p_unit_cost_cents: body.unitCostCents === null || body.unitCostCents === undefined
        ? null
        : cleanCents(body.unitCostCents, 'unitCostCents'),
      p_reason_code: text(body.reasonCode, 'reason_code', 100, { required: true }).toUpperCase(),
      p_occurred_at: new Date().toISOString(),
      p_idempotency_key: key,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return { action, record: result.data };
  }

  throw new PayOpsError('Inventory action is invalid.', 'inventory_action_invalid', 400);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const authed = await requireAdmin(req, res);
    if (!authed) return;
    if (req.method === 'GET') {
      const data = await loadAdminInventory(authed.db, authed.tenantId);
      const flags = connectedInventoryFlags();
      const canaryAllowed = flags.connected && inventoryCanaryProfileAllowed(authed.user.id);
      if (canaryAllowed) data.connected = await loadConnectedInventoryOverview(authed.db, authed.tenantId);
      await writeAuditEvent(authed.db, {
        tenantId: authed.tenantId,
        actorProfileId: authed.user.id,
        action: 'admin_inventory_read',
        entityType: 'os_inventory_locations',
        phiTouched: false,
        payload: { locationCount: data.locations.length, catalogCount: data.catalog.length },
      });
      return res.status(200).json({ status: 'AVAILABLE', flags: {
        connectedInventory: canaryAllowed,
        manualProcurement: canaryAllowed && flags.manualProcurement,
        a1Drafts: canaryAllowed && flags.a1Drafts,
        supplierExecution: canaryAllowed && flags.supplierExecution,
        inventoryKillSwitch: flags.killSwitch,
      }, data });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = parseBody(req);
    const key = cleanIdempotencyKey(req);
    const route = `/api/admin/inventory:${String(body.action || '').trim()}`;
    const hash = requestHash(body);
    const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
    if (previous) {
      if (previous.request_hash !== hash) {
        throw new PayOpsError('This idempotency key was used for a different inventory request.', 'idempotency_key_reused', 409);
      }
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(previous.response_status || 200).json(previous.response_body);
    }
    const flags = connectedInventoryFlags();
    if (flags.connected && inventoryCanaryProfileAllowed(authed.user.id) && flags.killSwitch) {
      throw new PayOpsError('Connected inventory writes are paused.', 'inventory_kill_switch_active', 503);
    }
    const result = await mutateInventory(authed, body, key);
    const response = { ok: true, result };
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: `admin_inventory_${result.action}`,
      entityType: 'os_inventory',
      entityId: result.record?.id || null,
      phiTouched: false,
      payload: { action: result.action },
    });
    await storeIdempotentResponse(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      route,
      key,
      hash,
      status: 201,
      body: response,
    });
    return res.status(201).json(response);
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Inventory is unavailable.');
  }
}
