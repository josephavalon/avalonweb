import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sanitizeCheckoutItems, sanitizeCheckoutMembership } from '../api/_lib/catalog-pricing.js';
import { normalizeCustomPlan } from '../api/me/_subscription-plans.js';
import { calculateCustomPlanQuote } from '../src/lib/customPlanPricing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  {
    file: 'api/create-checkout-session.js',
    must: ['sanitizeCheckoutItems', 'sanitizeCheckoutMembership', 'pre_api_hard_wall'],
  },
  {
    file: 'api/_lib/catalog-pricing.js',
    must: ['calculateCustomPlanQuote', 'plan: membership.plan'],
    mustNot: ['const proposed = Number(membership.price)'],
  },
  {
    file: 'api/me/_subscription-plans.js',
    must: ['calculateCustomPlanQuote', 'monthlyCents: quote.periodPriceCents'],
    mustNot: ['Number(c.priceCents)', 'Number(c.priceDollars)'],
  },
  {
    file: 'app-modules/pages/PlanCheckout.jsx',
    must: ['plan: stablePlanManifest', 'calculateCustomPlanQuote'],
    mustNot: ["searchParams.get('price')"],
  },
  {
    file: 'app-modules/pages/Membership.jsx',
    must: ['plan: stablePlanManifest', 'calculateCustomPlanQuote'],
    mustNot: ['priceDollars: changePriceDollars', "price: String(Math.round(monthly))"],
  },
  {
    file: 'api/integrations/stripe/webhook.js',
    must: ['requireLiveWebhook', 'STRIPE_WEBHOOK_SECRET'],
    mustNot: ['typeof req.body === \'object\' ? req.body'],
  },
  {
    file: 'api/integrations/acuity/webhook.js',
    must: ['requireLiveWebhook', 'ACUITY_WEBHOOK_SECRET'],
  },
  {
    file: 'src/lib/useAuthStore.js',
    must: ['isDemoAuthAllowed', 'pre-api-hard-wall'],
  },
  {
    file: 'src/pages/Login.jsx',
    must: ['PRE_API_SECURITY_MODE', 'Local simulation only'],
  },
  {
    file: 'src/pages/provider/NurseShift.jsx',
    must: ['writeLocal(NOTES_KEY', 'hasNotes'],
    mustNot: ['localStorage.setItem(NOTES_KEY'],
  },
  {
    file: 'src/lib/financeIntegrations.js',
    mustNot: ['VITE_MERCURY_API_KEY', 'VITE_QUALIPHY_API_KEY', 'VITE_NURSEYS_API_KEY', 'VITE_MERCURY_WEBHOOK_SECRET', 'VITE_QUALIPHY_WEBHOOK_SECRET'],
  },
];

const failures = [];

for (const check of checks) {
  const text = await fs.readFile(path.join(ROOT, check.file), 'utf8');
  for (const needle of check.must || []) {
    if (!text.includes(needle)) failures.push(`${check.file}: missing "${needle}"`);
  }
  for (const needle of check.mustNot || []) {
    if (text.includes(needle)) failures.push(`${check.file}: forbidden "${needle}"`);
  }
}

const sourceFiles = await collect(path.join(ROOT, 'src'));
for (const file of sourceFiles) {
  const rel = path.relative(ROOT, file);
  const text = await fs.readFile(file, 'utf8');
  if (/localStorage\.setItem\([^)]*(medicalConditions|allergies|medications|dob|bp|hr|visitNote|clinicalNotes)/i.test(text)) {
    failures.push(`${rel}: direct PHI-like localStorage write`);
  }
}

const checkoutRoute = await fs.readFile(path.join(ROOT, 'api/create-checkout-session.js'), 'utf8');
const checkoutPriceGate = checkoutRoute.indexOf('sanitizeCheckoutMembership(rawMembership)');
const checkoutAuth = checkoutRoute.indexOf('await getAuthedUser(req)');
if (checkoutPriceGate < 0 || checkoutAuth < 0 || checkoutPriceGate > checkoutAuth) {
  failures.push('api/create-checkout-session.js: custom price sanitizer must run before auth');
}

