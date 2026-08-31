import {
  assertFinanceSafe,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  PayOpsError,
  payOpsFlags,
  requireFinanceActor,
} from './payops-core.js';

export const VENDOR_AP_VIEW_ROLES = Object.freeze([
  'finance_maker',
  'finance_checker',
  'finance_executor',
  'accountant_controller',
  'security_auditor',
]);

const DB_ERRORS = Object.freeze({
  vendor_finance_profile_not_found: ['Vendor finance profile not found.', 404],
  vendor_bill_not_found: ['Vendor bill not found.', 404],
  vendor_payment_not_found: ['Vendor payment not found.', 404],
  vendor_finance_profile_version_conflict: ['The vendor profile changed. Refresh and try again.', 409],
  vendor_bill_version_conflict: ['The vendor bill changed. Refresh and try again.', 409],
  vendor_bill_version_or_state_conflict: ['The vendor bill changed or the action is no longer allowed.', 409],
  vendor_payment_version_conflict: ['The vendor payment changed. Refresh and try again.', 409],
  vendor_finance_profile_already_exists: ['A finance profile already exists for this vendor and legal entity.', 409],
  vendor_profile_maker_checker_required: ['A different Finance checker must review this vendor profile.', 409],
  vendor_bill_cancel_independent_checker_required: ['A different Finance checker must cancel this bill.', 409],
  vendor_payment_dispatch_started_hold_requires_recovery: ['The payment command has already been claimed. Use controlled recovery.', 409],
  vendor_payment_dispatch_started_cancel_requires_recovery: ['The payment command has already been claimed. Use controlled recovery.', 409],
  vendor_payment_worker_revalidation_failed: ['The vendor payment snapshot changed before provider work.', 409],
  vendor_payment_bank_evidence_mismatch: ['Bank evidence does not exactly match this vendor payment.', 409],
  verified_provider_settlement_evidence_required: ['Verified provider evidence is required.', 409],
  vendor_profile_or_match_not_ready: ['Vendor readiness or bill-match evidence is incomplete.', 409],
  vendor_payment_checker_snapshot_changed: ['The vendor payment snapshot changed before checker approval.', 409],
  vendor_payment_queue_snapshot_changed: ['The vendor payment snapshot changed before executor authorization.', 409],
  vendor_bill_not_approvable: ['The bill is not matched and ready for approval.', 409],
  inventory_bill_requires_three_way_match: ['Inventory bills require a purchase order and receipt match.', 409],
  vendor_bill_po_line_mismatch: ['A bill line does not match its purchase-order line.', 409],
  vendor_purchase_order_bill_already_exists: ['That purchase order already has an active bill. Cancel it before replacing the obligation.', 409],
  vendor_bill_purchase_order_not_fully_received: ['The purchase order is not fully received.', 409],
  vendor_bill_requires_complete_purchase_order_lines: ['The bill must contain each purchase-order line exactly once.', 409],
  vendor_bill_receipt_allocation_insufficient: ['Received stock is insufficient for the billed quantities.', 409],
  vendor_bill_lines_required: ['Add at least one structured bill line.', 409],
  idempotency_key_reused: ['The idempotency key was already used for different input.', 409],
  finance_role_required: ['Finance permission required.', 403],
  finance_actor_inactive: ['The Finance operator is inactive.', 403],
});

const SAFE_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/;
const SAFE_CODE_RE = /^[A-Z0-9_]{3,100}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function addCents(...values) {
  try {
    return values.reduce((sum, value) => sum + BigInt(String(value ?? 0)), 0n).toString();
  } catch {
    throw new PayOpsError('Vendor AP returned an invalid money value.', 'vendor_ap_money_invalid', 502);
  }
}

export function parseVendorBody(req) {
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    throw new PayOpsError('Request body must be valid JSON.', 'invalid_json', 400);
  }
  assertFinanceSafe(body);
  return body;
}

export function requireVendorApEnabled() {
  if (!payOpsFlags().payOps) {
    throw new PayOpsError(
      'Vendor AP is disabled pending migration, role, reconciliation, and canary gates.',
      'avalon_payops_disabled',
      503,
    );
  }
}

