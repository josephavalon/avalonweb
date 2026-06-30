// Visit-credit pricing model (per avalon-visit-credit-model memory):
// each plan visit = a $250 credit; included if the chosen IV is ≤$250,
// pay-difference otherwise. Monthly price = sessions × $250.
// Stripe charges this value directly via api/create-checkout-session.js
// dynamic price_data — keep these numbers in sync with what the UI shows.
export const PLAN_VISIT_CREDIT = 250;

// Plan-member pricing incentives. Apply on top of the per-visit cart:
//   - tier discount scales with sessions (10/15/20%) on the visit-credit base
//   - addon discount is a flat 10% on every plan member's add-ons
// Single source of truth — the marketing tier cards AND the /subscription
// builder/Stripe flow both read from this. See planTierDiscountRate() below.
export const PLAN_ADDON_DISCOUNT = 0.10;
export function planTierDiscountRate(sessions) {
  const n = Number(sessions) || 0;
  if (n <= 1) return 0.10;
  if (n === 2) return 0.15;
  return 0.20; // 3+ visits
}

export const SUBSCRIPTION_TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    sessions: 1,
    tagline: 'The foundation.',
    price: 225,
    originalPrice: 250,
    discountPercent: 10,
    unit: '/mo',
    perSessionNote: '$225 / visit',
    note: '1 visit monthly',
    discount: '10% off',
    shotCredit: 'None',
    benefits: [
      '1 visit credit per month ($250 value, $225 with plan)',
      '10% off all add-ons',
      'Priority booking window',
      'Plan scheduling portal',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    sessions: 2,
    tagline: 'The sweet spot.',
    price: 425,
    originalPrice: 500,
    discountPercent: 15,
    unit: '/mo',
    perSessionNote: '$213 / visit',
    note: '2 visits monthly',
    discount: '15% off',
    shotCredit: '1 / mo',
    benefits: [
      '2 visit credits per month (save 15%)',
      '10% off all add-ons',
      '1 complimentary IM shot per month',
      'Priority booking window',
      'Plan scheduling portal',
    ],
  },
  {
    key: 'vip',
    name: 'VIP',
    sessions: 4,
    tagline: 'Full access.',
    price: 800,
    originalPrice: 1000,
    discountPercent: 20,
    unit: '/mo',
    perSessionNote: '$200 / visit',
    note: '4 visits monthly',
    discount: '20% off',
    shotCredit: '2 / mo',
    benefits: [
      '4 visit credits per month (save 20%)',
      '10% off all add-ons',
      '2 complimentary IM shots per month',
      'Dedicated registered nurse',
      'Custom protocol design',
      'Household partner sharing',
    ],
  },
  {
    key: 'custom',
    name: 'Custom',
    sessions: null,
    tagline: 'Fully bespoke.',
    price: null,
    unit: '',
    perSessionNote: 'Bespoke pricing',
    note: 'Custom cadence',
    discount: 'Custom',
    shotCredit: 'Custom',
    custom: true,
    benefits: [
      'Any protocol, any frequency',
      'Add IM shots a la carte',
      'Designed with the clinical team',
      'Adjust anytime',
      'No commitment to inquire',
    ],
  },
];

export const BOOKABLE_SUBSCRIPTION_TIERS = SUBSCRIPTION_TIERS.filter((tier) => !tier.custom);
export const FEATURED_SUBSCRIPTION_TIER_KEY = null;

export function getSubscriptionTier(key) {
  return SUBSCRIPTION_TIERS.find((tier) => tier.key === key) || SUBSCRIPTION_TIERS.find((tier) => tier.key === 'starter');
}
