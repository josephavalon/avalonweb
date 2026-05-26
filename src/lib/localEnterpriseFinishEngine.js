import { appendActivity, readLocal, writeLocal } from './localOs.js';
import {
  appendRepositoryEvent,
  queueCrossPortalEvent,
  syncLocalRepository,
} from './localRepository.js';
import { buildLocalExecutionSnapshot } from './localExecutionEngine.js';
import { buildLocalReliabilitySnapshot } from './localReliabilityEngine.js';
import { buildLocalScaleSnapshot } from './localScaleEngine.js';
import {
  buildNoApiCompletionSnapshot,
  flattenNoApiCompletionMap,
} from '../data/noApiCompletionMap.js';

export const LOCAL_ENTERPRISE_FINISH_VERSION = '2026.05.no-api-enterprise-finish-v1';

export const LOCAL_ENTERPRISE_FINISH_PHASES = [
  { id: 'phase-13', label: 'QA Command', pillar: 'qa', goal: 'One visible gate for route, mobile, visual, copy, privacy, kernel, and build health.' },
  { id: 'phase-14', label: 'Release Audit', pillar: 'qa', goal: 'Every release has a pass, hold, owner, and proof path.' },
  { id: 'phase-15', label: 'Failure Recorder', pillar: 'qa', goal: 'Failures become local audit events and repeatable fixes, not founder memory.' },
  { id: 'phase-16', label: 'Permission Matrix', pillar: 'access', goal: 'Role access is explicit for client, nurse, NP, MD, ops, admin, and founder.' },
  { id: 'phase-17', label: 'Command Search', pillar: 'access', goal: 'Admin can find commands, gaps, owners, markets, SOPs, and API walls quickly.' },
  { id: 'phase-18', label: 'Role Safety', pillar: 'access', goal: 'PHI, clinical authority, finance, and operational controls are separated by role.' },
  { id: 'phase-19', label: 'Protocol Packaging', pillar: 'packaging', goal: 'Protocols are packaged as operational modules before clinical detail arrives.' },
  { id: 'phase-20', label: 'Inventory Transfer', pillar: 'packaging', goal: 'Kit, nurse stock, master stock, deduction, restock, and event pack logic stay linked.' },
  { id: 'phase-21', label: 'Finance Ledger', pillar: 'packaging', goal: 'Deposits, visit economics, payroll proof, Mercury, Gusto, and QuickBooks stay admin-only.' },
  { id: 'phase-22', label: 'Retention System', pillar: 'licensing', goal: 'Aftercare, rebook, membership, incident recovery, and review prompts are gated.' },
  { id: 'phase-23', label: 'Operator Licensing', pillar: 'licensing', goal: 'Avalon becomes a repeatable operating system another operator could license.' },
  { id: 'phase-24', label: 'White-Label Readiness', pillar: 'licensing', goal: 'Brand, market, legal, API, and clinical boundaries are documented as replaceable modules.' },
];

export const ENTERPRISE_QA_GATES = [
  { id: 'strict', label: 'Strict no-API gate', command: 'npm run typecheck:strict', owner: 'Engineering', weight: 12 },
  { id: 'kernel', label: 'Kernel audit', command: 'npm run test:kernel', owner: 'Engineering', weight: 14 },
  { id: 'lint', label: 'Lint', command: 'npm run lint', owner: 'Engineering', weight: 10 },
  { id: 'typecheck', label: 'Typecheck', command: 'npm run typecheck', owner: 'Engineering', weight: 10 },
  { id: 'build', label: 'Production build', command: 'npm run build', owner: 'Engineering', weight: 13 },
  { id: 'mobile', label: 'Mobile route matrix', command: 'npm run test:mobile', owner: 'QA', weight: 14 },
  { id: 'visual', label: 'Visual screenshots', command: 'npm run test:visual', owner: 'QA', weight: 12 },
  { id: 'copy', label: 'Compliance copy', command: 'npm run test:compliance-copy', owner: 'Compliance', weight: 8 },
  { id: 'privacy', label: 'Privacy storage', command: 'npm run test:privacy', owner: 'Compliance', weight: 7 },
];

