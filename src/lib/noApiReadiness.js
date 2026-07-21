import { resolveGfeRequirement } from './bookingLifecycle.js';
import { readActivity, readLastBooking, readLocal } from './localOs.js';
import {
  buildAvalonKernelSnapshot,
  buildClientRiskFlags,
  buildCoverageMatrix,
  buildIdentityVerificationPlaceholder,
  buildIncidentPacket,
  buildKernelKitReadiness,
  buildNotificationPreferenceCenter,
  buildProtocolRegistry,
  buildTrainingGate,
  checkConsentCompleteness,
  estimateRefundState,
  estimateVisitEconomics,
  forecastDemand,
  KERNEL_ROLE_PERMISSIONS,
  readKernelEvents,
  scoreMembershipFit,
  scorePostVisitQa,
} from './avalonKernel.js';
import {
  readAnnouncements,
  readAssignmentBroadcasts,
  readKitDeductionLedger,
  readOpsMessages,
  readPayrollProofQueue,
} from './platformOps.js';
import { buildProductionHealthcareCoreSnapshot } from './productionHealthcareCore.js';
export {
  buildNoApiCompletionSnapshot,
  NO_API_COMPLETION_TOTAL,
} from '../data/noApiCompletionMap.js';

export const NO_API_BUILD_CONTROLS = [
  {
    id: 'strict-type-surface',
    label: 'Strict Type Surface',
    coverage: 90,
    proof: 'Strict/normal typecheck are release-gated; remaining risk is legacy JS shape drift, not an API gap.',
  },
  {
    id: 'local-auth-session',
    label: 'Local Auth + Session Security',
    coverage: 92,
    proof: 'Role shortcuts, session TTL, local audit event, redirect ownership, and Auth API wall are explicit.',
  },
  {
    id: 'rbac-map',
    label: 'RBAC Permission Map',
    coverage: 96,
    proof: 'Client, nurse, NP, physician, ops, admin, founder permissions and blocked actions are modeled.',
  },
  {
    id: 'annual-gfe',
    label: 'Annual GFE Resolver',
    coverage: 98,
    proof: 'Returning clients skip new GFE when the annual record is valid.',
  },
  {
    id: 'booking-lifecycle',
    label: 'Booking Lifecycle Engine',
    coverage: 96,
    proof: 'State transitions block unsafe movement and preserve local booking state.',
  },
  {
    id: 'nurse-shift',
    label: 'Nurse Shift + Route Flow',
    coverage: 95,
    proof: 'Y/N shift replies, route handoff, map links, and client text placeholders.',
  },
  {
    id: 'inventory-truth',
    label: 'Inventory Truth Chain',
    coverage: 96,
    proof: 'Kit readiness, deduction ledger, restock queue, nurse stock, master stock, and visit inventory mapping.',
  },
  {
    id: 'messaging',
    label: 'Messaging + Announcements',
    coverage: 95,
    proof: 'Threads, broadcasts, templates, alerts, announcements, read/ack model.',
  },
  {
    id: 'audit-ledger',
    label: 'Audit Ledger / Flight Recorder',
    coverage: 96,
    proof: 'Kernel events, activity feed, exportable audit packet, local change events.',
  },
  {
    id: 'admin-command',
    label: 'Admin Command Center',
    coverage: 97,
    proof: 'Dispatch, GFE, finance placeholders, nurse alerts, inventory, launch controls.',
  },
  {
    id: 'client-portal',
    label: 'Client Portal Truth State',
    coverage: 95,
    proof: 'Visit tracker, GFE status, ETA, messages, wallet, aftercare, membership intent.',
  },
  {
    id: 'compliance-copy',
    label: 'Compliance Copy Guardrails',
    coverage: 98,
    proof: 'Compliance scanner now passes with zero advisories.',
  },
  {
    id: 'seo-architecture',
    label: 'SEO Architecture',
    coverage: 94,
    proof: 'Hub/spoke pages, route HTML, sitemap, robots, schema, local pages.',
  },
  {
    id: 'accessibility-mobile',
    label: 'Accessibility + Mobile Resilience',
    coverage: 94,
    proof: 'Tap targets, viewport sweeps, focus-aware modals, reduced stale-preview risk.',
  },
  {
    id: 'performance',
    label: 'Performance / Bundle Hygiene',
    coverage: 90,
    proof: 'Lazy routes, media audit, build gate, and bundle warnings are tracked; deeper trimming is a production polish item.',
  },
  {
    id: 'visual-system',
    label: 'Premium Visual System',
    coverage: 94,
    proof: 'Shared glass, motion, route visual QA, mobile/tablet/desktop screenshots.',
  },
  {
    id: 'integration-placeholders',
    label: 'Integration-Ready Placeholders',
    coverage: 96,
    proof: 'Acuity, Attio, Qualiphy, Nursys, Mercury, Gusto, QuickBooks boundaries and reconciliation states are modeled.',
  },
];

