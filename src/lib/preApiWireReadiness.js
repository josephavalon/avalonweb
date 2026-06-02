import { BOOKING_STATUSES, BOOKING_TRANSITIONS, resolveGfeRequirement, validateTransition } from './bookingLifecycle.js';
import { ROLE_VISIBILITY_RULES } from './localRepository.js';
import { buildProductionHealthcareCoreSnapshot } from './productionHealthcareCore.js';

export const PRE_API_WIRE_READINESS_VERSION = '2026.05.wire-tomorrow-v1';

export const WIRE_TOMORROW_INTEGRATIONS = [
  {
    id: 'acuity',
    label: 'Acuity',
    role: 'Scheduling + EMR source of record',
    owns: ['appointment schedule', 'appointment changes', 'clinical chart source of record'],
    neverOwns: ['pricing strategy', 'provider assignment', 'inventory truth', 'client lifecycle scoring'],
    inboundEvents: ['appointment.scheduled', 'appointment.rescheduled', 'appointment.canceled', 'appointment.changed'],
    outboundCommands: ['create appointment', 'cancel appointment', 'append closeout packet'],
    idempotencyKey: 'acuity_appointment_id + action + payload_hash',
    retryPolicy: 'Persist event, process once, replay from event ledger when local state drifts.',
    deadLetterPolicy: 'Move to reconciliation_cases.appointment_drift with ops owner.',
    phiPolicy: 'Clinical chart stays in Acuity until Avalon clinical data/backend is live.',
    localReplacementPoint: 'api/_acuity.js and api/integrations/acuity/webhook.js',
    envVars: ['ACUITY_USER_ID', 'ACUITY_API_KEY'],
  },
  {
    id: 'stripe',
    label: 'Stripe',
    role: 'Deposit and checkout authorization',
    owns: ['$1 deductible payment intent', 'refund status', 'checkout session truth'],
    neverOwns: ['clinical eligibility', 'appointment source of record', 'payroll', 'banking ledger'],
    inboundEvents: ['checkout.session.completed', 'checkout.session.expired', 'payment_intent.payment_failed', 'charge.refunded'],
    outboundCommands: ['create checkout session', 'create refund'],
    idempotencyKey: 'stripe_event_id or payload_hash',
    retryPolicy: 'Store event once, update integration_events, reconcile payment/appointment mismatch.',
    deadLetterPolicy: 'Route payment mismatches to reconciliation_cases with ops or finance owner.',
    phiPolicy: 'No clinical notes, GFE payload, or treatment decision data in Stripe metadata.',
    localReplacementPoint: 'api/create-checkout-session.js and api/integrations/stripe/webhook.js',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  {
    id: 'supabase',
    label: 'Supabase',
    role: 'Identity, permissions, local source tables, RLS, audit storage',
    owns: ['Auth sessions', 'role claims', 'RLS enforcement', 'event persistence'],
    neverOwns: ['Acuity chart content before clinical backend launch', 'vendor settlement truth'],
    inboundEvents: ['auth.session.created', 'auth.user.updated', 'database.row.changed'],
    outboundCommands: ['issue session', 'write event', 'read role-safe view'],
    idempotencyKey: 'table primary key + event checksum',
    retryPolicy: 'Client retries safe reads; server writes use append-only events where possible.',
    deadLetterPolicy: 'Failed integration writes become webhook_missed or finance_sync_failed cases.',
    phiPolicy: 'RLS and tenant separation must be active before real PHI enters Supabase.',
    localReplacementPoint: 'src/lib/supabase.js and supabase/migrations/003_healthcare_os_core.sql',
    envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'resend_sms',
    label: 'Resend / SMS',
    role: 'Email/SMS delivery, alerts, acknowledgements',
    owns: ['delivery attempt', 'provider delivery receipt', 'message failure reason'],
    neverOwns: ['clinical decision', 'source appointment state', 'provider credential state'],
    inboundEvents: ['message.delivered', 'message.failed', 'message.read', 'message.replied'],
    outboundCommands: ['send email', 'send SMS', 'send urgent escalation'],
    idempotencyKey: 'message_id + channel + recipient_hash',
    retryPolicy: 'Retry non-urgent by policy; urgent alerts escalate by acknowledgement timer.',
    deadLetterPolicy: 'Persist failed messages and route urgent failures to notification-proof cases.',
    phiPolicy: 'Use minimum necessary copy; avoid clinical chart payloads in message bodies.',
    localReplacementPoint: 'notification_messages and notification_delivery_events contracts',
    envVars: ['RESEND_API_KEY', 'SMS_PROVIDER_KEY'],
  },
  {
    id: 'attio',
    label: 'Attio',
    role: 'CRM follow-up and lifecycle outreach',
    owns: ['CRM-safe profile', 'lead lifecycle', 'outreach task'],
    neverOwns: ['PHI', 'GFE payload', 'clinical notes', 'treatment eligibility'],
    inboundEvents: ['person.updated', 'task.completed'],
    outboundCommands: ['upsert person', 'create follow-up task'],
    idempotencyKey: 'person_email_or_phone_hash + source_object_id',
    retryPolicy: 'Queue CRM-safe payload and retry until accepted or manually dismissed.',
    deadLetterPolicy: 'Failed CRM writes become support/ops follow-up tasks, not clinical blockers.',
    phiPolicy: 'CRM-safe fields only: source, city, lifecycle, visit count, plan interest.',
    localReplacementPoint: 'api/_attio.js and src/lib/attioPlaceholder.js',
    envVars: ['ATTIO_API_KEY', 'ATTIO_WORKSPACE_ID'],
  },
  {
    id: 'nursys',
    label: 'Nursys',
    role: 'License verification',
    owns: ['license lookup result', 'jurisdiction verification timestamp'],
    neverOwns: ['Avalon training status', 'shift acceptance', 'scope decision by medical director'],
    inboundEvents: ['license.clear', 'license.review', 'license.expired', 'lookup.unavailable'],
    outboundCommands: ['verify license'],
    idempotencyKey: 'provider_id + license_number + jurisdiction + lookup_date',
    retryPolicy: 'Retry lookup; hold new assignments when verification is unavailable or stale.',
    deadLetterPolicy: 'Route nursys_unavailable to credentialing owner.',
    phiPolicy: 'Provider credential data only; no patient PHI.',
    localReplacementPoint: 'provider_profiles and provider_license_jurisdictions contracts',
    envVars: ['NURSYS_API_KEY'],
  },
  {
    id: 'qualiphy',
    label: 'Qualiphy',
    role: 'GFE fallback only when Avalon remote NP is unavailable',
    owns: ['fallback GFE workflow result'],
    neverOwns: ['Avalon NP queue when an Avalon NP is on call', 'dispatch assignment', 'inventory', 'payment'],
    inboundEvents: ['gfe.approved', 'gfe.denied', 'gfe.delayed'],
    outboundCommands: ['request fallback GFE'],
    idempotencyKey: 'client_id + appointment_id + service_date',
    retryPolicy: 'Try Avalon NP first; fallback to Qualiphy only when no Avalon NP is on call.',
    deadLetterPolicy: 'gfe_delayed and gfe_denied cases route to clinical owner.',
    phiPolicy: 'Minimum necessary intake routed only through clinical-authorized path.',
    localReplacementPoint: 'GFE routing queue and clinical placeholder policy',
    envVars: ['QUALIPHY_API_KEY'],
  },
  {
    id: 'mercury',
    label: 'Mercury',
    role: 'Banking ledger',
    owns: ['bank transaction truth', 'cash movement status'],
    neverOwns: ['patient PHI', 'clinical eligibility', 'appointment state'],
    inboundEvents: ['transaction.posted', 'transfer.failed'],
    outboundCommands: ['read transactions', 'tag transaction'],
    idempotencyKey: 'bank_transaction_id',
    retryPolicy: 'Reconcile finance records daily; no visit dispatch depends on bank sync.',
    deadLetterPolicy: 'finance_sync_failed with finance owner.',
    phiPolicy: 'No PHI in finance export; use visit/order ids and non-clinical labels.',
    localReplacementPoint: 'src/lib/financeIntegrations.js Mercury placeholder',
    envVars: ['MERCURY_API_KEY'],
  },
  {
    id: 'gusto',
    label: 'Gusto',
    role: 'Payroll execution',
    owns: ['payroll run', 'contractor/employee payout status'],
    neverOwns: ['clinical closeout validity', 'appointment source of record', 'client PHI'],
    inboundEvents: ['payroll.processed', 'payment.failed'],
    outboundCommands: ['queue payroll line', 'sync contractor hours'],
    idempotencyKey: 'provider_id + visit_id + payroll_period',
    retryPolicy: 'Hold payroll line until closeout, incident, and kit deduction proof pass.',
    deadLetterPolicy: 'payroll_sync_failed with finance owner.',
    phiPolicy: 'No patient PHI; payroll packet references visit id and pay category only.',
    localReplacementPoint: 'src/lib/financeIntegrations.js Gusto placeholder',
    envVars: ['GUSTO_API_KEY'],
  },
  {
    id: 'quickbooks',
    label: 'QuickBooks',
    role: 'Accounting summary',
    owns: ['invoice/accounting post status', 'refund/accounting match'],
    neverOwns: ['bank truth', 'clinical data', 'provider credential state'],
    inboundEvents: ['invoice.created', 'refund.synced', 'sync.failed'],
    outboundCommands: ['post invoice summary', 'post refund summary'],
    idempotencyKey: 'source_order_id + accounting_period',
    retryPolicy: 'Queue no-PHI accounting summary and retry until posted.',
    deadLetterPolicy: 'finance_sync_failed or refund_accounting_mismatch with finance owner.',
    phiPolicy: 'No PHI accounting export. Service category only; no clinical notes.',
    localReplacementPoint: 'src/lib/financeIntegrations.js QuickBooks placeholder',
    envVars: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
  },
];

export const WIRE_TOMORROW_FAILURE_MATRIX = [
  ['stripe_succeeded_acuity_failed', 'Stripe confirms payment but no Acuity appointment exists.', 'ops_manager', 'critical', ['payment', 'appointment', 'booking']],
  ['acuity_succeeded_stripe_failed', 'Acuity appointment exists but payment/deposit fails or expires.', 'ops_manager', 'critical', ['appointment', 'payment', 'dispatch']],
  ['gfe_delayed', 'Avalon NP or Qualiphy fallback has not cleared in time.', 'clinical', 'action', ['gfe', 'appointment', 'dispatch']],
  ['gfe_denied', 'Clinical reviewer denies or adjusts service after payment/booking.', 'clinical', 'critical', ['gfe', 'payment', 'support']],
  ['nursys_unavailable', 'Credential verification vendor is unavailable.', 'credentialing', 'action', ['provider', 'assignment']],
  ['webhook_missed', 'Expected vendor event does not arrive.', 'engineering', 'action', ['integration_event', 'booking']],
  ['webhook_duplicate', 'Vendor sends the same event more than once.', 'engineering', 'monitor', ['integration_event']],
  ['refund_accounting_mismatch', 'Refund exists in Stripe but accounting/banking does not match.', 'finance', 'action', ['refund', 'accounting', 'banking']],
  ['appointment_drift', 'Appointment changed in Acuity but Avalon state is stale.', 'ops_manager', 'action', ['appointment', 'booking', 'client_message']],
  ['payroll_sync_failed', 'Gusto payroll sync fails after visit closeout.', 'finance', 'action', ['visit', 'payroll', 'provider']],
  ['finance_sync_failed', 'Mercury or QuickBooks finance sync fails.', 'finance', 'action', ['payment', 'banking', 'accounting']],
].map(([caseType, trigger, ownerRole, severity, affectedObjects]) => ({
  caseType,
  trigger,
  ownerRole,
  severity,
  affectedObjects,
  localRepresentation: 'reconciliation_cases',
  mustHave: ['idempotency key', 'raw event payload', 'owner role', 'next action', 'audit trail'],
}));

export const ROLE_PERMISSION_PROOF_MATRIX = [
  { role: 'client', maySee: ['booking', 'client', 'visit', 'message'], mustRedact: ['clinicalNotes', 'financePayload', 'auditPayload', 'nursePhone'] },
  { role: 'nurse', maySee: ['booking', 'client', 'nurse', 'visit', 'kit', 'inventoryItem', 'message'], mustRedact: ['financePayload', 'auditPayload', 'unassignedClientPhone'] },
  { role: 'clinical', maySee: ['booking', 'client', 'visit', 'auditEvent'], mustRedact: ['financePayload', 'paymentInstrument'] },
  { role: 'finance', maySee: ['booking', 'visit', 'inventoryTransaction', 'auditEvent'], mustRedact: ['phone', 'email', 'address', 'clinicalNotes', 'gfePayload'] },
  { role: 'admin', maySee: ['booking', 'client', 'nurse', 'visit', 'kit', 'inventoryItem', 'inventoryTransaction', 'message', 'auditEvent', 'crossPortalEvent'], mustRedact: ['clinicalNotes'] },
];

export const UI_TRUTH_PROOF_RULES = [
  { route: '/book', requiredLabel: 'Local hold', forbidden: ['live payment captured', 'guaranteed treatment'] },
  { route: '/booking/confirmation', requiredLabel: 'placeholder', forbidden: ['dispatched automatically', 'GFE guaranteed'] },
  { route: '/admin', requiredLabel: 'API residual', forbidden: ['live sync complete', 'real payroll sent'] },
  { route: '/provider/shift', requiredLabel: 'nurse sets final ETA', forbidden: ['automatic ETA final'] },
  { route: '/members/dashboard', requiredLabel: 'Real Status', forbidden: ['guaranteed clearance'] },
];

function scoreSection(items = [], predicate = () => true) {
  if (!items.length) return 0;
  const passed = items.filter(predicate).length;
  return Math.round((passed / items.length) * 100);
}

export function buildIntegrationContractSnapshot() {
  const completeContracts = WIRE_TOMORROW_INTEGRATIONS.map((contract) => ({
    ...contract,
    complete: [
      contract.owns,
      contract.neverOwns,
      contract.inboundEvents,
      contract.outboundCommands,
      contract.idempotencyKey,
      contract.retryPolicy,
      contract.deadLetterPolicy,
      contract.phiPolicy,
      contract.localReplacementPoint,
      contract.envVars,
    ].every((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)),
  }));

  return {
    version: PRE_API_WIRE_READINESS_VERSION,
    integrations: completeContracts,
    count: completeContracts.length,
    complete: completeContracts.every((item) => item.complete),
    score: scoreSection(completeContracts, (item) => item.complete),
  };
}

export function buildFailureMatrixSnapshot() {
  return {
    version: PRE_API_WIRE_READINESS_VERSION,
    cases: WIRE_TOMORROW_FAILURE_MATRIX,
    count: WIRE_TOMORROW_FAILURE_MATRIX.length,
    complete: WIRE_TOMORROW_FAILURE_MATRIX.every((item) => item.caseType && item.ownerRole && item.severity && item.affectedObjects.length && item.mustHave.length >= 5),
    score: scoreSection(WIRE_TOMORROW_FAILURE_MATRIX, (item) => item.caseType && item.ownerRole && item.severity && item.affectedObjects.length && item.mustHave.length >= 5),
  };
}

export function buildRoleProofSnapshot() {
  const rows = ROLE_PERMISSION_PROOF_MATRIX.map((row) => {
    const localRule = ROLE_VISIBILITY_RULES[row.role] || {};
    const maySeePass = row.maySee.every((entity) => localRule.canSee?.includes(entity));
    const redactPass = row.mustRedact.every((field) => localRule.redact?.includes(field));
    return { ...row, maySeePass, redactPass, complete: maySeePass && redactPass };
  });

  return {
    version: PRE_API_WIRE_READINESS_VERSION,
    rows,
    count: rows.length,
    complete: rows.every((row) => row.complete),
    score: scoreSection(rows, (row) => row.complete),
  };
}

export function buildStateMachineProofSnapshot(now = new Date()) {
  const transitionRows = [];
  for (const from of BOOKING_STATUSES) {
    for (const to of BOOKING_STATUSES) {
      if (from === to) continue;
      const allowed = BOOKING_TRANSITIONS[from]?.includes(to) || false;
      const booking = {
        status: from,
        nurse: 'Proof Nurse',
        gfe: 'Cleared',
        isNewClient: false,
        visitCount: 2,
        gfeRecord: { status: 'Valid', validUntil: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString() },
      };
      const result = validateTransition(booking, to);
      transitionRows.push({ from, to, allowed, ok: result.ok, pass: allowed === result.ok });
    }
  }

  const unsafeDispatchRows = ['Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed'].flatMap((to) => [
    {
      to,
      scenario: 'missing_gfe',
      result: validateTransition({ status: 'Nurse Assigned', nurse: 'Proof Nurse', gfe: 'Pending', isNewClient: true, visitCount: 0 }, to),
    },
    {
      to,
      scenario: 'missing_nurse',
      result: validateTransition({ status: 'Cleared', nurse: 'Unassigned', gfe: 'Cleared', isNewClient: false, visitCount: 2 }, to),
    },
  ]).map((row) => ({ ...row, pass: row.result.ok === false }));

  const annualGfe = resolveGfeRequirement({
    isNewClient: false,
    visitCount: 4,
    gfeRecord: { status: 'Valid', validUntil: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000).toISOString() },
  }, now);

  return {
    version: PRE_API_WIRE_READINESS_VERSION,
    transitionRows,
    unsafeDispatchRows,
    annualGfe,
    transitionScore: scoreSection(transitionRows, (row) => row.pass),
    dispatchGuardScore: scoreSection(unsafeDispatchRows, (row) => row.pass),
    complete: transitionRows.every((row) => row.pass) && unsafeDispatchRows.every((row) => row.pass) && annualGfe.required === false,
  };
}

