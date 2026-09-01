import crypto from 'crypto';
import { bodyContainsPhi } from './phi-guard.js';
import { getAuthedUser, operatorMfaBlocked } from './supabase-auth.js';

export const FINANCE_ROLES = Object.freeze([
  'finance_maker',
  'finance_checker',
  'finance_executor',
  'payroll_approver',
  'hr_legal',
  'credentialing',
  'accountant_controller',
  'security_auditor',
]);

export const SENSITIVE_FINANCE_ROLES = Object.freeze([
  'finance_maker',
  'finance_checker',
  'finance_executor',
  'payroll_approver',
  'hr_legal',
  'accountant_controller',
]);

export const ADAPTER_STATES = Object.freeze([
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'UNVERIFIED',
  'MANUAL',
  'DISABLED',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$/;
const SAFE_REASON_RE = /^[A-Z0-9_]{3,100}$/;
const PROHIBITED_FINANCE_KEYS = /(patient|client_name|treatment|therapy|diagnos|medication|chart|gfe|clinical_note|symptom|dob|date_of_birth)/i;

export class PayOpsError extends Error {
  constructor(message, code = 'payops_error', status = 400, current = null) {
    super(message);
    this.name = 'PayOpsError';
    this.code = code;
    this.status = status;
    this.current = current;
  }
}

export function envEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function payOpsFlags(env = process.env) {
  return Object.freeze({
    payOps: envEnabled(env.AVALON_PAYOPS_ENABLED),
    ledger: envEnabled(env.AVALON_LEDGER_ENABLED),
    inventoryCosts: envEnabled(env.AVALON_INVENTORY_COSTS_ENABLED),
    mercuryLive: envEnabled(env.MERCURY_LIVE_ENABLED),
    gustoW2: envEnabled(env.GUSTO_W2_ENABLED),
    nursysLive: envEnabled(env.NURSYS_LIVE_ENABLED),
    mercurySendMode: String(env.MERCURY_SEND_MODE || 'approval_queue').trim().toLowerCase(),
    employeePayrollProvider: String(env.EMPLOYEE_PAYROLL_PROVIDER || 'gusto_embedded').trim().toLowerCase(),
    contractorTaxMode: String(env.CONTRACTOR_TAX_MODE || 'manual').trim().toLowerCase(),
  });
}

function missingKeys(env, keys) {
  return keys.filter((key) => !String(env?.[key] || '').trim());
}

export function financeAdapterHealth(env = process.env) {
  const flags = payOpsFlags(env);
  const mercuryMissing = missingKeys(env, ['MERCURY_API_TOKEN', 'MERCURY_ACCOUNT_ID', 'MERCURY_WEBHOOK_SECRET']);
  const gustoMissing = missingKeys(env, ['GUSTO_CLIENT_ID', 'GUSTO_CLIENT_SECRET', 'GUSTO_API_BASE_URL']);
  const nursysMissing = missingKeys(env, ['NURSYS_BASE_URL', 'NURSYS_CREDENTIAL_SECRET_ID', 'NURSYS_CREDENTIAL_ROTATION_DUE_AT']);
  return {
    avalonPayOps: {
      state: flags.payOps ? 'UNVERIFIED' : 'DISABLED',
      live: false,
      action: flags.payOps ? 'Verify schema, roles, and authenticated flows.' : 'Enable only after schema and human approval gates pass.',
    },
    avalonLedger: {
      state: flags.ledger ? 'UNVERIFIED' : 'DISABLED',
      live: false,
      action: flags.ledger ? 'Verify balanced posting, reversal, reports, and close.' : 'Keep disabled until accountant signoff.',
    },
    mercury: {
      state: !flags.mercuryLive ? 'DISABLED' : mercuryMissing.length ? 'UNAVAILABLE' : 'UNVERIFIED',
      live: false,
      missingConfiguration: mercuryMissing,
      sendMode: flags.mercurySendMode,
      action: !flags.mercuryLive
        ? 'Complete enrollment, sandbox, canary, and reconciliation before enabling.'
        : mercuryMissing.length
          ? 'Add the missing server-only Mercury configuration.'
          : 'Run a credentialed health check and controlled canary.',
    },
    gustoEmbedded: {
      state: !flags.gustoW2 ? 'DISABLED' : gustoMissing.length ? 'UNAVAILABLE' : 'UNVERIFIED',
      live: false,
      missingConfiguration: gustoMissing,
      provider: flags.employeePayrollProvider,
      action: !flags.gustoW2
        ? 'Complete Embedded approval and the jurisdiction coverage matrix.'
        : gustoMissing.length
          ? 'Add the missing server-only Gusto Embedded configuration.'
          : 'Verify token lifecycle, preview, approval, polling, and callback evidence.',
    },
    nursys: {
      state: !flags.nursysLive ? 'DISABLED' : nursysMissing.length ? 'UNAVAILABLE' : 'UNVERIFIED',
      live: false,
      missingConfiguration: nursysMissing,
      action: !flags.nursysLive
        ? 'Complete e-Notify enrollment, Nurse List, coverage, and fallback policy.'
        : nursysMissing.length
          ? 'Add the provider-issued server-only Nursys configuration.'
          : 'Verify a credentialed retrieval and rotation owner.',
    },
    contractorTax: {
      state: flags.contractorTaxMode === 'manual' ? 'MANUAL' : 'UNVERIFIED',
      live: false,
      mode: flags.contractorTaxMode,
      action: 'Human approval and filing evidence remain required.',
    },
  };
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

export function stableJson(value) {
  return JSON.stringify(sorted(value));
}

export function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableJson(value));
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function cleanUuid(value, field = 'id') {
  const id = String(value || '').trim();
  if (!UUID_RE.test(id)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return id;
}

export function cleanExpectedVersion(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new PayOpsError('Expected version is required.', 'expected_version_required', 400);
  }
  return version;
}

export function cleanReasonCode(value, field = 'reasonCode') {
  const code = String(value || '').trim().toUpperCase();
  if (!SAFE_REASON_RE.test(code)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return code;
}

export function cleanIdempotencyKey(req) {
  const key = String(req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'] || '').trim();
  if (!IDEMPOTENCY_RE.test(key)) {
    throw new PayOpsError('A valid Idempotency-Key header is required.', 'idempotency_key_required', 400);
  }
  return key;
}

export function cleanCents(value, field = 'amountCents', { allowZero = true } = {}) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 0 || (!allowZero && cents === 0)) {
    throw new PayOpsError(`${field} must be valid integer cents.`, `${field}_invalid`, 400);
  }
  return cents;
}

export function assertFinanceSafe(value, path = 'payload') {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFinanceSafe(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (PROHIBITED_FINANCE_KEYS.test(key)) {
        throw new PayOpsError('Clinical or patient data is not allowed in finance records.', 'finance_phi_key_rejected', 400);
      }
      assertFinanceSafe(entry, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && (bodyContainsPhi(value) || value.length > 2000)) {
    throw new PayOpsError('Clinical, patient, or unrestricted free text is not allowed in finance records.', 'finance_phi_text_rejected', 400);
  }
}

export async function activeFinanceRoles(db, tenantId, profileId) {
  const now = new Date().toISOString();
  const result = await db.from('finance_role_assignments')
    .select('finance_role,expires_at')
    .eq('tenant_id', tenantId)
    .eq('profile_id', profileId)
    .is('revoked_at', null)
    .lte('effective_at', now);
  if (result.error) throw result.error;
  return (result.data || [])
    .filter((row) => !row.expires_at || row.expires_at > now)
    .map((row) => row.finance_role);
}

export async function requireFinanceActor(req, res, {
  allowedFinanceRoles = [],
  allowOperatorView = false,
  requireAal2 = false,
} = {}) {
  const authed = await getAuthedUser(req);
  if (!authed) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  if (!authed.tenantId) {
    res.status(403).json({ error: 'Finance tenant access is not configured.', code: 'finance_tenant_required' });
    return null;
  }
  let roles = [];
  try {
    roles = await activeFinanceRoles(authed.db, authed.tenantId, authed.user.id);
  } catch (error) {
    res.status(503).json({ error: 'Finance authorization is unavailable.', code: 'finance_roles_unavailable' });
    return null;
  }
  const operatorView = allowOperatorView && ['admin', 'staff', 'founder'].includes(authed.role);
  const roleAllowed = allowedFinanceRoles.length === 0
    ? roles.length > 0
    : allowedFinanceRoles.some((role) => roles.includes(role));
  if (!operatorView && !roleAllowed) {
    res.status(403).json({ error: 'Finance permission required.', code: 'finance_permission_required' });
    return null;
  }
  if (requireAal2 && authed.aal !== 'aal2') {
    res.status(403).json({ error: 'Recent multi-factor authentication is required.', code: 'finance_step_up_required' });
    return null;
  }
  // requireAal2 is a per-route STEP-UP, opt-in and off by default. It is not
  // the global operator policy, so on its own it left every finance, payroll
  // and vendor-bill route under api/admin/ password-only even with
  // MFA_ENFORCED=true. This applies the same baseline requireAdmin/requireRole
  // do; the step-up above still stacks on top for the sensitive actions.
  if (operatorMfaBlocked(authed, res)) return null;
  return { ...authed, financeRoles: roles };
}

export async function requireNursePayActor(req, res) {
  const authed = await getAuthedUser(req);
  if (!authed) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  if (!['nurse', 'rn', 'np'].includes(authed.role)) {
    res.status(403).json({ error: 'Nurse access required.' });
    return null;
  }
  if (!authed.tenantId) {
    res.status(403).json({ error: 'Nurse tenant access is not configured.' });
    return null;
  }
  return authed;
}

export function sendPayOpsError(res, error, fallbackMessage = 'The finance request could not be completed.') {
  if (error instanceof PayOpsError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.current ? { current: error.current } : {}),
    });
  }
  return res.status(500).json({ error: fallbackMessage, code: 'payops_internal_error' });
}

