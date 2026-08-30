import crypto from 'crypto';
import { getAuthedUser, privilegedSessionFailure } from './supabase-auth.js';

export function osBetaEnabled() {
  return [process.env.AVALON_OS_BETA, process.env.VITE_AVALON_OS_BETA]
    .some((value) => ['true', '1', 'yes'].includes(String(value || '').trim().toLowerCase()));
}

export function requestId(req) {
  const supplied = String(req.headers?.['x-request-id'] || '').trim();
  return supplied && supplied.length <= 128 ? supplied : crypto.randomUUID();
}

export function ok(res, data, { status = 200, requestId: id } = {}) {
  if (id) res.setHeader?.('X-Request-Id', id);
  return res.status(status).json({ ok: true, data, error: null, requestId: id || null });
}

export function fail(res, status, code, message, { requestId: id, details = null } = {}) {
  if (id) res.setHeader?.('X-Request-Id', id);
  return res.status(status).json({
    ok: false,
    data: null,
    error: { code, message, ...(details ? { details } : {}) },
    requestId: id || null,
  });
}

export function requireOsBeta(res, id) {
  if (osBetaEnabled()) return true;
  fail(res, 404, 'avalon_os_beta_disabled', 'Avalon OS is not enabled on this deployment.', { requestId: id });
  return false;
}

export async function requireOsOperator(req, res, id) {
  const authed = await getAuthedUser(req);
  if (!authed) {
    fail(res, 401, 'sign_in_required', 'Sign in is required.', { requestId: id });
    return null;
  }
  if (!['admin', 'staff'].includes(authed.role)) {
    fail(res, 403, 'operator_access_required', 'Admin or staff access is required.', { requestId: id });
    return null;
  }
  const sessionFailure = privilegedSessionFailure(authed);
  if (sessionFailure) {
    fail(res, sessionFailure.status, sessionFailure.code, sessionFailure.message, { requestId: id });
    return null;
  }
  if (!authed.tenantId) {
    fail(res, 403, 'tenant_required', 'A tenant-scoped operator profile is required.', { requestId: id });
    return null;
  }
  return authed;
}

export function parseJsonBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

export function idempotencyKey(req, body = {}) {
  const value = req.headers?.['idempotency-key'] || body.idempotencyKey || body.idempotency_key || '';
  const normalized = String(value).trim();
  return normalized.length >= 8 && normalized.length <= 200 ? normalized : '';
}

export function requestHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

export async function readIdempotentResponse(db, { tenantId, route, key }) {
  if (!db || !tenantId || !route || !key) return null;
  const { data } = await db.from('os_idempotency_keys')
    .select('response_status, response_body, request_hash')
    .eq('tenant_id', tenantId)
    .eq('route', route)
    .eq('key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data || null;
}

export async function storeIdempotentResponse(db, {
  tenantId, actorProfileId, route, key, hash, status, body,
}) {
  if (!db || !tenantId || !route || !key) return;
  await db.from('os_idempotency_keys').upsert({
    tenant_id: tenantId,
    actor_profile_id: actorProfileId || null,
    route,
    key,
    request_hash: hash,
    response_status: status,
    response_body: body,
  }, { onConflict: 'tenant_id,route,key', ignoreDuplicates: true });
}

export function cleanText(value, { max = 240, fallback = '' } = {}) {
  const text = String(value ?? '').trim();
  return (text || fallback).slice(0, max);
}

export function cleanRecordPayload(body = {}) {
  const amount = body.amount_cents == null || body.amount_cents === '' ? null : Number(body.amount_cents);
  const effectiveDate = body.effective_at ? new Date(body.effective_at) : null;
  return {
    title: cleanText(body.title),
    status: cleanText(body.status, { max: 64, fallback: 'active' }),
    record_type: cleanText(body.record_type, { max: 64, fallback: 'record' }),
    amount_cents: Number.isSafeInteger(amount) ? amount : null,
    effective_at: effectiveDate && !Number.isNaN(effectiveDate.getTime()) ? effectiveDate.toISOString() : null,
    assigned_profile_id: body.assigned_profile_id || null,
    data: body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {},
  };
}
