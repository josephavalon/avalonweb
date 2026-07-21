// Subscription commitment terms — single source of truth.
//
// The truth (per FAQ.jsx:91): 3-month minimum, then cancel anytime with 30
// days notice; pausing is available once per year for up to 60 days.
// Match billing logic in src/lib/paymentRules.js — the deposit + first-month
// + recurring model has no early-cancel escape, so customer-facing copy
// must NOT say "cancel anytime" without the minimum-term qualifier.

export const SUBSCRIPTION_COMMITMENT_COPY = '3-month minimum, then pause or cancel anytime';

// Short variant for tight surfaces (price-line subtitles, summary chips).
export const SUBSCRIPTION_COMMITMENT_SHORT = '3-month minimum';

// Long variant for FAQ / checkout terms / disclosure text.
export const SUBSCRIPTION_COMMITMENT_LONG =
  'Subscriptions require a 3-month minimum commitment. After that, you can cancel anytime with 30 days notice. Pausing is available once per year for up to 60 days.';