const DB_ERROR_MAP = Object.freeze({
  finance_role_required: ['Finance permission required.', 403],
  finance_actor_inactive: ['The finance operator is not active.', 403],
  invoice_not_found: ['Invoice not found.', 404],
  payable_not_found: ['Payable not found.', 404],
  invoice_version_conflict: ['The invoice changed. Refresh and try again.', 409],
  payable_version_conflict: ['The payable changed. Refresh and try again.', 409],
  payable_version_or_state_conflict: ['The payable changed or can no longer be held.', 409],
  invoice_not_approved: ['Approve the invoice review before creating a payable.', 409],
  verified_nurse_identity_required: ['Verified nurse identity is required.', 409],
  effective_contractor_decision_required: ['An effective HR/Legal contractor decision is required.', 409],
  payee_profile_required: ['A payee profile is required.', 409],
  invoice_payable_link_conflict: ['The invoice is already linked to another payable version.', 409],
  payable_not_open: ['Only an open payable can be approved.', 409],
  payable_hold_unresolved: ['Resolve the payable hold before approval.', 409],
  payee_tax_or_payment_not_ready: ['Tax and payment readiness must be complete before approval.', 409],
  payable_totals_do_not_reconcile: ['Payable totals do not reconcile.', 409],
  inventory_admin_required: ['Administrator inventory access is required.', 403],
  inventory_location_request_invalid: ['Inventory location details are invalid.', 400],
  inventory_location_code_conflict: ['That inventory location code is already used by a different location.', 409],
  inventory_provider_profile_required: ['The selected nurse does not have one active provider profile.', 409],
  inventory_provider_profile_ambiguous: ['The selected nurse has multiple active provider profiles and requires administrator review.', 409],
  inventory_nurse_invalid: ['The selected nurse is not eligible for a kit assignment.', 409],
  inventory_nurse_profile_ambiguous: ['The selected nurse has multiple active provider profiles and requires administrator review.', 409],
  inventory_location_not_found: ['Inventory location not found.', 404],
  inventory_location_not_active: ['The inventory location is not active.', 409],
  inventory_transfer_location_invalid: ['Choose two different active inventory locations.', 409],
  inventory_transfer_request_invalid: ['The inventory transfer is invalid.', 400],
  inventory_transfer_insufficient_stock: ['The source location does not have enough stock for this transfer.', 409],
  inventory_quantity_unavailable: ['The location does not have enough stock for this action.', 409],
  inventory_location_required: ['Choose an inventory location for this stock movement.', 400],
  inventory_movement_direction_invalid: ['The stock movement direction is invalid.', 409],
  inventory_admin_movement_request_invalid: ['The inventory movement is invalid.', 400],
  inventory_admin_adjustment_direction_required: ['Choose whether the count adjustment increases or decreases stock.', 400],
  inventory_admin_adjustment_direction_invalid: ['Adjustment direction is valid only for count adjustments.', 400],
  inventory_admin_movement_location_invalid: ['Choose an active inventory location.', 409],
  inventory_admin_movement_item_invalid: ['Inventory item not found.', 404],
  inventory_admin_movement_variant_invalid: ['That variant does not belong to the selected item.', 409],
  inventory_admin_movement_lot_invalid: ['That lot does not belong to the selected item and variant.', 409],
  inventory_admin_movement_lot_variant_invalid: ['The lot references an unavailable item variant.', 409],
  inventory_admin_movement_insufficient_stock: ['The location does not have enough stock for this movement.', 409],
  inventory_admin_movement_cost_mismatch: ['The entered cost does not match the selected lot cost.', 409],
  inventory_costed_stock_lot_required: ['Choose a lot before recording or moving costed stock.', 409],
  inventory_expired_lot_consumption_prohibited: ['Expired stock cannot be recorded as used.', 409],
  inventory_expired_lot_care_transfer_prohibited: ['Expired stock can move only to quarantine.', 409],
  inventory_item_create_invalid: ['Inventory item details are invalid.', 400],
  inventory_vendor_create_invalid: ['Vendor details are invalid.', 400],
  inventory_variant_create_invalid: ['Inventory variant details are invalid.', 400],
  inventory_lot_create_invalid: ['Lot or batch details are invalid.', 400],
  inventory_purchase_order_create_invalid: ['Purchase order details are invalid.', 400],
  inventory_preferred_vendor_invalid: ['The preferred vendor is not available.', 409],
  inventory_item_invalid: ['Inventory item not found.', 404],
  inventory_variant_invalid: ['That variant does not belong to the selected item.', 409],
  inventory_vendor_invalid: ['Inventory vendor not found.', 404],
  inventory_purchase_order_line_create_invalid: ['Purchase order line details are invalid.', 400],
  inventory_purchase_order_not_found: ['Purchase order not found.', 404],
  inventory_purchase_order_line_create_not_allowed: ['Lines can be added only to a draft purchase order.', 409],
  inventory_purchase_order_receive_invalid: ['Purchase order receipt details are invalid.', 400],
  inventory_purchase_order_version_conflict: ['The purchase order changed. Refresh and try again.', 409],
  inventory_purchase_order_receive_not_allowed: ['This purchase order can no longer receive stock.', 409],
  inventory_purchase_order_line_not_found: ['Purchase order line not found.', 404],
  inventory_purchase_order_receive_quantity_exceeds_outstanding: ['The received quantity exceeds the amount still outstanding.', 409],
  inventory_purchase_order_item_invalid: ['The purchase order item is no longer available.', 409],
  inventory_purchase_order_location_invalid: ['Choose an active central, warehouse, or quarantine location.', 409],
  inventory_purchase_order_lot_invalid: ['The lot does not match the purchase order item and variant.', 409],
  inventory_purchase_order_lot_cost_required: ['The selected lot needs a positive unit cost.', 409],
  inventory_purchase_order_lot_cost_mismatch: ['The selected lot cost does not match the purchase order line.', 409],
  inventory_purchase_order_subtotal_must_be_zero: ['A draft purchase order subtotal is calculated from its item lines.', 409],
  inventory_purchase_order_subtotal_overflow: ['Purchase order line totals exceed the supported accounting range.', 409],
  inventory_purchase_order_line_quantity_preflight_failed: ['Existing purchase order quantities require administrator reconciliation.', 409],
  inventory_purchase_order_source_invalid: ['The stock receipt is not linked to a valid purchase order.', 409],
  inventory_expired_lot_care_receipt_prohibited: ['Expired stock cannot be received into a care kit or vehicle.', 409],
  inventory_stock_unit_cost_mismatch: ['The stock movement cost does not match its canonical lot cost.', 409],
  inventory_cost_snapshot_mismatch: ['The inventory cost snapshot does not match its canonical lot cost.', 409],
  inventory_cost_event_already_prepared: ['This inventory movement already has a prepared cost event.', 409],
  nurse_active_provider_required: ['An active nurse provider profile is required.', 403],
  nurse_active_provider_ambiguous: ['Multiple active nurse provider profiles require administrator review.', 409],
  nurse_kit_active_custody_required: ['An accepted active nurse-kit custody assignment is required.', 409],
  nurse_kit_assignment_required: ['An active nurse kit assignment is required.', 409],
  nurse_kit_assignment_ambiguous: ['Multiple active nurse kit assignments require administrator review.', 409],
  nurse_kit_acceptance_required: ['Accept kit custody before recording use or requesting restock.', 409],
  nurse_kit_access_denied: ['This kit is not assigned to the signed-in nurse.', 403],
  nurse_kit_access_required: ['This kit is not assigned to the signed-in nurse.', 403],
  nurse_kit_assignment_not_available: ['This nurse kit assignment is no longer available.', 409],
  nurse_kit_assignment_request_invalid: ['The nurse kit assignment is invalid.', 400],
  nurse_kit_movement_request_invalid: ['The kit movement is invalid.', 400],
  nurse_kit_restock_request_invalid: ['The restock request is invalid.', 400],
  nurse_kit_restock_line_invalid: ['A restock line is invalid.', 400],
  nurse_kit_restock_line_duplicate: ['The same item can appear only once in a restock request.', 400],
  nurse_kit_restock_item_invalid: ['A restock item is not available in this kit.', 409],
  nurse_kit_restock_variant_invalid: ['A restock variant is not available in this kit.', 409],
  nurse_kit_restock_item_not_authorized: ['Restock is available only for stock or par levels assigned to this kit.', 409],
  nurse_kit_restock_open_request_exists: ['A restock request is already open for this kit item.', 409],
  kit_restock_request_invalid: ['The restock request is invalid.', 400],
  kit_restock_request_not_found: ['Restock request not found.', 404],
  kit_restock_version_conflict: ['The restock request changed. Refresh and try again.', 409],
  kit_restock_transition_invalid: ['That restock request transition is not allowed.', 409],
  inventory_par_request_invalid: ['Par and restock quantities are invalid.', 400],
  inventory_par_context_invalid: ['That par level does not match the selected inventory item.', 409],
  inventory_par_version_conflict: ['The par level changed. Refresh and try again.', 409],
  inventory_restock_request_not_found: ['Restock request not found.', 404],
  inventory_restock_version_conflict: ['The restock request changed. Refresh and try again.', 409],
  inventory_restock_transition_invalid: ['That restock request transition is invalid.', 400],
  inventory_restock_transition_not_allowed: ['That restock request transition is no longer allowed.', 409],
  inventory_restock_transition_reason_required: ['A structured reason is required for this restock decision.', 400],
  inventory_restock_fulfillment_reference_required: ['Enter a valid fulfillment reference.', 400],
  inventory_restock_fulfillment_context_invalid: ['Fulfillment details are valid only when completing a restock.', 400],
  inventory_restock_fulfillment_transfer_invalid: ['The selected transfer does not fulfill this kit request.', 409],
  inventory_restock_fulfillment_transfer_required: ['A confirmed stock transfer is required before fulfillment.', 409],
  inventory_restock_fulfill_request_invalid: ['Restock fulfillment details are invalid.', 400],
  inventory_restock_fulfillment_requires_packing: ['Move the restock request to packing before fulfillment.', 409],
  inventory_restock_fulfillment_line_count_invalid: ['This restock request needs administrator review before fulfillment.', 409],
  inventory_read_limit_exceeded: ['Inventory is larger than the verified read ceiling and requires administrator review.', 503],
  nurse_restock_line_invalid: ['A kit restock request has an invalid item line and requires administrator review.', 409],
  idempotency_key_reused: ['This request identifier was already used for different data.', 409],
});

export function normalizePayOpsDbError(error) {
  if (error instanceof PayOpsError) return error;
  if (['42P01', '42703', 'PGRST200', 'PGRST204'].includes(String(error?.code || ''))) {
    return new PayOpsError(
      'Avalon PayOps is not available until its forward-only database migrations are applied.',
      'payops_schema_unavailable',
      503,
    );
  }
  const directCode = String(error?.code || '');
  if (DB_ERROR_MAP[directCode]) {
    const [message, status] = DB_ERROR_MAP[directCode];
    return new PayOpsError(message, directCode, status);
  }
  const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  const matched = Object.keys(DB_ERROR_MAP).find((code) => raw.includes(code));
  if (!matched) return error;
  const [message, status] = DB_ERROR_MAP[matched];
  return new PayOpsError(message, matched, status);
}
