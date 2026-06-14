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

if (failed) {
  console.error('\ncheckout payment-methods guard FAILED — Stripe Link may hijack the payment UI.');
  process.exit(1);
}
console.log('PASS: checkout payment-methods guard (payment_method_types pinned, Link disabled).');
