import { appendActivity, readLocal, writeLocal } from '../../src/lib/localOs.js';
import {
  appendRepositoryEvent,
  queueCrossPortalEvent,
  syncLocalRepository,
} from '../../src/lib/localRepository.js';
import { buildArrivalMissionSnapshot } from '../../src/lib/arrivalMissionBrain.js';
import { buildPostVisitQualitySnapshot } from '../../src/lib/postVisitQualityBrain.js';
import { buildLocalExecutionSnapshot } from '../../src/lib/localExecutionEngine.js';
import { resolveGfeRequirement } from '../../src/lib/bookingLifecycle.js';

export const LOCAL_RELIABILITY_ENGINE_VERSION = '2026.05.no-api-reliability-v1';

export const LOCAL_RELIABILITY_PHASES = [
  {
    id: 'phase-7',
    label: 'Exception Command',
    goal: 'Collapse booking, route, chart, inventory, and nurse blockers into one owner/action queue.',
    api: false,
  },
  {
    id: 'phase-8',
    label: 'Comms Orchestration',
    goal: 'Model every alert, announcement, client text, and nurse prompt without sending real messages.',
    api: false,
  },
  {
    id: 'phase-9',
    label: 'Launch Simulator',
    goal: 'Stress the local operating system before Acuity, SMS, Nursys, finance, and CRM APIs are live.',
    api: false,
  },
];

export const RELIABILITY_API_BOUNDARIES = [
  { id: 'acuity', label: 'Acuity', owns: 'Scheduling, EMR, intake destination, appointment record', mode: 'Placeholder handoff' },
  { id: 'qualiphy', label: 'Qualiphy', owns: 'GFE only when no Avalon remote NP is on call', mode: 'Fallback only' },
  { id: 'nursys', label: 'Nursys', owns: 'License verification', mode: 'Credential placeholder' },
  { id: 'stripe', label: 'Stripe or Acuity Pay', owns: '$1 deductible and checkout confirmation', mode: 'Payment placeholder' },
  { id: 'attio', label: 'Attio', owns: 'CRM routing and follow-up ownership', mode: 'CRM placeholder' },
  { id: 'mercury', label: 'Mercury', owns: 'Banking reconciliation', mode: 'Finance placeholder' },
  { id: 'gusto', label: 'Gusto', owns: 'Payroll execution', mode: 'Payroll placeholder' },
  { id: 'quickbooks', label: 'QuickBooks', owns: 'Accounting export', mode: 'Accounting placeholder' },
];

const SEVERITY_SCORE = {
  Critical: 4,
  High: 3,
  Action: 2,
  Medium: 2,
  Watch: 1,
  Low: 1,
};

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

