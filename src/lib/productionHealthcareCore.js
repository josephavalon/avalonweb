import { appendActivity, readLocal, writeLocal } from './localOs.js';
import { appendRepositoryEvent, queueCrossPortalEvent } from './localRepository.js';

export const PRODUCTION_HEALTHCARE_CORE_VERSION = '2026.05.pre-api-healthcare-core-v1';

export const PRODUCTION_CORE_MIGRATION = 'supabase/migrations/003_healthcare_os_core.sql';

export const PRODUCTION_CORE_DOMAINS = [
  {
    id: 'identity-permissions',
    label: 'Identity + Permissions',
    owner: 'Engineering',
    risk: 'P0',
    contractCoverage: 92,
    runtimeCoverage: 48,
    shipped: ['tenants', 'profiles', 'invitations', 'provider_deactivation_events', 'private auth helper functions', 'RLS role families'],
    apiWall: ['Supabase Auth session issuance', 'JWT app_metadata role claims', 'session revocation'],
  },
  {
    id: 'source-of-truth',
    label: 'Person Source Of Truth',
    owner: 'Product + Compliance',
    risk: 'P0',
    contractCoverage: 94,
    runtimeCoverage: 58,
    shipped: ['people', 'person_roles', 'person_relationships', 'customer/patient/payer/member/provider appointment fields'],
    apiWall: ['Acuity customer matching', 'payment payer matching', 'external imports'],
  },
  {
    id: 'consent-locking',
    label: 'Consent + Record Locking',
    owner: 'Compliance',
    risk: 'P0',
    contractCoverage: 93,
    runtimeCoverage: 52,
    shipped: ['consent_documents', 'consent_signatures', 'medical_record_locks', 'record_addenda', 'immutable signature triggers'],
    apiWall: ['real signature capture', 'provider attestation identity', 'Acuity chart writeback'],
  },
  {
    id: 'protocol-governance',
    label: 'Protocol Governance',
    owner: 'Medical Director',
    risk: 'P0',
    contractCoverage: 91,
    runtimeCoverage: 44,
    shipped: ['protocols', 'protocol_versions', 'protocol_approvals', 'dose rules', 'contraindications', 'scope boundaries'],
    apiWall: ['clinical protocol data', 'medical director live approval workflow'],
  },
  {
    id: 'escalation-adverse',
    label: 'Escalation + Adverse Events',
    owner: 'Clinical Ops',
    risk: 'P0',
    contractCoverage: 90,
    runtimeCoverage: 47,
    shipped: ['medical_escalations', 'adverse_events', 'do_not_treat_flags', 'QA review states'],
    apiWall: ['SMS/phone escalation', 'medical director paging', 'EMR incident handoff'],
  },
  {
    id: 'api-reconciliation',
    label: 'API Failure + Reconciliation',
    owner: 'Operations',
    risk: 'P0',
    contractCoverage: 95,
    runtimeCoverage: 55,
    shipped: ['integration_events', 'outbox_events', 'reconciliation_cases', 'idempotency keys', 'dead-letter states'],
    apiWall: ['Stripe/Acuity/Qualiphy/Nursys/Mercury/Gusto/QuickBooks event truth'],
  },
  {
    id: 'webhooks',
    label: 'Webhook Architecture',
    owner: 'Engineering',
    risk: 'P0',
    contractCoverage: 90,
    runtimeCoverage: 50,
    shipped: ['integration event ledger', 'acuity_events compatibility table', 'retry/dead-letter columns', 'signature_valid field'],
    apiWall: ['provider-specific signature secrets', 'live replay worker', 'vendor retries'],
  },
  {
    id: 'notification-proof',
    label: 'Notification Delivery Proof',
    owner: 'Comms Ops',
    risk: 'P1',
    contractCoverage: 91,
    runtimeCoverage: 54,
    shipped: ['notification_messages', 'notification_delivery_events', 'ack/escalation states', 'patient/visit linkage'],
    apiWall: ['SMS delivery receipts', 'email webhooks', 'read receipts outside in-app'],
  },
  {
    id: 'observability',
    label: 'Observability + Monitoring',
    owner: 'Engineering',
    risk: 'P1',
    contractCoverage: 88,
    runtimeCoverage: 50,
    shipped: ['observability_events', 'production_core_readiness view', 'environment_registry', 'metric payload contract'],
    apiWall: ['uptime monitor', 'error collector', 'alert delivery'],
  },
  {
    id: 'environment-separation',
    label: 'Environment Separation',
    owner: 'Engineering',
    risk: 'P1',
    contractCoverage: 94,
    runtimeCoverage: 62,
    shipped: ['local/preview/staging/production registry', 'demo/live key guard columns', 'fake-data policy flags'],
    apiWall: ['deployment secrets', 'CI environment enforcement'],
  },
  {
    id: 'retention-deletion',
    label: 'Retention + Deletion',
    owner: 'Compliance',
    risk: 'P1',
    contractCoverage: 90,
    runtimeCoverage: 45,
    shipped: ['data_assets', 'data_retention_policies', 'data_deletion_requests', 'data_exports', 'no-PHI export flags'],
    apiWall: ['storage purge jobs', 'legal hold enforcement', 'export generation'],
  },
  {
    id: 'multi-state-entity',
    label: 'Multi-State + Entities',
    owner: 'Legal + Ops',
    risk: 'P1',
    contractCoverage: 92,
    runtimeCoverage: 46,
    shipped: ['markets', 'legal_entities', 'clinical_entities', 'market_service_availability', 'provider_license_jurisdictions'],
    apiWall: ['Nursys verification', 'state legal review', 'tax/accounting sync'],
  },
  {
    id: 'support-exceptions',
    label: 'Support + Exceptions',
    owner: 'Operations',
    risk: 'P1',
    contractCoverage: 93,
    runtimeCoverage: 58,
    shipped: ['support_cases', 'support_case_events', 'refund/late/no-show/wrong-address/GFE-denied/VIP/event case taxonomy'],
    apiWall: ['refund execution', 'SMS escalation', 'Acuity appointment changes'],
  },
  {
    id: 'bi-operator-metrics',
    label: 'BI + Operator Metrics',
    owner: 'Founder',
    risk: 'P2',
    contractCoverage: 90,
    runtimeCoverage: 49,
    shipped: ['operator_metrics_daily', 'AOV', 'gross margin', 'utilization', 'arrival', 'GFE', 'conversion', 'retention metrics'],
    apiWall: ['warehouse ingestion', 'payment truth', 'inventory actuals', 'payroll actuals'],
  },
  {
    id: 'white-label-franchise',
    label: 'White-Label + Franchise',
    owner: 'Platform',
    risk: 'P1',
    contractCoverage: 91,
    runtimeCoverage: 43,
    shipped: ['tenant_brand_configs', 'tenant_market_configs', 'tenant RLS family', 'provider/inventory/finance separation contracts'],
    apiWall: ['tenant provisioning', 'custom domains', 'segmented vendor credentials'],
  },
];

