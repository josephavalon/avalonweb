/**
 * Pure-logic verification for the events checkout endpoint + Stripe webhook
 * routing (ET2). No network, no DB, no Stripe.
 *
 * Covers:
 *   1. Request validation (api/events/checkout.js → validateEventCheckoutRequest)
 *   2. Order-line building via events-core → Stripe line_items mapping
 *   3. isEventSession predicate truth table (api/_lib/events-webhook.js)
 *   4. REGRESSION: the Stripe webhook source still routes non-event
 *      checkout.session.completed events to handleCheckoutCompleted, with the
 *      isEventSession guard wrapping ONLY the event branch (eng review T2).
 *
 * Run:  node scripts/verify-events-checkout.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateEventCheckoutRequest, stripeLineItemsFromOrderLines } from '../api/events/checkout.js';
import { computeOrderLines } from '../api/_lib/events-core.js';
import { isEventSession } from '../api/_lib/events-webhook.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

console.log('\n[1] validateEventCheckoutRequest');
const GOOD = {
  slug: 'afterglow-dtla',
  items: [{ tierId: 't-iv', attendees: [{ name: 'A', email: 'A@x.com' }] }],
  buyer: { email: 'Buyer@X.com' },
};
check('accepts a well-formed request and normalizes emails', () => {
  const out = validateEventCheckoutRequest(GOOD);
  assert.equal(out.slug, 'afterglow-dtla');
  assert.equal(out.buyer.email, 'buyer@x.com');
  assert.equal(out.items[0].attendees[0].email, 'a@x.com');
  assert.equal(out.isMember, false);
});
check('member flag only accepts literal true', () => {
  assert.equal(validateEventCheckoutRequest({ ...GOOD, member: true }).isMember, true);
  assert.equal(validateEventCheckoutRequest({ ...GOOD, member: 'yes' }).isMember, false);
});
check('rejects missing slug / items / tierId / attendees', () => {
  assert.throws(() => validateEventCheckoutRequest({ ...GOOD, slug: ' ' }), /slug/i);
  assert.throws(() => validateEventCheckoutRequest({ ...GOOD, items: [] }), /tier/i);
  assert.throws(() => validateEventCheckoutRequest({ ...GOOD, items: [{ attendees: [{}] }] }), /tierId/i);
  assert.throws(() => validateEventCheckoutRequest({ ...GOOD, items: [{ tierId: 't', attendees: [] }] }), /attendee/i);
});
check('rejects invalid buyer email with a 400', () => {
  try {
    validateEventCheckoutRequest({ ...GOOD, buyer: { email: 'not-an-email' } });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'buyer_email_invalid');
  }
});
check('caps oversized parties and tier counts', () => {
  const big = Array.from({ length: 21 }, () => ({ name: 'x', email: 'x@x.com' }));
  assert.throws(() => validateEventCheckoutRequest({ ...GOOD, items: [{ tierId: 't', attendees: big }] }), /too large/i);
  const manyTiers = Array.from({ length: 11 }, (_, i) => ({ tierId: `t${i}`, attendees: [{}] }));
  assert.throws(() => validateEventCheckoutRequest({ ...GOOD, items: manyTiers }), /too many/i);
});

console.log('\n[2] line building — events-core lines → Stripe line_items');
const ivTier = { id: 't-iv', name: 'Hydration IV', price_cents: 24900, active: true };
const expTier = {
  id: 't-exp', name: 'Experience', price_cents: 3500, active: true,
  volume_rules: [{ min_qty: 5, unit_price_cents: 3000 }],
};
check('maps qty/unit/name; carries volume pricing; no attendee identity', () => {
  const { lines } = computeOrderLines([
    { tier: ivTier, attendees: [{ name: 'A', email: 'a@x.com' }, { name: 'B', email: 'b@x.com' }] },
    { tier: expTier, attendees: Array.from({ length: 5 }, (_, i) => ({ name: `G${i}`, email: `g${i}@x.com` })) },
  ]);
  const li = stripeLineItemsFromOrderLines(lines);
  assert.equal(li.length, 2);
  assert.deepEqual(li[0], {
    quantity: 2,
    price_data: { currency: 'usd', unit_amount: 24900, product_data: { name: 'Hydration IV' } },
  });
  assert.equal(li[1].price_data.unit_amount, 3000); // volume rule applied
  const flat = JSON.stringify(li);
  assert.ok(!/a@x\.com|b@x\.com|g0@x\.com/.test(flat), 'attendee emails must not reach Stripe line items');
});
check('free tier produces a zero-amount line (RSVP path never builds these)', () => {
  const { totalCents, lines } = computeOrderLines([
    { tier: { id: 'f', name: 'RSVP', price_cents: 0, active: true }, attendees: [{}] },
  ]);
  assert.equal(totalCents, 0);
  assert.equal(stripeLineItemsFromOrderLines(lines)[0].price_data.unit_amount, 0);
});

console.log('\n[3] isEventSession truth table');
check('event session: kind=event + event_order_id → true', () => {
  assert.equal(isEventSession({ metadata: { kind: 'event', event_order_id: 'o-1' } }), true);
});
check('non-event session (mobile-IV metadata) → false', () => {
  assert.equal(isEventSession({ metadata: { appointmentRecordId: 'a-1', primaryService: 'NAD+' } }), false);
  assert.equal(isEventSession({ metadata: { kind: 'event' } }), false); // no order id
  assert.equal(isEventSession({ metadata: { kind: 'gift', event_order_id: 'o-1' } }), false);
});
check('missing/empty metadata → false, never throws', () => {
  assert.equal(isEventSession({ metadata: {} }), false);
  assert.equal(isEventSession({}), false);
  assert.equal(isEventSession(null), false);
  assert.equal(isEventSession(undefined), false);
});

console.log('\n[4] REGRESSION — Stripe webhook routing shape (T2)');
const webhookSrc = readFileSync(path.join(ROOT, 'api/integrations/stripe/webhook.js'), 'utf8');
check("original 'checkout.session.completed' → handleCheckoutCompleted path still present", () => {
  assert.ok(webhookSrc.includes("case 'checkout.session.completed'"));
  assert.ok(webhookSrc.includes('handleCheckoutCompleted(stripe, db, completedSession)'));
  assert.ok(webhookSrc.includes("'stripe checkout fulfillment'"));
  // Session retrieve still expands discount detail for the legacy path.
  assert.ok(webhookSrc.includes("'total_details.breakdown.discounts.discount.promotion_code'"));
});
check('isEventSession guard wraps ONLY the event branch (ternary: event ? handler : legacy)', () => {
  const guard = /isEventSession\(completedSession\)\s*\?\s*await withTimeout\(handleEventCheckoutCompleted\(db, completedSession\)[^:]*:\s*await withTimeout\(handleCheckoutCompleted\(stripe, db, completedSession\)/s;
  assert.match(webhookSrc, guard);
  // handleCheckoutCompleted must never be gated BEHIND isEventSession being true.
  assert.ok(!/isEventSession\([^)]*\)[\s\S]{0,200}&&[\s\S]{0,200}handleCheckoutCompleted\(/.test(webhookSrc));
});
check('checkout.session.expired keeps the legacy release_scheduling_hold action for non-event sessions', () => {
  const expired = /isEventSession\(expiredSession\)\s*\?\s*await withTimeout\(handleEventSessionExpired\(db, expiredSession\)[^:]*:\s*\{ action: 'release_scheduling_hold' \}/s;
  assert.match(webhookSrc, expired);
});
check("charge.refunded case exists and routes through handleEventChargeRefunded only", () => {
  assert.ok(webhookSrc.includes("case 'charge.refunded'"));
  assert.ok(webhookSrc.includes('handleEventChargeRefunded(db, event.data.object)'));
});

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
