import {
  assertFinanceSafe,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  normalizePayOpsDbError,
  PayOpsError,
  payOpsFlags,
  requireFinanceActor,
  sendPayOpsError,
} from '../../../_lib/payops-core.js';

const PAYOUT_QUEUE_ERRORS = Object.freeze({
  payout_send_request_invalid: ['The provider-command request is invalid.', 400],
  payout_item_not_found: ['Payout not found.', 404],
  payout_send_authorization_invalid: ['The executor must be different from both the maker and checker.', 403],
  payout_send_snapshot_changed: ['The approved payout changed and cannot be queued.', 409],
  payout_item_version_or_state_conflict: ['The payout changed. Refresh and try again.', 409],
  payout_batch_version_or_state_conflict: ['The payout batch changed. Refresh and try again.', 409],
  payable_version_or_state_conflict: ['The linked payable changed. Refresh and review it again.', 409],
});

function queueError(error) {
  const normalized = normalizePayOpsDbError(error);
  if (normalized instanceof PayOpsError) return normalized;
  const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  const code = Object.keys(PAYOUT_QUEUE_ERRORS).find((candidate) => raw.includes(candidate));
  if (!code) return normalized;
  const [message, status] = PAYOUT_QUEUE_ERRORS[code];
  return new PayOpsError(message, code, status);
}

function parseBody(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    throw new PayOpsError('The request body must be valid JSON.', 'invalid_json', 400);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireFinanceActor(req, res, {
      allowedFinanceRoles: ['finance_executor'],
      requireAal2: true,
    });
    if (!authed) return;
    const flags = payOpsFlags();
    if (!flags.payOps) {
      throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
    }
    if (flags.mercurySendMode !== 'approval_queue') {
      throw new PayOpsError('Provider commands require approval-queue mode.', 'payout_approval_queue_required', 503);
    }
    const body = parseBody(req);
    assertFinanceSafe(body);
    const payoutItemId = cleanUuid(req.query?.id, 'payoutItemId');
    const expectedVersion = cleanExpectedVersion(body.expectedVersion);
    const reasonCode = cleanReasonCode(body.reasonCode);
    const idempotencyKey = cleanIdempotencyKey(req);
    const result = await authed.db.rpc('queue_contractor_payout_command', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payout_item_id: payoutItemId,
      p_expected_version: expectedVersion,
      p_reason_code: reasonCode,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw queueError(result.error);

    const payoutResult = await authed.db.from('payout_items')
      .select('id,payable_id,payout_batch_id,status,version,updated_at')
      .eq('tenant_id', authed.tenantId)
      .eq('id', payoutItemId)
      .maybeSingle();
    if (payoutResult.error) throw payoutResult.error;
    if (!payoutResult.data) throw new PayOpsError('Payout not found after command authorization.', 'payout_item_not_found', 404);

    return res.status(202).json({
      command: {
        id: result.data.id,
        provider: result.data.provider,
        commandType: result.data.command_type,
        status: result.data.status,
        attemptCount: result.data.attempt_count,
        nextAttemptAt: result.data.next_attempt_at,
        correlationId: result.data.correlation_id,
        createdAt: result.data.created_at,
      },
      payout: {
        id: payoutResult.data.id,
        payableId: payoutResult.data.payable_id,
        payoutBatchId: payoutResult.data.payout_batch_id,
        status: payoutResult.data.status,
        version: payoutResult.data.version,
        updatedAt: payoutResult.data.updated_at,
      },
      providerNetworkCallMade: false,
      providerAccepted: false,
      settlementRecorded: false,
      nextStep: 'A separately controlled adapter must claim the immutable command and later record provider evidence.',
    });
  } catch (error) {
    return sendPayOpsError(res, queueError(error), 'The payout command could not be queued.');
  }
}
