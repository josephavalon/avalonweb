// Visit-credit pricing model (per avalon-visit-credit-model memory):
// each plan visit carries a $250 credit; included if the chosen IV is ≤$250,
// pay-difference otherwise.
//
// Marketing "from" price is based on the CHEAPEST IV (Hydration = $200), not
// the $250 credit ceiling. A Hydration Starter is 10% off $200 = $180/mo;
// a NAD+ Starter (base $350) is priced dynamically at checkout. Stripe
// charges the actual computed value via api/create-checkout-session.js.
export const PLAN_VISIT_CREDIT = 250;
export const PLAN_ENTRY_IV_PRICE = 200; // Hydration — the cheapest IV, used as the tier "from" price

// Plan-member pricing incentives. Apply on top of the per-visit cart:
//   - tier discount scales with sessions (10/15/17%) on the visit-credit base
//   - addon discount is a flat 10% on every plan member's add-ons
// Single source of truth — the marketing tier cards AND the /subscription
// builder/Stripe flow both read from this. See planTierDiscountRate() below.
export const PLAN_ADDON_DISCOUNT = 0.10;
export function planTierDiscountRate(sessions) {
  const n = Number(sessions) || 0;
  if (n <= 1) return 0.10;
  if (n === 2) return 0.15;
  return 0.17; // 3+ visits
}

export const SUBSCRIPTION_TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    sessions: 1,
    tagline: 'The foundation.',
    // "From" pricing on the cheapest IV (Hydration $200). 10% off = $180.
    price: 180,
    originalPrice: 200,
    discountPercent: 10,
    unit: '/mo',
    perSessionNote: 'From $180 / visit',
    note: '1 visit monthly',
    discount: '10% off',
    shotCredit: 'None',
    benefits: [
      '1 visit credit per month ($250 credit; $180 on Hydration)',
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
    // 2 × $200 = $400, 15% off = $340
    price: 340,
    originalPrice: 400,
    discountPercent: 15,
    unit: '/mo',
    perSessionNote: 'From $170 / visit',
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
    // 4 × $200 = $800, 17% off = $664
    price: 664,
    originalPrice: 800,
    discountPercent: 17,
    unit: '/mo',
    perSessionNote: 'From $166 / visit',
    note: '4 visits monthly',
    discount: '17% off',
    shotCredit: '2 / mo',
    benefits: [
      '4 visit credits per month (save 17%)',
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
      '10% off all add-ons',
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
