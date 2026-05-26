import { readLocal, writeLocal, appendActivity, readLastBooking, saveLastBooking } from './localOs';
import { queueCrossPortalEvent, upsertRepositoryEntity } from './localRepository';
import { ATTIO_PLACEHOLDER, buildAttioClientPayload } from './attioPlaceholder';
import {
  buildAcuityCloseoutPacket,
  evaluateAcuityCloseout,
  readAcuityCloseoutDraft,
  saveAcuityCloseoutDraft,
  saveAcuityCloseoutPacket,
} from './acuityCloseout';
import { GFE_VALID_DAYS, resolveGfeRequirement, transitionBooking } from './bookingLifecycle';
import {
  FINANCE_HANDOFF_CONTRACT,
  GUSTO_PAYROLL_PLACEHOLDER,
  MERCURY_BANKING_PLACEHOLDER,
  NURSEYS_CREDENTIAL_PLACEHOLDER,
  PLACEHOLDER_INTEGRATIONS,
  QUALIPHY_GFE_PLACEHOLDER,
  QUICKBOOKS_ACCOUNTING_PLACEHOLDER,
} from './financeIntegrations';

export const DEFAULT_PREP_CHECKLIST = [
  { key: 'hydrate', label: 'Drink 16 oz of water', done: false },
  { key: 'id', label: 'Have ID ready', done: false },
  { key: 'sleeves', label: 'Wear loose sleeves', done: false },
  { key: 'phone', label: 'Keep phone nearby for RN ETA', done: false },
];

export const ORDER_PRODUCT_FAMILIES = [
  { key: 'iv', label: 'IV therapy', appointmentType: 'mobile' },
  { key: 'im', label: 'IM shot', appointmentType: 'mobile' },
  { key: 'protocol', label: 'Custom protocol', appointmentType: 'mobile' },
  { key: 'subscription', label: 'Subscription', appointmentType: 'recurring' },
  { key: 'event', label: 'Event recovery', appointmentType: 'venue' },
  { key: 'gfe', label: 'Remote GFE', appointmentType: 'remote' },
];

export const ORDER_FLOW_STEPS = [
  { key: 'order', label: 'Order', owner: 'Client' },
  { key: 'deposit', label: '$50 deposit', owner: 'Stripe' },
  { key: 'schedule', label: 'Acuity booking', owner: 'Acuity EMR + Scheduling' },
  { key: 'crm', label: 'CRM route', owner: 'Attio' },
  { key: 'gfe', label: 'GFE route', owner: 'Clinical' },
  { key: 'shift', label: 'Shift offer', owner: 'Nurses' },
  { key: 'route', label: 'Maps + client text', owner: 'Nurse' },
];

export const DEFAULT_SHIFT_VALUE = 85;

export const AVALON_COMMS_CONTRACT = {
  service: 'Avalon Comms',
  badgeStatus: 'Live',
  replaces: ['Connecteam', 'Signal'],
  description: 'Avalon-owned group communications for dispatch, nurses, announcements, alerts, and Y/N shift replies.',
  capabilities: [
    'Replace Connecteam and Signal for internal group threads',
    'Run dispatch, nurse, clinical, and admin channels in one place',
    'Queue SMS/email placeholders while preserving the same workflow',
    'Attach messages to shifts, GFE routing, incidents, and follow-up',
  ],
};

export const ACUITY_OPERATING_CONTRACT = {
  service: 'Acuity EMR + Scheduling',
  badgeStatus: 'Manual',
  description: 'Acuity owns appointment scheduling and the clinical record. Avalon mirrors operational state and makes handoffs smooth.',
  capabilities: [
    'Acuity remains the EMR and scheduling source of record',
    'Avalon stores operational status, assignment, routing, and closeout proof',
    'Nurse closeout blocks local completion until Acuity entry is confirmed',
    'Clinical notes and GFE records stay out of CRM, banking, and payroll payloads',
  ],
};

export const AVALON_SMOOTH_LAYER = {
  service: 'Avalon OS',
  description: 'One operating layer over order, Acuity, GFE routing, nurse assignment, comms, inventory, payroll proof, and follow-up.',
  owns: ['ordering', 'assignment', 'communications', 'routing', 'alerts', 'inventory proof', 'payroll proof', 'client status'],
  doesNotOwn: ['EMR source of record', 'Acuity scheduling source of record', 'Qualiphy fallback GFE when Avalon NP is off shift'],
};

export const COMMUNICATION_CHANNELS = [
  {
    id: 'dispatch',
    label: 'Dispatch',
    audience: 'Operations',
    owner: 'Ops lead',
    scope: 'Live orders, nurse assignment, route changes, and service recovery.',
    channels: ['in_app'],
  },
  {
    id: 'nurses',
    label: 'Nurses',
    audience: 'Field RNs',
    owner: 'Dispatch',
    scope: 'Open shifts, shift swaps, route notes, kit issues, and day-of alerts.',
    channels: ['in_app', 'sms', 'email'],
  },
  {
    id: 'gfe',
    label: 'Clinical/GFE',
    audience: 'NP/MD coverage',
    owner: 'Clinical lead',
    scope: 'Avalon NP first, Qualiphy fallback only when no Avalon NP is on call.',
    channels: ['in_app', 'sms'],
  },
  {
    id: 'events',
    label: 'Events',
    audience: 'Venue/event teams',
    owner: 'Events lead',
    scope: 'Presales, guest flow, staffing, inventory, event-day changes, and GFE timing.',
    channels: ['in_app', 'email'],
  },
  {
    id: 'client-texts',
    label: 'Client Texts',
    audience: 'Clients',
    owner: 'Care team',
    scope: 'GFE prompts, ETA, arrival, prep, receipt, follow-up, and rebooking.',
    channels: ['sms', 'in_app'],
  },
  {
    id: 'admin',
    label: 'Admin',
    audience: 'Leadership',
    owner: 'Founder/Admin',
    scope: 'Finance, compliance, staffing risk, incidents, launch state, and escalations.',
    channels: ['in_app'],
  },
  {
    id: 'incidents',
    label: 'Incidents',
    audience: 'Clinical + Ops',
    owner: 'Clinical lead',
    scope: 'Adverse events, field exceptions, safety issues, and post-visit review.',
    channels: ['in_app', 'sms'],
  },
];

export const BROADCAST_TEMPLATES = [
  {
    id: 'shift-open',
    label: 'Open Shift',
    channelId: 'nurses',
    audience: 'Nurseys-clear nurses',
    priority: 'urgent',
    requiresAck: false,
    body: 'Open Avalon shift: {{city}} · {{date}} {{time}} · {{service}} · ${{shiftValue}} · Reply Y/N.',
  },
  {
    id: 'nurse-accepted',
    label: 'Nurse Accepted',
    channelId: 'client-texts',
    audience: 'Client',
    priority: 'info',
    requiresAck: false,
    body: 'Avalon: {{nurse}} accepted your visit. ETA and route updates will follow before arrival.',
  },
  {
    id: 'gfe-required',
    label: 'GFE Required',
    channelId: 'client-texts',
    audience: 'Client',
    priority: 'action',
    requiresAck: true,
    body: 'Avalon: please complete your GFE before the visit. Clearance stays valid for one year.',
  },
  {
    id: 'eta',
    label: 'ETA',
    channelId: 'client-texts',
    audience: 'Client',
    priority: 'info',
    requiresAck: false,
    body: 'Avalon: your RN is on the way. ETA {{eta}}. Please keep your phone nearby.',
  },
  {
    id: 'arrival',
    label: 'Arrival',
    channelId: 'client-texts',
    audience: 'Client',
    priority: 'info',
    requiresAck: false,
    body: 'Avalon: your RN has arrived. Please have ID ready.',
  },
  {
    id: 'post-visit',
    label: 'Post Visit',
    channelId: 'client-texts',
    audience: 'Client',
    priority: 'info',
    requiresAck: false,
    body: 'Avalon: your visit is complete. Hydrate and message us if you need anything.',
  },
  {
    id: 'event-brief',
    label: 'Event Brief',
    channelId: 'events',
    audience: 'Event team',
    priority: 'action',
    requiresAck: true,
    body: 'Event brief: {{event}} · {{date}} · staffing {{staffing}} · GFE before arrival · reply ACK.',
  },
  {
    id: 'incident',
    label: 'Incident',
    channelId: 'incidents',
    audience: 'Clinical + Ops',
    priority: 'critical',
    requiresAck: true,
    body: 'Incident flagged: {{client}} · {{service}} · {{city}}. Clinical review required now.',
  },
];

export const ACUITY_BOUNDARY_ITEMS = [
  { label: 'Acuity owns', detail: 'EMR, appointment schedule, clinical record, and appointment source of truth.' },
  { label: 'Avalon owns', detail: 'Order flow, comms, shift routing, status visibility, alerts, and operational proof.' },
  { label: 'Closeout rule', detail: 'Nurse cannot complete locally until Acuity entry is confirmed.' },
  { label: 'Data rule', detail: 'No clinical notes or GFE content goes to CRM, banking, payroll, or books.' },
];

export const VISIT_LIFECYCLE = [
  { key: 'request', label: 'Requested', client: 'Request received' },
  { key: 'intake', label: 'Intake', client: 'Intake reviewed' },
  { key: 'clearance', label: 'Clearance', client: 'Clinical clearance' },
  { key: 'assigned', label: 'Assigned', client: 'RN assigned' },
  { key: 'en_route', label: 'En route', client: 'RN en route' },
  { key: 'arrived', label: 'Arrived', client: 'RN arrived' },
  { key: 'complete', label: 'Complete', client: 'Visit complete' },
  { key: 'follow_up', label: 'Follow-up', client: 'Care follow-up' },
];

const STATUS_TO_STEP = {
  'Scheduling received': 'request',
  'New Request': 'request',
  Confirmed: 'clearance',
  Cleared: 'clearance',
  'Nurse Assigned': 'assigned',
  Assigned: 'assigned',
  'Ready for Visit': 'assigned',
  'En Route': 'en_route',
  Arrived: 'arrived',
  'In Progress': 'arrived',
  Completed: 'complete',
  'Follow-Up Due': 'follow_up',
};

export function normalizeVisitStatus(status = 'Scheduling received') {
  return STATUS_TO_STEP[status] ? status : 'Scheduling received';
}

export function visitStepForStatus(status = 'Scheduling received') {
  return STATUS_TO_STEP[normalizeVisitStatus(status)] || 'request';
}

export function buildLiveVisitTimeline(booking = null) {
  if (!booking) return VISIT_LIFECYCLE.map((step, index) => ({ ...step, done: index === 0, active: index === 0 }));
  const currentKey = visitStepForStatus(booking.status);
  const currentIndex = VISIT_LIFECYCLE.findIndex((step) => step.key === currentKey);
  const intakeDone = booking.intake === 'Done';
  const gfeRequirement = resolveGfeRequirement(booking);
  const cleared = booking.gfe === 'Cleared' || booking.gfe === 'Valid' || !gfeRequirement.required || ['Confirmed', 'Cleared', 'Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed', 'Follow-Up Due'].includes(booking.status);
  const assigned = Boolean(booking.nurse && booking.nurse !== 'Unassigned');

  return VISIT_LIFECYCLE.map((step, index) => {
    const doneByStatus = currentIndex >= index;
    const doneByField =
      (step.key === 'intake' && intakeDone) ||
      (step.key === 'clearance' && cleared) ||
      (step.key === 'assigned' && assigned);
    return {
      ...step,
      done: doneByStatus || doneByField,
      active: step.key === currentKey,
    };
  });
}

export function updateLatestBooking(patch = {}, activity = 'Updated latest booking') {
  const current = readLastBooking();
  if (!current) return null;
  const next = saveLastBooking({ ...current, ...patch });
  upsertRepositoryEntity('booking', next, 'ops');
  queueCrossPortalEvent({ type: 'booking.updated', payload: { bookingId: next.id, status: next.status }, actor: 'ops' });
  appendActivity(activity, { role: 'ops', bookingId: next.id, status: next.status });
  return next;
}

export function assignLatestBooking(nurseName) {
  const current = readLastBooking();
  if (!current) return { ok: false, errors: ['No booking to assign.'] };
  const result = transitionBooking(current, 'Nurse Assigned', {
    actor: 'admin',
    reason: `Assigned ${nurseName}`,
    patch: {
      nurse: nurseName,
      nextStep: `${nurseName} assigned. Arrival ETA follows before the visit.`,
    },
  });
  if (!result.ok) return result;
  const next = saveLastBooking(result.booking);
  upsertRepositoryEntity('booking', next, 'admin');
  upsertRepositoryEntity('visit', next, 'admin');
  queueCrossPortalEvent({
    type: 'visit.assigned',
    payload: {
      bookingId: next.id || next.reference,
      nurse: nurseName,
      status: next.status,
      clientVisible: true,
      nurseVisible: true,
    },
    actor: 'admin',
  });
  resolveAssignmentBroadcast(current.id || current.reference, nurseName);
  appendActivity(`Assigned ${nurseName} to latest booking`, { role: 'ops', bookingId: next.id, status: next.status });
  return { ok: true, booking: next, errors: [] };
}

export function advanceLatestBooking(status, extra = {}) {
  const current = readLastBooking();
  if (!current) return { ok: false, errors: ['No booking to update.'] };
  const {
    actor = 'ops',
    reason = `Latest booking moved to ${status}`,
    override = false,
    ...patchExtra
  } = extra;
  const nextStep = {
    Confirmed: 'Clinical review complete. RN assignment next.',
    Cleared: 'Clinical review complete. RN assignment next.',
    'Nurse Assigned': 'RN assigned. Arrival ETA follows before the visit.',
    'Ready for Visit': 'RN is preparing supplies.',
    'En Route': 'RN is on the way.',
    Arrived: 'RN has arrived.',
    'In Progress': 'Visit is in progress.',
    Completed: 'Visit complete. Watch for follow-up.',
    'Follow-Up Due': 'Care team follow-up ready.',
  }[status];

  const result = transitionBooking(current, status, {
    actor,
    reason,
    override,
    patch: { ...(nextStep ? { nextStep } : {}), ...patchExtra },
  });
  if (!result.ok) return result;
  const next = saveLastBooking(result.booking);
  upsertRepositoryEntity('booking', next, actor);
  upsertRepositoryEntity('visit', next, actor);
  queueCrossPortalEvent({
    type: 'visit.status_changed',
    payload: {
      bookingId: next.id || next.reference,
      status: next.status,
      nextStep: next.nextStep,
      clientVisible: true,
      nurseVisible: true,
    },
    actor,
  });
  appendActivity(`Latest booking moved to ${status}`, { role: 'ops', bookingId: next.id, status: next.status });
  return { ok: true, booking: next, errors: [] };
}

export function readVisitPrep() {
  return readLocal('visitPrep', DEFAULT_PREP_CHECKLIST);
}

export function saveVisitPrep(items) {
  return writeLocal('visitPrep', items);
}

export function readSavedAddresses() {
  return readLocal('savedAddresses', []);
}

export function saveAddress(address) {
  const current = readSavedAddresses();
  const next = [{ id: `addr-${Date.now()}`, ...address }, ...current].slice(0, 6);
  writeLocal('savedAddresses', next);
  appendActivity(`Saved address: ${address.label}`, { role: 'client' });
  return next;
}

export function inferBookingCity(booking = {}) {
  if (booking.city) return booking.city;
  const address = String(booking.address || '');
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2 && !/^[A-Z]{2}\s*\d{0,5}$/i.test(parts[1])) return parts[1];
  return booking.zip ? `ZIP ${booking.zip}` : 'City pending';
}

export function estimateShiftValue(booking = {}) {
  const explicit = Number(booking.shiftValue || booking.shiftPay || booking.nursePayout || 0);
  if (explicit > 0) return explicit;
  const addOnCount = Array.isArray(booking.addOns) ? booking.addOns.length : 0;
  const guests = Math.max(1, Number(booking.guests || 1));
  const orderText = [
    booking.service,
    booking.plan,
    booking.kind,
    booking.source,
    booking.locationType,
    booking.orderType,
  ].filter(Boolean).join(' ');
  const subscriptionPremium = booking.subscription ? 10 : 0;
  const groupPremium = Math.max(0, guests - 1) * 25;
  const eventPremium = /event|venue|group/i.test(orderText) ? 50 : 0;
  return DEFAULT_SHIFT_VALUE + subscriptionPremium + groupPremium + Math.min(addOnCount, 4) * 10 + eventPremium;
}

export function buildNurseShiftCopy(broadcast = {}) {
  const city = broadcast.city || inferBookingCity(broadcast);
  const value = Number(broadcast.shiftValue || broadcast.shiftPay || DEFAULT_SHIFT_VALUE);
  return [
    'Open Avalon shift',
    city,
    [broadcast.date, broadcast.time].filter(Boolean).join(' '),
    broadcast.service,
    `$${value}`,
    'Reply Y to accept or N to pass.',
  ].filter(Boolean).join(' · ');
}

export function bookingAssignmentId(booking = {}) {
  return `assign-${booking.id || booking.reference || Date.now()}`;
}

export const DEFAULT_NURSE_ALERT_SETTINGS = {
  enabled: true,
  repeatMinutes: 10,
  quietHours: false,
  quietStart: '21:00',
  quietEnd: '07:00',
  channels: {
    chat: true,
    sms: true,
    email: true,
  },
  recipients: 'Avalon Comms group, Nurseys-clear on-call nurses, dispatch lead',
  escalationAfterMinutes: 30,
  escalationNote: 'Escalate to dispatch lead if no nurse claims after three rounds.',
  template: 'Open Avalon shift: {{city}} · {{date}} {{time}} · {{service}} · ${{shiftValue}} · Reply Y/N',
};

export function readNurseAlertSettings() {
  const saved = readLocal('nurseAlertSettings', {});
  return {
    ...DEFAULT_NURSE_ALERT_SETTINGS,
    ...saved,
    channels: {
      ...DEFAULT_NURSE_ALERT_SETTINGS.channels,
      ...(saved.channels || {}),
    },
  };
}

export function saveNurseAlertSettings(settings = {}) {
  const current = readNurseAlertSettings();
  const next = {
    ...current,
    ...settings,
    channels: {
      ...current.channels,
      ...(settings.channels || {}),
    },
    repeatMinutes: Math.max(1, Number(settings.repeatMinutes ?? current.repeatMinutes)),
    escalationAfterMinutes: Math.max(1, Number(settings.escalationAfterMinutes ?? current.escalationAfterMinutes)),
    updatedAt: new Date().toISOString(),
  };
  writeLocal('nurseAlertSettings', next);
  appendActivity('Nurse alert settings updated', { role: 'ops', repeatMinutes: next.repeatMinutes });
  return next;
}

export function readAssignmentBroadcasts() {
  return readLocal('assignmentBroadcasts', []);
}

