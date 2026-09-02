import {
  assertFinanceSafe,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  normalizePayOpsDbError,
  PayOpsError,
} from './payops-core.js';
import { connectedInventoryError } from './connected-inventory.js';

export function parseJsonBody(req) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; }
  catch { throw new PayOpsError('Request body must be valid JSON.', 'invalid_json', 400); }
}

export function optionalUuid(value, field) {
  return value ? cleanUuid(value, field) : null;
}

export function cleanQuantity(value, field = 'quantity', { allowZero = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw) || (!allowZero && Number(raw) <= 0)) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return raw;
}

export function cleanCountLines(lines) {
  if (!Array.isArray(lines) || lines.length > 5000) throw new PayOpsError('Count lines are invalid.', 'inventory_count_lines_invalid', 400);
  return lines.map((line) => ({
    lineId: cleanUuid(line?.lineId, 'lineId'),
    actualQuantity: cleanQuantity(line?.actualQuantity, 'actualQuantity', { allowZero: true }),
    scannedIdentifier: line?.scannedIdentifier ? String(line.scannedIdentifier).trim().slice(0, 180) : null,
  }));
}

export function cleanRestockLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 50) {
    throw new PayOpsError('Request between 1 and 50 kit items.', 'kit_restock_lines_invalid', 400);
  }
  return lines.map((line) => ({
    itemId: cleanUuid(line?.itemId, 'itemId'),
    variantId: optionalUuid(line?.variantId, 'variantId'),
    quantity: cleanQuantity(line?.quantity),
  }));
}

export function operationInput(req, body = parseJsonBody(req)) {
  return {
    body,
    key: cleanIdempotencyKey(req),
    expectedVersion: cleanExpectedVersion(body.expectedVersion),
    reasonCode: body.reasonCode ? cleanReasonCode(body.reasonCode) : null,
  };
}

export async function rpc(db, name, params) {
  const result = await db.rpc(name, params);
  if (result.error) throw normalizePayOpsDbError(result.error);
  return result.data;
}

export function assertInventoryEvidenceSafe(value) {
  assertFinanceSafe(value);
  const encoded = JSON.stringify(value || {});
  if (encoded.length > 20000) throw new PayOpsError('Evidence is too large.', 'inventory_evidence_too_large', 400);
}

export function sendConnectedInventoryError(res, error, fallback) {
  const normalized = normalizePayOpsDbError(error);
  const safe = connectedInventoryError(normalized, fallback);
  return res.status(safe.status || 500).json({ error: safe.message, code: safe.code, current: safe.current || undefined });
}
