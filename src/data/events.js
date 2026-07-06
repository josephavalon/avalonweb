const VISIT_STORAGE_KEY = 'avalon.events.demo.visits.v1';

export const events = [
  {
    slug: 'festival-recovery-presale',
    title: 'Vital Ice Recovery House',
    eyebrow: 'Members first',
    date: 'Sat Aug 15, 2026',
    dateYear: '2026',
    dateDisplay: 'Sat Aug 15, 2026',
    time: '4:00 PM - 9:00 PM',
    neighborhood: 'Pacific Heights',
    location: 'Pacific Heights, San Francisco',
    venue: 'Address revealed after reserve',
    exactAddress: 'Pacific Heights private residence',
    priceFrom: 149,
    status: 'Members first',
    state: 'member_first',
    attendees: ['Maya', 'Alex', 'Jordan', 'Priya', 'Noah', 'Sam'],
    attendeeCount: 14,
    hostName: 'Avalon Vitality',
    hostRole: 'Event recovery host',
    clinicalLead: 'Kara Liu, NP-C',
    clinicalRole: 'Clinical lead',
    capacity: '48 IV appointments',
    cover: '/recovery-lounge-hero.jpg',
    gallery: ['/recovery-lounge-hero.jpg', '/images/avalon-static-back-1024.jpg', '/backgrounds/iv-vitamins-hero.webp'],
    description:
      'A dusk recovery lounge built around timed IV appointments, compression chairs, cold towels, and a quiet concierge health check before arrival.',
    vibe: 'Airbnb-level trust, Luma-speed reserve, Avalon clinical oversight.',
    memberCopy: 'Your access is open. Public opens in 2d 4h.',
    tiers: [
      {
        id: 'hydration',
        name: 'Hydration Appointment',
        price: 149,
        state: 'Open',
        serviceType: 'iv',
        detail: 'IV hydration appointment, lounge access, wallet credential, and pre-event health check.',
      },
      {
        id: 'recovery-plus',
        name: 'Recovery Plus',
        price: 225,
        state: 'Members first',
        serviceType: 'iv',
        detail: 'Hydration appointment with glutathione option, compression lounge, and priority arrival window.',
      },
      {
        id: 'experience',
        name: 'Experience Only',
        price: 35,
        state: 'Open',
        serviceType: 'experience_only',
        detail: 'Lounge access, hydration bar, compression chair queue, and photo drop.',
      },
    ],
    included: [
      'Clinician-reviewed health check before arrival',
      'Timed IV hydration appointments for eligible guests',
      'Compression lounge, electrolyte bar, and concierge check-in',
      'Wallet pass with QR, status, and arrival window',
    ],
    goodToKnow: [
      'First time? A 90-second health check clears you before the event.',
      'Each IV attendee receives their own health-check link.',
      'Exact address appears after reserve, Airbnb-style.',
      'Medical decline always receives a full mocked refund in this demo.',
    ],
    checklist: ['Health check', 'Add to wallet', 'Arrival window', 'Hydration tips'],
    previous: false,
  },
  {
    slug: 'founders-run-club',
    title: 'Founders Run Club Reset',
    eyebrow: 'Open',
    date: 'Sun Aug 23, 2026',
    dateYear: '2026',
    dateDisplay: 'Sun Aug 23, 2026',
    time: '8:30 AM - 1:00 PM',
    neighborhood: 'Marina Green',
    location: 'Marina, San Francisco',
    venue: 'Marina Green hospitality tent',
    exactAddress: 'Marina Green, San Francisco',
    priceFrom: 125,
    status: 'Open',
    state: 'open',
    attendees: ['Tessa', 'Luke', 'Andre', 'Nina'],
    attendeeCount: 21,
    hostName: 'Avalon Vitality',
    hostRole: 'Recovery partner',
    clinicalLead: 'Drew Santos, RN',
    clinicalRole: 'Clinical operations',
    capacity: '64 guest windows',
    cover: '/images/avalon-static-back-1024.jpg',
    gallery: ['/images/avalon-static-back-1024.jpg', '/recovery-lounge-hero.webp', '/backgrounds/iv-vitamins-hero.webp'],
    description:
      'A morning recovery stop for run-club members, founders, and guests who want a calm reset before the week starts.',
    vibe: 'Fast reserve, visible clinical trust, no urgent banners.',
    tiers: [
      {
        id: 'post-run',
        name: 'Post-Run Hydration',
        price: 125,
        state: 'Open',
        serviceType: 'iv',
        detail: 'Hydration appointment, electrolyte bar, and recovery lounge access.',
      },
      {
        id: 'guest',
        name: 'Guest Lounge',
        price: 25,
        state: 'Open',
        serviceType: 'experience_only',
        detail: 'Experience-only access for friends or partners who are not receiving IV service.',
      },
    ],
    included: [
      'Timed recovery appointments',
      'Light lounge flow built for groups',
      'Clinical review before service',
      'QR check-in and photo release toggle',
    ],
    goodToKnow: [
      'IV service depends on eligibility and clinical approval.',
      'Walk-ups can join the lounge, but not receive a same-day IV.',
      'Bring a photo ID for check-in.',
    ],
    checklist: ['Health check', 'Wallet pass', 'Run-club arrival', 'Post-event photos'],
    previous: false,
  },
  {
    slug: 'private-group-recovery',
    title: 'Private Group Recovery',
    eyebrow: 'Application only',
    date: 'By request for 2026',
    dateYear: '2026',
    dateDisplay: 'By request for 2026',
    time: 'Built around host schedule',
    neighborhood: 'Bay Area',
    location: 'Homes, hotels, offices, and venues',
    venue: 'Your venue',
    exactAddress: 'Revealed by host',
    priceFrom: null,
    status: 'Application only',
    state: 'application',
    attendees: ['Avalon hosts'],
    attendeeCount: 0,
    hostName: 'Avalon Vitality',
    hostRole: 'Private event team',
    clinicalLead: 'Avalon clinical team',
    clinicalRole: 'Medical oversight',
    capacity: 'Custom',
    cover: '/backgrounds/iv-vitamins-hero.webp',
    gallery: ['/backgrounds/iv-vitamins-hero.webp', '/recovery-lounge-hero.jpg', '/images/avalon-static-back-1024.jpg'],
    description:
      'A private event shell for offices, hotels, venues, and hosts planning IV appointments before a group experience.',
    vibe: 'Photo-led planning page with a simple request-to-join path.',
    tiers: [
      {
        id: 'request',
        name: 'Request a Group Plan',
        price: 0,
        state: 'Application',
        serviceType: 'request',
        detail: 'Share the host, venue, headcount, and preferred timing. Avalon replies with a plan.',
      },
    ],
    included: [
      'Guest registration plan',
      'Acuity health-check handoff in production',
      'Staffing and kit planning',
      'Door roster and QR manifest concept',
    ],
    goodToKnow: [
      'This demo does not submit a live lead.',
      'No PHI is collected in the platform preview.',
      'A production build would keep health content inside Acuity.',
    ],
    checklist: ['Host plan', 'Guest list', 'Clinical pathway', 'Door flow'],
    previous: false,
  },
  {
    slug: 'gallery-dusk-recovery',
    title: 'Gallery Dusk Recovery',
    eyebrow: 'Previously',
    date: 'Jun 28, 2026',
    dateYear: '2026',
    dateDisplay: 'Jun 28, 2026',
    time: 'Closed',
    neighborhood: 'Dogpatch',
    location: 'Dogpatch, San Francisco',
    venue: 'Gallery event',
    exactAddress: 'Closed event',
    priceFrom: 165,
    status: 'Previously',
    state: 'closed',
    attendees: ['Ari', 'Cam', 'Leah'],
    attendeeCount: 38,
    hostName: 'Avalon Vitality',
    hostRole: 'Recovery host',
    clinicalLead: 'Avalon clinical team',
    clinicalRole: 'Medical oversight',
    capacity: 'Sold through',
    cover: '/recovery-lounge-hero.webp',
    gallery: ['/recovery-lounge-hero.webp', '/images/avalon-static-back-1024.jpg'],
    description: 'A closed gallery recovery lounge used as social proof for the recurring events surface.',
    vibe: 'Proof that the calendar is alive.',
    tiers: [],
    included: ['Photo drop', 'Post-event NPS', 'Next-event teaser'],
    goodToKnow: ['Past events stay visible as proof, not as purchasable inventory.'],
    checklist: ['Photos', 'NPS', 'Next invite'],
    previous: true,
  },
];