export function readOpsMessages() {
  return readLocal('opsMessages', [
    {
      id: 'ops-welcome',
      threadId: 'dispatch',
      audience: 'Dispatch',
      from: 'Avalon OS',
      role: 'system',
      text: 'Avalon Comms is live. Group threads, shift broadcasts, announcements, and Y/N nurse replies live here.',
      status: 'Delivered',
      relatedBroadcastId: '',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function sendOpsMessage(message = {}) {
  const text = String(message.text || '').trim();
  if (!text) return readOpsMessages();
  const channels = message.channels || [];
  const nextMessage = {
    id: `ops-msg-${Date.now()}`,
    threadId: message.threadId || 'dispatch',
    audience: message.audience || 'Dispatch',
    from: message.from || 'Avalon OS',
    role: message.role || 'ops',
    text,
    status: message.status || 'Delivered',
    channels,
    delivery: channels.map((channel) => ({
      key: channel,
      label: channel === 'sms' ? 'Text' : channel === 'email' ? 'Email' : channel === 'chat' ? 'Avalon Comms' : 'In-app',
      status: 'Queued',
    })),
    relatedBroadcastId: message.relatedBroadcastId || '',
    createdAt: new Date().toISOString(),
  };
  const next = [nextMessage, ...readOpsMessages()].slice(0, 80);
  writeLocal('opsMessages', next);
  appendActivity(`Ops message sent: ${text.slice(0, 48)}`, { role: nextMessage.role, threadId: nextMessage.threadId });
  return next;
}

function cleanText(value) {
  return String(value || '').trim();
}

function channelById(id = 'dispatch') {
  return COMMUNICATION_CHANNELS.find((channel) => channel.id === id) || COMMUNICATION_CHANNELS[0];
}

function templateById(id = 'shift-open') {
  return BROADCAST_TEMPLATES.find((template) => template.id === id) || BROADCAST_TEMPLATES[0];
}

function renderCommsTemplate(template = '', context = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context[key];
    return value === undefined || value === null || value === '' ? key : String(value);
  });
}

function relativeMinutes(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

const DEFAULT_COMMUNICATION_ALERTS = [
  {
    id: 'comm-alert-gfe-router',
    kind: 'gfe',
    title: 'GFE router armed',
    body: 'Avalon NP coverage is first. Qualiphy is fallback only when no remote NP is on call.',
    priority: 'action',
    status: 'open',
    audience: ['admin', 'provider', 'clinical', 'np'],
    channels: ['in_app', 'sms'],
    source: 'Clinical',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comm-alert-shift-router',
    kind: 'shift',
    title: 'Shift broadcast ready',
    body: 'Open visits broadcast through Avalon Comms, then queue SMS/email placeholders until delivery is connected.',
    priority: 'info',
    status: 'open',
    audience: ['admin', 'provider', 'nurse'],
    channels: ['in_app', 'sms', 'email'],
    source: 'Dispatch',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ann-event-presale',
    title: 'Event presales now trigger GFE routing',
    body: 'Festival and venue redemptions can queue Acuity, client prep, and pre-event GFE before arrival.',
    priority: 'info',
    audience: ['admin', 'provider'],
    status: 'published',
    channels: ['in_app'],
    readBy: [],
    createdBy: 'Avalon OS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ann-client-prep',
    title: 'Prep stays simple',
    body: 'Complete intake, watch for GFE if needed, and keep your phone nearby for nurse ETA.',
    priority: 'info',
    audience: ['client'],
    status: 'published',
    channels: ['in_app', 'sms'],
    readBy: [],
    createdBy: 'Care Team',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function communicationId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeAudience(audience = 'all') {
  if (Array.isArray(audience)) return audience.map((item) => String(item).toLowerCase()).filter(Boolean);
  return String(audience || 'all')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function communicationVisibleToRole(item = {}, role = 'client', userId = '') {
  if (role === 'admin') return true;
  const audience = normalizeAudience(item.audience || item.audiences || 'all');
  const normalizedRole = String(role || 'client').toLowerCase();
  const aliases = {
    client: ['client', 'patient', 'member'],
    provider: ['provider', 'nurse', 'rn', 'field', 'clinical'],
    nurse: ['provider', 'nurse', 'rn', 'field', 'clinical'],
    np: ['np', 'provider', 'clinical'],
    physician: ['physician', 'md', 'np', 'clinical'],
    ops: ['ops', 'dispatch', 'admin'],
  }[normalizedRole] || [normalizedRole];
  if (item.userTarget && userId && item.userTarget === userId) return true;
  return audience.includes('all') || aliases.some((alias) => audience.includes(alias));
}

export function readCommunicationAlerts() {
  return readLocal('communicationAlerts', DEFAULT_COMMUNICATION_ALERTS);
}

export function upsertCommunicationAlert(alert = {}) {
  const title = String(alert.title || '').trim();
  const body = String(alert.body || alert.text || '').trim();
  if (!title && !body) return readCommunicationAlerts();
  const id = alert.id || communicationId('comm-alert');
  const now = new Date().toISOString();
  const current = readCommunicationAlerts();
  const existing = current.find((item) => item.id === id);
  const nextAlert = {
    id,
    kind: alert.kind || existing?.kind || 'system',
    title: title || existing?.title || 'Alert',
    body: body || existing?.body || '',
    priority: alert.priority || existing?.priority || 'info',
    status: alert.status || existing?.status || 'open',
    audience: normalizeAudience(alert.audience || existing?.audience || 'all'),
    channels: alert.channels || existing?.channels || ['in_app'],
    source: alert.source || existing?.source || 'Avalon OS',
    userTarget: alert.userTarget || existing?.userTarget || '',
    linkedEntityType: alert.linkedEntityType || existing?.linkedEntityType || '',
    linkedEntityId: alert.linkedEntityId || existing?.linkedEntityId || '',
    actionLabel: alert.actionLabel || existing?.actionLabel || '',
    requiresAck: Boolean(alert.requiresAck ?? existing?.requiresAck),
    dueAt: alert.dueAt || existing?.dueAt || '',
    acknowledgedBy: existing?.acknowledgedBy || '',
    acknowledgedAt: existing?.acknowledgedAt || '',
    resolvedBy: existing?.resolvedBy || '',
    resolvedAt: existing?.resolvedAt || '',
    createdAt: existing?.createdAt || alert.createdAt || now,
    updatedAt: now,
  };
  const next = [nextAlert, ...current.filter((item) => item.id !== id)].slice(0, 80);
  writeLocal('communicationAlerts', next);
  appendActivity(`Communication alert: ${nextAlert.title}`, { role: 'system', priority: nextAlert.priority });
  return next;
}

export function acknowledgeCommunicationAlert(id, actor = 'Avalon OS') {
  const now = new Date().toISOString();
  const next = readCommunicationAlerts().map((item) => (
    item.id === id
      ? { ...item, status: item.status === 'resolved' ? 'resolved' : 'acknowledged', acknowledgedBy: actor, acknowledgedAt: now, updatedAt: now }
      : item
  ));
  writeLocal('communicationAlerts', next);
  appendActivity(`Alert acknowledged: ${id}`, { role: actor });
  return next;
}

export function resolveCommunicationAlert(id, actor = 'Avalon OS') {
  const now = new Date().toISOString();
  const next = readCommunicationAlerts().map((item) => (
    item.id === id
      ? { ...item, status: 'resolved', resolvedBy: actor, resolvedAt: now, updatedAt: now }
      : item
  ));
  writeLocal('communicationAlerts', next);
  appendActivity(`Alert resolved: ${id}`, { role: actor });
  return next;
}

export function readAnnouncements() {
  return readLocal('announcements', DEFAULT_ANNOUNCEMENTS);
}

export function createAnnouncement(announcement = {}) {
  const title = String(announcement.title || '').trim();
  const body = String(announcement.body || '').trim();
  if (!title && !body) return readAnnouncements();
  const now = new Date().toISOString();
  const nextAnnouncement = {
    id: announcement.id || communicationId('ann'),
    title: title || 'Announcement',
    body,
    priority: announcement.priority || 'info',
    audience: normalizeAudience(announcement.audience || 'all'),
    status: announcement.status || 'published',
    channels: announcement.channels || ['in_app'],
    readBy: [],
    createdBy: announcement.createdBy || 'Avalon OS',
    createdAt: now,
    updatedAt: now,
  };
  const next = [nextAnnouncement, ...readAnnouncements()].slice(0, 60);
  writeLocal('announcements', next);
  appendActivity(`Announcement published: ${nextAnnouncement.title}`, { role: 'ops', audience: nextAnnouncement.audience.join(',') });
  return next;
}

export function markAnnouncementRead(id, userId = 'local-user') {
  const next = readAnnouncements().map((item) => {
    if (item.id !== id) return item;
    const readBy = Array.from(new Set([...(item.readBy || []), userId]));
    return { ...item, readBy, updatedAt: new Date().toISOString() };
  });
  writeLocal('announcements', next);
  return next;
}

export function readCommunicationChannels() {
  const messages = readOpsMessages();
  return COMMUNICATION_CHANNELS.map((channel) => {
    const channelMessages = messages.filter((message) => (message.threadId || 'dispatch') === channel.id);
    return {
      ...channel,
      count: channelMessages.length,
      lastMessageAt: channelMessages[0]?.createdAt || '',
      status: channelMessages.length ? 'Live' : 'Ready',
    };
  });
}

export function readBroadcastTemplates() {
  return BROADCAST_TEMPLATES;
}

export function buildBroadcastContext(booking = readLastBooking()) {
  const item = booking || {};
  return {
    client: item.contact?.name || item.client || 'Client',
    nurse: item.nurse && item.nurse !== 'Unassigned' ? item.nurse : 'your RN',
    service: item.service || item.plan || 'Avalon visit',
    city: inferBookingCity(item),
    date: item.date || 'date pending',
    time: item.time || 'time pending',
    shiftValue: item.shiftValue || item.shiftPay || estimateShiftValue(item),
    eta: item.eta || 'soon',
    event: item.eventName || item.event || 'event',
    staffing: item.staffing || item.guests || 'TBD',
  };
}

export function sendBroadcastMessage(payload = {}) {
  const template = templateById(payload.templateId);
  const channel = channelById(payload.channelId || template.channelId);
  const latest = readLastBooking();
  const context = {
    ...buildBroadcastContext(latest),
    ...(payload.context || {}),
  };
  const text = cleanText(payload.text) || renderCommsTemplate(template.body, context);
  const audience = payload.audience || template.audience || channel.audience;
  const priority = payload.priority || template.priority || 'info';
  const relatedBroadcastId = payload.relatedBroadcastId || communicationId('broadcast');
  const channels = payload.channels || channel.channels || ['in_app'];

  const next = sendOpsMessage({
    threadId: channel.id,
    audience,
    from: payload.from || 'Avalon Comms',
    role: payload.role || 'broadcast',
    status: payload.status || 'Queued',
    channels,
    relatedBroadcastId,
    text,
  });

  if (payload.requiresAck ?? template.requiresAck) {
    upsertCommunicationAlert({
      id: `ack-${relatedBroadcastId}`,
      kind: 'ack',
      title: `${template.label} ack required`,
      body: text,
      priority,
      status: 'open',
      audience: normalizeAudience(payload.alertAudience || (channel.id === 'client-texts' ? 'client' : 'admin,provider')),
      channels,
      source: 'Avalon Comms',
      linkedEntityType: payload.linkedEntityType || 'broadcast',
      linkedEntityId: latest?.id || latest?.reference || relatedBroadcastId,
      actionLabel: 'Ack required',
      requiresAck: true,
    });
  }

  if (template.id === 'shift-open' && latest && (!latest.nurse || latest.nurse === 'Unassigned')) {
    createAssignmentBroadcast(latest, { source: 'Avalon Comms broadcast' });
  }

  appendActivity(`Broadcast sent: ${template.label}`, { role: 'ops', channel: channel.id, audience });
  return next;
}

export function buildAppointmentCommsTimeline(booking = readLastBooking()) {
  const item = booking || {};
  const bookingId = item.id || item.reference || '';
  const bookingClient = item.contact?.name || item.client || 'Latest client';
  const matches = (value = '') => bookingId && String(value || '').includes(bookingId);
  const rows = [];

  if (bookingId) {
    rows.push({
      id: `timeline-booking-${bookingId}`,
      at: item.updatedAt || item.createdAt || new Date().toISOString(),
      source: 'Acuity handoff',
      title: `${bookingClient} · ${item.service || item.plan || 'Avalon visit'}`,
      detail: `Status: ${item.status || 'Scheduling received'}. Acuity owns EMR and schedule.`,
      tone: 'info',
    });
  }

  readOpsMessages().forEach((message) => {
    if (!matches(message.relatedBroadcastId) && !matches(message.linkedEntityId) && bookingId) return;
    rows.push({
      id: `timeline-message-${message.id}`,
      at: message.createdAt,
      source: message.from || 'Avalon Comms',
      title: channelById(message.threadId).label,
      detail: message.text,
      tone: message.status === 'Accepted' ? 'ready' : 'info',
    });
  });

  readCommunicationAlerts().forEach((alert) => {
    if (!matches(alert.linkedEntityId) && !matches(alert.id) && bookingId) return;
    rows.push({
      id: `timeline-alert-${alert.id}`,
      at: alert.updatedAt || alert.createdAt,
      source: alert.source || 'Alert',
      title: alert.title,
      detail: alert.body,
      tone: alert.priority || 'action',
    });
  });

  readAssignmentBroadcasts().forEach((broadcast) => {
    if (!matches(broadcast.bookingId) && bookingId) return;
    rows.push({
      id: `timeline-broadcast-${broadcast.id}`,
      at: broadcast.updatedAt || broadcast.createdAt,
      source: 'Shift broadcast',
      title: `${broadcast.city} · $${broadcast.shiftValue}`,
      detail: broadcast.status === 'Assigned'
        ? `Assigned to ${broadcast.assignedTo}.`
        : broadcast.nurseReplyPrompt || buildNurseShiftCopy(broadcast),
      tone: broadcast.status === 'Assigned' ? 'ready' : 'urgent',
    });
  });

  readShiftReplies().forEach((reply) => {
    if (!matches(reply.bookingId) && !matches(reply.broadcastId) && bookingId) return;
    rows.push({
      id: `timeline-reply-${reply.id}`,
      at: reply.createdAt,
      source: reply.nurseName,
      title: `Shift reply ${reply.reply}`,
      detail: reply.status,
      tone: reply.status === 'Accepted' ? 'ready' : 'info',
    });
  });

  readGfeRoutingQueue().forEach((route) => {
    if (!matches(route.bookingId) && bookingId) return;
    rows.push({
      id: `timeline-gfe-${route.id}`,
      at: route.updatedAt || route.createdAt,
      source: 'GFE Router',
      title: route.status,
      detail: route.destination?.fallback ? 'Qualiphy fallback only because no Avalon NP is on call.' : route.reason,
      tone: route.required ? 'action' : 'ready',
    });
  });

  readLocal('acuityCloseoutPackets', []).forEach((packet) => {
    if (!matches(packet.appointmentId) && bookingId) return;
    rows.push({
      id: `timeline-closeout-${packet.id}`,
      at: packet.completedAt,
      source: 'Acuity closeout',
      title: packet.acuityStatus || packet.status,
      detail: `${packet.serviceName || 'Visit'} · ${packet.nurseName || 'Nurse'}.`,
      tone: packet.status === 'Complete' ? 'ready' : 'action',
    });
  });

  const sorted = rows
    .filter((row) => row.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  return sorted.length ? sorted.slice(0, 18) : readOpsMessages().slice(0, 8).map((message) => ({
    id: `timeline-fallback-${message.id}`,
    at: message.createdAt,
    source: message.from,
    title: channelById(message.threadId).label,
    detail: message.text,
    tone: 'info',
  }));
}

export function evaluateCommsEscalations() {
  const settings = readNurseAlertSettings();
  const activeBroadcasts = readAssignmentBroadcasts().filter((item) => item.status !== 'Assigned');
  const gfeQueue = readGfeRoutingQueue().filter((item) => item.required);
  const incidents = readLocal('clinicalIncidents', []);

  const shiftItems = activeBroadcasts.map((item) => {
    const age = relativeMinutes(item.updatedAt || item.createdAt);
    const overdue = age >= Number(item.escalationAfterMinutes || settings.escalationAfterMinutes);
    return {
      id: `esc-shift-${item.id}`,
      kind: 'shift',
      label: `Open shift · ${item.city}`,
      detail: overdue ? 'Rebroadcast now.' : `Next sweep in ${Math.max(0, Number(item.repeatsEveryMinutes || settings.repeatMinutes) - age)} min.`,
      priority: overdue ? 'urgent' : 'watch',
      overdue,
      sourceId: item.id,
    };
  });

  const gfeItems = gfeQueue.map((item) => {
    const age = relativeMinutes(item.updatedAt || item.createdAt);
    const overdue = age >= 15;
    return {
      id: `esc-gfe-${item.id}`,
      kind: 'gfe',
      label: `GFE · ${item.client}`,
      detail: item.destination?.fallback ? 'Qualiphy fallback is active.' : overdue ? 'Ping Avalon NP.' : 'Avalon NP route active.',
      priority: item.destination?.fallback ? 'critical' : overdue ? 'urgent' : 'watch',
      overdue,
      sourceId: item.id,
    };
  });

  const incidentItems = incidents
    .filter((item) => item.status !== 'Resolved')
    .map((item) => ({
      id: `esc-incident-${item.id}`,
      kind: 'incident',
      label: `Incident · ${item.clientName || 'Client'}`,
      detail: item.summary || 'Clinical/admin review required.',
      priority: 'critical',
      overdue: true,
      sourceId: item.id,
    }));

  return [...incidentItems, ...gfeItems, ...shiftItems].slice(0, 12);
}

export function runCommsEscalationSweep() {
  const escalations = evaluateCommsEscalations();
  escalations.forEach((item) => {
    if (!item.overdue) return;
    const channelId = item.kind === 'incident' ? 'incidents' : item.kind === 'gfe' ? 'gfe' : 'nurses';
    sendBroadcastMessage({
      templateId: item.kind === 'incident' ? 'incident' : item.kind === 'gfe' ? 'gfe-required' : 'shift-open',
      channelId,
      audience: channelById(channelId).audience,
      priority: item.priority,
      requiresAck: item.kind !== 'shift',
      relatedBroadcastId: `sweep-${item.sourceId}`,
      text: `${item.label}: ${item.detail}`,
      alertAudience: item.kind === 'incident' ? 'admin,provider,clinical' : 'admin,provider',
    });
  });
  appendActivity('Comms escalation sweep ran', { role: 'ops', count: escalations.length });
  return escalations;
}

export function readRoleCommunications({ role = 'client', userId = '' } = {}) {
  const alerts = readCommunicationAlerts().filter((item) => communicationVisibleToRole(item, role, userId));
  const announcements = readAnnouncements().filter((item) => (
    item.status !== 'archived' && communicationVisibleToRole(item, role, userId)
  ));
  const opsMessages = role === 'client'
    ? readOpsMessages().filter((message) => message.threadId === 'client-texts')
    : readOpsMessages().filter((message) => message.threadId !== 'client-texts' || role === 'admin');
  const supportThread = readSupportThread();
  return { alerts, announcements, opsMessages, supportThread };
}

export function buildCommunicationSnapshot({ role = 'client', userId = '' } = {}) {
  const { alerts, announcements, opsMessages } = readRoleCommunications({ role, userId });
  const activeAlerts = alerts.filter((item) => item.status !== 'resolved');
  const unreadAnnouncements = announcements.filter((item) => !(item.readBy || []).includes(userId || 'local-user'));
  const urgentAlerts = activeAlerts.filter((item) => ['critical', 'urgent', 'action'].includes(item.priority));
  return {
    activeAlerts: activeAlerts.length,
    urgentAlerts: urgentAlerts.length,
    announcements: announcements.length,
    unreadAnnouncements: unreadAnnouncements.length,
    messages: opsMessages.length,
    unreadTotal: activeAlerts.length + unreadAnnouncements.length,
  };
}

export function queueBroadcastMessage(broadcast = {}) {
  if (!broadcast?.id) return readOpsMessages();
  const current = readOpsMessages();
  const existing = current.find((message) => message.relatedBroadcastId === broadcast.id && message.role === 'alert');
  if (existing) return current;
  return sendOpsMessage({
    threadId: 'dispatch',
    audience: broadcast.recipients || 'On-call nurses',
    from: 'Nurse Alert System',
    role: 'alert',
    status: 'Broadcasting',
    channels: (broadcast.channels || []).map((channel) => channel.key),
    relatedBroadcastId: broadcast.id,
    text: buildNurseShiftCopy(broadcast),
  });
}

export function createAssignmentBroadcast(booking = {}, options = {}) {
  if (!booking?.id && !booking?.reference) return null;
  if (booking.nurse && booking.nurse !== 'Unassigned') return null;
  const settings = readNurseAlertSettings();
  if (!settings.enabled) return null;
  const id = bookingAssignmentId(booking);
  const current = readAssignmentBroadcasts();
  const existing = current.find((item) => item.id === id);
  const channels = [
    settings.channels.chat ? { key: 'chat', label: 'Avalon Comms group', status: 'Queued' } : null,
    settings.channels.sms ? { key: 'sms', label: 'SMS placeholder', status: 'Queued' } : null,
    settings.channels.email ? { key: 'email', label: 'Email placeholder', status: 'Queued' } : null,
  ].filter(Boolean);
  const city = options.city || inferBookingCity(booking);
  const shiftValue = Number(options.shiftValue || booking.shiftValue || booking.shiftPay || estimateShiftValue(booking));
  const address = booking.address || booking.city || 'Address pending';
  const clientPhone = booking.contact?.phone || booking.phone || '';
  const nextItem = {
    id,
    bookingId: booking.id || booking.reference,
    source: options.source || booking.source || 'Website',
    type: options.type || booking.kind || (booking.subscription ? 'Subscription' : 'One-time visit'),
    assignmentScope: options.scope || (booking.subscription ? 'All subscription dates' : 'Single appointment'),
    client: booking.contact?.name || [booking.contact?.firstName, booking.contact?.lastName].filter(Boolean).join(' ') || 'New client',
    clientPhone,
    service: booking.service || booking.plan || 'Avalon visit',
    date: booking.date || 'Date pending',
    time: booking.time || 'Time pending',
    city,
    address,
    shiftValue,
    credentialFilter: options.credentialFilter || booking.credentialFilter || 'Nurseys Clear',
    credentialSource: NURSEYS_CREDENTIAL_PLACEHOLDER.service,
    replyKeywords: { accept: 'Y', decline: 'N' },
    maps: {
      apple: appleMapsUrl(address),
      google: googleMapsUrl(address),
    },
    repeatsEveryMinutes: options.repeatsEveryMinutes || settings.repeatMinutes,
    recipients: settings.recipients,
    escalationAfterMinutes: settings.escalationAfterMinutes,
    escalationNote: settings.escalationNote,
    template: settings.template,
    status: existing?.status === 'Assigned' ? 'Assigned' : 'Broadcasting',
    assignedTo: existing?.assignedTo || '',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    channels: existing?.channels || channels,
  };
  nextItem.nurseReplyPrompt = buildNurseShiftCopy(nextItem);
  const next = [nextItem, ...current.filter((item) => item.id !== id)].slice(0, 20);
  writeLocal('assignmentBroadcasts', next);
  queueBroadcastMessage(nextItem);
  upsertCommunicationAlert({
    id: `alert-${nextItem.id}`,
    kind: 'shift',
    title: `Open shift: ${nextItem.city}`,
    body: `${nextItem.service} · ${nextItem.date} ${nextItem.time} · $${nextItem.shiftValue}. Reply Y to accept or N to pass.`,
    priority: 'urgent',
    status: nextItem.status === 'Assigned' ? 'resolved' : 'open',
    audience: ['admin', 'provider', 'nurse'],
    channels: nextItem.channels.map((channel) => channel.key),
    source: 'Nurse Alert System',
    linkedEntityType: 'booking',
    linkedEntityId: nextItem.bookingId,
    actionLabel: 'Claim shift',
  });
  appendActivity(`Assignment broadcast queued for ${nextItem.service}`, {
    role: 'ops',
    bookingId: nextItem.bookingId,
    channels: nextItem.channels.map((channel) => channel.key),
  });
  return nextItem;
}

export function seedAssignmentBroadcastsFromLatestBooking() {
  const latest = readLastBooking();
  if (latest?.nurse === 'Unassigned') createAssignmentBroadcast(latest, { source: latest.source || 'Website' });
  return readAssignmentBroadcasts();
}

export function resolveAssignmentBroadcast(bookingOrBroadcastId, nurseName = 'Assigned nurse') {
  const id = String(bookingOrBroadcastId || '');
  const next = readAssignmentBroadcasts().map((item) => {
    const matches = item.id === id || item.bookingId === id || item.id === bookingAssignmentId({ id });
    if (!matches) return item;
    sendOpsMessage({
      threadId: 'dispatch',
      audience: item.recipients || 'Dispatch',
      from: 'Avalon OS',
      role: 'system',
      relatedBroadcastId: item.id,
      text: `${item.client} assignment stopped. Assigned to ${nurseName}.`,
    });
    resolveCommunicationAlert(`alert-${item.id}`, nurseName);
    return {
      ...item,
      status: 'Assigned',
      assignedTo: nurseName,
      updatedAt: new Date().toISOString(),
      channels: item.channels.map((channel) => ({ ...channel, status: 'Stopped' })),
    };
  });
  writeLocal('assignmentBroadcasts', next);
  appendActivity(`Assignment broadcast stopped for ${id}`, { role: 'ops', nurse: nurseName });
  return next;
}

export function readShiftReplies() {
  return readLocal('shiftReplies', []);
}

function writeShiftReply(reply = {}) {
  const nextReply = {
    id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    broadcastId: reply.broadcastId || '',
    bookingId: reply.bookingId || '',
    nurseName: reply.nurseName || 'Nurse',
    reply: reply.reply || 'Y',
    status: reply.status || 'Accepted',
    note: reply.note || '',
    createdAt: new Date().toISOString(),
  };
  const next = [nextReply, ...readShiftReplies()].slice(0, 80);
  writeLocal('shiftReplies', next);
  return nextReply;
}

export function acceptShiftBroadcast(broadcastId, nurseName = 'Assigned nurse') {
  const broadcast = readAssignmentBroadcasts().find((item) => item.id === broadcastId || item.bookingId === broadcastId);
  const replies = writeShiftReply({
    broadcastId: broadcast?.id || broadcastId,
    bookingId: broadcast?.bookingId || '',
    nurseName,
    reply: 'Y',
    status: 'Accepted',
  });
  const nextBroadcasts = resolveAssignmentBroadcast(broadcastId, nurseName);
  const latest = readLastBooking();
  if (latest && broadcast && (broadcast.bookingId === latest.id || broadcast.bookingId === latest.reference)) {
    const result = transitionBooking(latest, 'Nurse Assigned', {
      actor: nurseName,
      override: true,
      reason: 'Nurse accepted shift by Y reply',
      patch: {
        nurse: nurseName,
        nextStep: `${nurseName} accepted. ETA and route are ready.`,
      },
    });
    if (result.ok) saveLastBooking(result.booking);
  }
  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Dispatch',
    from: nurseName,
    role: 'nurse-reply',
    status: 'Accepted',
    channels: ['chat', 'sms'],
    relatedBroadcastId: broadcast?.id || broadcastId,
    text: `${nurseName} replied Y and accepted ${broadcast?.service || 'the open shift'}.`,
  });
  if (broadcast?.clientPhone) {
    sendOpsMessage({
      threadId: 'client-texts',
      audience: broadcast.clientPhone,
      from: 'Avalon Client Text',
      role: 'client-text',
      status: 'Queued',
      channels: ['sms'],
      relatedBroadcastId: `${broadcast.id}-nurse-confirmed`,
      text: `Avalon: ${nurseName} accepted your visit. ETA and route updates will follow before arrival.`,
    });
  }
  appendActivity(`Shift accepted by ${nurseName}`, { role: 'nurse', broadcastId, replyId: replies.id });
  return nextBroadcasts;
}

export function declineShiftBroadcast(broadcastId, nurseName = 'Nurse') {
  const current = readAssignmentBroadcasts();
  const broadcast = current.find((item) => item.id === broadcastId || item.bookingId === broadcastId);
  writeShiftReply({
    broadcastId: broadcast?.id || broadcastId,
    bookingId: broadcast?.bookingId || '',
    nurseName,
    reply: 'N',
    status: 'Passed',
  });
  const next = current.map((item) => {
    const matches = item.id === broadcastId || item.bookingId === broadcastId;
    if (!matches) return item;
    return {
      ...item,
      status: 'Broadcasting',
      passedBy: Array.from(new Set([...(item.passedBy || []), nurseName])),
      updatedAt: new Date().toISOString(),
      channels: item.channels.map((channel) => ({ ...channel, status: channel.status === 'Stopped' ? 'Stopped' : 'Queued' })),
    };
  });
  writeLocal('assignmentBroadcasts', next);
  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Dispatch',
    from: nurseName,
    role: 'nurse-reply',
    status: 'Passed',
    channels: ['chat', 'sms'],
    relatedBroadcastId: broadcast?.id || broadcastId,
    text: `${nurseName} replied N and passed ${broadcast?.service || 'the open shift'}. Broadcast remains open.`,
  });
  appendActivity(`Shift passed by ${nurseName}`, { role: 'nurse', broadcastId });
  return next;
}

export const DEFAULT_GFE_ON_CALL = [
  { id: 'np-mobile-1', name: 'Mobile GFE NP', onShift: true, channel: 'text' },
];

export function readGfeRoutingQueue() {
  return readLocal('gfeRoutingQueue', []);
}

export function readGfeOnCallRoster() {
  return readLocal('gfeOnCallRoster', DEFAULT_GFE_ON_CALL);
}

export function selectGfeDestination(options = {}) {
  const roster = Array.isArray(options.onCallNps) ? options.onCallNps : readGfeOnCallRoster();
  const active = roster.find((np) => np && np.onShift !== false);
  if (active) {
    return {
      type: 'Mobile NP',
      name: active.name || 'On-call NP',
      channel: active.channel || 'text',
      fallback: false,
    };
  }
  return {
    type: 'Qualiphy',
    name: QUALIPHY_GFE_PLACEHOLDER.service,
    channel: 'api',
    fallback: true,
  };
}

export function routeGfeForBooking(booking = {}, options = {}) {
  if (!booking?.id && !booking?.reference) return null;
  const requirement = resolveGfeRequirement(booking);
  const id = `gfe-${booking.id || booking.reference}`;
  const current = readGfeRoutingQueue();
  const existing = current.find((item) => item.id === id);
  const destination = requirement.required ? selectGfeDestination(options) : {
    type: 'Record',
    name: 'Valid GFE on file',
    channel: 'chart',
    fallback: false,
  };
  const client = booking.contact?.name || [booking.contact?.firstName, booking.contact?.lastName].filter(Boolean).join(' ') || 'New client';
  const item = {
    id,
    bookingId: booking.id || booking.reference,
    client,
    clientPhone: booking.contact?.phone || '',
    service: booking.service || booking.plan || 'Avalon visit',
    date: booking.date || 'Date pending',
    time: booking.time || 'Time pending',
    city: inferBookingCity(booking),
    required: requirement.required,
    status: requirement.required ? `Routed to ${destination.name}` : 'Valid on file',
    reason: requirement.reason,
    validDays: GFE_VALID_DAYS,
    expiresAt: requirement.expiresAt || '',
    destination,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const next = [item, ...current.filter((entry) => entry.id !== id)].slice(0, 40);
  writeLocal('gfeRoutingQueue', next);

  if (requirement.required) {
    upsertCommunicationAlert({
      id: `alert-${id}`,
      kind: 'gfe',
      title: destination.fallback ? 'Qualiphy fallback needed' : `GFE needed: ${client}`,
      body: `${item.service} · ${item.date} ${item.time} · ${item.city}. ${destination.fallback ? 'No Avalon NP is on shift.' : `Route to ${destination.name}.`}`,
      priority: destination.fallback ? 'critical' : 'action',
      status: 'open',
      audience: destination.fallback ? ['admin', 'clinical'] : ['admin', 'provider', 'np', 'clinical'],
      channels: [destination.channel === 'api' ? 'in_app' : 'sms'],
      source: 'GFE Router',
      linkedEntityType: 'booking',
      linkedEntityId: item.bookingId,
      actionLabel: destination.fallback ? 'Send to Qualiphy' : 'Text NP',
    });
    upsertCommunicationAlert({
      id: `alert-${id}-client`,
      kind: 'client',
      title: 'GFE required',
      body: 'Complete your GFE before the visit. Clearance stays valid for one year.',
      priority: 'action',
      status: 'open',
      audience: ['client'],
      channels: ['in_app', 'sms'],
      source: 'Avalon Client Text',
      linkedEntityType: 'booking',
      linkedEntityId: item.bookingId,
      actionLabel: 'Complete GFE',
    });
  } else {
    resolveCommunicationAlert(`alert-${id}`, 'GFE Router');
    resolveCommunicationAlert(`alert-${id}-client`, 'GFE Router');
  }

  const relatedBroadcastId = `${id}-route`;
  const alreadyMessaged = readOpsMessages().some((message) => message.relatedBroadcastId === relatedBroadcastId);
  if (!alreadyMessaged) {
    sendOpsMessage({
      threadId: requirement.required ? 'gfe' : 'dispatch',
      audience: destination.name,
      from: requirement.required ? 'GFE Router' : 'Avalon OS',
      role: requirement.required ? 'clinical-route' : 'system',
      status: requirement.required ? 'Queued' : 'Noted',
      channels: [destination.channel === 'api' ? 'chat' : 'sms'],
      relatedBroadcastId,
      text: requirement.required
        ? `${client} needs GFE before dispatch. ${item.service} · ${item.date} ${item.time} · ${item.city}. ${destination.fallback ? 'No NP on shift; route to Qualiphy.' : `Text ${destination.name}.`}`
        : `${client} has a current GFE. Valid ${requirement.expiresAt ? `through ${new Date(requirement.expiresAt).toLocaleDateString('en-US')}` : 'on file'}.`,
    });
  }

  if (requirement.required && item.clientPhone) {
    const clientTextId = `${id}-client-text`;
    const clientTextExists = readOpsMessages().some((message) => message.relatedBroadcastId === clientTextId);
    if (!clientTextExists) {
      sendOpsMessage({
        threadId: 'client-texts',
        audience: item.clientPhone,
        from: 'Avalon Client Text',
        role: 'client-text',
        status: 'Queued',
        channels: ['sms'],
        relatedBroadcastId: clientTextId,
        text: 'Avalon: please complete your GFE before the visit. The clearance stays valid for one year.',
      });
    }
  }

  appendActivity(`GFE route ${item.status}`, { role: 'clinical', bookingId: item.bookingId, destination: destination.name });
  return item;
}

export function buildOrderFlowPlan(booking = {}, options = {}) {
  const gfe = resolveGfeRequirement(booking);
  const city = options.city || inferBookingCity(booking);
  const shiftValue = Number(options.shiftValue || booking.shiftValue || booking.shiftPay || estimateShiftValue(booking));
  const orderType = booking.subscription
    ? 'subscription'
    : booking.orderType || booking.kind || (booking.items?.some((item) => item.type === 'im') ? 'protocol' : 'recovery');
  const hasSlot = Boolean(booking.acuitySlot?.datetime || booking.datetime || booking.time);
  const steps = ORDER_FLOW_STEPS.map((step) => {
    const status = {
      order: booking.service || booking.plan || 'Protocol selected',
      deposit: `$${Number(options.depositAmount || booking.depositAmount || 50)} deposit`,
      schedule: hasSlot ? 'Slot held' : 'Schedule pending',
      crm: 'Attio outreach queued',
      gfe: gfe.required ? 'GFE required' : 'GFE valid',
      shift: `${city} · $${shiftValue}`,
      route: booking.nurse && booking.nurse !== 'Unassigned' ? 'Maps ready' : 'After nurse accepts',
    }[step.key];
    return { ...step, status };
  });

  return {
    orderType,
    productFamilies: ORDER_PRODUCT_FAMILIES,
    city,
    shiftValue,
    depositAmount: Number(options.depositAmount || booking.depositAmount || 50),
    gfe,
    steps,
  };
}

export function orchestrateOrderHandoff(booking = {}, options = {}) {
  if (!booking?.id && !booking?.reference) return { plan: buildOrderFlowPlan(booking, options), broadcast: null, gfeRoute: null };
  const plan = buildOrderFlowPlan(booking, options);
  const bookingId = booking.id || booking.reference;
  const latest = readLastBooking();
  if (latest && (latest.id === bookingId || latest.reference === bookingId)) {
    saveLastBooking({
      ...latest,
      city: plan.city,
      shiftValue: plan.shiftValue,
      orderFlow: plan,
      gfeRequired: plan.gfe.required,
      gfeStatusReason: plan.gfe.reason,
      gfeExpiresAt: plan.gfe.expiresAt || latest.gfeExpiresAt || '',
    });
  }
  const broadcast = createAssignmentBroadcast({
    ...booking,
    city: plan.city,
    shiftValue: plan.shiftValue,
    orderFlow: plan,
  }, {
    ...options,
    city: plan.city,
    shiftValue: plan.shiftValue,
  });
  const gfeRoute = routeGfeForBooking(booking, options);
  const id = `handoff-${booking.id || booking.reference}`;
  const alreadyMessaged = readOpsMessages().some((message) => message.relatedBroadcastId === id);
  if (!alreadyMessaged) {
    sendOpsMessage({
      threadId: 'dispatch',
      audience: 'Dispatch',
      from: 'Order Flow',
      role: 'system',
      status: 'Queued',
      channels: ['chat'],
      relatedBroadcastId: id,
      text: `Order handoff queued: ${plan.orderType} · deposit ${plan.depositAmount} · Acuity · Attio · ${plan.gfe.status} GFE · ${plan.city} shift $${plan.shiftValue}.`,
    });
  }
  upsertCommunicationAlert({
    id: `alert-${id}`,
    kind: 'order',
    title: 'Order handoff queued',
    body: `${plan.orderType} · $${plan.depositAmount} deposit · Acuity · Attio · ${plan.city} shift $${plan.shiftValue}.`,
    priority: plan.gfe.required ? 'action' : 'info',
    status: 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Order Flow',
    linkedEntityType: 'booking',
    linkedEntityId: bookingId,
  });
  appendActivity('Order handoff orchestrated', { role: 'ops', bookingId: booking.id || booking.reference, orderType: plan.orderType });
  return { plan, broadcast, gfeRoute };
}

export function readMileageLog() {
  return readLocal('nurseMileageLog', []);
}

export function addMileageEntry(entry = {}) {
  const miles = Math.max(0, Number(entry.miles || 0));
  if (!miles) return readMileageLog();
  const nextEntry = {
    id: `mile-${Date.now()}`,
    miles,
    from: entry.from || 'Current location',
    to: entry.to || 'Visit route',
    note: entry.note || '',
    visitId: entry.visitId || '',
    createdAt: new Date().toISOString(),
  };
  const next = [nextEntry, ...readMileageLog()].slice(0, 60);
  writeLocal('nurseMileageLog', next);
  appendActivity(`Nurse logged ${miles.toFixed(1)} personal miles`, { role: 'nurse', visitId: nextEntry.visitId });
  return next;
}

export function readPayrollProofQueue() {
  return readLocal('gustoPayrollProofQueue', []);
}

export function queueGustoPayrollProof(entry = {}) {
  const visitId = entry.visitId || entry.appointmentId || `visit-${Date.now()}`;
  const now = new Date().toISOString();
  const nextEntry = {
    id: visitId,
    visitId,
    nurseName: entry.nurseName || entry.nurse || 'Nurse',
    service: entry.service || 'Avalon visit',
    shiftValue: Number(entry.shiftValue || entry.shiftPay || DEFAULT_SHIFT_VALUE),
    miles: Number(entry.miles || 0),
    reimbursements: Number(entry.reimbursements || 0),
    chartStatus: entry.chartStatus || 'Complete',
    destination: GUSTO_PAYROLL_PLACEHOLDER.service,
    bank: MERCURY_BANKING_PLACEHOLDER.service,
    accountingDestination: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service,
    status: 'Ready',
    phiExcluded: true,
    completedAt: entry.completedAt || now,
    createdAt: now,
  };
  const current = readPayrollProofQueue().filter((item) => item.id !== visitId);
  const next = [nextEntry, ...current].slice(0, 80);
  writeLocal('gustoPayrollProofQueue', next);
  appendActivity(`${GUSTO_PAYROLL_PLACEHOLDER.service} proof queued for ${visitId}`, { role: 'ops', visitId, destination: GUSTO_PAYROLL_PLACEHOLDER.service });
  return next;
}

export function buildNurseRoutePreview(appointments = [], latestBooking = null) {
  const fixtureStops = appointments.map((appt) => ({
    id: appt.id,
    label: appt.clientName || 'Client visit',
    service: appt.serviceName || 'Scheduled visit',
    time: appt.timeLabel || '',
    address: [appt.location_address, appt.location_city].filter(Boolean).join(', '),
  }));
  const liveStop = latestBooking?.address && latestBooking?.status !== 'Completed'
    ? [{
      id: latestBooking.id || latestBooking.reference || 'latest',
      label: latestBooking.contact?.name || 'Live handoff',
      service: latestBooking.service || 'Avalon visit',
      time: [latestBooking.date, latestBooking.time].filter(Boolean).join(' · '),
      address: latestBooking.address,
    }]
    : [];
  return [...liveStop, ...fixtureStops]
    .filter((stop, index, all) => stop.address && all.findIndex((item) => item.address === stop.address) === index)
    .slice(0, 5);
}

export function appleMapsUrl(address = '') {
  return `http://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

export function googleMapsUrl(address = '') {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function readSupportThread() {
  return readLocal('supportThread', [
    { id: 'welcome', from: 'care', text: 'Care team standing by for Acuity scheduling, prep, and visit questions.', at: 'Today' },
  ]);
}

export function sendSupportMessage(text, from = 'client') {
  const message = { id: `msg-${Date.now()}`, from, text, at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
  const next = [...readSupportThread(), message].slice(-20);
  writeLocal('supportThread', next);
  appendActivity(`Support message sent: ${text.slice(0, 48)}`, { role: from });
  return next;
}

export function readClientAftercareRecords() {
  return readLocal('clientAftercareRecords', []);
}

function latestCloseoutForClient(profile = {}, booking = null) {
  const closeouts = readLocal('acuityCloseoutPackets', []);
  const bookingId = booking?.id || booking?.reference || booking?.appointmentId;
  const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').toLowerCase();
  return closeouts.find((packet) => (
    (bookingId && packet.appointmentId === bookingId)
    || (profileName && String(packet.clientName || '').toLowerCase() === profileName)
  )) || closeouts[0] || null;
}

export function buildClientAftercarePlan({
  profile = readClientProfile(),
  latestBooking = readLastBooking(),
} = {}) {
  const closeout = latestCloseoutForClient(profile, latestBooking);
  const records = readClientAftercareRecords();
  const visitId = closeout?.appointmentId || latestBooking?.id || latestBooking?.reference || 'latest';
  const record = records.find((item) => item.visitId === visitId);
  const completed = Boolean(closeout?.status === 'Complete' || /completed|follow/i.test(String(latestBooking?.status || '')));
  const acuityEntered = Boolean(closeout?.acuityEntered || /entered in acuity/i.test(closeout?.acuityStatus || ''));
  const eventFlagged = Boolean(closeout?.eventFlagged);
  const safeService = closeout?.serviceName || latestBooking?.service || latestBooking?.plan || 'Avalon visit';
  const receipt = profile.wallet?.invoices?.[0] || profile.wallet?.deposits?.[0] || null;
  const aftercareQueued = Boolean(record);
  const careStatus = eventFlagged ? 'Care follow-up' : completed ? (aftercareQueued ? 'Sent' : 'Ready') : 'Armed';

  const steps = [
    {
      key: 'closeout',
      label: 'Closeout',
      status: completed ? 'Ready' : 'After visit',
      detail: completed ? 'Visit closeout exists locally.' : 'Aftercare unlocks after visit close.',
      done: completed,
    },
    {
      key: 'acuity',
      label: 'Acuity',
      status: acuityEntered ? 'Entered' : completed ? 'Confirm' : 'Pending',
      detail: 'Acuity remains the clinical record.',
      done: acuityEntered,
    },
    {
      key: 'receipt',
      label: 'Receipt',
      status: receipt ? receipt.status || 'Ready' : 'Pending',
      detail: receipt ? `${receipt.label || 'Receipt'} ${receipt.amount || ''}`.trim() : 'Receipt appears after payment record.',
      done: Boolean(receipt),
    },
    {
      key: 'message',
      label: 'Aftercare',
      status: aftercareQueued ? 'Sent' : completed ? 'Ready' : 'Armed',
      detail: aftercareQueued ? 'Care message queued in portal.' : 'Simple aftercare and support prompt.',
      done: aftercareQueued,
    },
    {
      key: 'rebook',
      label: 'Rebook',
      status: aftercareQueued ? 'Queued' : completed ? 'Offer' : 'Later',
      detail: 'Offer a simple rebook or subscription path.',
      done: aftercareQueued,
    },
  ];

  return {
    visitId,
    service: safeService,
    closeout,
    record,
    records,
    completed,
    acuityEntered,
    eventFlagged,
    careStatus,
    receipt,
    steps,
    headline: eventFlagged ? 'Care team will follow up.' : completed ? 'Recovery check-in ready.' : 'Aftercare armed.',
    body: eventFlagged
      ? 'A care-team follow-up is routed. Emergency symptoms should be handled through emergency services.'
      : completed
        ? 'Hydrate, take it easy, and message the care team with visit questions. For urgent symptoms, call emergency services.'
        : 'Aftercare unlocks after your RN closes the visit.',
  };
}

export function queueClientAftercare({
  profile = readClientProfile(),
  latestBooking = readLastBooking(),
  source = 'Client Portal',
} = {}) {
  const plan = buildClientAftercarePlan({ profile, latestBooking });
  const now = new Date().toISOString();
  const record = {
    id: `aftercare-${plan.visitId}`,
    visitId: plan.visitId,
    client: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Client',
    service: plan.service,
    source,
    status: plan.eventFlagged ? 'Care follow-up' : 'Sent',
    acuityStatus: plan.acuityEntered ? 'Entered in Acuity' : 'Acuity confirmation pending',
    rebookPath: '/book',
    phiExcludedFromCrm: true,
    createdAt: now,
    updatedAt: now,
  };
  const records = [record, ...readClientAftercareRecords().filter((item) => item.id !== record.id)].slice(0, 80);
  writeLocal('clientAftercareRecords', records);

  const messageText = plan.eventFlagged
    ? 'Avalon: our care team will follow up on your visit. If you have urgent symptoms, call emergency services.'
    : `Avalon: your ${plan.service} visit is complete. Hydrate, rest, and message us with visit questions. Ready to rebook when you are.`;

  const support = readSupportThread();
  const alreadyInSupport = support.some((message) => message.id === record.id);
  if (!alreadyInSupport) {
    writeLocal('supportThread', [...support, {
      id: record.id,
      from: 'care',
      text: messageText,
      at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }].slice(-24));
  }

  sendOpsMessage({
    threadId: 'client-texts',
    audience: record.client,
    from: 'Aftercare',
    role: 'client-text',
    status: 'Queued',
    channels: ['chat', 'sms'],
    relatedBroadcastId: record.id,
    text: messageText,
  });

  queueAttioOutreach({
    id: record.id,
    personId: profile.id,
    client: record.client,
    type: plan.eventFlagged ? 'Issue resolution' : 'Post-visit check-in',
    priority: plan.eventFlagged ? 'High' : 'Medium',
    dueDate: now,
    note: plan.eventFlagged ? 'Clinical-safe care follow-up. Keep adverse-event detail in Acuity.' : 'Aftercare sent. Invite rebook or subscription if appropriate.',
    nextAction: plan.eventFlagged ? 'Coordinate clinical-safe service recovery.' : 'Check in and invite rebook/review.',
  }, { source });

  appendActivity(`Aftercare queued: ${record.client}`, { role: 'care', visitId: record.visitId, phiExcluded: true });
  return buildClientAftercarePlan({ profile, latestBooking });
}

export function buildCreditLedger(member = {}, lastBooking = null) {
  const total = Number(member.creditsTotal || 2);
  const used = lastBooking ? 1 : 0;
  return [
    { label: 'Monthly credits issued', value: `+${total}`, tone: 'green' },
    ...(lastBooking ? [{ label: lastBooking.service || 'IV visit requested', value: '-1', tone: 'gold' }] : []),
    { label: 'Credits available', value: String(Math.max(0, total - used)), tone: 'default' },
    { label: 'Rollover eligible', value: 'Yes', tone: 'default' },
  ];
}

const DEFAULT_CLIENT_PROFILE = {
  id: 'client-local',
  firstName: 'Client',
  lastName: 'Preview',
  phone: '',
  email: 'client.preview@avalon.local',
  dob: null,
  defaultAddress: '',
  emergencyContact: '',
  allergies: [],
  medications: [],
  medicalConditions: [],
  contraindications: [],
  smsPreference: 'Text first',
  gfe: {
    status: 'Missing',
    validUntil: null,
    source: 'Not connected',
  },
  subscription: null,
  wallet: {
    deposits: [],
    invoices: [],
    eventTickets: [],
  },
  documents: [
    { label: 'Intake', status: 'Needed' },
    { label: 'Consent', status: 'Needed' },
    { label: 'HIPAA', status: 'Needed' },
    { label: 'GFE', status: 'Missing' },
  ],
};

export function readClientProfile() {
  const saved = readLocal('clientProfile', {});
  return {
    ...DEFAULT_CLIENT_PROFILE,
    ...saved,
    gfe: { ...DEFAULT_CLIENT_PROFILE.gfe, ...(saved.gfe || {}) },
    subscription: saved.subscription ?? DEFAULT_CLIENT_PROFILE.subscription,
    wallet: { ...DEFAULT_CLIENT_PROFILE.wallet, ...(saved.wallet || {}) },
    documents: saved.documents || DEFAULT_CLIENT_PROFILE.documents,
  };
}

export function saveClientProfile(patch = {}) {
  const current = readClientProfile();
  const next = {
    ...current,
    ...patch,
    gfe: { ...current.gfe, ...(patch.gfe || {}) },
    subscription: patch.subscription === undefined ? current.subscription : patch.subscription,
    wallet: { ...current.wallet, ...(patch.wallet || {}) },
    updatedAt: new Date().toISOString(),
  };
  writeLocal('clientProfile', next);
  appendActivity('Client profile updated', { role: 'client' });
  return next;
}

export function buildClientCommandCenter(profile = readClientProfile(), lastBooking = readLastBooking()) {
  const requirement = resolveGfeRequirement({
    ...(lastBooking || {}),
    isNewClient: false,
    gfe: profile.gfe,
    gfeExpiresAt: profile.gfe?.validUntil,
  });
  const subscription = profile.subscription || {};
  const timeline = buildLiveVisitTimeline(lastBooking);
  const nurseAssigned = lastBooking?.nurse && lastBooking.nurse !== 'Unassigned';
  return {
    profile,
    cards: [
      {
        id: 'gfe',
        label: 'GFE',
        value: requirement.required ? 'Needed' : 'Valid',
        detail: requirement.required ? requirement.reason : `Valid through ${new Date(profile.gfe.validUntil).toLocaleDateString('en-US')}`,
        status: requirement.required ? 'Action' : 'Clear',
      },
      {
        id: 'eta',
        label: 'Nurse',
        value: nurseAssigned ? lastBooking.nurse : 'Pending',
        detail: nurseAssigned ? 'RN profile and ETA before arrival.' : 'Assignment broadcasts until accepted.',
        status: nurseAssigned ? 'Assigned' : 'Pending',
      },
      {
        id: 'subscription',
        label: 'Plan',
        value: subscription.status || 'None',
        detail: subscription.status
          ? `${subscription.creditsAvailable || 0}/${subscription.creditsTotal || 0} credits · ${subscription.renewal || 'No renewal'}`
          : 'No active subscription.',
        status: subscription.status || 'None',
      },
      {
        id: 'sms',
        label: 'SMS',
        value: profile.smsPreference,
        detail: 'Visit alerts, GFE, ETA, and follow-up.',
        status: 'On',
      },
    ],
    timeline,
    intake: [
      { label: 'Profile', done: Boolean(profile.phone && profile.email && profile.dob) },
      { label: 'Allergies', done: Boolean(profile.allergies?.length) },
      { label: 'Meds', done: Boolean(profile.medications?.length) },
      { label: 'Emergency', done: Boolean(profile.emergencyContact) },
      { label: 'Consent', done: profile.documents.some((doc) => doc.label === 'Consent' && /signed|complete/i.test(doc.status)) },
    ],
    wallet: profile.wallet,
  };
}

export function buildLocalLaunchReadiness({
  profile = readClientProfile(),
  latestBooking = readLastBooking(),
  broadcasts = readAssignmentBroadcasts(),
  gfeQueue = readGfeRoutingQueue(),
  payrollQueue = readPayrollProofQueue(),
  shiftReplies = readShiftReplies(),
} = {}) {
  const gfeRequirement = resolveGfeRequirement({
    ...(latestBooking || {}),
    isNewClient: latestBooking?.isNewClient,
    gfe: latestBooking?.gfeRecord || latestBooking?.gfe || profile.gfe,
    gfeExpiresAt: latestBooking?.gfeExpiresAt || profile.gfe?.validUntil,
    visitCount: latestBooking?.visitCount,
  });
  const activeBroadcasts = broadcasts.filter((item) => item.status !== 'Assigned');
  const nurseAssigned = Boolean(latestBooking?.nurse && latestBooking.nurse !== 'Unassigned');
  const intakeDone = latestBooking?.intake === 'Done' || profile.documents.some((doc) => doc.label === 'Intake' && /complete|signed/i.test(doc.status));
  const consentDone = latestBooking?.consent === 'Done' || profile.documents.some((doc) => doc.label === 'Consent' && /complete|signed/i.test(doc.status));
  const depositDone = /paid/i.test(String(latestBooking?.payment || profile.wallet?.deposits?.[0]?.status || ''));
  const acuityHeld = Boolean(latestBooking?.date || latestBooking?.time || latestBooking?.datetime);
  const hasContact = Boolean(profile.phone && profile.email);

  const client = [
    { key: 'contact', label: 'Contact file', status: hasContact ? 'Ready' : 'Missing', detail: hasContact ? 'Phone and email saved.' : 'Add phone and email.' },
    { key: 'intake', label: 'Intake', status: intakeDone ? 'Ready' : 'Needed', detail: intakeDone ? 'Medical intake available.' : 'Collect intake before clearance.' },
    { key: 'consent', label: 'Consent', status: consentDone ? 'Ready' : 'Needed', detail: consentDone ? 'Consent signed.' : 'Consent must be signed before treatment.' },
    { key: 'gfe', label: 'GFE', status: gfeRequirement.required ? 'Action' : 'Ready', detail: gfeRequirement.reason },
    { key: 'payment', label: 'Deposit', status: depositDone ? 'Ready' : 'Action', detail: depositDone ? '$50 deposit/payment is recorded.' : 'Payment link or deposit still pending.' },
  ];

  const nurse = [
    { key: 'broadcast', label: 'Shift broadcast', status: activeBroadcasts.length ? 'Live' : nurseAssigned ? 'Ready' : 'Needed', detail: activeBroadcasts.length ? `${activeBroadcasts.length} open broadcast(s).` : nurseAssigned ? `${latestBooking.nurse} assigned.` : 'Create a nurse broadcast.' },
    { key: 'reply', label: 'Y/N replies', status: shiftReplies.length ? 'Ready' : 'Armed', detail: shiftReplies.length ? `${shiftReplies.length} reply event(s) logged.` : 'Local Y/N acceptance is enabled.' },
    { key: 'route', label: 'Route', status: nurseAssigned ? 'Ready' : 'After accept', detail: nurseAssigned ? 'Apple/Google maps links available.' : 'Route unlocks after nurse accepts.' },
    { key: 'chart', label: 'Acuity closeout', status: 'Ready', detail: 'Acuity stays the EMR; Avalon blocks incomplete local closeout.' },
    { key: 'payroll', label: 'Payroll proof', status: payrollQueue.length ? 'Queued' : 'Armed', detail: payrollQueue.length ? `${payrollQueue.length} ${GUSTO_PAYROLL_PLACEHOLDER.service} proof item(s).` : 'Queued after Acuity closeout.' },
  ];

  const admin = [
    { key: 'acuity', label: 'Acuity handoff', status: acuityHeld ? 'Ready' : 'Needed', detail: acuityHeld ? 'Appointment slot represented locally.' : 'No local appointment time.' },
    { key: 'attio', label: 'Attio follow-up', status: 'Queued', detail: 'CRM task is represented as local activity/message.' },
    { key: 'gfe-router', label: 'GFE router', status: gfeQueue.length ? 'Ready' : gfeRequirement.required ? 'Needed' : 'Clear', detail: gfeQueue.length ? `${gfeQueue.length} route item(s). Avalon NP first.` : gfeRequirement.required ? `${QUALIPHY_GFE_PLACEHOLDER.service} only if no NP is on call.` : 'No GFE action needed.' },
    { key: 'alerts', label: 'Alerts', status: activeBroadcasts.length || gfeQueue.length ? 'Live' : 'Armed', detail: 'In-app/SMS/email placeholders share local state.' },
    { key: 'books', label: 'Books', status: 'Placeholder', detail: `${QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service} receives finance summaries only.` },
    { key: 'credentials', label: 'Credentials', status: 'Placeholder', detail: `${NURSEYS_CREDENTIAL_PLACEHOLDER.service} blocks non-clear nurses.` },
    { key: 'audit', label: 'Audit trail', status: 'Live', detail: 'Local activity and booking audit entries are captured.' },
  ];

  const all = [...client, ...nurse, ...admin];
  return {
    client,
    nurse,
    admin,
    placeholders: PLACEHOLDER_INTEGRATIONS.map((item) => ({
      key: item.service,
      label: item.service,
      status: item.badgeStatus,
      mode: item.mode,
      detail: item.description,
    })),
    summary: {
      ready: all.filter((item) => ['Ready', 'Live', 'Clear', 'Queued', 'Armed'].includes(item.status)).length,
      action: all.filter((item) => ['Action', 'Needed'].includes(item.status)).length,
      total: all.length,
    },
  };
}

export function buildDispatchBoard(requests = [], inventory = [], lastBooking = null) {
  const unassigned = requests.filter((r) => !r.nurse || r.nurse === 'Unassigned');
  const blocked = requests.filter((r) => ['GFE Pending', 'Intake Pending', 'Consent Pending'].includes(r.status));
  const lowStock = inventory.filter((item) => /low|restock|expiry/i.test(item.status || ''));
  return [
    ...(lastBooking ? [{
      id: 'latest-booking',
      label: 'Latest booking handoff',
      detail: [lastBooking.service, lastBooking.date, lastBooking.time].filter(Boolean).join(' · '),
      status: lastBooking.status || 'New',
      priority: 'High',
    }] : []),
    { id: 'blocked', label: 'Clinical queue', detail: `${blocked.length} visits need review`, status: blocked.length ? 'Action' : 'Clear', priority: blocked.length ? 'High' : 'Low' },
    { id: 'assignment', label: 'Nurse assignment', detail: `${unassigned.length} visits unassigned`, status: unassigned.length ? 'Action' : 'Clear', priority: unassigned.length ? 'High' : 'Low' },
    { id: 'inventory', label: 'Inventory risk', detail: `${lowStock.length} supply alerts`, status: lowStock.length ? 'Watch' : 'Clear', priority: lowStock.length ? 'Med' : 'Low' },
  ];
}

export function buildOperatingSpine(requests = [], latestBooking = readLastBooking()) {
  const latest = latestBooking ? [{
    id: latestBooking.id || latestBooking.reference || 'latest-booking',
    client: latestBooking.contact?.name || 'Latest client',
    service: latestBooking.service || latestBooking.plan || 'Avalon visit',
    status: latestBooking.status || 'New Request',
    gfe: latestBooking.gfe || (latestBooking.gfeRequired ? 'Pending' : 'Valid'),
    nurse: latestBooking.nurse || 'Unassigned',
    payment: latestBooking.payment || '$50 deposit pending',
    source: latestBooking.source || 'Website',
    time: [latestBooking.date, latestBooking.time].filter(Boolean).join(' · '),
  }] : [];
  const items = [...latest, ...requests].slice(0, 12);
  const stages = [
    {
      key: 'order',
      label: 'Order',
      owner: 'Client',
      count: items.length,
      action: 'Confirm source and cart.',
    },
    {
      key: 'deposit',
      label: 'Deposit',
      owner: 'Stripe / Acuity',
      count: items.filter((item) => /pending|invoice|link/i.test(item.payment || '')).length,
      action: '$50 deposit or payment link.',
    },
    {
      key: 'acuity',
      label: 'Acuity',
      owner: 'EMR + Scheduling',
      count: items.filter((item) => /pending|new|contacted/i.test(item.status || '')).length,
      action: 'Book or verify in Acuity.',
    },
    {
      key: 'gfe',
      label: 'GFE',
      owner: 'Avalon NP first',
      count: items.filter((item) => /pending|not started|required/i.test(item.gfe || item.status || '')).length,
      action: 'Route to Avalon NP; Qualiphy only if no NP is on call.',
    },
    {
      key: 'shift',
      label: 'Shift',
      owner: 'Nurses',
      count: items.filter((item) => !item.nurse || item.nurse === 'Unassigned').length,
      action: 'Broadcast to Nurseys-clear nurses.',
    },
    {
      key: 'visit',
      label: 'Visit',
      owner: 'Field RN',
      count: items.filter((item) => /ready|assigned|en route|arrived|progress/i.test(item.status || '')).length,
      action: 'Route, text client, execute, close Acuity.',
    },
    {
      key: 'payroll',
      label: 'Payroll',
      owner: `${MERCURY_BANKING_PLACEHOLDER.service} + ${GUSTO_PAYROLL_PLACEHOLDER.service}`,
      count: readPayrollProofQueue().filter((item) => item.status !== 'Exported').length,
      action: 'Proof queue excludes PHI.',
    },
    {
      key: 'followup',
      label: 'Follow-up',
      owner: 'Attio',
      count: items.filter((item) => /completed|follow/i.test(item.status || '')).length,
      action: 'CRM outreach and rebook.',
    },
  ];
  return { stages, items };
}

export const ACUITY_CONTROL_STAGES = [
  { key: 'schedule', label: 'Slot', owner: 'Acuity' },
  { key: 'acuity', label: 'Acuity', owner: 'Acuity' },
  { key: 'deposit', label: 'Deposit', owner: 'Payment' },
  { key: 'intake', label: 'Intake', owner: 'Client' },
  { key: 'consent', label: 'Consent', owner: 'Client' },
  { key: 'gfe', label: 'GFE', owner: 'Clinical' },
  { key: 'nurse', label: 'RN', owner: 'Dispatch' },
  { key: 'closeout', label: 'Closeout', owner: 'Acuity' },
];

function formatSlotDateTime(datetime = '') {
  const parsed = datetime ? new Date(datetime) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  return {
    date: parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function normalizeAcuityControlBooking(input = {}, source = 'Avalon queue') {
  const contact = input.contact || {};
  const datetime = input.datetime || input.acuityDatetime || input.acuitySlot?.datetime || input.slot?.datetime || '';
  const derivedSlot = formatSlotDateTime(datetime);
  const client = cleanText(input.client || contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || input.clientName) || 'Client pending';
  const id = cleanText(input.id || input.reference || input.bookingId || input.appointmentId || input.acuityAppointmentId || input.schedulingId) || `local-${client.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const address = cleanText(input.address || input.location || input.location_address || input.venue || input.city);
  const date = cleanText(input.date || input.acuitySlot?.date || input.slot?.date || derivedSlot.date);
  const time = cleanText(input.time || input.timeLabel || input.acuitySlot?.timeLabel || input.slot?.timeLabel || derivedSlot.time);
  const service = cleanText(input.service || input.plan || input.therapy || input.serviceName || input.type) || 'Avalon visit';

  return {
    ...input,
    raw: input,
    id,
    bookingId: id,
    source: input.source || source,
    client,
    phone: input.phone || contact.phone || input.clientPhone || '',
    email: input.email || contact.email || '',
    service,
    address,
    city: inferBookingCity({ ...input, address }),
    date,
    time,
    datetime,
    status: input.status || 'Scheduling received',
    payment: input.payment || input.depositStatus || input.deposit || '',
    intake: input.intake || input.intakeStatus || '',
    consent: input.consent || input.consentStatus || '',
    gfe: input.gfeRecord || input.gfe || input.gfeStatus || '',
    nurse: input.nurse || input.assignedNurse || input.provider || '',
    acuityAppointmentId: input.acuityAppointmentId || input.acuityId || input.schedulingId || input.appointmentId || input.confirmationId || '',
    shiftValue: estimateShiftValue(input),
  };
}

function findOperationalMatch(collection = [], booking = {}, keys = []) {
  const ids = [booking.id, booking.reference, booking.bookingId, booking.acuityAppointmentId, booking.client]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return collection.find((item = {}) => {
    const haystack = keys.map((key) => item[key]).filter(Boolean).map((value) => String(value).toLowerCase());
    return haystack.some((value) => ids.some((id) => value.includes(id) || id.includes(value)));
  });
}

function buildReadinessItem(key, label, done, detail = '') {
  return {
    key,
    label,
    done: Boolean(done),
    detail,
    status: done ? 'Ready' : 'Action',
  };
}

export function readAcuityManualHandoffs() {
  return readLocal('acuityManualHandoffs', []);
}

export function queueAcuityManualHandoff(booking = {}, options = {}) {
  const item = normalizeAcuityControlBooking(booking, options.source || 'Acuity Control');
  const current = readAcuityManualHandoffs();
  const existing = current.find((entry) => entry.bookingId === item.bookingId);
  const now = new Date().toISOString();
  const nextEntry = {
    id: existing?.id || `acuity-handoff-${item.bookingId}`,
    bookingId: item.bookingId,
    client: item.client,
    service: item.service,
    slot: [item.date, item.time].filter(Boolean).join(' · ') || 'Slot pending',
    city: item.city,
    destination: ACUITY_OPERATING_CONTRACT.service,
    action: options.action || 'Represent appointment in Acuity.',
    reason: options.reason || 'Keep Acuity as scheduling and EMR source of record.',
    status: existing?.status === 'Represented' ? 'Represented' : 'Queued',
    phiExcluded: true,
    source: options.source || 'Acuity Control',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    representedBy: existing?.representedBy || '',
    representedAt: existing?.representedAt || '',
  };
  const next = [nextEntry, ...current.filter((entry) => entry.bookingId !== item.bookingId)].slice(0, 80);
  writeLocal('acuityManualHandoffs', next);

  upsertCommunicationAlert({
    id: `alert-${nextEntry.id}`,
    kind: 'acuity',
    title: `Acuity handoff: ${item.client}`,
    body: `${item.service} · ${nextEntry.slot}. Add/update the Acuity appointment. Keep clinical notes in Acuity.`,
    priority: nextEntry.status === 'Represented' ? 'info' : 'action',
    status: nextEntry.status === 'Represented' ? 'resolved' : 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Acuity Control',
    linkedEntityType: 'booking',
    linkedEntityId: item.bookingId,
    actionLabel: 'Represent in Acuity',
  });

  const messageId = `acuity-handoff-${item.bookingId}`;
  if (!readOpsMessages().some((message) => message.relatedBroadcastId === messageId)) {
    sendOpsMessage({
      threadId: 'dispatch',
      audience: 'Dispatch',
      from: 'Acuity Control',
      role: 'system',
      status: 'Queued',
      channels: ['chat'],
      relatedBroadcastId: messageId,
      text: `Acuity handoff queued: ${item.client} · ${item.service} · ${nextEntry.slot}.`,
    });
  }

  appendActivity(`Acuity handoff queued for ${item.client}`, { role: 'ops', bookingId: item.bookingId });
  return nextEntry;
}

export function resolveAcuityManualHandoff(bookingOrHandoffId, actor = 'Avalon OS') {
  const id = String(bookingOrHandoffId || '');
  const now = new Date().toISOString();
  let resolved = null;
  const next = readAcuityManualHandoffs().map((entry) => {
    const matches = entry.id === id || entry.bookingId === id;
    if (!matches) return entry;
    resolved = {
      ...entry,
      status: 'Represented',
      representedBy: actor,
      representedAt: now,
      updatedAt: now,
    };
    return resolved;
  });
  writeLocal('acuityManualHandoffs', next);
  if (resolved) {
    resolveCommunicationAlert(`alert-${resolved.id}`, actor);
    sendOpsMessage({
      threadId: 'dispatch',
      audience: 'Dispatch',
      from: actor,
      role: 'system',
      status: 'Represented',
      channels: ['chat'],
      relatedBroadcastId: `acuity-represented-${resolved.bookingId}`,
      text: `Acuity represented: ${resolved.client} · ${resolved.service}.`,
    });
    appendActivity(`Acuity represented for ${resolved.client}`, { role: actor, bookingId: resolved.bookingId });
  }
  return next;
}

export function buildAcuityControlTower(requests = [], latestBooking = readLastBooking()) {
  const seeded = [
    ...(latestBooking ? [normalizeAcuityControlBooking(latestBooking, 'Latest booking')] : []),
    ...requests.map((request) => normalizeAcuityControlBooking(request, 'Request queue')),
  ];
  const seen = new Set();
  const bookings = seeded.filter((item) => {
    if (seen.has(item.bookingId)) return false;
    seen.add(item.bookingId);
    return true;
  }).slice(0, 24);
  const handoffs = readAcuityManualHandoffs();
  const broadcasts = readAssignmentBroadcasts();
  const gfeQueue = readGfeRoutingQueue();
  const closeouts = readLocal('acuityCloseoutPackets', []);
  const payroll = readPayrollProofQueue();

  const items = bookings.map((booking) => {
    const handoff = findOperationalMatch(handoffs, booking, ['bookingId', 'id', 'client']);
    const broadcast = findOperationalMatch(broadcasts, booking, ['bookingId', 'id', 'client']);
    const gfeRoute = findOperationalMatch(gfeQueue, booking, ['bookingId', 'id', 'client']);
    const closeout = findOperationalMatch(closeouts, booking, ['appointmentId', 'id', 'clientName']);
    const payrollProof = findOperationalMatch(payroll, booking, ['visitId', 'id', 'nurseName']);
    const gfeRequirement = resolveGfeRequirement({
      ...booking.raw,
      service: booking.service,
      addOns: booking.addOns,
      guests: booking.guests,
      gfe: booking.gfe,
      gfeExpiresAt: booking.gfeExpiresAt,
      isNewClient: booking.isNewClient,
      visitCount: booking.visitCount,
    });
    const slotHeld = Boolean(booking.datetime || (booking.date && booking.time));
    const represented = Boolean(booking.acuityAppointmentId || handoff?.status === 'Represented');
    const depositDone = /paid|complete|deposit/i.test(String(booking.payment || ''));
    const intakeDone = /received|done|complete|signed/i.test(String(booking.intake || ''));
    const consentDone = /signed|done|complete|received/i.test(String(booking.consent || ''));
    const gfeDone = /clear|valid|approved|complete/i.test(String(booking.gfe || '')) || !gfeRequirement.required;
    const nurseDone = Boolean((booking.nurse && booking.nurse !== 'Unassigned') || broadcast?.status === 'Assigned');
    const closeoutDone = Boolean(closeout?.status === 'Complete' || /entered in acuity/i.test(closeout?.acuityStatus || ''));
    const followupReady = /completed|follow/i.test(String(booking.status || '')) || closeoutDone;
    const readiness = [
      buildReadinessItem('schedule', 'Slot', slotHeld, slotHeld ? [booking.date, booking.time].filter(Boolean).join(' · ') : 'No appointment slot'),
      buildReadinessItem('acuity', 'Acuity', represented, represented ? 'Represented in Acuity' : 'Manual handoff needed'),
      buildReadinessItem('deposit', 'Deposit', depositDone, booking.payment || 'Deposit/payment pending'),
      buildReadinessItem('intake', 'Intake', intakeDone, booking.intake || 'Intake pending'),
      buildReadinessItem('consent', 'Consent', consentDone, booking.consent || 'Consent pending'),
      buildReadinessItem('gfe', 'GFE', gfeDone, gfeDone ? 'Clearance ready' : gfeRequirement.reason),
      buildReadinessItem('nurse', 'RN', nurseDone, nurseDone ? booking.nurse || broadcast?.assignedTo : 'Broadcast to Nurseys-clear nurses'),
      buildReadinessItem('closeout', 'Closeout', closeoutDone || !/completed|in progress|arrived/i.test(String(booking.status || '')), closeoutDone ? 'Entered in Acuity' : 'Acuity closeout required'),
    ];
    const blockers = readiness
      .filter((entry) => !entry.done)
      .map((entry) => entry.label);
    const critical = blockers.includes('Slot') || blockers.includes('GFE') || /blocked/i.test(String(booking.status || ''));
    const risk = critical ? 'critical' : blockers.length ? 'action' : 'ready';
    const nextAction = blockers[0]
      ? {
        Slot: 'Book or hold slot.',
        Acuity: 'Represent in Acuity.',
        Deposit: 'Collect deposit.',
        Intake: 'Send intake.',
        Consent: 'Send consent.',
        GFE: gfeRoute?.destination?.fallback ? 'Qualiphy fallback active.' : 'Route to Avalon NP.',
        RN: 'Broadcast shift.',
        Closeout: 'Finish Acuity closeout.',
      }[blockers[0]]
      : followupReady ? 'Follow up.' : 'Ready.';

    return {
      ...booking,
      acuityStatus: represented ? 'Represented' : slotHeld ? 'Manual handoff' : 'Needs slot',
      slotHeld,
      acuityLinked: represented,
      depositDone,
      intakeDone,
      consentDone,
      gfeDone,
      gfeAction: !gfeDone,
      nurseDone,
      closeoutDone,
      followupReady,
      readiness,
      blockers,
      nextAction,
      risk,
      handoff,
      broadcast,
      gfeRoute,
      closeout,
      payrollProof,
    };
  });

  const stageSummaries = ACUITY_CONTROL_STAGES.map((stage) => {
    const complete = items.filter((item) => item.readiness.find((entry) => entry.key === stage.key)?.done).length;
    return {
      ...stage,
      complete,
      total: items.length,
      action: items.length - complete,
      pct: items.length ? Math.round((complete / items.length) * 100) : 0,
    };
  });

  const metrics = {
    total: items.length,
    ready: items.filter((item) => item.risk === 'ready').length,
    acuityAction: items.filter((item) => !item.acuityLinked).length,
    gfeAction: items.filter((item) => item.gfeAction).length,
    nurseAction: items.filter((item) => !item.nurseDone).length,
    closeoutAction: items.filter((item) => !item.closeoutDone).length,
  };

  return {
    items,
    metrics,
    stageSummaries,
    health: buildAcuitySyncHealth(items),
    handoffs,
    contracts: [ACUITY_OPERATING_CONTRACT, AVALON_SMOOTH_LAYER],
  };
}

export function buildAcuitySyncHealth(items = []) {
  const handoffs = readAcuityManualHandoffs();
  const closeouts = readLocal('acuityCloseoutPackets', []);
  const represented = handoffs.filter((entry) => entry.status === 'Represented').length;
  return [
    {
      label: 'Scheduling',
      value: ACUITY_OPERATING_CONTRACT.service,
      status: 'Source',
      detail: 'Acuity owns appointment time and schedule.',
    },
    {
      label: 'EMR',
      value: 'Acuity',
      status: 'Source',
      detail: 'Clinical record stays in Acuity.',
    },
    {
      label: 'Avalon mirror',
      value: `${items.length} visits`,
      status: 'Local',
      detail: 'Operational state only.',
    },
    {
      label: 'Manual ledger',
      value: `${represented}/${handoffs.length || 0}`,
      status: handoffs.length && represented !== handoffs.length ? 'Action' : 'Ready',
      detail: 'Queued vs represented in Acuity.',
    },
    {
      label: 'Closeout',
      value: `${closeouts.length}`,
      status: 'Acuity',
      detail: 'RN closeout packets require Acuity entry.',
    },
    {
      label: 'PHI boundary',
      value: 'Clean',
      status: 'Guarded',
      detail: 'No clinical notes to CRM, payroll, banking, or books.',
    },
  ];
}

function closeoutRisk(row = {}) {
  if (!row.acuityDone || (row.eventFlagged && !row.incidentDone)) return 'critical';
  if (!row.kitDone || !row.payrollDone) return 'action';
  return 'ready';
}

export function buildVisitCloseoutDock() {
  const closeouts = readLocal('acuityCloseoutPackets', []);
  const deductions = readKitDeductionLedger();
  const payroll = readPayrollProofQueue();
  const incidents = readLocal('clinicalIncidents', []);

  const rows = closeouts.map((packet) => {
    const visitId = packet.appointmentId || packet.visitId || packet.id;
    const kitProof = deductions.find((entry) => entry.visitId === visitId || entry.id === `deduct-${visitId}`);
    const payrollProof = payroll.find((entry) => entry.visitId === visitId || entry.id === visitId);
    const incidentProof = incidents.find((entry) => entry.visitId === visitId || entry.id === `incident-${visitId}`);
    const acuityDone = packet.status === 'Complete' && (/entered in acuity/i.test(packet.acuityStatus || '') || packet.acuityEntered);
    const kitDone = Boolean(kitProof);
    const payrollDone = Boolean(payrollProof);
    const eventFlagged = Boolean(packet.eventFlagged);
    const incidentDone = !eventFlagged || Boolean(incidentProof);
    const row = {
      id: visitId,
      packet,
      client: packet.clientName || 'Client',
      service: packet.serviceName || 'Avalon visit',
      nurseName: packet.nurseName || 'Nurse',
      completedAt: packet.completedAt || packet.createdAt || '',
      acuityDone,
      kitDone,
      payrollDone,
      eventFlagged,
      incidentDone,
      kitProof,
      payrollProof,
      incidentProof,
      proof: [
        buildReadinessItem('acuity', 'Acuity', acuityDone, acuityDone ? 'Entered in Acuity' : packet.acuityStatus || 'Acuity entry needed'),
        buildReadinessItem('kit', 'Kit', kitDone, kitDone ? `${kitProof.lines?.length || 0} supply lines deducted` : 'Kit deduction not queued'),
        buildReadinessItem('payroll', 'Gusto', payrollDone, payrollDone ? `$${payrollProof.shiftValue || 0} proof ready` : 'Payroll proof not queued'),
        buildReadinessItem('incident', 'Incident', incidentDone, eventFlagged ? (incidentDone ? 'Event follow-up represented' : 'Event follow-up needed') : 'No event flagged'),
      ],
    };
    row.risk = closeoutRisk(row);
    row.nextAction = !acuityDone
      ? 'Confirm Acuity entry.'
      : !kitDone
        ? 'Queue kit deduction.'
        : !payrollDone
          ? 'Queue Gusto proof.'
          : !incidentDone
            ? 'Open incident follow-up.'
            : 'Clean.';
    return row;
  });

  return {
    rows,
    metrics: {
      total: rows.length,
      ready: rows.filter((row) => row.risk === 'ready').length,
      acuityAction: rows.filter((row) => !row.acuityDone).length,
      kitAction: rows.filter((row) => !row.kitDone).length,
      payrollAction: rows.filter((row) => !row.payrollDone).length,
      incidentAction: rows.filter((row) => row.eventFlagged && !row.incidentDone).length,
    },
    guardrails: [
      { label: 'Acuity remains EMR', detail: 'Closeout dock tracks proof only. Clinical record stays in Acuity.' },
      { label: 'No PHI to finance', detail: 'Gusto, Mercury, and QuickBooks queues receive operational proof only.' },
      { label: 'Kit after closeout', detail: 'Supply deductions queue only after field closeout proof exists.' },
    ],
  };
}

export function runVisitCloseoutSweep({ inventory = [] } = {}) {
  const dock = buildVisitCloseoutDock();
  const actions = [];
  dock.rows.forEach((row) => {
    if (!row.kitDone) {
      const deduction = queueKitDeduction({
        id: row.id,
        client: row.client,
        service: row.service,
        nurseName: row.nurseName,
      }, inventory);
      actions.push({ type: 'kit', id: deduction.id });
    }

    if (!row.payrollDone && row.acuityDone) {
      const payroll = queueGustoPayrollProof({
        visitId: row.id,
        nurseName: row.nurseName,
        service: row.service,
        shiftValue: row.packet.shiftValue,
        completedAt: row.completedAt,
        chartStatus: row.packet.acuityStatus || 'Entered in Acuity',
      });
      actions.push({ type: 'gusto', id: payroll[0]?.id || row.id });
    }

    if (row.eventFlagged && !row.incidentDone) {
      const current = readLocal('clinicalIncidents', []);
      const incident = {
        id: `incident-${row.id}-${Date.now()}`,
        visitId: row.id,
        clientName: row.client,
        service: row.service,
        summary: row.packet.adverseEvent || 'Event follow-up needed',
        sourceOfRecord: 'Acuity',
        status: 'Needs review',
        createdAt: new Date().toISOString(),
      };
      writeLocal('clinicalIncidents', [incident, ...current].slice(0, 80));
      upsertCommunicationAlert({
        id: `alert-closeout-incident-${row.id}`,
        kind: 'clinical',
        title: `Closeout event: ${row.client}`,
        body: `${row.service}. Review in Acuity before follow-up.`,
        priority: 'critical',
        status: 'open',
        audience: ['admin', 'clinical'],
        channels: ['in_app'],
        source: 'Closeout Dock',
        linkedEntityType: 'visit',
        linkedEntityId: row.id,
        actionLabel: 'Review Acuity',
      });
      actions.push({ type: 'incident', id: incident.id });
    }
  });

  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Ops',
    from: 'Closeout Dock',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `closeout-sweep-${Date.now()}`,
    text: `Closeout sweep complete: ${actions.length} PHI-clean proof action${actions.length === 1 ? '' : 's'} queued.`,
  });
  appendActivity('Closeout dock sweep complete', { role: 'ops', actions: actions.length });
  return { actions, dock: buildVisitCloseoutDock() };
}

export function runAcuityControlSweep(requests = []) {
  const tower = buildAcuityControlTower(requests);
  const actions = [];
  tower.items.forEach((item) => {
    if (!item.acuityLinked) {
      const handoff = queueAcuityManualHandoff(item, { source: 'Acuity sweep' });
      actions.push({ type: 'acuity', id: handoff.id });
    }
    if (item.gfeAction) {
      const gfeRoute = routeGfeForBooking({
        ...item.raw,
        id: item.bookingId,
        contact: { name: item.client, phone: item.phone, email: item.email },
        service: item.service,
        date: item.date,
        time: item.time,
        address: item.address,
        gfe: item.gfe,
      }, { source: 'Acuity sweep' });
      if (gfeRoute) actions.push({ type: 'gfe', id: gfeRoute.id });
    }
    if (!item.nurseDone && item.gfeDone && item.depositDone) {
      const broadcast = createAssignmentBroadcast({
        ...item.raw,
        id: item.bookingId,
        contact: { name: item.client, phone: item.phone, email: item.email },
        service: item.service,
        date: item.date,
        time: item.time,
        address: item.address,
        city: item.city,
        shiftValue: item.shiftValue,
        nurse: 'Unassigned',
      }, { source: 'Acuity sweep' });
      if (broadcast) actions.push({ type: 'shift', id: broadcast.id });
    }
  });
  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Dispatch',
    from: 'Acuity Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `acuity-sweep-${Date.now()}`,
    text: `Acuity sweep complete: ${actions.length} local action${actions.length === 1 ? '' : 's'} queued.`,
  });
  appendActivity('Acuity control sweep complete', { role: 'ops', actions: actions.length });
  return { actions, tower: buildAcuityControlTower(requests) };
}

export const ATTIO_CONTROL_STAGES = [
  { key: 'lead', label: 'Lead', owner: 'Avalon' },
  { key: 'booked', label: 'Booked', owner: 'Acuity' },
  { key: 'active', label: 'Active', owner: 'Care' },
  { key: 'followup', label: 'Follow-up', owner: 'Care' },
  { key: 'rebook', label: 'Rebook', owner: 'Care' },
  { key: 'plan', label: 'Plan', owner: 'Sales' },
  { key: 'review', label: 'Review', owner: 'Care' },
  { key: 'winback', label: 'Win-back', owner: 'Care' },
];

export const ATTIO_CRM_BOUNDARY_ITEMS = [
  { label: 'CRM-safe', detail: 'Name, phone, email, source, city, lifecycle, spend, visit count, tags, and plan interest.' },
  { label: 'Never sync', detail: 'Clinical notes, intake answers, diagnosis-like language, GFE content, vitals, meds, allergies, and adverse-event detail.' },
  { label: 'Acuity owns', detail: 'EMR and appointment record. Attio only gets non-clinical relationship state.' },
  { label: 'Avalon owns', detail: 'Local task queue, outreach timing, client status, and handoff proof.' },
];

function splitClientName(name = '') {
  const clean = cleanText(name);
  const parts = clean.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    name: clean,
  };
}

