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
const MAX_PAGE = 50;
const MAX_PROFILES = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safePayrollProvider() {
  const gusto = financeAdapterHealth().gustoEmbedded;
  return { state: gusto.state, live: gusto.live, action: gusto.action };
}

function pageLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE;
  return Math.min(MAX_PAGE, Math.max(1, Math.trunc(parsed)));
}

function encodeCursor(row, dateField) {
  if (!row?.id || !row?.[dateField]) return null;
  return Buffer.from(JSON.stringify({ date: row[dateField], id: row.id })).toString('base64url');
}

function decodeCursor(value, field) {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    const validDate = DATE_RE.test(String(cursor?.date || '')) && Number.isFinite(Date.parse(`${cursor.date}T00:00:00.000Z`));
    if (!validDate || !UUID_RE.test(String(cursor?.id || ''))) throw new Error('invalid');
    return { date: cursor.date, id: cursor.id };
  } catch {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
}

function beforeDateAndId(query, column, cursor) {
  if (!cursor) return query;
  return query.or(`${column}.lt.${cursor.date},and(${column}.eq.${cursor.date},id.lt.${cursor.id})`);
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

function centsTotal(rows, field) {
  return rows.reduce((sum, row) => sum + BigInt(exactCents(row?.[field])), 0n).toString();
}

function canonicalContractorSettlement(invoice, payable, payout) {
  return Boolean(
    invoice?.status === 'paid'
    && invoice?.settlement_evidence_status === 'provider_confirmed'
    && payable?.status === 'SETTLED'
    && payable?.reconciliation_state === 'MATCHED'
    && payable?.settled_at
    && payout?.status === 'SETTLED'
    && payout?.reconciliation_state === 'MATCHED'
    && payout?.provider_observed_at
    && payout?.last_provider_success_at
    && exactCents(payout?.amount_cents) === exactCents(payable?.net_cents)
    && payout?.currency === payable?.currency
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
    const w2Cursor = decodeCursor(req.query?.w2Cursor, 'w2Cursor');
    const contractorCursor = decodeCursor(req.query?.contractorCursor, 'contractorCursor');

    // Classification can change over time. Historical visibility is therefore
    // rooted in every payroll profile owned by this nurse, never today's rail.
    const [profileResult, payeeProfileResult] = await Promise.all([
      authed.db.from('payroll_profiles')
        .select('id')
        .eq('tenant_id', authed.tenantId)
        .eq('worker_profile_id', authed.user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_PROFILES + 1),
      authed.db.from('payee_profiles')
        .select('id')
        .eq('tenant_id', authed.tenantId)
        .eq('worker_profile_id', authed.user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_PROFILES + 1),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (payeeProfileResult.error) throw payeeProfileResult.error;
    if ((profileResult.data || []).length > MAX_PROFILES || (payeeProfileResult.data || []).length > MAX_PROFILES) {
      throw new PayOpsError('Pay profile history exceeds the supported read bound.', 'pay_history_bounds_exceeded', 409);
    }
    const profileIds = (profileResult.data || []).map((row) => row.id);
    const payeeProfileIds = (payeeProfileResult.data || []).map((row) => row.id);

    // The inner relationship limits calendars to this nurse's own inputs. This
    // intentionally avoids returning every period for a legal entity.
    let calendarQuery = profileIds.length
      ? authed.db.from('payroll_calendars')
        .select('id,period_start,period_end,cutoff_at,pay_date,funding_date,timezone,run_type,status,version,owned_inputs:payroll_inputs!payroll_inputs_calendar_fk!inner(id,payroll_profile_id,amount_cents,status)')
        .eq('tenant_id', authed.tenantId)
        .eq('owned_inputs.tenant_id', authed.tenantId)
        .in('owned_inputs.payroll_profile_id', profileIds)
        .order('pay_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)
      : null;
    if (calendarQuery) calendarQuery = beforeDateAndId(calendarQuery, 'pay_date', w2Cursor);

    let invoiceQuery = authed.db.from('nurse_invoices')
      .select('id,invoice_number,period_start,period_end,status,total_cents,currency,submitted_at,payable_id,settlement_evidence_status,created_at')
      .eq('tenant_id', authed.tenantId)
      .eq('nurse_profile_id', authed.user.id)
      .order('period_end', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    invoiceQuery = beforeDateAndId(invoiceQuery, 'period_end', contractorCursor);

    const [calendarResult, invoiceResult] = await Promise.all([
      calendarQuery || Promise.resolve({ data: [], error: null }),
      invoiceQuery,
    ]);
    if (calendarResult.error) throw calendarResult.error;
    if (invoiceResult.error) throw invoiceResult.error;

    const w2HasMore = (calendarResult.data || []).length > limit;
    const contractorHasMore = (invoiceResult.data || []).length > limit;
    const calendars = (calendarResult.data || []).slice(0, limit);
    const invoices = (invoiceResult.data || []).slice(0, limit);

    const payableIds = [...new Set(invoices.map((row) => row.payable_id).filter(Boolean))];
    const payableResult = payableIds.length && payeeProfileIds.length
      ? await authed.db.from('payables')
        .select('id,payee_profile_id,status,net_cents,currency,reconciliation_state,settled_at')
        .eq('tenant_id', authed.tenantId)
        .in('payee_profile_id', payeeProfileIds)
        .in('id', payableIds)
      : { data: [], error: null };
    if (payableResult.error) throw payableResult.error;
    const ownedPayableIds = (payableResult.data || []).map((row) => row.id);
    const payoutResult = ownedPayableIds.length
      ? await authed.db.from('payout_items')
        .select('payable_id,status,amount_cents,currency,provider_observed_at,last_provider_success_at,reconciliation_state')
        .eq('tenant_id', authed.tenantId)
        .in('payable_id', ownedPayableIds)
      : { data: [], error: null };
    if (payoutResult.error) throw payoutResult.error;
    const payables = new Map((payableResult.data || []).map((row) => [row.id, row]));
    const payouts = new Map((payoutResult.data || []).map((row) => [row.payable_id, row]));

    const w2Periods = calendars.map((calendar) => {
      const inputs = Array.isArray(calendar.owned_inputs) ? calendar.owned_inputs : [];
      return {
        id: calendar.id,
        rail: 'W2_PAYROLL_INPUT',
        periodStart: calendar.period_start,
        periodEnd: calendar.period_end,
        cutoffAt: calendar.cutoff_at,
        payDate: calendar.pay_date,
        fundingDate: calendar.funding_date,
        timezone: calendar.timezone,
        runType: calendar.run_type,
        status: calendar.status,
        inputCount: inputs.length,
        inputAmountCents: centsTotal(inputs, 'amount_cents'),
        inputStatuses: [...new Set(inputs.map((row) => row.status).filter(Boolean))].sort(),
        version: calendar.version,
      };
    });
    const contractorPeriods = invoices.map((invoice) => {
      const payable = payables.get(invoice.payable_id);
      const payout = payouts.get(invoice.payable_id);
      const canonicalPaid = canonicalContractorSettlement(invoice, payable, payout);
      return {
        id: invoice.id,
        rail: 'CONTRACTOR_PAYABLE',
        invoiceNumber: invoice.invoice_number,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
        status: invoice.status === 'paid' && !canonicalPaid ? 'reconciliation_required' : invoice.status,
        totalCents: exactCents(invoice.total_cents),
        currency: invoice.currency,
        submittedAt: invoice.submitted_at,
        canonicalPaid,
        canonicalPaymentStatus: canonicalPaid
          ? 'SETTLED'
          : invoice.status === 'paid' ? 'RECONCILIATION_REQUIRED' : 'NOT_SETTLED',
        settlementEvidenceStatus: invoice.settlement_evidence_status,
      };
    });
    const payPeriods = [...w2Periods, ...contractorPeriods].sort((a, b) => {
      const aDate = a.payDate || a.periodEnd || '';
      const bDate = b.payDate || b.periodEnd || '';
      return bDate.localeCompare(aDate) || String(b.id).localeCompare(String(a.id));
    });

    await writeAuditEvent(authed.db, {
      tenantId: authed.tenantId,
      actorProfileId: authed.user.id,
      action: 'nurse_pay_periods_read',
      entityType: 'profiles',
      entityId: authed.user.id,
      phiTouched: false,
      payload: { payrollProfileCount: profileIds.length, w2ResultCount: w2Periods.length, contractorResultCount: contractorPeriods.length },
    });
    return res.status(200).json({
      applicable: true,
      controlsAllowed: ['W2_EMPLOYEE', 'CONTRACTOR_APPROVED'].includes(decision?.decision_status),
      engagement,
      payPeriods,
      pagination: {
        w2: {
          hasMore: w2HasMore,
          nextCursor: w2HasMore ? encodeCursor(calendars[calendars.length - 1], 'pay_date') : null,
        },
        contractor: {
          hasMore: contractorHasMore,
          nextCursor: contractorHasMore ? encodeCursor(invoices[invoices.length - 1], 'period_end') : null,
        },
      },
      ...(profileIds.length ? { provider: safePayrollProvider() } : {}),
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Your pay periods are unavailable.');
  }
}
