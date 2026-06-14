import { scoreDispatchCandidate } from './dispatchBrain.js';

export const SHIFT_MARKETPLACE_VERSION = '2026.05.no-api-shift-marketplace-v1';
export const SHIFT_MARKETPLACE_MODE = 'local-offer-placeholder';

export const SHIFT_MARKETPLACE_RULES = [
  'Only cleared, payable visits become nurse offers.',
  'Nurses reply Y/N to accept or decline.',
  'The accepting nurse sets the final ETA.',
  'Accepted shifts lock to the nurse personal page.',
  'SMS, Acuity, and payroll remain placeholder handoffs until APIs are connected.',
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

function nurseMatches(request = {}, nurse = {}) {
  const assigned = normalize(request.nurse);
  return Boolean(assigned && assigned !== 'unassigned' && assigned === normalize(nurse.name));
}

function visitIsStale(request = {}) {
  const text = compactText(request.created, request.status, request.time);
  return text.includes('yesterday') || text.includes('overdue') || text.includes('open');
}

function estimateShiftPay(request = {}, candidate = {}) {
  const total = number(candidate.shiftValue || request.total || request.value, 0);
  const guests = Math.max(1, number(request.guests, 1));
  const base = Math.max(65, Math.round(total * 0.3));
  const group = guests > 1 ? (guests - 1) * 22 : 0;
  const zonePremium = candidate.etaMinutes > 45 ? 25 : 0;
  const advanced = /nad|vip|beauty|performance|event/i.test(compactText(request.therapy, request.addons || [])) ? 20 : 0;
  return {
    estimate: Math.round(base + group + zonePremium + advanced),
    basis: 'local placeholder',
    components: { base, group, zonePremium, advanced },
  };
}

function offerStage({ request = {}, candidate = {}, nurse = {} } = {}) {
  const assigned = nurseMatches(request, nurse);
  if (candidate.blockers?.length) return 'Hold';
  if (assigned) return 'Accepted';
  if (candidate.grade === 'Dispatch' || candidate.score >= 86) return 'Send';
  if (candidate.grade === 'Offer' || candidate.score >= 72) return 'Send';
  if (candidate.score >= 60) return 'Backup';
  return 'Do Not Send';
}

function rankStage(stage) {
  return {
    Accepted: 5,
    Send: 4,
    Backup: 3,
    Hold: 2,
    'Do Not Send': 1,
  }[stage] || 0;
}

function offerAction(stage, candidate = {}) {
  if (stage === 'Accepted') return 'Lock to nurse page. Ask nurse to set final ETA.';
  if (stage === 'Send') return 'Send open shift. Await Y/N reply.';
  if (stage === 'Backup') return 'Keep as backup. Send if primary stalls.';
  if (stage === 'Hold') return `Do not send: ${candidate.blockers?.[0] || 'local readiness block'}.`;
  return 'Suppress offer.';
}

export function buildShiftOffer({ request = {}, nurse = {}, inventory = [] } = {}) {
  const candidate = scoreDispatchCandidate({ request, nurse, inventory });
  const stage = offerStage({ request, candidate, nurse });
  const pay = estimateShiftPay(request, candidate);
  const city = request.city || candidate.requestZone || 'Market pending';
  const time = request.time || 'Time pending';
  const offerId = `${request.id || request.reference || request.client || 'visit'}-${nurse.id || nurse.name || 'nurse'}`;

  return {
    id: offerId,
    requestId: request.id || request.reference || request.client || 'visit',
    client: request.client || request.contact?.name || 'Client',
    nurseId: nurse.id || nurse.name || 'nurse',
    nurseName: nurse.name || 'Nurse',
    city,
    time,
    stage,
    score: candidate.score,
    grade: candidate.grade,
    etaEstimate: candidate.etaMinutes,
    nurseFinalEta: true,
    finalEtaOwner: 'nurse',
    shiftValue: pay.estimate,
    pay,
    replyCommand: stage === 'Accepted' ? 'ACCEPTED' : stage === 'Send' ? 'Y/N' : 'NONE',
    acceptanceToken: `${offerId}:Y`,
    declineToken: `${offerId}:N`,
    loadsInto: stage === 'Accepted' ? 'nurse-personal-page-placeholder' : 'open-shift-queue-placeholder',
    confirmation: stage === 'Accepted'
      ? `${nurse.name || 'Nurse'} accepted. Final ETA required from nurse.`
      : stage === 'Send'
        ? `Open shift: ${city} ${time}. $${pay.estimate}. Reply Y/N.`
        : offerAction(stage, candidate),
    blockers: candidate.blockers || [],
    warnings: candidate.warnings || [],
    nextAction: offerAction(stage, candidate),
    candidate,
    mode: SHIFT_MARKETPLACE_MODE,
  };
}

function buildOfferRow({ request = {}, nurses = [], inventory = [] } = {}) {
  const offers = nurses
    .map((nurse) => buildShiftOffer({ request, nurse, inventory }))
    .sort((a, b) => rankStage(b.stage) - rankStage(a.stage) || b.score - a.score || b.shiftValue - a.shiftValue);
  const accepted = offers.find((offer) => offer.stage === 'Accepted') || null;
  const bestSendable = offers.find((offer) => offer.stage === 'Send') || offers.find((offer) => offer.stage === 'Backup') || null;
  const primary = accepted || bestSendable || offers[0] || null;
  return {
    requestId: request.id || request.reference || request.client || 'visit',
    client: request.client || request.contact?.name || 'Client',
    service: request.therapy || request.service || request.plan || 'Avalon protocol',
    status: request.status || 'New Request',
    city: request.city || 'Market pending',
    time: request.time || 'Time pending',
    stale: visitIsStale(request),
    accepted,
    primary,
    offers,
  };
}

function buildEscalations(rows = []) {
  return rows.flatMap((row) => {
    const items = [];
    if (!row.accepted && row.stale) {
      items.push({
        id: `${row.requestId}-stale`,
        client: row.client,
        severity: 'High',
        reason: 'Open shift is stale.',
        action: 'Call primary nurse or escalate to ops.',
      });
    }
    if (!row.accepted && !row.offers.some((offer) => offer.stage === 'Send')) {
      items.push({
        id: `${row.requestId}-no-send`,
        client: row.client,
        severity: 'High',
        reason: row.primary?.blockers?.[0] || 'No sendable nurse offer.',
        action: 'Clear blocker before broadcasting.',
      });
    }
    if (row.accepted) {
      items.push({
        id: `${row.requestId}-eta`,
        client: row.client,
        severity: 'Action',
        reason: 'Nurse final ETA required.',
        action: 'Prompt nurse for ETA after accept.',
      });
    }
    return items;
  }).sort((a, b) => {
    const rank = { High: 3, Action: 2, Watch: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });
}

function buildNurseInbox({ nurses = [], offers = [] } = {}) {
  return nurses.map((nurse) => {
    const nurseOffers = offers
      .filter((offer) => offer.nurseId === (nurse.id || nurse.name))
      .filter((offer) => ['Accepted', 'Send', 'Backup'].includes(offer.stage))
      .sort((a, b) => rankStage(b.stage) - rankStage(a.stage) || b.score - a.score);
    return {
      id: nurse.id || nurse.name,
      nurse: nurse.name || 'Nurse',
      phone: nurse.phone || 'Phone pending',
      status: nurse.status || 'Unknown',
      open: nurseOffers.filter((offer) => offer.stage === 'Send').length,
      accepted: nurseOffers.filter((offer) => offer.stage === 'Accepted').length,
      backup: nurseOffers.filter((offer) => offer.stage === 'Backup').length,
      topOffer: nurseOffers[0] || null,
      nextAction: nurseOffers[0]?.nextAction || 'No clean shift offer.',
    };
  });
}

export function buildShiftMarketplaceSnapshot({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  const active = activeRequests(requests, booking);
  const rows = active.map((request) => buildOfferRow({ request, nurses, inventory }));
  const offers = rows.flatMap((row) => row.offers);
  const sendable = offers.filter((offer) => offer.stage === 'Send');
  const accepted = offers.filter((offer) => offer.stage === 'Accepted');
  const backup = offers.filter((offer) => offer.stage === 'Backup');
  const hold = offers.filter((offer) => ['Hold', 'Do Not Send'].includes(offer.stage));
  const escalations = buildEscalations(rows);
  const avgShiftValue = offers.length
    ? Math.round(offers.reduce((sum, offer) => sum + offer.shiftValue, 0) / offers.length)
    : 0;

  return {
    version: SHIFT_MARKETPLACE_VERSION,
    mode: SHIFT_MARKETPLACE_MODE,
    rules: SHIFT_MARKETPLACE_RULES,
    rows,
    offers,
    sendable,
    accepted,
    backup,
    hold,
    acceptedLocks: accepted.map((offer) => ({
      id: offer.id,
      client: offer.client,
      nurse: offer.nurseName,
      loadsInto: offer.loadsInto,
      etaOwner: offer.finalEtaOwner,
      confirmation: offer.confirmation,
    })),
    nurseInbox: buildNurseInbox({ nurses, offers }),
    escalations,
    metrics: {
      visits: rows.length,
      nurses: nurses.length,
      offers: offers.length,
      sendable: sendable.length,
      accepted: accepted.length,
      backup: backup.length,
      hold: hold.length,
      escalations: escalations.length,
      avgShiftValue,
      nurseFinalEta: accepted.length,
    },
  };
}