function clientFullName(client = {}) {
  return cleanText(client.name || client.client || [client.first_name, client.last_name].filter(Boolean).join(' ') || [client.firstName, client.lastName].filter(Boolean).join(' ')) || 'Client pending';
}

function clientIdFromName(name = '') {
  return cleanText(name).toLowerCase().replace(/[^a-z0-9]+/g, '-') || `client-${Date.now()}`;
}

function latestAppointmentForClient(client = {}, appointments = []) {
  const id = client.id || client.client_id;
  const matches = appointments
    .filter((item) => item.client_id === id || item.clientId === id || clientFullName(item) === clientFullName(client))
    .sort((a, b) => new Date(b.scheduled_at || b.date || b.created_at || 0) - new Date(a.scheduled_at || a.date || a.created_at || 0));
  return matches[0] || null;
}

function normalizeAttioPerson(input = {}, source = 'Avalon') {
  const name = clientFullName(input);
  const parsed = splitClientName(name);
  const tags = Array.isArray(input.tags) ? input.tags : [];
  const lifecycleStage = input.lifecycleStage
    || (/vip/i.test(tags.join(' ')) ? 'VIP' : Number(input.visit_count || input.visitCount || 0) > 0 ? 'Active Client' : 'Lead');
  return {
    id: input.id || input.client_id || input.bookingId || clientIdFromName(name),
    name,
    firstName: input.first_name || input.firstName || parsed.firstName,
    lastName: input.last_name || input.lastName || parsed.lastName,
    email: input.email || input.contact?.email || '',
    phone: input.phone || input.contact?.phone || '',
    source: input.source || source,
    city: input.city || inferBookingCity(input),
    lifecycleStage,
    tags,
    lastVisitAt: input.last_visit || input.lastVisit || input.lastVisitAt || input.date || '',
    visitCount: Number(input.visit_count ?? input.visitCount ?? 0),
    totalSpend: Number(input.total_spent ?? input.totalSpend ?? input.total ?? 0),
    planInterest: input.planInterest || (/corporate|subscription|membership|plan/i.test([input.source, input.service, input.therapy, tags.join(' ')].join(' ')) ? 'Likely' : ''),
    service: input.service || input.therapy || input.plan || '',
  };
}

