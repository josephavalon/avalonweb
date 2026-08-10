import { writeAuditEvent } from '../../_lib/audit-events.js';
import {
  fail, idempotencyKey, ok, parseJsonBody, readIdempotentResponse,
  requestHash, requestId, requireOsBeta, requireOsOperator, storeIdempotentResponse,
} from '../../_lib/os-api.js';

const STOCK_TYPES = new Set(['receive', 'consume', 'adjust', 'transfer_in', 'transfer_out', 'expire', 'shrink', 'return']);

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireOsOperator(req, res, id);
  if (!authed) return;

  if (req.method === 'GET') {
    const search = text(req.query?.search, 120).replace(/[%_]/g, '');
    let query = authed.db.from('os_inventory_balances').select('*', { count: 'exact' })
      .eq('tenant_id', authed.tenantId).order('name').limit(250);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data: balances, count, error } = await query;
    if (error) return fail(res, 500, 'inventory_load_failed', 'Could not load inventory.', { requestId: id });
    const { data: expiring } = await authed.db.from('os_inventory_lots').select('id,item_id,lot_code,expires_on,unit_cost_cents')
      .eq('tenant_id', authed.tenantId).not('expires_on', 'is', null).order('expires_on').limit(100);
    return ok(res, { balances: balances || [], expiring: expiring || [], pagination: { page: 1, pageSize: 250, total: count || 0, hasMore: (count || 0) > 250 } }, { requestId: id });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
  }

  const body = parseJsonBody(req);
  const operation = text(body.operation, 80);
  const key = idempotencyKey(req, body);
  if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });
  const route = `/api/os/v1/inventory:${operation}`;
  const hash = requestHash(body);
  const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
  if (previous) {
    if (previous.request_hash !== hash) return fail(res, 409, 'idempotency_key_reused', 'This key was used for another request.', { requestId: id });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(previous.response_status || 200).json(previous.response_body);
  }

  let table;
  let payload;
  if (operation === 'create_item') {
    if (!text(body.name)) return fail(res, 400, 'item_name_required', 'Item name is required.', { requestId: id });
    table = 'os_inventory_items';
    payload = {
      tenant_id: authed.tenantId, name: text(body.name), sku: text(body.sku, 120) || null,
      barcode: text(body.barcode, 160) || null, qr_code: text(body.qr_code, 160) || null,
      unit: text(body.unit, 40) || 'unit', folder_id: body.folder_id || null,
      preferred_vendor_id: body.preferred_vendor_id || null,
      reorder_point: Number.isFinite(Number(body.reorder_point)) ? Number(body.reorder_point) : 0,
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => text(tag, 80)).filter(Boolean).slice(0, 50) : [],
      custom_fields: body.custom_fields && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields) ? body.custom_fields : {},
      photo_paths: Array.isArray(body.photo_paths) ? body.photo_paths.map((path) => text(path, 500)).filter(Boolean).slice(0, 20) : [],
      created_by: authed.user.id,
    };
  } else if (operation === 'stock_transaction') {
    const quantity = Number(body.quantity_delta);
    if (!body.item_id || !STOCK_TYPES.has(body.transaction_type) || !Number.isFinite(quantity) || quantity === 0) {
      return fail(res, 400, 'invalid_stock_transaction', 'Item, stock transaction type, and non-zero quantity are required.', { requestId: id });
    }
    table = 'os_stock_transactions';
    payload = {
      tenant_id: authed.tenantId, item_id: body.item_id, variant_id: body.variant_id || null,
      lot_id: body.lot_id || null, transaction_type: body.transaction_type, quantity_delta: quantity,
      unit_cost_cents: body.unit_cost_cents == null ? null : Math.max(0, Math.round(Number(body.unit_cost_cents))),
      source_type: text(body.source_type, 80) || 'manual', source_id: text(body.source_id, 160) || null,
      note: text(body.note, 500) || null, occurred_at: body.occurred_at || new Date().toISOString(),
      idempotency_key: key, created_by: authed.user.id,
    };
  } else if (operation === 'create_vendor') {
    if (!text(body.name)) return fail(res, 400, 'vendor_name_required', 'Vendor name is required.', { requestId: id });
    table = 'os_inventory_vendors';
    payload = { tenant_id: authed.tenantId, name: text(body.name, 160), contact: body.contact || {}, terms: body.terms || {}, created_by: authed.user.id };
  } else {
    return fail(res, 400, 'invalid_inventory_operation', 'Choose create_item, stock_transaction, or create_vendor.', { requestId: id });
  }

  const { data: record, error } = await authed.db.from(table).insert(payload).select('*').single();
  if (error) return fail(res, 500, 'inventory_write_failed', 'Could not persist the inventory operation.', { requestId: id });
  await writeAuditEvent(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, action: `os_inventory.${operation}`, entityType: table, entityId: record.id, payload: { operation, item_id: record.item_id || record.id } });
  const response = { ok: true, data: { operation, record }, error: null, requestId: id };
  await storeIdempotentResponse(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, route, key, hash, status: 201, body: response });
  res.setHeader('X-Request-Id', id);
  return res.status(201).json(response);
}
