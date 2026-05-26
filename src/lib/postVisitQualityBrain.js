import { buildKitReconciliationSnapshot } from './kitReconciliationBrain.js';
import { buildVisitCloseoutSnapshot } from './visitCloseoutBrain.js';

export const POST_VISIT_QA_VERSION = '2026.05.no-api-post-visit-qa-v1';
export const POST_VISIT_QA_MODE = 'local-care-retention-placeholder';

export const POST_VISIT_QA_RULES = [
  'No review or rebook ask ships before clean closeout.',
  'Incident visits route to service recovery before growth.',
  'Aftercare language stays conservative and clinical-safe.',
  'Membership prompts unlock only after value, frequency, and fit are clear.',
  'Low feedback creates a care task, not a marketing task.',
  'Every post-visit action has owner, timing, status, and audit reason.',
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

function requestId(request = {}) {
  return request.id || request.reference || request.client || 'visit';
}

function activeRequestMap(requests = [], booking = null) {
  const latest = booking ? [{
    ...booking,
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.contact?.name || booking.client || 'Latest client',
    therapy: booking.service || booking.plan || 'Avalon protocol',
    payment: booking.payment || booking.paymentStatus || '',
  }] : [];
  const map = new Map();
  [...latest, ...requests].forEach((request) => {
    map.set(String(requestId(request)), request);
  });
  return map;
}

function feedbackFor(row = {}, feedback = []) {
  return feedback.find((item) => (
    String(item.visitId || item.id || item.client || '') === String(row.visitId)
    || compactText(item.client) === compactText(row.client)
  )) || null;
}

function paymentClear(request = {}) {
  return /paid|invoice|captured|authorized|deposit/i.test(`${request.payment || ''} ${request.paymentStatus || ''} ${request.depositStatus || ''}`);
}

function scoreMembershipFit(row = {}, request = {}) {
  const visits = number(request.visitCount ?? request.sessions ?? request.previousVisits, 0);
  const premium = number(request.total || request.amount || request.subtotal, 0) >= 300;
  const vip = /vip|hotel|corporate|event|launch/i.test(`${request.priority || ''} ${request.source || ''} ${request.notes || ''} ${row.service || ''}`);
  const advanced = /nad|myers|longevity|performance/i.test(`${row.service || ''} ${(request.addons || []).join(' ')}`);
  const score = Math.min(100, visits * 18 + (premium ? 22 : 0) + (vip ? 16 : 0) + (advanced ? 10 : 0));
  return {
    score,
    status: score >= 72 ? 'Offer' : score >= 52 ? 'Watch' : 'Wait',
    label: score >= 72 ? 'Membership Ready' : score >= 52 ? 'Warm Lead' : 'Care First',
    pitch: score >= 72
      ? 'Offer recovery on repeat, priority booking, and preferred pricing.'
      : score >= 52
        ? 'Mention repeat care lightly after aftercare is clear.'
        : 'Do not push a plan yet.',
  };
}

function stageFor({ row = {}, request = {}, feedback = null } = {}) {
  if (!row.fieldProofComplete || row.stage === 'Closeout Needed' || row.stage === 'Waiting') return 'Closeout Lock';
  if (row.eventFlagged) return 'Service Recovery';
  if (!row.packet?.acuityEntered) return 'Acuity Entry';
  if (!paymentClear(request)) return 'Payment Hold';
  if (feedback && number(feedback.score, 5) <= 3) return 'Care Review';
  return 'Review Ready';
}

function scoreQa({ row = {}, request = {}, stage = '', feedback = null, kitScore = 100 } = {}) {
  const raw = 100
    - (row.fieldProofComplete ? 0 : 34)
    - (row.packet?.acuityEntered ? 0 : 14)
    - (row.eventFlagged ? 30 : 0)
    - (paymentClear(request) ? 0 : 8)
    - (row.deductionReady ? 0 : 8)
    - (number(feedback?.score, 5) <= 3 ? 18 : 0)
    - (kitScore >= 80 ? 0 : kitScore >= 65 ? 4 : 8);
  const score = Math.max(0, raw);
  return {
    score,
    status: score >= 90 && stage === 'Review Ready' ? 'Clean' : score >= 75 ? 'Review' : 'Fix',
  };
}

function timingFor(row = {}) {
  const service = compactText(row.service);
  if (/nad|longevity|advanced/.test(service)) return '7 days';
  if (/event|launch|group/.test(service)) return '24 hours';
  return '48 hours';
}

function buildAction({ id, row, type, owner, status, timing, reason, copy = '' }) {
  return {
    id: `${id}-${row.visitId}`,
    visitId: row.visitId,
    client: row.client,
    nurse: row.nurse,
    type,
    owner,
    status,
    timing,
    reason,
    copy,
  };
}

export function buildPostVisitQaRow({ row = {}, request = {}, feedback = null, kitScore = 100 } = {}) {
  const stage = stageFor({ row, request, feedback });
  const qa = scoreQa({ row, request, stage, feedback, kitScore });
  const membership = scoreMembershipFit(row, request);
  const clean = stage === 'Review Ready' && qa.status === 'Clean';
  const aftercareReady = ['Review Ready', 'Care Review', 'Service Recovery'].includes(stage) && row.fieldProofComplete;
  const reviewReady = clean && !feedback?.issue;
  const rebookReady = clean;
  const membershipReady = clean && membership.status === 'Offer';
  const timing = timingFor(row);
  const issue = stage === 'Service Recovery' || stage === 'Care Review';

  const aftercareCopy = issue
    ? 'Avalon: checking in after your visit. Reply here if anything feels off and the care team will route the right follow-up. For urgent symptoms, call 911.'
    : 'Avalon: quick check-in after your visit. Reply if you need anything. We are here when you are ready for the next protocol.';

  return {
    id: `post-visit-${row.visitId}`,
    visitId: row.visitId,
    client: row.client,
    service: row.service,
    nurse: row.nurse,
    stage,
    qaScore: qa.score,
    qaStatus: qa.status,
    risk: qa.score < 75 || issue ? 'critical' : qa.score < 90 ? 'action' : 'ready',
    aftercareReady,
    reviewReady,
    rebookReady,
    membershipReady,
    membership,
    feedback: feedback || null,
    actions: [
      buildAction({
        id: 'aftercare',
        row,
        type: issue ? 'Care recovery' : 'Aftercare',
        owner: issue ? 'Care Lead' : 'Care',
        status: aftercareReady ? 'Ready' : 'Locked',
        timing: issue ? 'Now' : timing,
        reason: issue ? 'Issue or incident blocks growth.' : 'Closeout clean enough for client care.',
        copy: aftercareCopy,
      }),
      buildAction({
        id: 'review',
        row,
        type: 'Review ask',
        owner: 'Care',
        status: reviewReady ? 'Ready' : 'Locked',
        timing: reviewReady ? timing : 'Hold',
        reason: reviewReady ? 'Clean visit, no issue signal.' : 'Hold until closeout, payment, and issue state are clean.',
        copy: reviewReady ? 'If the visit felt excellent, invite a short review.' : '',
      }),
      buildAction({
        id: 'rebook',
        row,
        type: 'Rebook prompt',
        owner: 'Growth',
        status: rebookReady ? 'Ready' : 'Locked',
        timing: rebookReady ? timing : 'Hold',
        reason: rebookReady ? 'Clean visit can become the next protocol.' : 'Care first, growth second.',
        copy: rebookReady ? 'Offer one-tap rebook or concierge scheduling.' : '',
      }),
      buildAction({
        id: 'membership',
        row,
        type: 'Membership',
        owner: 'Membership',
        status: membershipReady ? 'Ready' : membership.status === 'Watch' ? 'Watch' : 'Locked',
        timing: membershipReady ? timing : 'Later',
        reason: membership.pitch,
        copy: membershipReady ? 'Recovery on repeat. Priority booking. Preferred pricing.' : '',
      }),
    ],
    nextAction: stage === 'Closeout Lock'
      ? row.nextAction || 'Finish Acuity closeout before follow-up.'
      : stage === 'Service Recovery'
        ? 'Service recovery now. No review or rebook ask.'
        : stage === 'Acuity Entry'
          ? 'Enter closeout in Acuity before growth.'
          : stage === 'Payment Hold'
            ? 'Resolve payment before review/rebook.'
            : stage === 'Care Review'
              ? 'Care lead review before marketing.'
              : membershipReady
                ? 'Send aftercare, then membership offer.'
                : 'Send aftercare, then review/rebook if appropriate.',
  };
}

function byStatus(rows = [], type = '') {
  return rows
    .flatMap((row) => row.actions)
    .filter((action) => action.type === type && action.status !== 'Locked');
}

export function buildPostVisitQualitySnapshot({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
  closeouts = {},
  wasteLogs = [],
  feedback = [],
} = {}) {
  const requestMap = activeRequestMap(requests, booking);
  const closeout = buildVisitCloseoutSnapshot({ requests, nurses, inventory, booking, closeouts });
  const kit = buildKitReconciliationSnapshot({ requests, nurses, inventory, booking, closeouts, wasteLogs });
  const rows = closeout.rows.map((row) => buildPostVisitQaRow({
    row,
    request: requestMap.get(String(row.visitId)) || {},
    feedback: feedbackFor(row, feedback),
    kitScore: kit.metrics.score,
  }));
  const issueQueue = rows.filter((row) => ['Service Recovery', 'Care Review', 'Closeout Lock'].includes(row.stage));
  const aftercareQueue = rows.flatMap((row) => row.actions).filter((action) => ['Aftercare', 'Care recovery'].includes(action.type) && action.status === 'Ready');
  const reviewQueue = byStatus(rows, 'Review ask');
  const rebookQueue = byStatus(rows, 'Rebook prompt');
  const membershipQueue = rows.flatMap((row) => row.actions).filter((action) => action.type === 'Membership' && ['Ready', 'Watch'].includes(action.status));
  const avgQa = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.qaScore, 0) / rows.length) : 100;

  return {
    version: POST_VISIT_QA_VERSION,
    mode: POST_VISIT_QA_MODE,
    rules: POST_VISIT_QA_RULES,
    closeout,
    kit,
    rows,
    issueQueue,
    aftercareQueue,
    reviewQueue,
    rebookQueue,
    membershipQueue,
    auditTrail: rows.flatMap((row) => row.actions.map((action) => ({
      id: `audit-${action.id}`,
      type: `post_visit.${action.type.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      client: row.client,
      status: action.status,
      reason: action.reason,
    }))).slice(0, 80),
    metrics: {
      visits: rows.length,
      clean: rows.filter((row) => row.qaStatus === 'Clean').length,
      fix: rows.filter((row) => row.qaStatus === 'Fix').length,
      issues: issueQueue.length,
      aftercare: aftercareQueue.length,
      reviews: reviewQueue.length,
      rebooks: rebookQueue.length,
      memberships: membershipQueue.filter((action) => action.status === 'Ready').length,
      avgQa,
    },
  };
}