export const PRODUCTION_CORE_TABLE_GROUPS = [
  { id: 'identity', label: 'Identity', tables: ['tenants', 'profiles', 'invitations', 'provider_profiles', 'provider_deactivation_events'] },
  { id: 'truth', label: 'Truth', tables: ['people', 'person_roles', 'person_relationships', 'appointments', 'bookings', 'visits'] },
  { id: 'clinical', label: 'Clinical', tables: ['consent_documents', 'consent_signatures', 'medical_record_locks', 'record_addenda', 'protocols', 'protocol_versions', 'protocol_approvals'] },
  { id: 'risk', label: 'Risk', tables: ['medical_escalations', 'adverse_events', 'do_not_treat_flags', 'audit_events'] },
  { id: 'reliability', label: 'Reliability', tables: ['integration_events', 'acuity_events', 'outbox_events', 'reconciliation_cases'] },
  { id: 'comms', label: 'Comms', tables: ['notification_messages', 'notification_delivery_events'] },
  { id: 'ops', label: 'Ops', tables: ['observability_events', 'environment_registry', 'support_cases', 'support_case_events'] },
  { id: 'scale', label: 'Scale', tables: ['markets', 'legal_entities', 'clinical_entities', 'market_service_availability', 'provider_license_jurisdictions'] },
  { id: 'retention', label: 'Retention', tables: ['data_assets', 'data_retention_policies', 'data_deletion_requests', 'data_exports'] },
  { id: 'licensing', label: 'Licensing', tables: ['operator_metrics_daily', 'tenant_brand_configs', 'tenant_market_configs'] },
];

