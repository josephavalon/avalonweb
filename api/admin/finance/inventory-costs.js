import { loadInventoryCostData } from '../../_lib/inventory-costs.js';
import {
  assertFinanceSafe,
  cleanIdempotencyKey,
  cleanUuid,
  normalizePayOpsDbError,
  PayOpsError,
  payOpsFlags,
  requireFinanceActor,
  sendPayOpsError,
} from '../../_lib/payops-core.js';

const VIEW_ROLES = ['finance_maker', 'finance_checker', 'accountant_controller', 'security_auditor'];

function parseBody(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    throw new PayOpsError('Request body must be valid JSON.', 'invalid_json', 400);
  }
}

function cleanPostingDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new PayOpsError('A valid posting date is required.', 'inventory_posting_date_invalid', 400);
  }
  return date;
}

function cleanCurrency(value) {
  const currency = String(value || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new PayOpsError('Currency is invalid.', 'inventory_currency_invalid', 400);
  }
  return currency;
}

function eventView(row) {
  return {
    id: row.id,
    stockTransactionId: row.stock_transaction_id,
    inventoryItemId: row.inventory_item_id,
    inventoryVariantId: row.inventory_variant_id,
    inventoryLotId: row.inventory_lot_id,
    purchaseOrderId: row.purchase_order_id,
    costEventType: row.cost_event_type,
    quantity: String(row.quantity_abs),
    unitCostCents: String(row.unit_cost_cents),
    totalCostCents: String(row.total_cost_cents),
    currency: row.currency,
    postingDate: row.posting_date,
    ledgerJournalId: row.ledger_journal_id,
    version: row.version,
    createdAt: row.created_at,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') {
      const authed = await requireFinanceActor(req, res, { allowedFinanceRoles: VIEW_ROLES });
      if (!authed) return;
      const data = await loadInventoryCostData(authed.db, authed.tenantId, {
        recentLimit: Math.min(100, Math.max(1, Number(req.query?.limit) || 50)),
      });
      const flags = payOpsFlags();
      return res.status(200).json({
        status: 'AVAILABLE',
        sourceStatus: flags.inventoryCosts ? 'UNVERIFIED' : 'RECONCILIATION_REQUIRED',
        data,
        capabilities: {
          enabled: flags.inventoryCosts,
          prepare: flags.inventoryCosts && authed.financeRoles.includes('finance_maker'),
          post: flags.ledger && authed.financeRoles.includes('accountant_controller'),
          legacyInventoryAcceptedAsFinanceEvidence: false,
        },
      });
    }

    if (req.method === 'POST') {
      const authed = await requireFinanceActor(req, res, {
        allowedFinanceRoles: ['finance_maker'],
        requireAal2: true,
      });
      if (!authed) return;
      const flags = payOpsFlags();
      if (!flags.inventoryCosts || !flags.ledger) {
        throw new PayOpsError(
          'Inventory cost preparation is disabled until typed inventory reconciliation and ledger controls are verified.',
          'inventory_costs_disabled',
          503,
        );
      }
      const body = parseBody(req);
      assertFinanceSafe(body);
      if (String(body.action || 'prepare_cost_event') !== 'prepare_cost_event') {
        throw new PayOpsError('Inventory cost action is invalid.', 'inventory_cost_action_invalid', 400);
      }
      const result = await authed.db.rpc('prepare_inventory_cost_event', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_stock_transaction_id: cleanUuid(body.stockTransactionId, 'stockTransactionId'),
        p_legal_entity_id: cleanUuid(body.legalEntityId, 'legalEntityId'),
        p_chart_version_id: cleanUuid(body.chartVersionId, 'chartVersionId'),
        p_debit_account_id: cleanUuid(body.debitAccountId, 'debitAccountId'),
        p_credit_account_id: cleanUuid(body.creditAccountId, 'creditAccountId'),
        p_posting_date: cleanPostingDate(body.postingDate),
        p_currency: cleanCurrency(body.currency),
        p_idempotency_key: cleanIdempotencyKey(req),
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      return res.status(201).json({ costEvent: eventView(result.data) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Inventory costs are unavailable.');
  }
}
