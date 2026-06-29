// Visit-credit pricing model (per avalon-visit-credit-model memory):
// each plan visit = a $250 credit; included if the chosen IV is ≤$250,
// pay-difference otherwise. Monthly price = sessions × $250.
// Stripe charges this value directly via api/create-checkout-session.js
// dynamic price_data — keep these numbers in sync with what the UI shows.
export const PLAN_VISIT_CREDIT = 250;

export const SUBSCRIPTION_TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    sessions: 1,
    tagline: 'The foundation.',
    price: 250,
    unit: '/mo',
    perSessionNote: '$250 / visit',
    note: '1 visit monthly',
    discount: '20%',
    shotCredit: 'None',
    benefits: [
      '1 visit credit per month ($250 each)',
      '20% off all add-ons',
      'Priority booking window',
      'Plan scheduling portal',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    sessions: 2,
    tagline: 'The sweet spot.',
    price: 500,
    unit: '/mo',
    perSessionNote: '$250 / visit',
    note: '2 visits monthly',
    discount: '25%',
    shotCredit: '1 / mo',
    benefits: [
      '2 visit credits per month ($250 each)',
      '25% off all add-ons',
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
    price: 1000,
    unit: '/mo',
    perSessionNote: '$250 / visit',
    note: '4 visits monthly',
    discount: '30%',
    shotCredit: '2 / mo',
    benefits: [
      '4 visit credits per month ($250 each)',
      '30% off all add-ons',
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