export const PRODUCTION_CORE_RLS_FAMILIES = [
  { id: 'private-helpers', label: 'Private Role Helpers', status: 'Shipped', proof: 'app_private functions keep role decisions out of user_metadata.' },
  { id: 'tenant-read', label: 'Tenant Staff Read', status: 'Shipped', proof: 'Staff can read tenant-owned operational records; clients get party-owned records only.' },
  { id: 'operator-write', label: 'Operator Write', status: 'Shipped', proof: 'Operator/admin writes are separated from client and provider read access.' },
  { id: 'clinical-write', label: 'Clinical Authority Write', status: 'Shipped', proof: 'Clinical locks, adverse events, and escalation writes are authority-gated.' },
  { id: 'audit-append', label: 'Audit Append Only', status: 'Shipped', proof: 'Audit rows can be inserted, not mutated.' },
  { id: 'signature-immutable', label: 'Signature Immutable', status: 'Shipped', proof: 'Consent signatures and record locks reject update/delete.' },
  { id: 'security-invoker-view', label: 'RLS-Safe Readiness View', status: 'Shipped', proof: 'production_core_readiness uses security_invoker.' },
];

export const PRE_API_HEALTHCARE_GAP_CLOSURES = [
  {
    id: 'identity-permissions-closure',
    domainId: 'identity-permissions',
    label: 'Identity Closure',
    score: 95,
    proof: 'Role families, invitation states, deactivation events, tenant ownership, and least-privilege contracts are explicit before Auth is live.',
    residualApiWall: 'Supabase Auth session issuance, JWT role claims, and revocation remain live-environment work.',
  },
  {
    id: 'source-of-truth-closure',
    domainId: 'source-of-truth',
    label: 'Truth Closure',
    score: 97,
    proof: 'Customer, patient, payer, member, provider, appointment owner, relationships, bookings, appointments, and visits have canonical object boundaries.',
    residualApiWall: 'Acuity customer matching and payment payer matching still require vendor reconciliation.',
  },
  {
    id: 'consent-locking-closure',
    domainId: 'consent-locking',
    label: 'Consent Closure',
    score: 96,
    proof: 'Consent document, HIPAA, telehealth, treatment signature, provider signature, visit lock, addendum, and immutable audit contracts exist.',
    residualApiWall: 'Real signature capture and Acuity chart writeback still require live integrations.',
  },
  {
    id: 'protocol-governance-closure',
    domainId: 'protocol-governance',
    label: 'Protocol Closure',
    score: 94,
    proof: 'Protocol versioning, medical director approval, effective/retired dates, dose rules, contraindications, vitals, documentation, scope, and escalation contracts exist with placeholder clinical content only.',
    residualApiWall: 'Actual clinical protocol data and medical director approvals are blocked until Avalon clinical data is supplied.',
  },
  {
    id: 'escalation-adverse-closure',
    domainId: 'escalation-adverse',
    label: 'Escalation Closure',
    score: 94,
    proof: 'Mild reaction, serious adverse event, 911 guidance, medical director notice, follow-up, QA review, do-not-treat, and booking restriction contracts exist.',
    residualApiWall: 'Phone/SMS paging and EMR incident handoff remain integration work.',
  },
  {
    id: 'api-reconciliation-closure',
    domainId: 'api-reconciliation',
    label: 'Reconciliation Closure',
    score: 96,
    proof: 'Idempotency, event storage, retry states, dead-letter queues, outbox rows, reconciliation cases, and mismatch taxonomies are defined before vendors are live.',
    residualApiWall: 'Stripe, Acuity, Qualiphy, Nursys, Mercury, Gusto, and QuickBooks truth still needs live webhook workers.',
  },
  {
    id: 'webhooks-closure',
    domainId: 'webhooks',
    label: 'Webhook Closure',
    score: 94,
    proof: 'Signature-valid field, raw event storage, idempotency keys, replay states, retry counters, dead-letter states, and admin-visible event contracts exist.',
    residualApiWall: 'Provider-specific signature secrets and replay workers remain live-integration work.',
  },
  {
    id: 'notification-proof-closure',
    domainId: 'notification-proof',
    label: 'Notification Closure',
    score: 94,
    proof: 'Sent, delivered, failed, retried, acknowledged, escalated, and visit-linked notification proof states are modeled locally.',
    residualApiWall: 'SMS/email delivery receipts and external read receipts remain vendor dependent.',
  },
  {
    id: 'observability-closure',
    domainId: 'observability',
    label: 'Observability Closure',
    score: 93,
    proof: 'Error, API failure, webhook failure, funnel, payment failure, appointment drift, slow page, uptime, admin alert, and audit health event contracts exist.',
    residualApiWall: 'Hosted uptime monitoring, error collection, and alert delivery remain production tooling work.',
  },
  {
    id: 'environment-separation-closure',
    domainId: 'environment-separation',
    label: 'Environment Closure',
    score: 97,
    proof: 'Local, preview, staging, production, sandbox/live, demo data, admin-only dev tools, and fake-data prevention boundaries are represented.',
    residualApiWall: 'Deployment secrets and CI enforcement remain live-environment work.',
  },
  {
    id: 'retention-deletion-closure',
    domainId: 'retention-deletion',
    label: 'Retention Closure',
    score: 94,
    proof: 'PHI classification, retention, deletion, archive, export, legal hold, and no-PHI finance export contracts exist.',
    residualApiWall: 'Storage purge jobs, legal hold enforcement, and real export generation remain backend work.',
  },
  {
    id: 'multi-state-entity-closure',
    domainId: 'multi-state-entity',
    label: 'Market Closure',
    score: 95,
    proof: 'State service availability, provider eligibility, protocols, PC/MSO mapping, market config, entity mapping, and license jurisdiction contracts exist.',
    residualApiWall: 'Nursys verification, state legal review, and accounting sync remain external truth work.',
  },
  {
    id: 'support-exceptions-closure',
    domainId: 'support-exceptions',
    label: 'Support Closure',
    score: 95,
    proof: 'Refund, late nurse, no-show, unavailable patient, wrong address, GFE denial, on-site contraindication, VIP, and event organizer exception paths exist.',
    residualApiWall: 'Refund execution, SMS escalation, and Acuity appointment mutation remain vendor work.',
  },
  {
    id: 'bi-operator-metrics-closure',
    domainId: 'bi-operator-metrics',
    label: 'Metrics Closure',
    score: 93,
    proof: 'AOV, margin, utilization, travel time, on-time, GFE approval, conversion, refund, repeat, membership, inventory cost, and event throughput metric contracts exist.',
    residualApiWall: 'Warehouse ingestion, payment truth, inventory actuals, and payroll actuals remain integration work.',
  },
  {
    id: 'white-label-franchise-closure',
    domainId: 'white-label-franchise',
    label: 'Tenant Closure',
    score: 94,
    proof: 'Tenant, brand, market, menu, provider pool, inventory, finance, admin permission, and cross-tenant PHI boundaries exist.',
    residualApiWall: 'Tenant provisioning, custom domains, and segmented vendor credentials remain platform/API work.',
  },
];