function attioSafePayload(person = {}) {
  const payload = buildAttioClientPayload(person);
  return {
    ...payload,
    tags: payload.tags || [],
    city: payload.city || '',
    service: person.service || '',
  };
}

function attioQueueId(person = {}) {
  return `attio-${person.id || person.email || clientIdFromName(person.name)}`;
}

export function readAttioLocalQueue() {
  return readLocal('attioLocalQueue', []);
}

export function queueAttioLocalSync(person = {}, options = {}) {
  const normalized = normalizeAttioPerson(person, options.source || 'Avalon CRM');
  const payload = attioSafePayload(normalized);
  const current = readAttioLocalQueue();
  const id = options.id || attioQueueId(normalized);
  const existing = current.find((entry) => entry.id === id);
  const now = new Date().toISOString();
  const entry = {
    id,
    personId: normalized.id,
    name: normalized.name,
    email: normalized.email,
    phone: normalized.phone,
    lifecycleStage: payload.lifecycleStage,
    source: payload.source,
    city: payload.city,
    tags: payload.tags,
    payload,
    destination: ATTIO_PLACEHOLDER.service,
    status: existing?.status === 'Synced' ? 'Synced' : 'Queued',
    phiExcluded: true,
    reason: options.reason || 'CRM-safe person sync.',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    syncedAt: existing?.syncedAt || '',
    syncedBy: existing?.syncedBy || '',
  };
  const next = [entry, ...current.filter((item) => item.id !== id)].slice(0, 120);
  writeLocal('attioLocalQueue', next);
  upsertCommunicationAlert({
    id: `alert-${entry.id}`,
    kind: 'crm',
    title: `CRM sync: ${entry.name}`,
    body: `${entry.lifecycleStage} · ${entry.source}. CRM-safe fields only.`,
    priority: entry.status === 'Synced' ? 'info' : 'action',
    status: entry.status === 'Synced' ? 'resolved' : 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Attio Control',
    linkedEntityType: 'client',
    linkedEntityId: entry.personId,
    actionLabel: 'Sync to Attio',
  });
  appendActivity(`Attio sync queued for ${entry.name}`, { role: 'ops', personId: entry.personId, phiExcluded: true });
  return entry;
}

export function resolveAttioLocalSync(entryOrPersonId, actor = 'Avalon OS') {
  const id = String(entryOrPersonId || '');
  const now = new Date().toISOString();
  let resolved = null;
  const next = readAttioLocalQueue().map((entry) => {
    const matches = entry.id === id || entry.personId === id || entry.email === id;
    if (!matches) return entry;
    resolved = {
      ...entry,
      status: 'Synced',
      syncedBy: actor,
      syncedAt: now,
      updatedAt: now,
    };
    return resolved;
  });
  writeLocal('attioLocalQueue', next);
  if (resolved) {
    resolveCommunicationAlert(`alert-${resolved.id}`, actor);
    appendActivity(`Attio sync marked complete for ${resolved.name}`, { role: actor, personId: resolved.personId });
  }
  return next;
}

export function readAttioOutreachQueue() {
  return readLocal('attioOutreachQueue', []);
}

function outreachId(task = {}) {
  return `outreach-${task.id || task.personId || clientIdFromName(task.client || task.name)}-${clientIdFromName(task.type || task.kind || 'task')}`;
}

export function queueAttioOutreach(task = {}, options = {}) {
  const current = readAttioOutreachQueue();
  const id = options.id || outreachId(task);
  const existing = current.find((entry) => entry.id === id);
  const now = new Date().toISOString();
  const entry = {
    id,
    personId: task.personId || task.clientId || '',
    client: task.client || task.name || 'Client pending',
    type: task.type || task.kind || 'Follow-up',
    priority: task.priority || 'Medium',
    channel: options.channel || task.channel || 'Avalon Comms',
    dueDate: task.dueDate || task.due_date || '',
    status: existing?.status === 'Done' ? 'Done' : existing?.status || 'Queued',
    note: task.note || task.notes || task.nextAction || '',
    script: task.script || buildAttioOutreachScript(task),
    destination: ATTIO_PLACEHOLDER.service,
    phiExcluded: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    completedAt: existing?.completedAt || '',
    completedBy: existing?.completedBy || '',
  };
  const next = [entry, ...current.filter((item) => item.id !== id)].slice(0, 120);
  writeLocal('attioOutreachQueue', next);
  sendOpsMessage({
    threadId: 'client-texts',
    audience: entry.client,
    from: 'Attio Control',
    role: 'crm-outreach',
    status: 'Queued',
    channels: ['chat'],
    relatedBroadcastId: entry.id,
    text: `${entry.type}: ${entry.client}. ${entry.script}`,
  });
  appendActivity(`Outreach queued: ${entry.client}`, { role: 'care', type: entry.type, phiExcluded: true });
  return entry;
}

export function resolveAttioOutreach(taskId, actor = 'Avalon OS') {
  const now = new Date().toISOString();
  const next = readAttioOutreachQueue().map((entry) => (
    entry.id === taskId
      ? { ...entry, status: 'Done', completedBy: actor, completedAt: now, updatedAt: now }
      : entry
  ));
  writeLocal('attioOutreachQueue', next);
  appendActivity(`Outreach completed: ${taskId}`, { role: actor });
  return next;
}

function buildAttioOutreachScript(task = {}) {
  const type = String(task.type || task.kind || '').toLowerCase();
  if (/review/.test(type)) return 'Ask for a review only if the client had a good experience.';
  if (/rebook|win/.test(type)) return 'Offer a simple rebook link or concierge scheduling help.';
  if (/membership|plan|corporate/.test(type)) return 'Ask whether they want a plan or recurring recovery setup.';
  if (/payment/.test(type)) return 'Send payment/deposit reminder without clinical detail.';
  if (/cancel/.test(type)) return 'Recover the cancelled visit and offer a new time.';
  if (/vip/.test(type)) return 'Send high-touch concierge check-in.';
  return 'Send a brief care-team follow-up.';
}

function buildAttioTaskFromRequest(request = {}) {
  const status = String(request.status || '');
  const base = {
    id: `request-${request.id}`,
    personId: request.id,
    client: request.client || 'Client pending',
    dueDate: request.date,
    priority: request.priority ? 'High' : 'Medium',
    source: request.source || 'Request queue',
  };
  if (/cancel/i.test(status)) return { ...base, type: 'Cancellation recovery', priority: 'High', nextAction: 'Recover cancelled appointment.' };
  if (/payment|link/i.test(String(request.payment || status))) return { ...base, type: 'Payment follow-up', nextAction: 'Collect deposit or payment.' };
  if (/intake|consent|gfe|blocked/i.test([status, request.intake, request.consent, request.gfe].join(' '))) return { ...base, type: 'Clearance follow-up', priority: 'High', nextAction: 'Prompt intake, consent, or GFE.' };
  if (/completed|follow/i.test(status)) return { ...base, type: 'Post-visit check-in', nextAction: 'Check in and ask about rebook.' };
  if (/event|corporate/i.test([request.locType, request.source, request.notes].join(' '))) return { ...base, type: 'Event/corporate follow-up', priority: 'High', nextAction: 'Move event or corporate lead forward.' };
  return null;
}

function buildAttioTaskFromAppointment(appointment = {}, client = {}) {
  const status = String(appointment.status || '');
  if (!/completed|cancelled/i.test(status)) return null;
  const name = clientFullName(client);
  return {
    id: `appt-${appointment.id}`,
    personId: client.id || appointment.client_id,
    client: name,
    dueDate: appointment.scheduled_at || appointment.created_at,
    type: /cancelled/i.test(status) ? 'Cancellation recovery' : 'Post-visit check-in',
    priority: /vip/i.test((client.tags || []).join(' ')) ? 'High' : 'Medium',
    nextAction: /cancelled/i.test(status) ? 'Offer a new appointment time.' : 'Check in and invite rebook/review.',
  };
}

