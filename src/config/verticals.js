/**
 * verticals.js — Avalon Vitality Protocol Config
 *
 * Single source of truth for every service vertical.
 * Adding a new vertical (e.g. Peptides Jul '26) = add one entry to VERTICALS.
 * Store.jsx and any future vertical page render dynamically from this config.
 *
 * Shape per vertical:
 *   slug, label, active, launchDate,
 *   sessions, addons, shots, packages,
 *   categories, goalRecommendation
 */

import {
  Droplets, Zap, ShieldCheck, Sparkles, Heart, Plane, FlaskConical, Moon,
  Flame, BatteryCharging, Shield, LayoutGrid,
} from 'lucide-react';

// ── IV Therapy ──────────────────────────────────────────────────────────────

const IV_SESSIONS = [
  {
    key: 'hydration', label: 'Hydration', price: 150, icon: Droplets,
    tagline: 'Rehydrate, replenish, and recover fast.',
    tag: 'Essential', category: 'recovery',
    duration: '30–45 min',
    inside: 'Saline (500–1000ml) · Electrolytes · B-Complex · Trace minerals',
  },
  {
    key: 'energy', label: 'Energy', price: 250, icon: Zap,
    tagline: 'Boost energy, sharpen focus, perform.',
    tag: 'Performance', category: 'energy',
    duration: '45–60 min',
    inside: 'Saline · Vitamin B12 · B-Complex · Magnesium · Taurine · Vitamin C',
  },
  {
    key: 'immunity', label: 'Immunity', price: 250, icon: ShieldCheck,
    tagline: 'Strengthen your defenses, fast.',
    tag: 'Bestseller', category: 'immunity',
    duration: '45–60 min',
    inside: 'High-dose Vitamin C · Zinc · Selenium · Glutathione · Saline',
  },
  {
    key: 'beauty', label: 'Beauty', price: 250, icon: Sparkles,
    tagline: 'Glow from within.',
    tag: 'Glow Favorite', category: 'beauty',
    duration: '45–60 min',
    inside: 'Glutathione · Biotin · Vitamin C · B-Complex · Collagen support nutrients · Saline',
  },
  {
    key: 'recovery', label: 'Recovery', price: 250, icon: Heart,
    tagline: 'Bounce back faster. Feel better sooner.',
    tag: 'Same-Day Favorite', category: 'recovery',
    duration: '45–60 min',
    inside: 'Saline · Magnesium · B-Complex · Amino acids · Anti-nausea support · Electrolytes',
  },
  {
    key: 'jetlag', label: 'Jet Lag', price: 250, icon: Plane,
    tagline: 'Land ready. Recover in flight time.',
    tag: 'Travel Essential', category: 'travel',
    duration: '45–60 min',
    inside: 'Saline · Vitamin B12 · Magnesium · B-Complex · Electrolytes · Immune support blend',
  },
  {
    key: 'myers', label: "Myers' Cocktail", price: 250, icon: FlaskConical,
    tagline: 'The gold standard of IV therapy.',
    tag: 'Most Popular', category: 'energy', popular: true,
    duration: '45–60 min',
    inside: 'Magnesium · Calcium · Vitamins B1 B2 B3 B5 B6 · Vitamin C · Saline',
  },
  {
    key: 'postnight', label: 'Post-Night-Out', price: 250, icon: Moon,
    tagline: 'Back to baseline, fast.',
    tag: 'Same-Day Favorite', category: 'recovery',
    duration: '45–60 min',
    inside: 'Saline · Anti-nausea support · B-Complex · Glutathione · Zofran (if indicated) · Electrolytes',
  },
  {
    key: 'nad_session', label: 'NAD+', price: 350, icon: BatteryCharging,
    tagline: 'Cellular energy and metabolic support.',
    tag: 'Advanced', category: 'energy',
    duration: '2–4 hrs',
    inside: 'NAD+ 250mg · Saline · B-Complex',
  },
  {
    key: 'exosomes_30', label: 'Exosomes 30B', price: 700, icon: Sparkles,
    tagline: 'Regenerative cellular support.',
    tag: 'Elite', category: 'recovery',
    duration: '45–60 min',
    inside: 'Exosomes 30 Billion Units · Saline',
    elite: true,
  },
  {
    key: 'exosomes_50', label: 'Exosomes 50B', price: 1200, icon: Sparkles,
    tagline: 'Advanced regenerative protocol.',
    tag: 'Elite', category: 'recovery',
    duration: '60–75 min',
    inside: 'Exosomes 50 Billion Units · Saline',
    elite: true,
  },
  {
    key: 'exosomes_90', label: 'Exosomes 90B', price: 1800, icon: Sparkles,
    tagline: 'The highest-dose regenerative experience.',
    tag: 'Elite', category: 'recovery',
    duration: '60–90 min',
    inside: 'Exosomes 90 Billion Units · Saline',
    elite: true,
  },
];

