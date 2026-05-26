import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveGfeRequirement,
  validateTransition,
} from '../src/lib/bookingLifecycle.js';
import {
  buildNoApiCompletionSnapshot,
  NO_API_COMPLETION_TOTAL,
} from '../src/data/noApiCompletionMap.js';
import {
  buildEnterpriseArchitectureSnapshot,
  ENTERPRISE_PLATFORM_GOAL,
} from '../src/data/enterpriseArchitecture.js';
import {
  buildClinicalPlaceholderSnapshot,
  CLINICAL_DATA_MODE,
} from '../src/data/clinicalPlaceholderPolicy.js';
import {
  buildEnterpriseSpineSnapshot,
  CANONICAL_DATA_CONTRACTS,
  ENTERPRISE_CLINICAL_MODE,
} from '../src/lib/enterpriseSpine.js';
import {
  API_BOUND_HANDOFFS,
  buildNoApiCapabilitySnapshot,
  NO_API_GATE_RULE,
} from '../src/lib/noApiCapabilityGate.js';
import {
  buildCrossPortalSyncSnapshot,
  buildLocalRepositorySnapshot,
  buildRoleSafeRepositorySnapshot,
  buildUnifiedOperationalTruth,
  LOCAL_ENTITY_SCHEMAS,
  LOCAL_EVENT_LEDGER_VERSION,
  LOCAL_REPOSITORY_ENTITIES,
  LOCAL_REPOSITORY_VERSION,
  LOCAL_SCHEMA_VERSION,
} from '../src/lib/localRepository.js';
import {
  buildDispatchBrainSnapshot,
  DISPATCH_BRAIN_VERSION,
  DISPATCH_SCORE_FACTORS,
  scoreDispatchCandidate,
} from '../src/lib/dispatchBrain.js';
import {
  buildSupplyBrainSnapshot,
  buildVisitSupplyReservation,
  SUPPLY_BRAIN_RULES,
  SUPPLY_BRAIN_VERSION,
} from '../src/lib/supplyBrain.js';
import {
  buildProviderCompetencySnapshot,
  PROVIDER_COMPETENCY_RULES,
  PROVIDER_COMPETENCY_VERSION,
  scoreProviderCompetency,
} from '../src/lib/providerCompetencyBrain.js';
import {
  buildShiftMarketplaceSnapshot,
  buildShiftOffer,
  SHIFT_MARKETPLACE_RULES,
  SHIFT_MARKETPLACE_VERSION,
} from '../src/lib/shiftMarketplaceBrain.js';
import {
  ARRIVAL_MISSION_RULES,
  ARRIVAL_MISSION_VERSION,
  buildArrivalMission,
  buildArrivalMissionSnapshot,
} from '../src/lib/arrivalMissionBrain.js';
import {
  buildVisitCloseout,
  buildVisitCloseoutSnapshot,
  VISIT_CLOSEOUT_RULES,
  VISIT_CLOSEOUT_VERSION,
} from '../src/lib/visitCloseoutBrain.js';
import {
  buildKitReconciliation,
  buildKitReconciliationSnapshot,
  KIT_RECONCILIATION_RULES,
  KIT_RECONCILIATION_VERSION,
} from '../src/lib/kitReconciliationBrain.js';
import {
  buildPostVisitQaRow,
  buildPostVisitQualitySnapshot,
  POST_VISIT_QA_RULES,
  POST_VISIT_QA_VERSION,
} from '../src/lib/postVisitQualityBrain.js';
import {
  buildLocalExecutionSnapshot,
  LOCAL_EXECUTION_ENGINE_VERSION,
  LOCAL_EXECUTION_PHASES,
} from '../src/lib/localExecutionEngine.js';
import {
  buildLocalReliabilitySnapshot,
  LOCAL_RELIABILITY_ENGINE_VERSION,
  LOCAL_RELIABILITY_PHASES,
  RELIABILITY_API_BOUNDARIES,
} from '../src/lib/localReliabilityEngine.js';
import {
  buildLocalScaleSnapshot,
  LOCAL_SCALE_ENGINE_VERSION,
  LOCAL_SCALE_PHASES,
  SCALE_MARKETS,
  SCALE_SOP_LIBRARY,
} from '../src/lib/localScaleEngine.js';
import {
  buildLocalEnterpriseFinishSnapshot,
  ENTERPRISE_QA_GATES,
  LOCAL_ENTERPRISE_FINISH_PHASES,
  LOCAL_ENTERPRISE_FINISH_VERSION,
  PROTOCOL_PACKAGE_TEMPLATES,
  ROLE_PERMISSION_MATRIX,
  WHITE_LABEL_MODULES,
} from '../src/lib/localEnterpriseFinishEngine.js';
import {
  BIG_FIVE_REAL_GAPS,
  buildProductionHealthcareCoreSnapshot,
  PRE_API_HEALTHCARE_GAP_CLOSURES,
  PRODUCTION_CORE_DOMAINS,
  PRODUCTION_CORE_MIGRATION,
  PRODUCTION_CORE_RLS_FAMILIES,
  PRODUCTION_HEALTHCARE_CORE_VERSION,
} from '../src/lib/productionHealthcareCore.js';
import {
  buildPreApiPhaseRoadmapSnapshot,
  PRE_API_FOUNDATION_PHASES,
  PRE_API_PHASE_CLOSURE_CONTROLS,
  PRE_API_PHASE_GROUPS,
  PRE_API_PHASE_ROADMAP_VERSION,
} from '../src/lib/preApiPhaseRoadmap.js';

const root = process.cwd();
const kernelPath = path.join(root, 'src/lib/avalonKernel.js');
const noApiPath = path.join(root, 'src/lib/noApiReadiness.js');
const enterprisePath = path.join(root, 'src/data/enterpriseArchitecture.js');
const enterpriseSpinePath = path.join(root, 'src/lib/enterpriseSpine.js');
const noApiGatePath = path.join(root, 'src/lib/noApiCapabilityGate.js');
const localRepositoryPath = path.join(root, 'src/lib/localRepository.js');
const dispatchBrainPath = path.join(root, 'src/lib/dispatchBrain.js');
const supplyBrainPath = path.join(root, 'src/lib/supplyBrain.js');
const providerCompetencyPath = path.join(root, 'src/lib/providerCompetencyBrain.js');
const shiftMarketplacePath = path.join(root, 'src/lib/shiftMarketplaceBrain.js');
const arrivalMissionPath = path.join(root, 'src/lib/arrivalMissionBrain.js');
const visitCloseoutPath = path.join(root, 'src/lib/visitCloseoutBrain.js');
const kitReconciliationPath = path.join(root, 'src/lib/kitReconciliationBrain.js');
const postVisitQualityPath = path.join(root, 'src/lib/postVisitQualityBrain.js');
const localExecutionPath = path.join(root, 'src/lib/localExecutionEngine.js');
const localReliabilityPath = path.join(root, 'src/lib/localReliabilityEngine.js');
const localScalePath = path.join(root, 'src/lib/localScaleEngine.js');
const localEnterpriseFinishPath = path.join(root, 'src/lib/localEnterpriseFinishEngine.js');
const productionHealthcareCorePath = path.join(root, 'src/lib/productionHealthcareCore.js');
const preApiPhaseRoadmapPath = path.join(root, 'src/lib/preApiPhaseRoadmap.js');
const productionHealthcareMigrationPath = path.join(root, 'supabase/migrations/003_healthcare_os_core.sql');
const clinicalPolicyPath = path.join(root, 'src/data/clinicalPlaceholderPolicy.js');
const adminMockPath = path.join(root, 'src/data/adminMockData.js');
const adminPath = path.join(root, 'src/pages/admin/Command.jsx');
const memberPath = path.join(root, 'src/pages/members/Dashboard.jsx');
const nursePath = path.join(root, 'src/pages/provider/NurseDashboard.jsx');

function readWithReexports(filePath, seen = new Set()) {
  if (seen.has(filePath)) return '';
  seen.add(filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const reexportText = [...text.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)]
    .map((match) => readWithReexports(path.resolve(dir, match[1]), seen))
    .join('\n');
  return `${text}\n${reexportText}`;
}

const kernel = readWithReexports(kernelPath);
const noApi = readWithReexports(noApiPath);
const enterprise = readWithReexports(enterprisePath);
const enterpriseSpine = readWithReexports(enterpriseSpinePath);
const noApiGate = readWithReexports(noApiGatePath);
const localRepository = readWithReexports(localRepositoryPath);
const dispatchBrain = readWithReexports(dispatchBrainPath);
const supplyBrain = readWithReexports(supplyBrainPath);
const providerCompetency = readWithReexports(providerCompetencyPath);
const shiftMarketplace = readWithReexports(shiftMarketplacePath);
const arrivalMission = readWithReexports(arrivalMissionPath);
const visitCloseout = readWithReexports(visitCloseoutPath);
const kitReconciliation = readWithReexports(kitReconciliationPath);
const postVisitQuality = readWithReexports(postVisitQualityPath);
const localExecution = readWithReexports(localExecutionPath);
const localReliability = readWithReexports(localReliabilityPath);
const localScale = readWithReexports(localScalePath);
const localEnterpriseFinish = readWithReexports(localEnterpriseFinishPath);
const productionHealthcareCore = readWithReexports(productionHealthcareCorePath);
const preApiPhaseRoadmap = readWithReexports(preApiPhaseRoadmapPath);
const productionHealthcareMigration = readWithReexports(productionHealthcareMigrationPath);
const clinicalPolicy = readWithReexports(clinicalPolicyPath);
const adminMock = readWithReexports(adminMockPath);
const admin = readWithReexports(adminPath);
const member = readWithReexports(memberPath);
const nurse = readWithReexports(nursePath);

