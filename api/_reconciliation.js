export const RECONCILIATION_CASE_TYPES = [
  'stripe_succeeded_acuity_failed',
  'acuity_succeeded_stripe_failed',
  'gfe_delayed',
  'gfe_denied',
  'nursys_unavailable',
  'webhook_missed',
  'webhook_duplicate',
  'refund_accounting_mismatch',
  'appointment_drift',
  'payroll_sync_failed',
  'finance_sync_failed',
  'crm_sync_failed',
  'operations_email_failed',
  'customer_email_failed',
];

export const RECONCILIATION_CASE_DEFAULTS = {
  stripe_succeeded_acuity_failed: {
    severity: 'critical',
    owner_role: 'ops_manager',
    required_action: 'Create or recover the scheduling appointment before dispatch.',
  },
  acuity_succeeded_stripe_failed: {
    severity: 'critical',
    owner_role: 'ops_manager',
    required_action: 'Hold dispatch, recover payment, cancel, or manually reconcile the appointment.',
  },
  gfe_delayed: {
    severity: 'action',
    owner_role: 'clinical',
    required_action: 'Hold dispatch until Avalon NP or Qualiphy fallback clears the client.',
  },
  gfe_denied: {
    severity: 'critical',
    owner_role: 'clinical',
    required_action: 'Cancel or adjust service, notify client, and route refund policy.',
  },
  nursys_unavailable: {
    severity: 'action',
    owner_role: 'credentialing',
    required_action: 'Use manual credential proof or hold provider assignment.',
  },
  webhook_missed: {
    severity: 'action',
    owner_role: 'engineering',
    required_action: 'Replay provider event and compare local state against vendor state.',
  },
  webhook_duplicate: {
    severity: 'watch',
    owner_role: 'engineering',
    required_action: 'Deduplicate by provider idempotency key and preserve audit visibility.',
  },
  refund_accounting_mismatch: {
    severity: 'action',
    owner_role: 'finance',
    required_action: 'Reconcile Stripe refund against QuickBooks and Mercury finance records.',
  },
  appointment_drift: {
    severity: 'action',
    owner_role: 'ops_manager',
    required_action: 'Compare Acuity appointment to Avalon state and repair the local record.',
  },
  payroll_sync_failed: {
    severity: 'action',
    owner_role: 'finance',
    required_action: 'Hold payroll release until Gusto placeholder proof is reconciled.',
  },
  finance_sync_failed: {
    severity: 'action',
    owner_role: 'finance',
    required_action: 'Hold finance close until Mercury, QuickBooks, and Avalon ledgers agree.',
  },
  crm_sync_failed: {
    severity: 'action',
    owner_role: 'ops_manager',
    required_action: 'Retry CRM sync and confirm the appointment record has current contact context.',
  },
  operations_email_failed: {
    severity: 'action',
    owner_role: 'ops_manager',
    required_action: 'Confirm operations was notified through a fallback channel and retry email delivery.',
  },
  customer_email_failed: {
    severity: 'action',
    owner_role: 'ops_manager',
    required_action: 'Contact the customer through a fallback channel and retry email delivery.',
  },
};

export function buildReconciliationCase({
  caseType,
  provider = 'avalon',
  externalReference = null,
  payload = {},
  severity,
  ownerRole,
  tenantId,
} = {}) {
  if (!RECONCILIATION_CASE_TYPES.includes(caseType)) {
    throw new Error(`Unknown reconciliation case: ${caseType || 'missing'}`);
  }

  const defaults = RECONCILIATION_CASE_DEFAULTS[caseType];
  return {
    tenant_id: tenantId || undefined,
    case_type: caseType,
    severity: severity || defaults.severity,
    provider,
    external_reference: externalReference,
    owner_role: ownerRole || defaults.owner_role,
    payload: {
      ...payload,
      required_action: defaults.required_action,
      local_contract: 'pre-api-reconciliation-v1',
    },
  };
}

export async function insertReconciliationCaseOnce(db, caseRow = {}) {
  if (!db || !caseRow.case_type) return { skipped: true };
  try {
    let query = db.from('reconciliation_cases')
      .select('id')
      .eq('case_type', caseRow.case_type)
      .eq('provider', caseRow.provider || 'avalon');
    if (caseRow.external_reference == null) {
      query = query.is('external_reference', null);
    } else {
      query = query.eq('external_reference', caseRow.external_reference);
    }
    const { data: existing } = await query.maybeSingle();
    if (existing?.id) return { duplicate: true, id: existing.id };

    const { data, error } = await db.from('reconciliation_cases')
      .insert(caseRow)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return { inserted: true, id: data?.id || null };
  } catch (err) {
    console.warn('[reconciliation] insert failed:', err.message);
    return { error: err.message };
  }
}

export function reconciliationTypeForStripeEvent(event = {}) {
  const type = event.type || '';
  const object = event.data?.object || {};
  const metadata = object.metadata || {};

  if (type === 'checkout.session.completed') {
    if (metadata.fulfillment === 'stripe_paid_then_acuity_attio_v1') return null;
    return metadata.acuityAppointmentId ? null : 'stripe_succeeded_acuity_failed';
  }
  if (type === 'checkout.session.expired') return 'acuity_succeeded_stripe_failed';
  if (type === 'payment_intent.payment_failed') return 'acuity_succeeded_stripe_failed';
  if (type === 'charge.refunded') return 'refund_accounting_mismatch';
  return null;
}

export function buildCheckoutReconciliationHint({ acuityAppointment, error } = {}) {
  if (!acuityAppointment?.id) return null;
  return buildReconciliationCase({
    caseType: 'acuity_succeeded_stripe_failed',
    provider: 'checkout_orchestrator',
    externalReference: String(acuityAppointment.id),
    payload: {
      acuityAppointment,
      error: error?.message || 'Checkout failed after scheduling appointment creation.',
    },
  });
}
