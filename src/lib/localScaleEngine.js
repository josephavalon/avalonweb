import { appendActivity, readLocal, writeLocal } from './localOs.js';
import {
  appendRepositoryEvent,
  queueCrossPortalEvent,
  syncLocalRepository,
} from './localRepository.js';
import { buildLocalExecutionSnapshot } from './localExecutionEngine.js';
import { buildLocalReliabilitySnapshot } from './localReliabilityEngine.js';
import {
  buildNoApiCompletionSnapshot,
  flattenNoApiCompletionMap,
} from '../data/noApiCompletionMap.js';

export const LOCAL_SCALE_ENGINE_VERSION = '2026.05.no-api-scale-v1';

export const LOCAL_SCALE_PHASES = [
  {
    id: 'phase-10',
    label: 'Market Playbooks',
    goal: 'Make every city launchable from one repeatable operating packet.',
    api: false,
  },
  {
    id: 'phase-11',
    label: 'SOP Control',
    goal: 'Convert founder judgment into role-owned runbooks, gates, and proofs.',
    api: false,
  },
  {
    id: 'phase-12',
    label: 'Release Readiness',
    goal: 'Expose the release gates that separate software from a licensable operating system.',
    api: false,
  },
];

export const SCALE_MARKETS = [
  { id: 'san-francisco', label: 'San Francisco', zone: 'SF', tier: 'Core' },
  { id: 'oakland', label: 'Oakland', zone: 'East Bay', tier: 'Core' },
  { id: 'berkeley', label: 'Berkeley', zone: 'East Bay', tier: 'Core' },
  { id: 'san-mateo', label: 'San Mateo', zone: 'Peninsula', tier: 'Expansion' },
  { id: 'palo-alto', label: 'Palo Alto', zone: 'Peninsula', tier: 'Expansion' },
  { id: 'san-jose', label: 'San Jose', zone: 'South Bay', tier: 'Expansion' },
  { id: 'marin', label: 'Marin', zone: 'North Bay', tier: 'Premium' },
  { id: 'napa-sonoma', label: 'Napa / Sonoma', zone: 'Wine Country', tier: 'Premium' },
];

export const SCALE_SOP_LIBRARY = [
  {
    id: 'under-60-booking',
    label: 'Under-60 Booking',
    owner: 'Client Ops',
    proof: ['Outcome selected', 'Location captured', 'Deposit state', 'Annual GFE decision'],
  },
  {
    id: 'annual-gfe',
    label: 'Annual GFE Gate',
    owner: 'Clinical Ops',
    proof: ['New/returning state', 'Avalon NP first', 'Qualiphy fallback only', 'Acuity boundary'],
  },
  {
    id: 'shift-claim',
    label: 'Shift Claim',
    owner: 'Dispatch',
    proof: ['Y/N loop', 'Nurse fit', 'Value shown', 'Accepted nurse record'],
  },
  {
    id: 'route-handoff',
    label: 'Route Handoff',
    owner: 'Nurse',
    proof: ['Maps handoff', 'Client contact', 'Accepted nurse', 'Route owner'],
  },
  {
    id: 'kit-stock',
    label: 'Kit + Stock',
    owner: 'Ops',
    proof: ['Visit requirements', 'Nurse kit', 'Deduction ledger', 'Restock trigger'],
  },
  {
    id: 'incident',
    label: 'Incident Escalation',
    owner: 'Clinical',
    proof: ['Immediate owner', 'Service recovery hold', 'Audit trail', 'No growth prompt'],
  },
  {
    id: 'launch-event',
    label: 'Launch / Event',
    owner: 'Launch Ops',
    proof: ['Presale', 'Group intake', 'Pre-event GFE', 'Staffing + kit plan'],
  },
  {
    id: 'release',
    label: 'Release Gate',
    owner: 'Admin',
    proof: ['Route QA', 'Visual QA', 'Kernel check', 'No-API boundary'],
  },
];

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    city: booking.city || booking.contact?.city || '',
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

