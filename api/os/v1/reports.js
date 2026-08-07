import { writeAuditEvent } from '../../_lib/audit-events.js';
import {
  fail, idempotencyKey, ok, parseJsonBody, readIdempotentResponse,
  requestHash, requestId, requireOsBeta, requireOsOperator, storeIdempotentResponse,
} from '../../_lib/os-api.js';

const REPORT_TYPES = new Set([
  'inventory_value', 'inventory_turnover', 'expiry', 'shrinkage', 'vendor_spend', 'cost_analysis',
  'profit_and_loss', 'balance_sheet', 'cash_flow', 'general_ledger', 'unit_economics', 'kpi_scorecard',
  'budget_vs_actual', 'board_report', 'custom',
]);

async function reportPayload(db, tenantId, type) {
  if (type.startsWith('inventory_') || ['expiry', 'shrinkage', 'vendor_spend', 'cost_analysis'].includes(type)) {
    const { data, error } = await db.from('os_inventory_balances').select('*').eq('tenant_id', tenantId).order('name');
    if (error) throw error;
    const rows = data || [];
    return { rows, totals: { item_count: rows.length, inventory_value_cents: rows.reduce((sum, row) => sum + Number(row.inventory_value_cents || 0), 0) } };
  }
  const { data, error } = await db.from('os_financial_statement_lines').select('*').eq('tenant_id', tenantId).order('period', { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return { rows, totals: Object.fromEntries(['asset', 'liability', 'equity', 'revenue', 'expense'].map((accountType) => [accountType, rows.filter((row) => row.account_type === accountType).reduce((sum, row) => sum + Number(row.debit_normal_cents || 0), 0)])) };
}

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireOsOperator(req, res, id);
  if (!authed) return;
  const reportType = String(req.query?.type || '').trim().toLowerCase();
  if (req.method === 'GET') {
    if (reportType && !REPORT_TYPES.has(reportType)) return fail(res, 400, 'invalid_report_type', 'Unknown report type.', { requestId: id });
    if (!reportType) {
      const { data, error } = await authed.db.from('os_report_snapshots').select('*').eq('tenant_id', authed.tenantId).order('created_at', { ascending: false }).limit(100);
      if (error) return fail(res, 500, 'report_snapshots_load_failed', 'Could not load report history.', { requestId: id });
      return ok(res, { report_types: [...REPORT_TYPES], snapshots: data || [] }, { requestId: id });
    }
    try { return ok(res, { report_type: reportType, ...(await reportPayload(authed.db, authed.tenantId, reportType)) }, { requestId: id }); }
    catch { return fail(res, 500, 'report_generation_failed', 'Could not generate this report.', { requestId: id }); }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
  }
  const body = parseJsonBody(req);
  const type = String(body.report_type || '').trim().toLowerCase();
  if (!REPORT_TYPES.has(type)) return fail(res, 400, 'invalid_report_type', 'Choose a supported report type.', { requestId: id });
  const key = idempotencyKey(req, body);
  if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });
  const route = `/api/os/v1/reports:${type}`;
  const hash = requestHash(body);
  const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
  if (previous) {
    if (previous.request_hash !== hash) return fail(res, 409, 'idempotency_key_reused', 'This key was used for another request.', { requestId: id });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(previous.response_status || 200).json(previous.response_body);
  }
  try {
    const payload = await reportPayload(authed.db, authed.tenantId, type);
    const { data: snapshot, error } = await authed.db.from('os_report_snapshots').insert({ tenant_id: authed.tenantId, report_type: type, period_start: body.period_start || null, period_end: body.period_end || null, filters: body.filters || {}, payload, generated_by: authed.user.id }).select('*').single();
    if (error) throw error;
    await writeAuditEvent(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'os_reports.snapshot_created', entityType: 'os:report_snapshot', entityId: snapshot.id, payload: { report_type: type, row_count: payload.rows.length } });
    const response = { ok: true, data: { snapshot }, error: null, requestId: id };
    await storeIdempotentResponse(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, route, key, hash, status: 201, body: response });
    res.setHeader('X-Request-Id', id);
    return res.status(201).json(response);
  } catch {
    return fail(res, 500, 'report_snapshot_failed', 'Could not persist this report snapshot.', { requestId: id });
  }
}
