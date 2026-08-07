import crypto from 'crypto';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import {
  fail, idempotencyKey, ok, parseJsonBody, readIdempotentResponse,
  requestHash, requestId, requireOsBeta, requireOsOperator, storeIdempotentResponse,
} from '../../_lib/os-api.js';

const ACCOUNT_TYPES = new Set(['asset', 'liability', 'equity', 'revenue', 'expense']);
const DIRECTIONS = new Set(['debit', 'credit']);

function cleanEntry(entry, groupId, key, index, actorId, tenantId) {
  const amount = Number(entry?.amount_cents);
  const occurred = new Date(entry?.occurred_at || Date.now());
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('amount_cents must be a non-negative integer');
  if (!ACCOUNT_TYPES.has(entry?.account_type)) throw new Error('account_type is invalid');
  if (!DIRECTIONS.has(entry?.direction)) throw new Error('direction is invalid');
  if (!String(entry?.account_code || '').trim() || !String(entry?.account_name || '').trim()) throw new Error('account code and name are required');
  if (Number.isNaN(occurred.getTime())) throw new Error('occurred_at is invalid');
  return {
    tenant_id: tenantId,
    entry_group_id: groupId,
    account_code: String(entry.account_code).trim().slice(0, 80),
    account_name: String(entry.account_name).trim().slice(0, 160),
    account_type: entry.account_type,
    direction: entry.direction,
    amount_cents: amount,
    currency: String(entry.currency || 'USD').trim().toUpperCase(),
    occurred_at: occurred.toISOString(),
    source_type: String(entry.source_type || 'manual').trim().slice(0, 80),
    source_id: entry.source_id ? String(entry.source_id).trim().slice(0, 160) : null,
    memo: entry.memo ? String(entry.memo).trim().slice(0, 500) : null,
    dimensions: entry.dimensions && typeof entry.dimensions === 'object' && !Array.isArray(entry.dimensions) ? entry.dimensions : {},
    reversal_of: entry.reversal_of || null,
    idempotency_key: `${key}:${index}`,
    created_by: actorId,
  };
}

export default async function handler(req, res) {
  const id = requestId(req);
  if (!requireOsBeta(res, id)) return;
  const authed = await requireOsOperator(req, res, id);
  if (!authed) return;

  if (req.method === 'GET') {
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();
    let query = authed.db.from('os_finance_ledger').select('*', { count: 'exact' })
      .eq('tenant_id', authed.tenantId).order('occurred_at', { ascending: false }).limit(500);
    if (from) query = query.gte('occurred_at', from);
    if (to) query = query.lte('occurred_at', to);
    const { data, count, error } = await query;
    if (error) return fail(res, 500, 'ledger_load_failed', 'Could not load the finance ledger.', { requestId: id });
    const summary = (data || []).reduce((result, entry) => {
      result[entry.direction] += Number(entry.amount_cents || 0);
      return result;
    }, { debit: 0, credit: 0 });
    return ok(res, { entries: data || [], summary: { debit_cents: summary.debit, credit_cents: summary.credit, balanced: summary.debit === summary.credit }, pagination: { page: 1, pageSize: 500, total: count || 0, hasMore: (count || 0) > 500 } }, { requestId: id });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.', { requestId: id });
  }

  const body = parseJsonBody(req);
  const key = idempotencyKey(req, body);
  if (!key) return fail(res, 400, 'idempotency_key_required', 'Provide an Idempotency-Key of at least 8 characters.', { requestId: id });
  const route = '/api/os/v1/finance:POST';
  const hash = requestHash(body);
  const previous = await readIdempotentResponse(authed.db, { tenantId: authed.tenantId, route, key });
  if (previous) {
    if (previous.request_hash !== hash) return fail(res, 409, 'idempotency_key_reused', 'This key was used for another request.', { requestId: id });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.status(previous.response_status || 200).json(previous.response_body);
  }

  if (!Array.isArray(body.entries) || body.entries.length < 2 || body.entries.length > 200) {
    return fail(res, 400, 'balanced_entries_required', 'Provide between 2 and 200 double-entry ledger lines.', { requestId: id });
  }
  const groupId = crypto.randomUUID();
  let entries;
  try {
    entries = body.entries.map((entry, index) => cleanEntry(entry, groupId, key, index, authed.user.id, authed.tenantId));
  } catch (error) {
    return fail(res, 400, 'invalid_ledger_entry', error.message, { requestId: id });
  }
  const debit = entries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount_cents, 0);
  const credit = entries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount_cents, 0);
  if (debit !== credit) return fail(res, 422, 'unbalanced_ledger_group', 'Ledger debits and credits must balance exactly.', { requestId: id, details: { debit_cents: debit, credit_cents: credit } });

  const { data, error } = await authed.db.from('os_finance_ledger').insert(entries).select('*');
  if (error) return fail(res, 500, 'ledger_write_failed', 'Could not append the ledger group.', { requestId: id });
  await writeAuditEvent(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, action: 'os_finance.ledger_group_appended', entityType: 'os:finance_ledger_group', entityId: groupId, payload: { lineCount: entries.length, debit_cents: debit, credit_cents: credit } });
  const response = { ok: true, data: { entry_group_id: groupId, entries: data || [], debit_cents: debit, credit_cents: credit }, error: null, requestId: id };
  await storeIdempotentResponse(authed.db, { tenantId: authed.tenantId, actorProfileId: authed.user.id, route, key, hash, status: 201, body: response });
  res.setHeader('X-Request-Id', id);
  return res.status(201).json(response);
}