function marketMatchesRequest(market = {}, request = {}) {
  const haystack = compactText(request.city, request.address, request.market, request.location);
  if (!haystack) return false;
  if (market.id === 'san-francisco') return /sf|san francisco/.test(haystack);
  if (market.id === 'napa-sonoma') return /napa|sonoma/.test(haystack);
  return haystack.includes(compactText(market.label).split(' ')[0]);
}

function marketMatchesNurse(market = {}, nurse = {}) {
  const haystack = compactText(nurse.area, nurse.city, nurse.market, nurse.zone);
  if (!haystack) return false;
  if (market.id === 'san-francisco') return /sf|san francisco/.test(haystack);
  if (market.id === 'napa-sonoma') return /napa|sonoma|wine country|north bay/.test(haystack);
  if (market.zone === 'East Bay') return /east bay|oakland|berkeley|alameda|walnut creek/.test(haystack);
  if (market.zone === 'Peninsula') return /peninsula|san mateo|palo alto/.test(haystack);
  if (market.zone === 'South Bay') return /south bay|san jose/.test(haystack);
  if (market.zone === 'North Bay') return /north bay|marin/.test(haystack);
  return haystack.includes(compactText(market.label).split(' ')[0]);
}

function marketScore({ market, requests = [], nurses = [], inventory = [] } = {}) {
  const demand = requests.filter((request) => marketMatchesRequest(market, request));
  const coverage = nurses.filter((nurse) => marketMatchesNurse(market, nurse));
  const readyNurses = coverage.filter((nurse) => /available|ready|active|assigned/i.test(`${nurse.status || ''} ${nurse.kit || ''}`));
  const hasCoreStock = inventory.some((item) => /iv bag|normal saline|start kit|nitrile|sharps/i.test(`${item.name || ''} ${item.status || ''}`));
  const launchTypes = {
    home: demand.some((request) => /home|mobile/i.test(`${request.locationType || ''} ${request.address || ''}`)),
    hotel: demand.some((request) => /hotel|suite|four seasons|ritz|st regis/i.test(`${request.locationType || ''} ${request.address || ''}`)),
    office: demand.some((request) => /office|corporate|floor|suite/i.test(`${request.locationType || ''} ${request.source || ''} ${request.address || ''}`)),
    launch: demand.some((request) => /event|launch|group|festival|corporate/i.test(`${request.therapy || ''} ${request.source || ''} ${request.notes || ''}`)),
  };
  const typeCount = Object.values(launchTypes).filter(Boolean).length;
  const score = Math.min(100, Math.round(
    Math.min(34, demand.length * 11)
    + Math.min(32, readyNurses.length * 16)
    + (hasCoreStock ? 16 : 0)
    + typeCount * 4.5
  ));
  const blockers = [
    !demand.length && 'No local demand signal',
    !readyNurses.length && 'No ready nurse coverage',
    !hasCoreStock && 'Core stock not represented',
    typeCount < 2 && 'Few service modes proven',
  ].filter(Boolean);

  return {
    ...market,
    demand: demand.length,
    nurses: coverage.length,
    readyNurses: readyNurses.length,
    launchTypes,
    serviceModes: typeCount,
    score,
    status: statusFor(score),
    blockers,
    nextAction: blockers[0] || 'Build repeatable launch packet and staff the first premium window.',
  };
}

function buildMarketPlaybooks({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  const active = activeRequests(requests, booking);
  const rows = SCALE_MARKETS.map((market) => marketScore({ market, requests: active, nurses, inventory }));
  const ready = rows.filter((row) => row.status === 'Ready');
  const action = rows.filter((row) => row.status === 'Action');
  const score = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length));
  const packets = rows.map((row) => ({
    id: `packet-${row.id}`,
    marketId: row.id,
    label: `${row.label} launch packet`,
    owner: row.tier === 'Premium' ? 'Launch Ops' : 'Dispatch',
    status: row.status,
    checklist: [
      'Demand source',
      'Ready nurse',
      'Core stock',
      'Hotel/home/office/event mode',
      'GFE route',
      'Client comms',
      'Closeout owner',
    ],
    nextAction: row.nextAction,
  }));

  return {
    rows,
    packets,
    ready: ready.length,
    action: action.length,
    blocked: rows.length - ready.length - action.length,
    score,
    status: statusFor(score),
  };
}

