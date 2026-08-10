import { writeAuditEvent } from '../../_lib/audit-events.js';
import {
  fail, idempotencyKey, ok, parseJsonBody, readIdempotentResponse,
  requestHash, requestId, requireOsBeta, requireOsOperator, storeIdempotentResponse,
} from '../../_lib/os-api.js';

const NAMESPACES = new Set(['organization', 'markets', 'branding', 'permissions', 'notifications', 'templates', 'integrations']);

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireOsOperator(req, res, id);
  if (!authed) return;

  if (req.method === 'GET') {
    const { data, error } = await authed.db.from('os_settings').select('*')
      .eq('tenant_id', authed.tenantId).order('namespace').order('key');
    if (error) return fail(res, 500, 'settings_load_failed', 'Could not load Avalon OS settings.', { requestId: id });
    return ok(res, { settings: data || [], namespaces: [...NAMESPACES] }, { requestId: id });
  }

  if (!['POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
  }
  const body = parseJsonBody(req);
  const namespace = String(body.namespace || '').trim().toLowerCase();
  const settingKey = String(body.key || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').slice(0, 120);
  if (!NAMESPACES.has(namespace) || !settingKey || !body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
    return fail(res, 400, 'invalid_setting', 'A supported namespace, key, and object value are required.', { requestId: id });
  }
  const key = idempotencyKey(req, body);
  if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });
  const route = `/api/os/v1/settings:${namespace}:${settingKey}`;
  const hash = requestHash(body);
  const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
  if (previous) {
    if (previous.request_hash !== hash) return fail(res, 409, 'idempotency_key_reused', 'This key was used for another request.', { requestId: id });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(previous.response_status || 200).json(previous.response_body);
  }
  const { data: existing } = await authed.db.from('os_settings').select('version').eq('tenant_id', authed.tenantId).eq('namespace', namespace).eq('key', settingKey).maybeSingle();
  if (existing && Number(body.version) !== existing.version) return fail(res, 409, 'setting_version_conflict', 'This setting changed. Refresh and try again.', { requestId: id });
  const { data: setting, error } = await authed.db.from('os_settings').upsert({
    tenant_id: authed.tenantId, namespace, key: settingKey, value: body.value,
    version: (existing?.version || 0) + 1, created_by: authed.user.id,
  }, { onConflict: 'tenant_id,namespace,key' }).select('*').single();
  if (error) return fail(res, 500, 'setting_save_failed', 'Could not save the setting.', { requestId: id });
  await writeAuditEvent(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'os_settings.saved', entityType: 'os:setting', entityId: setting.id, payload: { namespace, key: settingKey, version: setting.version } });
  const response = { ok: true, data: { setting }, error: null, requestId: id };
  await storeIdempotentResponse(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, route, key, hash, status: 200, body: response });
  res.setHeader('X-Request-Id', id);
  return res.status(200).json(response);
}