const buildItemLines = kernel
  .split('\n')
  .filter((line) => /^\s+\['[a-z0-9-]+',/.test(line));

assert.equal(buildItemLines.length, 60, 'Avalon Kernel must expose the first 60 build items.');

[
  'buildAvalonKernelSnapshot',
  'buildKernelExceptions',
  'buildProtocolRegistry',
  'buildKernelKitReadiness',
  'scoreNurseEligibility',
  'setKernelNurseEta',
  'saveThinChart',
  'lockThinChart',
  'addChartAddendum',
  'estimateVisitEconomics',
  'estimateRefundState',
  'buildClientTracker',
  'estimateLaunchCapacity',
  'buildQrRedemptionPlaceholder',
  'buildGroupIntakePlan',
  'buildFollowUpRecommendation',
  'buildFounderCommandIntelligence',
  'buildComplianceCopyControls',
  'exportKernelAudit',
  'buildKernelSystemHealth',
  'forecastDemand',
  'buildCoverageMatrix',
  'scoreServiceArea',
  'checkPriceIntegrity',
  'buildDepositGate',
  'scoreCheckoutFriction',
  'recommendProtocol',
  'evaluateAddonGuardrails',
  'scoreMembershipFit',
  'updateSubscriptionControl',
  'buildClientRiskFlags',
  'checkConsentCompleteness',
  'buildIdentityVerificationPlaceholder',
  'buildNurseRoutePacket',
  'buildMissionPacket',
  'queueOfflineKernelAction',
  'readOfflineKernelQueue',
  'buildNotificationPreferenceCenter',
  'buildAnnouncementGovernance',
  'buildBroadcastRateLimit',
  'triageCommsInbox',
  'buildEscalationLadder',
  'scoreShiftOfferFairness',
  'buildFatigueGuard',
  'forecastCredentialExpiry',
  'buildTrainingGate',
  'forecastInventoryExpiry',
  'buildColdChainPlaceholder',
  'addWasteLog',
  'buildIncidentPacket',
  'scorePostVisitQa',
].forEach((name) => assert.match(kernel, new RegExp(`export function ${name}\\b`), `${name} is missing.`));

assert.match(admin, /AvalonKernelPanel/, 'Admin command center must surface the kernel.');
assert.match(admin, /exportKernelAudit/, 'Admin command center must expose audit export.');
assert.match(admin, /Scale Controls/, 'Admin command center must surface the second kernel batch.');
assert.match(admin, /NoApiReadinessPanel/, 'Admin command center must surface no-API readiness.');
assert.match(admin, /NoApiScalePanel/, 'Admin command center must surface no-API scale readiness.');
assert.match(admin, /NoApiCompletionPanel/, 'Admin command center must surface the 132 no-API completion map.');
assert.match(admin, /EnterpriseArchitecturePanel/, 'Admin command center must surface the enterprise architecture.');
assert.match(admin, /ClinicalPlaceholderBoundaryPanel/, 'Admin command center must surface clinical placeholder boundaries.');
assert.match(admin, /EnterpriseSpinePanel/, 'Admin command center must surface the enterprise spine.');
assert.match(admin, /NoApiCapabilityGatePanel/, 'Admin command center must surface the no-API capability gate.');
assert.match(admin, /LocalRepositoryPanel/, 'Admin command center must surface the local repository.');
assert.match(admin, /DispatchBrainPanel/, 'Admin command center must surface the dispatch brain.');
assert.match(admin, /SupplyBrainPanel/, 'Admin command center must surface the supply brain.');
assert.match(admin, /ProviderCompetencyPanel/, 'Admin command center must surface the provider competency brain.');
assert.match(admin, /ShiftMarketplacePanel/, 'Admin command center must surface the shift marketplace brain.');
assert.match(admin, /ArrivalMissionPanel/, 'Admin command center must surface the arrival mission brain.');
assert.match(admin, /VisitCloseoutPanel/, 'Admin command center must surface the visit closeout brain.');
assert.match(admin, /KitReconciliationPanel/, 'Admin command center must surface the kit reconciliation brain.');
assert.match(admin, /PostVisitQualityPanel/, 'Admin command center must surface the post-visit QA brain.');
assert.match(admin, /LocalExecutionEnginePanel/, 'Admin command center must surface the local execution engine.');
assert.match(admin, /LocalReliabilityPanel/, 'Admin command center must surface the local reliability engine.');
assert.match(admin, /LocalScalePanel/, 'Admin command center must surface the local scale engine.');
assert.match(admin, /LocalEnterpriseFinishPanel/, 'Admin command center must surface the local enterprise finish engine.');
assert.match(admin, /Investor Metrics/, 'Admin command center must keep investor metrics in admin.');
assert.match(admin, /Mobile Medical OS/, 'Admin command center must declare the enterprise OS goal.');
assert.match(noApi, /NO_API_BUILD_CONTROLS/, 'No-API build controls are missing.');
assert.match(noApi, /NO_API_SCALE_CONTROLS/, 'No-API scale controls are missing.');
assert.match(noApi, /NO_API_COMPLETION_TOTAL/, 'No-API completion total is missing.');
assert.match(noApi, /buildNoApiReadinessSnapshot/, 'No-API readiness snapshot is missing.');
assert.match(noApi, /buildNoApiScaleSnapshot/, 'No-API scale snapshot is missing.');
assert.match(noApi, /investorMetrics/, 'No-API scale snapshot must include investor metrics.');
assert.equal((noApi.match(/id: '/g) || []).length, 34, 'No-API readiness must track 34 controls across build and scale layers.');
assert.match(noApiGate, /If it does not need an API/, 'No-API capability gate rule is missing.');
assert.match(noApiGate, /API_BOUND_HANDOFFS/, 'No-API capability gate must declare API-bound handoffs.');
assert.match(localRepository, /LOCAL_REPOSITORY_VERSION/, 'Local repository version is missing.');
assert.match(localRepository, /LOCAL_SCHEMA_VERSION/, 'Local repository schema version is missing.');
assert.match(localRepository, /LOCAL_EVENT_LEDGER_VERSION/, 'Local repository event ledger version is missing.');
assert.match(localRepository, /LOCAL_ENTITY_SCHEMAS/, 'Local repository schemas are missing.');
assert.match(localRepository, /appendRepositoryEvent/, 'Local repository append-only event ledger is missing.');
assert.match(localRepository, /buildUnifiedOperationalTruth/, 'Unified operational truth builder is missing.');
assert.match(localRepository, /ROLE_VISIBILITY_RULES/, 'Local repository role visibility rules are missing.');
assert.match(localRepository, /buildCrossPortalSyncSnapshot/, 'Cross-portal sync snapshot is missing.');
assert.match(localRepository, /syncLocalRepository/, 'Local repository sync action is missing.');
assert.match(dispatchBrain, /scoreDispatchCandidate/, 'Dispatch brain candidate scoring is missing.');
assert.match(dispatchBrain, /buildDispatchBrainSnapshot/, 'Dispatch brain snapshot is missing.');
assert.match(dispatchBrain, /placeholder-only/, 'Dispatch brain must keep clinical data placeholder-only.');
assert.match(supplyBrain, /buildVisitSupplyReservation/, 'Supply brain visit reservation is missing.');
assert.match(supplyBrain, /buildSupplyBrainSnapshot/, 'Supply brain snapshot is missing.');
assert.match(supplyBrain, /operational-placeholder-only/, 'Supply brain must keep clinical data placeholder-only.');
assert.match(providerCompetency, /scoreProviderCompetency/, 'Provider competency scoring is missing.');
assert.match(providerCompetency, /buildProviderCompetencySnapshot/, 'Provider competency snapshot is missing.');
assert.match(providerCompetency, /credential-placeholder-operational/, 'Provider competency must keep credentials placeholder-safe.');
assert.match(shiftMarketplace, /buildShiftOffer/, 'Shift marketplace offer builder is missing.');
assert.match(shiftMarketplace, /buildShiftMarketplaceSnapshot/, 'Shift marketplace snapshot is missing.');
assert.match(shiftMarketplace, /local-offer-placeholder/, 'Shift marketplace must keep SMS and payroll placeholder-safe.');
assert.match(arrivalMission, /buildArrivalMission/, 'Arrival mission builder is missing.');
assert.match(arrivalMission, /buildArrivalMissionSnapshot/, 'Arrival mission snapshot is missing.');
assert.match(arrivalMission, /local-route-placeholder/, 'Arrival mission must keep routes placeholder-safe.');
assert.match(visitCloseout, /buildVisitCloseout/, 'Visit closeout builder is missing.');
assert.match(visitCloseout, /buildVisitCloseoutSnapshot/, 'Visit closeout snapshot is missing.');
assert.match(visitCloseout, /acuity-closeout-placeholder/, 'Visit closeout must keep Acuity as placeholder source of record.');
assert.match(kitReconciliation, /buildKitReconciliation/, 'Kit reconciliation builder is missing.');
assert.match(kitReconciliation, /buildKitReconciliationSnapshot/, 'Kit reconciliation snapshot is missing.');
assert.match(kitReconciliation, /local-stock-control-placeholder/, 'Kit reconciliation must keep vendor ordering placeholder-safe.');
assert.match(postVisitQuality, /buildPostVisitQaRow/, 'Post-visit QA row builder is missing.');
assert.match(postVisitQuality, /buildPostVisitQualitySnapshot/, 'Post-visit QA snapshot is missing.');
assert.match(postVisitQuality, /local-care-retention-placeholder/, 'Post-visit QA must keep care and retention placeholder-safe.');
assert.match(localExecution, /LOCAL_EXECUTION_ENGINE_VERSION/, 'Local execution engine version is missing.');
assert.match(localExecution, /LOCAL_EXECUTION_PHASES/, 'Local execution phases are missing.');
assert.match(localExecution, /buildLocalExecutionSnapshot/, 'Local execution snapshot is missing.');
assert.match(localExecution, /runLocalExecutionSweep/, 'Local execution sweep is missing.');
assert.match(localExecution, /Qualiphy only if no Avalon NP is on call/, 'Local execution engine must preserve Qualiphy fallback rule.');
assert.match(localReliability, /LOCAL_RELIABILITY_ENGINE_VERSION/, 'Local reliability engine version is missing.');
assert.match(localReliability, /LOCAL_RELIABILITY_PHASES/, 'Local reliability phases are missing.');
assert.match(localReliability, /buildLocalReliabilitySnapshot/, 'Local reliability snapshot is missing.');
assert.match(localReliability, /runLocalReliabilitySweep/, 'Local reliability sweep is missing.');
assert.match(localReliability, /RELIABILITY_API_BOUNDARIES/, 'Local reliability API boundaries are missing.');
assert.match(localScale, /LOCAL_SCALE_ENGINE_VERSION/, 'Local scale engine version is missing.');
assert.match(localScale, /LOCAL_SCALE_PHASES/, 'Local scale phases are missing.');
assert.match(localScale, /buildLocalScaleSnapshot/, 'Local scale snapshot is missing.');
assert.match(localScale, /runLocalScaleSweep/, 'Local scale sweep is missing.');
assert.match(localScale, /SCALE_MARKETS/, 'Local scale markets are missing.');
assert.match(localScale, /SCALE_SOP_LIBRARY/, 'Local scale SOP library is missing.');
assert.match(localEnterpriseFinish, /LOCAL_ENTERPRISE_FINISH_VERSION/, 'Local enterprise finish version is missing.');
assert.match(localEnterpriseFinish, /LOCAL_ENTERPRISE_FINISH_PHASES/, 'Local enterprise finish phases are missing.');
assert.match(localEnterpriseFinish, /buildLocalEnterpriseFinishSnapshot/, 'Local enterprise finish snapshot is missing.');
assert.match(localEnterpriseFinish, /runLocalEnterpriseFinishSweep/, 'Local enterprise finish sweep is missing.');
assert.match(localEnterpriseFinish, /ENTERPRISE_QA_GATES/, 'Local enterprise finish QA gates are missing.');
assert.match(localEnterpriseFinish, /ROLE_PERMISSION_MATRIX/, 'Local enterprise finish role matrix is missing.');
assert.match(localEnterpriseFinish, /PROTOCOL_PACKAGE_TEMPLATES/, 'Local enterprise finish protocol packages are missing.');
assert.match(localEnterpriseFinish, /WHITE_LABEL_MODULES/, 'Local enterprise finish white-label modules are missing.');
assert.match(preApiPhaseRoadmap, /PRE_API_PHASE_ROADMAP_VERSION/, 'Pre-API 24-phase roadmap is missing.');
assert.match(preApiPhaseRoadmap, /PRE_API_FOUNDATION_PHASES/, 'Pre-API foundation phases are missing.');
assert.match(preApiPhaseRoadmap, /buildPreApiPhaseRoadmapSnapshot/, 'Pre-API phase snapshot is missing.');
assert.match(preApiPhaseRoadmap, /runPreApiPhaseRoadmapSweep/, 'Pre-API phase sweep is missing.');

const completion = buildNoApiCompletionSnapshot();
assert.equal(NO_API_COMPLETION_TOTAL, 132, 'No-API completion map must target 132 builds.');
assert.equal(completion.total, 132, 'No-API completion map must expose exactly 132 builds.');
assert.equal(completion.domains.length, 12, 'No-API completion map must expose 12 surfaces.');
completion.domains.forEach((domain) => {
  assert.equal(domain.total, 11, `${domain.label} must expose exactly 11 builds.`);
});
const capabilityGate = buildNoApiCapabilitySnapshot();
assert.equal(NO_API_GATE_RULE, 'If it does not need an API, it is buildable now.', 'No-API gate rule is wrong.');
assert.equal(capabilityGate.total, 132, 'No-API capability gate must classify all 132 builds.');
assert.equal(capabilityGate.localBuildable, 132, 'All no-API completion-map builds must be locally buildable or placeholder-safe.');
assert.equal(capabilityGate.apiBlocked, 0, 'No no-API completion-map build should be marked API-blocked.');
assert.equal(API_BOUND_HANDOFFS.length, 9, 'No-API capability gate must identify 9 hard API walls.');
assert.ok(capabilityGate.shipNow.length >= 12, 'No-API gate must produce a local ship-now queue.');
assert.ok(capabilityGate.placeholderQueue.length >= 8, 'No-API gate must produce a placeholder-safe queue.');
assert.equal(LOCAL_REPOSITORY_VERSION, '2026.05.no-api-repo-v1', 'Local repository version must be stable.');
assert.equal(LOCAL_SCHEMA_VERSION, '2026.05.local-schema-v1', 'Local schema version must be stable.');
assert.equal(LOCAL_EVENT_LEDGER_VERSION, '2026.05.local-ledger-v1', 'Local event ledger version must be stable.');
assert.equal(LOCAL_REPOSITORY_ENTITIES.length, 10, 'Local repository must expose 10 entity contracts.');
assert.equal(Object.keys(LOCAL_ENTITY_SCHEMAS).length, 10, 'Local repository must expose 10 entity schemas.');
const localRepoSnapshot = buildLocalRepositorySnapshot({
  requests: [{
    id: 'repo-booking',
    client: 'Repo Client',
    status: 'Nurse Assigned',
    nurse: 'Repo Nurse',
    therapy: 'Hydration',
    payment: 'Paid',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Cleared',
  }],
  nurses: [{ id: 'repo-nurse', name: 'Repo Nurse', status: 'Available', kit: 'Ready' }],
  inventory: [{ id: 'repo-iv', name: 'IV Bags (1L)', status: 'Ready', detail: '12 remaining' }],
});
assert.ok(localRepoSnapshot.entityCount >= 6, 'Local repository must normalize seeded bookings, clients, visits, nurses, kits, and inventory.');
assert.equal(localRepoSnapshot.contractCount, 10, 'Local repository contract count must be 10.');
assert.equal(localRepoSnapshot.schemaCount, 10, 'Local repository schema count must be 10.');
assert.equal(localRepoSnapshot.schemaVersion, LOCAL_SCHEMA_VERSION, 'Local repository snapshot must expose the schema version.');
assert.equal(localRepoSnapshot.ledger.version, LOCAL_EVENT_LEDGER_VERSION, 'Local repository snapshot must expose the ledger version.');
const nurseRepoView = buildRoleSafeRepositorySnapshot('nurse', {
  requests: [{ id: 'repo-booking', client: 'Repo Client', status: 'Nurse Assigned', nurse: 'Repo Nurse' }],
  nurses: [{ id: 'repo-nurse', name: 'Repo Nurse', status: 'Available', kit: 'Ready' }],
});
assert.ok(nurseRepoView.visibleCount >= 1, 'Nurse repository view must expose assigned operating truth.');
assert.ok(nurseRepoView.hiddenCount >= 0, 'Nurse repository view must calculate hidden entities.');
const crossPortal = buildCrossPortalSyncSnapshot({
  requests: [{ id: 'repo-booking', client: 'Repo Client', status: 'Nurse Assigned', nurse: 'Repo Nurse' }],
  nurses: [{ id: 'repo-nurse', name: 'Repo Nurse', status: 'Available', kit: 'Ready' }],
});
assert.equal(crossPortal.channels.length, 5, 'Cross-portal sync must expose 5 local channels.');
assert.ok(crossPortal.assignments >= 1, 'Cross-portal sync must detect assigned visits.');
const unifiedTruth = buildUnifiedOperationalTruth({
  requests: [{ id: 'repo-booking', client: 'Repo Client', status: 'Nurse Assigned', nurse: 'Repo Nurse' }],
  nurses: [{ id: 'repo-nurse', name: 'Repo Nurse', status: 'Available', kit: 'Ready' }],
});
assert.equal(unifiedTruth.roleViews.length, 5, 'Unified operational truth must expose role-safe views.');
assert.equal(unifiedTruth.schemas.length, 10, 'Unified operational truth must expose schemas.');
assert.ok(unifiedTruth.repository.entityCount >= 5, 'Unified operational truth must expose repository entities.');
assert.equal(LOCAL_EXECUTION_ENGINE_VERSION, '2026.05.no-api-execution-v1', 'Local execution engine version must be stable.');
assert.equal(LOCAL_EXECUTION_PHASES.length, 3, 'Local execution engine must expose phases 4-6.');
assert.equal(LOCAL_RELIABILITY_ENGINE_VERSION, '2026.05.no-api-reliability-v1', 'Local reliability engine version must be stable.');
assert.equal(LOCAL_RELIABILITY_PHASES.length, 3, 'Local reliability engine must expose phases 7-9.');
assert.equal(RELIABILITY_API_BOUNDARIES.length, 8, 'Local reliability engine must expose 8 hard API boundaries.');
assert.equal(LOCAL_SCALE_ENGINE_VERSION, '2026.05.no-api-scale-v1', 'Local scale engine version must be stable.');
assert.equal(LOCAL_SCALE_PHASES.length, 3, 'Local scale engine must expose phases 10-12.');
assert.equal(SCALE_MARKETS.length, 8, 'Local scale engine must expose 8 market playbooks.');
assert.equal(SCALE_SOP_LIBRARY.length, 8, 'Local scale engine must expose 8 SOP rows.');
assert.equal(LOCAL_ENTERPRISE_FINISH_VERSION, '2026.05.no-api-enterprise-finish-v1', 'Local enterprise finish version must be stable.');
assert.equal(LOCAL_ENTERPRISE_FINISH_PHASES.length, 12, 'Local enterprise finish must expose phases 13-24.');
assert.equal(PRE_API_PHASE_ROADMAP_VERSION, '2026.05.pre-api-24-phase-v1', 'Pre-API phase roadmap version is wrong.');
assert.equal(PRE_API_FOUNDATION_PHASES.length, 3, 'Pre-API roadmap must expose phases 1-3.');
assert.equal(PRE_API_PHASE_GROUPS.length, 5, 'Pre-API roadmap must group all phase layers.');
assert.equal(ENTERPRISE_QA_GATES.length, 9, 'Local enterprise finish must expose 9 QA gates.');
assert.equal(ROLE_PERMISSION_MATRIX.length, 6, 'Local enterprise finish must expose 6 role rows.');
assert.equal(PROTOCOL_PACKAGE_TEMPLATES.length, 7, 'Local enterprise finish must expose 7 protocol package templates.');
assert.equal(WHITE_LABEL_MODULES.length, 6, 'Local enterprise finish must expose 6 white-label modules.');
const localExecutionSnapshot = buildLocalExecutionSnapshot({
  requests: [
    {
      id: 'execution-ready',
      client: 'Execution Client',
      therapy: 'Hydration',
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfeRecord: { status: 'Cleared', validUntil: '2026-12-31' },
      payment: 'Paid',
      nurse: 'Execution Nurse',
      visitCount: 1,
      isNewClient: false,
    },
    {
      id: 'execution-blocked',
      client: 'Blocked Execution',
      therapy: 'NAD+ Hydration',
      status: 'GFE Pending',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Pending',
      payment: 'Pending',
      nurse: 'Unassigned',
    },
  ],
  nurses: [{ id: 'execution-nurse', name: 'Execution Nurse', status: 'Available', kit: 'Ready' }],
  inventory: [
    { id: 'iv', name: 'IV Bag - 1L Normal Saline', qty: 10, minLevel: 2 },
    { id: 'start', name: 'IV Start Kit', qty: 10, minLevel: 2 },
    { id: 'ext', name: 'IV Extension Set', qty: 10, minLevel: 2 },
    { id: 'gloves', name: 'Nitrile Gloves', qty: 10, minLevel: 2 },
    { id: 'sharps', name: 'Sharps Container', qty: 2, minLevel: 1 },
    { id: 'bp', name: 'Digital BP Cuff', qty: 2, minLevel: 1 },
    { id: 'pox', name: 'Pulse Oximeter', qty: 2, minLevel: 1 },
    { id: 'epi', name: 'Epinephrine', qty: 2, minLevel: 1 },
    { id: 'diph', name: 'Diphenhydramine', qty: 2, minLevel: 1 },
    { id: 'bcomplex', name: 'B-Complex vial', qty: 4, minLevel: 1 },
  ],
});
assert.equal(localExecutionSnapshot.phases.length, 3, 'Local execution snapshot must expose phase rows.');
assert.equal(localExecutionSnapshot.metrics.active, 2, 'Local execution snapshot must count active visits.');
assert.ok(localExecutionSnapshot.metrics.dispatchReady >= 1, 'Local execution snapshot must detect dispatch-ready visits.');
assert.ok(localExecutionSnapshot.metrics.blocked >= 1, 'Local execution snapshot must detect blocked visits.');
assert.ok(localExecutionSnapshot.inventoryImpact.length >= 1, 'Local execution snapshot must expose inventory impact.');
const localReliabilitySnapshot = buildLocalReliabilitySnapshot({
  requests: [
    {
      id: 'reliability-ready',
      client: 'Reliability Client',
      city: 'SF',
      address: '1 Market St',
      therapy: 'Hydration',
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfeRecord: { status: 'Cleared', validUntil: '2026-12-31' },
      payment: 'Paid',
      nurse: 'Reliability Nurse',
      eta: '18 min',
      visitCount: 2,
      isNewClient: false,
    },
    {
      id: 'reliability-blocked',
      client: 'Blocked Reliability',
      city: 'SF',
      therapy: 'NAD+ Hydration',
      status: 'GFE Pending',
      intake: 'Done',
      consent: 'Pending',
      gfe: 'Pending',
      payment: 'Pending',
      nurse: 'Unassigned',
    },
  ],
  nurses: [{ id: 'reliability-nurse', name: 'Reliability Nurse', status: 'Available', area: 'SF', kit: 'Ready' }],
  inventory: [
    { id: 'iv', name: 'IV Bag - 1L Normal Saline', qty: 10, minLevel: 2 },
    { id: 'start', name: 'IV Start Kit', qty: 10, minLevel: 2 },
    { id: 'ext', name: 'IV Extension Set', qty: 10, minLevel: 2 },
    { id: 'gloves', name: 'Nitrile Gloves', qty: 10, minLevel: 2 },
    { id: 'sharps', name: 'Sharps Container', qty: 2, minLevel: 1 },
    { id: 'bp', name: 'Digital BP Cuff', qty: 2, minLevel: 1 },
    { id: 'pox', name: 'Pulse Oximeter', qty: 2, minLevel: 1 },
    { id: 'epi', name: 'Epinephrine', qty: 2, minLevel: 1 },
    { id: 'diph', name: 'Diphenhydramine', qty: 2, minLevel: 1 },
    { id: 'bcomplex', name: 'B-Complex vial', qty: 4, minLevel: 1 },
  ],
});
assert.equal(localReliabilitySnapshot.phases.length, 3, 'Local reliability snapshot must expose phase rows.');
assert.ok(localReliabilitySnapshot.metrics.exceptions >= 1, 'Local reliability snapshot must detect exceptions.');
assert.ok(localReliabilitySnapshot.comms.routes.length >= 6, 'Local reliability snapshot must expose comms routes.');
assert.ok(localReliabilitySnapshot.launch.gates.length >= 6, 'Local reliability snapshot must expose launch gates.');
assert.equal(localReliabilitySnapshot.apiBoundaries.length, 8, 'Local reliability snapshot must expose API boundaries.');
const localScaleSnapshot = buildLocalScaleSnapshot({
  requests: [
    {
      id: 'scale-sf',
      client: 'Scale SF',
      city: 'SF',
      address: 'Four Seasons San Francisco',
      locationType: 'hotel',
      therapy: 'Hydration',
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfeRecord: { status: 'Cleared', validUntil: '2026-12-31' },
      payment: 'Paid',
      nurse: 'Scale Nurse',
      eta: '12 min',
      visitCount: 2,
      isNewClient: false,
    },
    {
      id: 'scale-oakland',
      client: 'Scale Oakland',
      city: 'Oakland',
      address: 'Downtown Oakland office',
      locationType: 'office',
      therapy: 'Corporate Recovery',
      status: 'Confirmed',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Invoice',
      nurse: 'East Bay Nurse',
      eta: '22 min',
    },
  ],
  nurses: [
    { id: 'scale-nurse', name: 'Scale Nurse', status: 'Available', area: 'SF', kit: 'Ready' },
    { id: 'east-bay-nurse', name: 'East Bay Nurse', status: 'Available', area: 'East Bay', kit: 'Ready' },
  ],
  inventory: [
    { id: 'iv', name: 'IV Bag - 1L Normal Saline', qty: 20, minLevel: 2 },
    { id: 'start', name: 'IV Start Kit', qty: 20, minLevel: 2 },
    { id: 'gloves', name: 'Nitrile Gloves', qty: 20, minLevel: 2 },
    { id: 'sharps', name: 'Sharps Container', qty: 5, minLevel: 1 },
  ],
});
assert.equal(localScaleSnapshot.phases.length, 3, 'Local scale snapshot must expose phase rows.');
assert.equal(localScaleSnapshot.market.rows.length, 8, 'Local scale snapshot must expose 8 markets.');
assert.equal(localScaleSnapshot.sop.rows.length, 8, 'Local scale snapshot must expose 8 SOPs.');
assert.ok(localScaleSnapshot.release.gates.length >= 8, 'Local scale snapshot must expose release gates.');
assert.equal(localScaleSnapshot.metrics.totalBuilds, 132, 'Local scale snapshot must retain the 132-build map.');
const localEnterpriseFinishSnapshot = buildLocalEnterpriseFinishSnapshot({
  requests: [
    {
      id: 'finish-sf',
      client: 'Finish SF',
      city: 'SF',
      address: 'Four Seasons San Francisco',
      locationType: 'hotel',
      therapy: 'Hydration Recovery',
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfeRecord: { status: 'Cleared', validUntil: '2026-12-31' },
      payment: 'Paid',
      nurse: 'Finish Nurse',
      eta: '12 min',
      total: 450,
      visitCount: 2,
      isNewClient: false,
    },
    {
      id: 'finish-launch',
      client: 'Finish Launch',
      city: 'Oakland',
      address: 'Downtown Oakland office',
      locationType: 'office',
      therapy: 'Launch Recovery',
      source: 'Corporate',
      status: 'Confirmed',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Invoice',
      nurse: 'East Bay Finish',
      eta: '22 min',
      total: 1200,
    },
  ],
  nurses: [
    { id: 'finish-nurse', name: 'Finish Nurse', status: 'Available', area: 'SF', kit: 'Ready' },
    { id: 'east-bay-finish', name: 'East Bay Finish', status: 'Available', area: 'East Bay', kit: 'Ready' },
  ],
  inventory: [
    { id: 'iv', name: 'IV Bag - 1L Normal Saline', qty: 20, minLevel: 2 },
    { id: 'start', name: 'IV Start Kit', qty: 20, minLevel: 2 },
    { id: 'gloves', name: 'Nitrile Gloves', qty: 20, minLevel: 2 },
    { id: 'sharps', name: 'Sharps Container', qty: 5, minLevel: 1 },
  ],
});
assert.equal(localEnterpriseFinishSnapshot.phases.length, 12, 'Local enterprise finish snapshot must expose the last 12 phases.');
assert.equal(localEnterpriseFinishSnapshot.qa.rows.length, 9, 'Local enterprise finish snapshot must expose QA gates.');
assert.equal(localEnterpriseFinishSnapshot.access.roles.length, 6, 'Local enterprise finish snapshot must expose role safety rows.');
assert.ok(localEnterpriseFinishSnapshot.access.searchCount >= 30, 'Local enterprise finish snapshot must expose command search index.');
assert.equal(localEnterpriseFinishSnapshot.packaging.protocolRows.length, 7, 'Local enterprise finish snapshot must expose protocol packages.');
assert.equal(localEnterpriseFinishSnapshot.licensing.licensingRows.length, 6, 'Local enterprise finish snapshot must expose licensing modules.');
assert.equal(localEnterpriseFinishSnapshot.metrics.totalBuilds, 132, 'Local enterprise finish snapshot must retain the 132-build map.');
assert.equal(DISPATCH_BRAIN_VERSION, '2026.05.no-api-dispatch-v2', 'Dispatch brain version must be stable.');
assert.equal(DISPATCH_SCORE_FACTORS.length, 8, 'Dispatch brain must score 8 factors.');
const dispatchCandidate = scoreDispatchCandidate({
  request: {
    id: 'dispatch-ready',
    client: 'Ready Client',
    city: 'SF',
    address: '1 Market St',
    therapy: 'NAD+ Hydration',
    total: 650,
    status: 'Ready for Visit',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Cleared',
    payment: 'Paid',
    nurse: 'Unassigned',
  },
  nurse: {
    id: 'dispatch-nurse',
    name: 'Dispatch Nurse',
    status: 'Available',
    area: 'SF Downtown',
    kit: 'Ready',
    visits: 0,
    certifications: ['iv', 'nad'],
  },
  inventory: [
    { id: 'iv', name: 'IV Bags (1L)', status: 'Ready', detail: '20 remaining' },
    { id: 'nad', name: 'NAD+ (250mg)', status: 'Ready', detail: '8 vials' },
  ],
});
assert.ok(dispatchCandidate.score >= 86, 'Dispatch brain must produce a high-confidence ready match.');
assert.equal(dispatchCandidate.grade, 'Dispatch', 'Ready dispatch candidate must grade Dispatch.');
const dispatchBlocked = scoreDispatchCandidate({
  request: {
    id: 'dispatch-blocked',
    client: 'Blocked Client',
    city: 'SF',
    therapy: 'Hydration',
    status: 'GFE Pending',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Pending',
    payment: 'Paid',
  },
  nurse: {
    id: 'dispatch-nurse',
    name: 'Dispatch Nurse',
    status: 'Available',
    area: 'SF',
    kit: 'Ready',
    visits: 0,
    certifications: ['iv'],
  },
  inventory: [{ id: 'iv', name: 'IV Bags (1L)', status: 'Ready', detail: '20 remaining' }],
});
assert.equal(dispatchBlocked.grade, 'Block', 'Dispatch brain must block GFE-pending visits.');
assert.ok(dispatchBlocked.blockers.some((item) => /GFE/.test(item)), 'Dispatch brain must explain the GFE block.');
const dispatchSnapshot = buildDispatchBrainSnapshot({
  requests: [
    {
      id: 'dispatch-ready',
      client: 'Ready Client',
      city: 'SF',
      therapy: 'NAD+ Hydration',
      total: 650,
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Paid',
      nurse: 'Unassigned',
    },
    {
      id: 'dispatch-blocked',
      client: 'Blocked Client',
      city: 'SF',
      therapy: 'Hydration',
      status: 'GFE Pending',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Pending',
      payment: 'Paid',
    },
  ],
  nurses: [{
    id: 'dispatch-nurse',
    name: 'Dispatch Nurse',
    status: 'Available',
    area: 'SF Downtown',
    kit: 'Ready',
    visits: 0,
    certifications: ['iv', 'nad'],
  }],
  inventory: [
    { id: 'iv', name: 'IV Bags (1L)', status: 'Ready', detail: '20 remaining' },
    { id: 'nad', name: 'NAD+ (250mg)', status: 'Ready', detail: '8 vials' },
  ],
});
assert.equal(dispatchSnapshot.metrics.requests, 2, 'Dispatch brain snapshot must count requests.');
assert.equal(dispatchSnapshot.metrics.dispatchable, 1, 'Dispatch brain snapshot must count dispatchable visits.');
assert.equal(dispatchSnapshot.metrics.blocked, 1, 'Dispatch brain snapshot must count blocked visits.');
assert.ok(dispatchSnapshot.marketCoverage.length >= 1, 'Dispatch brain snapshot must expose market coverage.');
assert.equal(SUPPLY_BRAIN_VERSION, '2026.05.no-api-supply-v1', 'Supply brain version must be stable.');
assert.equal(SUPPLY_BRAIN_RULES.length, 5, 'Supply brain must expose 5 operating rules.');
const supplyInventory = [
  { id: 'iv', name: 'IV Bag - 1L Normal Saline', qty: 8, minLevel: 3, unit: 'bags' },
  { id: 'start', name: 'IV Start Kit', qty: 8, minLevel: 3, unit: 'kits' },
  { id: 'ext', name: 'IV Extension Set', qty: 8, minLevel: 3, unit: 'sets' },
  { id: 'gloves', name: 'Nitrile Gloves', qty: 8, minLevel: 3, unit: 'boxes' },
  { id: 'sharps', name: 'Sharps Container', qty: 3, minLevel: 1, unit: 'units' },
  { id: 'bp', name: 'Digital BP Cuff', qty: 2, minLevel: 1, unit: 'units' },
  { id: 'pox', name: 'Pulse Oximeter', qty: 2, minLevel: 1, unit: 'units' },
  { id: 'epi', name: 'Epinephrine', qty: 2, minLevel: 1, unit: 'vials' },
  { id: 'diph', name: 'Diphenhydramine', qty: 2, minLevel: 1, unit: 'vials' },
  { id: 'nad', name: 'NAD+ 250mg vial', qty: 1, minLevel: 2, unit: 'vials', refrigeration: true, expirationDate: '2026-12-01' },
  { id: 'bcomplex', name: 'B-Complex vial', qty: 0, minLevel: 2, unit: 'vials' },
  { id: 'mag', name: 'Magnesium Sulfate vial', qty: 4, minLevel: 2, unit: 'vials' },
  { id: 'vitc', name: 'Vitamin C 50ml', qty: 1, minLevel: 2, unit: 'vials', refrigeration: true },
];
const readyReservation = buildVisitSupplyReservation({
  id: 'supply-ready',
  client: 'Supply Client',
  therapy: 'NAD+ Hydration',
  nurse: 'Supply Nurse',
  guests: 1,
}, supplyInventory.map((item) => item.id === 'nad' ? { ...item, qty: 3 } : item));
assert.ok(readyReservation.lines.length >= 10, 'Supply reservation must include base, emergency, device, and protocol lines.');
assert.match(readyReservation.closeoutRule, /Deduct consumables/, 'Supply reservation must preserve field closeout deduction rule.');
const supplySnapshot = buildSupplyBrainSnapshot({
  requests: [
    {
      id: 'supply-nad',
      client: 'NAD Client',
      therapy: 'NAD+ Hydration',
      nurse: 'Supply Nurse',
      guests: 1,
      status: 'Ready for Visit',
    },
    {
      id: 'supply-myers',
      client: 'Myers Client',
      therapy: 'Myers Cocktail',
      nurse: 'Unassigned',
      guests: 2,
      status: 'Ready for Visit',
    },
  ],
  nurses: [
    { id: 'supply-nurse', name: 'Supply Nurse', kit: 'Ready', status: 'Available' },
    { id: 'supply-restock', name: 'Restock Nurse', kit: 'Restock Needed', status: 'Available' },
  ],
  inventory: supplyInventory,
});
assert.equal(supplySnapshot.metrics.visits, 2, 'Supply brain must count visit reservations.');
assert.ok(supplySnapshot.stockLedger.length >= 5, 'Supply brain must produce stock ledger lines.');
assert.ok(supplySnapshot.metrics.restock >= 1, 'Supply brain must create restock missions from projected demand.');
assert.ok(supplySnapshot.metrics.nurseKitsHold >= 1, 'Supply brain must flag nurse kit holds.');
assert.ok(supplySnapshot.coldChain.length >= 1, 'Supply brain must expose cold-chain proof requirements.');
assert.ok(supplySnapshot.metrics.integrityScore < 100, 'Supply brain must penalize real supply risk.');
assert.equal(PROVIDER_COMPETENCY_VERSION, '2026.05.no-api-provider-competency-v1', 'Provider competency version must be stable.');
assert.equal(PROVIDER_COMPETENCY_RULES.length, 5, 'Provider competency brain must expose 5 operating rules.');
const clearedTraining = {
  modules: [
    { id: 'iv-start-safety', status: 'Clear' },
    { id: 'nad-protocol-review', status: 'Clear' },
    { id: 'myers-add-ons', status: 'Clear' },
    { id: 'im-shot-review', status: 'Clear' },
    { id: 'emergency-response', status: 'Clear' },
    { id: 'acuity-closeout', status: 'Clear' },
  ],
};
const clearProviderScore = scoreProviderCompetency({
  request: {
    id: 'competency-ready',
    client: 'Competency Client',
    therapy: 'Hydration',
    status: 'Ready for Visit',
    gfe: 'Cleared',
  },
  nurse: {
    id: 'competency-nurse',
    name: 'Competency Nurse',
    role: 'RN',
    nurseys: { status: 'Clear', state: 'CA' },
    kit: 'Ready',
    visits: 0,
  },
  trainingRow: clearedTraining,
});
assert.ok(clearProviderScore.score >= 90, 'Provider competency must produce a high score for a clear RN.');
assert.equal(clearProviderScore.status, 'Clear', 'Provider competency must clear a credentialed, trained RN.');
const blockedProviderScore = scoreProviderCompetency({
  request: {
    id: 'competency-blocked',
    client: 'Blocked Competency',
    therapy: 'NAD+ Hydration',
    status: 'GFE Pending',
    gfe: 'Pending',
  },
  nurse: {
    id: 'competency-missing',
    name: 'Missing Proof Nurse',
    role: 'RN',
    kit: 'Restock Needed',
    visits: 1,
  },
  trainingRow: { modules: [{ id: 'iv-start-safety', status: 'Expired' }] },
});
assert.equal(blockedProviderScore.status, 'Block', 'Provider competency must block missing proof or open clearance.');
assert.ok(blockedProviderScore.blockers.some((item) => /Nurseys|Clinical clearance|Kit/.test(item)), 'Provider competency must explain provider blocks.');
const competencySnapshot = buildProviderCompetencySnapshot({
  requests: [
    { id: 'competency-ready', client: 'Competency Client', therapy: 'Hydration', status: 'Ready for Visit', gfe: 'Cleared' },
    { id: 'competency-blocked', client: 'Blocked Competency', therapy: 'NAD+ Hydration', status: 'GFE Pending', gfe: 'Pending' },
  ],
  nurses: [
    { id: 'competency-nurse', name: 'Competency Nurse', role: 'RN', nurseys: { status: 'Clear', state: 'CA' }, kit: 'Ready', visits: 0 },
    { id: 'competency-missing', name: 'Missing Proof Nurse', role: 'RN', kit: 'Restock Needed', visits: 1 },
  ],
});
assert.equal(competencySnapshot.metrics.visits, 2, 'Provider competency snapshot must count active visits.');
assert.equal(competencySnapshot.metrics.nurses, 2, 'Provider competency snapshot must count nurses.');
assert.ok(competencySnapshot.metrics.blocked >= 1, 'Provider competency snapshot must expose blocked offers.');
assert.ok(competencySnapshot.modulePressure.length >= 1, 'Provider competency snapshot must expose training module pressure.');
assert.equal(SHIFT_MARKETPLACE_VERSION, '2026.05.no-api-shift-marketplace-v1', 'Shift marketplace version must be stable.');
assert.equal(SHIFT_MARKETPLACE_RULES.length, 5, 'Shift marketplace must expose 5 operating rules.');
const marketplaceInventory = [
  { id: 'iv', name: 'IV Bags (1L)', status: 'Ready', detail: '20 remaining' },
  { id: 'kit', name: 'Nurse Bags', status: 'Ready', detail: '4 kitted' },
  { id: 'nad', name: 'NAD+ (250mg)', status: 'Ready', detail: '8 vials' },
  { id: 'bcomplex', name: 'B-Complex', status: 'Ready', detail: 'Adequate' },
];
const readyShiftOffer = buildShiftOffer({
  request: {
    id: 'market-ready',
    client: 'Market Ready',
    city: 'SF',
    address: '1 Market St',
    time: 'Today 5:00 PM',
    therapy: 'Hydration',
    total: 500,
    status: 'Ready for Visit',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Cleared',
    payment: 'Paid',
    nurse: 'Unassigned',
  },
  nurse: {
    id: 'market-nurse',
    name: 'Market Nurse',
    status: 'Available',
    area: 'SF Downtown',
    kit: 'Ready',
    visits: 0,
    certifications: ['iv'],
  },
  inventory: marketplaceInventory,
});
assert.equal(readyShiftOffer.stage, 'Send', 'Shift marketplace must produce sendable Y/N nurse offers.');
assert.equal(readyShiftOffer.replyCommand, 'Y/N', 'Shift marketplace must preserve nurse Y/N reply flow.');
assert.equal(readyShiftOffer.nurseFinalEta, true, 'Shift marketplace must preserve nurse final ETA authority.');
assert.ok(readyShiftOffer.shiftValue >= 65, 'Shift marketplace must show a local shift value estimate.');
const blockedShiftOffer = buildShiftOffer({
  request: {
    id: 'market-blocked',
    client: 'Market Blocked',
    city: 'SF',
    therapy: 'NAD+ Hydration',
    total: 600,
    status: 'GFE Pending',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Pending',
    payment: 'Paid',
    nurse: 'Unassigned',
  },
  nurse: {
    id: 'market-nurse',
    name: 'Market Nurse',
    status: 'Available',
    area: 'SF Downtown',
    kit: 'Ready',
    visits: 0,
    certifications: ['iv', 'nad'],
  },
  inventory: marketplaceInventory,
});
assert.equal(blockedShiftOffer.stage, 'Hold', 'Shift marketplace must hold uncleared visits.');
assert.ok(blockedShiftOffer.blockers.some((item) => /GFE/.test(item)), 'Shift marketplace must explain clearance holds.');
const marketplaceSnapshot = buildShiftMarketplaceSnapshot({
  requests: [
    {
      id: 'market-accepted',
      client: 'Accepted Client',
      city: 'SF',
      time: 'Today 3:00 PM',
      therapy: 'Hydration',
      total: 700,
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Paid',
      nurse: 'Market Nurse',
    },
    {
      id: 'market-ready',
      client: 'Market Ready',
      city: 'SF',
      time: 'Today 5:00 PM',
      therapy: 'Hydration',
      total: 500,
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Paid',
      nurse: 'Unassigned',
    },
  ],
  nurses: [
    { id: 'market-nurse', name: 'Market Nurse', status: 'Available', area: 'SF Downtown', kit: 'Ready', visits: 0, certifications: ['iv'] },
    { id: 'market-backup', name: 'Market Backup', status: 'Available', area: 'SF Downtown', kit: 'Ready', visits: 1, certifications: ['iv'] },
  ],
  inventory: marketplaceInventory,
});
assert.equal(marketplaceSnapshot.metrics.visits, 2, 'Shift marketplace snapshot must count active visits.');
assert.ok(marketplaceSnapshot.metrics.sendable >= 1, 'Shift marketplace snapshot must expose sendable offers.');
assert.ok(marketplaceSnapshot.metrics.accepted >= 1, 'Shift marketplace snapshot must expose accepted locks.');
assert.ok(marketplaceSnapshot.acceptedLocks.some((lock) => lock.etaOwner === 'nurse'), 'Accepted locks must preserve nurse ETA ownership.');
assert.ok(marketplaceSnapshot.nurseInbox.some((row) => row.open >= 1 || row.accepted >= 1), 'Shift marketplace must populate nurse inbox rows.');
assert.equal(ARRIVAL_MISSION_VERSION, '2026.05.no-api-arrival-mission-v1', 'Arrival mission version must be stable.');
assert.equal(ARRIVAL_MISSION_RULES.length, 6, 'Arrival mission must expose 6 operating rules.');
const etaNeededMission = buildArrivalMission({
  request: {
    id: 'arrival-eta',
    client: 'Arrival Client',
    city: 'SF',
    address: '1 Market St',
    time: 'Today 5:00 PM',
    therapy: 'Hydration',
    status: 'Ready for Visit',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Cleared',
    payment: 'Paid',
    nurse: 'Arrival Nurse',
  },
  nurse: { id: 'arrival-nurse', name: 'Arrival Nurse', status: 'Assigned', kit: 'Ready' },
});
assert.equal(etaNeededMission.stage, 'ETA Needed', 'Arrival mission must require nurse ETA before route text.');
assert.equal(etaNeededMission.clientTextReady, false, 'Arrival mission must suppress client text without nurse ETA.');
assert.ok(etaNeededMission.maps.apple.includes('maps.apple.com'), 'Arrival mission must generate Apple Maps handoff.');
assert.ok(etaNeededMission.maps.google.includes('google.com/maps'), 'Arrival mission must generate Google Maps handoff.');
const readyArrivalMission = buildArrivalMission({
  request: {
    id: 'arrival-ready',
    client: 'Ready Arrival',
    city: 'SF',
    address: '1 Market St',
    time: 'Today 5:00 PM',
    therapy: 'Hydration',
    status: 'Ready for Visit',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Cleared',
    payment: 'Paid',
    nurse: 'Arrival Nurse',
    eta: '22 min',
  },
  nurse: { id: 'arrival-nurse', name: 'Arrival Nurse', status: 'Assigned', kit: 'Ready' },
});
assert.equal(readyArrivalMission.stage, 'Client Text Ready', 'Arrival mission must publish only after nurse ETA exists.');
assert.match(readyArrivalMission.clientText, /ETA 22 min/, 'Arrival mission must include nurse ETA in client copy.');
const arrivalSnapshot = buildArrivalMissionSnapshot({
  requests: [
    {
      id: 'arrival-eta',
      client: 'Arrival Client',
      city: 'SF',
      address: '1 Market St',
      time: 'Today 5:00 PM',
      therapy: 'Hydration',
      total: 500,
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Paid',
      nurse: 'Arrival Nurse',
    },
    {
      id: 'arrival-ready',
      client: 'Ready Arrival',
      city: 'SF',
      address: '1 Market St',
      time: 'Today 6:00 PM',
      therapy: 'Hydration',
      total: 500,
      status: 'Ready for Visit',
      intake: 'Done',
      consent: 'Done',
      gfe: 'Cleared',
      payment: 'Paid',
      nurse: 'Arrival Nurse',
      eta: '22 min',
    },
  ],
  nurses: [{ id: 'arrival-nurse', name: 'Arrival Nurse', status: 'Available', area: 'SF Downtown', kit: 'Ready', visits: 0, certifications: ['iv'] }],
  inventory: marketplaceInventory,
});
assert.equal(arrivalSnapshot.metrics.visits, 2, 'Arrival mission snapshot must count active visits.');
assert.equal(arrivalSnapshot.metrics.etaNeeded, 1, 'Arrival mission snapshot must count missing nurse ETAs.');
assert.equal(arrivalSnapshot.metrics.clientTexts, 1, 'Arrival mission snapshot must count client ETA texts ready to publish.');
assert.ok(arrivalSnapshot.escalations.some((item) => /ETA/.test(item.reason)), 'Arrival mission snapshot must escalate missing nurse ETA.');
assert.ok(arrivalSnapshot.handoffChannels.some((channel) => channel.label === 'Acuity closeout' && channel.status === 'Placeholder'), 'Arrival mission must preserve Acuity as closeout handoff.');
assert.equal(VISIT_CLOSEOUT_VERSION, '2026.05.no-api-visit-closeout-v1', 'Visit closeout version must be stable.');
assert.equal(VISIT_CLOSEOUT_RULES.length, 6, 'Visit closeout must expose 6 operating rules.');
const cleanCloseout = {
  identityVerified: true,
  consentVerified: true,
  gfeVerified: true,
  allergiesReviewed: true,
  medicationsReviewed: true,
  preBp: '118/76',
  preHr: '68',
  preSpo2: '99',
  postBp: '116/74',
  postHr: '70',
  postSpo2: '99',
  routeSite: 'Left AC',
  lotOrKitId: 'KIT-SF-01',
  expirationChecked: true,
  adverseEvent: 'None',
  dischargeCondition: 'Stable',
  nurseSignature: 'Market Nurse',
  attestation: true,
  acuityEntered: true,
};
const cleanVisitCloseout = buildVisitCloseout({
  request: {
    id: 'closeout-clean',
    client: 'Clean Client',
    city: 'SF',
    time: 'Today 6:00 PM',
    therapy: 'Hydration',
    total: 500,
    status: 'Completed',
    nurse: 'Market Nurse',
  },
  nurse: { id: 'market-nurse', name: 'Market Nurse' },
  inventory: supplyInventory,
  closeout: cleanCloseout,
});
assert.equal(cleanVisitCloseout.stage, 'Payroll Ready', 'Clean closeout must release payroll proof.');
assert.equal(cleanVisitCloseout.sourceOfRecord, 'Acuity', 'Visit closeout must keep Acuity as source of record.');
assert.equal(cleanVisitCloseout.packet.status, 'Complete', 'Clean closeout must create a complete Acuity packet.');
assert.equal(cleanVisitCloseout.deductionReady, true, 'Clean closeout must unlock kit deduction proof.');
assert.ok(cleanVisitCloseout.deductionProof.length >= 5, 'Clean closeout must create multiple inventory deduction lines.');
assert.equal(cleanVisitCloseout.payrollProof.source, 'Gusto placeholder', 'Visit closeout must preserve Gusto as placeholder payroll handoff.');
const missingVisitCloseout = buildVisitCloseout({
  request: {
    id: 'closeout-missing',
    client: 'Missing Client',
    city: 'SF',
    therapy: 'Hydration',
    total: 250,
    status: 'Completed',
    nurse: 'Market Nurse',
  },
  inventory: supplyInventory,
  closeout: {},
});
assert.equal(missingVisitCloseout.stage, 'Closeout Needed', 'Missing closeout must stay locked.');
assert.equal(missingVisitCloseout.followUpReady, false, 'Missing closeout must block client follow-up.');
assert.equal(missingVisitCloseout.payrollReady, false, 'Missing closeout must block payroll proof.');
const eventVisitCloseout = buildVisitCloseout({
  request: {
    id: 'closeout-event',
    client: 'Event Client',
    city: 'SF',
    therapy: 'Myers Cocktail',
    total: 650,
    status: 'Completed',
    nurse: 'Market Nurse',
  },
  inventory: supplyInventory,
  closeout: { ...cleanCloseout, adverseEvent: 'Lightheaded after service' },
});
assert.equal(eventVisitCloseout.stage, 'Incident Review', 'Adverse event closeout must route to incident review.');
assert.equal(eventVisitCloseout.eventFlagged, true, 'Adverse event closeout must flag the event.');
assert.equal(eventVisitCloseout.payrollReady, false, 'Adverse event closeout must hold payroll release.');
const visitCloseoutSnapshot = buildVisitCloseoutSnapshot({
  requests: [
    { id: 'closeout-clean', client: 'Clean Client', city: 'SF', therapy: 'Hydration', total: 500, status: 'Completed', nurse: 'Market Nurse' },
    { id: 'closeout-missing', client: 'Missing Client', city: 'SF', therapy: 'Hydration', total: 250, status: 'Completed', nurse: 'Market Nurse' },
    { id: 'closeout-event', client: 'Event Client', city: 'SF', therapy: 'Myers Cocktail', total: 650, status: 'Completed', nurse: 'Market Nurse' },
  ],
  nurses: [{ id: 'market-nurse', name: 'Market Nurse' }],
  inventory: supplyInventory,
  closeouts: {
    'closeout-clean': cleanCloseout,
    'closeout-event': { ...cleanCloseout, adverseEvent: 'Lightheaded after service' },
  },
});
assert.equal(visitCloseoutSnapshot.metrics.visits, 3, 'Visit closeout snapshot must count visits.');
assert.equal(visitCloseoutSnapshot.metrics.closeoutNeeded, 1, 'Visit closeout snapshot must count missing closeouts.');
assert.equal(visitCloseoutSnapshot.metrics.payrollReady, 1, 'Visit closeout snapshot must count clean payroll-ready closeouts.');
assert.equal(visitCloseoutSnapshot.metrics.incidents, 1, 'Visit closeout snapshot must count incident reviews.');
assert.ok(visitCloseoutSnapshot.deductionLedger.some((line) => line.status === 'Queued'), 'Visit closeout snapshot must queue deduction proof after closeout.');
assert.ok(visitCloseoutSnapshot.incidentQueue.some((item) => item.sourceOfRecord === 'Acuity'), 'Visit closeout incident queue must preserve Acuity source of record.');
assert.equal(KIT_RECONCILIATION_VERSION, '2026.05.no-api-kit-reconciliation-v1', 'Kit reconciliation version must be stable.');
assert.equal(KIT_RECONCILIATION_RULES.length, 6, 'Kit reconciliation must expose 6 operating rules.');
const manualKitReconciliation = buildKitReconciliation({
  inventory: supplyInventory,
  nurses: [{ id: 'market-nurse', name: 'Market Nurse', kit: 'Ready' }],
  deductionLedger: cleanVisitCloseout.deductionProof,
  wasteLogs: [{ id: 'waste-iv', itemId: 'iv', name: 'IV Bag - 1L Normal Saline', qty: 1, reason: 'Bag damaged before route' }],
});
const reconciledIvBag = manualKitReconciliation.stock.find((item) => item.id === 'iv');
assert.equal(reconciledIvBag.projectedQty, 6, 'Kit reconciliation must subtract queued deductions and waste from central stock.');
assert.ok(manualKitReconciliation.orders.some((order) => order.scope === 'Central'), 'Kit reconciliation must produce central restock or review orders.');
assert.ok(manualKitReconciliation.wasteQueue.some((entry) => entry.id === 'waste-iv'), 'Kit reconciliation must preserve manual waste logs.');
assert.ok(manualKitReconciliation.auditTrail.some((event) => event.type === 'inventory.deducted'), 'Kit reconciliation must produce deduction audit events.');
const kitReconciliationSnapshot = buildKitReconciliationSnapshot({
  requests: [
    { id: 'closeout-clean', client: 'Clean Client', city: 'SF', therapy: 'Hydration', total: 500, status: 'Completed', nurse: 'Market Nurse' },
    { id: 'closeout-missing', client: 'Missing Client', city: 'SF', therapy: 'Hydration', total: 250, status: 'Completed', nurse: 'Market Nurse' },
    { id: 'closeout-event', client: 'Event Client', city: 'SF', therapy: 'Myers Cocktail', total: 650, status: 'Completed', nurse: 'Market Nurse' },
  ],
  nurses: [{ id: 'market-nurse', name: 'Market Nurse', kit: 'Ready', area: 'SF' }],
  inventory: supplyInventory,
  closeouts: {
    'closeout-clean': cleanCloseout,
    'closeout-event': { ...cleanCloseout, adverseEvent: 'Lightheaded after service' },
  },
});
assert.equal(kitReconciliationSnapshot.metrics.visits, 3, 'Kit reconciliation snapshot must inherit closeout visit count.');
assert.ok(kitReconciliationSnapshot.metrics.queuedDeductions > 0, 'Kit reconciliation snapshot must count queued deductions.');
assert.ok(kitReconciliationSnapshot.metrics.lockedDeductions > 0, 'Kit reconciliation snapshot must count locked closeout deductions.');
assert.ok(kitReconciliationSnapshot.metrics.nurseRestock > 0, 'Kit reconciliation snapshot must produce nurse kit restock work.');
assert.ok(kitReconciliationSnapshot.metrics.centralRestock > 0, 'Kit reconciliation snapshot must produce central stock restock work.');
assert.ok(kitReconciliationSnapshot.coldChain.length >= 1, 'Kit reconciliation snapshot must expose cold-chain review.');
assert.ok(kitReconciliationSnapshot.auditTrail.some((event) => event.type === 'restock.needed'), 'Kit reconciliation snapshot must audit restock needs.');
assert.ok(kitReconciliationSnapshot.metrics.score < 100, 'Kit reconciliation score must penalize real stock and closeout risk.');
assert.equal(POST_VISIT_QA_VERSION, '2026.05.no-api-post-visit-qa-v1', 'Post-visit QA version must be stable.');
assert.equal(POST_VISIT_QA_RULES.length, 6, 'Post-visit QA must expose 6 operating rules.');
const cleanPostVisitQa = buildPostVisitQaRow({
  row: cleanVisitCloseout,
  request: {
    id: 'closeout-clean',
    client: 'Clean Client',
    therapy: 'Hydration',
    total: 500,
    status: 'Completed',
    payment: 'Paid',
    source: 'Hotel',
    visitCount: 4,
  },
  kitScore: 92,
});
assert.equal(cleanPostVisitQa.stage, 'Review Ready', 'Clean post-visit QA must unlock review-ready state.');
assert.equal(cleanPostVisitQa.aftercareReady, true, 'Clean post-visit QA must unlock aftercare.');
assert.equal(cleanPostVisitQa.reviewReady, true, 'Clean post-visit QA must unlock review ask.');
assert.equal(cleanPostVisitQa.rebookReady, true, 'Clean post-visit QA must unlock rebook.');
assert.equal(cleanPostVisitQa.membershipReady, true, 'High-fit clean post-visit QA must unlock membership.');
const eventPostVisitQa = buildPostVisitQaRow({
  row: eventVisitCloseout,
  request: { id: 'closeout-event', client: 'Event Client', therapy: 'Myers Cocktail', total: 650, status: 'Completed', payment: 'Paid' },
  kitScore: 92,
});
assert.equal(eventPostVisitQa.stage, 'Service Recovery', 'Incident post-visit QA must route to service recovery.');
assert.equal(eventPostVisitQa.reviewReady, false, 'Incident post-visit QA must lock review ask.');
assert.equal(eventPostVisitQa.rebookReady, false, 'Incident post-visit QA must lock rebook ask.');
const lowFeedbackPostVisitQa = buildPostVisitQaRow({
  row: cleanVisitCloseout,
  request: { id: 'closeout-clean', client: 'Clean Client', therapy: 'Hydration', total: 500, status: 'Completed', payment: 'Paid' },
  feedback: { visitId: 'closeout-clean', score: 2, issue: 'Slow arrival' },
  kitScore: 92,
});
assert.equal(lowFeedbackPostVisitQa.stage, 'Care Review', 'Low feedback must create care review before marketing.');
assert.equal(lowFeedbackPostVisitQa.reviewReady, false, 'Low feedback must suppress review ask.');
const postVisitQualitySnapshot = buildPostVisitQualitySnapshot({
  requests: [
    { id: 'closeout-clean', client: 'Clean Client', city: 'SF', therapy: 'Hydration', total: 500, status: 'Completed', nurse: 'Market Nurse', payment: 'Paid', source: 'Hotel', visitCount: 4 },
    { id: 'closeout-missing', client: 'Missing Client', city: 'SF', therapy: 'Hydration', total: 250, status: 'Completed', nurse: 'Market Nurse', payment: 'Paid' },
    { id: 'closeout-event', client: 'Event Client', city: 'SF', therapy: 'Myers Cocktail', total: 650, status: 'Completed', nurse: 'Market Nurse', payment: 'Paid' },
  ],
  nurses: [{ id: 'market-nurse', name: 'Market Nurse', kit: 'Ready', area: 'SF' }],
  inventory: supplyInventory,
  closeouts: {
    'closeout-clean': cleanCloseout,
    'closeout-event': { ...cleanCloseout, adverseEvent: 'Lightheaded after service' },
  },
});
assert.equal(postVisitQualitySnapshot.metrics.visits, 3, 'Post-visit QA snapshot must count visits.');
assert.ok(postVisitQualitySnapshot.metrics.aftercare >= 1, 'Post-visit QA snapshot must unlock aftercare for clean visits.');
assert.ok(postVisitQualitySnapshot.metrics.reviews >= 1, 'Post-visit QA snapshot must unlock review asks for clean visits.');
assert.ok(postVisitQualitySnapshot.metrics.rebooks >= 1, 'Post-visit QA snapshot must unlock rebook prompts for clean visits.');
assert.ok(postVisitQualitySnapshot.metrics.memberships >= 1, 'Post-visit QA snapshot must unlock high-fit membership prompts.');
assert.ok(postVisitQualitySnapshot.issueQueue.some((row) => row.stage === 'Service Recovery'), 'Post-visit QA snapshot must preserve service recovery lane.');
assert.ok(postVisitQualitySnapshot.auditTrail.some((event) => event.type === 'post_visit.aftercare'), 'Post-visit QA snapshot must audit aftercare actions.');

assert.match(enterprise, /ENTERPRISE_DOMAIN_SERVICES/, 'Enterprise domain services are missing.');
assert.match(enterprise, /H3 index/, 'Enterprise architecture must reserve H3 geospatial indexing.');
assert.match(enterprise, /PostGIS/, 'Enterprise architecture must reserve PostGIS geospatial indexing.');
assert.match(enterprise, /wallet ledger/, 'Enterprise architecture must reserve wallet ledger infrastructure.');
assert.match(enterprise, /Identity & Compliance Service/, 'Enterprise architecture must isolate identity and compliance.');
const enterpriseSnapshot = buildEnterpriseArchitectureSnapshot();
assert.equal(ENTERPRISE_PLATFORM_GOAL, 'Operating system for mobile medical operators', 'Enterprise platform goal is wrong.');
assert.equal(enterpriseSnapshot.serviceCount, 12, 'Enterprise architecture must expose 12 domain services.');
assert.equal(enterpriseSnapshot.sides.length, 3, 'Enterprise architecture must expose demand, supply, and core sides.');
assert.equal(enterpriseSnapshot.eventCount, 12, 'Enterprise event spine must expose 12 canonical events.');
assert.match(enterpriseSpine, /buildEnterpriseActionQueue/, 'Enterprise spine action queue is missing.');
assert.match(enterpriseSpine, /buildEnterpriseDispatchMatrix/, 'Enterprise spine dispatch matrix is missing.');
assert.match(enterpriseSpine, /buildEnterpriseInventoryLedger/, 'Enterprise spine inventory ledger is missing.');
assert.match(enterpriseSpine, /buildNurseMissionPacket/, 'Enterprise spine mission packet is missing.');
assert.match(enterpriseSpine, /placeholder-only/, 'Enterprise spine must enforce placeholder-only clinical mode.');
assert.equal(CANONICAL_DATA_CONTRACTS.length, 8, 'Enterprise spine must expose 8 canonical data contracts.');
assert.equal(ENTERPRISE_CLINICAL_MODE, 'placeholder-only', 'Enterprise spine clinical mode must be placeholder-only.');
assert.match(productionHealthcareCore, /PRODUCTION_HEALTHCARE_CORE_VERSION/, 'Production healthcare core engine is missing.');
assert.match(productionHealthcareCore, /PRODUCTION_CORE_DOMAINS/, 'Production healthcare domain map is missing.');
assert.match(productionHealthcareCore, /runProductionHealthcareCoreSweep/, 'Production healthcare core sweep is missing.');
assert.match(productionHealthcareMigration, /create schema if not exists app_private/, 'Production migration must keep auth helpers out of public schema.');
assert.match(productionHealthcareMigration, /enable row level security/, 'Production migration must enable RLS.');
assert.match(productionHealthcareMigration, /consent_signatures/, 'Production migration must create consent signatures.');
assert.match(productionHealthcareMigration, /medical_record_locks/, 'Production migration must create medical record locks.');
assert.match(productionHealthcareMigration, /reconciliation_cases/, 'Production migration must create reconciliation cases.');
assert.match(productionHealthcareMigration, /notification_delivery_events/, 'Production migration must create delivery proof.');
assert.match(productionHealthcareMigration, /production_core_readiness\s*\nwith \(security_invoker = true\)/, 'Production readiness view must be security invoker.');
assert.equal(PRODUCTION_HEALTHCARE_CORE_VERSION, '2026.05.pre-api-healthcare-core-v1', 'Production healthcare core version is wrong.');
assert.equal(PRODUCTION_CORE_MIGRATION, 'supabase/migrations/003_healthcare_os_core.sql', 'Production core migration path is wrong.');
assert.equal(PRODUCTION_CORE_DOMAINS.length, 15, 'Production healthcare core must cover all 15 critical domains.');
assert.equal(PRE_API_HEALTHCARE_GAP_CLOSURES.length, 15, 'All production domains must have pre-API closure controls.');
assert.equal(BIG_FIVE_REAL_GAPS.length, 5, 'Production healthcare core must expose the five real gaps.');
assert.ok(PRODUCTION_CORE_RLS_FAMILIES.length >= 7, 'Production healthcare core must expose RLS families.');
const productionCoreSnapshot = buildProductionHealthcareCoreSnapshot();
assert.ok(productionCoreSnapshot.contractScore >= 900, 'Production healthcare core contract score must be enterprise-grade.');
assert.ok(productionCoreSnapshot.preApiClosureScore >= 940, 'Production healthcare core pre-API closure must be elite.');
assert.equal(productionCoreSnapshot.preApiClosed, true, 'Production healthcare core must have no open pre-API gaps.');
assert.equal(productionCoreSnapshot.openPreApiGaps.length, 0, 'Production healthcare core cannot hide open pre-API gaps.');
assert.equal(productionCoreSnapshot.p0Closed, productionCoreSnapshot.p0Total, 'All P0 production contracts must be shipped pre-API.');
assert.ok(productionCoreSnapshot.bigFiveScore >= 94, 'The five real gaps must be pre-API controlled.');
assert.ok(productionCoreSnapshot.apiResiduals.length >= 15, 'Production healthcare core must preserve API residual warnings.');
const preApiRoadmapSnapshot = buildPreApiPhaseRoadmapSnapshot({
  requests: [{
    id: 'phase-request',
    client: 'Phase Client',
    city: 'SF',
    time: 'Today 5:00 PM',
    therapy: 'Hydration',
    intake: 'Done',
    consent: 'Done',
    gfe: 'Cleared',
    nurse: 'Phase Nurse',
    payment: 'Paid',
  }],
  nurses: [{ id: 'phase-nurse', name: 'Phase Nurse', status: 'Available', area: 'SF', kit: 'Ready' }],
  inventory: [{ id: 'iv-bags', name: 'IV Bags (1L)', status: 'Ready', detail: '12 remaining' }],
});
assert.equal(PRE_API_PHASE_CLOSURE_CONTROLS.length, 24, 'Every pre-API phase must have closure proof.');
assert.equal(preApiRoadmapSnapshot.phaseCount, 24, 'Pre-API roadmap must target 24 phases.');
assert.equal(preApiRoadmapSnapshot.phases.length, 24, 'Pre-API roadmap must expose all 24 phases.');
assert.equal(preApiRoadmapSnapshot.shipped, 24, 'All 24 pre-API phases must be shipped.');
assert.equal(preApiRoadmapSnapshot.complete, true, 'Pre-API roadmap must be complete.');
assert.equal(preApiRoadmapSnapshot.preApiClosed, true, 'Pre-API roadmap must close every no-API gap.');
assert.equal(preApiRoadmapSnapshot.openPreApiGaps.length, 0, 'Pre-API roadmap cannot leave open no-API gaps.');
assert.equal(preApiRoadmapSnapshot.closureScore, 100, 'Pre-API roadmap closure score must be complete.');
assert.equal(preApiRoadmapSnapshot.noApiBuilds, 132, 'Pre-API roadmap must preserve 132 builds.');
const spineSnapshot = buildEnterpriseSpineSnapshot({
  requests: [{
    id: 'test-request',
    client: 'Test Client',
    city: 'SF',
    time: 'Today 5:00 PM',
    therapy: 'Myers Cocktail + NAD+',
    addons: ['Glutathione Push'],
    intake: 'Pending',
    consent: 'Pending',
    gfe: 'Pending',
    nurse: 'Unassigned',
    payment: 'Pending',
    guests: 1,
  }],
  nurses: [{
    id: 'test-nurse',
    name: 'Test Nurse',
    status: 'Available',
    area: 'SF',
    kit: 'Ready',
    visits: 0,
  }],
  inventory: [
    { id: 'iv-bags', name: 'IV Bags (1L)', status: 'Ready', detail: '12 remaining' },
    { id: 'nad', name: 'NAD+ (250mg)', status: 'Ready', detail: '8 vials' },
    { id: 'glutathione', name: 'Glutathione 600mg', status: 'Ready', detail: '14 vials' },
    { id: 'b-complex', name: 'B-Complex', status: 'Ready', detail: 'Adequate' },
    { id: 'vitamin-c', name: 'Vitamin C (50ml)', status: 'Ready', detail: '9 remaining' },
  ],
});
assert.equal(spineSnapshot.metrics.contracts, 8, 'Enterprise spine snapshot must count 8 contracts.');
assert.equal(spineSnapshot.clinicalMode, 'placeholder-only', 'Enterprise spine snapshot must keep clinical data placeholder-only.');
assert.ok(spineSnapshot.actionQueue.length >= 4, 'Enterprise spine must produce blockers from incomplete local state.');
assert.ok(spineSnapshot.dispatchMatrix[0]?.best?.score >= 1, 'Enterprise spine must score dispatch matches.');
assert.ok(spineSnapshot.inventoryLedger.transactions.length >= 1, 'Enterprise spine must produce inventory transactions.');
assert.match(spineSnapshot.missionPacket.route.etaRule, /sets final ETA/, 'Mission packet must preserve nurse final ETA authority.');
assert.match(clinicalPolicy, /placeholder-only/, 'Clinical data mode must be placeholder-only.');
assert.match(clinicalPolicy, /Do not store real clinical notes/, 'Clinical placeholder policy must block real clinical notes.');
assert.match(clinicalPolicy, /Acuity remains the chart/, 'Clinical placeholder policy must preserve Acuity as chart source.');
assert.doesNotMatch(adminMock, /clinical_notes: '[^']{3,}'/, 'Mock admin data must not include real-looking clinical notes.');
const clinicalSnapshot = buildClinicalPlaceholderSnapshot();
assert.equal(CLINICAL_DATA_MODE, 'placeholder-only', 'Clinical data mode must remain placeholder-only.');
assert.equal(clinicalSnapshot.blocked.includes('Do not store real clinical notes'), true, 'Clinical policy must block real clinical notes.');
assert.match(member, /Real Status/, 'Client portal must surface hardened real-status tracker.');
assert.match(nurse, /setKernelNurseEta/, 'Nurse portal must let nurse set final ETA.');

const annualGfe = {
  status: 'Valid',
  validUntil: new Date(Date.now() + 280 * 24 * 60 * 60 * 1000).toISOString(),
};
const returningBooking = {
  service: 'Hydration',
  status: 'Nurse Assigned',
  nurse: 'Stephanie R.',
  isNewClient: false,
  visitCount: 4,
  gfeRecord: annualGfe,
  gfe: 'Cleared',
};
const gfe = resolveGfeRequirement(returningBooking);
assert.equal(gfe.required, false, 'Returning annual GFE should not require a new GFE.');
assert.equal(validateTransition(returningBooking, 'En Route').ok, true, 'Annual GFE should allow dispatch after nurse assignment.');

const expired = resolveGfeRequirement({
  ...returningBooking,
  gfeRecord: { status: 'Valid', validUntil: '2024-01-01' },
});
assert.equal(expired.required, true, 'Expired annual GFE must require review.');

console.log('Avalon Kernel first-60 checks passed.');
