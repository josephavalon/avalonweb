import { money, subscriberPrice, slugify } from './slugify.js';
import {
  byKey,
  defaultFaq,
  defaultTimeline,
  namedSession,
  treatmentFromDose,
} from './treatment-builders.js';

export const productsByCategory = {
  cbd: {
    title: 'CBD IV Therapy',
    subtitle: 'Clinical review',
    badge: 'Eligibility confirmed before treatment',
    description:
      'CBD IV appointments are clinician-reviewed wellness visits. Avalon confirms eligibility, dose, and timing before treatment.',
    heroImage: null,
    categoryLabel: 'CBD IV Therapy',
    backTo: '/services/cbd',
    backLabel: 'Back to CBD IV Therapy',
    treatments: byKey.cbd.doses.map((dose) => ({
      ...treatmentFromDose(byKey.cbd, dose),
      name: `CBD IV ${dose.label}`,
      desc: 'Clinician-reviewed CBD IV wellness appointment. Eligibility and dosing are confirmed before treatment.',
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
        timeline: defaultTimeline('1-4 hr'),
        faq: defaultFaq(byKey.nad),
        related: ['nad-iv-250mg', 'myers-cocktail-iv', 'energy-iv'],
        image: '/bags/nad-750.webp',
      },
    ],
  },
  'iv-vitamins': {
    title: 'IV THERAPY',
    subtitle: 'Medical-grade intravenous vitamin therapy',
    description:
      'Every IV is customized and made fresh on-site with medical-grade ingredients - B-complex vitamins, glutathione, magnesium, zinc, and electrolytes.',
    heroImage: null,
    categoryLabel: 'IV Therapy',
    backTo: '/services/iv-vitamins',
    backLabel: 'Back to IV Therapy',
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
      namedSession(byKey.beauty, 'Beauty IV', {
        benefitStatement: 'Glutathione, biotin, and Vitamin C — nutrients associated with skin, hair, and nails.',
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
        image: '/bags/performance.webp',
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
        image: '/bags/food-poisoning.webp',
        idealFor: ['Recovery', 'Travel', 'Wellness'],
        related: ['hydration-iv', 'recovery-iv', 'post-night-out-iv'],
      }),
    ],
  },
};

// Legacy slugs that linked into the old category pages map to the new
// canonical product slugs. Keep this alongside `productsByCategory` so the
// resolver in `getProduct` finds them without crossing the file boundary.
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
    'travel-iv': 'jet-lag-iv',
    'night-out-iv': 'post-night-out-iv',
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
    'nad-vitality': 'nad-iv-vitality',
  },
  cbd: {
    'cbd-33mg': 'cbd-iv-33mg',
    'cbd-66mg': 'cbd-iv-66mg',
    'cbd-99mg': 'cbd-iv-99mg',
    'cbd-132mg': 'cbd-iv-132mg',
    'cbd-vitality': 'cbd-iv-vitality',
  },
};

export function getProduct(categorySlug, productSlug) {
  const cat = productsByCategory[categorySlug];
  if (!cat) return null;
  const resolvedSlug = PRODUCT_SLUG_ALIASES[categorySlug]?.[productSlug] || productSlug;
  const treatment = cat.treatments.find((item) => slugify(item.name) === resolvedSlug);
  return treatment ? { category: cat, treatment } : null;
}