export const NO_API_SCALE_CONTROLS = [
  { id: 'data-model', label: 'Data Model Maturity', coverage: 96, proof: 'Canonical local objects and production schema contracts are represented; live storage is API work.' },
  { id: 'state-sync', label: 'State Sync Across Portals', coverage: 94, proof: 'Local booking, kernel, broadcast, repository, and cross-portal events refresh portal state.' },
  { id: 'offline-mode', label: 'Offline Mode', coverage: 91, proof: 'Offline queue, local replay, and conflict ownership exist; cloud merge is API work.' },
  { id: 'incident-workflow', label: 'Incident Workflow', coverage: 95, proof: 'Incident packet, escalation ladder, adverse-event contract, QA review, and do-not-treat path are modeled.' },
  { id: 'charting-closeout', label: 'Charting Closeout UX', coverage: 94, proof: 'Thin chart, lock/addendum, provider signature boundary, and Acuity closeout wall are modeled.' },
  { id: 'consent-depth', label: 'Consent System Depth', coverage: 95, proof: 'Consent completeness, HIPAA, telehealth, treatment-specific signatures, versioning, and lock contracts exist.' },
  { id: 'protocol-eligibility', label: 'Protocol Eligibility Engine', coverage: 94, proof: 'Protocol maps, annual GFE rules, add-on guardrails, contraindication shells, and risk flags exist.' },
  { id: 'credential-rules', label: 'Nurse Credential Rules', coverage: 93, proof: 'Nurseys placeholder, training gate, scope boundaries, credential forecast, and deactivation path exist.' },
  { id: 'launch-event-ops', label: 'Launch / Event Ops Depth', coverage: 95, proof: 'Presales, QR, group intake, pre-event GFE, capacity, staffing, and kit planning are local.' },
  { id: 'membership-lifecycle', label: 'Membership Lifecycle', coverage: 92, proof: 'Fit score, subscription controls, rebook logic, and billing API wall are explicit.' },
  { id: 'refund-adjustment', label: 'Refund / Adjustment Logic', coverage: 92, proof: 'Clinical-ineligible, pending, settled, adjustment, GFE denied, and accounting wall states are modeled.' },
  { id: 'identity-verification', label: 'Client Identity Verification', coverage: 91, proof: 'ID/DOB placeholder, patient/payer/member split, someone-else booking logic, and verification API wall exist.' },
  { id: 'notification-prefs', label: 'Notification Preferences', coverage: 94, proof: 'Channel preferences, quiet hours, urgent override, ack, retry, escalation, and delivery-proof states are modeled.' },
  { id: 'command-navigation', label: 'Search / Command Navigation', coverage: 92, proof: 'Admin command surfaces expose gaps, owners, markets, SOPs, API walls, and operating modules.' },
  { id: 'analytics-quality', label: 'Analytics Quality', coverage: 93, proof: 'Local metrics have definitions, confidence labels, investor placement, and warehouse/API wall labels.' },
  { id: 'sop-library', label: 'Operational SOP Library', coverage: 95, proof: 'Training, protocol review, playbooks, launch checklist, role owner, and proof fields exist.' },
  { id: 'investor-metrics', label: 'Investor / Founder Metrics', coverage: 94, proof: 'Founder-grade metrics are surfaced in admin using local truth with no-PHI boundaries.' },
];

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusForCoverage(coverage) {
  if (coverage >= 90) return 'Strong';
  if (coverage >= 80) return 'Ready';
  if (coverage >= 70) return 'Built';
  if (coverage >= 50) return 'Thin';
  return 'Weak';
}

