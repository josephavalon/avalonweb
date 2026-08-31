import {
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanUuid,
  financeAdapterHealth,
  normalizePayOpsDbError,
  PayOpsError,
  payOpsFlags,
  requireFinanceActor,
  sendPayOpsError,
} from '../_lib/payops-core.js';

const MAX_PAGE = 100;

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

function payableView(row, payee, invoice) {
  return {
    id: row.id,
    status: row.status,
    payee: {
      id: payee?.id || row.payee_profile_id,
      displayName: payee?.display_name || 'Contractor payee',
      taxReadiness: payee?.tax_readiness || 'unknown',
      paymentReadiness: payee?.payment_readiness || 'unknown',
      destinationMaskedLabel: payee?.destination_masked_label || null,
    },
    sourceInvoice: row.source_invoice_id ? {
      id: row.source_invoice_id,
      invoiceNumber: invoice?.invoice_number || null,
      version: row.source_invoice_version,
    } : null,
    grossCents: String(row.gross_cents),
    reimbursementCents: String(row.reimbursement_cents),
    backupWithholdingCents: String(row.backup_withholding_cents),
    otherWithholdingCents: String(row.other_withholding_cents),
    netCents: String(row.net_cents),
    currency: row.currency,
    dueDate: row.due_date,
    calculationHash: row.calculation_hash,
    holdCode: row.hold_code,
    holdOwnerProfileId: row.hold_owner_profile_id,
    makerApprovedBy: row.maker_approved_by,
    makerApprovedAt: row.maker_approved_at,
    reconciliationState: row.reconciliation_state,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hydrate(db, tenantId, rows) {
  const payeeIds = [...new Set(rows.map((row) => row.payee_profile_id).filter(Boolean))];
  const invoiceIds = [...new Set(rows.map((row) => row.source_invoice_id).filter(Boolean))];
  const [payeeResult, invoiceResult] = await Promise.all([
    payeeIds.length
      ? db.from('payee_profiles').select('id,display_name,tax_readiness,payment_readiness,destination_masked_label')
        .eq('tenant_id', tenantId).in('id', payeeIds)
      : Promise.resolve({ data: [], error: null }),
    invoiceIds.length
      ? db.from('nurse_invoices').select('id,invoice_number')
        .eq('tenant_id', tenantId).in('id', invoiceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (payeeResult.error) throw payeeResult.error;
  if (invoiceResult.error) throw invoiceResult.error;
  const payees = new Map((payeeResult.data || []).map((row) => [row.id, row]));
  const invoices = new Map((invoiceResult.data || []).map((row) => [row.id, row]));
  return rows.map((row) => payableView(row, payees.get(row.payee_profile_id), invoices.get(row.source_invoice_id)));
}

function safeAdapterHealth() {
  return Object.fromEntries(Object.entries(financeAdapterHealth()).map(([key, value]) => [key, {
    state: value.state,
    live: value.live,
    action: value.action,
    ...(value.sendMode ? { sendMode: value.sendMode } : {}),
  }]));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const authed = await requireFinanceActor(req, res, {
        allowedFinanceRoles: ['finance_maker', 'finance_checker', 'finance_executor', 'accountant_controller', 'security_auditor'],
      });
      if (!authed) return;
      const limit = Math.min(MAX_PAGE, Math.max(1, Number(req.query?.limit) || 50));
      let query = authed.db.from('payables').select('*')
        .eq('tenant_id', authed.tenantId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
      if (req.query?.status) query = query.eq('status', String(req.query.status).trim().toUpperCase());
      if (req.query?.cursor) query = query.lt('created_at', String(req.query.cursor));
      const result = await query;
      if (result.error) throw result.error;
      const hasMore = (result.data || []).length > limit;
      const rows = (result.data || []).slice(0, limit);
      const payables = await hydrate(authed.db, authed.tenantId, rows);
      const enabled = payOpsFlags().payOps;
      return res.status(200).json({
        payables,
        pagination: {
          hasMore,
          nextCursor: hasMore ? rows[rows.length - 1]?.created_at || null : null,
        },
        capabilities: {
          enabled,
          createFromInvoice: enabled && authed.financeRoles.includes('finance_maker'),
          approve: enabled && authed.financeRoles.includes('finance_maker'),
          hold: authed.financeRoles.some((role) => ['finance_maker', 'finance_checker'].includes(role)),
          send: false,
          actorProfileId: authed.user.id,
        },
        adapterHealth: safeAdapterHealth(),
      });
    }

    if (req.method === 'POST') {
      const authed = await requireFinanceActor(req, res, {
        allowedFinanceRoles: ['finance_maker'],
        requireAal2: true,
      });
      if (!authed) return;
      if (!payOpsFlags().payOps) {
        throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
      }
      const body = parseBody(req);
      if (String(body.action || 'create_from_invoice') !== 'create_from_invoice') {
        throw new PayOpsError('Payable action is invalid.', 'payable_action_invalid', 400);
      }
      const invoiceId = cleanUuid(body.invoiceId, 'invoiceId');
      const expectedVersion = cleanExpectedVersion(body.expectedInvoiceVersion);
      const idempotencyKey = cleanIdempotencyKey(req);
      const dueDate = String(body.dueDate || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) {
        throw new PayOpsError('A valid due date is required.', 'payable_due_date_invalid', 400);
      }
      const result = await authed.db.rpc('create_contractor_payable_from_invoice', {
        p_tenant_id: authed.tenantId,
        p_invoice_id: invoiceId,
        p_expected_invoice_version: expectedVersion,
        p_actor_profile_id: authed.user.id,
        p_idempotency_key: idempotencyKey,
        p_due_date: dueDate,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      const payables = await hydrate(authed.db, authed.tenantId, [result.data]);
      return res.status(201).json({ payable: payables[0] });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Payables are unavailable.');
  }
}
