/**
 * Stripe TEST-MODE verification for the plan-deposit billing model (Model A).
 *
 * Proves, against the real Stripe test API, that a first-time plan signup:
 *   1. charges a flat $50 deposit TODAY (not the full month), and
 *   2. sets up a recurring FULL-price subscription that does NOT charge now —
 *      it trials until one period after the first visit, then auto-bills the
 *      full monthly price on the saved card.
 *
 * This mirrors the exact Stripe calls in:
 *   - api/create-checkout-session.js   (the $50 deposit, card saved off-session)
 *   - api/_checkout-fulfillment.js     (createDeferredPlanSubscription)
 *
 * SAFETY: refuses to run unless STRIPE_SECRET_KEY is a sk_test_ key. The human
 * operator supplies that test key from Stripe; never paste or commit it.
 *
 * Run:  STRIPE_SECRET_KEY=sk_test_... npm run verify:plan-billing -- [monthlyDollars]
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY || '';
if (!KEY.startsWith('sk_test_')) {
  console.error('REFUSING: set STRIPE_SECRET_KEY to a TEST key (sk_test_...). Never run this with a live key.');
  process.exit(1);
}
const stripe = new Stripe(KEY);
const MONTHLY = Math.max(1, Number(process.argv[2] || 350)); // plan monthly price in dollars
const MONTHLY_CENTS = Math.round(MONTHLY * 100);
const DEPOSIT_CENTS = Math.min(5000, MONTHLY_CENTS); // $50 cap
const BALANCE_AFTER_VISIT_CENTS = Math.max(0, MONTHLY_CENTS - DEPOSIT_CENTS);
const fmt = (c) => `$${(c / 100).toFixed(2)}`;

// Mirrors planRecurringInterval / planTrialEndUnix in webhook.js
const recurring = { interval: 'month' };
function trialEndUnix(firstVisit) {
  const start = new Date(firstVisit);
  start.setMonth(start.getMonth() + 1);
  return Math.max(Math.floor(start.getTime() / 1000), Math.floor(Date.now() / 1000) + 3600);
}

async function main() {
  console.log(`\nPlan: ${fmt(MONTHLY_CENTS)}/month\n`);
  const firstVisit = new Date(Date.now() + 2 * 86400000); // visit in 2 days

  // --- 1. DEPOSIT TODAY: $50, card saved off-session (mirrors payment-mode checkout) ---
  const customer = await stripe.customers.create({ description: 'plan-billing-verify' });
  const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
  await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
  const depositPI = await stripe.paymentIntents.create({
    amount: DEPOSIT_CENTS,
    currency: 'usd',
    customer: customer.id,
    payment_method: pm.id,
    confirm: true,
    off_session: true,
    setup_future_usage: 'off_session',
  });
  console.log(`1) Deposit charged TODAY: ${fmt(depositPI.amount)}  status=${depositPI.status}`);
  console.log(`   Remaining first-month balance (collected after visit): ${fmt(BALANCE_AFTER_VISIT_CENTS)}`);

  // --- 2. DEFERRED SUBSCRIPTION: full price, trials until 1 period after visit ---
  const product = await stripe.products.create({ name: 'Avalon Plan (verify)' });
  const trial_end = trialEndUnix(firstVisit);
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    default_payment_method: pm.id,
    trial_end,
    items: [{ price_data: { currency: 'usd', product: product.id, unit_amount: MONTHLY_CENTS, recurring } }],
    expand: ['latest_invoice'],
  });
  const chargedNowBySub = Number(sub.latest_invoice?.amount_paid || 0);
  const item = sub.items.data[0];
  console.log(`\n2) Subscription created: status=${sub.status}`);
  console.log(`   Charged by subscription NOW: ${fmt(chargedNowBySub)}  (must be $0.00)`);
  console.log(`   First recurring charge on: ${new Date(sub.trial_end * 1000).toISOString().slice(0, 10)}  (~1 month after the ${firstVisit.toISOString().slice(0,10)} visit)`);
  console.log(`   Recurring amount: ${fmt(item.price.unit_amount)} / ${item.price.recurring.interval}`);

  // --- ASSERTIONS ---
  const checks = [
    ['Deposit today is exactly $50 (or full price if cheaper)', depositPI.amount === DEPOSIT_CENTS && depositPI.status === 'succeeded'],
    ['Subscription charged $0 up front (no full month today)', chargedNowBySub === 0 && sub.status === 'trialing'],
    ['Recurring amount equals the full monthly price', item.price.unit_amount === MONTHLY_CENTS && item.price.recurring.interval === 'month'],
    ['First recurring charge is in the future', sub.trial_end * 1000 > Date.now()],
  ];
  console.log('\nRESULT');
  let ok = true;
  for (const [label, pass] of checks) { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`); if (!pass) ok = false; }

  // --- CLEANUP (test mode) ---
  await stripe.subscriptions.cancel(sub.id).catch(() => {});
  await stripe.customers.del(customer.id).catch(() => {});
  console.log(`\n${ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} — test objects cleaned up.\n`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
