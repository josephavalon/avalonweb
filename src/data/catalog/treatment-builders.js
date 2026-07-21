import { money, subscriberPrice, annualPrice } from './slugify.js';
import { IV_SESSIONS } from './iv-sessions.js';

export const byKey = Object.fromEntries(IV_SESSIONS.map((session) => [session.key, session]));

export function includedSession(session, dose = null) {
  if (session.key === 'nad') return [`NAD+ ${dose?.label || 'dose selected during booking'}`, 'IV fluids', 'B-complex support', 'Clinical intake review', 'Registered nurse administration', '1-4 hr appointment window'];
  if (session.key === 'cbd') return [`CBD ${dose?.label || 'review dose'}`, 'IV fluids', 'Clinician-guided dose', 'Clinical intake review', 'Registered nurse administration'];
  return String(session.inside || 'IV fluids · Electrolytes · Vitamin support')
    .split(' · ')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function idealForSession(session) {
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

export function defaultTimeline(duration = '45-60 min') {
  return [
    { label: '0 min', value: 'Book protocol, address, and payment' },
    { label: 'Before arrival', value: 'Clinical intake review' },
    { label: 'Arrival', value: 'Registered nurse setup and vitals' },
    { label: 'Treatment', value: duration },
  ];
}

export function defaultFaq(session) {
  const duration = session.key === 'nad'
    ? 'NAD+ IV appointments are listed as 1-4 hr across all doses. Your nurse confirms pacing after clinical review.'
    : session.duration || session.doses?.[0]?.duration || 'Most visits take 30-60 minutes after clinical clearance.';
  const inside = includedSession(session).slice(0, 3).join(', ');
  return [
    { q: 'How long does it take?', a: duration },
    { q: 'What is included?', a: `${inside}. Your protocol may be adjusted by clinical review before service.` },
    { q: 'Who administers it?', a: 'A California-licensed registered nurse after intake and clinical review.' },
    { q: 'Can I book today?', a: 'Same-day availability depends on location, nurse coverage, and clinical clearance.' },
  ];
}

export function relatedForSession(key) {
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

export function treatmentFromSession(session) {
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

export function treatmentFromDose(parent, dose) {
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
    included: includedSession(parent, dose),
    timeline: defaultTimeline(dose.duration),
    faq: defaultFaq(parent),
    related: relatedForSession(parent.key),
    image: dose.image,
  };
}

export function namedSession(session, name, overrides = {}) {
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