export async function requireVendorActor(req, res, roles, { aal2 = false } = {}) {
  return requireFinanceActor(req, res, {
    allowedFinanceRoles: roles,
    requireAal2: aal2,
  });
}

export function idempotencyKey(req) {
  return cleanIdempotencyKey(req);
}

export function uuid(value, field) {
  return cleanUuid(value, field);
}

export function optionalUuid(value, field) {
  if (value === null || value === undefined || value === '') return null;
  return cleanUuid(value, field);
}

export function version(value) {
  return cleanExpectedVersion(value);
}

export function reason(value) {
  return cleanReasonCode(value);
}

export function safeCode(value, field = 'code') {
  const code = String(value || '').trim().toUpperCase();
  if (!SAFE_CODE_RE.test(code)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return code;
}

export function safeRef(value, field = 'reference') {
  const ref = String(value || '').trim();
  if (!SAFE_REF_RE.test(ref)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return ref;
}

// This value is sent to Mercury and later must equal the provider_account_id
// on immutable bank evidence. It is an opaque provider identifier, never a raw
// routing or bank-account number.
export function mercuryProviderAccountId(value) {
  const ref = safeRef(value, 'fundingAccountRef');
  if (ref.length > 200) {
    throw new PayOpsError('Choose a valid Mercury provider account ID.', 'fundingAccountRef_invalid', 400);
  }
  return ref;
}

export function checksum(value, field = 'checksum') {
  const digest = String(value || '').trim().toLowerCase();
  if (!SHA256_RE.test(digest)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return digest;
}

export function date(value, field) {
  const result = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return result;
}

export function currency(value) {
  const result = String(value || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw new PayOpsError('currency is invalid.', 'currency_invalid', 400);
  return result;
}

export function cents(value, field, { positive = false } = {}) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || (positive && amount === 0)) {
    throw new PayOpsError(`${field} must be integer cents.`, `${field}_invalid`, 400);
  }
  return amount;
}

export function quantity(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 1000) !== amount * 1000) {
    throw new PayOpsError('quantity is invalid.', 'quantity_invalid', 400);
  }
  return amount;
}

export function normalizeVendorApError(error) {
  if (error instanceof PayOpsError) return error;
  const message = String(error?.message || '').trim();
  const [safeMessage, status] = DB_ERRORS[message] || [];
  if (safeMessage) return new PayOpsError(safeMessage, message, status);
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600) {
    return new PayOpsError(message || 'Vendor AP request is invalid.', error.code || 'vendor_ap_request_invalid', error.status);
  }
  return new PayOpsError('Vendor AP could not complete the request.', 'vendor_ap_internal_error', 500);
}

