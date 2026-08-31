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

function providerView() {
  const gusto = financeAdapterHealth().gustoEmbedded;
  return { state: gusto.state, live: gusto.live, action: gusto.action };
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

function canonicalEmployeePayment(item, run) {
  const employeePaymentStatus = String(run?.employee_payment_status || '').toUpperCase();
  return Boolean(
    item?.payment_status === 'PAID'
    && run?.status === 'PAID'
    && ['PAID', 'SETTLED', 'COMPLETE', 'COMPLETED'].includes(employeePaymentStatus)
    && run?.provider_observed_at
    && run?.last_provider_success_at
    && run?.reconciliation_state === 'MATCHED'
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireNursePayActor(req, res);
    if (!authed) return;
    const decision = await effectiveEngagement(authed.db, authed.tenantId, authed.user.id);
    const engagement = safeEngagementView(decision);
    const limit = pageLimit(req.query?.limit);
    const cursor = decodeCursor(req.query?.cursor);

    // A nurse may have worked for multiple legal entities or changed rails.
    // Statement history is owned through every historical payroll profile, not
    // through the engagement decision effective today.
    const profileResult = await authed.db.from('payroll_profiles')
      .select('id')
      .eq('tenant_id', authed.tenantId)
      .eq('worker_profile_id', authed.user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_PROFILES + 1);
    if (profileResult.error) throw profileResult.error;
    if ((profileResult.data || []).length > MAX_PROFILES) {
      throw new PayOpsError('Payroll profile history exceeds the supported read bound.', 'pay_history_bounds_exceeded', 409);
    }
    const profileIds = (profileResult.data || []).map((row) => row.id);

    let statementQuery = profileIds.length
      ? authed.db.from('payroll_statements')
        // Deliberately omit provider identifiers, storage references, and
        // checksums. This endpoint returns safe metadata, not download material.
        .select('id,payroll_item_id,payroll_profile_id,statement_status,available_at,version,supersedes_statement_id,created_at')
        .eq('tenant_id', authed.tenantId)
        .in('payroll_profile_id', profileIds)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)
      : null;
    if (statementQuery && cursor) {
      statementQuery = statementQuery.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    const statementResult = statementQuery
      ? await statementQuery
      : { data: [], error: null };
    if (statementResult.error) throw statementResult.error;

    const hasMore = (statementResult.data || []).length > limit;
    const statementRows = (statementResult.data || []).slice(0, limit);
    const itemIds = [...new Set(statementRows.map((row) => row.payroll_item_id))];
    const itemResult = itemIds.length
      ? await authed.db.from('payroll_items')
        .select('id,payroll_run_id,payroll_profile_id,gross_cents,net_cents,employee_tax_cents,employer_tax_cents,deduction_cents,reimbursement_cents,payment_status,created_at')
        .eq('tenant_id', authed.tenantId)
        .in('payroll_profile_id', profileIds)
        .in('id', itemIds)
      : { data: [], error: null };
    if (itemResult.error) throw itemResult.error;
    const runIds = [...new Set((itemResult.data || []).map((row) => row.payroll_run_id))];
    const runResult = runIds.length
      ? await authed.db.from('payroll_runs')
        .select('id,payroll_calendar_id,status,employee_payment_status,provider_observed_at,last_provider_success_at,reconciliation_state')
        .eq('tenant_id', authed.tenantId)
        .in('id', runIds)
      : { data: [], error: null };
    if (runResult.error) throw runResult.error;
    const calendarIds = [...new Set((runResult.data || []).map((row) => row.payroll_calendar_id))];
    const calendarResult = calendarIds.length
      ? await authed.db.from('payroll_calendars')
        .select('id,period_start,period_end,pay_date,run_type')
        .eq('tenant_id', authed.tenantId)
        .in('id', calendarIds)
      : { data: [], error: null };
    if (calendarResult.error) throw calendarResult.error;

    const items = new Map((itemResult.data || []).map((row) => [row.id, row]));
    const runs = new Map((runResult.data || []).map((row) => [row.id, row]));
    const calendars = new Map((calendarResult.data || []).map((row) => [row.id, row]));
    const statements = statementRows.map((statement) => {
      const item = items.get(statement.payroll_item_id);
      const run = runs.get(item?.payroll_run_id);
      const calendar = calendars.get(run?.payroll_calendar_id);
      const canonicalPaid = canonicalEmployeePayment(item, run);
      const paymentStatus = canonicalPaid
        ? 'PAID'
        : item?.payment_status === 'PAID' || run?.status === 'PAID'
          ? 'RECONCILIATION_REQUIRED'
          : item?.payment_status || 'PENDING';
      return {
        id: statement.id,
        statementStatus: statement.statement_status,
        availableAt: statement.available_at,
        createdAt: statement.created_at,
        version: statement.version,
        supersedesStatementId: statement.supersedes_statement_id,
        periodStart: calendar?.period_start || null,
        periodEnd: calendar?.period_end || null,
        payDate: calendar?.pay_date || null,
        runType: calendar?.run_type || null,
        grossCents: item ? exactCents(item.gross_cents) : null,
        netCents: item ? exactCents(item.net_cents) : null,
        employeeTaxCents: item ? exactCents(item.employee_tax_cents) : null,
        employerTaxCents: item ? exactCents(item.employer_tax_cents) : null,
        deductionCents: item ? exactCents(item.deduction_cents) : null,
        reimbursementCents: item ? exactCents(item.reimbursement_cents) : null,
        paymentStatus,
        canonicalPaid,
        payrollStatus: run?.status === 'PAID' && !canonicalPaid ? 'RECONCILIATION_REQUIRED' : run?.status || null,
        reconciliationState: run?.reconciliation_state || null,
      };
    });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'nurse_pay_statements_read',
      entityType: 'profiles',
      entityId: authed.user.id,
      phiTouched: false,
      payload: { payrollProfileCount: profileIds.length, resultCount: statements.length },
    });
    return res.status(200).json({
      applicable: true,
      controlsAllowed: decision?.decision_status === 'W2_EMPLOYEE',
      engagement,
      statements,
      pagination: {
        hasMore,
        nextCursor: hasMore ? encodeCursor(statementRows[statementRows.length - 1]) : null,
      },
      ...(decision?.decision_status === 'W2_EMPLOYEE' && !profileIds.length ? { actionRequired: 'PAYROLL_PROFILE_REQUIRED' } : {}),
      ...(profileIds.length ? { provider: providerView() } : {}),
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Your pay statements are unavailable.');
  }
}