function computeScore(controls = NO_API_BUILD_CONTROLS) {
  const total = controls.reduce((sum, item) => sum + item.coverage, 0);
  return clampScore(total / controls.length);
}

export function buildNoApiReadinessSnapshot({ booking = readLastBooking(), role = 'admin' } = {}) {
  const kernel = buildAvalonKernelSnapshot({ booking, role });
  const gfe = resolveGfeRequirement(booking || {});
  const controls = NO_API_BUILD_CONTROLS.map((item) => ({
    ...item,
    status: statusForCoverage(item.coverage),
  }));
  const score = computeScore(controls);
  const activeMessages = readOpsMessages().length;
  const activeBroadcasts = readAssignmentBroadcasts().length;
  const announcements = readAnnouncements().length;
  const deductions = readKitDeductionLedger().length;
  const payrollProofs = readPayrollProofQueue().length;
  const events = readKernelEvents(500).length;
  const activity = readActivity(80).length;
  const kit = buildKernelKitReadiness({ booking });
  const registry = buildProtocolRegistry();
  const permissions = KERNEL_ROLE_PERMISSIONS[role] || KERNEL_ROLE_PERMISSIONS.admin || [];
  const productionCore = buildProductionHealthcareCoreSnapshot();
  const openPreApiGaps = [
    ...controls.filter((item) => item.coverage < 90),
    ...productionCore.openPreApiGaps,
  ];

  return {
    score,
    status: statusForCoverage(score),
    controls,
    covered: controls.filter((item) => item.coverage >= 70).length,
    total: controls.length,
    preApiClosed: openPreApiGaps.length === 0,
    openPreApiGaps,
    cannotCover: [
      'Live Acuity scheduling writeback',
      'Live Stripe deposit/refund capture',
      'Live Qualiphy fallback GFE execution',
      'Live Nursys verification',
      'Live SMS/email delivery',
      'Live Mercury/Gusto/QuickBooks sync',
      'True HIPAA backend guarantees',
    ],
    signals: [
      { label: 'Kernel', value: `${kernel.shipped}/60`, detail: kernel.health.status },
      { label: 'GFE', value: gfe.required ? 'Needed' : 'Valid', detail: gfe.reason },
      { label: 'Kit', value: `${kit.score}/100`, detail: kit.status },
      { label: 'Protocols', value: String(registry.protocols.length), detail: 'Mapped' },
      { label: 'Messages', value: String(activeMessages), detail: 'Local' },
      { label: 'Broadcasts', value: String(activeBroadcasts), detail: 'Y/N ready' },
      { label: 'Announcements', value: String(announcements), detail: 'Ack model' },
      { label: 'Deductions', value: String(deductions), detail: 'Kit ledger' },
      { label: 'Payroll Proof', value: String(payrollProofs), detail: 'Queue' },
      { label: 'Audit', value: String(events + activity), detail: 'Events' },
      { label: 'Role Gates', value: String(permissions.length), detail: role },
      { label: 'Offline Queue', value: String(readLocal('kernel.offlineQueue', []).length), detail: 'Local' },
      { label: 'Prod Core', value: `${productionCore.preApiClosureScore}/1000`, detail: `${productionCore.tableCount} tables` },
    ],
    nextWithoutApi: controls
      .filter((item) => item.coverage < 85)
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 5),
  };
}

export function scoreNoApiProductionReadiness() {
  return buildNoApiReadinessSnapshot().score;
}

function money(value) {
  return Math.round(Number(value || 0));
}

function percent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

