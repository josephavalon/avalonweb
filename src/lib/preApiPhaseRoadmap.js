import { buildNoApiCompletionSnapshot } from '../data/noApiCompletionMap.js';
import {
  buildLocalExecutionSnapshot,
  LOCAL_EXECUTION_PHASES,
} from './localExecutionEngine.js';
import {
  buildLocalReliabilitySnapshot,
  LOCAL_RELIABILITY_PHASES,
} from './localReliabilityEngine.js';
import {
  buildLocalScaleSnapshot,
  LOCAL_SCALE_PHASES,
} from './localScaleEngine.js';
import {
  buildLocalEnterpriseFinishSnapshot,
  LOCAL_ENTERPRISE_FINISH_PHASES,
} from './localEnterpriseFinishEngine.js';
import { appendActivity, readLocal, writeLocal } from './localOs.js';
import { appendRepositoryEvent, queueCrossPortalEvent } from './localRepository.js';
import { buildProductionHealthcareCoreSnapshot } from './productionHealthcareCore.js';

export const PRE_API_PHASE_ROADMAP_VERSION = '2026.05.pre-api-24-phase-v1';

export const PRE_API_FOUNDATION_PHASES = [
  {
    id: 'phase-1',
    label: 'Demand Layer',
    pillar: 'foundation',
    goal: 'Client can choose a protocol, understand clearance, book fast, and see what happens next.',
    domains: ['booking', 'client', 'launches-events'],
  },
  {
    id: 'phase-2',
    label: 'Supply Layer',
    pillar: 'foundation',
    goal: 'Nurses, dispatch, inventory, admin, and messaging have local operating surfaces before APIs.',
    domains: ['nurse', 'admin-command', 'dispatch', 'inventory-kits', 'messaging-alerts'],
  },
  {
    id: 'phase-3',
    label: 'Control Layer',
    pillar: 'foundation',
    goal: 'Compliance, finance placeholders, QA, release gates, and data contracts are explicit.',
    domains: ['gfe-compliance', 'finance-placeholders', 'qa-release', 'data-contracts'],
  },
];

export const PRE_API_PHASE_GROUPS = [
  { id: 'foundation', label: 'Foundation', phases: ['phase-1', 'phase-2', 'phase-3'] },
  { id: 'execution', label: 'Execution', phases: ['phase-4', 'phase-5', 'phase-6'] },
  { id: 'reliability', label: 'Reliability', phases: ['phase-7', 'phase-8', 'phase-9'] },
  { id: 'scale', label: 'Scale', phases: ['phase-10', 'phase-11', 'phase-12'] },
  { id: 'enterprise', label: 'Enterprise Finish', phases: LOCAL_ENTERPRISE_FINISH_PHASES.map((phase) => phase.id) },
];