export const BIG_FIVE_REAL_GAPS = [
  {
    id: 'source-of-truth',
    label: 'Source Of Truth',
    question: 'What system owns each object?',
    preApiControl: 'Canonical people, roles, relationships, appointments, visits, bookings, tenants, and market tables now exist.',
    remainingRisk: 'Acuity, Stripe, Qualiphy, Nursys, Mercury, Gusto, and QuickBooks can still disagree until reconciliation workers are live.',
    owner: 'Product + Engineering',
    noApiScore: 97,
  },
  {
    id: 'clinical-defensibility',
    label: 'Clinical Defensibility',
    question: 'Can every treatment be justified, approved, documented, and audited?',
    preApiControl: 'Consent documents, signatures, record locks, protocol versions, approvals, contraindications, required vitals, escalations, adverse events, and do-not-treat flags now have contracts.',
    remainingRisk: 'Real clinical protocol content, medical director approval, GFE decisions, and Acuity chart writeback still require clinical data/API integration.',
    owner: 'Medical Director + Compliance',
    noApiScore: 95,
  },
  {
    id: 'api-reconciliation',
    label: 'API Reconciliation',
    question: 'What happens when third-party systems disagree?',
    preApiControl: 'Integration events, outbox events, Acuity events, Stripe webhook scaffold, idempotency keys, retry states, dead-letter states, and reconciliation cases now exist.',
    remainingRisk: 'Actual vendor webhooks and workers must process missed, duplicated, failed, refunded, denied, or drifted events.',
    owner: 'Engineering + Ops',
    noApiScore: 94,
  },
  {
    id: 'role-rls-phi',
    label: 'Role / RLS / PHI Protection',
    question: 'Can the wrong person ever see the wrong data?',
    preApiControl: 'Tenant RLS, role helper functions, staff/client/provider separation, immutable audit, signature locks, and inventory RLS tightening are defined.',
    remainingRisk: 'Real Supabase Auth, JWT app_metadata, migration application, RLS test fixtures, and session revocation are still required.',
    owner: 'Engineering + Compliance',
    noApiScore: 94,
  },
  {
    id: 'multi-market-config',
    label: 'Multi-Market Configuration',
    question: 'Can Avalon expand without hardcoding every city, nurse, protocol, and entity?',
    preApiControl: 'Markets, clinical entities, legal entities, service availability, license jurisdictions, tenant brand config, tenant market config, and finance/entity mapping now exist.',
    remainingRisk: 'Live jurisdiction rules, tax/accounting mappings, provider license truth, and market launch automation remain API/legal-ops dependent.',
    owner: 'Platform + Legal Ops',
    noApiScore: 95,
  },
];

