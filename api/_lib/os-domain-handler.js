import { writeAuditEvent } from './audit-events.js';
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
} from './os-api.js';
import { OS_CAPABILITIES, getOsCapability } from '../../src/data/osCapabilities.js';

const DOMAIN_ALIASES = Object.freeze({ care: ['clinical'], people: ['people'], events: ['events'] });

export function createOsDomainHandler(domain) {
  const acceptedDomains = DOMAIN_ALIASES[domain] || [domain];
  const capabilities = OS_CAPABILITIES.filter((item) => acceptedDomains.includes(item.domain));
  const slugs = capabilities.map((item) => item.slug);

  return async function osDomainHandler(req, res) {
    const id = requestId(req);
    if (!requireOsBeta(res, id)) return;
    const authed = await requireOsOperator(req, res, id);
    if (!authed) return;

    if (req.method === 'GET') {
      const search = String(req.query?.search || '').trim().slice(0, 120).replace(/[%_]/g, '');
      let query = authed.db.from('os_capability_records')
        .select('*', { count: 'exact' })
        .eq('tenant_id', authed.tenantId)
        .in('capability', slugs.length ? slugs : ['__none__'])
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (search) query = query.ilike('title', `%${search}%`);
      const { data, count, error } = await query;
      if (error) return fail(res, 500, 'domain_records_load_failed', `Could not load ${domain} records.`, { requestId: id });
      return ok(res, { domain, capabilities, records: data || [], pagination: { page: 1, pageSize: 100, total: count || 0, hasMore: (count || 0) > 100 } }, { requestId: id });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
    }

    const body = parseJsonBody(req);
    const capability = getOsCapability(body.capability);
    if (!capability || !acceptedDomains.includes(capability.domain)) {
      return fail(res, 400, 'invalid_domain_capability', `Choose a registered ${domain} capability.`, { requestId: id });
    }
    const key = idempotencyKey(req, body);
    if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });
    const route = `/api/os/v1/${domain}:POST`;
    const hash = requestHash(body);
    const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
    if (previous) {
      if (previous.request_hash !== hash) return fail(res, 409, 'idempotency_key_reused', 'This key was used for another request.', { requestId: id });
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(previous.response_status || 200).json(previous.response_body);
    }

    const payload = cleanRecordPayload(body);
    if (!payload.title) return fail(res, 400, 'title_required', 'Title is required.', { requestId: id });
    const { data: record, error } = await authed.db.from('os_capability_records').insert({
      tenant_id: authed.tenantId,
      capability: capability.slug,
      ...payload,
      created_by: authed.user.id,
    }).select('*').single();
    if (error) return fail(res, 500, 'domain_record_create_failed', `Could not create the ${domain} record.`, { requestId: id });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: `os_${domain}.created`,
      entityType: `os:${capability.slug}`,
      entityId: record.id,
      payload: { capability: capability.slug, status: record.status, version: record.version },
    });
    const response = { ok: true, data: { domain, capability, record }, error: null, requestId: id };
    await storeIdempotentResponse(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, route, key, hash, status: 201, body: response });
    res.setHeader('X-Request-Id', id);
    return res.status(201).json(response);
  };
}
