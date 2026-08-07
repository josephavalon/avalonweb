import { writeAuditEvent } from '../../../_lib/audit-events.js';
import {
  fail, idempotencyKey, ok, parseJsonBody, readIdempotentResponse,
  requestHash, requestId, requireOsBeta, requireOsOperator, storeIdempotentResponse,
} from '../../../_lib/os-api.js';
import {
  adapterHealth, csvExport, getOsAdapter, OS_ADAPTER_OPERATIONS, validateManualImport,
} from '../../../_lib/os-adapters.js';

function providerParam(req) {
  return Array.isArray(req.query?.provider) ? req.query.provider[0] : req.query?.provider;
}

async function ensureConnection(db, authed, adapter, health) {
  const { data, error } = await db.from('os_integration_connections').upsert({
    tenant_id: authed.tenantId,
    provider: adapter.provider,
    mode: health.mode,
    status: health.status,
    last_health_at: new Date().toISOString(),
    last_error_code: health.missing?.length ? 'configuration_missing' : null,
    config: { label: adapter.label, credential_names: adapter.required },
    created_by: authed.user.id,
  }, { onConflict: 'tenant_id,provider' }).select('*').single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireOsOperator(req, res, id);
  if (!authed) return;

  const adapter = getOsAdapter(providerParam(req));
  if (!adapter) return fail(res, 404, 'adapter_not_found', 'Unknown Avalon OS integration.', { requestId: id });
  const health = adapterHealth(adapter);

  if (req.method === 'GET') {
    try {
      const connection = await ensureConnection(authed.db, authed, adapter, health);
      const { data: jobs } = await authed.db.from('os_integration_jobs')
        .select('id, operation, status, error_code, attempt_count, created_at, finished_at, output_summary')
        .eq('tenant_id', authed.tenantId)
        .eq('provider', adapter.provider)
        .order('created_at', { ascending: false })
        .limit(20);
      return ok(res, { adapter: health, connection, jobs: jobs || [], operations: OS_ADAPTER_OPERATIONS }, { requestId: id });
    } catch {
      return fail(res, 500, 'adapter_health_failed', 'Could not read integration health.', { requestId: id });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
  }

  const body = parseJsonBody(req);
  const operation = String(body.operation || '').trim().toLowerCase();
  if (!OS_ADAPTER_OPERATIONS.includes(operation)) {
    return fail(res, 400, 'invalid_adapter_operation', 'Choose health, import, export, sync, retry, or disconnect.', { requestId: id });
  }
  const key = idempotencyKey(req, body);
  if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });
  const route = `/api/os/v1/integrations/${adapter.provider}:${operation}`;
  const hash = requestHash(body);
  const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
  if (previous) {
    if (previous.request_hash !== hash) return fail(res, 409, 'idempotency_key_reused', 'This key was used for another request.', { requestId: id });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(previous.response_status || 200).json(previous.response_body);
  }

  try {
    const connection = await ensureConnection(authed.db, authed, adapter, health);
    let status = 'succeeded';
    let errorCode = null;
    let output = { message: `${adapter.label} ${operation} completed.` };

    if (operation === 'import') {
      const validated = validateManualImport(body);
      if (!validated.valid) return fail(res, 400, 'invalid_import', validated.error || 'Import contains no records.', { requestId: id });
      output = { rowCount: validated.rowCount, columns: validated.columns, validation: 'passed' };
    } else if (operation === 'export') {
      const csv = csvExport(Array.isArray(body.rows) ? body.rows : []);
      output = { rowCount: Array.isArray(body.rows) ? body.rows.length : 0, csv, format: 'text/csv' };
    } else if (operation === 'sync' && health.status !== 'healthy') {
      status = 'action_required';
      errorCode = 'adapter_configuration_required';
      output = { message: health.action, missing: health.missing };
    } else if (operation === 'disconnect') {
      await authed.db.from('os_integration_connections')
        .update({ status: 'disconnected', mode: 'disabled', last_error_code: null })
        .eq('id', connection.id)
        .eq('tenant_id', authed.tenantId);
      output = { message: `${adapter.label} disconnected from beta.` };
    }

    const now = new Date().toISOString();
    const { data: job, error } = await authed.db.from('os_integration_jobs').insert({
      tenant_id: authed.tenantId,
      connection_id: connection.id,
      provider: adapter.provider,
      operation,
      status,
      idempotency_key: key,
      input_summary: { rowCount: Array.isArray(body.rows) ? body.rows.length : undefined, hasCsv: Boolean(body.csv) },
      output_summary: output,
      error_code: errorCode,
      attempt_count: operation === 'retry' ? 2 : 1,
      created_by: authed.user.id,
      started_at: now,
      finished_at: now,
    }).select('*').single();
    if (error) throw error;

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: `os_integration.${operation}`,
      entityType: `integration:${adapter.provider}`,
      entityId: job.id,
      payload: { provider: adapter.provider, operation, status, rowCount: output.rowCount || 0 },
    });

    const response = { ok: true, data: { adapter: health, connection, job }, error: null, requestId: id };
    await storeIdempotentResponse(authed.db, {
      tenantId: authed.tenantId, actorProfileId: authed.user.id, route, key, hash, status: 200, body: response,
    });
    res.setHeader('X-Request-Id', id);
    return res.status(200).json(response);
  } catch {
    return fail(res, 500, 'adapter_operation_failed', 'The integration operation could not be completed.', { requestId: id });
  }
}
