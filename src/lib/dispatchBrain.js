export const DISPATCH_BRAIN_VERSION = '2026.05.no-api-dispatch-v2';
export const DISPATCH_CLINICAL_MODE = 'placeholder-only';

export const DISPATCH_SCORE_FACTORS = [
  { id: 'availability', label: 'Availability', weight: 14 },
  { id: 'zone', label: 'Zone Fit', weight: 14 },
  { id: 'kit', label: 'Kit Fit', weight: 16 },
  { id: 'protocol', label: 'Protocol Fit', weight: 14 },
  { id: 'clearance', label: 'Clearance', weight: 18 },
  { id: 'workload', label: 'Workload', weight: 8 },
  { id: 'eta', label: 'ETA Risk', weight: 8 },
  { id: 'value', label: 'Shift Value', weight: 8 },
];

const ZONE_ALIASES = {
  sf: ['sf', 'san francisco', 'soma', 'downtown', 'mission', 'castro', 'noe', 'marina', 'pacific heights'],
  eastBay: ['oakland', 'berkeley', 'east bay', 'alameda', 'walnut creek'],
  peninsula: ['san mateo', 'palo alto', 'south bay', 'peninsula', 'san jose'],
  northBay: ['marin', 'napa', 'sonoma', 'north bay'],
};

const PROTOCOL_TAGS = [
  { tag: 'nad', terms: ['nad'] },
  { tag: 'myers', terms: ['myers', 'cocktail'] },
  { tag: 'hydration', terms: ['hydration', 'fluid', 'dehydration'] },
  { tag: 'immune', terms: ['immune', 'immunity', 'vitamin c'] },
  { tag: 'recovery', terms: ['recovery', 'hangover', 'travel', 'vip'] },
  { tag: 'performance', terms: ['performance', 'energy', 'focus'] },
  { tag: 'glow', terms: ['beauty', 'glow', 'glutathione', 'biotin'] },
  { tag: 'im', terms: [' im', 'shot', 'injection', 'b12'] },
  { tag: 'event', terms: ['group', 'event', 'corporate', 'festival'] },
];

const INVENTORY_BY_TAG = {
  hydration: ['iv bags'],
  recovery: ['iv bags', 'glutathione'],
  performance: ['iv bags', 'b-complex'],
  myers: ['iv bags', 'b-complex', 'vitamin c'],
  immune: ['iv bags', 'vitamin c'],
  nad: ['nad'],
  glow: ['glutathione', 'b-complex'],
  im: ['im shot kit'],
  event: ['iv bags', 'nurse bags'],
};

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCity(value) {
  const text = normalizeStatus(value);
  const zone = Object.entries(ZONE_ALIASES).find(([, aliases]) => aliases.some((alias) => text.includes(alias)));
  return zone?.[0] || text || 'unknown';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedScore(factors) {
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0) || 1;
  const total = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
  return clampScore(total / totalWeight);
}

function requestText(request = {}) {
  return compactText(
    request.therapy,
    request.service,
    request.plan,
    request.protocol,
    request.status,
    request.source,
    request.priority,
    request.addons || [],
    request.notes
  );
}

export function inferDispatchProtocolTags(request = {}) {
  const text = requestText(request);
  const tags = PROTOCOL_TAGS
    .filter((item) => item.terms.some((term) => text.includes(term)))
    .map((item) => item.tag);
  if (!tags.length) tags.push('hydration');
  if (!tags.includes('hydration') && /iv|drip|cocktail|nad/.test(text)) tags.unshift('hydration');
  return [...new Set(tags)];
}

function nurseSkillTags(nurse = {}) {
  const text = compactText(
    nurse.certifications || [],
    nurse.protocols || [],
    nurse.training || [],
    nurse.skills || [],
    nurse.tags || [],
    nurse.assigned || [],
    nurse.area,
    nurse.kit
  );
  const tags = PROTOCOL_TAGS
    .filter((item) => item.terms.some((term) => text.includes(term)))
    .map((item) => item.tag);
  if (/ready|stocked|iv|rn|nurse/.test(text)) {
    tags.push('hydration', 'recovery', 'myers');
  }
  return [...new Set(tags)];
}

function availabilityFactor(request = {}, nurse = {}) {
  const status = normalizeStatus(nurse.status);
  const assignedName = normalizeStatus(request.nurse);
  const nurseName = normalizeStatus(nurse.name);
  const assignedToRequest = assignedName && assignedName !== 'unassigned' && assignedName === nurseName;
  if (assignedToRequest) return { score: 96, reason: 'Already assigned to this visit.' };
  if (/off/.test(status)) return { score: 0, reason: 'Off duty.' };
  if (/available|ready|open/.test(status)) return { score: 100, reason: 'Available now.' };
  if (/assigned|in treatment/.test(status)) return { score: 58, reason: 'Working, but still in the roster.' };
  return { score: 72, reason: 'Roster status needs confirmation.' };
}