function normalizeSeverity(value = '') {
  const text = String(value || '').trim();
  if (/critical|block|danger/i.test(text)) return 'Critical';
  if (/high|hold|late/i.test(text)) return 'High';
  if (/action|medium|needed|review/i.test(text)) return 'Action';
  return 'Watch';
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

function paymentReady(request = {}) {
  return /paid|deposit|captured|authorized|invoice/i.test(`${request.payment || ''} ${request.paymentStatus || ''} ${request.depositStatus || ''}`);
}

function valueReady(request = '') {
  return /done|complete|signed|clear|valid|paid|confirmed/i.test(String(request || ''));
}

function buildKernelLikeExceptions({ requests = [], nurses = [], booking = null } = {}) {
  return activeRequests(requests, booking).flatMap((request, index) => {
    const items = [];
    const id = request.id || request.reference || `visit-${index + 1}`;
    const client = request.client || request.contact?.name || 'Client';
    const gfe = resolveGfeRequirement(request);
    const nurseName = request.nurse || request.nurseName || request.assignedNurse || '';
    const hasKnownNurse = nurseName && nurseName !== 'Unassigned' && nurses.some((nurse) => compactText(nurse.name) === compactText(nurseName));
    const assigned = hasKnownNurse || (nurseName && nurseName !== 'Unassigned');
    const eta = request.eta || request.routeEta || request.nurseEta || '';

    if (!valueReady(request.intake) || /intake pending/i.test(request.status || '')) {
      items.push({ id: `${id}-intake`, severity: 'High', label: 'Intake incomplete', owner: 'Client Ops', action: 'Collect minimum intake before dispatch.', client, visitId: id });
    }
    if (!valueReady(request.consent)) {
      items.push({ id: `${id}-consent`, severity: 'High', label: 'Consent incomplete', owner: 'Client Ops', action: 'Consent required before treatment.', client, visitId: id });
    }
    if (gfe.required) {
      items.push({ id: `${id}-gfe`, severity: 'Critical', label: 'GFE required', owner: 'Clinical', action: 'Avalon NP first. Qualiphy only if no Avalon NP is on call.', client, visitId: id });
    }
    if (!paymentReady(request)) {
      items.push({ id: `${id}-payment`, severity: 'Action', label: 'Deposit not confirmed', owner: 'Client Ops', action: 'Confirm payment state before dispatch.', client, visitId: id });
    }
    if (!assigned) {
      items.push({ id: `${id}-nurse`, severity: 'High', label: 'No nurse accepted', owner: 'Dispatch', action: 'Open Y/N offer loop or assign manually.', client, visitId: id });
    }
    if (assigned && !eta && /ready|assigned|route|visit|confirmed/i.test(request.status || '')) {
      items.push({ id: `${id}-eta`, severity: 'High', label: 'Nurse ETA missing', owner: 'Nurse', action: 'Nurse sets final ETA before client text.', client, visitId: id });
    }
    return items;
  });
}

function buildNotificationPreferenceCenter() {
  return {
    status: 'Local',
    channels: ['Client SMS placeholder', 'Nurse SMS placeholder', 'Admin in-app', 'Ops announcement'],
    rule: 'Respect quiet hours, role visibility, and no duplicate pings.',
  };
}

function buildAnnouncementGovernance() {
  return {
    status: 'Governed',
    required: ['owner', 'audience', 'expiry', 'read state'],
  };
}

function buildBroadcastRateLimit() {
  return {
    status: 'Ready',
    maxPerShift: 3,
    rule: 'One live offer loop per visit before escalation.',
  };
}

function buildIncidentPacket({ booking = null } = {}) {
  const status = booking?.incident || booking?.incidentStatus || '';
  const active = /incident|adverse|escalat|flag/i.test(String(status));
  return {
    status: active ? 'Action' : 'Armed',
    items: active ? [{ id: 'incident-active', label: status || 'Incident flagged' }] : [],
  };
}

function estimateLaunchCapacity({ requests = [], nurses = [] } = {}) {
  const active = activeRequests(requests);
  const available = nurses.filter((nurse) => /available|ready|active/i.test(`${nurse.status || ''} ${nurse.kit || ''}`)).length;
  const sameDay = active.filter((request) => /today|ready|confirmed|assigned/i.test(`${request.time || ''} ${request.status || ''}`)).length;
  const ratio = sameDay ? available / sameDay : available ? 1 : 0;
  const score = Math.min(100, Math.round(ratio * 82 + Math.min(18, available * 3)));
  return {
    status: score >= 85 ? 'Ready' : score >= 65 ? 'Constrained' : 'Blocked',
    score,
    available,
    sameDay,
  };
}

function exceptionId(source, item = {}, index = 0) {
  return `${source}-${item.id || item.visitId || item.requestId || item.client || index}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

function exceptionRow({
  source,
  item = {},
  index = 0,
  severity = item.severity,
  owner = item.owner,
  label = item.label,
  action = item.action,
  client = item.client,
  visitId = item.visitId || item.requestId,
} = {}) {
  const normalizedSeverity = normalizeSeverity(severity);
  return {
    id: exceptionId(source, item, index),
    source,
    visitId: visitId || item.bookingId || '',
    client: client || item.client || 'Operational queue',
    severity: normalizedSeverity,
    owner: owner || (normalizedSeverity === 'Critical' ? 'Admin' : 'Ops'),
    label: label || item.reason || item.stage || 'Operating exception',
    action: action || item.nextAction || item.reason || 'Assign owner and resolve before live service.',
    status: normalizedSeverity === 'Watch' ? 'Monitor' : 'Open',
    noApi: true,
  };
}

function buildExceptionCommand({ kernelExceptions = [], arrival, postVisit, execution } = {}) {
  const rows = [
    ...(kernelExceptions || []).map((item, index) => exceptionRow({ source: 'kernel', item, index })),
    ...(arrival.escalations || []).map((item, index) => exceptionRow({
      source: 'arrival',
      item,
      index,
      owner: item.reason === 'Accepted shift missing nurse ETA' ? 'Nurse' : 'Dispatch',
      label: item.reason,
      action: item.action,
    })),
    ...(postVisit.issueQueue || []).map((item, index) => exceptionRow({
      source: 'post-visit',
      item,
      index,
      severity: item.risk === 'critical' ? 'High' : 'Action',
      owner: item.stage === 'Closeout Lock' ? 'Nurse' : 'Client Ops',
      label: item.stage,
      action: item.nextAction || item.issue || 'Resolve post-visit QA before growth prompt.',
      visitId: item.visitId,
    })),
    ...(execution.visits || [])
      .filter((visit) => visit.blockers?.length)
      .map((visit, index) => exceptionRow({
        source: 'execution',
        item: visit,
        index,
        severity: visit.risk === 'critical' ? 'Critical' : 'Action',
        owner: visit.blockers?.[0] === 'GFE' ? 'Clinical' : visit.blockers?.[0] === 'Nurse' ? 'Dispatch' : 'Ops',
        label: `${visit.blockers?.[0]} blocked`,
        action: visit.nextAction,
        client: visit.client,
        visitId: visit.id,
      })),
  ];

  const deduped = rows.filter((row, index, all) => (
    all.findIndex((item) => (
      item.source === row.source
      && item.visitId === row.visitId
      && compactText(item.label) === compactText(row.label)
    )) === index
  ));

  return deduped.sort((a, b) => (
    (SEVERITY_SCORE[b.severity] || 0) - (SEVERITY_SCORE[a.severity] || 0)
    || compactText(a.owner).localeCompare(compactText(b.owner))
  ));
}

function commsRoute({ id, label, owner, audience, status, trigger, apiWall = '', action = '' }) {
  return {
    id,
    label,
    owner,
    audience,
    status,
    trigger,
    apiWall,
    action,
    ready: /ready|publish|loaded|active|pass/i.test(status),
  };
}

function buildCommsOrchestration({ kernel, arrival, exceptions, execution } = {}) {
  const notificationPrefs = buildNotificationPreferenceCenter();
  const announcements = buildAnnouncementGovernance();
  const broadcastLimit = buildBroadcastRateLimit();
  const routes = [
    commsRoute({
      id: 'client-clearance',
      label: 'Client clearance text',
      owner: 'Clinical Ops',
      audience: 'Client',
      status: exceptions.some((item) => item.label.includes('GFE')) ? 'Hold' : 'Ready',
      trigger: 'After intake and annual GFE decision',
      apiWall: 'SMS provider',
      action: 'Publish only eligibility-safe copy.',
    }),
    commsRoute({
      id: 'nurse-offer',
      label: 'Nurse Y/N offer',
      owner: 'Dispatch',
      audience: 'Nurse',
      status: execution.metrics.dispatchReady > 0 ? 'Ready' : 'Hold',
      trigger: 'Ready visit without accepted nurse',
      apiWall: 'SMS or push',
      action: 'Send city, time, value, protocol class, accept/decline.',
    }),
    commsRoute({
      id: 'nurse-eta',
      label: 'Nurse ETA prompt',
      owner: 'Nurse',
      audience: 'Nurse',
      status: arrival.metrics.etaNeeded > 0 ? 'Action' : 'Ready',
      trigger: 'Nurse accepted visit',
      apiWall: 'SMS or nurse app push',
      action: 'Nurse has final say. Client ETA stays hidden until set.',
    }),
    commsRoute({
      id: 'client-eta',
      label: 'Client ETA publish',
      owner: 'Dispatch',
      audience: 'Client',
      status: arrival.metrics.clientTexts > 0 ? 'Publish' : 'Hidden',
      trigger: 'Nurse sets final ETA',
      apiWall: 'SMS provider',
      action: 'Send nurse ETA, contact option, and service boundary.',
    }),
    commsRoute({
      id: 'ops-announcement',
      label: 'Ops announcement',
      owner: 'Admin',
      audience: 'Team',
      status: announcements.status || 'Governed',
      trigger: 'Policy, launch, market, or incident update',
      action: 'Require owner, expiry, audience, and read state.',
    }),
    commsRoute({
      id: 'broadcast-rate',
      label: 'Broadcast rate guard',
      owner: 'Admin',
      audience: 'Team',
      status: broadcastLimit.status || 'Ready',
      trigger: 'Before bulk alert',
      action: 'Prevent noisy threads and duplicate nurse pings.',
    }),
    commsRoute({
      id: 'incident-alert',
      label: 'Incident escalation',
      owner: 'Clinical',
      audience: 'Admin + Clinical',
      status: kernel.scale?.incidentPacket?.status || 'Armed',
      trigger: 'Incident or adverse event flag',
      action: 'Route to clinical owner before retention or review asks.',
    }),
  ];

  const gaps = routes
    .filter((route) => !route.ready || route.apiWall)
    .map((route) => ({
      id: `gap-${route.id}`,
      label: route.label,
      owner: route.owner,
      blocker: route.apiWall || route.status,
      localFix: route.action,
    }));

  return {
    preferences: notificationPrefs,
    announcements,
    broadcastLimit,
    routes,
    gaps,
    ready: routes.filter((route) => route.ready).length,
    blocked: routes.length - routes.filter((route) => route.ready).length,
  };
}

function buildLaunchSimulator({ kernel, arrival, postVisit, execution, exceptions, requests, nurses } = {}) {
  const capacity = estimateLaunchCapacity({ requests, nurses });
  const critical = exceptions.filter((item) => item.severity === 'Critical').length;
  const high = exceptions.filter((item) => item.severity === 'High').length;
  const gates = [
    {
      id: 'exception-command',
      label: 'Exception command',
      clear: critical === 0,
      detail: `${critical} critical, ${high} high.`,
    },
    {
      id: 'dispatch-capacity',
      label: 'Dispatch capacity',
      clear: /ready|live|pass|available/i.test(`${capacity.status || ''}`) || number(capacity.score, 0) >= 70,
      detail: capacity.status || `${number(capacity.score, 0)}/100`,
    },
    {
      id: 'arrival',
      label: 'Arrival flow',
      clear: arrival.metrics.etaNeeded === 0 && arrival.metrics.escalations <= 2,
      detail: `${arrival.metrics.routeReady} route ready, ${arrival.metrics.etaNeeded} ETA needed.`,
    },
    {
      id: 'closeout-qa',
      label: 'Closeout QA',
      clear: postVisit.metrics.issues === 0 || postVisit.metrics.avgQa >= 80,
      detail: `${postVisit.metrics.issues} issue(s), ${postVisit.metrics.avgQa}/100 QA.`,
    },
    {
      id: 'execution-gate',
      label: 'Execution gate',
      clear: execution.gate.score >= 70,
      detail: `${execution.gate.status}, ${execution.gate.score}/100.`,
    },
    {
      id: 'clinical-boundary',
      label: 'Clinical boundary',
      clear: true,
      detail: 'Clinical data remains placeholder-only until Avalon shares approved protocol data.',
    },
    {
      id: 'api-boundary',
      label: 'API boundary',
      clear: true,
      detail: 'Acuity, Qualiphy, Nursys, finance, and CRM actions are modeled, not sent.',
    },
  ];
  const clear = gates.filter((gate) => gate.clear).length;
  const score = Math.round((clear / gates.length) * 100);

  return {
    capacity,
    gates,
    clear,
    blocked: gates.length - clear,
    score,
    status: score >= 92 ? 'Launch Ready' : score >= 72 ? 'Constrained' : 'Blocked',
  };
}

function phaseScore({ phaseId, exceptions, comms, launch } = {}) {
  if (phaseId === 'phase-7') {
    const critical = exceptions.filter((item) => item.severity === 'Critical').length;
    const high = exceptions.filter((item) => item.severity === 'High').length;
    return Math.max(0, 100 - critical * 24 - high * 11 - Math.max(0, exceptions.length - critical - high) * 4);
  }
  if (phaseId === 'phase-8') {
    return Math.round((comms.ready / Math.max(1, comms.routes.length)) * 100);
  }
  return launch.score;
}

export function buildLocalReliabilitySnapshot({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const execution = buildLocalExecutionSnapshot(seed);
  const arrival = buildArrivalMissionSnapshot(seed);
  const postVisit = buildPostVisitQualitySnapshot(seed);
  const incidentPacket = buildIncidentPacket({ booking });
  const kernelExceptions = buildKernelLikeExceptions({ requests, nurses, booking });
  const exceptions = buildExceptionCommand({
    kernelExceptions,
    arrival,
    postVisit,
    execution,
  });
  const kernel = {
    exceptions: kernelExceptions,
    scale: { incidentPacket },
  };
  const comms = buildCommsOrchestration({ kernel, arrival, exceptions, execution });
  const launch = buildLaunchSimulator({
    kernel,
    arrival,
    postVisit,
    execution,
    exceptions,
    requests,
    nurses,
  });
  const phaseScores = LOCAL_RELIABILITY_PHASES.map((phase) => {
    const score = phaseScore({ phaseId: phase.id, exceptions, comms, launch });
    return {
      ...phase,
      score,
      status: score >= 90 ? 'Ready' : score >= 70 ? 'Action' : 'Blocked',
    };
  });
  const metrics = {
    exceptions: exceptions.length,
    critical: exceptions.filter((item) => item.severity === 'Critical').length,
    commsReady: comms.ready,
    commsRoutes: comms.routes.length,
    launchScore: launch.score,
    routeReady: arrival.metrics.routeReady,
    clientTexts: arrival.metrics.clientTexts,
    incidents: incidentPacket?.items?.length || incidentPacket?.events?.length || 0,
  };

  return {
    version: LOCAL_RELIABILITY_ENGINE_VERSION,
    phases: LOCAL_RELIABILITY_PHASES,
    metrics,
    exceptions,
    comms,
    launch,
    phaseScores,
    apiBoundaries: RELIABILITY_API_BOUNDARIES,
    kernel,
    execution,
    arrival,
    postVisit,
    incidentPacket,
    status: launch.status,
    score: Math.round(phaseScores.reduce((sum, phase) => sum + phase.score, 0) / phaseScores.length),
  };
}

export function runLocalReliabilitySweep({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
  actor = 'Avalon OS',
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const snapshot = buildLocalReliabilitySnapshot(seed);
  const repo = syncLocalRepository(seed, actor);
  const openEvents = snapshot.exceptions
    .filter((item) => ['Critical', 'High', 'Action'].includes(item.severity))
    .slice(0, 18)
    .map((item) => queueCrossPortalEvent({
      type: 'reliability.exception.open',
      visitId: item.visitId,
      actor,
      payload: {
        visitId: item.visitId,
        source: item.source,
        owner: item.owner,
        severity: item.severity,
        label: item.label,
        action: item.action,
        clientVisible: false,
        nurseVisible: item.owner === 'Nurse',
      },
    }));
  const commsEvents = snapshot.comms.routes
    .filter((route) => route.status === 'Action' || route.status === 'Publish')
    .slice(0, 8)
    .map((route) => queueCrossPortalEvent({
      type: 'reliability.comms.route',
      actor,
      payload: {
        routeId: route.id,
        audience: route.audience,
        owner: route.owner,
        status: route.status,
        trigger: route.trigger,
        clientVisible: route.audience === 'Client' && route.status === 'Publish',
        nurseVisible: route.audience === 'Nurse',
      },
    }));
  const ledgerEvent = appendRepositoryEvent({
    type: 'reliability.sweep.completed',
    entityType: 'reliability',
    entityId: LOCAL_RELIABILITY_ENGINE_VERSION,
    actor,
    payload: {
      exceptions: snapshot.metrics.exceptions,
      critical: snapshot.metrics.critical,
      commsReady: snapshot.metrics.commsReady,
      launchScore: snapshot.metrics.launchScore,
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
      exceptions: snapshot.metrics.exceptions,
      critical: snapshot.metrics.critical,
    },
    ...readLocal('localReliabilityLedger', []),
  ].slice(0, 180);
  writeLocal('localReliabilityLedger', ledger);
  appendActivity('Local reliability sweep complete', {
    role: actor,
    exceptions: snapshot.metrics.exceptions,
    launchScore: snapshot.metrics.launchScore,
  });

  return {
    snapshot: buildLocalReliabilitySnapshot(seed),
    repo,
    openEvents,
    commsEvents,
    ledgerEvent,
    ledger,
    actions: [
      ...openEvents.map((event) => ({ type: event.type, id: event.id })),
      ...commsEvents.map((event) => ({ type: event.type, id: event.id })),
      { type: ledgerEvent.type, id: ledgerEvent.id },
    ],
  };
}
