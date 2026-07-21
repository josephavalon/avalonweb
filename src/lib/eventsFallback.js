/**
 * Fallback event data — surfaced when the /api/events/catalog endpoint
 * returns nothing (local dev without serverless functions, or a fresh env
 * with no seeded rows). Real API data always wins when present.
 */

export const FALLBACK_EVENTS = [
  {
    slug: 'after-hours-recovery-club',
    name: 'After Hours Recovery Club',
    venue: 'Fort Mason, San Francisco',
    startsAt: '2026-08-22T19:00:00-07:00',
    endsAt: '2026-08-23T01:00:00-07:00',
    priceFromCents: 6500,
    status: 'presale',
    capacity: 220,
    attendeeCount: 148,
    hostName: 'North Coast Social',
    cohosts: ['Avalon Vitality'],
    descriptionBlocks: {
      vibe: 'Late-night recovery, built into the room.',
      description:
        'A private after-hours club with music, hospitality, and a dedicated recovery lounge. Built for the last hour of a great night.',
      included: [
        'Entry to After Hours Recovery Club',
        'Recovery lounge access',
        'Non-alcoholic drinks and hospitality',
        'Live music and late-night programming',
      ],
      goodToKnow: [
        'Exact arrival details are shared after purchase',
        'Guests must be 21+ with a valid photo ID',
      ],
    },
    tiers: [
      {
        id: 'demo-ticket-1',
        name: 'Early Entry',
        description: 'Event entry before 9 PM.',
        priceCents: 6500,
        experienceOnly: true,
        remaining: 12,
        presaleOpensAt: '2026-07-20T09:00:00-07:00',
        publicOpensAt: '2026-07-24T09:00:00-07:00',
      },
      {
        id: 'demo-ticket-2',
        name: 'All Night Access',
        description: 'General event access and hospitality.',
        priceCents: 9500,
        experienceOnly: true,
        remaining: 60,
        presaleOpensAt: '2026-07-20T09:00:00-07:00',
        publicOpensAt: '2026-07-24T09:00:00-07:00',
      },
      {
        id: 'demo-clinical-1',
        name: 'Recovery IV',
        description: 'Optional clinician-reviewed hydration service from Avalon.',
        priceCents: 22500,
        experienceOnly: false,
        serviceId: 'recovery-iv',
        remaining: 24,
      },
    ],
    services: [
      { id: 'recovery-iv', name: 'Recovery IV', serviceClass: 'flow', requiresGfe: true, backOnFloorMinutes: 45 },
    ],
  },
  {
    slug: 'vital-ice-recovery-house',
    name: 'Vital Ice Recovery House',
    venue: 'Pacific Heights, San Francisco',
    startsAt: '2026-08-15T16:00:00-07:00',
    endsAt: '2026-08-15T21:00:00-07:00',
    priceFromCents: 14900,
    status: 'open',
    hostName: 'Avalon Vitality',
    descriptionBlocks: {
      description:
        'Licensed IV therapy on-site at the Vital Ice Recovery House. Nurse-delivered hydration, vitamins, and recovery protocols — clinician-reviewed and administered by a registered nurse in a private, quiet setting.',
      included: [
        'Licensed registered nurse on-site',
        'Pre-visit clinical health screening',
        '45–60 minute IV therapy session',
        'Clinician-reviewed protocol match',
      ],
      goodToKnow: [
        'Exact address shared after you reserve',
        '90-second pre-visit health check required',
        'Guests must be 18+ with valid ID',
        'Reservation required — no walk-ins',
      ],
    },
    tiers: [
      {
        id: 'vital-ice-hydration',
        name: 'Hydration IV',
        description: 'IV hydration with electrolytes and B-complex. Nurse-administered, 45 minutes.',
        priceCents: 14900,
      },
      {
        id: 'vital-ice-recovery',
        name: 'Recovery IV',
        description: 'Hydration + glutathione push. Antioxidant recovery, nurse-administered.',
        priceCents: 22500,
      },
      {
        id: 'vital-ice-executive',
        name: 'Executive Drip',
        description: 'Recovery IV + NAD+ boost. Extended visit with dedicated registered nurse.',
        priceCents: 32500,
      },
    ],
    addOns: [
      { id: 'ao-b12', name: 'B12 shot', description: 'Intramuscular B12 injection.', priceCents: 3500 },
      { id: 'ao-gluta', name: 'Glutathione shot', description: 'Antioxidant IM push.', priceCents: 5500 },
      { id: 'ao-compression', name: 'Compression therapy', description: '20-minute NormaTec session, added to your IV visit.', priceCents: 4500 },
    ],
    assets: [
      {
        renditions: {
          hero_1920: '/events/vital-ice-recovery-house/hero.webp',
          card_640: '/events/vital-ice-recovery-house/card-640.webp',
        },
      },
    ],
  },
  {
    slug: 'sf-marathon-recovery-lounge',
    name: 'SF Marathon Recovery Lounge',
    venue: 'Marina Green, San Francisco',
    startsAt: '2026-07-27T09:00:00-07:00',
    endsAt: '2026-07-27T14:00:00-07:00',
    priceFromCents: 14900,
    status: 'open',
    hostName: 'Avalon Vitality',
    descriptionBlocks: {
      description:
        'Post-race IV therapy at Marina Green. Registered nurses administer athlete recovery protocols — hydration, electrolytes, magnesium, and antioxidant support the moment you cross the finish line.',
      included: [
        'Licensed registered nurse on-site',
        'Post-race clinical intake',
        'Athlete recovery IV protocol',
        'Clinician-reviewed dosing',
      ],
      goodToKnow: [
        'Bib number required at check-in',
        'IV bar open 9:00 AM – 2:00 PM',
        '90-second pre-visit health check required',
        'Covered clinical space — rain or shine',
      ],
    },
    tiers: [
      {
        id: 'sf-marathon-hydration',
        name: 'Athlete Hydration IV',
        description: 'IV hydration with electrolytes and magnesium. Nurse-administered, 45 minutes.',
        priceCents: 14900,
      },
      {
        id: 'sf-marathon-recovery',
        name: 'Recovery IV',
        description: 'Hydration + magnesium + glutathione push for post-race recovery.',
        priceCents: 22500,
      },
      {
        id: 'sf-marathon-athlete',
        name: 'Full Athlete Protocol',
        description: 'Recovery IV + amino acids + B12 IM. Extended visit, dedicated nurse.',
        priceCents: 32500,
      },
    ],
    addOns: [
      { id: 'ao-b12', name: 'B12 shot', description: 'Intramuscular B12 injection.', priceCents: 3500 },
      { id: 'ao-toradol', name: 'Toradol shot', description: 'Anti-inflammatory IM push for post-race soreness.', priceCents: 5500 },
      { id: 'ao-compression', name: 'Compression therapy', description: '20-minute NormaTec session, added to your IV visit.', priceCents: 4500 },
    ],
  },
];

export function fallbackList() {
  return FALLBACK_EVENTS.map(({ tiers, descriptionBlocks, endsAt, hostName, ...rest }) => rest);
}

export function fallbackEvent(slug) {
  return FALLBACK_EVENTS.find((e) => e.slug === slug) || null;
}
