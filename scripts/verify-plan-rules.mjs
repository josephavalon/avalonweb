/**
 * Pure-logic verification of the plan-deposit billing math + subscription
 * timing. No Stripe, no keys, no charges — just asserts the numbers the code
 * computes. Run: node scripts/verify-plan-rules.mjs
 */
import { calculateLaunchPayment, ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS as DEP } from '../src/lib/paymentRules.js';

// Mirrors api/integrations/stripe/webhook.js planTrialEndUnix (monthly case)
function trialEndUnix(firstVisitIso) {
  const nowSec = Math.floor(Date.now() / 1000);
  const start = new Date(firstVisitIso);
  start.setMonth(start.getMonth() + 1);
  return Math.max(Math.floor(start.getTime() / 1000), nowSec + 3600);
}
// Mirrors api/create-checkout-session.js deposit/balance for a plan
function planAmounts(monthlyDollars) {
  const monthlyCents = Math.round(monthlyDollars * 100);
  const depositCents = Math.min(DEP * 100, monthlyCents);
  return { depositCents, balanceDueCents: Math.max(0, monthlyCents - depositCents) };
}

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

console.log('\nDeposit constant:', `$${DEP}`);

console.log('\nOne-time visit ($350 subtotal):');
const oneTime = calculateLaunchPayment({ subtotal: 350, visitType: 'single', orderType: 'single' });
eq('deposit today is $50', oneTime.depositAmount, 50);
eq('balance after visit is $300', oneTime.balanceDue, 300);

console.log('\nPlan signup ($350/mo):');
const plan = calculateLaunchPayment({ subtotal: 350, visitType: 'subscription', orderType: 'subscription', subscriptionPrice: 350 });
eq('deposit today is $50 (NOT $350)', plan.depositAmount, 50);
eq('balance after visit is $300', plan.balanceDue, 300);
eq('paymentType marks deposit-first', plan.paymentType, 'subscription_deposit_first_month');
eq('status is partial (more owed after visit)', plan.paymentStatus, 'partial_payment');

console.log('\nPlan signup cheaper than deposit ($40/mo):');
const cheap = calculateLaunchPayment({ subtotal: 40, visitType: 'subscription', orderType: 'subscription', subscriptionPrice: 40 });
eq('deposit caps at the plan price ($40)', cheap.depositAmount, 40);
eq('no balance left', cheap.balanceDue, 0);
eq('paid in full', cheap.paymentStatus, 'paid_in_full');

console.log('\nServer deposit/balance cents ($350/mo):');
const amts = planAmounts(350);
eq('deposit = 5000 cents', amts.depositCents, 5000);
eq('balance = 30000 cents', amts.balanceDueCents, 30000);

console.log('\nMulti-person one-time visit (2 people, $700 subtotal):');
const oneTime2p = calculateLaunchPayment({ subtotal: 700, visitType: 'single', orderType: 'single', peopleCount: 2 });
eq('deposit today is $100 (2 × $50)', oneTime2p.depositAmount, 100);
eq('balance after visit is $600', oneTime2p.balanceDue, 600);
eq('peopleCount echoes back', oneTime2p.peopleCount, 2);

console.log('\nMulti-person plan signup (3 people, $750/mo):');
const plan3p = calculateLaunchPayment({ subtotal: 750, visitType: 'subscription', orderType: 'subscription', subscriptionPrice: 750, peopleCount: 3 });
eq('deposit today is $150 (3 × $50)', plan3p.depositAmount, 150);
eq('balance after visit is $600', plan3p.balanceDue, 600);
eq('paymentType marks deposit-first', plan3p.paymentType, 'subscription_deposit_first_month');

console.log('\nPeopleCount is bounded sanely (zero/negative → 1):');
const guard = calculateLaunchPayment({ subtotal: 200, visitType: 'single', peopleCount: 0 });
eq('zero people coerced to 1', guard.peopleCount, 1);
eq('deposit treated as 1 person', guard.depositAmount, 50);

console.log('\nRecurring subscription starts AFTER the first visit:');
const visit = new Date(Date.now() + 2 * 86400000); // 2 days out
const te = trialEndUnix(visit.toISOString());
eq('trial_end is in the future', te * 1000 > Date.now(), true);
eq('trial_end ~1 month after the visit (27-32 days)', (() => {
  const days = (te * 1000 - visit.getTime()) / 86400000;
  return days >= 27 && days <= 32;
})(), true);

console.log(`\n${fail === 0 ? 'ALL LOGIC CHECKS PASSED' : `${fail} CHECK(S) FAILED`}  (${pass} passed)\n`);
process.exit(fail === 0 ? 0 : 1);
