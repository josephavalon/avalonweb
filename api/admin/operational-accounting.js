import { requireStaff } from '../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const NORMAL_CREDIT = new Set(['liability', 'equity', 'revenue']);

function rangeStart(range) {
  const now = new Date();
  if (range === 'year') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  if (range === 'quarter') return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)).toISOString();
  if (range === 'all') return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function normalAmount(row) {
  const amount = Number(row.amount_cents || 0);
  const positive = NORMAL_CREDIT.has(row.account_type) ? row.direction === 'credit' : row.direction === 'debit';
  return positive ? amount : -amount;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authed = await requireStaff(req, res);
  if (!authed) return;
  try {
    const range = ['month', 'quarter', 'year', 'all'].includes(req.query?.range) ? req.query.range : 'month';
    let query = authed.db.from('os_finance_ledger').select('*').eq('tenant_id', authed.tenantId)
      .order('occurred_at', { ascending: false }).limit(5000);
    const from = rangeStart(range);
    if (from) query = query.gte('occurred_at', from);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const accounts = new Map();
    const groups = new Map();
    let debitsCents = 0;
    let creditsCents = 0;
    for (const row of rows) {
      if (row.direction === 'debit') debitsCents += Number(row.amount_cents || 0);
      else creditsCents += Number(row.amount_cents || 0);
      const key = `${row.account_code}:${row.currency}`;
      const current = accounts.get(key) || { accountCode: row.account_code, accountName: row.account_name, accountType: row.account_type, currency: row.currency, balanceCents: 0 };
      current.balanceCents += normalAmount(row);
      accounts.set(key, current);
      const group = groups.get(row.entry_group_id) || { id: row.entry_group_id, occurredAt: row.occurred_at, sourceType: row.source_type, sourceId: row.source_id, memo: row.memo, currency: row.currency, lines: [] };
      group.lines.push({ accountCode: row.account_code, accountName: row.account_name, accountType: row.account_type, direction: row.direction, amountCents: Number(row.amount_cents || 0) });
      groups.set(row.entry_group_id, group);
    }
    const accountRows = [...accounts.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const sumType = (type) => accountRows.filter((row) => row.accountType === type).reduce((sum, row) => sum + row.balanceCents, 0);
    const revenueCents = sumType('revenue');
    const expenseCents = sumType('expense');
    return res.status(200).json({
      range,
      metrics: {
        revenueCents, expenseCents, netIncomeCents: revenueCents - expenseCents,
        cashCents: accountRows.filter((row) => row.accountCode === '1000').reduce((sum, row) => sum + row.balanceCents, 0),
        accountsPayableCents: accountRows.filter((row) => row.accountCode === '2000').reduce((sum, row) => sum + row.balanceCents, 0),
        debitsCents, creditsCents, balanced: debitsCents === creditsCents,
      },
      accounts: accountRows,
      journals: [...groups.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 500),
    });
  } catch (error) {
    console.warn('[admin/operational-accounting] failed', safeLogContext(error, 'operational_accounting_failed'));
    return res.status(500).json({ error: 'Could not load the operational ledger.', code: safeErrorCode(error, 'operational_accounting_failed') });
  }
}