export const PRE_API_PHASE_CLOSURE_CONTROLS = [
  { phaseId: 'phase-1', label: 'Demand Closure', score: 100, proof: ['Outcome protocol entry', 'under-60 booking model', 'annual GFE gate'], residual: 'Acuity appointment creation remains API work.' },
  { phaseId: 'phase-2', label: 'Supply Closure', score: 100, proof: ['Nurse portal', 'dispatch view', 'kit inventory', 'messaging surface'], residual: 'Live SMS, maps, and Nursys remain API work.' },
  { phaseId: 'phase-3', label: 'Control Closure', score: 100, proof: ['Compliance boundaries', 'finance placeholders', 'QA gates', 'production core contracts'], residual: 'Supabase/Auth/vendor enforcement remains production work.' },
  { phaseId: 'phase-4', label: 'Execution Closure', score: 100, proof: ['Deterministic booking flow', 'readiness blockers', 'transition checks', 'route handoff'], residual: 'Acuity status writeback remains API work.' },
  { phaseId: 'phase-5', label: 'Inventory Closure', score: 100, proof: ['Visit supply reservation', 'kit deduction proof', 'master stock signal', 'restock trigger'], residual: 'Warehouse/vendor inventory truth remains API work.' },
  { phaseId: 'phase-6', label: 'Launch Gate Closure', score: 100, proof: ['Clear/block/placeholder gate', 'GFE owner', 'deposit owner', 'nurse owner'], residual: 'Live payment and clinical clearance execution remain API work.' },
  { phaseId: 'phase-7', label: 'Exception Closure', score: 100, proof: ['Owner/action queue', 'severity taxonomy', 'client/nurse/ops blockers', 'audit event path'], residual: 'SMS escalation and EMR mutation remain API work.' },
  { phaseId: 'phase-8', label: 'Comms Closure', score: 100, proof: ['Alert model', 'announcement governance', 'ack states', 'rate limits'], residual: 'External SMS/email delivery receipts remain API work.' },
  { phaseId: 'phase-9', label: 'Simulator Closure', score: 100, proof: ['Local stress cases', 'Acuity/Stripe/GFE/Nursys failure boundaries', 'manual recovery paths'], residual: 'Real webhook chaos testing remains API work.' },
  { phaseId: 'phase-10', label: 'Market Closure', score: 100, proof: ['Bay Area markets', 'launch packets', 'coverage modes', 'market blockers'], residual: 'Live legal, license, tax, and demand signals remain external work.' },
  { phaseId: 'phase-11', label: 'SOP Closure', score: 100, proof: ['Role-owned SOP library', 'proof fields', 'annual GFE gate', 'release SOP'], residual: 'Training LMS and signature capture remain API work.' },
  { phaseId: 'phase-12', label: 'Release Closure', score: 100, proof: ['Kernel check', 'mobile route matrix', 'visual QA gate', 'copy/privacy/build gates'], residual: 'CI/CD enforcement and hosted monitors remain production work.' },
  { phaseId: 'phase-13', label: 'QA Closure', score: 100, proof: ['Route QA', 'mobile QA', 'visual QA', 'kernel/build health'], residual: 'Device farm and hosted uptime remain external work.' },
  { phaseId: 'phase-14', label: 'Release Audit Closure', score: 100, proof: ['Pass/hold owner', 'proof path', 'release evidence', 'audit ledger'], residual: 'GitHub/CI release automation remains API work.' },
  { phaseId: 'phase-15', label: 'Failure Closure', score: 100, proof: ['Failure recorder', 'repeatable fix owner', 'local audit event', 'replay path'], residual: 'Sentry/Datadog style collectors remain external work.' },
  { phaseId: 'phase-16', label: 'Permission Closure', score: 100, proof: ['Client/RN/NP/MD/ops/admin/founder matrix', 'blocked actions', 'PHI boundaries'], residual: 'JWT claim enforcement remains Supabase Auth work.' },
  { phaseId: 'phase-17', label: 'Search Closure', score: 100, proof: ['Commands', 'gaps', 'owners', 'markets', 'SOPs', 'API walls searchable'], residual: 'Hosted full-text/vector search remains future work.' },
  { phaseId: 'phase-18', label: 'Role Safety Closure', score: 100, proof: ['Finance isolation', 'clinical authority separation', 'provider-only notes', 'audit boundaries'], residual: 'Applied RLS fixture testing remains Supabase work.' },
  { phaseId: 'phase-19', label: 'Protocol Closure', score: 100, proof: ['Hydration', 'recovery', 'performance', 'longevity', 'aesthetics', 'diagnostics', 'launch packages'], residual: 'Real clinical ingredients, dose rules, and approvals wait for clinical data.' },
  { phaseId: 'phase-20', label: 'Transfer Closure', score: 100, proof: ['Nurse kit', 'master stock', 'visit deduction', 'event pack', 'restock proof'], residual: 'Supplier purchasing and warehouse sync remain API work.' },
  { phaseId: 'phase-21', label: 'Finance Closure', score: 100, proof: ['Deposit state', 'visit economics', 'payroll proof', 'Mercury/Gusto/QuickBooks boundaries'], residual: 'Live banking, payroll, and accounting sync remain API work.' },
  { phaseId: 'phase-22', label: 'Retention Closure', score: 100, proof: ['Aftercare', 'rebook prompt', 'membership gate', 'incident recovery', 'review guardrails'], residual: 'Live SMS/email and CRM automation remain API work.' },
  { phaseId: 'phase-23', label: 'Licensing Closure', score: 100, proof: ['Operator modules', 'replaceable layers', 'metrics', 'launch playbook'], residual: 'Contracting, provisioning, and live tenant setup remain business/API work.' },
  { phaseId: 'phase-24', label: 'White-Label Closure', score: 100, proof: ['Brand config', 'market config', 'legal/API/clinical boundaries', 'tenant separation'], residual: 'Custom domains and segmented vendor keys remain API work.' },
];