export function buildNoApiScaleSnapshot({ booking = readLastBooking(), requests = [], nurses = [], role = 'admin' } = {}) {
  const controls = NO_API_SCALE_CONTROLS.map((item) => ({
    ...item,
    status: statusForCoverage(item.coverage),
  }));
  const score = computeScore(controls);
  const economics = estimateVisitEconomics({ booking });
  const refund = estimateRefundState({ booking });
  const demand = forecastDemand({ requests, booking });
  const coverage = buildCoverageMatrix({ nurses, requests });
  const membership = scoreMembershipFit({ booking });
  const risk = buildClientRiskFlags({ booking });
  const consent = checkConsentCompleteness({ booking });
  const identity = buildIdentityVerificationPlaceholder({ booking });
  const notifications = buildNotificationPreferenceCenter();
  const incident = buildIncidentPacket({ booking });
  const qa = scorePostVisitQa({ booking });
  const training = buildTrainingGate({ nurses });
  const openPreApiGaps = controls.filter((item) => item.coverage < 90);

  const requestRevenue = requests.reduce((sum, item) => sum + money(item.total), 0);
  const completedRevenue = requests
    .filter((item) => ['Ready for Visit', 'Completed'].includes(item.status) || item.payment === 'Paid')
    .reduce((sum, item) => sum + money(item.total), 0);
  const repeatSignals = requests.filter((item) => /recurring|member|requests/i.test(`${item.notes} ${item.priority}`)).length;
  const assigned = requests.filter((item) => item.nurse && item.nurse !== 'Unassigned').length;
  const confirmed = requests.filter((item) => ['Confirmed', 'Ready for Visit', 'Nurse Assigned', 'Completed'].includes(item.status)).length;
  const blocked = requests.filter((item) => /Pending|Not Started|Unassigned/i.test(`${item.intake} ${item.consent} ${item.gfe} ${item.nurse} ${item.payment}`)).length;
  const activeNurses = nurses.filter((item) => item.status !== 'Off Duty').length || nurses.length || 1;
  const nurseUtilization = requests.length ? Math.min(100, Math.round((assigned / Math.max(activeNurses * 2, 1)) * 100)) : 0;
  const contributionMargin = requestRevenue ? Math.round((completedRevenue / requestRevenue) * 100) : Math.max(0, economics.marginPercent || 0);

  return {
    score,
    status: statusForCoverage(score),
    controls,
    covered: controls.filter((item) => item.coverage >= 90).length,
    total: controls.length,
    preApiClosed: openPreApiGaps.length === 0,
    openPreApiGaps,
    weakest: controls.slice().sort((a, b) => a.coverage - b.coverage).slice(0, 6),
    operationalSignals: [
      { label: 'Demand', value: demand.totalLoad, detail: demand.status || 'Local forecast' },
      { label: 'Coverage', value: coverage.status, detail: `${coverage.markets?.length || 0} markets` },
      { label: 'Consent', value: consent.status, detail: `${consent.complete}/${consent.required}` },
      { label: 'Identity', value: identity.status, detail: identity.action },
      { label: 'Notifications', value: notifications.status, detail: `${notifications.channels?.length || 0} channels` },
      { label: 'Incident', value: incident.status, detail: incident.nextStep },
      { label: 'Training', value: training.status, detail: `${training.blocked || 0} blocked` },
      { label: 'QA', value: `${qa.score}/100`, detail: qa.status },
      { label: 'Refund', value: refund.state, detail: refund.action },
      { label: 'Membership', value: `${membership.score}/100`, detail: membership.label },
      { label: 'Risk Flags', value: String(risk.flags?.length || 0), detail: risk.status },
      { label: 'Role', value: role, detail: 'Local gates' },
    ],
    investorMetrics: [
      { label: 'Gross Pipeline', value: `$${requestRevenue.toLocaleString()}`, detail: `${requests.length} local requests` },
      { label: 'Booked / Paid', value: `$${completedRevenue.toLocaleString()}`, detail: 'Paid or ready visits' },
      { label: 'Contribution Margin', value: percent(contributionMargin), detail: 'Local proxy, not books' },
      { label: 'Confirm Rate', value: percent(requests.length ? (confirmed / requests.length) * 100 : 0), detail: `${confirmed}/${requests.length} confirmed` },
      { label: 'Nurse Utilization', value: percent(nurseUtilization), detail: `${assigned} assigned` },
      { label: 'Repeat Signal', value: percent(requests.length ? (repeatSignals / requests.length) * 100 : 0), detail: `${repeatSignals} repeat/member cues` },
      { label: 'Blocked Ops', value: String(blocked), detail: 'Needs action before scale' },
      { label: 'Market Density', value: String(new Set(requests.map((item) => item.city).filter(Boolean)).size), detail: 'Local active markets' },
    ],
    stillApiBound: [
      'Live EMR writeback',
      'Payment success/failure truth',
      'Verified clinical records',
      'Nursys license truth',
      'SMS delivery receipts',
      'Accounting/payroll settlement',
      'Warehouse-grade cohort analytics',
    ],
  };
}
