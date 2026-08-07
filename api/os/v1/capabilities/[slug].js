import { writeAuditEvent } from '../../../_lib/audit-events.js';
import {
  cleanRecordPayload,
  fail,
  idempotencyKey,
  ok,
  parseJsonBody,
  readIdempotentResponse,
  requestHash,
  requestId,
  requireOsBeta,
  requireOsOperator,
  storeIdempotentResponse,
} from '../../../_lib/os-api.js';
import { getOsCapability } from '../../../../src/data/osCapabilities.js';

const MAX_PAGE_SIZE = 100;

function numeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shapeRecord(row) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    capability: row.capability,
    record_type: row.record_type,
    title: row.title,
    status: row.status,
    amount_cents: row.amount_cents,
    effective_at: row.effective_at,
    assigned_profile_id: row.assigned_profile_id,
    data: row.data || {},
    version: row.version,
    archived_at: row.archived_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listRecords(req, res, authed, capability, id) {
  const page = Math.max(1, Math.floor(numeric(req.query?.page, 1)));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(numeric(req.query?.pageSize, 30))));
  const from = (page - 1) * pageSize;
  const search = String(req.query?.search || '').trim().slice(0, 120);
  const status = String(req.query?.status || '').trim().slice(0, 64);

  let query = authed.db.from('os_capability_records')
    .select('*', { count: 'exact' })
    .eq('tenant_id', authed.tenantId)
    .eq('capability', capability.slug)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (search) query = query.ilike('title', `%${search.replace(/[%_]/g, '')}%`);
  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) return fail(res, 500, 'os_records_load_failed', 'Could not load this Avalon OS workspace.', { requestId: id });
  return ok(res, {
    capability,
    records: (data || []).map(shapeRecord),
    pagination: { page, pageSize, total: count || 0, hasMore: from + pageSize < (count || 0) },
  }, { requestId: id });
}

async function mutateRecord(req, res, authed, capability, id) {
  const body = parseJsonBody(req);
  const key = idempotencyKey(req, body);
  if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });

  const route = `/api/os/v1/capabilities/${capability.slug}:${req.method}`;
  const hash = requestHash(body);
  const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
  if (previous) {
    if (previous.request_hash !== hash) {
      return fail(res, 409, 'idempotency_key_reused', 'This idempotency key was already used for a different request.', { requestId: id });
    }
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(previous.response_status || 200).json(previous.response_body);
  }

  const payload = cleanRecordPayload(body);
  let responseStatus = 200;
  let record = null;
  let action = '';

  if (req.method === 'POST') {
    if (!payload.title) return fail(res, 400, 'title_required', 'Title is required.', { requestId: id });
    const { data, error } = await authed.db.from('os_capability_records').insert({
      tenant_id: authed.tenantId,
      capability: capability.slug,
      ...payload,
      created_by: authed.user.id,
    }).select('*').single();
    if (error) return fail(res, 500, 'os_record_create_failed', 'Could not create the record.', { requestId: id });
    record = data;
    responseStatus = 201;
    action = 'os_record.created';
  } else if (req.method === 'PATCH') {
    const recordId = String(body.id || '').trim();
    const expectedVersion = Math.floor(numeric(body.version, 0));
    if (!recordId || expectedVersion < 1) {
      return fail(res, 400, 'record_version_required', 'Record id and current version are required.', { requestId: id });
    }
    const update = { ...payload, version: expectedVersion + 1 };
    if (!update.title) delete update.title;
    const { data, error } = await authed.db.from('os_capability_records')
      .update(update)
      .eq('id', recordId)
      .eq('tenant_id', authed.tenantId)
      .eq('capability', capability.slug)
      .eq('version', expectedVersion)
      .is('archived_at', null)
      .select('*')
      .maybeSingle();
    if (error) return fail(res, 500, 'os_record_update_failed', 'Could not update the record.', { requestId: id });
    if (!data) return fail(res, 409, 'record_version_conflict', 'This record changed. Refresh and try again.', { requestId: id });
    record = data;
    action = 'os_record.updated';
  } else if (req.method === 'DELETE') {
    const recordId = String(req.query?.id || body.id || '').trim();
    if (!recordId) return fail(res, 400, 'record_id_required', 'Record id is required.', { requestId: id });
    const { data, error } = await authed.db.from('os_capability_records')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', recordId)
      .eq('tenant_id', authed.tenantId)
      .eq('capability', capability.slug)
      .is('archived_at', null)
      .select('*')
      .maybeSingle();
    if (error) return fail(res, 500, 'os_record_archive_failed', 'Could not archive the record.', { requestId: id });
    if (!data) return fail(res, 404, 'record_not_found', 'Record not found.', { requestId: id });
    record = data;
    action = 'os_record.archived';
  }

  await writeAuditEvent(authed.db, {
    tenantId: authed.tenantId,
    actorProfileId: authed.user.id,
    action,
    entityType: `os:${capability.slug}`,
    entityId: record.id,
    payload: { capability: capability.slug, status: record.status, version: record.version },
  });

  const response = { ok: true, data: { capability, record: shapeRecord(record) }, error: null, requestId: id };
  await storeIdempotentResponse(authed.db, {
    tenantId: authed.tenantId,
    actorProfileId: authed.user.id,
    route,
    key,
    hash,
    status: responseStatus,
    body: response,
  });
  res.setHeader('X-Request-Id', id);
  return res.status(responseStatus).json(response);
}

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireOsOperator(req, res, id);
  if (!authed) return;

  const slug = Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug;
  const capability = getOsCapability(slug);
  if (!capability) return fail(res, 404, 'capability_not_found', 'Unknown Avalon OS capability.', { requestId: id });

  if (req.method === 'GET') return listRecords(req, res, authed, capability, id);
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) return mutateRecord(req, res, authed, capability, id);
  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
}
