// Avalon × Acuity catalog
// ---------------------------------------------------------------------------
// Each entry maps a customer-facing treatment to an Acuity Appointment Type.
//
// To wire this to your real Acuity account:
//   1. ACUITY_OWNER_ID below — your Acuity owner ID. Find it in Acuity dashboard
//      → Business Settings → Booking Page → "Direct scheduling page" URL,
//      e.g. https://app.acuityscheduling.com/schedule.php?owner=12345678
//      The number after owner= is your owner ID.
//
//   2. For each treatment, replace appointmentTypeId with the Acuity ID.
//      Find each ID at: Acuity → Appointment Types → click a type →
//      Direct Link URL → ?appointmentType=XXXXXXXX is the ID.
//
// Until both are set, the Book buttons fall back to the Acuity general booking
// page so we never ship a broken link.
// ---------------------------------------------------------------------------

export const ACUITY_OWNER_ID = ''; // e.g. '12345678' — REPLACE WITH YOURS
export const ACUITY_BOOKING_BASE = 'https://app.acuityscheduling.com/schedule.php';

export const buildAcuityUrl = (appointmentTypeId) => {
  if (!ACUITY_OWNER_ID) return ACUITY_BOOKING_BASE; // fallback: general Acuity scheduler
  const params = new URLSearchParams({ owner: ACUITY_OWNER_ID });
  if (appointmentTypeId) params.set('appointmentType', String(appointmentTypeId));
  return `${ACUITY_BOOKING_BASE}?${params.toString()}`;
};

// Catalog: organized by category, each treatment maps to one Acuity Appointment Type
export const CATEGORIES = [
  {
    id: 'iv-vitamins',
    name: 'IV Vitamins',
    eyebrow: 'Wellness foundation',
    description: 'Hydration, recovery, performance. Pick a drip and stack add-ons.',
    treatments: [
      { id: 'hydration',  name: 'Hydration',          duration: '45 min', price: 150, blurb: 'Saline base. Magnesium, B-complex. The everyday reset.', appointmentTypeId: '' },
      { id: 'myers',      name: "Myers' Cocktail",    duration: '45 min', price: 200, blurb: 'Classic Myers. Magnesium, calcium, B-complex, B-12, Vitamin C.', appointmentTypeId: '' },
      { id: 'recovery',   name: 'Recovery',           duration: '60 min', price: 225, blurb: 'After exertion or a long night. Glutathione, B-complex, electrolytes.', appointmentTypeId: '' },
      { id: 'athletic',   name: 'Athletic',           duration: '60 min', price: 250, blurb: 'Pre- or post-training. Amino acids, electrolytes, B-12.', appointmentTypeId: '' },
      { id: 'glow',       name: 'Glow',               duration: '60 min', price: 250, blurb: 'High-dose Vitamin C, biotin, glutathione push.', appointmentTypeId: '' },
      { id: 'immunity',   name: 'Immunity',           duration: '60 min', price: 225, blurb: 'High-dose Vitamin C, zinc, B-complex when you need it.', appointmentTypeId: '' },
    ],
  },
  {
    id: 'iv-nad',
    name: 'IV NAD+',
    eyebrow: 'Cellular repair',
    description: 'NAD+ at clinical doses. Cellular reset.',
    treatments: [
      { id: 'nad-250',  name: 'NAD+ 250 mg',  duration: '90 min',  price: 350,  blurb: 'Entry dose. First-time or maintenance.', appointmentTypeId: '' },
      { id: 'nad-500',  name: 'NAD+ 500 mg',  duration: '2 hr',    price: 600,  blurb: 'Standard therapeutic dose.', appointmentTypeId: '' },
      { id: 'nad-1000', name: 'NAD+ 1000 mg', duration: '3 hr',    price: 1100, blurb: 'High dose for protocol patients.', appointmentTypeId: '' },
    ],
  },
  {
    id: 'iv-cbd',
    name: 'IV CBD',
    eyebrow: 'Recovery & calm',
    description: 'Premium CBD infusion. Zero THC. Therapeutic doses.',
    treatments: [
      { id: 'cbd-33', name: 'CBD 33 mg', duration: '60 min', price: 250, blurb: 'Standard recovery infusion.', appointmentTypeId: '' },
      { id: 'cbd-66', name: 'CBD 66 mg', duration: '75 min', price: 400, blurb: 'Higher dose for chronic recovery.', appointmentTypeId: '' },
    ],
  },
  {
    id: 'im-shots',
    name: 'IM Shots',
    eyebrow: 'Quick targeted boost',
    description: 'Intramuscular injection. 5–10 minutes. Stack with any IV or solo.',
    treatments: [
      { id: 'im-b12',         name: 'B-12',         duration: '10 min', price: 60, blurb: 'Energy, focus, methylcobalamin form.', appointmentTypeId: '' },
      { id: 'im-glutathione', name: 'Glutathione',  duration: '10 min', price: 80, blurb: 'Master antioxidant push.', appointmentTypeId: '' },
      { id: 'im-vitd',        name: 'Vitamin D',    duration: '10 min', price: 60, blurb: 'For documented deficiency. Bring labs.', appointmentTypeId: '' },
    ],
  },
  {
    id: 'add-ons',
    name: 'Add-ons',
    eyebrow: 'Stack onto any IV',
    description: 'Compression, oxygen, extras. Available with any drip booking.',
    treatments: [
      { id: 'normatec',   name: 'Normatec compression boots', duration: '20 min', price: 60, blurb: 'Add to any IV booking. Legs only.', appointmentTypeId: '' },
      { id: 'extra-bag',  name: 'Extra fluid bag',           duration: '+30 min', price: 75, blurb: 'Second 500 mL bag during your session.', appointmentTypeId: '' },
    ],
  },
];

export const ALL_TREATMENTS = CATEGORIES.flatMap(c => c.treatments.map(t => ({ ...t, categoryId: c.id, categoryName: c.name })));
