// Single source of truth for all product catalog data.
//
// Schema per category:
//   {
//     title, subtitle, description, badge, heroImage,  // service-page chrome
//     treatments: [{ name, desc, image, price|oneTime, annualPrice|monthly, annual }]
//   }
//
// Field conventions (kept from original service-page arrays):
//   - CBD / NAD:  price = session rate, annualPrice = per-unit MONTHLY member rate
//                 (annual membership cost = monthly × 12, computed at render)
//   - IV Vitamins: oneTime = session, monthly = monthly member rate, annual = explicit annual total
//
// slugify() must match the helper in ServicePageLayout so card links line up
// with ProductDetail lookups.

export const slugify = (name) =>
  String(name)
    .toLowerCase()
    .replace(/\+/g, ' ') // NAD+ → NAD (before alphanum strip)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const productsByCategory = {
  cbd: {
    title: 'IV CBD',
    subtitle: 'Zero THC · Pharmaceutical-grade cannabidiol',
    badge: '100% Zero THC — Pharmaceutical Grade',
    description:
      'Pharmaceutical-grade cannabidiol, delivered intravenously. Zero THC. 100% bioavailability. Dose levels from 33mg upward — your clinician will match the dose to your goals.',
    heroImage: null,
    categoryLabel: 'IV CBD',
    backTo: '/services/cbd',
    backLabel: 'Back to IV CBD',
    treatments: [
      {
        name: 'CBD 33mg',
        price: '$250',
        annualPrice: '$200',
        desc: 'Entry dose of pharmaceutical-grade cannabidiol. Zero THC.',
        image: '/bags/cbd-33.png',
      },
      {
        name: 'CBD 66mg',
        price: '$300',
        annualPrice: '$240',
        desc: 'Mid-range dose — commonly chosen for post-workout and wind-down rituals.',
        image: '/bags/cbd-66.png',
      },
      {
        name: 'CBD 99mg',
        price: '$350',
        annualPrice: '$280',
        desc: 'Higher dose — a common choice for heavier-load recovery days.',
        image: '/bags/cbd-99.png',
      },
      {
        name: 'CBD 132mg',
        price: '$400',
        annualPrice: '$320',
        desc: 'Maximum dose, reserved for members on a clinician-guided recovery protocol.',
        image: '/bags/cbd-132.png',
      },
      {
        name: "CBD + Myers' Cocktail",
        price: '$350',
        annualPrice: '$280',
        desc: 'CBD paired with B vitamins and amino acids.',
        image: '/bags/cbd-99.png',
      },
    ],
  },

  nad: {
    title: 'IV NAD+',
    subtitle: 'The longevity molecule',
    badge: 'Cellular Energy · Cognitive Support · Longevity',
    description:
      'NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme involved in many biological processes; research has associated it with energy metabolism, DNA integrity, and cognitive function. Natural NAD+ levels decline with age. This is educational content, not medical advice — your clinician will decide if IV NAD+ is appropriate for you.',
    heroImage: null,
    categoryLabel: 'IV NAD+',
    backTo: '/services/nad',
    backLabel: 'Back to IV NAD+',
    treatments: [
      { name: 'NAD+ 250mg', price: '$350', annualPrice: '$280', desc: 'Entry-level NAD+ — an introductory dose.', image: '/bags/nad-250.png' },
      { name: 'NAD+ 500mg', price: '$500', annualPrice: '$400', desc: 'Mid-range dose — a common step-up for regular members.', image: '/bags/nad-500.png' },
      { name: 'NAD+ 750mg', price: '$600', annualPrice: '$480', desc: 'Advanced dose — chosen by members on longer-term protocols.', image: '/bags/nad-750.png' },
      { name: 'NAD+ 1000mg', price: '$800', annualPrice: '$640', desc: 'High-dose NAD+ — typical for advanced wellness routines.', image: '/bags/nad-1000.png' },
      { name: 'NAD+ 1250mg', price: '$950', annualPrice: '$760', desc: 'Elite dose reserved for clinician-guided longevity protocols.', image: '/bags/nad-1500.png' },
      { name: 'NAD+ 1500mg', price: '$1,100', annualPrice: '$880', desc: 'Maximum dose — reserved for members on clinician-guided protocols.', image: '/bags/nad-1500.png' },
      { name: "NAD+ Myers' Cocktail", price: '$700', annualPrice: '$560', desc: 'NAD+ paired with B vitamins and amino acids.', image: '/bags/nad-750.png' },
    ],
  },

  'iv-vitamins': {
    title: 'IV VITAMINS',
    subtitle: 'Medical-grade intravenous vitamin therapy',
    description:
      'Every IV is customized and made fresh on-site with medical-grade ingredients — B-complex vitamins, glutathione, magnesium, zinc, and electrolytes. Tailored to your needs, administered by licensed RNs wherever you are.',
    heroImage: null,
    categoryLabel: 'IV Vitamins',
    backTo: '/services/iv-vitamins',
    backLabel: 'Back to IV Vitamins',
    treatments: [
      { name: 'Dehydration', oneTime: '$150', monthly: '$120', annual: '$1,440', desc: '1000ml saline with electrolytes. A classic formula used for hydration support.', image: '/bags/dehydration.png' },
      { name: "Myers' Cocktail", oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'A classic IV formula featuring B-complex, Vitamin C, magnesium, calcium, and zinc.', image: '/bags/immunity.png' },
      { name: 'Event Recovery', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Post-event hydration with amino acids and electrolytes — popular with clients bouncing back from long days.', image: '/bags/recovery.png' },
      { name: 'Event Performance', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Pre-event hydration featuring B vitamins and amino acids — often chosen by performers and athletes.', image: '/bags/energy.png' },
      { name: 'Energy', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'B12, B-complex, and amino acids — nutrients commonly associated with daily energy.', image: '/bags/energy.png' },
      { name: 'Post-Night-Out', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Saline, B vitamins, and glutathione — a well-known combination for rehydration.', image: '/bags/recovery.png' },
      { name: 'Immunity', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'High-dose Vitamin C and zinc — nutrients often chosen for immune support.', image: '/bags/immunity.png' },
      { name: 'Beauty', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Glutathione, biotin, Vitamin C, and collagen — nutrients associated with skin, hair, and nails.', image: '/bags/beauty.png' },
      { name: 'Jet Lag', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Melatonin support, B vitamins, and full hydration — popular with travelers adjusting to new time zones.', image: '/bags/jet-lag.png' },
      { name: 'Food Poisoning', oneTime: '$250', monthly: '$200', annual: '$1,800', desc: 'Electrolytes, anti-nausea support, and hydration — commonly chosen after GI distress.', image: '/bags/food-poisoning.png' },
    ],
  },
};

export function getProduct(categorySlug, productSlug) {
  const cat = productsByCategory[categorySlug];
  if (!cat) return null;
  const treatment = cat.treatments.find((t) => slugify(t.name) === productSlug);
  if (!treatment) return null;
  return { category: cat, treatment };
}
