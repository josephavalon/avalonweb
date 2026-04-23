/**
 * Vertical configuration registry.
 *
 * Single source of truth for every modality category the platform offers or
 * plans to offer. Consumed by IntroSection.jsx (the roadmap grid), the apply
 * flow, the member dashboard, and the analytics event taxonomy.
 *
 * Adding a vertical:
 *   1. Append a new entry below with status: 'roadmap' and launchQuarter.
 *   2. Ship its Modality configs under src/lib/protocol/modalities/.
 *   3. Flip status to 'live' on the launch date — IntroSection picks it up.
 *
 * No structure/function claims in the tagline copy. Educational framing only.
 */

import { VERTICAL_STATUS } from './types';

export const VERTICALS = Object.freeze([
  {
    id: 'iv',
    label: 'IV Vitamins',
    tagline: 'Hydration and vitamin support, administered by licensed nurses.',
    status: VERTICAL_STATUS.LIVE,
    icon: 'Droplets',
  },
  {
    id: 'nad',
    label: 'NAD+',
    tagline: 'Intravenous NAD+ in clinician-selected dosing.',
    status: VERTICAL_STATUS.LIVE,
    icon: 'Zap',
  },
  {
    id: 'cbd',
    label: 'CBD',
    tagline: 'Broad-spectrum CBD IV — zero THC.',
    status: VERTICAL_STATUS.LIVE,
    icon: 'CannabisLeaf',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    tagline: 'Biomarker panels, hormones, and wearable integration.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2026-Q3',
    icon: 'TestTube',
  },
  {
    id: 'peptides',
    label: 'Peptides',
    tagline: 'Clinician-prescribed peptide protocols with in-person titration.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2026-Q3',
    icon: 'Link',
  },
  {
    id: 'trt',
    label: 'Hormone Optimization',
    tagline: 'Testosterone and sexual wellness protocols under medical supervision.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2026-Q4',
    icon: 'Heart',
  },
  {
    id: 'regenerative-aesthetics',
    label: 'Regenerative Aesthetics',
    tagline: 'PRP, microneedling, and biologic skin protocols by board-certified providers.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2027-Q1',
    icon: 'CircleUser',
  },
  {
    id: 'supplements',
    label: 'Supplements',
    tagline: 'Member-only formulations paired to your Protocol.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2026-Q4',
    icon: 'Pill',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    tagline: 'Registered dietitian guidance integrated with your Protocol.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2027-Q2',
    icon: 'Apple',
  },
  // Experience / recovery verticals — roadmap placeholders surfaced on the grid.
  {
    id: 'contrast',
    label: 'Contrast Therapy',
    tagline: 'Hot and cold recovery in partner studios.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2027-Q2',
    icon: 'Flame',
  },
  {
    id: 'recovery-devices',
    label: 'Recovery Devices',
    tagline: 'Red-light, PEMF, and compression at member locations.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2027-Q2',
    icon: 'Lightbulb',
  },
  {
    id: 'fitness',
    label: 'Personal Fitness',
    tagline: 'Performance coaching integrated with your Protocol.',
    status: VERTICAL_STATUS.ROADMAP,
    launchQuarter: '2027-Q3',
    icon: 'Dumbbell',
  },
]);

/** @param {string} id */
export const getVertical = (id) => VERTICALS.find((v) => v.id === id);

export const getLiveVerticals = () => VERTICALS.filter((v) => v.status === VERTICAL_STATUS.LIVE);
export const getRoadmapVerticals = () => VERTICALS.filter((v) => v.status !== VERTICAL_STATUS.LIVE);
