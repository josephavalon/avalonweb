import { writeAuditEvent } from '../_lib/audit-events.js';
import {
  normalizePayOpsDbError,
  requireNursePayActor,
  sendPayOpsError,
} from '../_lib/payops-core.js';
import { effectiveEngagement, safeEngagementView } from '../_lib/payops-views.js';

const MAX_PAGE = 100;

function earningView(row, routing, disputes) {
  return {
    id: row.id,
    serviceDate: row.service_date,
    category: row.category,
    quantity: String(row.quantity),
    unit: row.unit,
    unitAmountCents: String(row.unit_amount_cents),
    grossAmountCents: String(row.gross_amount_cents),
    reimbursementAmountCents: String(row.reimbursement_amount_cents),
    currency: row.currency,
    approvalStatus: row.approval_status,
    rail: routing?.rail || null,
    routedAt: routing?.routed_at || null,
    disputes: disputes.map((dispute) => ({
      id: dispute.id,
      reasonCode: dispute.reason_code,
      status: dispute.status,
      resolutionCode: dispute.resolution_code,
      openedAt: dispute.created_at,
      resolvedAt: dispute.resolved_at,
      version: dispute.version,
    })),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    const limit = Math.min(MAX_PAGE, Math.max(1, Number(req.query?.limit) || 50));
    let query = authed.db.from('earning_events')
      .select('id,service_date,category,quantity,unit,unit_amount_cents,gross_amount_cents,reimbursement_amount_cents,currency,approval_status,version,created_at,updated_at')
      .eq('tenant_id', authed.tenantId)
      .eq('worker_profile_id', authed.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (req.query?.cursor) query = query.lt('created_at', String(req.query.cursor));
    const result = await query;
    if (result.error) throw result.error;

    const hasMore = (result.data || []).length > limit;
    const rows = (result.data || []).slice(0, limit);
    const ids = rows.map((row) => row.id);
    const [routingResult, disputeResult] = await Promise.all([
      ids.length
        ? authed.db.from('earning_routings')
          .select('earning_event_id,rail,routed_at')
          .eq('tenant_id', authed.tenantId)
          .in('earning_event_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? authed.db.from('earning_disputes')
          .select('id,earning_event_id,reason_code,status,resolution_code,resolved_at,version,created_at')
          .eq('tenant_id', authed.tenantId)
          .eq('opened_by', authed.user.id)
          .in('earning_event_id', ids)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (routingResult.error) throw routingResult.error;
    if (disputeResult.error) throw disputeResult.error;
    const routings = new Map((routingResult.data || []).map((row) => [row.earning_event_id, row]));
    const disputes = new Map(ids.map((id) => [id, []]));
    for (const dispute of disputeResult.data || []) disputes.get(dispute.earning_event_id)?.push(dispute);

    const grossTotal = rows.reduce((sum, row) => sum + BigInt(String(row.gross_amount_cents || 0)), 0n);
    const reimbursementTotal = rows.reduce((sum, row) => sum + BigInt(String(row.reimbursement_amount_cents || 0)), 0n);
    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'nurse_earnings_read',
      entityType: 'profiles',
      entityId: authed.user.id,
      phiTouched: false,
      payload: { resultCount: rows.length },
    });
    return res.status(200).json({
      engagement: safeEngagementView(decision),
      earnings: rows.map((row) => earningView(row, routings.get(row.id), disputes.get(row.id) || [])),
      pageTotals: {
        grossCents: grossTotal.toString(),
        reimbursementCents: reimbursementTotal.toString(),
        currency: rows[0]?.currency || 'USD',
      },
      pagination: {
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1]?.created_at || null : null,
      },
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Your earnings are unavailable.');
  }
}
