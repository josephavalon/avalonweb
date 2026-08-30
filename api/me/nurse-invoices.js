import { requireRole } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { isNurseWorkflowMigrationError, NURSE_ROLES, resolveNurseProvider } from '../_lib/nurse-workflow.js';

function summarizeTime(run, events, shift) {
  const ordered = [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  let breakStartedAt = null;
  let breakMilliseconds = 0;
  for (const event of ordered) {
    const occurredAt = Date.parse(event.occurred_at);
    if (!Number.isFinite(occurredAt)) continue;
    if (event.event_type === 'break_start' && breakStartedAt == null) breakStartedAt = occurredAt;
    if (event.event_type === 'break_end' && breakStartedAt != null) {
      breakMilliseconds += Math.max(0, occurredAt - breakStartedAt);
      breakStartedAt = null;
    }
  }
  const clockIn = Date.parse(run.clocked_in_at);
  const clockOut = Date.parse(run.clocked_out_at);
  const complete = Number.isFinite(clockIn) && Number.isFinite(clockOut) && clockOut >= clockIn;
  const grossMinutes = complete ? Math.round((clockOut - clockIn) / 60000) : null;
  const breakMinutes = Math.round(breakMilliseconds / 60000);
  const recordedMinutes = complete && breakStartedAt == null
    ? Math.max(0, grossMinutes - breakMinutes)
    : null;
  return {
    ...run,
    title: shift?.title || null,
    shift_starts_at: shift?.starts_at || null,
    shift_ends_at: shift?.ends_at || null,
    gross_minutes: grossMinutes,
    break_minutes: breakMinutes,
    recorded_minutes: recordedMinutes,
    time_exception_status: breakStartedAt != null
      ? 'open_break'
      : run.status === 'exception_review' ? 'exception_review' : null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    // Invoice and submitted-time history remains visible even when current
    // credential/readiness checks would block accepting new work.
    const provider = await resolveNurseProvider(authed);
    // The canonical 047 schema links contractor invoices to the authenticated
    // auth/profile id. Never fall back to a matching email: shared-door intake
    // email is self-asserted until an administrator links the row.
    const result = await authed.db.from('nurse_invoices')
      .select('id,invoice_number,status,period_start,period_end,wages_cents,reimbursements_cents,total_cents,currency,submitted_at,reviewed_at,review_note,paid_at,payment_reference,identity_assurance,version')
      .eq('tenant_id', authed.tenantId)
      .eq('nurse_profile_id', authed.user.id)
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    const timeResult = await authed.db.from('mobile_shift_runs')
      .select('id,shift_id,status,started_at,clocked_in_at,clocked_out_at,closed_at')
      .eq('tenant_id', authed.tenantId)
      .eq('provider_profile_id', provider.id)
      .order('started_at', { ascending: false })
      .limit(100);
    if (timeResult.error) {
      if (isNurseWorkflowMigrationError(timeResult.error)) {
        return res.status(200).json({
          invoices: result.data || [],
          timeRecords: [],
          timeRecordsStatus: 'unavailable',
        });
      }
      throw timeResult.error;
    }
    const runs = timeResult.data || [];
    const runIds = runs.map((row) => row.id);
    const shiftIds = [...new Set(runs.map((row) => row.shift_id).filter(Boolean))];
    const [eventResult, shiftResult] = await Promise.all([
      runIds.length
        ? authed.db.from('mobile_shift_time_events')
          .select('shift_run_id,event_type,occurred_at')
          .eq('tenant_id', authed.tenantId)
          .eq('provider_profile_id', provider.id)
          .in('shift_run_id', runIds)
          .order('occurred_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      shiftIds.length
        ? authed.db.from('operational_shifts')
          .select('id,title,starts_at,ends_at')
          .eq('tenant_id', authed.tenantId)
          .in('id', shiftIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (eventResult.error) throw eventResult.error;
    if (shiftResult.error) throw shiftResult.error;
    const eventsByRun = new Map(runIds.map((id) => [id, []]));
    for (const event of eventResult.data || []) eventsByRun.get(event.shift_run_id)?.push(event);
    const shiftsById = new Map((shiftResult.data || []).map((shift) => [shift.id, shift]));
    return res.status(200).json({
      invoices: result.data || [],
      timeRecords: runs.map((run) => summarizeTime(run, eventsByRun.get(run.id) || [], shiftsById.get(run.shift_id))),
      timeRecordsStatus: 'available',
    });
  } catch (error) {
    console.warn('[me/nurse-invoices] failed', safeLogContext(error, 'me_nurse_invoices_failed'));
    const missingCode = ['42P01', '42703', 'PGRST200', 'PGRST204'].includes(String(error?.code || ''));
    const financeMissing = missingCode && /nurse_invoices/i.test(String(error?.message || ''));
    const setupMissing = missingCode && !financeMissing;
    const userError = ['provider_profile_required', 'provider_profile_ambiguous'].includes(String(error?.code || ''));
    const status = userError ? error.status : missingCode ? 503 : 500;
    return res.status(status).json({
      error: financeMissing
        ? 'Invoices are not available until the finance migration is applied.'
        : setupMissing
          ? 'Provider access is not available until account setup is complete.'
          : userError ? error.message : 'Could not load invoices.',
      code: financeMissing
        ? 'finance_migration_required'
        : setupMissing
          ? 'provider_setup_required'
          : safeErrorCode(error, 'me_nurse_invoices_failed'),
    });
  }
}