export function findEventBySlug(slug) {
  return events.find((event) => event.slug === slug);
}

export function getActiveEvents() {
  return events.filter((event) => !event.previous);
}

export function getPreviousEvents() {
  return events.filter((event) => event.previous);
}

function canUseStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

function readVisits() {
  if (!canUseStorage()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(VISIT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeVisits(visits) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(visits));
}

export function buildDefaultVisit(visitId = 'local-preview') {
  const event = events[0];
  const tier = event.tiers[0];
  return {
    id: visitId,
    eventSlug: event.slug,
    tierId: tier.id,
    tierName: tier.name,
    totalCents: tier.price * 100,
    qrToken: `AV-${visitId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'LOCAL'}`,
    gfeStatus: 'scheduled',
    walletStatus: 'ready',
    arrivalWindow: '5:30 PM - 6:00 PM',
    venueStatus: 'revealed',
    photoRelease: false,
    party: [
      { id: 'guest-1', name: 'Jordan Lee', service: 'IV', gfeStatus: 'cleared' },
      { id: 'guest-2', name: 'Maya Chen', service: 'Experience only', gfeStatus: 'not_required' },
    ],
    createdAt: new Date().toISOString(),
  };
}

export function createMockVisit({ eventSlug, tierId, party = [], totalCents = 0 }) {
  const event = findEventBySlug(eventSlug) || events[0];
  const tier = event.tiers.find((item) => item.id === tierId) || event.tiers[0];
  const id = `visit-${Date.now().toString(36)}`;
  const isRequest = event.state === 'application' || tier?.serviceType === 'request';
  const isExperienceOnly = tier?.serviceType === 'experience_only';
  const normalizedParty = party.map((guest, index) => ({
    id: `guest-${index + 1}`,
    name: guest.name || `Guest ${index + 1}`,
    service: isRequest ? 'Request to join' : guest.iv && !isExperienceOnly ? 'IV' : 'Experience only',
    gfeStatus: isRequest || isExperienceOnly || !guest.iv ? 'not_required' : 'invited',
  }));
  const visit = {
    ...buildDefaultVisit(id),
    eventSlug: event.slug,
    tierId: tier?.id || '',
    tierName: tier?.name || 'Avalon event',
    totalCents,
    gfeStatus: normalizedParty.some((guest) => guest.gfeStatus === 'invited') ? 'invited' : 'not_required',
    walletStatus: 'ready',
    arrivalWindow: event.time.includes('-') ? event.time.split('-')[0].trim() : event.time,
    party: normalizedParty.length ? normalizedParty : buildDefaultVisit(id).party,
  };
  const visits = readVisits();
  visits[visit.id] = visit;
  writeVisits(visits);
  return visit;
}

export function readMockVisit(visitId) {
  if (visitId === 'local-preview') return buildDefaultVisit('local-preview');
  return readVisits()[visitId] || null;
}
