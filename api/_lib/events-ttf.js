/**
 * TTF (Time to Finish) — the platform's one number (blueprint amendment A),
 * computed from SERVER TRUTH: transition_event_visit() audit rows and order
 * timestamps (eng review T4). Client analytics never feed these numbers.
 *
 * Stage budgets are the v1 gate criteria; a stage over budget at p95 alarms.
 * Every duration is an ESTIMATE presentation-side (T6) — budgets here are
 * internal ops thresholds, not guest-facing promises.
 */

export const TTF_BUDGETS_MS = {
  reserve: 90 * 1000,             // first tap → paid (client stage; supplemental)
  gfe_invited_to_scheduled: 24 * 3600 * 1000,
  queue_join_to_resolved: 45 * 60 * 1000,
  chair_flow: 45 * 60 * 1000,     // confirmed→served upper bound for IV
  chair_express: 10 * 60 * 1000,  // shots door-to-floor
};

/** Pure: p50/p95/count/max over an array of millisecond durations. */
export function computeStageStats(durationsMs = []) {
  const clean = durationsMs.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  if (!clean.length) return { count: 0, p50: null, p95: null, max: null };
  const pick = (q) => clean[Math.min(clean.length - 1, Math.floor(q * (clean.length - 1) + 0.5))];
  return { count: clean.length, p50: pick(0.5), p95: pick(0.95), max: clean[clean.length - 1] };
}

/**
 * Pure: pair up transition audit rows per visit into stage durations.
 * rows: [{ target_id, to_value, at, action }] filtered to one container's
 * event_visit transitions, ascending by time.
 */
export function stageDurationsFromAudit(rows = []) {
  const byVisit = new Map();
  for (const r of rows) {
    if (!byVisit.has(r.target_id)) byVisit.set(r.target_id, []);
    byVisit.get(r.target_id).push(r);
  }
  const stages = { gfe_invited_to_scheduled: [], gfe_invited_to_cleared: [], confirmed_to_served: [] };
  for (const events of byVisit.values()) {
    const at = (to) => {
      const hit = events.find((e) => e.to_value === to);
      return hit ? new Date(hit.at).getTime() : null;
    };
    const invited = at('invited');
    const scheduled = at('scheduled');
    const cleared = at('cleared');
    const confirmed = at('confirmed');
    const served = at('served');
    if (invited != null && scheduled != null && scheduled >= invited) stages.gfe_invited_to_scheduled.push(scheduled - invited);
    if (invited != null && cleared != null && cleared >= invited) stages.gfe_invited_to_cleared.push(cleared - invited);
    if (confirmed != null && served != null && served >= confirmed) stages.confirmed_to_served.push(served - confirmed);
  }
  return stages;
}

/** Pure: queue durations from queue entries (joined→resolved, called→resolved). */
export function stageDurationsFromQueue(entries = []) {
  const joinToResolve = [];
  const callToResolve = [];
  for (const e of entries) {
    if (!e.resolved_at) continue;
    const resolved = new Date(e.resolved_at).getTime();
    if (e.joined_at) joinToResolve.push(resolved - new Date(e.joined_at).getTime());
    if (e.called_at) callToResolve.push(resolved - new Date(e.called_at).getTime());
  }
  return { queue_join_to_resolved: joinToResolve, queue_call_to_resolved: callToResolve };
}

/** Pure: order create→paid durations (the paid-reserve stage, server-side). */
export function stageDurationsFromOrders(orders = []) {
  return orders
    .filter((o) => o.status === 'paid' && o.created_at && o.updated_at)
    .map((o) => new Date(o.updated_at).getTime() - new Date(o.created_at).getTime())
    .filter((d) => d >= 0);
}

export function assembleTtfReport({ auditRows = [], queueEntries = [], orders = [] } = {}) {
  const audit = stageDurationsFromAudit(auditRows);
  const queue = stageDurationsFromQueue(queueEntries);
  const stages = {
    order_create_to_paid: computeStageStats(stageDurationsFromOrders(orders)),
    gfe_invited_to_scheduled: computeStageStats(audit.gfe_invited_to_scheduled),
    gfe_invited_to_cleared: computeStageStats(audit.gfe_invited_to_cleared),
    confirmed_to_served: computeStageStats(audit.confirmed_to_served),
    queue_join_to_resolved: computeStageStats(queue.queue_join_to_resolved),
    queue_call_to_resolved: computeStageStats(queue.queue_call_to_resolved),
  };
  const alarms = [];
  if (stages.gfe_invited_to_scheduled.p95 > TTF_BUDGETS_MS.gfe_invited_to_scheduled) alarms.push('gfe_invited_to_scheduled');
  if (stages.queue_join_to_resolved.p95 > TTF_BUDGETS_MS.queue_join_to_resolved) alarms.push('queue_join_to_resolved');
  if (stages.confirmed_to_served.p95 > TTF_BUDGETS_MS.chair_flow) alarms.push('confirmed_to_served');
  return { stages, alarms, budgets: TTF_BUDGETS_MS };
}
