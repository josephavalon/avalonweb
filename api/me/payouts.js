import { writeAuditEvent } from '../_lib/audit-events.js';
import {
  financeAdapterHealth,
  normalizePayOpsDbError,
  PayOpsError,
  requireNursePayActor,
  sendPayOpsError,
} from '../_lib/payops-core.js';
import { effectiveEngagement, safeEngagementView } from '../_lib/payops-views.js';

const DEFAULT_PAGE = 25;
const MAX_PAGE = 100;
const MAX_PROFILES = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeMercuryState() {
  const mercury = financeAdapterHealth().mercury;
  return { state: mercury.state, live: mercury.live, action: mercury.action };
}

function pageLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE;
  return Math.min(MAX_PAGE, Math.max(1, Math.trunc(parsed)));
}

function encodeCursor(row) {
  if (!row?.created_at || !row?.id) return null;
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id })).toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!Number.isFinite(Date.parse(cursor?.createdAt)) || !UUID_RE.test(String(cursor?.id || ''))) throw new Error('invalid');
    return { createdAt: new Date(cursor.createdAt).toISOString(), id: cursor.id };
  } catch {
    throw new PayOpsError('cursor is invalid.', 'cursor_invalid', 400);
  }
}

function exactCents(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new PayOpsError('A pay amount could not be represented exactly.', 'pay_amount_precision_unavailable', 503);
    }
    return BigInt(value).toString();
  }
  const raw = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^\d+$/.test(raw)) {
    throw new PayOpsError('A pay amount could not be represented exactly.', 'pay_amount_precision_unavailable', 503);
  }
  return BigInt(raw).toString();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireNursePayActor(req, res);
    if (!authed) return;
    const decision = await effectiveEngagement(authed.db, authed.tenantId, authed.user.id);
    const limit = pageLimit(req.query?.limit);
    const cursor = decodeCursor(req.query?.cursor);
    const payeeResult = await authed.db.from('payee_profiles')
      .select('id')
      .eq('tenant_id', authed.tenantId)
      .eq('worker_profile_id', authed.user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_PROFILES + 1);
    if (payeeResult.error) throw payeeResult.error;
    if ((payeeResult.data || []).length > MAX_PROFILES) {
      throw new PayOpsError('Payee profile history exceeds the supported read bound.', 'pay_history_bounds_exceeded', 409);
    }
    const payeeIds = (payeeResult.data || []).map((row) => row.id);
    if (!payeeIds.length) {
      return res.status(200).json({
        applicable: decision?.decision_status === 'CONTRACTOR_APPROVED',
        controlsAllowed: false,
        engagement: safeEngagementView(decision),
        payouts: [],
        pagination: { hasMore: false, nextCursor: null },
        actionRequired: decision?.decision_status === 'CONTRACTOR_APPROVED' ? 'PAYEE_PROFILE_REQUIRED' : null,
        provider: safeMercuryState(),
      });
    }

    let payableQuery = authed.db.from('payables')
      .select('id,status,gross_cents,reimbursement_cents,backup_withholding_cents,other_withholding_cents,net_cents,currency,due_date,reconciliation_state,settled_at,created_at,updated_at')
      .eq('tenant_id', authed.tenantId)
      .in('payee_profile_id', payeeIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (cursor) {
      payableQuery = payableQuery.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    const payableResult = await payableQuery;
    if (payableResult.error) throw payableResult.error;
    const hasMore = (payableResult.data || []).length > limit;
    const payableRows = (payableResult.data || []).slice(0, limit);
    const payableIds = payableRows.map((row) => row.id);
    const payoutResult = payableIds.length
      ? await authed.db.from('payout_items')
        .select('id,payable_id,status,amount_cents,currency,destination_masked_label,provider_observed_at,last_provider_success_at,reconciliation_state,created_at,updated_at')
        .eq('tenant_id', authed.tenantId)
        .in('payable_id', payableIds)
      : { data: [], error: null };
    if (payoutResult.error) throw payoutResult.error;
    const payoutByPayable = new Map((payoutResult.data || []).map((row) => [row.payable_id, row]));

    const payouts = payableRows.map((payable) => {
      const payout = payoutByPayable.get(payable.id);
      const canonicalSettled = payable.status === 'SETTLED'
        && payable.reconciliation_state === 'MATCHED'
        && Boolean(payable.settled_at)
        && payout?.status === 'SETTLED'
        && payout?.reconciliation_state === 'MATCHED'
        && Boolean(payout?.provider_observed_at)
        && Boolean(payout?.last_provider_success_at)
        && exactCents(payout?.amount_cents) === exactCents(payable.net_cents)
        && payout?.currency === payable.currency;
      const settlementClaimed = payable.status === 'SETTLED' || payout?.status === 'SETTLED';
      return {
        id: payout?.id || null,
        payableId: payable.id,
        status: canonicalSettled
          ? 'SETTLED'
          : settlementClaimed ? 'RECONCILIATION_REQUIRED' : (payout?.status || payable.status),
        canonicalSettled,
        grossCents: exactCents(payable.gross_cents),
        reimbursementCents: exactCents(payable.reimbursement_cents),
        backupWithholdingCents: exactCents(payable.backup_withholding_cents),
        otherWithholdingCents: exactCents(payable.other_withholding_cents),
        netCents: exactCents(payable.net_cents),
        payoutAmountCents: payout ? exactCents(payout.amount_cents) : null,
        currency: payable.currency,
        dueDate: payable.due_date,
        destinationMaskedLabel: payout?.destination_masked_label || null,
        providerObservedAt: payout?.provider_observed_at || null,
        reconciliationState: payout?.reconciliation_state || payable.reconciliation_state,
        settledAt: canonicalSettled ? payable.settled_at : null,
        createdAt: payout?.created_at || payable.created_at,
        updatedAt: payout?.updated_at || payable.updated_at,
      };
    });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'nurse_payouts_read',
      entityType: 'profiles',
      entityId: authed.user.id,
      phiTouched: false,
      payload: { resultCount: payouts.length },
    });
    return res.status(200).json({
      applicable: true,
      controlsAllowed: decision?.decision_status === 'CONTRACTOR_APPROVED',
      currentRail: safeEngagementView(decision).rail,
      engagement: safeEngagementView(decision),
      payouts,
      pagination: {
        hasMore,
        nextCursor: hasMore ? encodeCursor(payableRows[payableRows.length - 1]) : null,
      },
      provider: safeMercuryState(),
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Your payouts are unavailable.');
  }
}
