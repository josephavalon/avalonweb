/**
 * GET /api/admin/finance/summary
 *
 * Thin live finance view for launch: appointment revenue/balances from
 * Supabase plus Stripe payouts and active subscription count.
 */
import Stripe from 'stripe';
import { requireStaff } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

function centsToDollars(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

function sumCents(rows = [], key) {
  return rows.reduce((total, row) => total + Number(row?.[key] || 0), 0);
}

function paidTimestamp(row = {}) {
  return row.balance_paid_at || row.deposit_paid_at || row.updated_at || row.created_at || null;
}

function isWithinWindow(iso, sinceMs) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= sinceMs;
}

async function activeSubscriptionCount(stripe) {
  let count = 0;
  let startingAfter = undefined;
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

function shapePayout(payout) {
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await requireStaff(req, res);
  if (!authed) return;
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured', code: 'stripe_secret_missing' });
  }

  const { db, tenantId } = authed;
  const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs).toISOString();

  try {
    let paidQuery = db.from('appointments')
      .select('id, tenant_id, visit_subtotal_cents, deposit_paid_at, balance_paid_at, updated_at, created_at')
      .eq('payment_status', 'paid_in_full')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1000);
    let outstandingQuery = db.from('appointments')
      .select('id, tenant_id, starts_at, protocol_key, payment_status, balance_due_cents, external_payload')
      .eq('payment_status', 'partial_payment')
      .gt('balance_due_cents', 0)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(100);
    // Deposits taken: every booking whose deposit has been collected, whether or
    // not the balance is settled (so partial_payment bookings count too).
    let depositsQuery = db.from('appointments')
      .select('deposit_amount_cents')
      .not('deposit_paid_at', 'is', null)
      .limit(2000);
    if (tenantId) {
      paidQuery = paidQuery.eq('tenant_id', tenantId);
      outstandingQuery = outstandingQuery.eq('tenant_id', tenantId);
      depositsQuery = depositsQuery.eq('tenant_id', tenantId);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const [paidResult, outstandingResult, depositsResult, payouts, activeSubscriptions] = await Promise.all([
      paidQuery,
      outstandingQuery,
      depositsQuery,
      stripe.payouts.list({ limit: 5 }),
      activeSubscriptionCount(stripe),
    ]);

    if (paidResult.error) throw paidResult.error;
    if (outstandingResult.error) throw outstandingResult.error;

    const paidRows = (paidResult.data || []).filter((row) => isWithinWindow(paidTimestamp(row), sinceMs));
    const outstandingRows = outstandingResult.data || [];
    const depositRows = depositsResult?.error ? [] : (depositsResult?.data || []);
    const depositsTakenCents = sumCents(depositRows, 'deposit_amount_cents');

    await writeAuditEvent(db, {
      tenantId,
      actorProfileId: authed.user?.id || null,
      action: 'admin_finance_summary_read',
      entityType: 'appointments',
      phiTouched: true,
      payload: {
        route: 'api/admin/finance/summary',
        paidCount: paidRows.length,
        outstandingCount: outstandingRows.length,
        payoutCount: payouts.data.length,
      },
    });

    return res.status(200).json({
      last30Days: {
        count: paidRows.length,
        amount: centsToDollars(sumCents(paidRows, 'visit_subtotal_cents')),
        since,
      },
      depositsTaken: {
        count: depositRows.length,
        amount: centsToDollars(depositsTakenCents),
      },
      outstandingBalances: {
        count: outstandingRows.length,
        amount: centsToDollars(sumCents(outstandingRows, 'balance_due_cents')),
        rows: outstandingRows.map(shapeOutstanding),
      },
      payouts: payouts.data.map(shapePayout),
      activeSubscriptions: { count: activeSubscriptions },
    });
  } catch (err) {
    console.warn('[admin/finance/summary] failed', safeLogContext(err, 'finance_summary_failed'));
    return res.status(500).json({
      error: 'Could not load finance summary.',
      code: safeErrorCode(err, 'finance_summary_failed'),
    });
  }
}
