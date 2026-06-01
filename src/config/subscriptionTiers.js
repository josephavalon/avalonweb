export const SUBSCRIPTION_TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    sessions: 1,
    tagline: 'The foundation.',
    price: 199,
    unit: '/mo',
    perSessionNote: '$199 / session',
    note: '1 session monthly',
    discount: '20%',
    shotCredit: 'None',
    benefits: [
      '1 IV session credit per month',
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
    badge: 'Recommended',
    price: 389,
    unit: '/mo',
    perSessionNote: '$195 / session',
    note: '2 sessions monthly',
    discount: '25%',
    shotCredit: '1 / mo',
    benefits: [
      '2 IV session credits per month',
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
    price: 899,
    unit: '/mo',
    perSessionNote: '$225 / session',
    note: '4 sessions monthly',
    discount: '30%',
    shotCredit: '2 / mo',
    benefits: [
      '4 IV session credits per month',
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
export const FEATURED_SUBSCRIPTION_TIER_KEY = 'pro';

export function getSubscriptionTier(key) {
  return SUBSCRIPTION_TIERS.find((tier) => tier.key === key) || SUBSCRIPTION_TIERS.find((tier) => tier.key === FEATURED_SUBSCRIPTION_TIER_KEY);
}