const IV_ADDONS = [
  { label: 'Extra Fluid',         price: 25,  desc: 'Additional 500ml saline'             },
  { label: 'Extra Ingredients',   price: 30,  desc: 'B-complex, minerals & amino boost'   },
  { label: 'High Dose Vitamin C', price: 45,  desc: '5,000mg IV push'                     },
  { label: 'CBD (33mg)',          price: 250, desc: 'Zero THC · full bioavailability'     },
  { label: 'NAD+ (250mg)',        price: 350, desc: 'Cellular energy + repair'            },
  { label: 'Glutathione Push',    price: 60,  desc: 'Antioxidant master push · 600mg'     },
  { label: 'Magnesium Boost',     price: 30,  desc: 'Muscle + nerve support'              },
];

const IM_SHOTS = [
  { label: 'B12',         price: 40,  max: 5, icon: Zap,             desc: 'Energy + metabolism support'      },
  { label: 'MIC',         price: 50,          icon: Flame,           desc: 'Fat metabolism + liver function'  },
  { label: 'NAD+',        price: 80,          icon: BatteryCharging, desc: 'Quick cellular energy boost'      },
  { label: 'Glutathione', price: 50,  max: 5, icon: Sparkles,        desc: 'Antioxidant + skin clarity'       },
  { label: 'Vitamin C',   price: 30,          icon: Shield,          desc: 'Immune + antioxidant support'     },
  { label: 'Vitamin D',   price: 35,          icon: Zap,             desc: 'Bone, immune & mood support'      },
  { label: 'Biotin',      price: 35,          icon: Sparkles,        desc: 'Hair, skin & nail support'        },
];

