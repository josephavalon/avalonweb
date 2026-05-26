import { buildShiftMarketplaceSnapshot } from './shiftMarketplaceBrain.js';

export const ARRIVAL_MISSION_VERSION = '2026.05.no-api-arrival-mission-v1';
export const ARRIVAL_MISSION_MODE = 'local-route-placeholder';

export const ARRIVAL_MISSION_RULES = [
  'Route unlocks after nurse acceptance.',
  'The nurse sets the final ETA before client text.',
  'Client ETA copy only publishes after a real ETA exists.',
  'Apple and Google Maps are route handoffs, not tracked API state.',
  'Acuity remains the visit chart and closeout destination.',
  'Late or missing ETA escalates to dispatch.',
];

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function activeRequests(requests = [], booking = null) {
  const latest = booking ? [{
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.contact?.name || booking.client || 'Latest client',
    city: booking.city || booking.contact?.city || '',
    address: booking.address || booking.contact?.address || '',
    time: [booking.date, booking.time].filter(Boolean).join(' ') || booking.time || 'Time pending',
    therapy: booking.service || booking.plan || 'Avalon protocol',
    addons: booking.addons || [],
    total: booking.total || booking.depositAmount || 0,
    status: booking.status || 'New Request',
    intake: booking.intake || (booking.intakeComplete ? 'Done' : 'Pending'),
    consent: booking.consent || (booking.consentComplete ? 'Done' : 'Pending'),
    gfe: booking.gfe || (booking.gfeRequired ? 'Pending' : 'Cleared'),
    nurse: booking.nurse || 'Unassigned',
    payment: booking.payment || booking.paymentStatus || 'Pending',
    eta: booking.eta || booking.routeEta || '',
  }] : [];

  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/complete|cancel|archiv/i.test(request.status || ''))
    .filter((request) => {
      const id = request.id || request.reference || `${request.client}-${request.time}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function assignedNurseFor(request = {}, nurses = []) {
  const assigned = normalize(request.nurse);
  if (!assigned || assigned === 'unassigned') return null;
  return nurses.find((nurse) => normalize(nurse.name) === assigned) || {
    id: assigned.replace(/[^a-z0-9]+/g, '-'),
    name: request.nurse,
    status: 'Assigned',
    kit: 'Unknown',
  };
}

function clearanceBlockers(request = {}) {
  const blockers = [];
  const status = normalize(request.status);
  const intake = normalize(request.intake);
  const consent = normalize(request.consent);
  const gfe = normalize(request.gfe);
  const payment = normalize(request.payment);

  if (/pending|not started|required|missing/.test(intake) || status.includes('intake pending')) blockers.push('Intake');
  if (/pending|not started|required|missing/.test(consent) || status.includes('consent pending')) blockers.push('Consent');
  if (/pending|not started|required|missing/.test(gfe) || status.includes('gfe pending')) blockers.push('GFE');
  if (!/paid|invoice|captured|deposit|clear/.test(payment)) blockers.push('Deposit');
  return blockers;
}

function mapsFor(request = {}) {
  const query = [request.address, request.city].filter(Boolean).join(', ');
  return {
    apple: query ? `https://maps.apple.com/?q=${encodeURIComponent(query)}` : '',
    google: query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '',
  };
}

function readEta(request = {}, etaRecords = {}) {
  const id = request.id || request.reference || request.client || 'visit';
  const record = etaRecords[id] || etaRecords[String(id)] || null;
  if (typeof record === 'string') return record;
  return record?.eta || request.eta || request.routeEta || request.nurseEta || '';
}

function stageFor({ accepted, blockers = [], eta = '', maps = {} } = {}) {
  if (blockers.length) return 'Hold';
  if (!accepted) return 'Await Accept';
  if (!eta) return 'ETA Needed';
  if (!maps.apple || !maps.google) return 'Route Needs Address';
  return 'Client Text Ready';
}

function nextActionFor(stage, firstBlocker = '') {
  if (stage === 'Hold') return `Clear ${firstBlocker || 'readiness'} before route.`;
  if (stage === 'Await Accept') return 'Keep Y/N offer loop running.';
  if (stage === 'ETA Needed') return 'Prompt nurse to set final ETA.';
  if (stage === 'Route Needs Address') return 'Confirm exact address before map handoff.';
  return 'Text client and open route.';
}