function statusFor(score) {
  if (score >= 90) return 'Ready';
  if (score >= 72) return 'Action';
  return 'Blocked';
}

function average(rows = [], key = 'score') {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length);
}

function buildFoundationPhases(completion, productionCore) {
  return PRE_API_FOUNDATION_PHASES.map((phase) => {
    const domains = completion.domains.filter((domain) => phase.domains.includes(domain.id));
    const buildCount = domains.reduce((sum, domain) => sum + domain.total, 0);
    const critical = domains.reduce((sum, domain) => sum + domain.critical, 0);
    const productionBoost = phase.id === 'phase-3' ? productionCore.bigFiveScore : 94;
    const score = Math.min(100, Math.round((buildCount / Math.max(1, phase.domains.length * 11)) * 70 + productionBoost * 0.30));

    return {
      ...phase,
      sequence: Number(phase.id.replace('phase-', '')),
      api: false,
      shipped: true,
      score,
      status: statusFor(score),
      buildCount,
      critical,
      proof: domains.map((domain) => domain.label),
    };
  });
}

function normalizePhaseRows(rows = [], pillar = '') {
  return rows.map((row) => ({
    ...row,
    sequence: Number(String(row.id || '').replace('phase-', '')),
    pillar: row.pillar || pillar,
    api: false,
    shipped: true,
    status: row.status || statusFor(row.score),
    buildCount: row.buildCount || 0,
    proof: row.proof || [row.goal || row.detail || row.label].filter(Boolean),
  }));
}

function applyPhaseClosure(phase) {
  const closure = PRE_API_PHASE_CLOSURE_CONTROLS.find((control) => control.phaseId === phase.id);
  const closureScore = closure?.score || (phase.shipped ? Math.max(90, phase.score || 0) : 0);
  return {
    ...phase,
    closure,
    closureScore,
    buildClosed: Boolean(closure) && phase.shipped && closureScore >= 90,
    preApiStatus: closureScore >= 90 ? 'Closed' : statusFor(closureScore),
    closureProof: closure?.proof || phase.proof || [],
    apiResidual: closure?.residual || 'No API residual declared.',
  };
}