function zoneFactor(request = {}, nurse = {}) {
  const requestZone = normalizeCity(`${request.city || ''} ${request.address || ''}`);
  const nurseZone = normalizeCity(`${nurse.area || ''} ${nurse.city || ''}`);
  if (requestZone === 'unknown' || nurseZone === 'unknown') return { score: 62, requestZone, nurseZone, reason: 'Zone incomplete.' };
  if (requestZone === nurseZone) return { score: 100, requestZone, nurseZone, reason: 'Same market.' };
  const bayAreaPair = [requestZone, nurseZone].every((zone) => ['sf', 'eastBay', 'peninsula', 'northBay'].includes(zone));
  return { score: bayAreaPair ? 70 : 42, requestZone, nurseZone, reason: bayAreaPair ? 'Bay Area cross-zone.' : 'Outside obvious zone.' };
}

function kitFactor(request = {}, nurse = {}, inventory = []) {
  const tags = inferDispatchProtocolTags(request);
  const needed = [...new Set(tags.flatMap((tag) => INVENTORY_BY_TAG[tag] || []))];
  const kitText = normalizeStatus(nurse.kit);
  const kitReady = /ready|stocked/.test(kitText);
  const risks = needed.map((needle) => {
    const item = inventory.find((entry) => compactText(entry.name, entry.detail, entry.note).includes(needle));
    if (!item) return { item: needle, status: 'Missing', severity: 'critical' };
    const status = normalizeStatus(item.status);
    const severity = /restock|missing|not set|out/.test(status)
      ? 'critical'
      : /low|check|expiry|watch/.test(status)
        ? 'watch'
        : 'clear';
    return { item: item.name || needle, status: item.status || 'Ready', severity };
  });
  const critical = risks.filter((risk) => risk.severity === 'critical').length;
  const watch = risks.filter((risk) => risk.severity === 'watch').length;
  const score = !kitReady ? 18 : critical ? 34 : watch ? 72 : 100;
  return {
    score,
    risks,
    reason: !kitReady ? 'Nurse kit is not ready.' : critical ? 'Required inventory has a hard risk.' : watch ? 'Inventory needs eyes.' : 'Kit and stock fit.',
  };
}

function protocolFactor(request = {}, nurse = {}) {
  const tags = inferDispatchProtocolTags(request);
  const nurseTags = nurseSkillTags(nurse);
  const missing = tags.filter((tag) => !nurseTags.includes(tag) && tag !== 'event');
  if (!missing.length) return { score: 100, tags, nurseTags, missing, reason: 'Protocol tags match.' };
  const advanced = missing.filter((tag) => ['nad', 'im', 'glow'].includes(tag));
  return {
    score: advanced.length ? 58 : 72,
    tags,
    nurseTags,
    missing,
    reason: advanced.length ? 'Advanced protocol review required.' : 'Base protocol fit, verify training.',
  };
}

function clearanceFactor(request = {}) {
  const blockers = [];
  const intake = normalizeStatus(request.intake);
  const consent = normalizeStatus(request.consent);
  const gfe = normalizeStatus(request.gfe);
  const payment = normalizeStatus(request.payment);
  const status = normalizeStatus(request.status);

  if (/pending|not started|required|missing/.test(intake) || /intake pending/.test(status)) blockers.push('Intake');
  if (/pending|not started|required|missing/.test(consent) || /consent pending/.test(status)) blockers.push('Consent');
  if (/pending|not started|required|missing/.test(gfe) || /gfe pending/.test(status)) blockers.push('GFE');
  if (!/paid|invoice|captured|deposit|clear/.test(payment)) blockers.push('Deposit');

  return {
    score: blockers.length ? Math.max(22, 100 - blockers.length * 22) : 100,
    blockers,
    reason: blockers.length ? `${blockers.join(', ')} open.` : 'Clear to route from local state.',
  };
}

function workloadFactor(nurse = {}) {
  const visits = Number(nurse.visits || 0);
  if (visits <= 1) return { score: 100, reason: 'Light load.' };
  if (visits === 2) return { score: 82, reason: 'Moderate load.' };
  if (visits === 3) return { score: 64, reason: 'Stacked shift.' };
  return { score: 38, reason: 'Fatigue risk.' };
}

