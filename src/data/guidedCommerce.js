/**
 * @typedef {Object} GuidedAnswers
 * @property {string} goal
 * @property {string} context
 * @property {string} timing
 */

/**
 * @typedef {Object} RecommendationRule
 * @property {string[]} primaryGoals
 * @property {string[]} secondaryGoals
 * @property {string[]} exactContexts
 * @property {string[]} relatedContexts
 * @property {Record<string, number>} timing
 */

/**
 * @typedef {Object} Offering
 * @property {string} id
 * @property {string} name
 * @property {string} protocolKey
 * @property {string} [doseKey]
 * @property {number} priority
 * @property {boolean} enabled
 * @property {boolean} recommendable
 * @property {RecommendationRule} rules
 */

export const GUIDED_GOALS = Object.freeze([
  { id: 'recover', label: 'Recover' },
  { id: 'feel-better', label: 'Feel Better' },
  { id: 'energy', label: 'Energy' },
  { id: 'immunity', label: 'Immunity' },
  { id: 'performance', label: 'Performance' },
  { id: 'long-term-wellness', label: 'Long-Term Wellness' },
]);

export const GUIDED_CONTEXTS = Object.freeze({
  recover: {
    question: 'What are you recovering from?',
    options: [
      { id: 'workout', label: 'Workout' },
      { id: 'night-out', label: 'Night Out' },
      { id: 'travel', label: 'Travel' },
      { id: 'illness', label: 'Illness' },
      { id: 'jet-lag', label: 'Jet Lag' },
      { id: 'general-recovery', label: 'General Recovery' },
    ],
  },
  'feel-better': {
    question: "What's going on?",
    options: [
      { id: 'dehydrated', label: 'Dehydrated' },
      { id: 'run-down', label: 'Run Down' },
      { id: 'stressed', label: 'Stressed' },
      { id: 'sick', label: 'Sick' },
      { id: 'travel-fatigue', label: 'Travel Fatigue' },
      { id: 'general-wellness', label: 'General Wellness' },
    ],
  },
  energy: {
    question: 'What are you looking for?',
    options: [
      { id: 'more-energy', label: 'More Energy' },
      { id: 'mental-clarity', label: 'Mental Clarity' },
      { id: 'burnout-recovery', label: 'Burnout Recovery' },
      { id: 'travel-recovery', label: 'Travel Recovery' },
      { id: 'performance', label: 'Performance' },
      { id: 'general-support', label: 'General Support' },
    ],
  },
  immunity: {
    question: "What's your focus?",
    options: [
      { id: 'feeling-sick', label: 'Feeling Sick' },
      { id: 'prevention', label: 'Prevention' },
      { id: 'travel', label: 'Travel' },
      { id: 'recovery', label: 'Recovery' },
      { id: 'general-support', label: 'General Support' },
    ],
  },
  performance: {
    question: 'What are you optimizing?',
    options: [
      { id: 'workout-recovery', label: 'Workout Recovery' },
      { id: 'athletic-performance', label: 'Athletic Performance' },
      { id: 'energy', label: 'Energy' },
      { id: 'focus', label: 'Focus' },
      { id: 'hydration', label: 'Hydration' },
      { id: 'general-performance', label: 'General Performance' },
    ],
  },
  'long-term-wellness': {
    question: 'What matters most?',
    options: [
      { id: 'longevity', label: 'Longevity' },
      { id: 'cellular-health', label: 'Cellular Health' },
      { id: 'mental-clarity', label: 'Mental Clarity' },
      { id: 'energy', label: 'Energy' },
      { id: 'stress-relaxation', label: 'Stress / Relaxation' },
      { id: 'general-wellness', label: 'General Wellness' },
    ],
  },
});

export const GUIDED_TIMINGS = Object.freeze([
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This Week' },
  { id: 'ongoing', label: 'Ongoing' },
]);

const ACUTE = Object.freeze({ today: 3, 'this-week': 2, ongoing: 0 });
const RECOVERY = Object.freeze({ today: 3, 'this-week': 2, ongoing: 1 });
const ROUTINE = Object.freeze({ today: 1, 'this-week': 2, ongoing: 3 });