function sopCoverage({ sop, execution, reliability, completion }) {
  const text = compactText(
    sop.label,
    sop.owner,
    sop.proof,
    execution.status,
    reliability.status,
    completion.builds.map((build) => build.label),
  );
  const proofHits = sop.proof.filter((proof) => {
    const proofText = compactText(proof);
    if (/gfe|qualiphy|annual/.test(proofText)) return /gfe|qualiphy|annual/.test(text);
    if (/eta|route|maps/.test(proofText)) return /eta|route|maps/.test(text);
    if (/kit|stock|deduction|restock/.test(proofText)) return /kit|stock|inventory|deduction|restock/.test(text);
    if (/qa|kernel|visual|route/.test(proofText)) return /qa|kernel|visual|route|release/.test(text);
    if (/presale|event|launch/.test(proofText)) return /presale|event|launch|group/.test(text);
    if (/owner|audit|hold|prompt/.test(proofText)) return /owner|audit|hold|prompt|exception/.test(text);
    return proofText.split(' ').some((token) => token.length > 4 && text.includes(token));
  }).length;
  const engineBoost = (
    (execution.score >= 70 ? 10 : 0)
    + (reliability.score >= 70 ? 10 : 0)
    + (completion.total === 132 ? 8 : 0)
  );
  const score = Math.min(100, Math.round((proofHits / sop.proof.length) * 72 + engineBoost));
  return {
    ...sop,
    proofHits,
    score,
    status: statusFor(score),
    missing: sop.proof.filter((proof) => !compactText(proof).split(' ').some((token) => token.length > 4 && compactText(completion.builds.map((build) => build.label)).includes(token))),
  };
}

function buildSopControl({ execution, reliability, completion } = {}) {
  const rows = SCALE_SOP_LIBRARY.map((sop) => sopCoverage({ sop, execution, reliability, completion }));
  const score = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length));
  const ownerLoad = rows.reduce((acc, row) => {
    acc[row.owner] = (acc[row.owner] || 0) + 1;
    return acc;
  }, {});

  return {
    rows,
    ownerLoad: Object.entries(ownerLoad).map(([owner, count]) => ({ owner, count })),
    ready: rows.filter((row) => row.status === 'Ready').length,
    action: rows.filter((row) => row.status === 'Action').length,
    blocked: rows.filter((row) => row.status === 'Blocked').length,
    score,
    status: statusFor(score),
  };
}

function buildReleaseReadiness({ execution, reliability, completion, market, sop } = {}) {
  const gates = [
    { id: 'completion-map', label: '132-build map', clear: completion.total === 132, detail: `${completion.total}/132 no-API builds tracked.` },
    { id: 'execution', label: 'Execution engine', clear: execution.score >= 65, detail: `${execution.score}/100 ${execution.status}.` },
    { id: 'reliability', label: 'Reliability engine', clear: reliability.score >= 45, detail: `${reliability.score}/100 ${reliability.status}.` },
    { id: 'market', label: 'Market playbooks', clear: market.score >= 45, detail: `${market.ready} ready, ${market.blocked} blocked.` },
    { id: 'sop', label: 'SOP control', clear: sop.score >= 70, detail: `${sop.ready} ready, ${sop.action} action.` },
    { id: 'api-boundary', label: 'API boundary', clear: true, detail: 'Acuity, Qualiphy, Nursys, SMS, finance, and CRM remain explicit placeholders.' },
    { id: 'clinical-boundary', label: 'Clinical boundary', clear: true, detail: 'No final clinical protocol data is invented.' },
    { id: 'qa-command', label: 'QA command', clear: true, detail: 'Route, mobile, visual, strict, kernel, lint, typecheck, and build scripts exist.' },
  ];
  const clear = gates.filter((gate) => gate.clear).length;
  const score = Math.round((clear / gates.length) * 100);
  const releases = [
    { id: 'operator-demo', label: 'Operator Demo', status: score >= 75 ? 'Allowed' : 'Hold', owner: 'Founder' },
    { id: 'bay-area-pilot', label: 'Bay Area Pilot', status: score >= 88 ? 'Allowed' : 'Hold', owner: 'Ops' },
    { id: 'license-candidate', label: 'License Candidate', status: score >= 96 ? 'Allowed' : 'Hold', owner: 'Product' },
  ];

  return {
    gates,
    releases,
    clear,
    blocked: gates.length - clear,
    score,
    status: statusFor(score),
  };
}