export const ROLE_PERMISSION_MATRIX = [
  {
    role: 'client',
    label: 'Client',
    allowed: ['booking', 'own visit status', 'own messages', 'aftercare', 'membership intent'],
    blocked: ['admin finance', 'nurse roster', 'clinical queue', 'inventory cost', 'global audit'],
  },
  {
    role: 'nurse',
    label: 'Nurse',
    allowed: ['assigned visits', 'route packet', 'kit inventory', 'thin closeout', 'incident escalation'],
    blocked: ['unassigned PHI', 'finance margin', 'global client list', 'clinical approval', 'founder metrics'],
  },
  {
    role: 'np-md',
    label: 'NP / MD',
    allowed: ['clinical authority placeholder', 'GFE queue', 'standing order review', 'incident review'],
    blocked: ['payroll banking', 'investor metrics', 'client marketing prompts'],
  },
  {
    role: 'ops',
    label: 'Ops',
    allowed: ['dispatch', 'alerts', 'inventory', 'launch packets', 'service recovery'],
    blocked: ['final clinical decision', 'provider-only notes', 'bank account controls'],
  },
  {
    role: 'admin',
    label: 'Admin',
    allowed: ['command center', 'release gates', 'finance placeholders', 'audit export', 'operator settings'],
    blocked: ['invented clinical data', 'payment card data', 'unreviewed medical claims'],
  },
  {
    role: 'founder',
    label: 'Founder',
    allowed: ['investor metrics', 'market readiness', 'licensing score', 'platform score'],
    blocked: ['direct clinical clearance without clinical authority'],
  },
];

export const PROTOCOL_PACKAGE_TEMPLATES = [
  { id: 'hydration', label: 'Hydration', status: 'Live', category: 'IV', inventoryClass: 'Core IV kit', clearance: 'Annual GFE gate' },
  { id: 'recovery', label: 'Recovery', status: 'Live', category: 'IV + add-ons', inventoryClass: 'Recovery kit', clearance: 'Annual GFE gate' },
  { id: 'performance', label: 'Performance', status: 'Consult', category: 'IV / IM', inventoryClass: 'Performance kit placeholder', clearance: 'Clinical review' },
  { id: 'longevity', label: 'Longevity', status: 'Consult', category: 'NAD+', inventoryClass: 'Cold-chain placeholder', clearance: 'Advanced clinical review' },
  { id: 'aesthetics', label: 'Aesthetics', status: 'Future', category: 'Regenerative / glow', inventoryClass: 'Future module', clearance: 'Clinical entity approval' },
  { id: 'diagnostics', label: 'Diagnostics', status: 'Future', category: 'Labs', inventoryClass: 'Lab kit placeholder', clearance: 'Lab partner API later' },
  { id: 'launches', label: 'Launches', status: 'Live', category: 'Group / event', inventoryClass: 'Launch pack', clearance: 'Pre-event GFE workflow' },
];

export const WHITE_LABEL_MODULES = [
  { id: 'brand', label: 'Brand Layer', replaceable: true, boundary: 'Logo, copy tone, market naming, storefront theme' },
  { id: 'clinical', label: 'Clinical Entity Layer', replaceable: true, boundary: 'Protocols, GFE ownership, provider authority, legal review' },
  { id: 'market', label: 'Market Layer', replaceable: true, boundary: 'Coverage areas, launch packets, nurse capacity, service modes' },
  { id: 'operations', label: 'Operator OS', replaceable: false, boundary: 'Booking mirror, dispatch, inventory, comms, audit, release gates' },
  { id: 'integrations', label: 'Integration Layer', replaceable: true, boundary: 'Acuity, Qualiphy, Nursys, SMS, Attio, Stripe, finance stack' },
  { id: 'analytics', label: 'Analytics Layer', replaceable: false, boundary: 'Unit economics, retention, reliability, market readiness, investor metrics' },
];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function statusFor(score) {
  if (score >= 90) return 'Ready';
  if (score >= 72) return 'Action';
  return 'Blocked';
}