/** @type {Offering[]} */
export const GUIDED_OFFERINGS = Object.freeze([
  {
    id: 'recovery', name: 'Recovery IV', protocolKey: 'recovery', priority: 0, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['recover', 'performance'], secondaryGoals: ['feel-better', 'energy'],
      exactContexts: ['workout', 'general-recovery', 'recovery', 'workout-recovery'],
      relatedContexts: ['run-down', 'burnout-recovery', 'athletic-performance', 'general-performance'],
      timing: RECOVERY,
    },
  },
  {
    id: 'hydration', name: 'Hydration IV', protocolKey: 'hydration', priority: 1, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['feel-better', 'recover', 'performance'], secondaryGoals: ['energy', 'immunity'],
      exactContexts: ['dehydrated', 'hydration'],
      relatedContexts: ['travel', 'travel-fatigue', 'travel-recovery', 'workout', 'night-out', 'jet-lag', 'general-recovery', 'workout-recovery'],
      timing: RECOVERY,
    },
  },
  {
    id: 'myers', name: "Myers' IV", protocolKey: 'myers', priority: 2, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['energy', 'feel-better', 'long-term-wellness'], secondaryGoals: ['recover', 'immunity', 'performance'],
      exactContexts: ['general-wellness', 'general-support', 'run-down'],
      relatedContexts: ['more-energy', 'mental-clarity', 'burnout-recovery', 'prevention', 'energy', 'focus'],
      timing: ROUTINE,
    },
  },
  {
    id: 'energy', name: 'Energy IV', protocolKey: 'energy', priority: 3, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['energy', 'performance'], secondaryGoals: ['feel-better', 'long-term-wellness'],
      exactContexts: ['more-energy', 'energy', 'burnout-recovery'],
      relatedContexts: ['mental-clarity', 'performance', 'athletic-performance', 'focus', 'general-performance'],
      timing: ROUTINE,
    },
  },
  {
    id: 'immunity', name: 'Immunity IV', protocolKey: 'immunity', priority: 4, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['immunity', 'feel-better'], secondaryGoals: ['recover', 'long-term-wellness'],
      exactContexts: ['illness', 'sick', 'feeling-sick', 'prevention'],
      relatedContexts: ['run-down', 'travel', 'general-support', 'general-wellness'],
      timing: { today: 2, 'this-week': 2, ongoing: 3 },
    },
  },
  {
    id: 'performance', name: 'Performance IV', protocolKey: 'recovery', priority: 5, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['performance', 'energy'], secondaryGoals: ['recover', 'long-term-wellness'],
      exactContexts: ['performance', 'workout-recovery', 'athletic-performance', 'general-performance'],
      relatedContexts: ['workout', 'more-energy', 'energy', 'focus'],
      timing: ROUTINE,
    },
  },
  {
    id: 'night-out', name: 'Night Out IV', protocolKey: 'postnight', priority: 6, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['recover'], secondaryGoals: ['feel-better'],
      exactContexts: ['night-out'], relatedContexts: ['dehydrated', 'general-recovery'], timing: ACUTE,
    },
  },
  {
    id: 'jet-lag', name: 'Jet Lag IV', protocolKey: 'jetlag', priority: 7, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['recover', 'feel-better', 'energy'], secondaryGoals: ['immunity', 'performance'],
      exactContexts: ['jet-lag', 'travel-fatigue', 'travel-recovery'], relatedContexts: ['travel'], timing: ACUTE,
    },
  },
  {
    id: 'nad-250', name: 'NAD+ IV 250mg', protocolKey: 'nad', doseKey: 'nad_250', priority: 8, enabled: true, recommendable: true,
    rules: {
      primaryGoals: ['long-term-wellness'], secondaryGoals: ['energy', 'performance'],
      exactContexts: ['longevity', 'cellular-health'],
      relatedContexts: ['mental-clarity', 'burnout-recovery', 'focus', 'more-energy', 'energy', 'general-wellness'],
      timing: { today: 0, 'this-week': 2, ongoing: 4 },
    },
  },
  {
    id: 'food-poisoning', name: 'Food Poisoning IV', protocolKey: 'postnight', priority: 20, enabled: true, recommendable: false,
    rules: { primaryGoals: [], secondaryGoals: [], exactContexts: [], relatedContexts: [], timing: ACUTE },
  },
  {
    id: 'beauty', name: 'Beauty IV', protocolKey: 'beauty', priority: 21, enabled: true, recommendable: false,
    rules: { primaryGoals: [], secondaryGoals: [], exactContexts: [], relatedContexts: [], timing: ROUTINE },
  },
  ...['nad-500', 'nad-750', 'nad-vitality', 'nad-1000', 'nad-1250', 'nad-1500'].map((id, index) => ({
    id,
    name: id === 'nad-vitality' ? 'NAD+ Vitality' : `NAD+ IV ${id.split('-')[1]}mg`,
    protocolKey: 'nad',
    doseKey: id.replace('-', '_'),
    priority: 30 + index,
    enabled: true,
    recommendable: false,
    rules: { primaryGoals: [], secondaryGoals: [], exactContexts: [], relatedContexts: [], timing: { today: 0, 'this-week': 0, ongoing: 0 } },
  })),
  {
    id: 'cbd', name: 'CBD IV', protocolKey: 'cbd', priority: 40, enabled: false, recommendable: true,
    rules: {
      primaryGoals: ['feel-better', 'recover', 'long-term-wellness'], secondaryGoals: [],
      exactContexts: ['stressed', 'stress-relaxation'], relatedContexts: ['general-recovery', 'general-wellness'], timing: ROUTINE,
    },
  },
]);

export function getGuidedGoal(goalId) {
  return GUIDED_GOALS.find((goal) => goal.id === goalId) || null;
}

export function getGuidedContext(goalId, contextId) {
  return GUIDED_CONTEXTS[goalId]?.options.find((context) => context.id === contextId) || null;
}

export function getGuidedTiming(timingId) {
  return GUIDED_TIMINGS.find((timing) => timing.id === timingId) || null;
}

export function getGuidedOffering(offeringId) {
  return GUIDED_OFFERINGS.find((offering) => offering.id === offeringId) || null;
}

export function buildGuidedStartPath(offering) {
  const params = new URLSearchParams({
    therapy: offering.id,
    protocol: offering.protocolKey,
    source: 'guided',
  });
  if (offering.doseKey) params.set('dose', offering.doseKey);
  return `/start?${params.toString()}`;
}