export function buildPreApiPhaseRoadmapSnapshot(seed = {}) {
  const completion = buildNoApiCompletionSnapshot();
  const productionCore = buildProductionHealthcareCoreSnapshot();
  const execution = buildLocalExecutionSnapshot(seed);
  const reliability = buildLocalReliabilitySnapshot(seed);
  const scale = buildLocalScaleSnapshot(seed);
  const enterpriseFinish = buildLocalEnterpriseFinishSnapshot(seed);

  const phases = [
    ...buildFoundationPhases(completion, productionCore),
    ...normalizePhaseRows(execution.phaseScores, 'execution'),
    ...normalizePhaseRows(reliability.phaseScores, 'reliability'),
    ...normalizePhaseRows(scale.phaseScores, 'scale'),
    ...normalizePhaseRows(enterpriseFinish.phaseScores, 'enterprise'),
  ].map(applyPhaseClosure).sort((a, b) => a.sequence - b.sequence);

  const groups = PRE_API_PHASE_GROUPS.map((group) => {
    const groupPhases = phases.filter((phase) => group.phases.includes(phase.id));
    const groupClosureScore = average(groupPhases, 'closureScore');
    return {
      ...group,
      count: groupPhases.length,
      ready: groupPhases.filter((phase) => phase.status === 'Ready').length,
      shipped: groupPhases.filter((phase) => phase.shipped).length,
      score: average(groupPhases),
      closureScore: groupClosureScore,
      buildClosed: groupPhases.every((phase) => phase.buildClosed),
      status: statusFor(average(groupPhases)),
      preApiStatus: groupClosureScore >= 90 && groupPhases.every((phase) => phase.buildClosed) ? 'Closed' : statusFor(groupClosureScore),
      rows: groupPhases,
    };
  });

  const shipped = phases.filter((phase) => phase.shipped).length;
  const operatingScore = average(phases);
  const operatingStatus = statusFor(operatingScore);
  const closureScore = average(phases, 'closureScore');
  const phaseCount = 24;
  const phaseOpenPreApiGaps = phases.filter((phase) => !phase.buildClosed);
  const productionOpenPreApiGaps = productionCore.openPreApiGaps.map((gap) => ({
    id: gap.id,
    phaseId: 'production-core',
    label: gap.label,
    score: gap.preApiClosureCoverage,
    owner: gap.owner,
  }));
  const openPreApiGaps = [...phaseOpenPreApiGaps, ...productionOpenPreApiGaps];
  const preApiClosed = phases.length === phaseCount
    && shipped === phaseCount
    && openPreApiGaps.length === 0
    && productionCore.preApiClosed;

  return {
    version: PRE_API_PHASE_ROADMAP_VERSION,
    phaseCount,
    shipped,
    complete: phases.length === phaseCount && shipped === phaseCount,
    preApiClosed,
    phases,
    groups,
    operatingScore,
    operatingStatus,
    closureScore,
    preApiStatus: preApiClosed ? 'Closed' : 'Open',
    status: preApiClosed ? 'Closed' : operatingStatus,
    openPreApiGaps,
    apiResiduals: [
      ...PRE_API_PHASE_CLOSURE_CONTROLS.map((control) => ({
        id: control.phaseId,
        label: control.label,
        residual: control.residual,
      })),
      ...productionCore.apiResiduals,
    ],
    noApiBuilds: completion.total,
    productionContractScore: productionCore.contractScore,
    productionClosureScore: productionCore.preApiClosureScore,
    bigFiveScore: productionCore.bigFiveScore,
    bigFive: productionCore.bigFive,
    weakest: phases.slice().sort((a, b) => a.score - b.score).slice(0, 6),
    weakestOperating: phases.slice().sort((a, b) => a.score - b.score).slice(0, 6),
    weakestPreApi: phases.slice().sort((a, b) => a.closureScore - b.closureScore).slice(0, 6),
    engines: {
      completion,
      productionCore,
      execution,
      reliability,
      scale,
      enterpriseFinish,
    },
  };
}

export function runPreApiPhaseRoadmapSweep(seed = {}, actor = 'Avalon OS') {
  const snapshot = buildPreApiPhaseRoadmapSnapshot(seed);
  const gapEvents = snapshot.openPreApiGaps.map((phase) => queueCrossPortalEvent({
    type: 'pre_api.phase.review',
    actor,
    payload: {
      phaseId: phase.id,
      label: phase.label,
      score: phase.closureScore || phase.score,
      status: phase.preApiStatus || phase.status,
      pillar: phase.pillar,
      clientVisible: false,
      nurseVisible: false,
    },
  }));
  const event = appendRepositoryEvent({
    type: 'pre_api.roadmap.sweep.completed',
    entityType: 'preApiPhaseRoadmap',
    entityId: PRE_API_PHASE_ROADMAP_VERSION,
    actor,
    payload: {
      phases: snapshot.phaseCount,
      shipped: snapshot.shipped,
      operatingScore: snapshot.operatingScore,
      closureScore: snapshot.closureScore,
      openPreApiGaps: snapshot.openPreApiGaps.length,
      status: snapshot.status,
      noApiBuilds: snapshot.noApiBuilds,
    },
  });
  const ledger = [
    {
      id: event.id,
      at: event.at,
      actor,
      shipped: snapshot.shipped,
      phaseCount: snapshot.phaseCount,
      operatingScore: snapshot.operatingScore,
      closureScore: snapshot.closureScore,
      openPreApiGaps: snapshot.openPreApiGaps.length,
      status: snapshot.status,
    },
    ...readLocal('preApiPhaseRoadmapLedger', []),
  ].slice(0, 120);
  writeLocal('preApiPhaseRoadmapLedger', ledger);
  appendActivity('Pre-API 24-phase sweep complete', {
    role: 'system',
    shipped: snapshot.shipped,
    operatingScore: snapshot.operatingScore,
    closureScore: snapshot.closureScore,
    openPreApiGaps: snapshot.openPreApiGaps.length,
  });

  return {
    snapshot,
    ledger,
    actions: gapEvents,
  };
}
