/**
 * GET /api/admin/finance/summary
 *
 * Client revenue and nurse PayOps are independent finance domains. A failure
 * in either one never manufactures zeros or hides the other domain.
 */
import Stripe from 'stripe';
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { loadInventoryCostData } from '../../_lib/inventory-costs.js';
import { activeFinanceRoles, financeAdapterHealth, payOpsFlags } from '../../_lib/payops-core.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

const PAYOPS_VIEW_ROLES = new Set(['finance_maker', 'finance_checker', 'finance_executor', 'accountant_controller', 'security_auditor']);

function centsToDollars(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

function sumCents(rows = [], key) {
  return rows.reduce((total, row) => total + Number(row?.[key] || 0), 0);
}

function sumCentsString(rows = [], key) {
  return rows.reduce((total, row) => total + BigInt(String(row?.[key] || 0)), 0n).toString();
}

function safeAdapterHealth() {
  return Object.fromEntries(Object.entries(financeAdapterHealth()).map(([key, value]) => [key, {
    state: value.state,
    live: value.live,
    action: value.action,
    ...(value.sendMode ? { sendMode: value.sendMode } : {}),
    ...(value.provider ? { provider: value.provider } : {}),
    ...(value.mode ? { mode: value.mode } : {}),
  }]));
}

async function activeSubscriptionCount(stripe) {
  let count = 0;
  let startingAfter;
  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    count += page.data.length;
    if (!page.has_more || !page.data.length) return count;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function stripeRevenueInWindow(stripe, sinceSec) {
  let grossCents = 0;
  let refundCents = 0;
  let chargeCount = 0;
  let startingAfter;
  for (;;) {
    const page = await stripe.balanceTransactions.list({
      created: { gte: sinceSec },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const tx of page.data) {
      const amount = Number(tx.amount || 0);
      if (tx.type === 'charge' || tx.type === 'payment') {
        grossCents += amount;
        chargeCount += 1;
      } else if (tx.type === 'refund' || tx.type === 'payment_refund') {
        refundCents += amount;
      }
    }
    if (!page.has_more || !page.data.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return { netCents: grossCents + refundCents, grossCents, chargeCount };
}

function shapeStripePayout(payout) {
  return {
    id: payout.id,
    amount: centsToDollars(payout.amount),
    currency: payout.currency,
    status: payout.status,
    arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
    created: payout.created ? new Date(payout.created * 1000).toISOString() : null,
  };
}

function shapeOutstanding(row) {
  const payload = row.external_payload || {};
  const contact = payload.contact || {};
  return {
    id: row.id,
    startsAt: row.starts_at,
    service: payload.primaryService || row.protocol_key || 'Avalon Visit',
    customerName: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Client',
    customerEmail: contact.email || '',
    balanceDue: centsToDollars(row.balance_due_cents),
    paymentStatus: row.payment_status,
  };
}

async function loadClientRevenue(db, tenantId) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'UNAVAILABLE', errorCode: 'stripe_secret_missing', data: null };
  }
  const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs).toISOString();
  const sinceSec = Math.floor(sinceMs / 1000);
  try {
    let outstandingQuery = db.from('appointments')
      .select('id,tenant_id,starts_at,protocol_key,payment_status,balance_due_cents,external_payload')
      .eq('payment_status', 'partial_payment')
      .gt('balance_due_cents', 0)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(100);
    let depositsQuery = db.from('appointments')
      .select('deposit_amount_cents')
      .not('deposit_paid_at', 'is', null)
      .limit(2000);
    if (tenantId) {
      outstandingQuery = outstandingQuery.eq('tenant_id', tenantId);
      depositsQuery = depositsQuery.eq('tenant_id', tenantId);
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const [outstandingResult, depositsResult, payouts, activeSubscriptions, stripeRevenue] = await Promise.all([
      outstandingQuery,
      depositsQuery,
      stripe.payouts.list({ limit: 5 }),
      activeSubscriptionCount(stripe),
      stripeRevenueInWindow(stripe, sinceSec),
    ]);
    if (outstandingResult.error) throw outstandingResult.error;
    if (depositsResult.error) throw depositsResult.error;
    const outstandingRows = outstandingResult.data || [];
    const depositRows = depositsResult.data || [];
    return {
      status: 'AVAILABLE',
      errorCode: null,
      data: {
        last30Days: {
          count: stripeRevenue.chargeCount,
          amount: centsToDollars(stripeRevenue.netCents),
          grossAmount: centsToDollars(stripeRevenue.grossCents),
          since,
        },
        depositsTaken: { count: depositRows.length, amount: centsToDollars(sumCents(depositRows, 'deposit_amount_cents')) },
        outstandingBalances: {
          count: outstandingRows.length,
          amount: centsToDollars(sumCents(outstandingRows, 'balance_due_cents')),
          rows: outstandingRows.map(shapeOutstanding),
        },
        merchantPayouts: payouts.data.map(shapeStripePayout),
        activeSubscriptions: { count: activeSubscriptions },
      },
    };
  } catch (error) {
    console.warn('[admin/finance/summary] client revenue failed', safeLogContext(error, 'client_revenue_summary_failed'));
    return { status: 'UNAVAILABLE', errorCode: safeErrorCode(error, 'client_revenue_summary_failed'), data: null };
  }
}

async function loadNursePayOps(db, tenantId, authed) {
  const adapterHealth = safeAdapterHealth();
  let financeRoles;
  try {
    financeRoles = await activeFinanceRoles(db, tenantId, authed.user.id);
  } catch {
    return {
      status: 'SCHEMA_UNAVAILABLE', errorCode: 'payops_schema_unavailable', authorized: authed.role === 'admin',
      contractor: null, employee: null, ledger: null, adapterHealth,
    };
  }
  const authorized = authed.role === 'admin' || financeRoles.some((role) => PAYOPS_VIEW_ROLES.has(role));
  if (!authorized) {
    return {
      status: 'RESTRICTED', errorCode: 'finance_permission_required', authorized: false,
      contractor: null, employee: null, ledger: null, adapterHealth,
    };
  }
  try {
    const [payableResult, payrollResult, ledgerResult] = await Promise.all([
      db.from('payables').select('status,net_cents,reconciliation_state').eq('tenant_id', tenantId).limit(5000),
      db.from('payroll_runs').select('status,net_cents,employer_cost_cents,reconciliation_state').eq('tenant_id', tenantId).limit(1000),
      db.from('ledger_journals').select('status,total_debit_cents,total_credit_cents').eq('tenant_id', tenantId).limit(5000),
    ]);
    if (payableResult.error) throw payableResult.error;
    if (payrollResult.error) throw payrollResult.error;
    if (ledgerResult.error) throw ledgerResult.error;
    const payables = payableResult.data || [];
    const payrollRuns = payrollResult.data || [];
    const journals = ledgerResult.data || [];
    return {
      status: 'AVAILABLE', errorCode: null, authorized: true,
      contractor: {
        openCount: payables.filter((row) => !['SETTLED', 'REVERSED'].includes(row.status)).length,
        heldCount: payables.filter((row) => row.status === 'HELD').length,
        reconciliationRequiredCount: payables.filter((row) => row.reconciliation_state !== 'MATCHED').length,
        openNetCents: sumCentsString(payables.filter((row) => !['SETTLED', 'REVERSED'].includes(row.status)), 'net_cents'),
      },
      employee: {
        activeRunCount: payrollRuns.filter((row) => !['PAID', 'CANCELLED'].includes(row.status)).length,
        actionRequiredCount: payrollRuns.filter((row) => row.status.includes('FAILED') || row.status.includes('REQUIRED')).length,
        reconciliationRequiredCount: payrollRuns.filter((row) => row.reconciliation_state !== 'MATCHED').length,
        activeNetCents: sumCentsString(payrollRuns.filter((row) => !['PAID', 'CANCELLED'].includes(row.status)), 'net_cents'),
      },
      ledger: {
        draftCount: journals.filter((row) => row.status === 'DRAFT').length,
        postedCount: journals.filter((row) => row.status === 'POSTED').length,
        unbalancedStoredCount: journals.filter((row) => String(row.total_debit_cents) !== String(row.total_credit_cents)).length,
      },
      adapterHealth,
    };
  } catch (error) {
    console.warn('[admin/finance/summary] PayOps failed', safeLogContext(error, 'payops_summary_failed'));
    return {
      status: 'UNAVAILABLE', errorCode: safeErrorCode(error, 'payops_summary_failed'), authorized: true,
      contractor: null, employee: null, ledger: null, adapterHealth,
    };
  }
}

async function loadInventoryCosts(db, tenantId, authed) {
  let financeRoles;
  try {
    financeRoles = await activeFinanceRoles(db, tenantId, authed.user.id);
  } catch {
    return {
      status: 'SCHEMA_UNAVAILABLE', sourceStatus: 'RECONCILIATION_REQUIRED',
      errorCode: 'inventory_finance_roles_unavailable', authorized: authed.role === 'admin',
      data: null, capabilities: { enabled: false, prepare: false, post: false },
    };
  }
  const authorized = authed.role === 'admin' || financeRoles.some((role) => PAYOPS_VIEW_ROLES.has(role));
  const flags = payOpsFlags();
  if (!authorized) {
    return {
      status: 'RESTRICTED', sourceStatus: 'RECONCILIATION_REQUIRED',
      errorCode: 'finance_permission_required', authorized: false, data: null,
      capabilities: { enabled: false, prepare: false, post: false },
    };
  }
  try {
    const data = await loadInventoryCostData(db, tenantId, { recentLimit: 8 });
    return {
      status: 'AVAILABLE',
      sourceStatus: flags.inventoryCosts ? 'UNVERIFIED' : 'RECONCILIATION_REQUIRED',
      errorCode: null,
      authorized: true,
      data,
      capabilities: {
        enabled: flags.inventoryCosts,
        prepare: flags.inventoryCosts && financeRoles.includes('finance_maker'),
        post: flags.ledger && financeRoles.includes('accountant_controller'),
      },
    };
  } catch (error) {
    console.warn('[admin/finance/summary] inventory costs failed', safeLogContext(error, 'inventory_cost_summary_failed'));
    const schemaUnavailable = ['42P01', '42703', 'PGRST200', 'PGRST204'].includes(String(error?.code || ''));
    return {
      status: schemaUnavailable ? 'SCHEMA_UNAVAILABLE' : 'UNAVAILABLE',
      sourceStatus: 'RECONCILIATION_REQUIRED',
      errorCode: safeErrorCode(error, 'inventory_cost_summary_failed'),
      authorized: true,
      data: null,
      capabilities: { enabled: false, prepare: false, post: false },
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db, tenantId } = authed;
  const [clientRevenue, nursePayOps, inventoryCosts] = await Promise.all([
    loadClientRevenue(db, tenantId),
    loadNursePayOps(db, tenantId, authed),
    loadInventoryCosts(db, tenantId, authed),
  ]);
  await writeAuditEvent(db, {
    tenantId,
    actorProfileId: authed.user?.id || null,
    action: 'admin_finance_summary_read',
    entityType: 'finance_domains',
    phiTouched: clientRevenue.status === 'AVAILABLE',
    payload: {
      clientRevenueStatus: clientRevenue.status,
      nursePayOpsStatus: nursePayOps.status,
      inventoryCostsStatus: inventoryCosts.status,
    },
  });
  const legacy = clientRevenue.data ? { ...clientRevenue.data, payouts: clientRevenue.data.merchantPayouts } : {};
  return res.status(200).json({ clientRevenue, nursePayOps, inventoryCosts, ...legacy });
}