const planCheckoutPage = await fs.readFile(path.join(ROOT, 'app-modules/pages/PlanCheckout.jsx'), 'utf8');
if (/membership\s*:\s*\{[\s\S]{0,240}?\bprice\s*:/.test(planCheckoutPage)) {
  failures.push('app-modules/pages/PlanCheckout.jsx: membership payload must not contain a browser-authored price');
}

const planChangeRoute = await fs.readFile(path.join(ROOT, 'api/me/subscription/change.js'), 'utf8');
const planPriceGate = planChangeRoute.indexOf('normalizeCustomPlan(custom)');
const planAuth = planChangeRoute.indexOf('await authAndActiveSubscription(req, res, Stripe)');
if (planPriceGate < 0 || planAuth < 0 || planPriceGate > planAuth) {
  failures.push('api/me/subscription/change.js: custom price rejection must run before auth or Stripe');
}

const hydrationPlan = [{ visits: [{ therapyKey: 'hydration', ivQty: {}, imQty: {} }] }];
const hydrationQuote = calculateCustomPlanQuote({ plan: hydrationPlan, billing: 'monthly' });
assert.equal(hydrationQuote.monthlyPriceDollars, 180, 'Hydration must price from the official $200 catalog less the 10% one-visit discount');
assert.equal(hydrationQuote.periodPriceDollars, 180, 'monthly recurring amount must equal the canonical monthly quote');
assert.equal(hydrationQuote.visitsPerCycle, 1, 'visit credits must derive from the manifest');

const checkoutMembership = sanitizeCheckoutMembership({
  name: 'custom',
  billing: 'annual',
  plan: hydrationPlan,
});
assert.equal(checkoutMembership.price, 1836, 'annual recurring price must apply the shared 15% term discount');
assert.equal(checkoutMembership.monthlyPrice, 180, 'annual plan must retain its canonical monthly basis');
assert.equal(checkoutMembership.visitsPerCycle, 1, 'checkout must ignore browser visit-count construction and derive credits');
assert.deepEqual(
  Object.keys(checkoutMembership).sort(),
  ['billing', 'commitmentMonths', 'custom', 'displayName', 'id', 'monthlyPrice', 'name', 'peopleCount', 'plan', 'planName', 'price', 'sessionsPerPerson', 'term', 'visitsPerCycle'].sort(),
  'sanitized custom membership must not retain browser-authored price fields',
);

const premiumPlan = [{ visits: [{
  therapyKey: 'nad_250',
  ivQty: { 'extra-fluid': 2 },
  imQty: { 'b-12': 1 },
  ivPrice: 1,
  label: 'browser text is not price authority',
}] }];
assert.equal(
  calculateCustomPlanQuote({ plan: premiumPlan, billing: 'monthly' }).periodPriceDollars,
  441,
  'therapy and add-on prices must be resolved by stable allowlisted keys only',
);

assert.throws(
  () => sanitizeCheckoutMembership({ name: 'custom', price: 1, billing: 'monthly', plan: hydrationPlan }),
  (error) => error?.status === 400 && error?.code === 'client_custom_price_mismatch',
  'checkout must reject a client price that differs from the server quote',
);
assert.equal(
  sanitizeCheckoutMembership({ name: 'custom', price: 180, billing: 'monthly', plan: hydrationPlan }).price,
  180,
  'an exact legacy price hint may pass rollout compatibility but cannot change the canonical amount',
);
assert.throws(
  () => normalizeCustomPlan({ priceCents: 1, billing: 'monthly', plan: hydrationPlan }),
  (error) => error?.status === 400 && error?.code === 'client_custom_price_mismatch',
  'plan change must reject a client-authored price mismatch',
);
assert.equal(
  normalizeCustomPlan({ billing: 'monthly', plan: hydrationPlan }).monthlyCents,
  18000,
  'plan change must derive Stripe cents from the same canonical manifest',
);
assert.throws(
  () => calculateCustomPlanQuote({ plan: [{ visits: [{ therapyKey: 'not-a-service' }] }], billing: 'monthly' }),
  (error) => error?.code === 'custom_plan_therapy_unknown',
  'unknown therapy keys must fail closed',
);
assert.throws(
  () => calculateCustomPlanQuote({ plan: [{ visits: [{ therapyKey: 'hydration', ivQty: { 'not-an-addon': 1 } }] }], billing: 'monthly' }),
  (error) => error?.code === 'custom_plan_addon_unknown',
  'unknown add-on keys must fail closed',
);
assert.throws(
  () => calculateCustomPlanQuote({ plan: [{ visits: [{ therapyKey: 'hydration', imQty: { 'b-12': 6 } }] }], billing: 'monthly' }),
  (error) => error?.code === 'custom_plan_quantity_invalid',
  'add-on quantities must respect catalog bounds',
);
assert.throws(
  () => calculateCustomPlanQuote({ plan: Array.from({ length: 5 }, () => ({ visits: [{ therapyKey: 'hydration' }] })), billing: 'monthly' }),
  (error) => error?.code === 'custom_plan_people_invalid',
  'custom plans must be limited to four people',
);
assert.throws(
  () => calculateCustomPlanQuote({ plan: [{ visits: Array.from({ length: 5 }, () => ({ therapyKey: 'hydration' })) }], billing: 'monthly' }),
  (error) => error?.code === 'custom_plan_visits_invalid',
  'custom plans must be limited to four visits per person',
);
assert.equal(
  sanitizeCheckoutItems([{ label: 'CBD IV 132mg', type: 'iv' }])[0].price,
  450,
  'CBD 132 fallback must match the authoritative $450 catalog price',
);

if (failures.length) {
  console.error('Security hard wall QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security hard wall QA passed: pre-API live-vendor and PHI storage guards are armed.');

async function collect(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(abs));
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(abs);
  }
  return files;
}
