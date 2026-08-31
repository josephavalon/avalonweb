#!/usr/bin/env node
/**
 * Drill the /start $50 reservation deposit against a deployed host.
 *
 *   API_BASE_URL=https://beta.avalonvitality.co \
 *   STRIPE_TEST_SECRET_KEY=sk_test_... \
 *   node scripts/verify-start-deposit.mjs
 *
 * Creating a Checkout Session costs nothing and charges no one — sessions
 * expire unpaid — so this is safe to run repeatedly. With STRIPE_TEST_SECRET_KEY
 * set it also reads the session back from Stripe and asserts what we actually
 * sent, which is the half that matters: the endpoint could return a plausible
 * URL while quietly having put an email or a patient detail into the session.
 */
const DEFAULT_BASE = 'https://beta.avalonvitality.co';
const apiBase = String(process.env.API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
const stripeKey = process.env.STRIPE_TEST_SECRET_KEY || '';

let failed = false;
const fail = (msg) => { failed = true; console.error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`  ok  ${msg}`);

const ENDPOINT = '/api/deposit/create-session';
const REF_RE = /^AV-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const EXPECTED_CENTS = Number(process.env.EXPECT_DEPOSIT_CENTS || 5000);

console.log(`Drilling ${apiBase}${ENDPOINT}\n`);

const res = await fetch(`${apiBase}${ENDPOINT}`, { method: 'POST' });
const text = await res.text();
let body = null;
try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }

if (res.status === 409 && body?.code === 'pre_api_hard_wall') {
  fail('AVALON_ENABLE_LIVE_API is not "true" on this deployment — the deposit button will look dead');
} else if (res.status === 503 && body?.code === 'stripe_not_configured') {
  fail('STRIPE_SECRET_KEY is not set on this deployment');
} else if (res.status !== 200 || body?.ok !== true) {
  fail(`expected 200 ok; got ${res.status} ${JSON.stringify(body)}`);
} else {
  if (!String(body.url || '').startsWith('https://checkout.stripe.com/')) {
    fail(`url should be a Stripe Checkout URL; got ${body.url}`);
  } else pass('returned a Stripe Checkout URL');

  if (!REF_RE.test(String(body.ref || ''))) {
    fail(`ref should match AV-XXXX-XXXX; got ${body.ref}`);
  } else pass(`minted reference ${body.ref}`);

  if (body.amountCents !== EXPECTED_CENTS) {
    fail(`amountCents should be ${EXPECTED_CENTS}; got ${body.amountCents}`);
  } else pass(`amount is $${(EXPECTED_CENTS / 100).toFixed(2)}`);
}

// A body must be refused — this is the structural no-PHI property, not a policy.
const withBody = await fetch(`${apiBase}${ENDPOINT}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', name: 'Test Person' }),
});
const withBodyJson = await withBody.json().catch(() => null);
if (withBody.status !== 400 || withBodyJson?.code !== 'unexpected_body') {
  fail(`POST with a body must be 400 unexpected_body; got ${withBody.status} ${JSON.stringify(withBodyJson)}`);
} else {
  pass('POST carrying identity refused');
}

// Read the session back: what we SENT is what matters, and it is invisible from
// the response alone.
if (!stripeKey) {
  console.log('\n  ..  STRIPE_TEST_SECRET_KEY unset — skipping the session read-back.');
  console.log('      Set it to assert mode, payment_method_types, metadata and the absence of identity.');
} else if (body?.ok && body.ref) {
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(stripeKey);
  const list = await stripe.checkout.sessions.list({ limit: 10 });
  const session = list.data.find((s) => s.client_reference_id === body.ref);

  if (!session) {
    fail(`no Checkout Session found with client_reference_id ${body.ref} — is API_BASE_URL on the same Stripe key?`);
  } else {
    if (session.amount_total !== EXPECTED_CENTS) fail(`session amount_total ${session.amount_total} != ${EXPECTED_CENTS}`);
    else pass(`session amount_total is ${session.amount_total}`);

    if (session.mode !== 'payment') fail(`session mode should be 'payment'; got ${session.mode}`);
    else pass("session mode is 'payment'");

    const pmt = session.payment_method_types || [];
    if (pmt.length !== 1 || pmt[0] !== 'card') {
      fail(`payment_method_types should be exactly ['card']; got ${JSON.stringify(pmt)} — 'link' here re-opens the OTP hijack`);
    } else pass("payment_method_types is exactly ['card']");

    if (session.customer_email) fail(`session carries customer_email ${session.customer_email} — we must never send one`);
    else pass('no customer_email was sent');

    const allowed = new Set(['kind', 'depositType', 'depositAmountCents']);
    const extra = Object.keys(session.metadata || {}).filter((k) => !allowed.has(k));
    if (extra.length) fail(`unexpected metadata keys: ${extra.join(', ')}`);
    else pass(`metadata is only ${[...allowed].join(', ')}`);

    // Belt: scan the whole serialized session for anything that looks like a
    // person. Catches a field we did not think to assert on individually.
    const blob = JSON.stringify({ metadata: session.metadata, cri: session.client_reference_id });
    for (const token of ['@', 'dob', 'birth', 'allerg', 'address']) {
      if (blob.toLowerCase().includes(token)) fail(`session metadata contains "${token}": ${blob}`);
    }
  }
}

if (failed) {
  console.error('\nstart-deposit verification FAILED.');
  process.exit(1);
}
console.log('\nPASS: start-deposit verified (session shape, no identity, card-only).');