export function buildAttioControlTower({
  requests = [],
  clients = [],
  appointments = [],
  followups = [],
  latestBooking = readLastBooking(),
} = {}) {
  const queue = readAttioLocalQueue();
  const outreach = readAttioOutreachQueue();
  const closeouts = readLocal('acuityCloseoutPackets', []);
  const aftercareRecords = readClientAftercareRecords();
  const peopleSource = [
    ...clients.map((client) => {
      const latest = latestAppointmentForClient(client, appointments);
      return normalizeAttioPerson({
        ...client,
        lastVisitAt: client.last_visit || latest?.scheduled_at,
        lifecycleStage: Number(client.visit_count || 0) > 0 ? 'Active Client' : 'Lead',
      }, client.source || 'Client record');
    }),
    ...requests.map((request) => normalizeAttioPerson({
      id: request.id,
      client: request.client,
      email: request.email,
      phone: request.phone,
      source: request.source,
      city: inferBookingCity({ address: request.location, city: request.city }),
      lifecycleStage: /completed/i.test(request.status || '') ? 'Active Client' : /confirmed|ready|assigned|gfe|intake|consent/i.test(request.status || '') ? 'Booked' : 'Lead',
      totalSpend: request.total,
      planInterest: /corporate|event|subscription|membership/i.test([request.source, request.notes, request.therapy].join(' ')) ? 'Likely' : '',
      service: request.therapy,
      tags: request.isVIP ? ['vip'] : [],
    }, request.source || 'Request queue')),
    ...(latestBooking ? [normalizeAttioPerson({
      id: latestBooking.id || latestBooking.reference,
      name: latestBooking.contact?.name,
      firstName: latestBooking.contact?.firstName,
      lastName: latestBooking.contact?.lastName,
      email: latestBooking.contact?.email,
      phone: latestBooking.contact?.phone,
      source: latestBooking.source || 'Website',
      city: inferBookingCity(latestBooking),
      lifecycleStage: 'Booked',
      service: latestBooking.service || latestBooking.plan,
      totalSpend: latestBooking.total,
      planInterest: latestBooking.subscription ? 'Subscription' : '',
    }, 'Latest booking')] : []),
  ];
  const seen = new Set();
  const people = peopleSource.filter((person) => {
    const key = (person.email || person.name || person.id).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((person) => {
    const sync = queue.find((entry) => entry.personId === person.id || (person.email && entry.email === person.email));
    const safePayload = attioSafePayload(person);
    return {
      ...person,
      safePayload,
      sync,
      syncStatus: sync?.status || 'Local only',
      needsSync: sync?.status !== 'Synced',
      missingContact: !person.email && !person.phone,
    };
  });

  const fixtureTasks = followups.map((item) => ({
    id: item.id,
    personId: clientIdFromName(item.client),
    client: item.client,
    type: item.type,
    dueDate: item.dueDate || item.due_date,
    priority: item.priority || 'Medium',
    status: item.status || 'Pending',
    note: item.notes || item.note || '',
    nextAction: buildAttioOutreachScript(item),
  }));
  const requestTasks = requests.map(buildAttioTaskFromRequest).filter(Boolean);
  const appointmentTasks = appointments.map((appointment) => buildAttioTaskFromAppointment(
    appointment,
    clients.find((client) => client.id === appointment.client_id) || {},
  )).filter(Boolean);
  const closeoutTasks = closeouts.map((packet) => ({
    id: `closeout-${packet.appointmentId}`,
    personId: packet.clientId || clientIdFromName(packet.clientName),
    client: packet.clientName,
    type: packet.eventFlagged ? 'Issue resolution' : 'Post-visit check-in',
    dueDate: packet.completedAt,
    priority: packet.eventFlagged ? 'High' : 'Medium',
    status: 'Pending',
    note: packet.eventFlagged ? 'Adverse-event follow-up must stay clinical-safe in CRM.' : 'Closeout complete. Care check-in ready.',
    nextAction: packet.eventFlagged ? 'Coordinate clinical-safe service recovery.' : 'Check in and invite rebook/review.',
  }));
  const aftercareTasks = aftercareRecords.map((record) => ({
    id: `aftercare-${record.visitId}`,
    personId: record.clientId || clientIdFromName(record.client),
    client: record.client,
    type: record.status === 'Care follow-up' ? 'Care follow-up' : 'Rebook prompt',
    dueDate: record.createdAt,
    priority: record.status === 'Care follow-up' ? 'High' : 'Medium',
    status: 'Pending',
    note: record.status === 'Care follow-up'
      ? 'Care follow-up routed. Keep clinical details in Acuity.'
      : 'Aftercare sent. Offer rebook, plan, or review if appropriate.',
    nextAction: record.status === 'Care follow-up'
      ? 'Coordinate clinical-safe service recovery.'
      : 'Invite rebook or subscription.',
  }));
  const taskSeen = new Set();
  const tasks = [...fixtureTasks, ...requestTasks, ...appointmentTasks, ...closeoutTasks, ...aftercareTasks]
    .filter((task) => {
      const key = `${task.client}-${task.type}-${task.dueDate}`;
      if (taskSeen.has(key)) return false;
      taskSeen.add(key);
      return true;
    })
    .map((task) => {
      const queued = outreach.find((entry) => entry.id === outreachId(task));
      const overdue = task.status === 'Overdue' || (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done');
      return {
        ...task,
        queued,
        queuedStatus: queued?.status || 'Not queued',
        overdue,
        risk: task.priority === 'High' || overdue ? 'critical' : queued ? 'ready' : 'action',
        script: buildAttioOutreachScript(task),
      };
    });

  const stageSummaries = ATTIO_CONTROL_STAGES.map((stage) => {
    const count = {
      lead: people.filter((item) => /lead/i.test(item.lifecycleStage)).length,
      booked: people.filter((item) => /booked/i.test(item.lifecycleStage)).length,
      active: people.filter((item) => /active|vip/i.test(item.lifecycleStage)).length,
      followup: tasks.filter((item) => /follow|post|issue/i.test(item.type)).length,
      rebook: tasks.filter((item) => /rebook|win|cancel/i.test(item.type)).length,
      plan: people.filter((item) => item.planInterest).length + tasks.filter((item) => /plan|membership|corporate/i.test(item.type)).length,
      review: tasks.filter((item) => /review/i.test(item.type)).length,
      winback: tasks.filter((item) => /win|cancel/i.test(item.type)).length,
    }[stage.key] || 0;
    return { ...stage, count };
  });

  return {
    people,
    tasks,
    queue,
    outreach,
    stageSummaries,
    boundary: ATTIO_CRM_BOUNDARY_ITEMS,
    contract: ATTIO_PLACEHOLDER,
    metrics: {
      people: people.length,
      needsSync: people.filter((item) => item.needsSync && !item.missingContact).length,
      missingContact: people.filter((item) => item.missingContact).length,
      tasks: tasks.length,
      overdue: tasks.filter((item) => item.overdue).length,
      high: tasks.filter((item) => item.priority === 'High').length,
      planLeads: people.filter((item) => item.planInterest).length,
      vip: people.filter((item) => /vip/i.test([item.lifecycleStage, ...(item.tags || [])].join(' '))).length,
    },
  };
}

export const FINANCE_CONTROL_STAGES = [
  { key: 'collect', label: 'Collect', owner: 'Stripe/Acuity' },
  { key: 'bank', label: 'Bank', owner: 'Mercury' },
  { key: 'closeout', label: 'Closeout', owner: 'Acuity' },
  { key: 'payroll', label: 'Payroll', owner: 'Gusto' },
  { key: 'books', label: 'Books', owner: 'QuickBooks' },
  { key: 'refunds', label: 'Refunds', owner: 'Admin' },
  { key: 'reconcile', label: 'Reconcile', owner: 'Ops' },
  { key: 'guard', label: 'Guard', owner: 'Avalon' },
];

export const FINANCE_BOUNDARY_ITEMS = [
  { label: 'Money in', detail: 'Stripe/Acuity payments and deposits land into Mercury operating cash.' },
  { label: 'Payroll', detail: 'Gusto gets nurse pay, mileage, and reimbursement proof after Acuity closeout.' },
  { label: 'Books', detail: 'QuickBooks gets invoices, deposits, payouts, refunds, and summary lines only.' },
  { label: 'Never export', detail: 'Clinical notes, GFE content, vitals, meds, allergies, intake answers, or adverse-event detail.' },
];

function moneyNumber(value = 0) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function financeClientName(item = {}, clients = []) {
  if (item.client || item.clientName) return item.client || item.clientName;
  const client = clients.find((entry) => entry.id === item.client_id || entry.id === item.clientId);
  if (client) return clientFullName(client);
  return 'Client pending';
}

function normalizeFinancePayment(item = {}, clients = [], source = 'Payments') {
  const amount = moneyNumber(item.amount ?? item.total ?? item.subtotal);
  const status = item.status || 'Pending';
  const id = item.id || item.invoice_number || item.invoice || `payment-${financeClientName(item, clients).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const paid = /paid|deposit received|complete/i.test(status);
  const overdue = /overdue/i.test(status);
  const refund = /refund/i.test(status);
  return {
    id,
    sourceId: id,
    client: financeClientName(item, clients),
    amount,
    status,
    method: item.method || item.payment_method || 'Stripe/Acuity',
    date: item.date || item.created_at || item.paid_at || '',
    invoice: item.invoice || item.invoice_number || id,
    service: item.therapy || item.visit || item.service || '',
    source,
    paid,
    overdue,
    refund,
    pending: !paid && !refund,
  };
}

export function readMercuryBankingQueue() {
  return readLocal('mercuryBankingQueue', []);
}

export function queueMercuryBankingEntry(entry = {}, options = {}) {
  const amount = moneyNumber(entry.amount);
  const sourceId = entry.sourceId || entry.id || `money-${Date.now()}`;
  const id = options.id || `mercury-${sourceId}`;
  const current = readMercuryBankingQueue();
  const existing = current.find((item) => item.id === id);
  const now = new Date().toISOString();
  const nextEntry = {
    id,
    sourceId,
    client: entry.client || 'Client pending',
    amount,
    direction: entry.direction || (amount < 0 ? 'Out' : 'In'),
    type: entry.type || entry.kind || 'Payment',
    method: entry.method || 'Stripe/Acuity',
    destination: MERCURY_BANKING_PLACEHOLDER.service,
    status: existing?.status === 'Landed' ? 'Landed' : 'Queued',
    phiExcluded: true,
    note: entry.note || options.note || 'Finance-safe banking entry.',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    landedAt: existing?.landedAt || '',
    landedBy: existing?.landedBy || '',
  };
  const next = [nextEntry, ...current.filter((item) => item.id !== id)].slice(0, 120);
  writeLocal('mercuryBankingQueue', next);
  upsertCommunicationAlert({
    id: `alert-${nextEntry.id}`,
    kind: 'finance',
    title: `Mercury: ${nextEntry.client}`,
    body: `${nextEntry.type} · $${Math.abs(nextEntry.amount)} · ${nextEntry.method}. PHI excluded.`,
    priority: nextEntry.status === 'Landed' ? 'info' : 'action',
    status: nextEntry.status === 'Landed' ? 'resolved' : 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Finance Control',
    linkedEntityType: 'payment',
    linkedEntityId: sourceId,
    actionLabel: 'Verify bank',
  });
  appendActivity(`Mercury entry queued for ${nextEntry.client}`, { role: 'finance', sourceId, phiExcluded: true });
  return nextEntry;
}

export function resolveMercuryBankingEntry(entryId, actor = 'Avalon OS') {
  const now = new Date().toISOString();
  let resolved = null;
  const next = readMercuryBankingQueue().map((entry) => {
    const matches = entry.id === entryId || entry.sourceId === entryId;
    if (!matches) return entry;
    resolved = {
      ...entry,
      status: 'Landed',
      landedBy: actor,
      landedAt: now,
      updatedAt: now,
    };
    return resolved;
  });
  writeLocal('mercuryBankingQueue', next);
  if (resolved) {
    resolveCommunicationAlert(`alert-${resolved.id}`, actor);
    appendActivity(`Mercury landed: ${resolved.client}`, { role: actor, sourceId: resolved.sourceId });
  }
  return next;
}

export function readQuickBooksSummaryQueue() {
  return readLocal('quickBooksSummaryQueue', []);
}

export function queueQuickBooksSummary(summary = {}, options = {}) {
  const sourceId = summary.sourceId || summary.id || `books-${Date.now()}`;
  const id = options.id || `quickbooks-${sourceId}`;
  const current = readQuickBooksSummaryQueue();
  const existing = current.find((item) => item.id === id);
  const now = new Date().toISOString();
  const nextEntry = {
    id,
    sourceId,
    label: summary.label || summary.client || 'Finance summary',
    category: summary.category || 'Revenue',
    amount: moneyNumber(summary.amount),
    destination: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service,
    status: existing?.status === 'Posted' ? 'Posted' : 'Queued',
    phiExcluded: true,
    detail: summary.detail || 'Books-safe summary line.',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    postedAt: existing?.postedAt || '',
    postedBy: existing?.postedBy || '',
  };
  const next = [nextEntry, ...current.filter((item) => item.id !== id)].slice(0, 120);
  writeLocal('quickBooksSummaryQueue', next);
  upsertCommunicationAlert({
    id: `alert-${nextEntry.id}`,
    kind: 'books',
    title: `QuickBooks: ${nextEntry.label}`,
    body: `${nextEntry.category} · $${Math.abs(nextEntry.amount)}. Summary only; PHI excluded.`,
    priority: nextEntry.status === 'Posted' ? 'info' : 'action',
    status: nextEntry.status === 'Posted' ? 'resolved' : 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Finance Control',
    linkedEntityType: 'books',
    linkedEntityId: sourceId,
    actionLabel: 'Post books',
  });
  appendActivity(`QuickBooks summary queued: ${nextEntry.label}`, { role: 'finance', sourceId, phiExcluded: true });
  return nextEntry;
}

export function resolveQuickBooksSummary(entryId, actor = 'Avalon OS') {
  const now = new Date().toISOString();
  let resolved = null;
  const next = readQuickBooksSummaryQueue().map((entry) => {
    const matches = entry.id === entryId || entry.sourceId === entryId;
    if (!matches) return entry;
    resolved = {
      ...entry,
      status: 'Posted',
      postedBy: actor,
      postedAt: now,
      updatedAt: now,
    };
    return resolved;
  });
  writeLocal('quickBooksSummaryQueue', next);
  if (resolved) {
    resolveCommunicationAlert(`alert-${resolved.id}`, actor);
    appendActivity(`QuickBooks posted: ${resolved.label}`, { role: actor, sourceId: resolved.sourceId });
  }
  return next;
}

function buildPayrollCandidate(appointment = {}, clients = [], services = []) {
  if (!/completed/i.test(String(appointment.status || ''))) return null;
  const client = clients.find((entry) => entry.id === appointment.client_id) || {};
  const service = services.find((entry) => entry.id === appointment.service_id) || {};
  return {
    id: appointment.id,
    visitId: appointment.id,
    client: financeClientName(appointment, clients),
    nurseName: appointment.nurseName || appointment.nurse || 'Assigned nurse',
    service: service.name || appointment.serviceName || 'Avalon visit',
    shiftValue: Number(appointment.shiftValue || service.base_price || DEFAULT_SHIFT_VALUE),
    miles: Number(appointment.miles || 0),
    reimbursements: Number(appointment.reimbursements || 0),
    completedAt: appointment.scheduled_at || appointment.completedAt || appointment.created_at,
    status: 'Ready',
    source: client.id ? 'Acuity appointment mirror' : 'Local appointment mirror',
  };
}

export function buildFinanceControlTower({
  payments = [],
  invoices = [],
  appointments = [],
  clients = [],
  services = [],
  latestBooking = readLastBooking(),
} = {}) {
  const normalizedPayments = [
    ...payments.map((item) => normalizeFinancePayment(item, clients, 'Payment queue')),
    ...invoices.map((item) => normalizeFinancePayment(item, clients, 'Invoice queue')),
    ...(latestBooking ? [normalizeFinancePayment({
      id: latestBooking.id || latestBooking.reference,
      client: latestBooking.contact?.name || 'Latest booking',
      amount: latestBooking.depositAmount || latestBooking.total || 50,
      status: latestBooking.payment || 'Pending',
      method: latestBooking.paymentMethod || 'Stripe/Acuity',
      date: latestBooking.date,
      therapy: latestBooking.service || latestBooking.plan,
      invoice: latestBooking.reference || latestBooking.id,
    }, clients, 'Latest booking')] : []),
  ];
  const seenPayments = new Set();
  const money = normalizedPayments.filter((item) => {
    if (seenPayments.has(item.sourceId)) return false;
    seenPayments.add(item.sourceId);
    return true;
  }).map((item) => {
    const bank = readMercuryBankingQueue().find((entry) => entry.sourceId === item.sourceId);
    const books = readQuickBooksSummaryQueue().find((entry) => entry.sourceId === item.sourceId);
    return {
      ...item,
      bank,
      books,
      bankStatus: bank?.status || (item.paid || item.refund ? 'Not queued' : 'Waiting'),
      booksStatus: books?.status || (item.paid || item.refund ? 'Not queued' : 'Waiting'),
      risk: item.overdue ? 'critical' : item.pending ? 'action' : bank?.status === 'Landed' && books?.status === 'Posted' ? 'ready' : 'action',
    };
  });

  const payrollProof = readPayrollProofQueue();
  const payrollCandidates = appointments.map((item) => buildPayrollCandidate(item, clients, services)).filter(Boolean);
  const payroll = [
    ...payrollProof.map((item) => ({ ...item, source: item.source || 'Gusto proof queue', risk: item.status === 'Ready' ? 'action' : 'ready' })),
    ...payrollCandidates
      .filter((candidate) => !payrollProof.some((item) => item.visitId === candidate.visitId || item.id === candidate.visitId))
      .map((candidate) => ({ ...candidate, status: 'Not queued', risk: 'action' })),
  ];

  const booksQueue = readQuickBooksSummaryQueue();
  const bankingQueue = readMercuryBankingQueue();
  const closeouts = readLocal('acuityCloseoutPackets', []);
  const pendingMoney = money.filter((item) => item.pending);
  const paidMoney = money.filter((item) => item.paid);
  const overdueMoney = money.filter((item) => item.overdue);
  const collected = paidMoney.reduce((sum, item) => sum + item.amount, 0);
  const pending = pendingMoney.reduce((sum, item) => sum + item.amount, 0);
  const stageSummaries = FINANCE_CONTROL_STAGES.map((stage) => {
    const count = {
      collect: paidMoney.length,
      bank: bankingQueue.length,
      closeout: closeouts.length,
      payroll: payroll.length,
      books: booksQueue.length,
      refunds: money.filter((item) => item.refund).length,
      reconcile: bankingQueue.filter((item) => item.status !== 'Landed').length + booksQueue.filter((item) => item.status !== 'Posted').length,
      guard: FINANCE_BOUNDARY_ITEMS.length,
    }[stage.key] || 0;
    return { ...stage, count };
  });

  return {
    money,
    payroll,
    bankingQueue,
    booksQueue,
    stageSummaries,
    boundary: FINANCE_BOUNDARY_ITEMS,
    contract: FINANCE_HANDOFF_CONTRACT,
    placeholders: [MERCURY_BANKING_PLACEHOLDER, GUSTO_PAYROLL_PLACEHOLDER, QUICKBOOKS_ACCOUNTING_PLACEHOLDER],
    metrics: {
      collected,
      pending,
      overdue: overdueMoney.length,
      bankAction: bankingQueue.filter((item) => item.status !== 'Landed').length + paidMoney.filter((item) => !item.bank).length,
      payrollReady: payroll.filter((item) => item.status === 'Ready' || item.status === 'Not queued').length,
      booksAction: booksQueue.filter((item) => item.status !== 'Posted').length + paidMoney.filter((item) => !item.books).length,
      blocked: pendingMoney.length + overdueMoney.length,
    },
  };
}

export function runFinanceControlSweep({
  payments = [],
  invoices = [],
  appointments = [],
  clients = [],
  services = [],
} = {}) {
  const tower = buildFinanceControlTower({ payments, invoices, appointments, clients, services });
  const actions = [];
  tower.money.forEach((item) => {
    if ((item.paid || item.refund) && item.bankStatus !== 'Landed') {
      const bank = queueMercuryBankingEntry({
        sourceId: item.sourceId,
        client: item.client,
        amount: item.refund ? -Math.abs(item.amount) : item.amount,
        type: item.refund ? 'Refund' : 'Payment',
        method: item.method,
      }, { note: 'Queued by finance sweep.' });
      actions.push({ type: 'mercury', id: bank.id });
    }
    if ((item.paid || item.refund) && item.booksStatus !== 'Posted') {
      const books = queueQuickBooksSummary({
        sourceId: item.sourceId,
        label: item.invoice || item.client,
        category: item.refund ? 'Refund' : 'Revenue',
        amount: item.refund ? -Math.abs(item.amount) : item.amount,
        detail: `${item.source} · ${item.method}`,
      });
      actions.push({ type: 'quickbooks', id: books.id });
    }
  });
  tower.payroll.forEach((item) => {
    if (item.status !== 'Not queued') return;
    const next = queueGustoPayrollProof({
      visitId: item.visitId || item.id,
      nurseName: item.nurseName,
      service: item.service,
      shiftValue: item.shiftValue,
      miles: item.miles,
      reimbursements: item.reimbursements,
      completedAt: item.completedAt,
      chartStatus: 'Acuity closeout complete or admin-ready',
    });
    actions.push({ type: 'gusto', id: next[0]?.id || item.visitId || item.id });
  });
  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Finance',
    from: 'Finance Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `finance-sweep-${Date.now()}`,
    text: `Finance sweep complete: ${actions.length} PHI-clean action${actions.length === 1 ? '' : 's'} queued.`,
  });
  appendActivity('Finance control sweep complete', { role: 'finance', actions: actions.length, phiExcluded: true });
  return { actions, tower: buildFinanceControlTower({ payments, invoices, appointments, clients, services }) };
}

export const CREDENTIAL_CONTROL_STAGES = [
  { key: 'license', label: 'License', owner: 'Nurseys' },
  { key: 'scope', label: 'Scope', owner: 'Clinical' },
  { key: 'status', label: 'Status', owner: 'Ops' },
  { key: 'shift', label: 'Shift', owner: 'Dispatch' },
  { key: 'kit', label: 'Kit', owner: 'Inventory' },
  { key: 'route', label: 'Route', owner: 'Maps' },
  { key: 'text', label: 'Text', owner: 'Avalon' },
  { key: 'audit', label: 'Audit', owner: 'Compliance' },
];

export const CREDENTIAL_HARD_BLOCKS = [
  { label: 'No clear Nurseys status', detail: 'Nurse cannot claim or receive a shift until the credential status is Clear.' },
  { label: 'Wrong state', detail: 'California mobile appointments require California eligibility unless compliance approves another jurisdiction.' },
  { label: 'Expired or stale proof', detail: 'Expired, missing, or stale verification must be refreshed before assignment.' },
  { label: 'Scope mismatch', detail: 'RN can execute standing-order visits only after clinical clearance; NP/MD authority is required for clinical approvals.' },
];

const CREDENTIAL_SCOPE_RULES = [
  'RN may claim field visits only after clinical clearance is complete',
  'NP/MD may approve GFE and standing-order exceptions when on call',
  'Qualiphy fallback is used only when no Avalon NP is on shift',
  'Acuity remains EMR and scheduling source of record',
  'Avalon stores eligibility proof, not clinical notes',
];

function credentialDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value) {
  const date = credentialDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function credentialNameFromStaff(staff = {}) {
  return [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim() || staff.name || 'Nurse pending';
}

function credentialSlug(value = '') {
  return String(value || 'nurse')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'nurse';
}

function defaultCredentialExpiration(status = 'Review') {
  if (/clear/i.test(status)) return '2027-05-23';
  if (/expiring/i.test(status)) return '2026-06-08';
  return '';
}

function normalizeCredentialNurse(input = {}, source = 'Nurse roster') {
  const name = input.name || credentialNameFromStaff(input);
  const id = input.id || `nurse-${credentialSlug(name)}`;
  const role = input.role === 'nurse' ? 'RN' : (input.role || input.licenseType || 'RN').toUpperCase();
  const override = readNurseCredentialOverrides().find((item) => item.nurseId === id || item.name === name);
  const status = override?.status || input.nurseys?.status || input.credentialStatus || input.credStatus || 'Review';
  const state = override?.state || input.nurseys?.state || input.state || input.licenseState || 'CA';
  const expiresAt = override?.expiresAt || input.nurseys?.expiresAt || input.expiresAt || defaultCredentialExpiration(status);
  const checkedAt = override?.checkedAt || input.nurseys?.checkedAt || input.checkedAt || '';
  const stale = checkedAt ? daysUntil(new Date(new Date(checkedAt).getTime() + 7 * 86400000).toISOString()) < 0 : true;
  const expiresIn = daysUntil(expiresAt);
  const expiring = expiresIn !== null && expiresIn <= 30 && expiresIn >= 0;
  const expired = expiresIn !== null && expiresIn < 0;
  const sourceLabel = override?.source || input.credentialSource || NURSEYS_CREDENTIAL_PLACEHOLDER.service;
  const kitStatus = input.kitStatus || 'Unknown';
  const area = input.serviceArea || input.area || input.location || 'Bay Area';
  const queue = readNurseysCredentialQueue().find((item) => item.nurseId === id || item.name === name);
  const clear = status === 'Clear' && state === 'CA' && !expired && !stale;
  const hardBlock = status !== 'Clear' || state !== 'CA' || expired || stale;
  const reasons = [
    status !== 'Clear' ? `${sourceLabel}: ${status}` : '',
    state !== 'CA' ? `State ${state}` : '',
    expired ? 'Expired' : '',
    stale ? 'Stale check' : '',
    kitStatus !== 'Ready' && /available|assigned/i.test(input.status || '') ? `Kit ${kitStatus}` : '',
  ].filter(Boolean);

  return {
    id,
    name,
    role,
    source,
    status,
    state,
    expiresAt,
    expiresIn,
    expiring,
    expired,
    checkedAt,
    stale,
    sourceLabel,
    kitStatus,
    area,
    phone: input.phone || '',
    dutyStatus: input.status || (input.is_active === false ? 'Off Duty' : 'Available'),
    visitsToday: Number(input.todayVisits ?? input.visitsToday ?? 0),
    assignedTo: input.assignedTo || '',
    queue,
    queueStatus: queue?.status || 'Not queued',
    clear,
    hardBlock,
    reasons,
    nextAction: clear ? 'Can claim eligible shifts.' : reasons[0] || 'Refresh credential proof.',
  };
}

function normalizeCredentialShift(input = {}, clients = [], services = []) {
  const status = input.status || 'Nurse Needed';
  if (/completed|cancelled/i.test(status)) return null;
  const hasNurse = Boolean(input.nurse || input.nurse_id || input.nurseName);
  if (hasNurse && !/nurse needed|ready|confirmed|scheduled|gfe pending/i.test(status)) return null;
  const client = input.client || financeClientName(input, clients);
  const service = input.therapy || services.find((item) => item.id === input.service_id)?.name || input.serviceName || 'Avalon visit';
  const location = input.location || [input.location_address, input.location_city].filter(Boolean).join(', ') || 'Location pending';
  const city = input.location_city || inferBookingCity(input) || 'Bay Area';
  const id = input.id || `shift-${credentialSlug([client, service, input.time || input.scheduled_at].join('-'))}`;
  return {
    id,
    client,
    service,
    location,
    city,
    date: input.date || input.scheduled_at || input.created_at || '',
    time: input.time || '',
    source: input.source || 'Acuity/local mirror',
    status,
    assignedNurse: input.nurse || input.nurseName || '',
    needsNurse: !hasNurse || /nurse needed/i.test(status),
    gfe: input.gfe || 'Pending',
    payment: input.payment || 'Pending',
    guests: Number(input.guests || 1),
    value: Number(input.shiftValue || input.total || DEFAULT_SHIFT_VALUE),
  };
}

export function readNurseCredentialOverrides() {
  return readLocal('nurseCredentialOverrides', []);
}

export function setNurseCredentialOverride(nurseId, patch = {}) {
  const current = readNurseCredentialOverrides();
  const existing = current.find((item) => item.nurseId === nurseId || item.id === nurseId) || {};
  const now = new Date().toISOString();
  const nextEntry = {
    ...existing,
    id: existing.id || `credential-${nurseId}`,
    nurseId,
    name: patch.name || existing.name || '',
    status: patch.status || existing.status || 'Review',
    state: patch.state || existing.state || 'CA',
    expiresAt: patch.expiresAt ?? existing.expiresAt ?? defaultCredentialExpiration(patch.status || existing.status),
    checkedAt: patch.checkedAt || now,
    source: patch.source || existing.source || NURSEYS_CREDENTIAL_PLACEHOLDER.service,
    note: patch.note || existing.note || '',
    updatedAt: now,
  };
  writeLocal('nurseCredentialOverrides', [nextEntry, ...current.filter((item) => item.nurseId !== nurseId && item.id !== nurseId)].slice(0, 120));
  appendActivity(`Credential override: ${nextEntry.name || nurseId}`, { role: 'credentialing', status: nextEntry.status });
  return nextEntry;
}

export function readNurseysCredentialQueue() {
  return readLocal('nurseysCredentialQueue', []);
}

export function queueNurseysCredentialCheck(nurse = {}, options = {}) {
  const id = options.id || `nurseys-${nurse.id || credentialSlug(nurse.name)}`;
  const now = new Date().toISOString();
  const current = readNurseysCredentialQueue();
  const existing = current.find((item) => item.id === id);
  const nextEntry = {
    id,
    nurseId: nurse.id || existing?.nurseId || '',
    name: nurse.name || existing?.name || 'Nurse pending',
    role: nurse.role || existing?.role || 'RN',
    state: nurse.state || existing?.state || 'CA',
    requestedStatus: nurse.status || existing?.requestedStatus || 'Review',
    destination: NURSEYS_CREDENTIAL_PLACEHOLDER.service,
    status: existing?.status === 'Clear' ? 'Clear' : options.status || 'Queued',
    reason: options.reason || nurse.nextAction || 'Credential refresh required.',
    source: options.source || 'Credential Control',
    phiExcluded: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    resolvedAt: existing?.resolvedAt || '',
    resolvedBy: existing?.resolvedBy || '',
  };
  const next = [nextEntry, ...current.filter((item) => item.id !== id)].slice(0, 120);
  writeLocal('nurseysCredentialQueue', next);
  upsertCommunicationAlert({
    id: `alert-${nextEntry.id}`,
    kind: 'credential',
    title: `Nurseys: ${nextEntry.name}`,
    body: `${nextEntry.requestedStatus} · ${nextEntry.reason}. PHI excluded.`,
    priority: nextEntry.status === 'Clear' ? 'info' : 'action',
    status: nextEntry.status === 'Clear' ? 'resolved' : 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Credential Control',
    linkedEntityType: 'nurse',
    linkedEntityId: nextEntry.nurseId,
    actionLabel: 'Verify credential',
  });
  appendActivity(`Nurseys check queued for ${nextEntry.name}`, { role: 'credentialing', nurseId: nextEntry.nurseId, phiExcluded: true });
  return nextEntry;
}

export function resolveNurseysCredentialCheck(entryId, status = 'Clear', actor = 'Credential Control') {
  const now = new Date().toISOString();
  let resolved = null;
  const next = readNurseysCredentialQueue().map((entry) => {
    const matches = entry.id === entryId || entry.nurseId === entryId;
    if (!matches) return entry;
    resolved = {
      ...entry,
      status,
      resolvedBy: actor,
      resolvedAt: now,
      updatedAt: now,
    };
    return resolved;
  });
  writeLocal('nurseysCredentialQueue', next);
  if (resolved) {
    setNurseCredentialOverride(resolved.nurseId, {
      name: resolved.name,
      status,
      state: resolved.state || 'CA',
      expiresAt: status === 'Clear' ? '2027-05-23' : '',
      checkedAt: now,
      source: NURSEYS_CREDENTIAL_PLACEHOLDER.service,
      note: `${actor} marked ${status}.`,
    });
    if (status === 'Clear') resolveCommunicationAlert(`alert-${resolved.id}`, actor);
    appendActivity(`Nurseys resolved: ${resolved.name}`, { role: actor, status });
  }
  return next;
}

function credentialAreaMatch(nurse = {}, shift = {}) {
  const area = String(nurse.area || '').toLowerCase();
  const city = String(shift.city || shift.location || '').toLowerCase();
  if (!area || !city || area.includes('bay area')) return true;
  if (city.includes('san francisco') && area.includes('san francisco')) return true;
  if (city.includes('marin') && area.includes('marin')) return true;
  if ((city.includes('oakland') || city.includes('berkeley')) && /oakland|berkeley|east bay/.test(area)) return true;
  if ((city.includes('palo alto') || city.includes('san jose') || city.includes('san mateo')) && /south bay|peninsula|palo alto|san jose|san mateo/.test(area)) return true;
  return /sf/.test(area) && city.includes('san francisco');
}

export function buildCredentialControlTower({
  nurses = [],
  staff = [],
  requests = [],
  appointments = [],
  clients = [],
  services = [],
} = {}) {
  const staffNurses = staff
    .filter((item) => /nurse|provider|np|physician/i.test(item.role || ''))
    .map((item) => ({
      ...item,
      id: item.id,
      name: credentialNameFromStaff(item),
      status: item.is_active === false ? 'Off Duty' : 'Available',
      area: 'Bay Area',
      credentialStatus: item.is_active === false ? 'Review' : 'Clear',
      nurseys: { status: item.is_active === false ? 'Review' : 'Clear', state: 'CA', checkedAt: '2026-05-23T09:00:00Z' },
    }));
  const seen = new Set();
  const roster = [...nurses, ...staffNurses]
    .filter((item) => {
      const key = credentialSlug(item.name || credentialNameFromStaff(item));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => normalizeCredentialNurse(item));
  const shifts = [
    ...requests.map((item) => normalizeCredentialShift(item, clients, services)),
    ...appointments.map((item) => normalizeCredentialShift(item, clients, services)),
  ].filter(Boolean).map((shift) => {
    const eligible = roster.filter((nurse) => nurse.clear && credentialAreaMatch(nurse, shift));
    const blocked = roster.filter((nurse) => !nurse.clear);
    return {
      ...shift,
      eligible,
      blocked,
      coverageStatus: eligible.length ? 'Covered' : 'Blocked',
      risk: eligible.length ? 'ready' : 'critical',
    };
  });
  const queue = readNurseysCredentialQueue();
  const clear = roster.filter((item) => item.clear);
  const blocked = roster.filter((item) => item.hardBlock);
  const expiring = roster.filter((item) => item.expiring || /expiring/i.test(item.status));
  const stale = roster.filter((item) => item.stale);
  const stageSummaries = CREDENTIAL_CONTROL_STAGES.map((stage) => {
    const count = {
      license: roster.length,
      scope: roster.filter((item) => item.state === 'CA').length,
      status: blocked.length,
      shift: shifts.filter((item) => item.needsNurse).length,
      kit: roster.filter((item) => item.kitStatus !== 'Ready').length,
      route: shifts.filter((item) => item.coverageStatus === 'Covered').length,
      text: queue.filter((item) => item.status !== 'Clear').length,
      audit: queue.length + readNurseCredentialOverrides().length,
    }[stage.key] || 0;
    return { ...stage, count };
  });

  return {
    roster,
    shifts,
    queue,
    stageSummaries,
    hardBlocks: CREDENTIAL_HARD_BLOCKS,
    scopeRules: CREDENTIAL_SCOPE_RULES,
    contract: NURSEYS_CREDENTIAL_PLACEHOLDER,
    metrics: {
      roster: roster.length,
      clear: clear.length,
      blocked: blocked.length,
      expiring: expiring.length,
      stale: stale.length,
      queue: queue.filter((item) => item.status !== 'Clear').length,
      openShifts: shifts.filter((item) => item.needsNurse).length,
      uncovered: shifts.filter((item) => !item.eligible.length).length,
    },
  };
}

export function runCredentialControlSweep({
  nurses = [],
  staff = [],
  requests = [],
  appointments = [],
  clients = [],
  services = [],
} = {}) {
  const tower = buildCredentialControlTower({ nurses, staff, requests, appointments, clients, services });
  const actions = [];
  tower.roster.forEach((nurse) => {
    if (!nurse.hardBlock && !nurse.expiring) return;
    const entry = queueNurseysCredentialCheck(nurse, {
      reason: nurse.reasons.join(', ') || 'Routine credential refresh.',
    });
    actions.push({ type: 'nurseys', id: entry.id });
  });
  tower.shifts.filter((shift) => !shift.eligible.length).forEach((shift) => {
    upsertCommunicationAlert({
      id: `alert-credential-shift-${shift.id}`,
      kind: 'credential',
      title: `No clear RN: ${shift.client}`,
      body: `${shift.service} in ${shift.city}. Block non-clear nurses until Nurseys returns Clear.`,
      priority: 'critical',
      status: 'open',
      audience: ['admin', 'ops'],
      channels: ['in_app', 'sms'],
      source: 'Credential Control',
      linkedEntityType: 'shift',
      linkedEntityId: shift.id,
      actionLabel: 'Credential gate',
    });
    actions.push({ type: 'shift-block', id: shift.id });
  });
  sendOpsMessage({
    threadId: 'nurses',
    audience: 'Credentialing',
    from: 'Credential Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `credential-sweep-${Date.now()}`,
    text: `Credential sweep complete: ${actions.length} local action${actions.length === 1 ? '' : 's'} queued. Nurseys remains placeholder until credentials are connected.`,
  });
  appendActivity('Credential control sweep complete', { role: 'credentialing', actions: actions.length });
  return { actions, tower: buildCredentialControlTower({ nurses, staff, requests, appointments, clients, services }) };
}

export const DISPATCH_CONTROL_STAGES = [
  { key: 'visit', label: 'Visit', owner: 'Acuity' },
  { key: 'gfe', label: 'GFE', owner: 'Clinical' },
  { key: 'credential', label: 'Credential', owner: 'Nurseys' },
  { key: 'broadcast', label: 'Broadcast', owner: 'Avalon' },
  { key: 'reply', label: 'Y/N', owner: 'Nurse' },
  { key: 'assign', label: 'Assign', owner: 'Dispatch' },
  { key: 'route', label: 'Route', owner: 'Maps' },
  { key: 'client', label: 'Client', owner: 'Text' },
];

export const DISPATCH_GUARDRAILS = [
  { label: 'Credential first', detail: 'Only clear, California-eligible nurses should receive claimable shifts.' },
  { label: 'GFE before service', detail: 'New-client GFE stays complete or actively routed before nurse execution.' },
  { label: 'Acuity source', detail: 'Scheduling and clinical record stay in Acuity; Avalon mirrors operations only.' },
  { label: 'Text proof', detail: 'Nurse acceptance queues client confirmation, route, and dispatch proof without PHI.' },
];

function normalizeDispatchShift(input = {}, clients = [], services = [], source = 'Avalon queue') {
  const status = input.status || 'Nurse Needed';
  if (/completed|cancelled/i.test(status)) return null;
  const client = input.client || financeClientName(input, clients);
  const service = input.therapy || services.find((item) => item.id === input.service_id)?.name || input.serviceName || input.service || input.plan || 'Avalon visit';
  const address = input.location || input.address || [input.location_address, input.location_city].filter(Boolean).join(', ') || input.city || 'Address pending';
  const city = input.location_city || input.city || inferBookingCity({ ...input, address });
  const id = input.id || input.reference || input.bookingId || `dispatch-${credentialSlug([client, service, input.time || input.scheduled_at].join('-'))}`;
  const datetime = input.scheduled_at || input.datetime || '';
  const slot = formatSlotDateTime(datetime);
  const assignedNurse = input.nurse || input.nurseName || input.provider || input.assignedNurse || '';
  return {
    id,
    bookingId: id,
    raw: input,
    source: input.source || source,
    client,
    clientPhone: input.phone || input.clientPhone || input.contact?.phone || '',
    service,
    date: input.date || slot.date || 'Date pending',
    time: input.time || slot.time || 'Time pending',
    address,
    city,
    status,
    gfe: input.gfe || input.gfeStatus || '',
    intake: input.intake || input.intakeStatus || '',
    payment: input.payment || input.depositStatus || '',
    assignedNurse,
    needsNurse: !assignedNurse || /nurse needed|new request|gfe pending|ready|confirmed|scheduled/i.test(status),
    shiftValue: Number(input.shiftValue || input.shiftPay || input.total || estimateShiftValue(input)),
    maps: {
      apple: appleMapsUrl(address),
      google: googleMapsUrl(address),
    },
  };
}

function dispatchBroadcastMatch(broadcasts = [], shift = {}) {
  return broadcasts.find((item) => (
    item.bookingId === shift.bookingId ||
    item.bookingId === shift.id ||
    item.id === bookingAssignmentId({ id: shift.id }) ||
    String(item.client || '').toLowerCase() === String(shift.client || '').toLowerCase()
  ));
}

function dispatchNurseMatch(roster = [], nurseName = '') {
  const needle = String(nurseName || '').toLowerCase();
  return roster.find((item) => String(item.name || '').toLowerCase() === needle);
}

function dispatchAreaMatch(nurse = {}, shift = {}) {
  return credentialAreaMatch(nurse, shift);
}

function trainingModulesForShift(shift = {}, modules = NURSE_TRAINING_MODULES) {
  const service = String(shift.service || shift.therapy || '').toLowerCase();
  const required = new Set(['iv-start-safety', 'emergency-response', 'acuity-closeout']);
  if (service.includes('nad')) required.add('nad-protocol-review');
  if (/myers|performance|glutathione|vip|magnesium|b-complex/.test(service)) required.add('myers-add-ons');
  if (/\bim\b|b12|shot|injection/.test(service)) required.add('im-shot-review');
  return modules.filter((module) => required.has(module.id));
}

function dispatchTrainingGate(nurse = {}, shift = {}, trainingTower = null) {
  const row = trainingTower?.nurseRows?.find((item) => (
    item.id === nurse.id ||
    String(item.nurseName || '').toLowerCase() === String(nurse.name || '').toLowerCase()
  ));
  const required = trainingModulesForShift(shift);
  const modules = required.map((module) => {
    const reviewed = row?.modules?.find((item) => item.id === module.id);
    return reviewed || { ...module, status: 'Due', tone: 'action' };
  });
  const blocked = modules.filter((module) => module.status === 'Expired');
  const due = modules.filter((module) => module.status !== 'Clear');
  return {
    ready: !blocked.length,
    status: blocked.length ? 'Blocked' : due.length ? 'Review' : 'Clear',
    blocked,
    due,
    required: modules,
    nextAction: blocked.length ? 'Complete expired protocol review.' : due.length ? 'Review before claim.' : 'Training clear.',
  };
}

export function buildDispatchControlTower({
  requests = [],
  appointments = [],
  clients = [],
  services = [],
  nurses = [],
  staff = [],
} = {}) {
  const credentialTower = buildCredentialControlTower({ nurses, staff, requests, appointments, clients, services });
  const roster = credentialTower.roster;
  const trainingTower = buildTrainingControlTower({ nurses: roster });
  const broadcasts = readAssignmentBroadcasts();
  const replies = readShiftReplies();
  const seed = [
    ...requests.map((item) => normalizeDispatchShift(item, clients, services, 'Request queue')),
    ...appointments.map((item) => normalizeDispatchShift(item, clients, services, 'Acuity mirror')),
  ].filter(Boolean);
  const seen = new Set();
  const shifts = seed
    .filter((item) => {
      if (seen.has(item.bookingId)) return false;
      seen.add(item.bookingId);
      return true;
    })
    .map((shift) => {
      const broadcast = dispatchBroadcastMatch(broadcasts, shift);
      const rosterWithTraining = roster.map((nurse) => ({
        ...nurse,
        trainingGate: dispatchTrainingGate(nurse, shift, trainingTower),
      }));
      const eligible = rosterWithTraining.filter((nurse) => nurse.clear && dispatchAreaMatch(nurse, shift) && nurse.trainingGate.ready);
      const trainingWarnings = rosterWithTraining.filter((nurse) => nurse.clear && dispatchAreaMatch(nurse, shift) && nurse.trainingGate.due.length);
      const passed = replies.filter((reply) => reply.bookingId === shift.bookingId || reply.broadcastId === broadcast?.id);
      const accepted = passed.find((reply) => reply.status === 'Accepted');
      const assigned = Boolean(shift.assignedNurse || broadcast?.status === 'Assigned' || accepted);
      const assignedTo = shift.assignedNurse || broadcast?.assignedTo || accepted?.nurseName || '';
      return {
        ...shift,
        broadcast,
        broadcastStatus: broadcast?.status || 'Not broadcast',
        eligible,
        trainingRequired: trainingModulesForShift(shift).map((item) => item.title),
        trainingWarnings,
        passed,
        assigned,
        assignedTo,
        routeReady: assigned,
        clientTextQueued: readOpsMessages().some((message) => message.relatedBroadcastId === `${broadcast?.id}-nurse-confirmed`),
        risk: assigned ? 'ready' : eligible.length ? (trainingWarnings.length ? 'action' : 'ready') : 'critical',
        nextAction: assigned ? 'Route and text.' : eligible.length ? (trainingWarnings.length ? 'Broadcast with protocol review warning.' : 'Broadcast now.') : 'Clear nurse credential or training.',
      };
    });
  const activeBroadcasts = broadcasts.filter((item) => item.status !== 'Assigned');
  const assignedBroadcasts = broadcasts.filter((item) => item.status === 'Assigned');
  const stageSummaries = DISPATCH_CONTROL_STAGES.map((stage) => {
    const count = {
      visit: shifts.length,
      gfe: shifts.filter((item) => /pending|required/i.test(item.gfe || item.status)).length,
      credential: roster.filter((item) => item.clear).length,
      broadcast: activeBroadcasts.length,
      reply: replies.length,
      assign: shifts.filter((item) => item.assigned).length,
      route: shifts.filter((item) => item.routeReady).length,
      client: shifts.filter((item) => item.clientTextQueued).length,
    }[stage.key] || 0;
    return { ...stage, count };
  });

  return {
    shifts,
    broadcasts,
    activeBroadcasts,
    assignedBroadcasts,
    replies,
    roster,
    trainingTower,
    stageSummaries,
    guardrails: DISPATCH_GUARDRAILS,
    settings: readNurseAlertSettings(),
    metrics: {
      open: shifts.filter((item) => !item.assigned).length,
      broadcasting: activeBroadcasts.length,
      assigned: shifts.filter((item) => item.assigned).length,
      noClearRn: shifts.filter((item) => !item.assigned && !item.eligible.length).length,
      trainingGaps: shifts.reduce((sum, item) => sum + (item.trainingWarnings?.length || 0), 0),
      replies: replies.length,
      clientTexts: readOpsMessages().filter((message) => message.threadId === 'client-texts').length,
    },
  };
}

export function queueDispatchBroadcast(shift = {}, options = {}) {
  const broadcast = createAssignmentBroadcast({
    id: shift.bookingId || shift.id,
    source: shift.source || 'Dispatch Control',
    contact: {
      name: shift.client,
      phone: shift.clientPhone,
    },
    service: shift.service,
    date: shift.date,
    time: shift.time,
    address: shift.address,
    city: shift.city,
    status: shift.status,
    gfe: shift.gfe,
    payment: shift.payment,
    shiftValue: shift.shiftValue,
  }, { source: options.source || 'Dispatch Control', shiftValue: shift.shiftValue });
  if (broadcast) {
    appendActivity(`Dispatch broadcast queued for ${broadcast.client}`, { role: 'dispatch', bookingId: broadcast.bookingId });
  }
  return broadcast;
}

export function acceptDispatchBroadcast(broadcastId, nurseName = 'Assigned nurse', roster = []) {
  const nurse = dispatchNurseMatch(roster, nurseName);
  if (nurse && !nurse.clear) {
    queueNurseysCredentialCheck(nurse, { reason: `Tried to accept ${broadcastId} without clear credential.` });
    upsertCommunicationAlert({
      id: `alert-dispatch-block-${broadcastId}-${credentialSlug(nurseName)}`,
      kind: 'credential',
      title: `Blocked accept: ${nurseName}`,
      body: 'Shift acceptance blocked until Nurseys returns Clear.',
      priority: 'critical',
      status: 'open',
      audience: ['admin', 'ops'],
      channels: ['in_app'],
      source: 'Dispatch Control',
      linkedEntityType: 'broadcast',
      linkedEntityId: broadcastId,
      actionLabel: 'Credential gate',
    });
    appendActivity(`Dispatch accept blocked for ${nurseName}`, { role: 'dispatch', broadcastId });
    return { ok: false, broadcasts: readAssignmentBroadcasts(), reason: 'Credential blocked' };
  }
  if (nurse?.trainingGate && !nurse.trainingGate.ready) {
    upsertCommunicationAlert({
      id: `alert-dispatch-training-block-${broadcastId}-${credentialSlug(nurseName)}`,
      kind: 'training',
      title: `Blocked accept: ${nurseName}`,
      body: `${nurse.trainingGate.blocked.map((item) => item.title).join(', ')} review expired.`,
      priority: 'critical',
      status: 'open',
      audience: ['admin', 'ops', 'clinical'],
      channels: ['in_app'],
      source: 'Dispatch Control',
      linkedEntityType: 'broadcast',
      linkedEntityId: broadcastId,
      actionLabel: 'Training gate',
    });
    appendActivity(`Dispatch accept blocked by training for ${nurseName}`, { role: 'dispatch', broadcastId });
    return { ok: false, broadcasts: readAssignmentBroadcasts(), reason: 'Training blocked' };
  }
  const broadcasts = acceptShiftBroadcast(broadcastId, nurseName);
  return { ok: true, broadcasts };
}

export function declineDispatchBroadcast(broadcastId, nurseName = 'Nurse') {
  const broadcasts = declineShiftBroadcast(broadcastId, nurseName);
  return { ok: true, broadcasts };
}

export function runDispatchControlSweep({
  requests = [],
  appointments = [],
  clients = [],
  services = [],
  nurses = [],
  staff = [],
} = {}) {
  const tower = buildDispatchControlTower({ requests, appointments, clients, services, nurses, staff });
  const actions = [];
  tower.shifts.forEach((shift) => {
    if (shift.assigned || shift.broadcast?.status === 'Broadcasting') return;
    if (!shift.eligible.length) {
      upsertCommunicationAlert({
        id: `alert-dispatch-no-rn-${shift.bookingId}`,
        kind: 'dispatch',
        title: `No clear RN: ${shift.client}`,
        body: `${shift.service} · ${shift.city}. Clear credentials before broadcasting.`,
        priority: 'critical',
        status: 'open',
        audience: ['admin', 'ops'],
        channels: ['in_app', 'sms'],
        source: 'Dispatch Control',
        linkedEntityType: 'shift',
        linkedEntityId: shift.bookingId,
        actionLabel: 'Clear RN',
      });
      actions.push({ type: 'blocked', id: shift.bookingId });
      return;
    }
    const broadcast = queueDispatchBroadcast(shift, { source: 'Dispatch sweep' });
    if (broadcast) actions.push({ type: 'broadcast', id: broadcast.id });
  });
  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Dispatch',
    from: 'Dispatch Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `dispatch-sweep-${Date.now()}`,
    text: `Dispatch sweep complete: ${actions.length} action${actions.length === 1 ? '' : 's'} queued.`,
  });
  appendActivity('Dispatch control sweep complete', { role: 'dispatch', actions: actions.length });
  return { actions, tower: buildDispatchControlTower({ requests, appointments, clients, services, nurses, staff }) };
}

export const FIELD_VISIT_STAGES = [
  { key: 'assigned', label: 'Assigned', owner: 'Dispatch' },
  { key: 'eta', label: 'ETA', owner: 'Text' },
  { key: 'route', label: 'Route', owner: 'Maps' },
  { key: 'arrived', label: 'Arrived', owner: 'RN' },
  { key: 'start', label: 'Start', owner: 'RN' },
  { key: 'closeout', label: 'Closeout', owner: 'Acuity' },
  { key: 'payroll', label: 'Payroll', owner: 'Gusto' },
  { key: 'followup', label: 'Follow-up', owner: 'Attio' },
];

export const FIELD_VISIT_GUARDRAILS = [
  { label: 'Acuity is the chart', detail: 'Avalon tracks field state and proof only. Clinical record stays in Acuity.' },
  { label: 'Text is operational', detail: 'ETA, arrival, and completion texts never include clinical notes, meds, vitals, or GFE content.' },
  { label: 'Closeout blocks completion', detail: 'Local completion requires an Acuity-ready closeout packet and RN attestation.' },
  { label: 'Incident lane', detail: 'Adverse-event notes are routed to clinical/admin review and excluded from CRM/finance payloads.' },
];

const FIELD_CLOSEOUT_SAMPLE = {
  identityVerified: true,
  consentVerified: true,
  gfeVerified: true,
  allergiesReviewed: true,
  medicationsReviewed: true,
  preBp: '120/80',
  preHr: '72',
  preSpo2: '99',
  postBp: '118/78',
  postHr: '74',
  postSpo2: '99',
  routeSite: 'IV site assessed',
  lotOrKitId: 'KIT-LOCAL',
  expirationChecked: true,
  adverseEvent: 'None',
  dischargeCondition: 'Stable',
  nurseSignature: 'RN local preview',
  attestation: true,
  acuityEntered: true,
};

function staffNameFromId(staff = [], id = '') {
  const person = staff.find((item) => item.id === id);
  return person ? credentialNameFromStaff(person) : '';
}

function serviceNameFromId(services = [], id = '') {
  return services.find((item) => item.id === id)?.name || '';
}

function normalizeFieldVisit(input = {}, clients = [], services = [], staff = [], source = 'Field queue') {
  const status = input.status || 'Assigned';
  if (/cancelled/i.test(status)) return null;
  const client = input.client || financeClientName(input, clients);
  const service = input.therapy || input.service || input.serviceName || serviceNameFromId(services, input.service_id) || 'Avalon visit';
  const nurseName = input.nurse || input.nurseName || input.assignedTo || input.assignedNurse || staffNameFromId(staff, input.nurse_id) || 'Assigned nurse';
  const address = input.location || input.address || [input.location_address, input.location_city].filter(Boolean).join(', ') || input.city || 'Address pending';
  const city = input.location_city || input.city || inferBookingCity({ ...input, address });
  const datetime = input.scheduled_at || input.datetime || '';
  const slot = formatSlotDateTime(datetime);
  const id = input.id || input.bookingId || input.reference || `field-${credentialSlug([client, service, datetime || input.date || input.time].join('-'))}`;
  const fieldStatus = readFieldVisitStatus()[id]?.status || readLocal(`visitStatus.${id}`, '') || (/completed/i.test(status) ? 'Completed' : /progress/i.test(status) ? 'In Progress' : 'Assigned');
  const closeout = readFieldCloseoutForVisit(id);
  const textProof = readFieldTextProof(id);
  const incident = readClinicalIncidents().find((item) => item.visitId === id || item.clientName === client);
  return {
    id,
    bookingId: id,
    source: input.source || source,
    client,
    clientId: input.client_id || input.clientId || '',
    clientPhone: input.phone || input.clientPhone || input.contact?.phone || '',
    service,
    serviceId: input.service_id || '',
    nurseName,
    nurseId: input.nurse_id || '',
    date: input.date || slot.date || 'Date pending',
    time: input.time || slot.time || 'Time pending',
    address,
    city,
    status: fieldStatus,
    rawStatus: status,
    shiftValue: Number(input.shiftValue || input.shiftPay || input.total || estimateShiftValue(input)),
    maps: {
      apple: appleMapsUrl(address),
      google: googleMapsUrl(address),
    },
    eta: readFieldVisitStatus()[id]?.eta || '20 min',
    closeout,
    closeoutDone: Boolean(closeout?.status === 'Complete' || /entered in acuity/i.test(closeout?.acuityStatus || '')),
    textProof,
    incident,
    incidentFlagged: Boolean(incident),
  };
}

export function readFieldVisitStatus() {
  return readLocal('fieldVisitStatus', {});
}

export function setFieldVisitStatus(visitId, status, patch = {}) {
  const current = readFieldVisitStatus();
  const now = new Date().toISOString();
  const nextEntry = {
    ...(current[visitId] || {}),
    ...patch,
    status,
    updatedAt: now,
  };
  writeLocal('fieldVisitStatus', { ...current, [visitId]: nextEntry });
  writeLocal(`visitStatus.${visitId}`, status);
  appendActivity(`Field visit ${status}: ${visitId}`, { role: patch.actor || 'field', visitId });
  return nextEntry;
}

export function readClinicalIncidents() {
  return readLocal('clinicalIncidents', []);
}

function readFieldCloseoutForVisit(visitId) {
  return readLocal('acuityCloseoutPackets', []).find((item) => item.appointmentId === visitId || item.id === visitId)
    || readLocal(`acuityCloseoutPacket.${visitId}`, null);
}

function readFieldTextProof(visitId) {
  return readOpsMessages().filter((message) => (
    message.threadId === 'client-texts' &&
    String(message.relatedBroadcastId || '').includes(visitId)
  ));
}

export function queueFieldVisitText(visit = {}, type = 'eta', options = {}) {
  const templates = {
    eta: `Avalon: ${visit.nurseName || 'Your RN'} confirmed ETA ${options.eta || visit.eta || '20 min'}. Please keep your phone nearby.`,
    arrival: `Avalon: ${visit.nurseName || 'your RN'} has arrived. Please have ID ready.`,
    start: 'Avalon: your visit has started.',
    complete: 'Avalon: your visit is complete. Hydrate and message us if you need anything.',
  };
  const text = options.text || templates[type] || templates.eta;
  const relatedBroadcastId = `field-${visit.id || visit.bookingId}-${type}`;
  const existing = readOpsMessages().find((message) => message.relatedBroadcastId === relatedBroadcastId);
  if (existing && !options.force) return existing;
  const next = sendOpsMessage({
    threadId: 'client-texts',
    audience: visit.clientPhone || 'Client phone pending',
    from: 'Avalon Client Text',
    role: 'client-text',
    status: 'Queued',
    channels: ['sms'],
    relatedBroadcastId,
    text,
  });
  appendActivity(`Field text queued: ${type} · ${visit.client || visit.id}`, { role: 'field', visitId: visit.id, type });
  return next[0];
}

function routeVisitIdFromBooking(booking = {}) {
  return booking?.id || booking?.bookingId || booking?.reference || '';
}

function statusRanksRouteStep(status = '') {
  const value = String(status || '').toLowerCase();
  if (/completed|complete/.test(value)) return 4;
  if (/in progress|started|post_visit/.test(value)) return 3;
  if (/arrived/.test(value)) return 2;
  if (/en route|confirmed eta|route/.test(value)) return 1;
  return 0;
}

function latestFieldRouteEntry() {
  const entries = Object.entries(readFieldVisitStatus());
  if (!entries.length) return null;
  return entries
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
}

export function buildClientRouteBridge({
  profile = readClientProfile(),
  latestBooking = readLastBooking(),
} = {}) {
  const fieldStatus = readFieldVisitStatus();
  const bookingId = routeVisitIdFromBooking(latestBooking);
  const statusEntry = (bookingId && fieldStatus[bookingId]) ? { id: bookingId, ...fieldStatus[bookingId] } : latestFieldRouteEntry();
  const broadcasts = readAssignmentBroadcasts();
  const broadcast = broadcasts.find((item) => (
    item.bookingId === statusEntry?.id ||
    item.id === statusEntry?.id ||
    item.bookingId === bookingId ||
    item.id === bookingId
  )) || broadcasts.find((item) => item.status === 'Assigned');
  const id = statusEntry?.id || bookingId || broadcast?.bookingId || broadcast?.id || 'route-pending';
  const nurseName = statusEntry?.nurseName || statusEntry?.actor || latestBooking?.nurse || broadcast?.assignedTo || 'RN pending';
  const status = statusEntry?.status || latestBooking?.status || (broadcast?.status === 'Assigned' ? 'Nurse Assigned' : 'Pending');
  const eta = statusEntry?.eta || latestBooking?.eta || '';
  const clientName = statusEntry?.client || latestBooking?.contact?.name || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || broadcast?.client || 'Client';
  const address = statusEntry?.address || latestBooking?.address || broadcast?.address || '';
  const service = statusEntry?.service || latestBooking?.service || broadcast?.service || 'Avalon visit';
  const rank = statusRanksRouteStep(status);
  const texts = readOpsMessages().filter((message) => (
    message.threadId === 'client-texts' &&
    (String(message.relatedBroadcastId || '').includes(id) || /ETA|arrived|visit has started|visit is complete/i.test(message.text || ''))
  ));

  const etaLabel = eta || 'Nurse sets ETA after confirmation';
  return {
    id,
    clientName,
    service,
    nurseName,
    status,
    eta: etaLabel,
    headline: eta ? 'Nurse-confirmed ETA' : 'ETA Pending',
    body: eta
      ? `${nurseName} set this ETA after confirming the route.`
      : 'Your RN sets the ETA after accepting and confirming the route.',
    address,
    maps: {
      apple: address ? appleMapsUrl(address) : '',
      google: address ? googleMapsUrl(address) : '',
    },
    lastUpdate: statusEntry?.updatedAt || latestBooking?.updatedAt || broadcast?.acceptedAt || '',
    texts,
    steps: [
      { key: 'assigned', label: 'Nurse', done: Boolean(nurseName && nurseName !== 'RN pending'), detail: nurseName },
      { key: 'eta', label: 'ETA', done: rank >= 1 || Boolean(eta), detail: etaLabel },
      { key: 'arrived', label: 'Arrived', done: rank >= 2, detail: rank >= 2 ? 'On site' : 'Pending' },
      { key: 'started', label: 'Started', done: rank >= 3, detail: rank >= 3 ? 'Active' : 'Pending' },
      { key: 'done', label: 'Done', done: rank >= 4, detail: rank >= 4 ? 'Complete' : 'Pending' },
    ],
  };
}

export function queueClientRouteBridgeUpdate({
  visitId,
  status = 'En Route',
  eta = '',
  nurseName = 'Nurse',
  client = '',
  clientPhone = '',
  address = '',
  service = 'Avalon visit',
  source = 'Nurse Shift',
} = {}) {
  const id = visitId || routeVisitIdFromBooking(readLastBooking()) || `route-${Date.now()}`;
  const normalizedEta = /arrived/i.test(status) ? 'Arrived' : /completed|complete/i.test(status) ? 'Complete' : eta;
  const nextStatus = setFieldVisitStatus(id, status, {
    eta: normalizedEta,
    nurseName,
    actor: nurseName,
    client,
    clientPhone,
    address,
    service,
    source,
  });
  const textType = /arrived/i.test(status) ? 'arrival' : /in progress|started/i.test(status) ? 'start' : /completed|complete/i.test(status) ? 'complete' : 'eta';
  const visit = { id, client, clientPhone, nurseName, address, service, eta: normalizedEta };
  queueFieldVisitText(visit, textType, { force: true, eta: normalizedEta });

  const latest = readLastBooking();
  const latestId = routeVisitIdFromBooking(latest);
  if (latest && (!latestId || latestId === id)) {
    saveLastBooking({
      ...latest,
      status,
      eta: normalizedEta,
      nurse: nurseName,
      address: address || latest.address,
      service: service || latest.service,
      nextStep: /arrived/i.test(status)
        ? `${nurseName} has arrived.`
        : /completed|complete/i.test(status)
          ? 'Visit complete. Aftercare follows.'
          : `${nurseName} controls ETA and route updates.`,
    });
  }
  appendActivity(`Client route update: ${status} · ${id}`, { role: 'nurse', visitId: id, source });
  return { status: nextStatus, bridge: buildClientRouteBridge() };
}

export const NURSE_CLIENT_CONTACT_TEMPLATES = [
  {
    id: 'access',
    label: 'Access',
    text: 'Avalon: your RN needs gate, parking, or lobby details before arrival. Reply here if anything changed.',
  },
  {
    id: 'arrival',
    label: 'Outside',
    text: 'Avalon: your RN is outside or in the lobby. Please have ID ready.',
  },
  {
    id: 'delay',
    label: 'Delay',
    text: 'Avalon: your RN is running a few minutes behind and will update the ETA as needed.',
  },
  {
    id: 'ready',
    label: 'Ready',
    text: 'Avalon: your RN is ready to begin after ID, consent, and clinical clearance are confirmed.',
  },
];

export function queueNurseClientContact({
  visitId,
  templateId = 'access',
  text = '',
  nurseName = 'Your RN',
  client = 'Client',
  clientPhone = '',
  source = 'Nurse Shift',
} = {}) {
  const template = NURSE_CLIENT_CONTACT_TEMPLATES.find((item) => item.id === templateId) || NURSE_CLIENT_CONTACT_TEMPLATES[0];
  const messageText = String(text || template.text || '').trim();
  if (!messageText) return { messages: readOpsMessages(), supportThread: readSupportThread() };
  const id = `nurse-client-${visitId || Date.now()}-${template.id}-${Date.now()}`;
  const now = new Date().toISOString();

  const supportThread = readSupportThread();
  const nextSupport = [...supportThread, {
    id,
    from: 'nurse',
    text: messageText,
    at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    createdAt: now,
    nurseName,
    visitId,
  }].slice(-24);
  writeLocal('supportThread', nextSupport);

  const messages = sendOpsMessage({
    threadId: 'client-texts',
    audience: clientPhone || client,
    from: nurseName,
    role: 'nurse-client-text',
    status: 'Queued',
    channels: ['chat', 'sms'],
    relatedBroadcastId: id,
    text: messageText,
  });
  appendActivity(`Nurse client contact: ${template.label} · ${client}`, {
    role: 'nurse',
    visitId,
    source,
    phiExcluded: true,
  });
  return { messages, supportThread: nextSupport };
}

export function completeFieldVisit(visit = {}, options = {}) {
  const draft = saveAcuityCloseoutDraft(visit.id, {
    ...FIELD_CLOSEOUT_SAMPLE,
    ...(options.closeout || {}),
    nurseSignature: options.nurseName || visit.nurseName || FIELD_CLOSEOUT_SAMPLE.nurseSignature,
  });
  const verdict = evaluateAcuityCloseout(draft);
  if (!verdict.complete) {
    upsertCommunicationAlert({
      id: `alert-field-closeout-${visit.id}`,
      kind: 'acuity',
      title: `Closeout incomplete: ${visit.client}`,
      body: verdict.summary,
      priority: 'action',
      status: 'open',
      audience: ['admin', 'provider'],
      channels: ['in_app'],
      source: 'Field Control',
      linkedEntityType: 'visit',
      linkedEntityId: visit.id,
      actionLabel: 'Finish closeout',
    });
    return { ok: false, verdict };
  }
  const packet = saveAcuityCloseoutPacket(buildAcuityCloseoutPacket({
    appointment: { id: visit.id, client_id: visit.clientId, service_id: visit.serviceId },
    client: { id: visit.clientId, name: visit.client },
    service: { id: visit.serviceId, name: visit.service },
    closeout: draft,
    note: options.note || 'Field closeout proof queued. Clinical record belongs in Acuity.',
    nurseName: options.nurseName || visit.nurseName,
    completedAt: new Date().toISOString(),
  }));
  setFieldVisitStatus(visit.id, 'Completed', { actor: options.nurseName || visit.nurseName, closeoutId: packet.id });
  queueFieldVisitText(visit, 'complete');
  queueGustoPayrollProof({
    visitId: visit.id,
    nurseName: options.nurseName || visit.nurseName,
    service: visit.service,
    shiftValue: visit.shiftValue,
    chartStatus: packet.acuityStatus,
    completedAt: packet.completedAt,
  });
  if (packet.eventFlagged) {
    const incidents = readClinicalIncidents();
    const incident = {
      id: `incident-${visit.id}-${Date.now()}`,
      visitId: visit.id,
      clientName: visit.client,
      service: visit.service,
      summary: packet.adverseEvent,
      sourceOfRecord: 'Acuity',
      status: 'Needs review',
      createdAt: new Date().toISOString(),
    };
    writeLocal('clinicalIncidents', [incident, ...incidents.filter((item) => item.visitId !== visit.id)].slice(0, 80));
    upsertCommunicationAlert({
      id: `alert-${incident.id}`,
      kind: 'incident',
      title: `Clinical review: ${visit.client}`,
      body: 'Adverse-event detail is held in the clinical lane. Exclude from CRM and finance.',
      priority: 'critical',
      status: 'open',
      audience: ['admin', 'clinical'],
      channels: ['in_app', 'sms'],
      source: 'Field Control',
      linkedEntityType: 'incident',
      linkedEntityId: incident.id,
      actionLabel: 'Review',
    });
  }
  appendActivity(`Field visit completed: ${visit.client}`, { role: 'field', visitId: visit.id, sourceOfRecord: 'Acuity' });
  return { ok: true, packet };
}

export function buildFieldVisitControlTower({
  requests = [],
  appointments = [],
  clients = [],
  services = [],
  staff = [],
} = {}) {
  const assignedBroadcastVisits = readAssignmentBroadcasts()
    .filter((item) => item.status === 'Assigned')
    .map((item) => normalizeFieldVisit({
      id: item.bookingId || item.id,
      client: item.client,
      phone: item.clientPhone,
      service: item.service,
      date: item.date,
      time: item.time,
      location: item.address,
      city: item.city,
      nurse: item.assignedTo,
      shiftValue: item.shiftValue,
      status: 'Assigned',
      source: 'Dispatch broadcast',
    }, clients, services, staff, 'Dispatch broadcast'));
  const requestVisits = requests
    .filter((item) => item.nurse && !/cancelled/i.test(item.status || ''))
    .map((item) => normalizeFieldVisit(item, clients, services, staff, 'Request queue'));
  const appointmentVisits = appointments
    .filter((item) => item.nurse_id && !/cancelled/i.test(item.status || ''))
    .map((item) => normalizeFieldVisit(item, clients, services, staff, 'Acuity mirror'));
  const seen = new Set();
  const visits = [...assignedBroadcastVisits, ...requestVisits, ...appointmentVisits]
    .filter(Boolean)
    .filter((visit) => {
      if (seen.has(visit.id)) return false;
      seen.add(visit.id);
      return true;
    })
    .map((visit) => {
      const active = !/completed/i.test(visit.status);
      return {
        ...visit,
        active,
        risk: visit.incidentFlagged ? 'critical' : visit.closeoutDone || /completed/i.test(visit.status) ? 'ready' : /assigned|en route|arrived|in progress/i.test(visit.status) ? 'action' : 'default',
        nextAction: visit.closeoutDone ? 'Follow up.' : /in progress/i.test(visit.status) ? 'Finish Acuity closeout.' : /arrived/i.test(visit.status) ? 'Start visit.' : /en route/i.test(visit.status) ? 'Mark arrived.' : 'Send ETA.',
      };
    });
  const textMessages = readOpsMessages().filter((message) => message.threadId === 'client-texts');
  const payroll = readPayrollProofQueue();
  const incidents = readClinicalIncidents();
  const stageSummaries = FIELD_VISIT_STAGES.map((stage) => {
    const count = {
      assigned: visits.filter((item) => /assigned|en route|arrived|in progress|completed/i.test(item.status)).length,
      eta: visits.filter((item) => item.textProof.some((message) => /on the way|ETA/i.test(message.text || ''))).length,
      route: visits.filter((item) => item.address && item.address !== 'Address pending').length,
      arrived: visits.filter((item) => /arrived|in progress|completed/i.test(item.status)).length,
      start: visits.filter((item) => /in progress|completed/i.test(item.status)).length,
      closeout: visits.filter((item) => item.closeoutDone).length,
      payroll: payroll.length,
      followup: textMessages.filter((message) => /complete|follow/i.test(message.text || '')).length,
    }[stage.key] || 0;
    return { ...stage, count };
  });

  return {
    visits,
    activeVisits: visits.filter((item) => item.active),
    completedVisits: visits.filter((item) => !item.active || item.closeoutDone),
    textMessages,
    payroll,
    incidents,
    stageSummaries,
    guardrails: FIELD_VISIT_GUARDRAILS,
    metrics: {
      assigned: visits.filter((item) => /assigned/i.test(item.status)).length,
      enRoute: visits.filter((item) => /en route/i.test(item.status)).length,
      arrived: visits.filter((item) => /arrived/i.test(item.status)).length,
      inProgress: visits.filter((item) => /in progress/i.test(item.status)).length,
      closeout: visits.filter((item) => item.closeoutDone).length,
      incidents: incidents.length,
    },
  };
}

export function runFieldVisitControlSweep({
  requests = [],
  appointments = [],
  clients = [],
  services = [],
  staff = [],
} = {}) {
  const tower = buildFieldVisitControlTower({ requests, appointments, clients, services, staff });
  const actions = [];
  tower.activeVisits.forEach((visit) => {
    if (!visit.textProof.some((message) => /ETA|on the way/i.test(message.text || ''))) {
      queueFieldVisitText(visit, 'eta');
      actions.push({ type: 'eta', id: visit.id });
    }
    if (!visit.closeoutDone && /completed/i.test(visit.rawStatus || '')) {
      upsertCommunicationAlert({
        id: `alert-field-missing-closeout-${visit.id}`,
        kind: 'acuity',
        title: `Acuity closeout missing: ${visit.client}`,
        body: 'Visit appears completed, but local Acuity closeout proof is not present.',
        priority: 'action',
        status: 'open',
        audience: ['admin', 'provider'],
        channels: ['in_app'],
        source: 'Field Control',
        linkedEntityType: 'visit',
        linkedEntityId: visit.id,
        actionLabel: 'Closeout',
      });
      actions.push({ type: 'closeout', id: visit.id });
    }
  });
  sendOpsMessage({
    threadId: 'dispatch',
    audience: 'Field Ops',
    from: 'Field Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `field-sweep-${Date.now()}`,
    text: `Field sweep complete: ${actions.length} local action${actions.length === 1 ? '' : 's'} queued.`,
  });
  appendActivity('Field visit sweep complete', { role: 'field', actions: actions.length });
  return { actions, tower: buildFieldVisitControlTower({ requests, appointments, clients, services, staff }) };
}

export const KIT_CONTROL_STAGES = [
  { key: 'ready', label: 'Ready', owner: 'Inventory' },
  { key: 'nurse', label: 'Nurse', owner: 'Dispatch' },
  { key: 'cold', label: 'Cold', owner: 'RN' },
  { key: 'expiry', label: 'Expiry', owner: 'Ops' },
  { key: 'deduct', label: 'Deduct', owner: 'Field' },
  { key: 'restock', label: 'Restock', owner: 'Supply' },
  { key: 'emergency', label: 'Emergency', owner: 'Clinical' },
  { key: 'audit', label: 'Audit', owner: 'Avalon' },
];

export const KIT_GUARDRAILS = [
  { label: 'Kit before claim', detail: 'Nurses with restock or unknown kits should not receive high-value or event shifts.' },
  { label: 'Expiry before use', detail: 'Expired or near-expiry medications are flagged before dispatch and before closeout.' },
  { label: 'Cold-chain proof', detail: 'Refrigerated items need local proof until a temperature integration exists.' },
  { label: 'Deduct after closeout', detail: 'Visit deductions happen after field closeout proof, not before service.' },
];

function itemQuantity(item = {}) {
  return Number(item.qty ?? item.quantity ?? item.count ?? 0);
}

function itemMinLevel(item = {}) {
  return Number(item.minLevel ?? item.minimum ?? item.reorderPoint ?? 0);
}

function itemDaysUntilExpiry(item = {}) {
  if (!item.expirationDate) return null;
  const date = new Date(item.expirationDate);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function normalizeInventoryItem(item = {}) {
  const qty = itemQuantity(item);
  const minLevel = itemMinLevel(item);
  const days = itemDaysUntilExpiry(item);
  const expired = days !== null && days < 0;
  const expiring = days !== null && days <= 30 && days >= 0;
  const low = qty <= minLevel;
  const critical = expired || qty <= Math.max(1, Math.floor(minLevel / 2));
  return {
    ...item,
    id: item.id || item.sku || `item-${credentialSlug(item.name)}`,
    name: item.name || 'Inventory item',
    sku: item.sku || item.sortlyId || '',
    qty,
    minLevel,
    unit: item.unit || 'units',
    status: expired ? 'Expired' : critical ? 'Critical' : low ? 'Low Stock' : expiring ? 'Check Expiry' : item.status || 'Ready',
    expired,
    expiring,
    low,
    critical,
    daysUntilExpiry: days,
    refrigerated: Boolean(item.refrigeration || item.refrigerated),
    risk: expired || critical ? 'critical' : low || expiring ? 'action' : 'ready',
  };
}

function defaultKitManifest() {
  return [
    { match: 'IV Bag', par: 4, min: 2 },
    { match: 'IV Start Kit', par: 4, min: 2 },
    { match: 'IV Extension', par: 4, min: 2 },
    { match: 'B-Complex', par: 3, min: 1 },
    { match: 'Magnesium', par: 2, min: 1 },
    { match: 'Glutathione', par: 2, min: 1 },
    { match: 'NAD+', par: 1, min: 1 },
    { match: 'B12', par: 2, min: 1 },
    { match: 'IM Syringe', par: 4, min: 2 },
    { match: 'Nitrile Gloves', par: 2, min: 1 },
    { match: 'Sharps Container', par: 1, min: 1 },
    { match: 'Epinephrine', par: 1, min: 1 },
    { match: 'Digital BP Cuff', par: 1, min: 1 },
    { match: 'Pulse Oximeter', par: 1, min: 1 },
  ];
}

function buildNurseKitInventory(nurse = {}, items = [], ledger = []) {
  const manifest = defaultKitManifest();
  const nurseName = nurse.name || 'Nurse';
  const nurseLedger = ledger.filter((entry) => (
    String(entry.nurseName || '').toLowerCase() === String(nurseName).toLowerCase()
  ));
  return manifest.map((need) => {
    const item = items.find((entry) => entry.name.toLowerCase().includes(need.match.toLowerCase()));
    const consumed = nurseLedger.reduce((sum, entry) => (
      sum + (entry.lines || []).reduce((lineSum, line) => {
        const matches = (item?.id && line.itemId === item.id)
          || String(line.match || '').toLowerCase() === need.match.toLowerCase()
          || String(line.name || '').toLowerCase().includes(need.match.toLowerCase());
        return lineSum + (matches ? Number(line.qty || 0) : 0);
      }, 0)
    ), 0);
    const remaining = Math.max(0, Number(need.par || 0) - consumed);
    const short = remaining < Number(need.min || 0);
    return {
      itemId: item?.id || `kit-${credentialSlug(need.match)}`,
      name: item?.name || need.match,
      match: need.match,
      par: Number(need.par || 0),
      min: Number(need.min || 0),
      remaining,
      consumed,
      centralAvailable: item?.qty ?? 0,
      unit: item?.unit || 'units',
      status: short ? 'Restock' : 'Ready',
      risk: short ? 'action' : 'ready',
      refrigerated: Boolean(item?.refrigerated),
    };
  });
}

function buildNurseKit(nurse = {}, items = [], ledger = []) {
  const assignedItems = items.filter((item) => (
    String(item.assignedTo || '').toLowerCase() === String(nurse.name || '').toLowerCase()
  ));
  const kitInventory = buildNurseKitInventory(nurse, items, ledger);
  const missing = kitInventory.filter((item) => item.remaining < item.min);
  const risks = [
    ...assignedItems.filter((item) => item.risk !== 'ready').map((item) => item.name),
    ...(nurse.kitStatus !== 'Ready' ? [nurse.kitStatus || 'Kit review'] : []),
    ...missing.slice(0, 3).map((item) => `${item.match} low`),
  ].filter(Boolean);
  return {
    id: nurse.id || `kit-${credentialSlug(nurse.name)}`,
    nurseId: nurse.id || '',
    nurseName: nurse.name || 'Nurse',
    area: nurse.area || 'Bay Area',
    status: risks.length ? 'Hold' : 'Ready',
    kitStatus: nurse.kitStatus || (risks.length ? 'Review' : 'Ready'),
    assignedItems,
    kitInventory,
    missing,
    risks,
    visitsToday: Number(nurse.todayVisits || nurse.visitsToday || 0),
    phone: nurse.phone || '',
    risk: risks.length ? 'action' : 'ready',
  };
}

export function readKitRestockQueue() {
  return readLocal('kitRestockQueue', []);
}

export function queueKitRestock(item = {}, options = {}) {
  const normalized = normalizeInventoryItem(item);
  const id = options.id || `restock-${normalized.id}`;
  const current = readKitRestockQueue();
  const existing = current.find((entry) => entry.id === id);
  const now = new Date().toISOString();
  const nextEntry = {
    id,
    itemId: normalized.id,
    name: normalized.name,
    sku: normalized.sku,
    qty: normalized.qty,
    minLevel: normalized.minLevel,
    unit: normalized.unit,
    supplier: normalized.supplier || 'Supplier pending',
    reason: options.reason || normalized.status,
    status: existing?.status === 'Ordered' ? 'Ordered' : options.status || 'Queued',
    priority: normalized.critical || normalized.expired ? 'High' : 'Normal',
    type: options.type || 'central',
    nurseId: options.nurseId || '',
    nurseName: options.nurseName || '',
    kitId: options.kitId || '',
    replenishQty: options.replenishQty ?? null,
    phiExcluded: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    resolvedAt: existing?.resolvedAt || '',
    resolvedBy: existing?.resolvedBy || '',
  };
  writeLocal('kitRestockQueue', [nextEntry, ...current.filter((entry) => entry.id !== id)].slice(0, 120));
  upsertCommunicationAlert({
    id: `alert-${nextEntry.id}`,
    kind: 'inventory',
    title: `Restock: ${nextEntry.name}`,
    body: `${nextEntry.qty} ${nextEntry.unit} on hand. Min ${nextEntry.minLevel}. ${nextEntry.reason}.`,
    priority: nextEntry.priority === 'High' ? 'critical' : 'action',
    status: nextEntry.status === 'Ordered' ? 'resolved' : 'open',
    audience: ['admin', 'ops'],
    channels: ['in_app'],
    source: 'Kit Control',
    linkedEntityType: 'inventory',
    linkedEntityId: nextEntry.itemId,
    actionLabel: 'Restock',
  });
  appendActivity(`Restock queued: ${nextEntry.name}`, { role: 'inventory', itemId: nextEntry.itemId });
  return nextEntry;
}

export function queueNurseKitRestock(nurse = {}, kitLine = {}) {
  const id = `nurse-kit-restock-${nurse.id || credentialSlug(nurse.name)}-${kitLine.itemId || credentialSlug(kitLine.match)}`;
  return queueKitRestock({
    id: kitLine.itemId,
    name: kitLine.name || kitLine.match,
    sku: kitLine.itemId,
    qty: kitLine.remaining,
    minLevel: kitLine.min,
    unit: kitLine.unit,
    supplier: 'Central inventory',
    status: kitLine.status,
  }, {
    id,
    type: 'nurse-kit',
    nurseId: nurse.id || '',
    nurseName: nurse.nurseName || nurse.name || 'Nurse',
    kitId: nurse.id || '',
    replenishQty: Math.max(0, Number(kitLine.par || 0) - Number(kitLine.remaining || 0)),
    reason: `${nurse.nurseName || nurse.name || 'Nurse'} kit ${kitLine.match || kitLine.name} below par`,
  });
}

export function resolveKitRestock(entryId, actor = 'Kit Control') {
  const now = new Date().toISOString();
  let resolved = null;
  const next = readKitRestockQueue().map((entry) => {
    const matches = entry.id === entryId || entry.itemId === entryId;
    if (!matches) return entry;
    resolved = { ...entry, status: 'Ordered', resolvedBy: actor, resolvedAt: now, updatedAt: now };
    return resolved;
  });
  writeLocal('kitRestockQueue', next);
  if (resolved) {
    resolveCommunicationAlert(`alert-${resolved.id}`, actor);
    appendActivity(`Restock ordered: ${resolved.name}`, { role: actor, itemId: resolved.itemId });
  }
  return next;
}

export function readKitDeductionLedger() {
  return readLocal('kitDeductionLedger', []);
}

function buildVisitDeduction(visit = {}) {
  const service = String(visit.service || visit.therapy || '').toLowerCase();
  const base = [
    { match: 'IV Bag', qty: 1 },
    { match: 'IV Start Kit', qty: 1 },
    { match: 'IV Extension', qty: 1 },
    { match: 'Nitrile Gloves', qty: 1 },
  ];
  if (service.includes('nad')) base.push({ match: 'NAD+', qty: 1 });
  if (service.includes('myers') || service.includes('performance')) base.push({ match: 'B-Complex', qty: 1 }, { match: 'Magnesium', qty: 1 });
  if (service.includes('glutathione') || service.includes('vip')) base.push({ match: 'Glutathione', qty: 1 });
  if (service.includes('b12') || service.includes('im')) base.push({ match: 'B12', qty: 1 }, { match: 'IM Syringe', qty: 1 });
  if (service.includes('cbd')) base.push({ match: 'CBD', qty: 1 });
  return base;
}

function buildKitDeductionEntry(visit = {}, inventory = [], options = {}) {
  const visitId = visit.id || visit.visitId || visit.appointmentId || `visit-${Date.now()}`;
  const manifest = buildVisitDeduction(visit);
  const normalizedItems = inventory.map(normalizeInventoryItem);
  const lines = manifest.map((need) => {
    const item = normalizedItems.find((entry) => entry.name.toLowerCase().includes(need.match.toLowerCase()));
    return {
      match: need.match,
      qty: need.qty,
      itemId: item?.id || '',
      name: item?.name || need.match,
      available: item?.qty ?? 0,
      status: item && item.qty >= need.qty ? 'Ready' : 'Short',
    };
  });
  return {
    id: `deduct-${visitId}`,
    visitId,
    client: visit.client || visit.clientName || 'Client',
    service: visit.service || visit.therapy || 'Avalon visit',
    nurseName: visit.nurseName || visit.nurse || 'Nurse',
    status: lines.some((line) => line.status === 'Short') ? 'Short' : 'Ready',
    lines,
    createdAt: options.preview ? '' : new Date().toISOString(),
    phiExcluded: true,
    ...(options.preview ? { preview: true } : {}),
  };
}

export function queueKitDeduction(visit = {}, inventory = []) {
  const visitId = visit.id || visit.visitId || visit.appointmentId || `visit-${Date.now()}`;
  const entry = buildKitDeductionEntry(visit, inventory);
  const current = readKitDeductionLedger();
  writeLocal('kitDeductionLedger', [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 120));
  appendActivity(`Kit deduction queued: ${entry.service}`, { role: 'inventory', visitId });
  return entry;
}

function previewKitDeduction(visit = {}, inventory = []) {
  return buildKitDeductionEntry(visit, inventory, { preview: true });
}

function applyLedgerToInventory(inventory = [], ledger = []) {
  const totals = ledger.reduce((acc, entry) => {
    entry.lines?.forEach((line) => {
      if (!line.itemId) return;
      acc[line.itemId] = (acc[line.itemId] || 0) + Number(line.qty || 0);
    });
    return acc;
  }, {});
  return inventory.map((item) => {
    const normalized = normalizeInventoryItem(item);
    const used = totals[normalized.id] || 0;
    const qty = Math.max(0, normalized.qty - used);
    return normalizeInventoryItem({
      ...item,
      qty,
      quantity: qty,
      consumedByVisits: used,
      status: qty <= Math.max(1, Math.floor(normalized.minLevel / 2))
        ? 'Critical'
        : qty <= normalized.minLevel
          ? 'Low Stock'
          : normalized.status,
    });
  });
}

export function syncVisitKitUsage({
  inventory = [],
  visits = [],
  actor = 'Kit Control',
} = {}) {
  const current = readKitDeductionLedger();
  const currentByVisit = new Map(current.map((entry) => [entry.visitId, entry]));
  const nextEntries = [];
  const actions = [];
  visits.forEach((visit) => {
    const visitId = visit.id || visit.visitId || visit.appointmentId;
    if (!visitId || currentByVisit.has(visitId)) return;
    const entry = buildKitDeductionEntry(visit, inventory);
    nextEntries.push(entry);
    actions.push({ type: 'deduction', id: entry.id });
  });
  const ledger = [...nextEntries, ...current].slice(0, 240);
  if (nextEntries.length) {
    writeLocal('kitDeductionLedger', ledger);
    appendActivity(`Visit kit usage synced: ${nextEntries.length} visit${nextEntries.length === 1 ? '' : 's'}`, { role: actor });
  }
  const appliedInventory = applyLedgerToInventory(inventory, ledger);
  const currentSimulation = readLocal('inventorySimulation', null);
  if (JSON.stringify(currentSimulation) !== JSON.stringify(appliedInventory)) {
    writeLocal('inventorySimulation', appliedInventory);
  }
  return {
    actions,
    ledger,
    inventory: appliedInventory,
  };
}

export function buildKitControlTower({
  inventory = [],
  nurses = [],
  visits = [],
} = {}) {
  const savedSimulation = readLocal('inventorySimulation', null);
  const deductionLedger = readKitDeductionLedger();
  const projectedItems = applyLedgerToInventory(inventory, deductionLedger);
  const items = (savedSimulation || projectedItems).map(normalizeInventoryItem);
  const kits = nurses.map((nurse) => buildNurseKit(nurse, items, deductionLedger));
  const restockQueue = readKitRestockQueue();
  const cold = items.filter((item) => item.refrigerated);
  const low = items.filter((item) => item.low || item.critical);
  const expiring = items.filter((item) => item.expiring || item.expired);
  const emergency = items.filter((item) => /emergency|epi|diphenhydramine|zofran/i.test([item.category, item.name].join(' ')));
  const totalConsumed = deductionLedger.reduce((sum, entry) => (
    sum + (entry.lines || []).reduce((lineSum, line) => lineSum + Number(line.qty || 0), 0)
  ), 0);
  const stockImpact = items
    .filter((item) => Number(item.consumedByVisits || 0) > 0 || item.low || item.critical)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      consumed: Number(item.consumedByVisits || 0),
      remaining: item.qty,
      minLevel: item.minLevel,
      status: item.status,
      risk: item.risk,
    }))
    .sort((a, b) => b.consumed - a.consumed || a.remaining - b.remaining);
  const nurseKitLines = kits.flatMap((kit) => (
    kit.kitInventory.map((line) => ({
      ...line,
      nurseId: kit.nurseId,
      nurseName: kit.nurseName,
      kitStatus: kit.status,
    }))
  ));
  const nurseKitShort = nurseKitLines.filter((line) => line.risk !== 'ready');
  const stageSummaries = KIT_CONTROL_STAGES.map((stage) => {
    const count = {
      ready: items.filter((item) => item.risk === 'ready').length,
      nurse: kits.filter((kit) => kit.status === 'Ready').length,
      cold: cold.length,
      expiry: expiring.length,
      deduct: deductionLedger.length,
      restock: restockQueue.filter((item) => item.status !== 'Ordered').length,
      emergency: emergency.filter((item) => item.risk !== 'critical').length,
      audit: restockQueue.length + deductionLedger.length,
    }[stage.key] || 0;
    return { ...stage, count };
  });
  const visitNeeds = visits.map((visit) => ({
    visit,
    deduction: deductionLedger.find((entry) => entry.visitId === (visit.id || visit.visitId)) || previewKitDeduction(visit, items),
  }));
  return {
    items,
    kits,
    nurseKitLines,
    nurseKitShort,
    restockQueue,
    deductionLedger,
    cold,
    low,
    expiring,
    emergency,
    stockImpact,
    visitNeeds,
    stageSummaries,
    guardrails: KIT_GUARDRAILS,
    metrics: {
      readyItems: items.filter((item) => item.risk === 'ready').length,
      low: low.length,
      expiring: expiring.length,
      cold: cold.length,
      kitsReady: kits.filter((kit) => kit.status === 'Ready').length,
      nurseKitShort: nurseKitShort.length,
      restock: restockQueue.filter((item) => item.status !== 'Ordered').length,
      deductions: deductionLedger.length,
      visitsTracked: visitNeeds.length,
      consumed: totalConsumed,
      blockedKits: kits.filter((kit) => kit.status !== 'Ready').length,
    },
  };
}

export function runKitControlSweep({
  inventory = [],
  nurses = [],
  visits = [],
} = {}) {
  const synced = syncVisitKitUsage({ inventory, visits, actor: 'Kit Control' });
  const items = synced.inventory.map(normalizeInventoryItem);
  const actions = [];
  actions.push(...synced.actions);
  items.forEach((item) => {
    if (item.low || item.expiring || item.expired || item.critical) {
      const restock = queueKitRestock(item, { reason: item.status });
      actions.push({ type: 'restock', id: restock.id });
    }
  });
  nurses.forEach((nurse) => {
    if (nurse.kitStatus && nurse.kitStatus !== 'Ready') {
      upsertCommunicationAlert({
        id: `alert-kit-${nurse.id || credentialSlug(nurse.name)}`,
        kind: 'inventory',
        title: `Kit hold: ${nurse.name}`,
        body: `${nurse.kitStatus}. Confirm supplies before assigning high-value visits.`,
        priority: 'action',
        status: 'open',
        audience: ['admin', 'ops'],
        channels: ['in_app'],
        source: 'Kit Control',
        linkedEntityType: 'nurse',
        linkedEntityId: nurse.id,
        actionLabel: 'Kit check',
      });
      actions.push({ type: 'kit-hold', id: nurse.id || nurse.name });
    }
  });
  sendOpsMessage({
    threadId: 'nurses',
    audience: 'Inventory',
    from: 'Kit Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `kit-sweep-${Date.now()}`,
    text: `Kit sweep complete: ${actions.length} local action${actions.length === 1 ? '' : 's'} queued.`,
  });
  appendActivity('Kit control sweep complete', { role: 'inventory', actions: actions.length });
  return { actions, tower: buildKitControlTower({ inventory, nurses, visits }) };
}

export const NURSE_TRAINING_MODULES = [
  {
    id: 'iv-start-safety',
    title: 'IV Start Safety',
    category: 'Core',
    cadenceDays: 90,
    minutes: 8,
    requiredFor: ['IV Bag', 'IV Start Kit', 'IV Extension'],
    summary: 'Sterile setup, vein selection, site checks, and escalation rules.',
  },
  {
    id: 'nad-protocol-review',
    title: 'NAD+ Protocol Review',
    category: 'Protocol',
    cadenceDays: 60,
    minutes: 6,
    requiredFor: ['NAD+'],
    summary: 'Duration expectations, rate tolerance, and when to pause or escalate.',
  },
  {
    id: 'myers-add-ons',
    title: 'Myers + Add-Ons',
    category: 'Protocol',
    cadenceDays: 90,
    minutes: 5,
    requiredFor: ['B-Complex', 'Magnesium', 'Glutathione'],
    summary: 'Add-on checks, compatibility reminders, and standing-order review.',
  },
  {
    id: 'im-shot-review',
    title: 'IM Shot Review',
    category: 'Protocol',
    cadenceDays: 120,
    minutes: 4,
    requiredFor: ['B12', 'IM Syringe'],
    summary: 'Site selection, administration reminders, and aftercare language.',
  },
  {
    id: 'emergency-response',
    title: 'Emergency Response',
    category: 'Safety',
    cadenceDays: 30,
    minutes: 7,
    requiredFor: ['Epinephrine', 'Diphenhydramine'],
    summary: 'Adverse event recognition, emergency protocol, and handoff script.',
  },
  {
    id: 'acuity-closeout',
    title: 'Acuity Closeout',
    category: 'Charting',
    cadenceDays: 30,
    minutes: 5,
    requiredFor: ['Closeout'],
    summary: 'Thin compliant charting, Acuity proof, and no-PHI ops notes.',
  },
];

export function readTrainingReviews() {
  return readLocal('nurseTrainingReviews', []);
}

export function markTrainingReview(nurse = {}, module = {}, actor = 'Training Control') {
  const nurseId = nurse.id || nurse.nurseId || credentialSlug(nurse.name || nurse.nurseName || 'nurse');
  const moduleId = module.id || module.moduleId;
  const entry = {
    id: `training-${nurseId}-${moduleId}`,
    nurseId,
    nurseName: nurse.name || nurse.nurseName || 'Nurse',
    moduleId,
    title: module.title || module.label || 'Training module',
    category: module.category || 'Protocol',
    reviewedAt: new Date().toISOString(),
    reviewedBy: actor,
    phiExcluded: true,
  };
  const current = readTrainingReviews();
  writeLocal('nurseTrainingReviews', [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 300));
  appendActivity(`Training reviewed: ${entry.nurseName} · ${entry.title}`, { role: actor, nurseId, moduleId });
  return entry;
}

function trainingReviewStatus(nurse = {}, module = {}, reviews = []) {
  const nurseId = nurse.id || nurse.nurseId || credentialSlug(nurse.name || nurse.nurseName || 'nurse');
  const review = reviews.find((item) => item.nurseId === nurseId && item.moduleId === module.id);
  if (!review?.reviewedAt) {
    return { status: 'Due', tone: 'action', review: null, daysLeft: 0 };
  }
  const ageDays = Math.floor((Date.now() - new Date(review.reviewedAt).getTime()) / 86400000);
  const daysLeft = Number(module.cadenceDays || 30) - ageDays;
  if (daysLeft < 0) return { status: 'Expired', tone: 'critical', review, daysLeft };
  if (daysLeft <= 7) return { status: 'Due Soon', tone: 'action', review, daysLeft };
  return { status: 'Clear', tone: 'ready', review, daysLeft };
}

export function buildTrainingControlTower({
  nurses = [],
  modules = NURSE_TRAINING_MODULES,
} = {}) {
  const reviews = readTrainingReviews();
  const nurseRows = nurses.map((nurse) => {
    const modulesForNurse = modules.map((module) => ({
      ...module,
      ...trainingReviewStatus(nurse, module, reviews),
    }));
    const due = modulesForNurse.filter((item) => item.status !== 'Clear');
    const critical = modulesForNurse.filter((item) => item.status === 'Expired');
    return {
      id: nurse.id || credentialSlug(nurse.name),
      nurse,
      nurseName: nurse.name || 'Nurse',
      area: nurse.area || 'Bay Area',
      status: critical.length ? 'Blocked' : due.length ? 'Review' : 'Clear',
      tone: critical.length ? 'critical' : due.length ? 'action' : 'ready',
      modules: modulesForNurse,
      due,
      critical,
      clearCount: modulesForNurse.filter((item) => item.status === 'Clear').length,
    };
  });
  const moduleRows = modules.map((module) => {
    const perNurse = nurses.map((nurse) => ({
      nurse,
      nurseName: nurse.name || 'Nurse',
      ...trainingReviewStatus(nurse, module, reviews),
    }));
    return {
      ...module,
      clear: perNurse.filter((item) => item.status === 'Clear').length,
      due: perNurse.filter((item) => item.status !== 'Clear').length,
      expired: perNurse.filter((item) => item.status === 'Expired').length,
      perNurse,
    };
  });
  return {
    modules,
    reviews,
    nurseRows,
    moduleRows,
    guardrails: [
      'Protocol review gates high-risk protocols before assignment.',
      'Emergency refreshers stay monthly until medical leadership changes cadence.',
      'Training records are operational proof only; Acuity remains the clinical source of record.',
      'No PHI belongs in training notes.',
    ],
    metrics: {
      nurses: nurseRows.length,
      clear: nurseRows.filter((item) => item.status === 'Clear').length,
      review: nurseRows.filter((item) => item.status === 'Review').length,
      blocked: nurseRows.filter((item) => item.status === 'Blocked').length,
      due: nurseRows.reduce((sum, item) => sum + item.due.length, 0),
      modules: modules.length,
    },
  };
}

export function runTrainingControlSweep({ nurses = [], modules = NURSE_TRAINING_MODULES } = {}) {
  const tower = buildTrainingControlTower({ nurses, modules });
  const actions = [];
  tower.nurseRows.forEach((row) => {
    row.due.forEach((module) => {
      upsertCommunicationAlert({
        id: `alert-training-${row.id}-${module.id}`,
        kind: 'training',
        title: `Training due: ${row.nurseName}`,
        body: `${module.title}. ${module.summary}`,
        priority: module.status === 'Expired' ? 'critical' : 'action',
        status: 'open',
        audience: ['admin', 'ops', 'clinical'],
        channels: ['in_app'],
        source: 'Training Control',
        linkedEntityType: 'nurse',
        linkedEntityId: row.id,
        actionLabel: 'Review',
      });
      actions.push({ type: 'training', nurseId: row.id, moduleId: module.id });
    });
  });
  sendOpsMessage({
    threadId: 'nurses',
    audience: 'Training',
    from: 'Training Control',
    role: 'system',
    status: 'Complete',
    channels: ['chat'],
    relatedBroadcastId: `training-sweep-${Date.now()}`,
    text: `Training sweep complete: ${actions.length} review${actions.length === 1 ? '' : 's'} due.`,
  });
  appendActivity('Training control sweep complete', { role: 'training', actions: actions.length });
  return { actions, tower: buildTrainingControlTower({ nurses, modules }) };
}

const DEFAULT_EVENT_PRESALE_EVENTS = [
  {
    id: 'sf-launch-night',
    name: 'SF Launch Night',
    slug: 'festival-recovery-presale',
    headline: 'Festival Recovery Presale',
    description: 'Timed IV and IM recovery reservations for launch guests, sponsors, and partner lists.',
    partner: 'Avalon',
    venue: 'San Francisco, CA',
    date: 'Jun 12, 2026',
    window: '4:00 PM - 9:00 PM',
    service: 'Event Recovery IV',
    codePrefix: 'AV-LAUNCH',
    capacity: 48,
    source: 'Avalon presale',
    publicMode: 'ticketed',
    publishStatus: 'Published',
    presaleEnabled: true,
    leadCaptureEnabled: true,
    ticketSystem: true,
    acuityAppointmentTypeID: '',
    acuityStatus: 'Manual Acuity handoff',
    gfeLeadDays: 7,
    gfeTiming: 'Before event arrival',
    ticketTiers: [
      { name: 'Hydration Pass', price: '$149', detail: 'Timed event IV reservation.' },
      { name: 'Recovery Plus', price: '$225', detail: 'IV reservation with IM boost option.' },
      { name: 'VIP Block', price: 'Custom', detail: 'Reserved windows for groups or sponsors.' },
    ],
    slots: ['4:00 PM', '4:20 PM', '4:40 PM', '5:00 PM', '5:20 PM', '5:40 PM', '6:00 PM', '6:20 PM', '6:40 PM', '7:00 PM', '7:20 PM', '7:40 PM'],
  },
  {
    id: 'secret-party',
    name: 'Secret Party Recovery Bar',
    slug: 'secret-party-recovery-bar',
    headline: 'Secret Party Recovery Bar',
    description: 'Partner-ticket recovery bar with QR credentialing and pre-event clearance.',
    partner: 'Secret Party',
    venue: 'Private venue',
    date: 'Jul 18, 2026',
    window: '8:00 PM - 1:00 AM',
    service: 'Hydration + IM Boost',
    codePrefix: 'SP-IV',
    capacity: 36,
    source: 'Partner ticket',
    publicMode: 'presale',
    publishStatus: 'Private Link',
    presaleEnabled: true,
    leadCaptureEnabled: false,
    ticketSystem: false,
    acuityAppointmentTypeID: '',
    acuityStatus: 'Manual Acuity handoff',
    gfeLeadDays: 7,
    gfeTiming: 'Before event arrival',
    ticketTiers: [],
    slots: ['8:00 PM', '8:20 PM', '8:40 PM', '9:00 PM', '9:20 PM', '9:40 PM', '10:00 PM', '10:20 PM', '10:40 PM', '11:00 PM'],
  },
  {
    id: 'event-partner',
    name: 'Partner Event Presale',
    slug: 'partner-event-presale',
    headline: 'Partner Event Presale',
    description: 'External event presale ingress for partner tickets and guest list imports.',
    partner: 'External vendor',
    venue: 'Bay Area event',
    date: 'Date pending',
    window: 'Event window',
    service: 'Presold Avalon Service',
    codePrefix: 'PARTNER',
    capacity: 60,
    source: 'Partner import',
    publicMode: 'presale',
    publishStatus: 'Draft',
    presaleEnabled: true,
    leadCaptureEnabled: true,
    ticketSystem: false,
    acuityAppointmentTypeID: '',
    acuityStatus: 'Manual Acuity handoff',
    gfeLeadDays: 7,
    gfeTiming: 'Before event arrival',
    ticketTiers: [],
    slots: ['First available', 'Early event', 'Mid event', 'Late event'],
  },
];

function slugify(value = '') {
  return String(value || 'event')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || `event-${Date.now()}`;
}

function normalizePresaleEvent(event = {}) {
  return {
    id: event.id || `event-${Date.now()}`,
    name: event.name || 'Untitled Event',
    slug: slugify(event.slug || event.name || event.id),
    headline: event.headline || event.name || 'Untitled Event',
    description: event.description || 'Avalon event recovery experience.',
    partner: event.partner || 'Avalon',
    venue: event.venue || 'Venue pending',
    date: event.date || 'Date pending',
    window: event.window || 'Window pending',
    service: event.service || 'Avalon event service',
    codePrefix: event.codePrefix || 'AV',
    capacity: Number(event.capacity || 0),
    source: event.source || 'Avalon presale',
    publicMode: event.publicMode || 'presale',
    publishStatus: event.publishStatus || 'Draft',
    presaleEnabled: event.presaleEnabled !== false,
    leadCaptureEnabled: event.leadCaptureEnabled !== false,
    ticketSystem: Boolean(event.ticketSystem),
    acuityAppointmentTypeID: event.acuityAppointmentTypeID || event.appointmentTypeID || '',
    acuityStatus: event.acuityStatus || 'Manual Acuity handoff',
    gfeLeadDays: Math.max(1, Number(event.gfeLeadDays || 7)),
    gfeTiming: event.gfeTiming || 'Before event arrival',
    ticketTiers: Array.isArray(event.ticketTiers) ? event.ticketTiers : [],
    slots: Array.isArray(event.slots) && event.slots.length ? event.slots : ['First available'],
    updatedAt: event.updatedAt || new Date().toISOString(),
  };
}

export function readEventPresales() {
  const saved = readLocal('eventPresales', null);
  if (saved?.events?.length) {
    return {
      events: saved.events.map(normalizePresaleEvent),
      codes: Array.isArray(saved.codes) ? saved.codes : [],
      redemptions: Array.isArray(saved.redemptions) ? saved.redemptions : [],
    };
  }
  const seed = {
    events: DEFAULT_EVENT_PRESALE_EVENTS.map(normalizePresaleEvent),
    codes: [],
    redemptions: [],
  };
  writeLocal('eventPresales', seed);
  return seed;
}

export function saveEventPresales(nextState = {}) {
  const current = readEventPresales();
  const next = {
    events: (nextState.events || current.events).map(normalizePresaleEvent),
    codes: Array.isArray(nextState.codes) ? nextState.codes : current.codes,
    redemptions: Array.isArray(nextState.redemptions) ? nextState.redemptions : current.redemptions,
    updatedAt: new Date().toISOString(),
  };
  writeLocal('eventPresales', next);
  return next;
}

export function saveEventPresale(event = {}) {
  const current = readEventPresales();
  const item = normalizePresaleEvent({ ...event, updatedAt: new Date().toISOString() });
  const events = [item, ...current.events.filter((existing) => existing.id !== item.id)];
  const next = saveEventPresales({ ...current, events });
  appendActivity(`Event presale updated: ${item.name}`, { role: 'ops', eventId: item.id });
  return next;
}

export function generatePresaleCodes(eventId, count = 10, options = {}) {
  const current = readEventPresales();
  const event = current.events.find((item) => item.id === eventId) || current.events[0];
  if (!event) return current;
  const amount = Math.min(100, Math.max(1, Number(count || 1)));
  const existingCodes = new Set(current.codes.map((code) => code.code));
  const created = Array.from({ length: amount }, (_, index) => {
    let code = `${event.codePrefix}-${String(current.codes.length + index + 1).padStart(3, '0')}`;
    while (existingCodes.has(code)) code = `${event.codePrefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    existingCodes.add(code);
    return {
      id: `code-${Date.now()}-${index}`,
      eventId: event.id,
      code,
      source: options.source || event.source || 'Avalon presale',
      status: 'Available',
      partnerRef: options.partnerRef || '',
      createdAt: new Date().toISOString(),
    };
  });
  const next = saveEventPresales({ ...current, codes: [...created, ...current.codes] });
  appendActivity(`Generated ${created.length} presale codes for ${event.name}`, { role: 'ops', eventId: event.id });
  return next;
}

export function acceptExternalPresale(payload = {}) {
  const current = readEventPresales();
  const event = current.events.find((item) => item.id === payload.eventId) || current.events[0];
  if (!event) return current;
  const code = String(payload.code || `${event.codePrefix}-${String(Date.now()).slice(-5)}`).trim().toUpperCase();
  const item = {
    id: `external-${Date.now()}`,
    eventId: event.id,
    code,
    source: payload.source || 'Partner import',
    status: 'Imported',
    partnerRef: payload.partnerRef || payload.ticketId || '',
    clientName: payload.clientName || '',
    clientEmail: payload.clientEmail || '',
    clientPhone: payload.clientPhone || '',
    createdAt: new Date().toISOString(),
  };
  const codes = [item, ...current.codes.filter((existing) => existing.code !== code)];
  const next = saveEventPresales({ ...current, codes });
  appendActivity(`Partner presale imported for ${event.name}`, { role: 'ops', eventId: event.id, code });
  return next;
}

export function redeemPresaleCode({ eventId, code, client = {}, selectedTime = '', intakeStatus = 'GFE intake pending', source = '' } = {}) {
  const current = readEventPresales();
  const normalizedCode = String(code || '').trim().toUpperCase();
  const event = current.events.find((item) => item.id === eventId) || current.events[0];
  if (!event || !normalizedCode) {
    return { ok: false, error: 'Choose an event and enter a presale code.', state: current };
  }

  const codeItem = current.codes.find((item) => item.code === normalizedCode)
    || {
      id: `walkup-${Date.now()}`,
      eventId: event.id,
      code: normalizedCode,
      source: source || 'Special link',
      status: 'Imported',
      createdAt: new Date().toISOString(),
    };

  if (codeItem.status === 'Redeemed') {
    const existing = current.redemptions.find((item) => item.code === normalizedCode);
    return { ok: false, error: 'This presale code has already been redeemed.', state: current, redemption: existing };
  }

  const redemption = {
    id: `redemption-${Date.now()}`,
    eventId: event.id,
    eventName: event.name,
    code: normalizedCode,
    source: source || codeItem.source || event.source,
    partnerRef: codeItem.partnerRef || '',
    client: {
      name: client.name || 'Guest',
      email: client.email || '',
      phone: client.phone || '',
    },
    selectedTime: selectedTime || event.slots[0] || 'First available',
    service: event.service,
    venue: event.venue,
    date: event.date,
    intakeStatus,
    scheduleStatus: event.acuityAppointmentTypeID ? 'Queued for Acuity' : event.acuityStatus || 'Manual Acuity handoff',
    gfeStatus: 'Pre-event GFE queued',
    acuityAppointmentTypeID: event.acuityAppointmentTypeID || '',
    credential: `AV-${normalizedCode.replace(/[^A-Z0-9]/g, '').slice(-8)}`,
    qrPayload: `avalon://event/${event.id}/${normalizedCode}`,
    createdAt: new Date().toISOString(),
  };

  const codes = [
    { ...codeItem, eventId: event.id, status: 'Redeemed', redeemedAt: redemption.createdAt, clientName: redemption.client.name },
    ...current.codes.filter((item) => item.code !== normalizedCode),
  ];
  const redemptions = [redemption, ...current.redemptions.filter((item) => item.code !== normalizedCode)];
  const state = saveEventPresales({ ...current, codes, redemptions });
  appendActivity(`Event presale redeemed: ${event.name} · ${redemption.client.name}`, {
    role: 'client',
    eventId: event.id,
    code: normalizedCode,
  });
  routeGfeForBooking({
    id: redemption.id,
    reference: redemption.credential,
    source: 'Event presale',
    service: redemption.service,
    plan: event.name,
    date: redemption.date,
    time: redemption.selectedTime,
    address: redemption.venue,
    city: inferBookingCity({ address: redemption.venue }),
    locationType: 'event',
    guests: 1,
    status: 'GFE Pending',
    intake: /complete|cleared/i.test(intakeStatus) ? 'Done' : 'Pending',
    consent: 'Pending',
    gfe: 'Pending',
    gfeRequired: true,
    contact: {
      name: redemption.client.name,
      email: redemption.client.email,
      phone: redemption.client.phone,
    },
  });
  sendOpsMessage({
    threadId: 'events',
    audience: 'Events team',
    from: 'Event Presale',
    role: 'system',
    channels: ['chat', 'email'],
    text: `${redemption.client.name} redeemed ${event.name} for ${redemption.selectedTime}. Acuity: ${redemption.scheduleStatus}. GFE: ${redemption.gfeStatus}.`,
  });
  upsertCommunicationAlert({
    id: `alert-event-${redemption.id}`,
    kind: 'event',
    title: `Event presale: ${event.name}`,
    body: `${redemption.client.name} redeemed ${redemption.selectedTime}. Queue Acuity and pre-event GFE before arrival.`,
    priority: 'action',
    status: 'open',
    audience: ['admin', 'provider', 'events'],
    channels: ['in_app', 'email'],
    source: 'Event Presale',
    linkedEntityType: 'event',
    linkedEntityId: event.id,
    actionLabel: 'Review presale',
  });
  return { ok: true, state, redemption };
}

export function buildPresaleSummary(state = readEventPresales()) {
  return state.events.map((event) => {
    const codes = state.codes.filter((code) => code.eventId === event.id);
    const redemptions = state.redemptions.filter((item) => item.eventId === event.id);
    return {
      ...event,
      generated: codes.length,
      available: codes.filter((code) => code.status !== 'Redeemed').length,
      redeemed: redemptions.length,
      gfePending: redemptions.filter((item) => !/complete|cleared/i.test(item.intakeStatus || '')).length,
      remaining: Math.max(0, Number(event.capacity || 0) - redemptions.length),
    };
  });
}

export function buildProductJsonLd({ category, categorySlug, product, slug, price }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.desc || category.description,
    image: product.image ? `https://www.avalonvitality.co${product.image}` : undefined,
    brand: { '@type': 'Brand', name: 'Avalon Vitality' },
    category: category.categoryLabel,
    url: `https://www.avalonvitality.co/products/${categorySlug || 'iv-vitamins'}/${slug}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: String(price || '').replace(/[^0-9.]/g, ''),
      availability: 'https://schema.org/InStock',
    },
  };
}

const DEMO_BOOKING = {
  id: 'DEMO-CLIENT001',
  service: 'Myers Cocktail',
  protocolKey: 'myers',
  doseKey: 'myers',
  date: 'May 23, 2026',
  time: '2:00 PM',
  datetime: '2026-05-23T21:00:00.000Z',
  timezone: 'America/Los_Angeles',
  address: 'Client address pending',
  zip: '94107',
  city: 'San Francisco',
  locationType: 'Home',
  guests: 1,
  notes: 'Prefers a slower drip rate. Ring unit buzzer on arrival.',
  contact: {
    firstName: 'Preview',
    lastName: 'Client',
    name: 'Preview Client',
    email: 'preview@avalon.local',
    phone: '(415) 980-7708',
  },
  addOns: ['Glutathione Push', 'IM · B12'],
  items: [
    { cartKey: 'myers', label: 'Myers Cocktail', price: 250, type: 'iv' },
    { cartKey: 'glutathione', label: 'Glutathione Push', price: 50, type: 'iv-addon' },
    { cartKey: 'b12-shot', label: 'IM · B12', price: 25, type: 'im' },
  ],
  subtotal: 325,
  status: 'Confirmed',
  nextStep: 'RN assignment and visit prep',
  intake: 'Done',
  consent: 'Done',
  gfe: 'Cleared',
  nurse: 'Stephanie R.',
  payment: 'Pending',
  source: 'Website',
  reference: 'DEMO-CLIENT001',
};

const DEMO_SUPPORT = [
  { id: 'welcome', from: 'care', text: 'Care team standing by for Acuity scheduling, prep, and visit questions.', at: 'Today' },
  { id: 'prep', from: 'care', text: 'Your visit is confirmed. Hydrate, keep ID nearby, and keep your phone available for RN ETA.', at: 'Today' },
];

export function seedDemoState(username = 'CLIENT001') {
  const key = String(username || 'CLIENT001').toUpperCase();
  const roleBooking = {
    ...DEMO_BOOKING,
    id: key === 'ADMIN001' ? 'DEMO-ADMIN001' : key === 'NURSE001' ? 'DEMO-NURSE001' : DEMO_BOOKING.id,
    status: key === 'ADMIN001' ? 'Scheduling received' : DEMO_BOOKING.status,
    gfe: key === 'ADMIN001' ? 'Pending' : DEMO_BOOKING.gfe,
    nurse: key === 'ADMIN001' ? 'Unassigned' : DEMO_BOOKING.nurse,
    nextStep: key === 'ADMIN001' ? 'Clinical review and RN assignment' : DEMO_BOOKING.nextStep,
    seededFor: key,
    updatedAt: new Date().toISOString(),
  };

  saveLastBooking(roleBooking);
  writeLocal('visitPrep', [
    { key: 'hydrate', label: 'Drink 16 oz of water', done: true },
    { key: 'id', label: 'Have ID ready', done: false },
    { key: 'sleeves', label: 'Wear loose sleeves', done: false },
    { key: 'phone', label: 'Keep phone nearby for RN ETA', done: false },
  ]);
  writeLocal('savedAddresses', [
    { id: 'demo-home', label: 'Home', address: roleBooking.address, note: 'Default visit location' },
    { id: 'demo-office', label: 'Office', address: '1 Ferry Building, San Francisco, CA', note: 'Weekday afternoon option' },
  ]);
  writeLocal('supportThread', DEMO_SUPPORT);
  writeLocal('visitStatus.a1', key === 'NURSE001' ? 'in_progress' : 'confirmed');
  writeLocal('demoSeed', { username: key, seededAt: new Date().toISOString(), bookingId: roleBooking.id });

  appendActivity(
    key === 'ADMIN001'
      ? 'Demo admin state loaded with latest booking handoff'
      : key === 'NURSE001'
        ? 'Demo nurse state loaded with active shift'
        : 'Demo client state loaded with confirmed booking',
    { role: key.toLowerCase(), bookingId: roleBooking.id }
  );

  return roleBooking;
}