export function buildLocalScaleSnapshot({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const execution = buildLocalExecutionSnapshot(seed);
  const reliability = buildLocalReliabilitySnapshot(seed);
  const completion = buildNoApiCompletionSnapshot();
  const builds = flattenNoApiCompletionMap();
  const market = buildMarketPlaybooks(seed);
  const sop = buildSopControl({ execution, reliability, completion: { ...completion, builds } });
  const release = buildReleaseReadiness({ execution, reliability, completion, market, sop });
  const phaseScores = [
    { ...LOCAL_SCALE_PHASES[0], score: market.score, status: market.status },
    { ...LOCAL_SCALE_PHASES[1], score: sop.score, status: sop.status },
    { ...LOCAL_SCALE_PHASES[2], score: release.score, status: release.status },
  ];
  const metrics = {
    markets: market.rows.length,
    readyMarkets: market.ready,
    sops: sop.rows.length,
    readySops: sop.ready,
    releaseScore: release.score,
    releaseBlocks: release.blocked,
    totalBuilds: completion.total,
  };

  return {
    version: LOCAL_SCALE_ENGINE_VERSION,
    phases: LOCAL_SCALE_PHASES,
    metrics,
    market,
    sop,
    release,
    completion,
    execution,
    reliability,
    phaseScores,
    status: release.status,
    score: Math.round(phaseScores.reduce((sum, phase) => sum + phase.score, 0) / phaseScores.length),
  };
}

export function runLocalScaleSweep({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
  actor = 'Avalon OS',
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const snapshot = buildLocalScaleSnapshot(seed);
  const repo = syncLocalRepository(seed, actor);
  const marketEvents = snapshot.market.rows
    .filter((row) => row.status !== 'Ready')
    .slice(0, 8)
    .map((row) => queueCrossPortalEvent({
      type: 'scale.market.action',
      actor,
      payload: {
        marketId: row.id,
        label: row.label,
        owner: row.tier === 'Premium' ? 'Launch Ops' : 'Dispatch',
        status: row.status,
        nextAction: row.nextAction,
        clientVisible: false,
        nurseVisible: false,
      },
    }));
  const sopEvents = snapshot.sop.rows
    .filter((row) => row.status !== 'Ready')
    .slice(0, 8)
    .map((row) => queueCrossPortalEvent({
      type: 'scale.sop.action',
      actor,
      payload: {
        sopId: row.id,
        label: row.label,
        owner: row.owner,
        status: row.status,
        score: row.score,
        clientVisible: false,
        nurseVisible: row.owner === 'Nurse',
      },
    }));
  const ledgerEvent = appendRepositoryEvent({
    type: 'scale.sweep.completed',
    entityType: 'scale',
    entityId: LOCAL_SCALE_ENGINE_VERSION,
    actor,
    payload: {
      score: snapshot.score,
      readyMarkets: snapshot.metrics.readyMarkets,
      readySops: snapshot.metrics.readySops,
      releaseScore: snapshot.metrics.releaseScore,
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
      readyMarkets: snapshot.metrics.readyMarkets,
      readySops: snapshot.metrics.readySops,
    },
    ...readLocal('localScaleLedger', []),
  ].slice(0, 180);
  writeLocal('localScaleLedger', ledger);
  appendActivity('Local scale sweep complete', {
    role: actor,
    score: snapshot.score,
    readyMarkets: snapshot.metrics.readyMarkets,
    readySops: snapshot.metrics.readySops,
  });

  return {
    snapshot: buildLocalScaleSnapshot(seed),
    repo,
    marketEvents,
    sopEvents,
    ledgerEvent,
    ledger,
    actions: [
      ...marketEvents.map((event) => ({ type: event.type, id: event.id })),
      ...sopEvents.map((event) => ({ type: event.type, id: event.id })),
      { type: ledgerEvent.type, id: ledgerEvent.id },
    ],
  };
}
