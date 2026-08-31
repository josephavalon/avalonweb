import {
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanUuid,
  normalizePayOpsDbError,
  PayOpsError,
  requireNursePayActor,
  sendPayOpsError,
} from '../../../_lib/payops-core.js';

const REASON_CODES = new Set([
  'time_missing',
  'rate_question',
  'mileage_missing',
  'expense_missing',
  'calculation_question',
  'other_pay_issue',
]);

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

function disputeView(row) {
  return {
    id: row.id,
    earningId: row.earning_event_id,
    earningVersion: row.earning_event_version,
    reasonCode: row.reason_code,
    status: row.status,
    resolutionCode: row.resolution_code,
    openedAt: row.created_at,
    resolvedAt: row.resolved_at,
    version: row.version,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireNursePayActor(req, res);
    if (!authed) return;
    const earningId = cleanUuid(req.query?.id, 'earningId');
    const idempotencyKey = cleanIdempotencyKey(req);
    const body = parseBody(req);
    const expectedVersion = cleanExpectedVersion(body.expectedVersion);
    const reasonCode = String(body.reasonCode || '').trim().toLowerCase();
    if (!REASON_CODES.has(reasonCode)) {
      throw new PayOpsError('Choose a valid pay issue.', 'earning_dispute_reason_invalid', 400);
    }
    if (body.detail !== undefined && String(body.detail || '').trim()) {
      throw new PayOpsError('Use the structured issue category; clinical or unrestricted free text is not accepted here.', 'earning_dispute_detail_not_accepted', 400);
    }

    const replayResult = await authed.db.from('earning_disputes')
      .select('id')
      .eq('tenant_id', authed.tenantId)
      .eq('opened_by', authed.user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (replayResult.error) throw replayResult.error;
    const result = await authed.db.rpc('open_earning_dispute', {
      p_tenant_id: authed.tenantId,
      p_worker_profile_id: authed.user.id,
      p_earning_event_id: earningId,
      p_expected_earning_version: expectedVersion,
      p_reason_code: reasonCode,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return res.status(replayResult.data ? 200 : 201).json({
      dispute: disputeView(result.data),
      idempotentReplay: Boolean(replayResult.data),
      supportRoute: '/help',
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'The pay issue could not be submitted.');
  }
}
