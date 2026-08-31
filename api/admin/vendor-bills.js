import { payOpsFlags, sendPayOpsError } from '../_lib/payops-core.js';
import {
  cents,
  checksum,
  currency,
  date,
  idempotencyKey,
  loadVendorAp,
  normalizeVendorApError,
  optionalUuid,
  parseVendorBody,
  reason,
  requireVendorActor,
  requireVendorApEnabled,
  safeRef,
  shapeRpcResult,
  uuid,
  version,
  VENDOR_AP_VIEW_ROLES,
} from '../_lib/vendor-ap.js';

function oneOf(value, allowed, field) {
  const result = String(value || '').trim().toUpperCase();
  if (!allowed.includes(result)) throw Object.assign(new Error(`${field} is invalid.`), { code: `${field}_invalid`, status: 400 });
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') {
      const authed = await requireVendorActor(req, res, VENDOR_AP_VIEW_ROLES);
      if (!authed) return;
      const billId = req.query?.billId ? uuid(req.query.billId, 'billId') : null;
      const data = await loadVendorAp(authed.db, authed.tenantId, {
        limit: req.query?.limit,
        billId,
      });
      const enabled = payOpsFlags().payOps;
      const recentMfa = authed.aal === 'aal2';
      const hasRole = (role) => enabled && recentMfa && authed.financeRoles.includes(role);
      return res.status(200).json({
        status: 'AVAILABLE',
        data,
        capabilities: {
          enabled,
          recentMfa,
          actorProfileId: authed.user.id,
          roles: authed.financeRoles,
          createProfile: hasRole('finance_maker'),
          reviewProfile: hasRole('finance_checker'),
          createBill: hasRole('finance_maker'),
          addLine: hasRole('finance_maker'),
          matchBill: hasRole('finance_maker'),
          makerApprove: hasRole('finance_maker'),
          checkerApprove: hasRole('finance_checker'),
          queueCommand: hasRole('finance_executor'),
          hold: hasRole('finance_maker') || hasRole('finance_checker'),
          cancel: hasRole('finance_checker'),
          settle: hasRole('accountant_controller'),
          directProviderSend: false,
          executionBoundary: 'OUTBOX_ONLY',
          settlementTruth: 'EVIDENCE_AND_RECONCILIATION_REQUIRED',
        },
      });
    }

    if (req.method === 'POST') {
      const body = parseVendorBody(req);
      const action = String(body.action || '').trim().toLowerCase();
      const role = action === 'review_profile' ? 'finance_checker' : 'finance_maker';
      const authed = await requireVendorActor(req, res, [role], { aal2: true });
      if (!authed) return;
      requireVendorApEnabled();
      const key = idempotencyKey(req);

      if (action === 'create_profile') {
        const taxClassification = oneOf(body.taxClassification, [
          'C_CORP', 'S_CORP', 'PARTNERSHIP', 'LLC', 'SOLE_PROPRIETOR',
          'NONPROFIT', 'GOVERNMENT', 'FOREIGN', 'OTHER_REVIEW_REQUIRED',
        ], 'taxClassification');
        const provider = String(body.destinationProvider || 'mercury').trim().toLowerCase();
        if (!['mercury', 'controlled_manual'].includes(provider)) throw new Error('destinationProvider is invalid.');
        const result = await authed.db.rpc('create_vendor_finance_profile', {
          p_tenant_id: authed.tenantId,
          p_actor_profile_id: authed.user.id,
          p_inventory_vendor_id: uuid(body.inventoryVendorId, 'inventoryVendorId'),
          p_legal_entity_id: uuid(body.legalEntityId, 'legalEntityId'),
          p_legal_name: String(body.legalName || '').trim(),
          p_tax_classification: taxClassification,
          p_destination_provider: provider,
          p_provider_recipient_id: provider === 'mercury' ? safeRef(body.providerRecipientId, 'providerRecipientId') : null,
          p_destination_masked_label: String(body.destinationMaskedLabel || '').trim(),
          p_idempotency_key: key,
        });
        if (result.error) throw result.error;
        return res.status(201).json({ profile: shapeRpcResult('profile', result.data) });
      }

      if (action === 'review_profile') {
        const result = await authed.db.rpc('review_vendor_finance_profile', {
          p_tenant_id: authed.tenantId,
          p_actor_profile_id: authed.user.id,
          p_vendor_finance_profile_id: uuid(body.profileId, 'profileId'),
          p_expected_version: version(body.expectedVersion),
          p_tax_reporting_status: oneOf(body.taxReportingStatus, ['READY', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'HELD'], 'taxReportingStatus'),
          p_w9_status: oneOf(body.w9Status, ['VERIFIED', 'EXEMPT_VERIFIED', 'ACTION_REQUIRED', 'EXPIRED'], 'w9Status'),
          p_tin_match_status: oneOf(body.tinMatchStatus, ['MATCHED', 'MANUAL_REVIEW', 'MISMATCH', 'UNAVAILABLE'], 'tinMatchStatus'),
          p_payment_readiness: oneOf(body.paymentReadiness, ['READY', 'ACTION_REQUIRED', 'HELD'], 'paymentReadiness'),
          p_reason_code: reason(body.reasonCode),
          p_idempotency_key: key,
        });
        if (result.error) throw result.error;
        return res.status(200).json({ profile: shapeRpcResult('profile', result.data) });
      }

      if (action === 'create_bill') {
        const billNumber = String(body.billNumber || '').trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(billNumber)) throw new Error('billNumber is invalid.');
        const result = await authed.db.rpc('create_vendor_bill', {
          p_tenant_id: authed.tenantId,
          p_actor_profile_id: authed.user.id,
          p_vendor_finance_profile_id: uuid(body.profileId, 'profileId'),
          p_purchase_order_id: optionalUuid(body.purchaseOrderId, 'purchaseOrderId'),
          p_bill_number: billNumber,
          p_invoice_date: date(body.invoiceDate, 'invoiceDate'),
          p_due_date: date(body.dueDate, 'dueDate'),
          p_currency: currency(body.currency),
          p_tax_cents: cents(body.taxCents || 0, 'taxCents'),
          p_shipping_cents: cents(body.shippingCents || 0, 'shippingCents'),
          p_source_document_ref: safeRef(body.sourceDocumentRef, 'sourceDocumentRef'),
          p_source_document_checksum: checksum(body.sourceDocumentChecksum, 'sourceDocumentChecksum'),
          p_idempotency_key: key,
        });
        if (result.error) throw result.error;
        return res.status(201).json({ bill: shapeRpcResult('bill', result.data) });
      }

      throw new Error('Vendor AP action is invalid.');
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendPayOpsError(res, normalizeVendorApError(error), 'Vendor AP is unavailable.');
  }
}