function profileView(row) {
  return {
    id: row.id,
    inventoryVendorId: row.inventory_vendor_id,
    legalEntityId: row.legal_entity_id,
    legalName: row.legal_name,
    taxClassification: row.tax_classification,
    taxReportingStatus: row.tax_reporting_status,
    w9Status: row.w9_status,
    tinMatchStatus: row.tin_match_status,
    paymentReadiness: row.payment_readiness,
    destinationProvider: row.destination_provider,
    destinationMaskedLabel: row.destination_masked_label,
    status: row.status,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function billView(row, canonicalSettled = false) {
  const settlementClaimed = row.status === 'SETTLED';
  return {
    id: row.id,
    vendorFinanceProfileId: row.vendor_finance_profile_id,
    legalEntityId: row.legal_entity_id,
    purchaseOrderId: row.purchase_order_id,
    billNumber: row.bill_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    currency: row.currency,
    subtotalCents: String(row.subtotal_cents),
    taxCents: String(row.tax_cents),
    shippingCents: String(row.shipping_cents),
    totalCents: String(row.total_cents),
    status: settlementClaimed && !canonicalSettled ? 'RECONCILIATION_REQUIRED' : row.status,
    persistedStatus: row.status,
    canonicalSettled: settlementClaimed && canonicalSettled,
    matchStatus: row.match_status,
    matchEvidenceId: row.match_evidence_id,
    makerApprovedBy: row.maker_approved_by,
    checkerApprovedBy: row.checker_approved_by,
    holdCode: row.hold_code,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function paymentView(row, canonicalSettled = false) {
  const settlementClaimed = row.status === 'SETTLED';
  return {
    id: row.id,
    vendorBillId: row.vendor_bill_id,
    vendorFinanceProfileId: row.vendor_finance_profile_id,
    legalEntityId: row.legal_entity_id,
    amountCents: String(row.amount_cents),
    currency: row.currency,
    fundingAccountMaskedLabel: row.funding_account_masked_label,
    destinationMaskedLabel: row.destination_masked_label,
    status: settlementClaimed && !canonicalSettled ? 'RECONCILIATION_REQUIRED' : row.status,
    persistedStatus: row.status,
    canonicalSettled: settlementClaimed && canonicalSettled,
    makerPreparedBy: row.maker_prepared_by,
    checkerApprovedBy: row.checker_approved_by,
    executorAuthorizedBy: row.executor_authorized_by,
    commandId: row.command_id,
    providerTransactionId: row.provider_transaction_id,
    settlementEvidenceStatus: row.settlement_evidence_status,
    reconciliationState: row.reconciliation_state,
    settledAt: row.settled_at,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function exactMoneyEqual(left, right) {
  try {
    return BigInt(String(left)) === BigInt(String(right));
  } catch {
    return false;
  }
}

function isCanonicalVendorSettlement(payment, evidence, reconciliation, bank) {
  return Boolean(
    payment?.status === 'SETTLED'
      && payment.settlement_evidence_status !== 'NONE'
      && payment.reconciliation_state === 'MATCHED'
      && payment.settled_at
      && payment.provider_transaction_id
      && evidence?.vendor_payment_id === payment.id
      && evidence.evidence_source === payment.settlement_evidence_status
      && evidence.provider_transaction_id === payment.provider_transaction_id
      && reconciliation?.id === evidence.reconciliation_match_id
      && reconciliation.vendor_payment_id === payment.id
      && reconciliation.bank_statement_item_id === evidence.bank_statement_item_id
      && reconciliation.match_status === 'APPROVED'
      && reconciliation.policy_version === 'vendor_ap_v1_exact'
      && exactMoneyEqual(reconciliation.matched_amount_cents, payment.amount_cents)
      && exactMoneyEqual(reconciliation.variance_cents, 0)
      && reconciliation.approved_at
      && bank?.id === evidence.bank_statement_item_id
      && bank.legal_entity_id === payment.legal_entity_id
      && bank.provider === 'mercury'
      && bank.provider_account_id === payment.funding_account_ref
      && bank.provider_transaction_id === payment.provider_transaction_id
      && bank.normalized_direction === 'DEBIT'
      && exactMoneyEqual(bank.amount_cents, -BigInt(String(payment.amount_cents)))
      && bank.currency === payment.currency
      && ['posted', 'settled', 'completed'].includes(String(bank.provider_status || '').toLowerCase())
      && bank.posted_at
      && bank.last_success_at,
  );
}

async function loadCanonicalVendorSettlements(db, tenantId, paymentRows) {
  const paymentIds = paymentRows.map((row) => row.id);
  const result = new Map(paymentIds.map((id) => [id, false]));
  if (!paymentIds.length) return result;

  const evidenceResult = await db.from('vendor_payment_evidence')
    .select('id,vendor_payment_id,evidence_source,finance_integration_event_id,bank_statement_item_id,reconciliation_match_id,provider_transaction_id')
    .eq('tenant_id', tenantId).in('vendor_payment_id', paymentIds);
  if (evidenceResult.error) throw evidenceResult.error;
  const evidenceRows = evidenceResult.data || [];
  if (!evidenceRows.length) return result;

  const reconciliationIds = [...new Set(evidenceRows.map((row) => row.reconciliation_match_id).filter(Boolean))];
  const bankIds = [...new Set(evidenceRows.map((row) => row.bank_statement_item_id).filter(Boolean))];
  const [reconciliationResult, bankResult] = await Promise.all([
    reconciliationIds.length
      ? db.from('reconciliation_matches')
        .select('id,vendor_payment_id,bank_statement_item_id,match_status,matched_amount_cents,variance_cents,policy_version,approved_at')
        .eq('tenant_id', tenantId).in('id', reconciliationIds)
      : Promise.resolve({ data: [], error: null }),
    bankIds.length
      ? db.from('bank_statement_items')
        .select('id,legal_entity_id,provider,provider_account_id,provider_transaction_id,provider_status,amount_cents,currency,normalized_direction,posted_at,last_success_at')
        .eq('tenant_id', tenantId).in('id', bankIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (reconciliationResult.error) throw reconciliationResult.error;
  if (bankResult.error) throw bankResult.error;

  const payments = new Map(paymentRows.map((row) => [row.id, row]));
  const reconciliations = new Map((reconciliationResult.data || []).map((row) => [row.id, row]));
  const banks = new Map((bankResult.data || []).map((row) => [row.id, row]));
  for (const evidence of evidenceRows) {
    const payment = payments.get(evidence.vendor_payment_id);
    if (isCanonicalVendorSettlement(
      payment,
      evidence,
      reconciliations.get(evidence.reconciliation_match_id),
      banks.get(evidence.bank_statement_item_id),
    )) result.set(payment.id, true);
  }
  return result;
}

export function shapeRpcResult(kind, row) {
  if (kind === 'profile') return profileView(row);
  if (kind === 'bill') return billView(row);
  if (kind === 'payment') return paymentView(row);
  return row;
}

export async function loadVendorAp(db, tenantId, { limit = 50, billId = null } = {}) {
  const bounded = Math.min(100, Math.max(1, Number(limit) || 50));
  const [
    profileResult,
    billResult,
    paymentResult,
    vendorResult,
    entityResult,
    purchaseOrderResult,
    purchaseOrderLineResult,
    itemResult,
  ] = await Promise.all([
    db.from('vendor_finance_profiles')
      .select('id,inventory_vendor_id,legal_entity_id,legal_name,tax_classification,tax_reporting_status,w9_status,tin_match_status,payment_readiness,destination_provider,destination_masked_label,status,version,updated_at')
      .eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(bounded),
    db.from('vendor_bills')
      .select('id,vendor_finance_profile_id,legal_entity_id,purchase_order_id,bill_number,invoice_date,due_date,currency,subtotal_cents,tax_cents,shipping_cents,total_cents,status,match_status,match_evidence_id,maker_approved_by,checker_approved_by,hold_code,version,created_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(bounded),
    db.from('vendor_payments')
      .select('id,vendor_bill_id,vendor_finance_profile_id,legal_entity_id,amount_cents,currency,funding_account_ref,funding_account_masked_label,destination_masked_label,status,maker_prepared_by,checker_approved_by,executor_authorized_by,command_id,provider_transaction_id,settlement_evidence_status,reconciliation_state,settled_at,version,updated_at')
      .eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(bounded),
    db.from('os_inventory_vendors')
      .select('id,name,status')
      .eq('tenant_id', tenantId).is('archived_at', null).order('name').limit(200),
    db.from('legal_entities')
      .select('id,entity_name,entity_type,state,active')
      .eq('tenant_id', tenantId).eq('active', true).order('entity_name').limit(100),
    db.from('os_purchase_orders')
      .select('id,vendor_id,order_number,status,expected_on,subtotal_cents,tax_cents,shipping_cents,version')
      .eq('tenant_id', tenantId).neq('status', 'cancelled')
      .order('created_at', { ascending: false }).limit(200),
    db.from('os_purchase_order_lines')
      .select('id,purchase_order_id,item_id,quantity_ordered,quantity_received,unit_cost_cents')
      .eq('tenant_id', tenantId).order('created_at').limit(1000),
    db.from('os_inventory_items')
      .select('id,name,sku,unit,status')
      .eq('tenant_id', tenantId).is('archived_at', null).order('name').limit(1000),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (billResult.error) throw billResult.error;
  if (paymentResult.error) throw paymentResult.error;
  if (vendorResult.error) throw vendorResult.error;
  if (entityResult.error) throw entityResult.error;
  if (purchaseOrderResult.error) throw purchaseOrderResult.error;
  if (purchaseOrderLineResult.error) throw purchaseOrderLineResult.error;
  if (itemResult.error) throw itemResult.error;

  let paymentRows = paymentResult.data || [];
  if (billId && !paymentRows.some((row) => row.vendor_bill_id === billId)) {
    const scopedPaymentResult = await db.from('vendor_payments')
      .select('id,vendor_bill_id,vendor_finance_profile_id,legal_entity_id,amount_cents,currency,funding_account_ref,funding_account_masked_label,destination_masked_label,status,maker_prepared_by,checker_approved_by,executor_authorized_by,command_id,provider_transaction_id,settlement_evidence_status,reconciliation_state,settled_at,version,updated_at')
      .eq('tenant_id', tenantId).eq('vendor_bill_id', billId).maybeSingle();
    if (scopedPaymentResult.error) throw scopedPaymentResult.error;
    if (scopedPaymentResult.data) paymentRows = [scopedPaymentResult.data, ...paymentRows];
  }

  const canonicalSettlements = await loadCanonicalVendorSettlements(db, tenantId, paymentRows);
  const canonicalSettlementByBill = new Map(paymentRows.map((row) => [
    row.vendor_bill_id,
    canonicalSettlements.get(row.id) === true,
  ]));

  let detail = null;
  if (billId) {
    const selectedPayment = paymentRows.find((row) => row.vendor_bill_id === billId) || null;
    const [lineResult, matchResult, approvalResult, evidenceResult, reconciliationResult, commandResult] = await Promise.all([
      db.from('vendor_bill_lines')
        .select('id,purchase_order_line_id,inventory_item_id,line_type,line_code,quantity,unit_amount_cents,amount_cents,currency,created_at')
        .eq('tenant_id', tenantId).eq('vendor_bill_id', billId).order('created_at').limit(500),
      db.from('vendor_bill_match_evidence')
        .select('id,match_type,match_status,purchase_order_total_cents,bill_total_cents,variance_cents,tolerance_cents,receipt_count,fully_received,safe_exception_code,evidence_checksum,created_at')
        .eq('tenant_id', tenantId).eq('vendor_bill_id', billId).order('created_at', { ascending: false }).limit(20),
      db.from('vendor_bill_approvals')
        .select('id,vendor_payment_id,stage,decision,actor_profile_id,aggregate_version,reason_code,created_at')
        .eq('tenant_id', tenantId).eq('vendor_bill_id', billId).order('created_at').limit(20),
      selectedPayment
        ? db.from('vendor_payment_evidence')
          .select('id,vendor_payment_id,evidence_source,finance_integration_event_id,bank_statement_item_id,reconciliation_match_id,provider_transaction_id,evidence_checksum,reason_code,created_at')
          .eq('tenant_id', tenantId).eq('vendor_payment_id', selectedPayment.id).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      selectedPayment
        ? db.from('reconciliation_matches')
          .select('id,vendor_payment_id,bank_statement_item_id,match_status,matched_amount_cents,variance_cents,policy_version,approved_at,created_at')
          .eq('tenant_id', tenantId).eq('vendor_payment_id', selectedPayment.id).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      selectedPayment?.command_id
        ? db.from('finance_integration_commands')
          .select('id,provider,command_type,aggregate_id,status,attempt_count,last_safe_error_code,created_at,updated_at')
          .eq('tenant_id', tenantId).eq('id', selectedPayment.command_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (lineResult.error) throw lineResult.error;
    if (matchResult.error) throw matchResult.error;
    if (approvalResult.error) throw approvalResult.error;
    if (evidenceResult.error) throw evidenceResult.error;
    if (reconciliationResult.error) throw reconciliationResult.error;
    if (commandResult.error) throw commandResult.error;
    detail = {
      lines: (lineResult.data || []).map((row) => ({
        id: row.id,
        purchaseOrderLineId: row.purchase_order_line_id,
        inventoryItemId: row.inventory_item_id,
        lineType: row.line_type,
        lineCode: row.line_code,
        quantity: String(row.quantity),
        unitAmountCents: String(row.unit_amount_cents),
        amountCents: String(row.amount_cents),
        currency: row.currency,
        createdAt: row.created_at,
      })),
      matches: matchResult.data || [],
      approvals: approvalResult.data || [],
      paymentEvidence: (evidenceResult.data || []).map((row) => ({
        id: row.id,
        vendorPaymentId: row.vendor_payment_id,
        evidenceSource: row.evidence_source,
        providerEventRecorded: Boolean(row.finance_integration_event_id),
        bankStatementItemId: row.bank_statement_item_id,
        reconciliationMatchId: row.reconciliation_match_id,
        providerReferenceRecorded: Boolean(row.provider_transaction_id),
        evidenceChecksum: row.evidence_checksum,
        reasonCode: row.reason_code,
        createdAt: row.created_at,
      })),
      reconciliation: (reconciliationResult.data || []).map((row) => ({
        id: row.id,
        vendorPaymentId: row.vendor_payment_id,
        bankStatementItemId: row.bank_statement_item_id,
        matchStatus: row.match_status,
        matchedAmountCents: String(row.matched_amount_cents),
        varianceCents: String(row.variance_cents),
        policyVersion: row.policy_version,
        approvedAt: row.approved_at,
        createdAt: row.created_at,
      })),
      command: commandResult.data ? {
        id: commandResult.data.id,
        provider: commandResult.data.provider,
        commandType: commandResult.data.command_type,
        vendorPaymentId: commandResult.data.aggregate_id,
        status: commandResult.data.status,
        attemptCount: commandResult.data.attempt_count,
        safeErrorCode: commandResult.data.last_safe_error_code,
        createdAt: commandResult.data.created_at,
        updatedAt: commandResult.data.updated_at,
      } : null,
    };
  }
  const itemById = new Map((itemResult.data || []).map((row) => [row.id, row]));
  return {
    profiles: (profileResult.data || []).map(profileView),
    bills: (billResult.data || []).map((row) => billView(row, canonicalSettlementByBill.get(row.id) === true)),
    payments: paymentRows.map((row) => paymentView(row, canonicalSettlements.get(row.id) === true)),
    catalogs: {
      vendors: (vendorResult.data || []).map((row) => ({
        id: row.id, name: row.name, status: row.status,
      })),
      legalEntities: (entityResult.data || []).map((row) => ({
        id: row.id,
        name: row.entity_name,
        type: row.entity_type,
        state: row.state,
      })),
      purchaseOrders: (purchaseOrderResult.data || []).map((row) => ({
        id: row.id,
        vendorId: row.vendor_id,
        orderNumber: row.order_number,
        status: row.status,
        expectedOn: row.expected_on,
        subtotalCents: String(row.subtotal_cents),
        taxCents: String(row.tax_cents),
        shippingCents: String(row.shipping_cents),
        totalCents: addCents(row.subtotal_cents, row.tax_cents, row.shipping_cents),
        version: row.version,
      })),
      purchaseOrderLines: (purchaseOrderLineResult.data || []).map((row) => ({
        id: row.id,
        purchaseOrderId: row.purchase_order_id,
        itemId: row.item_id,
        itemName: itemById.get(row.item_id)?.name || 'Inventory item',
        sku: itemById.get(row.item_id)?.sku || null,
        unit: itemById.get(row.item_id)?.unit || 'unit',
        quantityOrdered: String(row.quantity_ordered),
        quantityReceived: String(row.quantity_received),
        unitCostCents: String(row.unit_cost_cents),
      })),
    },
    detail,
  };
}