function etaFactor(request = {}, nurse = {}) {
  const zone = zoneFactor(request, nurse);
  const visits = Number(nurse.visits || 0);
  const minutes = zone.score >= 95 ? 18 + visits * 8 : zone.score >= 65 ? 34 + visits * 10 : 55 + visits * 12;
  const score = minutes <= 30 ? 100 : minutes <= 45 ? 78 : minutes <= 60 ? 54 : 28;
  return { score, minutes, reason: `${minutes} min local ETA estimate.` };
}

function valueFactor(request = {}) {
  const amount = Number(request.total || request.shiftValue || request.value || 0);
  if (amount >= 600) return { score: 100, amount, reason: 'High-value shift.' };
  if (amount >= 350) return { score: 84, amount, reason: 'Premium shift.' };
  if (amount >= 200) return { score: 68, amount, reason: 'Standard shift.' };
  return { score: 52, amount, reason: 'Low-value or unknown value.' };
}

function gradeDecision(score, blockers = [], warnings = []) {
  if (blockers.length) return 'Block';
  if (score >= 86 && !warnings.length) return 'Dispatch';
  if (score >= 72) return 'Offer';
  if (score >= 55) return 'Hold';
  return 'Block';
}

export function scoreDispatchCandidate({ request = {}, nurse = {}, inventory = [] } = {}) {
  const availability = availabilityFactor(request, nurse);
  const zone = zoneFactor(request, nurse);
  const kit = kitFactor(request, nurse, inventory);
  const protocol = protocolFactor(request, nurse);
  const clearance = clearanceFactor(request);
  const workload = workloadFactor(nurse);
  const eta = etaFactor(request, nurse);
  const value = valueFactor(request);

  const factors = [
    { ...DISPATCH_SCORE_FACTORS[0], score: availability.score, reason: availability.reason },
    { ...DISPATCH_SCORE_FACTORS[1], score: zone.score, reason: zone.reason },
    { ...DISPATCH_SCORE_FACTORS[2], score: kit.score, reason: kit.reason },
    { ...DISPATCH_SCORE_FACTORS[3], score: protocol.score, reason: protocol.reason },
    { ...DISPATCH_SCORE_FACTORS[4], score: clearance.score, reason: clearance.reason },
    { ...DISPATCH_SCORE_FACTORS[5], score: workload.score, reason: workload.reason },
    { ...DISPATCH_SCORE_FACTORS[6], score: eta.score, reason: eta.reason },
    { ...DISPATCH_SCORE_FACTORS[7], score: value.score, reason: value.reason },
  ];

  const hardBlockers = [
    ...clearance.blockers.map((item) => `${item} open`),
    ...kit.risks.filter((risk) => risk.severity === 'critical').map((risk) => `${risk.item} ${risk.status}`),
  ];
  if (availability.score === 0) hardBlockers.push('Nurse off duty');
  const warnings = [
    ...protocol.missing.map((item) => `${item.toUpperCase()} review`),
    ...kit.risks.filter((risk) => risk.severity === 'watch').map((risk) => `${risk.item} ${risk.status}`),
  ];
  const score = weightedScore(factors);
  const grade = gradeDecision(score, hardBlockers, warnings);

  return {
    requestId: request.id || request.reference || request.client,
    client: request.client || request.contact?.name || 'Client',
    nurseId: nurse.id || nurse.name,
    nurseName: nurse.name || 'Nurse',
    score,
    grade,
    blockers: hardBlockers,
    warnings,
    strengths: factors.filter((factor) => factor.score >= 85).map((factor) => factor.label),
    factors,
    etaMinutes: eta.minutes,
    shiftValue: value.amount,
    requestZone: zone.requestZone,
    nurseZone: zone.nurseZone,
    protocolTags: protocol.tags,
    inventoryRisk: kit.risks,
    clinicalMode: DISPATCH_CLINICAL_MODE,
    nextAction: hardBlockers.length
      ? `Hold: ${hardBlockers[0]}.`
      : warnings.length
        ? `Offer with warning: ${warnings[0]}.`
        : 'Dispatch now.',
  };
}