export function buildUiTruthSnapshot() {
  const rows = UI_TRUTH_PROOF_RULES.map((rule) => ({
    ...rule,
    complete: Boolean(rule.route && rule.requiredLabel && rule.forbidden.length),
  }));

  return {
    version: PRE_API_WIRE_READINESS_VERSION,
    rows,
    count: rows.length,
    complete: rows.every((row) => row.complete),
    score: scoreSection(rows, (row) => row.complete),
  };
}

export function buildPreApiWireReadinessSnapshot() {
  const integrations = buildIntegrationContractSnapshot();
  const failures = buildFailureMatrixSnapshot();
  const roles = buildRoleProofSnapshot();
  const states = buildStateMachineProofSnapshot();
  const uiTruth = buildUiTruthSnapshot();
  const production = buildProductionHealthcareCoreSnapshot();
  const scores = [
    integrations.score,
    failures.score,
    roles.score,
    states.transitionScore,
    states.dispatchGuardScore,
    uiTruth.score,
    production.preApiClosed && production.openPreApiGaps.length === 0
      ? 100
      : Math.min(100, Math.round((production.preApiClosureScore || 0) / 10)),
  ];
  const score = Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length);
  const open = [
    ...integrations.integrations.filter((item) => !item.complete).map((item) => ({ type: 'integration', id: item.id })),
    ...failures.cases.filter((item) => !item.caseType || !item.ownerRole).map((item) => ({ type: 'failure', id: item.caseType })),
    ...roles.rows.filter((row) => !row.complete).map((row) => ({ type: 'role', id: row.role })),
    ...states.transitionRows.filter((row) => !row.pass).slice(0, 8).map((row) => ({ type: 'transition', id: `${row.from}->${row.to}` })),
    ...states.unsafeDispatchRows.filter((row) => !row.pass).map((row) => ({ type: 'dispatch-guard', id: `${row.scenario}:${row.to}` })),
    ...uiTruth.rows.filter((row) => !row.complete).map((row) => ({ type: 'ui-truth', id: row.route })),
  ];

  return {
    version: PRE_API_WIRE_READINESS_VERSION,
    score,
    status: score >= 100 && open.length === 0 ? 'Wire-Ready' : 'Hold',
    complete: score >= 100 && open.length === 0,
    open,
    integrations,
    failures,
    roles,
    states,
    uiTruth,
    productionResiduals: production.apiResiduals,
    apiOnlyResidue: [
      'Live vendor credentials and secrets',
      'Real Supabase Auth sessions and RLS runtime enforcement',
      'Real Acuity appointment/chart writeback',
      'Real Stripe payment/refund settlement',
      'Real message delivery receipts',
      'Real Nursys credential lookup',
      'Real Qualiphy fallback GFE',
      'Real Mercury, Gusto, and QuickBooks sync',
    ],
  };
}
