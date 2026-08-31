export async function effectiveEngagement(db, tenantId, workerProfileId, onDate = new Date().toISOString().slice(0, 10)) {
  const result = await db.from('engagement_decisions')
    .select('id,legal_entity_id,decision_status,jurisdiction,effective_from,effective_through,decision_reference,review_due_at,decided_at,supersedes_decision_id,version')
    .eq('tenant_id', tenantId)
    .eq('worker_profile_id', workerProfileId)
    .lte('effective_from', onDate)
    .or(`effective_through.is.null,effective_through.gte.${onDate}`)
    .order('decided_at', { ascending: false })
    .limit(25);
  if (result.error) throw result.error;
  const rows = result.data || [];
  const supersededIds = new Set(rows.map((row) => row.supersedes_decision_id).filter(Boolean));
  const effectiveHeads = rows.filter((row) => !supersededIds.has(row.id));
  // Multiple unsuperseded decisions are an authority conflict, never a signal
  // to guess a pay rail from recency.
  return effectiveHeads.length === 1 ? effectiveHeads[0] : null;
}

export function engagementLabel(decision) {
  if (!decision) return 'Pending HR/Legal review';
  if (decision.decision_status === 'CONTRACTOR_APPROVED') return 'Approved contractor';
  if (decision.decision_status === 'W2_EMPLOYEE') return 'W-2 employee';
  if (decision.decision_status === 'SUSPENDED') return 'Engagement suspended';
  if (decision.decision_status === 'ENDED') return 'Engagement ended';
  return 'Pending HR/Legal review';
}

export function engagementRail(decision) {
  if (decision?.decision_status === 'CONTRACTOR_APPROVED') return 'CONTRACTOR_PAYABLE';
  if (decision?.decision_status === 'W2_EMPLOYEE') return 'W2_PAYROLL_INPUT';
  return null;
}

export function safeEngagementView(decision) {
  return {
    status: decision?.decision_status || 'PENDING_REVIEW',
    label: engagementLabel(decision),
    rail: engagementRail(decision),
    readOnly: true,
    jurisdiction: decision?.jurisdiction || null,
    effectiveFrom: decision?.effective_from || null,
    effectiveThrough: decision?.effective_through || null,
    reviewDueAt: decision?.review_due_at || null,
  };
}