const PACKAGES = [
  {
    key: 'hangover',
    label: 'Hangover Kit',
    tagline: 'Recover from a rough night — fast.',
    includes: ['Post-Night-Out IV', 'B12 IM shot', 'Glutathione IM shot'],
    price: 340,
    save: 30,
    icon: Moon,
    tag: 'Best for Tonight',
    items: [
      { cartKey: 'pkg-hangover-iv',   label: 'Post-Night-Out IV', price: 250, type: 'iv' },
      { cartKey: 'pkg-hangover-b12',  label: 'IM · B12',          price: 40,  type: 'im' },
      { cartKey: 'pkg-hangover-glut', label: 'IM · Glutathione',  price: 50,  type: 'im' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance Bundle',
    tagline: 'Built for peak output. Before or after.',
    includes: ['Energy IV', 'NAD+ IM shot', 'MIC IM shot'],
    price: 380,
    save: 30,
    icon: Zap,
    tag: 'Athlete Favorite',
    items: [
      { cartKey: 'pkg-perf-iv',  label: 'Energy IV',   price: 250, type: 'iv' },
      { cartKey: 'pkg-perf-nad', label: 'IM · NAD+',   price: 80,  type: 'im' },
      { cartKey: 'pkg-perf-mic', label: 'IM · MIC',    price: 50,  type: 'im' },
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
      { cartKey: 'pkg-glow-iv',    label: 'Beauty IV',         price: 250, type: 'iv' },
      { cartKey: 'pkg-glow-glut',  label: 'IM · Glutathione',  price: 50,  type: 'im' },
      { cartKey: 'pkg-glow-biotin',label: 'IM · Biotin',       price: 35,  type: 'im' },
    ],
  },
  {
    key: 'reset',
    label: 'Total Reset',
    tagline: "The full protocol. Myers' + NAD+ + B12.",
    includes: ["Myers' Cocktail IV", 'NAD+ add-on (250mg)', 'B12 IM shot'],
    price: 680,
    save: 60,
    icon: FlaskConical,
    tag: 'Highest Impact',
    items: [
      { cartKey: 'pkg-reset-iv',    label: "Myers' Cocktail IV",  price: 250, type: 'iv'    },
      { cartKey: 'pkg-reset-nad',   label: 'NAD+ Add-On (250mg)', price: 350, type: 'addon' },
      { cartKey: 'pkg-reset-b12',   label: 'IM · B12',            price: 40,  type: 'im'    },
      { cartKey: 'pkg-reset-extra', label: 'Extra Fluid',         price: 25,  type: 'addon' },
    ],
  },
];

const IV_CATEGORIES = [
  { key: 'all',      label: 'Not Sure', icon: LayoutGrid  },
  { key: 'recovery', label: 'Recovery', icon: Heart       },
  { key: 'energy',   label: 'Energy',   icon: Zap         },
  { key: 'beauty',   label: 'Beauty',   icon: Sparkles    },
  { key: 'immunity', label: 'Immunity', icon: ShieldCheck },
  { key: 'travel',   label: 'Travel',   icon: Plane       },
  { key: 'elite',    label: 'Elite',    icon: Sparkles    },
];

// Goal chip → recommended session key
const IV_GOAL_RECOMMENDATION = {
  recovery: 'recovery',  // Recovery IV
  energy:   'myers',     // Myers' Cocktail
  beauty:   'beauty',    // Beauty IV
  packages: 'hangover',  // surfaced in Packages tab, handled separately
};

// ── Vertical registry ───────────────────────────────────────────────────────

export const VERTICALS = {
  iv_therapy: {
    slug: 'iv_therapy',
    label: 'IV Therapy',
    active: true,
    launchDate: '2026-05-01',
    sessions:          IV_SESSIONS,
    addons:            IV_ADDONS,
    shots:             IM_SHOTS,
    packages:          PACKAGES,
    categories:        IV_CATEGORIES,
    goalRecommendation: IV_GOAL_RECOMMENDATION,
  },

  // ── Coming Jul '26 ──────────────────────────────────────────────────────
  // peptides: {
  //   slug: 'peptides',
  //   label: 'Peptides',
  //   active: false,
  //   launchDate: '2026-07-01',
  //   sessions: [],
  //   addons: [],
  //   shots: [],
  //   packages: [],
  //   categories: [],
  //   goalRecommendation: {},
  // },

  // ── Coming Q4 '26 ───────────────────────────────────────────────────────
  // trt_sex_health: { active: false, launchDate: '2026-10-01', ... },
};

// ── Named convenience exports (backward compat for Store.jsx) ───────────────

const iv = VERTICALS.iv_therapy;

export const SESSIONS            = iv.sessions;
export const IV_ADDONS_LIST      = iv.addons;       // alias — avoids name collision
export const IM_SHOTS_LIST       = iv.shots;
export const PACKAGES_LIST       = iv.packages;
export const IV_CATEGORIES_LIST  = iv.categories;
export const GOAL_RECOMMENDATION = iv.goalRecommendation;

// Keep old names available for any file that imports them directly
export {
  IV_SESSIONS,
  IV_ADDONS,
  IM_SHOTS,
  PACKAGES,
  IV_CATEGORIES,
  IV_GOAL_RECOMMENDATION,
};