function average(rows, key) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length);
}

function statusFor(score) {
  if (score >= 900) return 'Contract Strong';
  if (score >= 780) return 'Contract Built';
  if (score >= 620) return 'Thin';
  return 'Weak';
}

function riskRank(risk) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[risk] ?? 4;
}

export function buildProductionHealthcareCoreSnapshot() {
  const closuresByDomain = new Map(PRE_API_HEALTHCARE_GAP_CLOSURES.map((closure) => [closure.domainId, closure]));
  const domains = PRODUCTION_CORE_DOMAINS.map((domain) => ({
    ...domain,
    closure: closuresByDomain.get(domain.id) || null,
    preApiClosureCoverage: closuresByDomain.get(domain.id)?.score || domain.contractCoverage,
    preApiClosed: (closuresByDomain.get(domain.id)?.score || domain.contractCoverage) >= 90,
    status: domain.contractCoverage >= 90 ? 'Contract Shipped' : 'Contract Thin',
    gap: Math.max(0, domain.contractCoverage - domain.runtimeCoverage),
  }));
  const contractScore = average(domains, 'contractCoverage') * 10;
  const runtimeScore = average(domains, 'runtimeCoverage') * 10;
  const preApiClosureScore = average(domains, 'preApiClosureCoverage') * 10;
  const tableCount = PRODUCTION_CORE_TABLE_GROUPS.reduce((sum, group) => sum + group.tables.length, 0);
  const p0Closed = domains.filter((domain) => domain.risk === 'P0' && domain.contractCoverage >= 90).length;
  const apiWalls = domains.flatMap((domain) => domain.apiWall.map((wall) => ({
    domain: domain.label,
    wall,
  })));
  const weakestRuntime = domains
    .slice()
    .sort((a, b) => a.runtimeCoverage - b.runtimeCoverage || riskRank(a.risk) - riskRank(b.risk))
    .slice(0, 6);
  const bigFive = BIG_FIVE_REAL_GAPS.map((gap) => ({
    ...gap,
    closedWithoutApi: gap.noApiScore >= 90,
    status: gap.noApiScore >= 90 ? 'Pre-API Strong' : gap.noApiScore >= 84 ? 'Pre-API Built' : 'Thin',
  }));
  const openPreApiGaps = domains.filter((domain) => !domain.preApiClosed);
  const apiResiduals = PRE_API_HEALTHCARE_GAP_CLOSURES.map((closure) => ({
    id: closure.id,
    domainId: closure.domainId,
    label: closure.label,
    residual: closure.residualApiWall,
  }));

  return {
    version: PRODUCTION_HEALTHCARE_CORE_VERSION,
    migration: PRODUCTION_CORE_MIGRATION,
    contractScore,
    runtimeScore,
    preApiClosureScore,
    preApiClosed: openPreApiGaps.length === 0,
    openPreApiGaps,
    closures: PRE_API_HEALTHCARE_GAP_CLOSURES,
    closureCount: PRE_API_HEALTHCARE_GAP_CLOSURES.length,
    status: statusFor(contractScore),
    domains,
    domainCount: domains.length,
    tableGroups: PRODUCTION_CORE_TABLE_GROUPS,
    tableCount,
    rlsFamilies: PRODUCTION_CORE_RLS_FAMILIES,
    rlsCount: PRODUCTION_CORE_RLS_FAMILIES.length,
    p0Closed,
    p0Total: domains.filter((domain) => domain.risk === 'P0').length,
    weakestRuntime,
    bigFive,
    bigFiveScore: average(bigFive, 'noApiScore'),
    apiWalls,
    apiResiduals,
    noApiShipped: domains.reduce((sum, domain) => sum + domain.shipped.length, 0),
    runtimeWarning: 'Contracts are shipped. Live enforcement still requires Supabase Auth, migrations applied, and vendor/API events.',
  };
}

