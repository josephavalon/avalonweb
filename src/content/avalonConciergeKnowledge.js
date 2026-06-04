const PHONE_DISPLAY = '(415) 980-7708';

export const AVALON_CONCIERGE_PROMPTS = [
  'What can I book?',
  'What do I pay today?',
  'Where do you serve?',
  'Can I use VITALITY26?',
];

const RESPONSE_BANK = {
  greeting:
    'Welcome to Avalon. I can help with booking, therapies, pricing, memberships, service area, and checkout. For clinical guidance, the nurse reviews your intake after you book.',
  booking:
    'Book in five steps: choose therapy, add-ons, date/time, address, then confirm and pay. After checkout, Avalon reviews intake and a nurse texts you shortly.',
  services:
    'Avalon offers mobile IV therapy bases including Hydration, Myers Cocktail, Night Out, Immunity, Energy, Recovery, Performance, Jet Lag, and Food Poisoning support. Advanced paths include NAD+ and CBD dose selections when clinically appropriate.',
  pricing:
    'One-time IV visits use a $50 deposit to book. The remaining balance is due after the visit is completed. Hydration is $200. Most core IV bases are $250 before add-ons, tax, or eligible discounts.',
  advanced:
    'NAD+ and CBD are dose-based. NAD+ ranges from 250mg to 1500mg with longer appointment windows. CBD ranges from 33mg to 132mg and remains approval-gated. Final eligibility is reviewed clinically.',
  memberships:
    'Memberships are monthly. Starter is $199/mo, Pro is $389/mo, and VIP is $899/mo. Membership checkout charges the first month today and uses the current plan terms shown before payment.',
  discount:
    'New customers can enter code VITALITY26 at checkout for 15% off when eligible.',
  serviceArea:
    'Avalon serves eligible Bay Area homes, hotels, offices, launches, and events. Add your address during booking so the team can confirm coverage and timing.',
  timing:
    'Same-day timing may be available depending on nurse coverage, protocol, location, and clinical review. After checkout, a nurse texts with the arrival window.',
  payment:
    'Checkout runs through Stripe. Card payment is supported, and Apple Pay or Google Pay can appear when your device, browser, and Stripe eligibility allow it.',
  clinical:
    'I cannot give medical advice or promise eligibility. Complete the intake during booking and Avalon clinical review will confirm, adjust, or decline if needed.',
  contact:
    `You can text or call Avalon at ${PHONE_DISPLAY}. The fastest path is to start with BOOK so the team has your intake and address.`,
  script:
    'I am using the Avalon site knowledge base now. When you upload the concierge script, I can be updated to follow that exact language.',
  fallback:
    'I can help with booking, therapies, pricing, memberships, service area, checkout, or VITALITY26. For anything medical, the nurse reviews your intake after booking.',
};

const INTENTS = [
  {
    key: 'discount',
    terms: ['discount', 'code', 'promo', 'coupon', 'vitality26', '15'],
  },
  {
    key: 'pricing',
    terms: ['price', 'cost', 'pay', 'deposit', 'balance', 'due', '$50', 'today'],
  },
  {
    key: 'advanced',
    terms: ['nad', 'cbd', 'dose', 'mg', 'advanced'],
  },
  {
    key: 'services',
    terms: ['therapy', 'therapies', 'iv', 'hydration', 'myers', 'night', 'immunity', 'energy', 'recovery', 'performance', 'jet', 'food poisoning'],
  },
  {
    key: 'memberships',
    terms: ['membership', 'memberships', 'subscription', 'plan', 'starter', 'pro', 'vip', 'monthly'],
  },
  {
    key: 'serviceArea',
    terms: ['where', 'area', 'serve', 'location', 'home', 'hotel', 'office', 'bay area', 'san francisco', 'address'],
  },
  {
    key: 'timing',
    terms: ['when', 'fast', 'soon', 'same day', 'arrival', 'time', 'schedule', 'available'],
  },
  {
    key: 'payment',
    terms: ['stripe', 'apple pay', 'google pay', 'card', 'checkout', 'payment'],
  },
  {
    key: 'booking',
    terms: ['book', 'booking', 'appointment', 'reserve', 'confirm'],
  },
  {
    key: 'clinical',
    terms: ['medical', 'clinical', 'safe', 'eligible', 'eligibility', 'contraindication', 'pregnant', 'medication', 'doctor', 'nurse'],
  },
  {
    key: 'contact',
    terms: ['call', 'text', 'phone', 'human', 'person', 'support', 'help'],
  },
  {
    key: 'script',
    terms: ['script', 'trained', 'training', 'website'],
  },
];

function normalize(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasAnyTerm(input, terms) {
  return terms.some((term) => input.includes(term));
}

function isGreeting(input) {
  return /^(hi|hello|hey|yo|sup|start|help)\b/.test(input);
}

export function getAvalonConciergeReply(rawInput = '') {
  const input = normalize(rawInput);

  if (!input) return RESPONSE_BANK.greeting;
  if (isGreeting(input)) return RESPONSE_BANK.greeting;

  const match = INTENTS.find((intent) => hasAnyTerm(input, intent.terms));
  return RESPONSE_BANK[match?.key] || RESPONSE_BANK.fallback;
}

