import { readLocal, writeLocal, appendActivity, readLastBooking, saveLastBooking } from './localOs';
import { transitionBooking } from './bookingLifecycle';

export const DEFAULT_PREP_CHECKLIST = [
  { key: 'hydrate', label: 'Drink 16 oz of water', done: false },
  { key: 'id', label: 'Have ID ready', done: false },
  { key: 'sleeves', label: 'Wear loose sleeves', done: false },
  { key: 'phone', label: 'Keep phone nearby for RN ETA', done: false },
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
  const cleared = booking.gfe === 'Cleared' || ['Confirmed', 'Cleared', 'Nurse Assigned', 'Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed', 'Follow-Up Due'].includes(booking.status);
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
  return readLocal('savedAddresses', [
    { id: 'home', label: 'Home', address: '123 Main St, San Francisco, CA', note: 'Default visit location' },
    { id: 'office', label: 'Office', address: 'Downtown SF', note: 'Weekday afternoon option' },
  ]);
}

export function saveAddress(address) {
  const current = readSavedAddresses();
  const next = [{ id: `addr-${Date.now()}`, ...address }, ...current].slice(0, 6);
  writeLocal('savedAddresses', next);
  appendActivity(`Saved address: ${address.label}`, { role: 'client' });
  return next;
}

export function readSupportThread() {
  return readLocal('supportThread', [
    { id: 'welcome', from: 'care', text: 'Care team standing by for scheduling, prep, and visit questions.', at: 'Today' },
  ]);
}

export function sendSupportMessage(text, from = 'client') {
  const message = { id: `msg-${Date.now()}`, from, text, at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
  const next = [...readSupportThread(), message].slice(-20);
  writeLocal('supportThread', next);
  appendActivity(`Support message sent: ${text.slice(0, 48)}`, { role: from });
  return next;
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

export function buildProductJsonLd({ category, categorySlug, product, slug, price }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.desc || category.description,
    image: product.image ? `https://avalonvitality.co${product.image}` : undefined,
    brand: { '@type': 'Brand', name: 'Avalon Vitality' },
    category: category.categoryLabel,
    url: `https://avalonvitality.co/products/${categorySlug || 'iv-vitamins'}/${slug}`,
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
  address: '188 King St, Apt 2205, San Francisco, CA',
  zip: '94107',
  city: 'San Francisco',
  locationType: 'Home',
  guests: 1,
  notes: 'Prefers a slower drip rate. Ring unit buzzer on arrival.',
  contact: {
    firstName: 'Sarah',
    lastName: 'Avalon',
    name: 'Sarah Avalon',
    email: 'sarah@avalonvitality.co',
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
  { id: 'welcome', from: 'care', text: 'Care team standing by for scheduling, prep, and visit questions.', at: 'Today' },
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