function activeRequests(requests = [], booking = null) {
  const latest = booking ? [{
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.contact?.name || booking.client || 'Latest client',
    city: booking.city || booking.contact?.city || '',
    address: booking.address || booking.contact?.address || '',
    time: [booking.date, booking.time].filter(Boolean).join(' '),
    therapy: booking.service || booking.plan || 'Avalon protocol',
    addons: booking.addons || [],
    total: booking.total || booking.depositAmount || 0,
    status: booking.status || 'New Request',
    intake: booking.intake || (booking.intakeComplete ? 'Done' : 'Pending'),
    consent: booking.consent || (booking.consentComplete ? 'Done' : 'Pending'),
    gfe: booking.gfe || (booking.gfeRequired ? 'Pending' : 'Cleared'),
    nurse: booking.nurse || 'Unassigned',
    payment: booking.payment || booking.paymentStatus || 'Pending',
  }] : [];

  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/complete|cancel|archiv/i.test(request.status || ''))
    .filter((request) => {
      const id = request.id || request.client;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export function buildDispatchBrainMatrix({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  return activeRequests(requests, booking).map((request) => {
    const assignedName = normalizeStatus(request.nurse);
    const sortedCandidates = nurses
      .map((nurse) => scoreDispatchCandidate({ request, nurse, inventory }))
      .sort((a, b) => b.score - a.score);
    const assigned = assignedName && assignedName !== 'unassigned'
      ? sortedCandidates.find((candidate) => normalizeStatus(candidate.nurseName) === assignedName)
      : null;
    const best = assigned || sortedCandidates[0] || null;
    const alternates = sortedCandidates
      .filter((candidate) => candidate.nurseId !== best?.nurseId)
      .slice(0, 2);
    return {
      requestId: request.id || request.client,
      client: request.client || request.contact?.name || 'Client',
      service: request.therapy || request.service || request.plan || 'Avalon protocol',
      time: request.time || 'Time pending',
      city: request.city || 'Market pending',
      status: request.status || 'New Request',
      assignedNurse: assigned?.nurseName || '',
      best,
      alternates,
      candidates: sortedCandidates,
      clinicalMode: DISPATCH_CLINICAL_MODE,
    };
  }).sort((a, b) => {
    const gradeRank = { Dispatch: 4, Offer: 3, Hold: 2, Block: 1 };
    return (gradeRank[b.best?.grade] || 0) - (gradeRank[a.best?.grade] || 0) || (b.best?.score || 0) - (a.best?.score || 0);
  });
}

function coverageRows(rows = []) {
  const zones = {};
  rows.forEach((row) => {
    const zone = row.best?.requestZone || 'unknown';
    zones[zone] ||= { zone, requests: 0, dispatchable: 0, blocked: 0, bestScore: 0 };
    zones[zone].requests += 1;
    if (['Dispatch', 'Offer'].includes(row.best?.grade)) zones[zone].dispatchable += 1;
    if (row.best?.grade === 'Block') zones[zone].blocked += 1;
    zones[zone].bestScore = Math.max(zones[zone].bestScore, row.best?.score || 0);
  });
  return Object.values(zones).sort((a, b) => b.requests - a.requests || b.bestScore - a.bestScore);
}

function workloadRows(nurses = []) {
  return nurses.map((nurse) => ({
    id: nurse.id || nurse.name,
    nurse: nurse.name || 'Nurse',
    status: nurse.status || 'Unknown',
    visits: Number(nurse.visits || 0),
    kit: nurse.kit || 'Unknown',
    risk: /off/i.test(nurse.status || '') ? 'Off' : Number(nurse.visits || 0) >= 3 ? 'Fatigue' : /restock|not set/i.test(nurse.kit || '') ? 'Kit' : 'Ready',
  }));
}

export function buildDispatchBrainSnapshot({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  const rows = buildDispatchBrainMatrix({ requests, nurses, inventory, booking });
  const allScores = rows.flatMap((row) => row.candidates);
  const topDecisions = rows.map((row) => ({ ...row.best, row })).filter(Boolean);
  const blocked = topDecisions.filter((item) => item.grade === 'Block');
  const dispatchable = topDecisions.filter((item) => ['Dispatch', 'Offer'].includes(item.grade));
  const etaRisk = topDecisions.filter((item) => item.etaMinutes > 45).length;
  const inventoryRisk = topDecisions.filter((item) => item.inventoryRisk.some((risk) => risk.severity !== 'clear')).length;
  const avgScore = topDecisions.length
    ? Math.round(topDecisions.reduce((sum, item) => sum + item.score, 0) / topDecisions.length)
    : 0;

  return {
    version: DISPATCH_BRAIN_VERSION,
    clinicalMode: DISPATCH_CLINICAL_MODE,
    rows,
    allScores,
    topDecisions,
    dispatchable,
    blocked,
    marketCoverage: coverageRows(rows),
    workload: workloadRows(nurses),
    scoreFactors: DISPATCH_SCORE_FACTORS,
    metrics: {
      requests: rows.length,
      nurses: nurses.length,
      decisions: topDecisions.length,
      dispatchable: dispatchable.length,
      blocked: blocked.length,
      avgScore,
      topScore: topDecisions[0]?.score || 0,
      etaRisk,
      inventoryRisk,
    },
  };
}