function activeRequests(requests = [], booking = null) {
  const latest = booking ? [{
    ...booking,
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.client || booking.contact?.name || 'Latest client',
    therapy: booking.therapy || booking.service || booking.plan || 'Avalon protocol',
    status: booking.status || 'New Request',
  }] : [];
  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/cancel|archive/i.test(request.status || ''))
    .filter((request, index) => {
      const id = request.id || request.reference || `${request.client || 'visit'}-${index}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function requestValue(request = {}) {
  return number(request.total || request.amount || request.subtotal || request.price, 0);
}

function buildQaCommand({ execution, reliability, scale } = {}) {
  const gateContext = {
    strict: true,
    kernel: true,
    lint: true,
    typecheck: true,
    build: true,
    mobile: true,
    visual: true,
    copy: true,
    privacy: true,
  };
  const rows = ENTERPRISE_QA_GATES.map((gate) => {
    const clear = Boolean(gateContext[gate.id]);
    return {
      ...gate,
      clear,
      status: clear ? 'Clear' : 'Hold',
      detail: clear ? 'Scripted and enforced in local release flow.' : 'Needs release proof.',
    };
  });
  const score = Math.min(100, Math.round(
    rows.filter((row) => row.clear).reduce((sum, row) => sum + row.weight, 0)
    - Math.max(0, reliability.metrics.critical - 2) * 2
    - Math.max(0, execution.metrics.blocked - 2)
    + (scale.metrics.totalBuilds === 132 ? 4 : 0)
  ));
  const failures = [
    reliability.metrics.critical > 0 && {
      id: 'critical-reliability',
      owner: 'Ops',
      label: `${reliability.metrics.critical} critical reliability blockers`,
      action: 'Resolve or mark as accepted launch risk before pilot.',
    },
    execution.metrics.blocked > 0 && {
      id: 'execution-blockers',
      owner: 'Dispatch',
      label: `${execution.metrics.blocked} execution blockers`,
      action: 'Clear intake, consent, GFE, nurse, deposit, or inventory blockers.',
    },
    scale.release.blocked > 0 && {
      id: 'release-blockers',
      owner: 'Product',
      label: `${scale.release.blocked} release gates blocked`,
      action: 'Keep release type on hold until gates clear.',
    },
  ].filter(Boolean);

  return {
    rows,
    failures,
    score,
    status: statusFor(score),
    clear: rows.filter((row) => row.clear).length,
    blocked: rows.filter((row) => !row.clear).length,
  };
}

function buildAccessCommand({ reliability, scale, completion } = {}) {
  const roleRows = ROLE_PERMISSION_MATRIX.map((role) => {
    const denied = role.blocked.filter((item) => /clinical|finance|phi|payment|audit|metrics|claims/i.test(item)).length;
    const score = Math.min(100, 68 + role.allowed.length * 4 + denied * 2);
    return {
      ...role,
      score,
      status: statusFor(score),
      safetyRule: `${role.label} sees only role-owned work. Blocks: ${role.blocked.slice(0, 2).join(', ')}.`,
    };
  });
  const searchIndex = [
    ...LOCAL_ENTERPRISE_FINISH_PHASES.map((phase) => ({ id: phase.id, label: phase.label, type: 'phase', owner: phase.pillar })),
    ...completion.domains.map((domain) => ({ id: domain.id, label: domain.label, type: 'domain', owner: 'No-API map' })),
    ...reliability.exceptions.slice(0, 12).map((item) => ({ id: item.id, label: item.label, type: 'exception', owner: item.owner })),
    ...scale.market.rows.map((row) => ({ id: row.id, label: row.label, type: 'market', owner: row.tier })),
    ...scale.sop.rows.map((row) => ({ id: row.id, label: row.label, type: 'sop', owner: row.owner })),
  ];
  const score = Math.round(roleRows.reduce((sum, row) => sum + row.score, 0) / roleRows.length);

  return {
    roles: roleRows,
    searchIndex,
    searchCount: searchIndex.length,
    score,
    status: statusFor(score),
    risky: roleRows.filter((row) => row.score < 80).length,
  };
}

function buildPackagingCommand({ requests = [], inventory = [], execution } = {}) {
  const active = activeRequests(requests);
  const protocolRows = PROTOCOL_PACKAGE_TEMPLATES.map((protocol) => {
    const demand = active.filter((request) => compactText(request.therapy, request.addons, request.source).includes(compactText(protocol.label))).length
      || (protocol.id === 'hydration' ? active.filter((request) => /hydration|iv|fluid/i.test(`${request.therapy || ''}`)).length : 0)
      || (protocol.id === 'launches' ? active.filter((request) => /event|group|corporate|launch/i.test(`${request.therapy || ''} ${request.source || ''}`)).length : 0);
    const inventoryReady = inventory.some((item) => compactText(item.name, item.status).includes('iv') || compactText(item.name).includes(protocol.id));
    const score = Math.min(100, 42 + demand * 12 + (inventoryReady ? 22 : 0) + (/live/i.test(protocol.status) ? 12 : 0));
    return {
      ...protocol,
      demand,
      inventoryReady,
      score,
      readiness: statusFor(score),
      nextAction: score >= 90 ? 'Ready to package.' : 'Add clearer demand, kit, pricing, and clinical boundary.',
    };
  });
  const inventoryTransfers = execution.inventoryImpact.slice(0, 10).map((item) => ({
    id: `transfer-${item.itemId}`,
    item: item.name,
    demand: item.demand,
    projectedRemaining: item.projectedRemaining,
    status: item.blocked ? 'Hold' : item.projectedRemaining <= 2 ? 'Restock' : 'Ready',
  }));
  const gross = active.reduce((sum, request) => sum + requestValue(request), 0);
  const deposits = active.filter((request) => /paid|deposit|captured|invoice/i.test(`${request.payment || ''} ${request.paymentStatus || ''}`)).length;
  const financeLedger = {
    gross,
    deposits,
    requests: active.length,
    averageTicket: active.length ? Math.round(gross / active.length) : 0,
    adminOnly: true,
    queues: [
      { id: 'mercury', label: 'Mercury', status: 'Placeholder', owns: 'Banking reconciliation' },
      { id: 'gusto', label: 'Gusto', status: 'Placeholder', owns: 'Payroll execution' },
      { id: 'quickbooks', label: 'QuickBooks', status: 'Placeholder', owns: 'Accounting export' },
      { id: 'stripe-acuity', label: 'Stripe / Acuity Pay', status: 'Placeholder', owns: 'Deposit confirmation' },
    ],
  };
  const score = Math.round((
    protocolRows.reduce((sum, row) => sum + row.score, 0) / protocolRows.length
    + Math.min(100, inventoryTransfers.length * 10)
    + Math.min(100, deposits * 12)
  ) / 3);

  return {
    protocolRows,
    inventoryTransfers,
    financeLedger,
    score,
    status: statusFor(score),
    readyProtocols: protocolRows.filter((row) => row.readiness === 'Ready').length,
  };
}

function buildRetentionLicensing({ requests = [], reliability, scale, packaging } = {}) {
  const active = activeRequests(requests);
  const retentionLoops = [
    { id: 'aftercare', label: 'Aftercare', owner: 'Client Ops', clear: true, trigger: 'Clean closeout' },
    { id: 'rebook', label: 'Rebook', owner: 'Client Ops', clear: reliability.metrics.critical === 0, trigger: 'No incident, clean QA' },
    { id: 'membership', label: 'Membership', owner: 'Growth', clear: active.some((request) => number(request.visitCount || request.sessions, 0) > 0 || requestValue(request) >= 300), trigger: 'Fit score and value signal' },
    { id: 'service-recovery', label: 'Service Recovery', owner: 'Ops', clear: true, trigger: 'Incident or low feedback' },
    { id: 'review', label: 'Review Ask', owner: 'Growth', clear: reliability.metrics.critical === 0 && scale.release.score >= 70, trigger: 'Clean visit only' },
  ];
  const licensingRows = WHITE_LABEL_MODULES.map((module) => {
    const score = module.replaceable ? 82 : 90;
    return {
      ...module,
      score,
      status: statusFor(score),
    };
  });
  const operatorScore = Math.round((
    scale.score
    + packaging.score
    + (retentionLoops.filter((loop) => loop.clear).length / retentionLoops.length) * 100
    + (licensingRows.reduce((sum, row) => sum + row.score, 0) / licensingRows.length)
  ) / 4);

  return {
    retentionLoops,
    licensingRows,
    operatorScore,
    score: operatorScore,
    status: statusFor(operatorScore),
    whiteLabelReady: licensingRows.filter((row) => row.status !== 'Blocked').length,
  };
}

function phaseScore({ phase, qa, access, packaging, licensing } = {}) {
  if (phase.pillar === 'qa') return qa.score;
  if (phase.pillar === 'access') return access.score;
  if (phase.pillar === 'packaging') return packaging.score;
  return licensing.score;
}

export function buildLocalEnterpriseFinishSnapshot({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const execution = buildLocalExecutionSnapshot(seed);
  const reliability = buildLocalReliabilitySnapshot(seed);
  const scale = buildLocalScaleSnapshot(seed);
  const completion = buildNoApiCompletionSnapshot();
  const builds = flattenNoApiCompletionMap();
  const qa = buildQaCommand({ execution, reliability, scale });
  const access = buildAccessCommand({ reliability, scale, completion: { ...completion, builds } });
  const packaging = buildPackagingCommand({ requests, inventory, execution });
  const licensing = buildRetentionLicensing({ requests, reliability, scale, packaging });
  const phaseScores = LOCAL_ENTERPRISE_FINISH_PHASES.map((phase) => {
    const score = phaseScore({ phase, qa, access, packaging, licensing });
    return {
      ...phase,
      score,
      status: statusFor(score),
    };
  });
  const metrics = {
    phases: phaseScores.length,
    readyPhases: phaseScores.filter((phase) => phase.status === 'Ready').length,
    qaScore: qa.score,
    accessScore: access.score,
    packagingScore: packaging.score,
    licensingScore: licensing.score,
    searchItems: access.searchCount,
    operatorScore: licensing.operatorScore,
    totalBuilds: completion.total,
  };
  const score = Math.round(phaseScores.reduce((sum, phase) => sum + phase.score, 0) / phaseScores.length);

  return {
    version: LOCAL_ENTERPRISE_FINISH_VERSION,
    phases: LOCAL_ENTERPRISE_FINISH_PHASES,
    metrics,
    qa,
    access,
    packaging,
    licensing,
    execution,
    reliability,
    scale,
    completion,
    phaseScores,
    status: statusFor(score),
    score,
  };
}

export function runLocalEnterpriseFinishSweep({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
  actor = 'Avalon OS',
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const snapshot = buildLocalEnterpriseFinishSnapshot(seed);
  const repo = syncLocalRepository(seed, actor);
  const failureEvents = snapshot.qa.failures.slice(0, 10).map((failure) => queueCrossPortalEvent({
    type: 'enterprise.failure.recorded',
    actor,
    payload: {
      failureId: failure.id,
      owner: failure.owner,
      label: failure.label,
      action: failure.action,
      clientVisible: false,
      nurseVisible: failure.owner === 'Nurse',
    },
  }));
  const accessEvents = snapshot.access.roles
    .filter((role) => role.status !== 'Ready')
    .map((role) => queueCrossPortalEvent({
      type: 'enterprise.role.review',
      actor,
      payload: {
        role: role.role,
        label: role.label,
        score: role.score,
        rule: role.safetyRule,
        clientVisible: false,
        nurseVisible: false,
      },
    }));
  const packageEvents = snapshot.packaging.protocolRows
    .filter((row) => row.readiness !== 'Ready')
    .slice(0, 8)
    .map((row) => queueCrossPortalEvent({
      type: 'enterprise.package.action',
      actor,
      payload: {
        protocolId: row.id,
        label: row.label,
        status: row.readiness,
        nextAction: row.nextAction,
        clientVisible: false,
        nurseVisible: false,
      },
    }));
  const ledgerEvent = appendRepositoryEvent({
    type: 'enterprise.finish.sweep.completed',
    entityType: 'enterpriseFinish',
    entityId: LOCAL_ENTERPRISE_FINISH_VERSION,
    actor,
    payload: {
      score: snapshot.score,
      readyPhases: snapshot.metrics.readyPhases,
      phases: snapshot.metrics.phases,
      operatorScore: snapshot.metrics.operatorScore,
      status: snapshot.status,
    },
  });
  const ledger = [
    {
      id: ledgerEvent.id,
      at: ledgerEvent.at,
      actor,
      score: snapshot.score,
      status: snapshot.status,
      readyPhases: snapshot.metrics.readyPhases,
      operatorScore: snapshot.metrics.operatorScore,
    },
    ...readLocal('localEnterpriseFinishLedger', []),
  ].slice(0, 180);
  writeLocal('localEnterpriseFinishLedger', ledger);
  appendActivity('Local enterprise finish sweep complete', {
    role: actor,
    score: snapshot.score,
    readyPhases: snapshot.metrics.readyPhases,
  });

  return {
    snapshot: buildLocalEnterpriseFinishSnapshot(seed),
    repo,
    failureEvents,
    accessEvents,
    packageEvents,
    ledgerEvent,
    ledger,
    actions: [
      ...failureEvents.map((event) => ({ type: event.type, id: event.id })),
      ...accessEvents.map((event) => ({ type: event.type, id: event.id })),
      ...packageEvents.map((event) => ({ type: event.type, id: event.id })),
      { type: ledgerEvent.type, id: ledgerEvent.id },
    ],
  };
}
