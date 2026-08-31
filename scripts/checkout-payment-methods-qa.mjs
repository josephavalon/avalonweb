// Regression guard for: "Stripe Link OTP hijacks the payment UI before wallets".
//
// Root cause (investigated 2026-06-09): the embedded Checkout Session in
// api/create-checkout-session.js was created with NO payment_method_types, so it
// fell back to the Stripe Dashboard's automatic methods. Because the session
// passes `customer_email`, Stripe auto-surfaced Link's "Confirm it's you" OTP
// whenever that email matched a Link account, hijacking the payment UI before any
// Apple Pay / Google Pay wallet could render.
//
// Fix: pin `payment_method_types` so wallets lead and Link is disabled. 'card'
// carries the Apple Pay + Google Pay express buttons (when the Apple Pay domain
// is verified and the wallets are enabled in the dashboard). Add 'amazon_pay'
// once it is activated. Listing 'link' would re-introduce the OTP hijack.
//
// This guard fails if payment_method_types is removed or 'link' is re-added.
//
// 2026-08-31: extended to api/deposit/create-session.js. The /start reservation
// deposit builds its own Checkout Session rather than reusing the funnel one
// (the funnel handler 409s on the apex), which means it is a second, independent
// place the same regression can walk back in — on the highest-traffic page on
// the site, and one where a first-time visitor meeting an unexpected OTP simply
// leaves.

import fs from 'node:fs';

let failed = false;
const fail = (msg) => { failed = true; console.error('FAIL:', msg); };

const src = fs.readFileSync(new URL('../api/create-checkout-session.js', import.meta.url), 'utf8');
const block = src.match(/const sessionParams = \{[\s\S]*?\n {4}\};/);

if (!block) {
  fail('sessionParams object not found in api/create-checkout-session.js');
} else {
  const params = block[0];
  if (!/payment_method_types\s*:/.test(params)) {
    fail('sessionParams must set payment_method_types — without it Checkout falls back to '
       + 'dashboard automatic methods and Stripe Link auto-prompts its OTP, hijacking the wallet UI.');
  }
  const list = (params.match(/payment_method_types\s*:\s*(\[[^\]]*\])/) || [])[1] || '';
  if (/['"]link['"]/.test(list)) {
    fail(`payment_method_types must not include 'link' (it re-enables the OTP hijack). Found: ${list}`);
  }
}

// The reservation deposit's session is a plain object literal in the
// sessions.create() call rather than a named `sessionParams`, so it is matched
// on its own shape.
const depositSrc = fs.readFileSync(new URL('../api/deposit/create-session.js', import.meta.url), 'utf8');
const depositBlock = depositSrc.match(/checkout\.sessions\.create\(\{[\s\S]*?\n {4}\}/);

if (!depositBlock) {
  fail('checkout.sessions.create({...}) not found in api/deposit/create-session.js');
} else {
  const params = depositBlock[0];
  if (!/payment_method_types\s*:/.test(params)) {
    fail('api/deposit/create-session.js must pin payment_method_types — the $50 deposit is the '
       + 'first payment most visitors see, and an unexpected Link OTP there reads as a hijack.');
  }
  const list = (params.match(/payment_method_types\s*:\s*(\[[^\]]*\])/) || [])[1] || '';
  if (/['"]link['"]/.test(list)) {
    fail(`api/deposit/create-session.js payment_method_types must not include 'link'. Found: ${list}`);
  }
  // customer_email is what made Link auto-prompt in the original incident. The
  // deposit must never send it anyway (no PHI to Stripe), so this is both a
  // privacy and a Link-regression guard.
  if (/customer_email/.test(params)) {
    fail('api/deposit/create-session.js must not send customer_email — it re-enables Link recognition '
       + 'and puts an identifier into a call that is meant to carry none.');
  }
}

if (failed) {
  console.error('\ncheckout payment-methods guard FAILED — Stripe Link may hijack the payment UI.');
  process.exit(1);
}
console.log('PASS: checkout payment-methods guard (funnel + deposit sessions pin payment_method_types, Link disabled).');
