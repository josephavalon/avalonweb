export const PROVIDER_COMPETENCY_VERSION = '2026.05.no-api-provider-competency-v1';
export const PROVIDER_COMPETENCY_MODE = 'credential-placeholder-operational';

export const PROVIDER_COMPETENCY_RULES = [
  'Credential proof gates visibility before shift claim.',
  'Protocol review gates advanced visit offers.',
  'RN scope is execution-only after clinical clearance.',
  'NP/MD authority is tracked separately from RN field execution.',
  'Training proof is operational; clinical charting remains in Acuity.',
];

export const COMPETENCY_TRAINING_MODULES = [
  { id: 'iv-start-safety', title: 'IV Start Safety', category: 'Clinical' },
  { id: 'nad-protocol-review', title: 'NAD+ Protocol Review', category: 'Protocol' },
  { id: 'myers-add-ons', title: 'Myers Add-On Review', category: 'Protocol' },
  { id: 'im-shot-review', title: 'IM Shot Review', category: 'Protocol' },
  { id: 'emergency-response', title: 'Emergency Response', category: 'Safety' },
  { id: 'acuity-closeout', title: 'Acuity Closeout', category: 'Ops' },
];

export const COMPETENCY_PROTOCOL_REQUIREMENTS = {
  hydration: ['iv-start-safety', 'emergency-response', 'acuity-closeout'],
  recovery: ['iv-start-safety', 'myers-add-ons', 'emergency-response', 'acuity-closeout'],
  myers: ['iv-start-safety', 'myers-add-ons', 'emergency-response', 'acuity-closeout'],
  nad: ['iv-start-safety', 'nad-protocol-review', 'emergency-response', 'acuity-closeout'],
  beauty: ['iv-start-safety', 'myers-add-ons', 'im-shot-review', 'emergency-response', 'acuity-closeout'],
  immunity: ['iv-start-safety', 'myers-add-ons', 'emergency-response', 'acuity-closeout'],
  energy: ['iv-start-safety', 'myers-add-ons', 'im-shot-review', 'emergency-response', 'acuity-closeout'],
  im: ['im-shot-review', 'emergency-response', 'acuity-closeout'],
  event: ['iv-start-safety', 'emergency-response', 'acuity-closeout'],
};

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function slug(value = '') {
  return compactText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferProtocol(request = {}) {
  const text = compactText(
    request.therapy,
    request.service,
    request.plan,
    request.protocol,
    request.addons || [],
    request.notes,
    request.source
  );
  if (text.includes('nad')) return 'nad';
  if (text.includes('myers')) return 'myers';
  if (text.includes('beauty') || text.includes('glow') || text.includes('biotin')) return 'beauty';
  if (text.includes('immune') || text.includes('immunity')) return 'immunity';
  if (text.includes('energy') || text.includes('performance')) return 'energy';
  if (text.includes(' im ') || text.includes('shot') || text.includes('b12')) return 'im';
  if (text.includes('event') || text.includes('corporate') || number(request.guests, 1) > 1) return 'event';
  if (text.includes('recovery') || text.includes('vip') || text.includes('hangover')) return 'recovery';
  return 'hydration';
}

function activeRequests(requests = [], booking = null) {
  const latest = booking ? [{
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.contact?.name || booking.client || 'Latest client',
    therapy: booking.service || booking.plan || 'Avalon protocol',
    status: booking.status || 'New Request',
    nurse: booking.nurse || 'Unassigned',
    guests: booking.guests || 1,
  }] : [];
  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/cancel|complete|archiv/i.test(request.status || ''))
    .filter((request) => {
      const id = request.id || `${request.client}-${request.time}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function roleForNurse(nurse = {}) {
  const role = compactText(nurse.role, nurse.licenseType, nurse.title);
  if (role.includes('physician') || role.includes('md')) return 'MD';
  if (role.includes('np') || role.includes('nurse practitioner')) return 'NP';
  return 'RN';
}

function credentialState(nurse = {}) {
  const status = nurse.nurseys?.status || nurse.credentialStatus || nurse.credStatus || nurse.license || '';
  const state = nurse.nurseys?.state || nurse.licenseState || nurse.state || 'CA';
  const hasProof = Boolean(status);
  const clear = /clear|active|verified/i.test(status) && state === 'CA';
  const review = !hasProof || /review|pending|expiring|stale/i.test(status);
  const blocked = /block|expired|revoked|denied/i.test(status) || state !== 'CA';
  return {
    status: hasProof ? status : 'Nurseys placeholder',
    state,
    hasProof,
    clear,
    review,
    blocked,
    score: blocked ? 0 : clear ? 100 : 52,
    reason: blocked
      ? `Credential block: ${status || state}.`
      : clear
        ? 'Credential proof clear.'
        : 'Credential proof pending locally.',
  };
}

function moduleMap(row = {}) {
  return new Map((row.modules || []).map((module) => [module.id, module]));
}

function buildCompetencyTrainingTower({ nurses = [] } = {}) {
  return {
    modules: COMPETENCY_TRAINING_MODULES,
    nurseRows: nurses.map((nurse) => {
      const localModules = nurse.trainingModules || nurse.training || [];
      const localMap = new Map(localModules.map((module) => [module.id, module]));
      return {
        id: nurse.id || slug(nurse.name || 'nurse'),
        nurse: nurse.name || 'Nurse',
        modules: COMPETENCY_TRAINING_MODULES.map((module) => {
          const local = localMap.get(module.id);
          const status = local?.status || 'Due';
          return {
            ...module,
            ...local,
            status,
            tone: local?.tone || (status === 'Clear' ? 'ready' : status === 'Expired' ? 'critical' : 'action'),
            daysLeft: number(local?.daysLeft, status === 'Clear' ? 180 : 0),
          };
        }),
      };
    }),
  };
}

function requiredModulesForProtocol(protocol = 'hydration') {
  const ids = COMPETENCY_PROTOCOL_REQUIREMENTS[protocol] || COMPETENCY_PROTOCOL_REQUIREMENTS.hydration;
  return ids.map((id) => COMPETENCY_TRAINING_MODULES.find((module) => module.id === id) || { id, title: id, category: 'Protocol' });
}

function scopeState({ nurse = {}, protocol = 'hydration', request = {} } = {}) {
  const role = roleForNurse(nurse);
  const advanced = ['nad', 'beauty'].includes(protocol);
  const gfe = compactText(request.gfe, request.status);
  const clearanceOpen = /pending|not started|required/.test(gfe);
  if (role === 'MD' || role === 'NP') {
    return { role, status: 'Authority', score: 100, blocker: '', reason: `${role} authority tracked.` };
  }
  if (clearanceOpen) {
    return { role, status: 'Hold', score: 54, blocker: 'Clinical clearance open', reason: 'RN cannot execute before clearance.' };
  }
  if (advanced) {
    return { role, status: 'Review', score: 72, blocker: '', reason: 'Advanced protocol review required.' };
  }
  return { role, status: 'Clear', score: 100, blocker: '', reason: 'RN execution scope clear after clinical clearance.' };
}

function workloadState(nurse = {}) {
  const visits = number(nurse.visits || nurse.todayVisits || nurse.visitsToday, 0);
  if (visits >= 5) return { visits, score: 0, status: 'Block', reason: 'Fatigue block.' };
  if (visits >= 4) return { visits, score: 48, status: 'Watch', reason: 'High shift load.' };
  if (visits >= 2) return { visits, score: 76, status: 'Moderate', reason: 'Moderate shift load.' };
  return { visits, score: 100, status: 'Clear', reason: 'Light shift load.' };
}

function kitState(nurse = {}) {
  const kit = nurse.kit || nurse.kitStatus || 'Unknown';
  if (/ready|stocked/i.test(kit)) return { kit, score: 100, status: 'Ready', reason: 'Kit ready.' };
  if (/restock|hold|missing|not set/i.test(kit)) return { kit, score: 28, status: 'Hold', reason: `Kit ${kit}.` };
  return { kit, score: 58, status: 'Review', reason: 'Kit proof incomplete.' };
}

function scoreFromParts(parts = []) {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0) || 1;
  return Math.max(0, Math.min(100, Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight)));
}

export function scoreProviderCompetency({ request = {}, nurse = {}, trainingRow = null } = {}) {
  const protocol = inferProtocol(request);
  const required = requiredModulesForProtocol(protocol);
  const modulesById = moduleMap(trainingRow);
  const requiredStatuses = required.map((module) => ({
    ...module,
    ...(modulesById.get(module.id) || { status: 'Due', tone: 'action', daysLeft: 0 }),
  }));
  const expired = requiredStatuses.filter((module) => module.status === 'Expired');
  const due = requiredStatuses.filter((module) => module.status !== 'Clear');
  const credential = credentialState(nurse);
  const scope = scopeState({ nurse, protocol, request });
  const workload = workloadState(nurse);
  const kit = kitState(nurse);
  const trainingScore = expired.length ? 0 : due.length ? Math.max(42, 100 - due.length * 12) : 100;
  const parts = [
    { id: 'credential', label: 'Credential', score: credential.score, weight: 24, reason: credential.reason },
    { id: 'scope', label: 'Scope', score: scope.score, weight: 18, reason: scope.reason },
    { id: 'training', label: 'Training', score: trainingScore, weight: 26, reason: expired.length ? 'Expired required review.' : due.length ? `${due.length} required review(s) due.` : 'Required reviews clear.' },
    { id: 'kit', label: 'Kit', score: kit.score, weight: 16, reason: kit.reason },
    { id: 'workload', label: 'Workload', score: workload.score, weight: 16, reason: workload.reason },
  ];
  const blockers = [
    credential.blocked ? credential.reason : '',
    !credential.hasProof ? 'Nurseys credential proof pending' : '',
    scope.blocker,
    workload.status === 'Block' ? workload.reason : '',
    kit.status === 'Hold' ? kit.reason : '',
    ...expired.map((module) => `${module.title} expired`),
  ].filter(Boolean);
  const score = scoreFromParts(parts);
  const status = blockers.length ? 'Block' : score >= 86 && !due.length ? 'Clear' : score >= 70 ? 'Review' : 'Hold';
  return {
    id: `${request.id || slug(request.client || 'visit')}-${nurse.id || slug(nurse.name || 'nurse')}`,
    requestId: request.id || request.reference || request.client || 'visit',
    client: request.client || request.contact?.name || 'Client',
    nurseId: nurse.id || slug(nurse.name || 'nurse'),
    nurseName: nurse.name || nurse.nurseName || 'Nurse',
    protocol,
    role: scope.role,
    score,
    status,
    blockers,
    warnings: [
      ...due.filter((module) => module.status !== 'Expired').map((module) => `${module.title} ${module.status}`),
      credential.review && credential.hasProof ? credential.reason : '',
      scope.status === 'Review' ? scope.reason : '',
    ].filter(Boolean),
    requiredModules: requiredStatuses,
    factors: parts,
    nextAction: blockers.length
      ? `Do not offer: ${blockers[0]}.`
      : due.length
        ? `Offer after ${due[0].title}.`
        : 'Eligible for protocol offer.',
    mode: PROVIDER_COMPETENCY_MODE,
  };
}

export function buildProviderCompetencySnapshot({ requests = [], nurses = [], booking = null } = {}) {
  const active = activeRequests(requests, booking);
  const trainingTower = buildCompetencyTrainingTower({ nurses });
  const rows = active.map((request) => {
    const scores = nurses
      .map((nurse) => {
        const trainingRow = trainingTower.nurseRows.find((row) => row.id === (nurse.id || slug(nurse.name || 'nurse')));
        return scoreProviderCompetency({ request, nurse, trainingRow });
      })
      .sort((a, b) => b.score - a.score);
    return {
      requestId: request.id || request.client,
      client: request.client || request.contact?.name || 'Client',
      service: request.therapy || request.service || request.plan || 'Avalon protocol',
      protocol: inferProtocol(request),
      best: scores[0] || null,
      alternates: scores.slice(1, 3),
      scores,
    };
  }).sort((a, b) => (b.best?.score || 0) - (a.best?.score || 0));
  const allScores = rows.flatMap((row) => row.scores);
  const nurseRows = nurses.map((nurse) => {
    const nurseScores = allScores.filter((score) => score.nurseId === (nurse.id || slug(nurse.name || 'nurse')));
    const best = nurseScores.sort((a, b) => b.score - a.score)[0] || null;
    return {
      id: nurse.id || slug(nurse.name || 'nurse'),
      nurse: nurse.name || 'Nurse',
      credential: credentialState(nurse).status,
      kit: nurse.kit || nurse.kitStatus || 'Unknown',
      bestScore: best?.score || 0,
      bestProtocol: best?.protocol || 'none',
      blockedOffers: nurseScores.filter((score) => score.status === 'Block').length,
      reviewOffers: nurseScores.filter((score) => score.status === 'Review').length,
      nextAction: best?.nextAction || 'No active protocol offers.',
    };
  });
  const modulePressure = COMPETENCY_TRAINING_MODULES.map((module) => {
    const usedBy = allScores.filter((score) => score.requiredModules.some((item) => item.id === module.id));
    return {
      id: module.id,
      title: module.title,
      category: module.category,
      requiredOffers: usedBy.length,
      due: usedBy.reduce((sum, score) => sum + score.requiredModules.filter((item) => item.id === module.id && item.status !== 'Clear').length, 0),
      expired: usedBy.reduce((sum, score) => sum + score.requiredModules.filter((item) => item.id === module.id && item.status === 'Expired').length, 0),
    };
  }).filter((module) => module.requiredOffers > 0).sort((a, b) => b.due - a.due || b.requiredOffers - a.requiredOffers);
  const blocked = allScores.filter((score) => score.status === 'Block');
  const clear = allScores.filter((score) => score.status === 'Clear');
  const review = allScores.filter((score) => score.status === 'Review');
  const avgScore = allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score.score, 0) / allScores.length) : 0;

  return {
    version: PROVIDER_COMPETENCY_VERSION,
    mode: PROVIDER_COMPETENCY_MODE,
    rules: PROVIDER_COMPETENCY_RULES,
    trainingTower,
    rows,
    allScores,
    nurseRows,
    modulePressure,
    metrics: {
      visits: rows.length,
      nurses: nurses.length,
      scores: allScores.length,
      clear: clear.length,
      review: review.length,
      blocked: blocked.length,
      avgScore,
      bestScore: rows[0]?.best?.score || 0,
      modulesUnderPressure: modulePressure.filter((module) => module.due || module.expired).length,
      missingCredentialProof: allScores.filter((score) => score.blockers.includes('Nurseys credential proof pending')).length,
    },
  };
}
