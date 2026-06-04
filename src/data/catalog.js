import {
  BatteryCharging,
  Droplets,
  Flame,
  FlaskConical,
  Heart,
  LayoutGrid,
  Leaf,
  Moon,
  Plane,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export const slugify = (name) =>
  String(name)
    .toLowerCase()
    .replace(/\+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const money = (value) => `$${Number(value).toLocaleString()}`;
const subscriberPrice = (value) => money(Math.round(Number(value) * 0.8));
const annualPrice = (value) => money(Math.round(Number(value) * 0.8 * 9));

export const IV_SESSIONS = [
  {
    key: 'hydration',
    label: 'Hydration',
    price: 200,
    icon: Droplets,
    tagline: 'Hydration and electrolyte support.',
    tag: 'Essential',
    category: 'recovery',
    duration: '30-45 min',
    inside: 'Saline (500-1000ml) · Electrolytes · B-Complex · Trace minerals',
    features: ['Hydration support', 'Electrolyte balance', 'Nutrient support', 'Overall wellness'],
    image: '/bags/dehydration.png',
    desc: 'Saline, electrolytes, B-complex, and trace minerals for hydration support.',
  },
  {
    key: 'energy',
    label: 'Energy',
    price: 250,
    icon: Zap,
    tagline: 'Energy and nutrient support.',
    tag: 'Performance',
    category: 'energy',
    duration: '45-60 min',
    inside: 'Saline · Vitamin B12 · B-Complex · Magnesium · Taurine · Vitamin C',
    features: ['B vitamins', 'Amino acids', 'Metabolic support', 'General wellness'],
    image: '/bags/energy.png',
    desc: 'B12, B-complex, and amino acids - nutrients commonly associated with daily energy.',
  },
  {
    key: 'immunity',
    label: 'Immunity',
    price: 250,
    icon: ShieldCheck,
    tagline: 'Vitamin and mineral support.',
    tag: 'Bestseller',
    category: 'immunity',
    duration: '45-60 min',
    inside: 'High-dose Vitamin C · Zinc · Selenium · Glutathione · Saline',
    features: ['Vitamin C', 'Zinc infusion', 'Antioxidant support', 'Wellness support'],
    image: '/bags/immunity.png',
    desc: 'Vitamin C and zinc - nutrients commonly selected for wellness support.',
  },
  {
    key: 'beauty',
    label: 'Beauty',
    price: 250,
    icon: Sparkles,
    tagline: 'Glow from within.',
    tag: 'Glow Favorite',
    category: 'beauty',
    duration: '45-60 min',
    inside: 'Glutathione · Biotin · Vitamin C · B-Complex · Collagen support nutrients · Saline',
    features: ['Glutathione push', 'Biotin support', 'Vitamin C boost', 'Skin radiance'],
    image: '/bags/beauty.png',
    desc: 'Glutathione, biotin, Vitamin C, and collagen - nutrients associated with skin, hair, and nails.',
  },
  {
    key: 'recovery',
    label: 'Recovery',
    price: 250,
    icon: Heart,
    tagline: 'Recovery-focused hydration support.',
    tag: 'Same-Day Favorite',
    category: 'recovery',
    duration: '45-60 min',
    inside: 'Saline · Magnesium · B-Complex · Amino acids · Nausea support when clinically appropriate · Electrolytes',
    features: ['Hydration support', 'Electrolytes', 'Amino acids', 'General recovery support'],
    image: '/bags/recovery.png',
    desc: 'Saline, magnesium, B-complex, amino acids, and electrolyte support for heavier recovery days.',
  },
  {
    key: 'jetlag',
    label: 'Travel',
    price: 250,
    icon: Plane,
    tagline: 'Travel-day hydration support.',
    tag: 'Travel Essential',
    category: 'travel',
    duration: '45-60 min',
    inside: 'Saline · Vitamin B12 · Magnesium · B-Complex · Electrolytes · Vitamin support blend',
    features: ['Travel-day hydration', 'Vitamin support', 'Electrolyte support', 'General wellness'],
    image: '/bags/jet-lag.png',
    desc: 'B vitamins, electrolytes, and hydration support - popular with travelers adjusting to new routines.',
  },
  {
    key: 'myers',
    label: "Myers' Cocktail",
    tabLabel: 'Wellness',
    price: 250,
    icon: FlaskConical,
    tagline: 'The gold standard of IV therapy.',
    tag: 'Most Popular',
    category: 'energy',
    popular: true,
    duration: '45-60 min',
    inside: 'Magnesium · Calcium · Vitamins B1 B2 B3 B5 B6 · Vitamin C · Saline',
    features: ['Magnesium', 'B-complex vitamins', 'Calcium', 'Vitamin C'],
    image: '/bags/myers-cocktail-cutout.png',
    transparentMedia: true,
    motionVideo: null,
    desc: 'A classic IV formula featuring B-complex, Vitamin C, magnesium, calcium, and zinc.',
  },
  {
    key: 'postnight',
    label: 'Post-Night-Out',
    price: 250,
    icon: Moon,
    tagline: 'Post-night-out hydration support.',
    tag: 'Same-Day Favorite',
    category: 'recovery',
    duration: '45-60 min',
    inside: 'Saline · Nausea support when clinically appropriate · B-Complex · Glutathione · Electrolytes',
    features: ['Hydration support', 'B vitamins', 'Glutathione support', 'Electrolytes'],
    image: '/bags/recovery.png',
    desc: 'Saline, B vitamins, and glutathione - a well-known combination for rehydration.',
  },
  {
    key: 'nad',
    label: 'NAD+',
    icon: BatteryCharging,
    tagline: 'Clinician-reviewed NAD+ appointment support.',
    tag: 'Advanced',
    category: 'energy',
    inside: 'NAD+ · Saline · B-Complex',
    features: ['NAD+ review', 'Longer appointment window', 'Clinician-selected dosing', 'Eligibility screening'],
    doses: [
      { key: 'nad_250', label: '250mg', price: 350, duration: '2-3 hr', image: '/bags/nad-250.png' },
      { key: 'nad_500', label: '500mg', price: 500, duration: '3-4 hr', image: '/bags/nad-500.png' },
      { key: 'nad_750', label: '750mg', price: 600, duration: '3-5 hr', image: '/bags/nad-750.png' },
      { key: 'nad_1000', label: '1000mg', price: 750, duration: '4-6 hr', image: '/bags/nad-1000.png' },
      { key: 'nad_1250', label: '1250mg', price: 950, duration: '5-7 hr', image: '/bags/nad-1500.png' },
      { key: 'nad_1500', label: '1500mg', price: 1100, duration: '6-8 hr', image: '/bags/nad-1500.png' },
    ],
  },
  {
    key: 'cbd',
    label: 'CBD',
    icon: Leaf,
    tagline: 'CBD IV category held for clinical and legal approval.',
    tag: 'Approval Gated',
    category: 'recovery',
    inside: 'CBD IV information pending approval',
    features: ['Clinical approval required', 'Legal review required', 'No public claims', 'No guaranteed outcomes'],
    doses: [
      { key: 'cbd_33', label: '33mg', price: 350, duration: '45-60 min', image: '/bags/cbd-33.png' },
      { key: 'cbd_66', label: '66mg', price: 450, duration: '45-60 min', image: '/bags/cbd-66.png' },
      { key: 'cbd_99', label: '99mg', price: 550, duration: '45-60 min', image: '/bags/cbd-99.png' },
      { key: 'cbd_132', label: '132mg', price: 650, duration: '45-60 min', image: '/bags/cbd-132.png' },
    ],
  },
  {
    key: 'exosomes',
    label: 'Exosomes',
    icon: Sparkles,
    tagline: 'Regenerative cellular signaling support.',
    tag: 'Elite',
    category: 'recovery',
    inside: 'Exosomes · Saline',
    elite: true,
    doses: [
      { key: 'exosomes_30', label: '30B Units', price: 700, duration: '45-60 min', image: '/bags/nad-1500.png' },
      { key: 'exosomes_50', label: '50B Units', price: 1200, duration: '60-75 min', image: '/bags/nad-1500.png' },
      { key: 'exosomes_90', label: '90B Units', price: 1800, duration: '60-90 min', image: '/bags/nad-1500.png' },
    ],
  },
];

export const IV_ADDONS = [
  { label: 'Extra Fluid', price: 25, desc: 'Additional 500ml saline' },
  { label: 'Extra Ingredients', price: 30, desc: 'B-complex, minerals, and amino support' },
  { label: 'Vitamin C IV Push · 5g', price: 45, desc: 'Entry high-dose antioxidant support' },
  { label: 'Vitamin C IV Push · 10g', price: 85, desc: 'Higher-dose vitamin C support' },
  { label: 'Vitamin C IV Push · 15g', price: 125, desc: 'Advanced high-dose vitamin C support' },
  { label: 'CBD Review', price: 350, desc: 'Approval-gated clinical review', group: 'cbd' },
  { label: 'CBD Review Plus', price: 450, desc: 'Approval-gated clinical review', group: 'cbd' },
  { label: 'NAD+ (250mg)', price: 350, desc: 'Clinician-reviewed NAD+ add-on · 2-3 hr infusion', group: 'nad' },
  { label: 'NAD+ (500mg)', price: 500, desc: 'Clinician-reviewed NAD+ add-on · 3-4 hr infusion', group: 'nad' },
  { label: 'NAD+ (1000mg)', price: 750, desc: 'Extended NAD+ protocol · 4-6 hr infusion', group: 'nad' },
  { label: 'Glutathione Push · 600mg', price: 60, desc: 'Antioxidant support' },
  { label: 'Glutathione Push · 1200mg', price: 100, desc: 'Elevated antioxidant + glow support' },
  { label: 'Glutathione Push · 1800mg', price: 140, desc: 'Maximum antioxidant push' },
  { label: 'Magnesium Support', price: 30, desc: 'Magnesium support' },
];

export const IM_SHOTS = [
  { label: 'B12', price: 40, max: 5, icon: Zap, desc: 'Energy + metabolism support' },
  { label: 'MIC', price: 50, icon: Flame, desc: 'Metabolism support' },
  { label: 'NAD+', price: 80, icon: BatteryCharging, desc: 'Clinician-reviewed NAD+ support' },
  { label: 'Glutathione IM · 200mg', price: 50, max: 5, icon: Sparkles, desc: 'Antioxidant + skin clarity' },
  { label: 'Glutathione IM · 400mg', price: 80, max: 5, icon: Sparkles, desc: 'Higher-dose antioxidant support' },
  { label: 'Vitamin C IM · 500mg', price: 30, icon: Shield, desc: 'Immune + antioxidant support' },
  { label: 'Vitamin C IM · 1000mg', price: 45, icon: Shield, desc: 'Higher-dose vitamin C support' },
  { label: 'Vitamin D', price: 35, icon: Zap, desc: 'Vitamin D support' },
  { label: 'Biotin', price: 35, icon: Sparkles, desc: 'Hair, skin & nail support' },
];

export const PACKAGES = [
  {
    key: 'hangover',
    label: 'Post-Night-Out Kit',
    tagline: 'Hydration support after late nights.',
    includes: ['Post-Night-Out IV', 'B12 IM shot', 'Glutathione IM shot'],
    price: 340,
    save: 30,
    icon: Moon,
    tag: 'Tonight',
    items: [
      { cartKey: 'pkg-hangover-iv', label: 'Post-Night-Out IV', price: 250, type: 'iv' },
      { cartKey: 'pkg-hangover-b12', label: 'IM · B12', price: 40, type: 'im' },
      { cartKey: 'pkg-hangover-glut', label: 'IM · Glutathione', price: 50, type: 'im' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance Bundle',
    tagline: 'Support before or after high-output days.',
    includes: ['Energy IV', 'NAD+ IM shot', 'MIC IM shot'],
    price: 380,
    save: 30,
    icon: Zap,
    tag: 'Athlete Favorite',
    items: [
      { cartKey: 'pkg-perf-iv', label: 'Energy IV', price: 250, type: 'iv' },
      { cartKey: 'pkg-perf-nad', label: 'IM · NAD+', price: 80, type: 'im' },
      { cartKey: 'pkg-perf-mic', label: 'IM · MIC', price: 50, type: 'im' },
    ],
  },
  {
    key: 'glow',
    label: 'Glow Stack',
    tagline: 'Skin, hair, and radiance from within.',
    includes: ['Beauty IV', 'Glutathione IM shot', 'Biotin IM shot'],
    price: 335,
    save: 30,
    icon: Sparkles,
    tag: 'Most Requested',
    items: [
      { cartKey: 'pkg-glow-iv', label: 'Beauty IV', price: 250, type: 'iv' },
      { cartKey: 'pkg-glow-glut', label: 'IM · Glutathione', price: 50, type: 'im' },
      { cartKey: 'pkg-glow-biotin', label: 'IM · Biotin', price: 35, type: 'im' },
    ],
  },
  {
    key: 'reset',
    label: 'Total Reset',
    tagline: "Expanded protocol review. Myers' + NAD+ + B12.",
    includes: ["Myers' Cocktail IV", 'NAD+ add-on (250mg)', 'B12 IM shot'],
    price: 680,
    save: 60,
    icon: FlaskConical,
    tag: 'Expanded',
    items: [
      { cartKey: 'pkg-reset-iv', label: "Myers' Cocktail IV", price: 250, type: 'iv' },
      { cartKey: 'pkg-reset-nad', label: 'NAD+ Add-On (250mg)', price: 350, type: 'addon' },
      { cartKey: 'pkg-reset-b12', label: 'IM · B12', price: 40, type: 'im' },
      { cartKey: 'pkg-reset-extra', label: 'Extra Fluid', price: 25, type: 'addon' },
    ],
  },
];

export const IV_CATEGORIES = [
  { key: 'all', label: 'Not Sure', icon: LayoutGrid },
  { key: 'recovery', label: 'Recovery', icon: Heart },
  { key: 'energy', label: 'Energy', icon: Zap },
  { key: 'beauty', label: 'Beauty', icon: Sparkles },
  { key: 'immunity', label: 'Immunity', icon: ShieldCheck },
  { key: 'travel', label: 'Travel', icon: Plane },
  { key: 'elite', label: 'Elite', icon: Sparkles },
];

export const IV_GOAL_RECOMMENDATION = {
  recovery: 'recovery',
  energy: 'myers',
  beauty: 'beauty',
  packages: 'hangover',
};

export const VERTICALS = {
  iv_therapy: {
    slug: 'iv_therapy',
    label: 'IV Therapy',
    active: true,
    launchDate: '2026-05-01',
    sessions: IV_SESSIONS,
    addons: IV_ADDONS,
    shots: IM_SHOTS,
    packages: PACKAGES,
    categories: IV_CATEGORIES,
    goalRecommendation: IV_GOAL_RECOMMENDATION,
  },
};

function treatmentFromSession(session) {
  return {
    name: session.label,
    protocolKey: session.key,
    oneTime: money(session.price),
    monthly: subscriberPrice(session.price),
    annual: annualPrice(session.price),
    desc: session.desc || session.tagline,
    benefitStatement: session.tagline,
    benefits: session.features,
    idealFor: idealForSession(session),
    included: includedSession(session),
    timeline: defaultTimeline(session.duration),
    faq: defaultFaq(session),
    related: relatedForSession(session.key),
    image: session.image,
    transparentMedia: session.transparentMedia,
    motionVideo: session.motionVideo,
  };
}

function treatmentFromDose(parent, dose) {
  return {
    name: `${parent.label} IV ${dose.label}`,
    protocolKey: parent.key,
    doseKey: dose.key,
    price: money(dose.price),
    annualPrice: subscriberPrice(dose.price),
    desc: `${parent.tagline} ${dose.duration ? `Typical visit time: ${dose.duration}.` : ''}`.trim(),
    benefitStatement: parent.tagline,
    benefits: parent.features,
    idealFor: idealForSession(parent),
    included: includedSession(parent),
    timeline: defaultTimeline(dose.duration),
    faq: defaultFaq(parent),
    related: relatedForSession(parent.key),
    image: dose.image,
  };
}

const ivVitaminKeys = new Set(['hydration', 'myers', 'recovery', 'energy', 'postnight', 'immunity', 'beauty', 'jetlag']);
const byKey = Object.fromEntries(IV_SESSIONS.map((session) => [session.key, session]));

function includedSession(session) {
  if (session.key === 'nad') return ['NAD+', 'IV fluids', 'B-complex support'];
  if (session.key === 'cbd') return ['Zero-THC CBD', 'IV fluids', 'Clinician-guided dose'];
  return String(session.inside || 'IV fluids · Electrolytes · Vitamin support')
    .split(' · ')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function idealForSession(session) {
  const key = session.key;
  if (key === 'postnight') return ['Nightlife', 'Travel', 'Recovery'];
  if (key === 'jetlag') return ['Travel', 'Corporate', 'Recovery'];
  if (key === 'energy') return ['Performance', 'Corporate', 'Wellness'];
  if (key === 'myers') return ['Wellness', 'Energy', 'Recovery'];
  if (key === 'immunity') return ['Wellness', 'Travel', 'Corporate'];
  if (key === 'hydration') return ['Travel', 'Recovery', 'Wellness'];
  if (key === 'nad') return ['Longevity', 'Performance', 'Wellness'];
  if (key === 'cbd') return ['Wellness', 'Recovery', 'Clinical Review'];
  return ['Recovery', 'Wellness', 'Performance'];
}

function defaultTimeline(duration = '45-60 min') {
  return [
    { label: 'Booking', value: 'Choose protocol' },
    { label: 'Review', value: 'Clinical intake' },
    { label: 'Arrival', value: 'Licensed RN' },
    { label: 'Treatment', value: duration },
  ];
}

function defaultFaq(session) {
  return [
    { q: 'How long does it take?', a: session.duration || session.doses?.[0]?.duration || 'Most visits take 30-60 minutes after clinical clearance.' },
    { q: 'Who administers it?', a: 'A California-licensed RN after intake and clinical review.' },
    { q: 'Can I book today?', a: 'Same-day availability depends on location, nurse coverage, and clinical clearance.' },
    { q: 'Is this medical treatment?', a: 'Avalon provides clinician-reviewed wellness services. Eligibility is confirmed before service.' },
    { q: 'Where do you serve?', a: 'Avalon serves eligible clients across the San Francisco Bay Area.' },
  ];
}

function relatedForSession(key) {
  const map = {
    hydration: ['recovery-iv', 'post-night-out-iv', 'myers-cocktail-iv'],
    myers: ['hydration-iv', 'energy-iv', 'immunity-iv'],
    postnight: ['hydration-iv', 'recovery-iv', 'jet-lag-iv'],
    immunity: ['myers-cocktail-iv', 'hydration-iv', 'energy-iv'],
    energy: ['myers-cocktail-iv', 'performance-iv', 'nad-iv-250mg'],
    recovery: ['hydration-iv', 'post-night-out-iv', 'performance-iv'],
    jetlag: ['hydration-iv', 'energy-iv', 'post-night-out-iv'],
    nad: ['energy-iv', 'myers-cocktail-iv', 'recovery-iv'],
    cbd: ['recovery-iv', 'hydration-iv', 'myers-cocktail-iv'],
  };
  return map[key] || ['hydration-iv', 'myers-cocktail-iv', 'recovery-iv'];
}

function namedSession(session, name, overrides = {}) {
  return {
    ...treatmentFromSession(session),
    name,
    desc: overrides.desc || session.desc || session.tagline,
    benefitStatement: overrides.benefitStatement || session.tagline,
    image: overrides.image || session.image,
    related: overrides.related || relatedForSession(session.key),
    idealFor: overrides.idealFor || idealForSession(session),
    included: overrides.included || includedSession(session),
  };
}

export const productsByCategory = {
  cbd: {
    title: 'CBD IV Review',
    subtitle: 'Approval gated',
    badge: 'Clinical and legal review required',
    description:
      'CBD IV service information is held for clinical and legal approval. Public availability depends on physician-owned clinical approval and compliance-reviewed copy.',
    heroImage: null,
    categoryLabel: 'CBD Review',
    backTo: '/services/cbd',
    backLabel: 'Back to CBD Review',
    treatments: byKey.cbd.doses.map((dose) => ({
      ...treatmentFromDose(byKey.cbd, dose),
      name: `CBD IV ${dose.label}`,
      desc: 'Approval-gated CBD IV information for clinician-reviewed wellness visits.',
    })),
  },
  nad: {
    title: 'IV NAD+',
    subtitle: 'The longevity molecule',
    badge: 'Clinician Reviewed',
    description:
      'NAD+ is a coenzyme involved in energy metabolism. Your clinician confirms whether IV NAD+ is appropriate before treatment.',
    heroImage: null,
    categoryLabel: 'IV NAD+',
    backTo: '/services/nad',
    backLabel: 'Back to IV NAD+',
    treatments: [
      ...byKey.nad.doses.map((dose) => ({
        ...treatmentFromDose(byKey.nad, dose),
        name: `NAD+ IV ${dose.label}`,
      })),
      {
        name: "NAD+ Myers' Cocktail IV",
        protocolKey: 'nad',
        price: money(700),
        annualPrice: subscriberPrice(700),
        desc: 'NAD+ paired with B vitamins and amino acids.',
        benefitStatement: 'NAD+ with classic IV vitamin support.',
        benefits: ['NAD+ review', 'B vitamins', 'Amino acid support', 'Clinician-guided dosing'],
        idealFor: ['Longevity', 'Wellness', 'Performance'],
        included: ['NAD+', 'B vitamins', 'Amino acids', 'IV fluids'],
        timeline: defaultTimeline('3-5 hr'),
        faq: defaultFaq(byKey.nad),
        related: ['nad-iv-250mg', 'myers-cocktail-iv', 'energy-iv'],
        image: '/bags/nad-750.png',
      },
    ],
  },
  exosomes: {
    title: 'EXOSOMES',
    subtitle: 'Regenerative cellular signaling support',
    badge: 'Elite · Clinician Guided',
    description:
      'Exosome protocols are advanced regenerative wellness sessions reserved for clinician-guided care plans. Dose and eligibility are confirmed before treatment.',
    heroImage: null,
    categoryLabel: 'Exosomes',
    backTo: '/protocols',
    backLabel: 'Back to Protocols',
    treatments: byKey.exosomes.doses.map((dose) => treatmentFromDose(byKey.exosomes, dose)),
  },
  'iv-vitamins': {
    title: 'IV VITAMINS',
    subtitle: 'Medical-grade intravenous vitamin therapy',
    description:
      'Every IV is customized and made fresh on-site with medical-grade ingredients - B-complex vitamins, glutathione, magnesium, zinc, and electrolytes.',
    heroImage: null,
    categoryLabel: 'IV Vitamins',
    backTo: '/services/iv-vitamins',
    backLabel: 'Back to IV Vitamins',
    treatments: [
      namedSession(byKey.hydration, 'Hydration IV', {
        benefitStatement: 'Fluid and electrolyte support at home, hotel, or office.',
      }),
      namedSession(byKey.myers, "Myers' Cocktail IV", {
        benefitStatement: 'Classic IV vitamin support for broad wellness days.',
      }),
      namedSession(byKey.postnight, 'Post Night Out IV', {
        benefitStatement: 'Hydration support after late nights and heavy schedules.',
      }),
      namedSession(byKey.immunity, 'Immunity IV', {
        benefitStatement: 'Vitamin and mineral support for wellness routines.',
      }),
      namedSession(byKey.energy, 'Energy IV', {
        benefitStatement: 'B-vitamin and amino acid support for high-output days.',
      }),
      namedSession(byKey.recovery, 'Recovery IV', {
        benefitStatement: 'Hydration and nutrient support for recovery days.',
      }),
      namedSession(byKey.energy, 'Performance IV', {
        desc: 'B vitamins, magnesium, taurine, Vitamin C, and hydration support for performance-focused routines.',
        benefitStatement: 'Nutrient support before or after high-output performance.',
        idealFor: ['Performance', 'Corporate', 'Recovery'],
        related: ['energy-iv', 'recovery-iv', 'nad-iv-250mg'],
      }),
      namedSession(byKey.jetlag, 'Jet Lag IV', {
        desc: 'B vitamins, electrolytes, magnesium, and hydration support for travel days.',
        benefitStatement: 'Travel-day hydration support across the Bay Area.',
      }),
      namedSession(byKey.recovery, 'Food Poisoning Recovery IV', {
        desc: 'Hydration and electrolyte support commonly selected after GI distress. Anti-nausea support may be considered when clinically appropriate.',
        benefitStatement: 'Hydration support after GI distress, subject to clinical review.',
        image: '/bags/food-poisoning.png',
        idealFor: ['Recovery', 'Travel', 'Wellness'],
        related: ['hydration-iv', 'recovery-iv', 'post-night-out-iv'],
      }),
    ],
  },
};

const PRODUCT_SLUG_ALIASES = {
  'iv-vitamins': {
    dehydration: 'hydration-iv',
    hydration: 'hydration-iv',
    myers: 'myers-cocktail-iv',
    'myers-cocktail': 'myers-cocktail-iv',
    postnight: 'post-night-out-iv',
    'post-night-out': 'post-night-out-iv',
    immunity: 'immunity-iv',
    energy: 'energy-iv',
    recovery: 'recovery-iv',
    travel: 'jet-lag-iv',
    'launch-performance': 'performance-iv',
    'launch-recovery': 'recovery-iv',
    'food-poisoning': 'food-poisoning-recovery-iv',
  },
  nad: {
    'nad-250mg': 'nad-iv-250mg',
    'nad-500mg': 'nad-iv-500mg',
    'nad-750mg': 'nad-iv-750mg',
    'nad-1000mg': 'nad-iv-1000mg',
    'nad-1250mg': 'nad-iv-1250mg',
    'nad-1500mg': 'nad-iv-1500mg',
  },
  cbd: {
    'cbd-33mg': 'cbd-iv-33mg',
    'cbd-66mg': 'cbd-iv-66mg',
    'cbd-99mg': 'cbd-iv-99mg',
    'cbd-132mg': 'cbd-iv-132mg',
  },
};

export function getProduct(categorySlug, productSlug) {
  const cat = productsByCategory[categorySlug];
  if (!cat) return null;
  const resolvedSlug = PRODUCT_SLUG_ALIASES[categorySlug]?.[productSlug] || productSlug;
  const treatment = cat.treatments.find((item) => slugify(item.name) === resolvedSlug);
  return treatment ? { category: cat, treatment } : null;
}