export function buildArrivalMission({ request = {}, nurse = null, offer = null, etaRecords = {} } = {}) {
  const accepted = Boolean(offer?.stage === 'Accepted' || nurse);
  const maps = mapsFor(request);
  const eta = readEta(request, etaRecords);
  const readinessBlockers = clearanceBlockers(request);
  if (!request.address) readinessBlockers.push('Address');
  const stage = stageFor({ accepted, blockers: readinessBlockers, eta, maps });
  const nurseName = offer?.nurseName || nurse?.name || request.nurse || 'Unassigned';
  const client = request.client || request.contact?.name || 'Client';
  const service = request.therapy || request.service || request.plan || 'Avalon protocol';

  return {
    id: `arrival-${request.id || request.reference || client}`,
    requestId: request.id || request.reference || client,
    client,
    service,
    nurseName,
    accepted,
    eta: eta || 'Nurse sets final ETA',
    etaMissing: accepted && !eta,
    stage,
    status: request.status || 'New Request',
    address: request.address || 'Address pending',
    city: request.city || 'Market pending',
    time: request.time || 'Time pending',
    maps,
    mapsReady: Boolean(maps.apple && maps.google && accepted),
    clientTextReady: stage === 'Client Text Ready',
    clientText: stage === 'Client Text Ready'
      ? `Avalon: ${nurseName} is on the way. ETA ${eta}. Please keep your phone nearby.`
      : 'Hold client ETA text until nurse accepts and sets final ETA.',
    nurseActions: [
      { id: 'eta', label: 'Set final ETA', owner: 'Nurse', status: eta ? 'Done' : accepted ? 'Needed' : 'Locked' },
      { id: 'maps', label: 'Open Apple/Google Maps', owner: 'Nurse', status: accepted && maps.apple ? 'Ready' : 'Locked' },
      { id: 'client-text', label: 'Text client', owner: 'Nurse', status: stage === 'Client Text Ready' ? 'Ready' : 'Locked' },
      { id: 'arrive', label: 'Mark arrived', owner: 'Nurse', status: stage === 'Client Text Ready' ? 'Ready' : 'Locked' },
      { id: 'acuity', label: 'Close in Acuity', owner: 'Nurse', status: 'After service' },
    ],
    handoffs: [
      { id: 'nurse-page', label: 'Nurse personal page', status: accepted ? 'Loaded' : 'Locked' },
      { id: 'client-portal', label: 'Client portal ETA', status: stage === 'Client Text Ready' ? 'Publish' : 'Hidden' },
      { id: 'sms', label: 'SMS placeholder', status: stage === 'Client Text Ready' ? 'Ready' : 'Hold' },
      { id: 'acuity', label: 'Acuity chart', status: 'System of record' },
    ],
    blockers: readinessBlockers,
    nextAction: nextActionFor(stage, readinessBlockers[0]),
    mode: ARRIVAL_MISSION_MODE,
  };
}

function buildEscalations(missions = []) {
  return missions.flatMap((mission) => {
    const items = [];
    if (mission.stage === 'Hold') {
      items.push({
        id: `${mission.id}-hold`,
        client: mission.client,
        severity: 'High',
        reason: mission.blockers[0] || 'Route hold',
        action: mission.nextAction,
      });
    }
    if (mission.stage === 'ETA Needed') {
      items.push({
        id: `${mission.id}-eta`,
        client: mission.client,
        severity: 'Action',
        reason: 'Accepted shift missing nurse ETA',
        action: 'Ping nurse. No client ETA text until set.',
      });
    }
    if (mission.stage === 'Await Accept') {
      items.push({
        id: `${mission.id}-accept`,
        client: mission.client,
        severity: 'Watch',
        reason: 'No accepted nurse',
        action: 'Continue Y/N broadcast loop.',
      });
    }
    return items;
  }).sort((a, b) => {
    const rank = { High: 3, Action: 2, Watch: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });
}

export function buildArrivalMissionSnapshot({ requests = [], nurses = [], inventory = [], booking = null, etaRecords = {} } = {}) {
  const active = activeRequests(requests, booking);
  const marketplace = buildShiftMarketplaceSnapshot({ requests: active, nurses, inventory });
  const missionRows = active.map((request) => {
    const row = marketplace.rows.find((item) => item.requestId === (request.id || request.reference || request.client));
    const nurse = assignedNurseFor(request, nurses);
    const offer = row?.accepted || null;
    return buildArrivalMission({ request, nurse, offer, etaRecords });
  });
  const escalations = buildEscalations(missionRows);

  return {
    version: ARRIVAL_MISSION_VERSION,
    mode: ARRIVAL_MISSION_MODE,
    rules: ARRIVAL_MISSION_RULES,
    missions: missionRows,
    escalations,
    clientTexts: missionRows.filter((mission) => mission.clientTextReady),
    routeReady: missionRows.filter((mission) => mission.mapsReady),
    etaNeeded: missionRows.filter((mission) => mission.etaMissing),
    handoffChannels: [
      { id: 'nurse', label: 'Nurse page', status: missionRows.some((mission) => mission.accepted) ? 'Loaded' : 'Waiting' },
      { id: 'maps', label: 'Apple/Google Maps', status: missionRows.some((mission) => mission.mapsReady) ? 'Ready' : 'Locked' },
      { id: 'client', label: 'Client ETA', status: missionRows.some((mission) => mission.clientTextReady) ? 'Publish' : 'Hidden' },
      { id: 'acuity', label: 'Acuity closeout', status: 'Placeholder' },
    ],
    metrics: {
      visits: missionRows.length,
      accepted: missionRows.filter((mission) => mission.accepted).length,
      etaNeeded: missionRows.filter((mission) => mission.etaMissing).length,
      routeReady: missionRows.filter((mission) => mission.mapsReady).length,
      clientTexts: missionRows.filter((mission) => mission.clientTextReady).length,
      escalations: escalations.length,
    },
  };
}