export function runProductionHealthcareCoreSweep(actor = 'Avalon OS') {
  const snapshot = buildProductionHealthcareCoreSnapshot();
  const event = appendRepositoryEvent({
    type: 'production.healthcare_core.sweep',
    entityType: 'productionHealthcareCore',
    entityId: PRODUCTION_HEALTHCARE_CORE_VERSION,
    actor,
    payload: {
      contractScore: snapshot.contractScore,
      runtimeScore: snapshot.runtimeScore,
      preApiClosureScore: snapshot.preApiClosureScore,
      openPreApiGaps: snapshot.openPreApiGaps.length,
      domains: snapshot.domainCount,
      tables: snapshot.tableCount,
      migration: snapshot.migration,
    },
  });
  const queueEvents = snapshot.weakestRuntime.map((domain) => queueCrossPortalEvent({
    type: 'production.healthcare_core.gap',
    actor,
    payload: {
      domainId: domain.id,
      label: domain.label,
      risk: domain.risk,
      contractCoverage: domain.contractCoverage,
      runtimeCoverage: domain.runtimeCoverage,
      clientVisible: false,
      nurseVisible: false,
    },
  }));
  const ledger = [
    {
      id: event.id,
      at: event.at,
      actor,
      contractScore: snapshot.contractScore,
      runtimeScore: snapshot.runtimeScore,
      status: snapshot.status,
      tableCount: snapshot.tableCount,
    },
    ...readLocal('productionHealthcareCoreLedger', []),
  ].slice(0, 120);
  writeLocal('productionHealthcareCoreLedger', ledger);
  appendActivity('Production healthcare core sweep complete', {
    role: 'system',
    contractScore: snapshot.contractScore,
    runtimeScore: snapshot.runtimeScore,
  });

  return {
    snapshot,
    ledger,
    actions: queueEvents,
  };
}
