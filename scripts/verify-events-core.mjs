/**
 * Pure-logic verification for the events core module (no network, no DB):
 * pricing with volume rules, presale window gating, capacity counting,
 * order-line computation and its rejection paths.
 *
 * Run:  node scripts/verify-events-core.mjs
 */
import assert from 'node:assert/strict';
import {
  unitPriceForQty, computeOrderLines, salesWindowOpen, isCountedAgainstCapacity,
  HOLD_MINUTES, WAITLIST_CLAIM_HOURS,
} from '../api/_lib/events-core.js';

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

const NOW = new Date('2026-08-10T12:00:00Z');
const ivTier = { id: 't-iv', name: 'Hydration', price_cents: 24900, active: true, volume_rules: [] };
const expTier = {
  id: 't-exp', name: 'Experience', price_cents: 3500, active: true,
  volume_rules: [{ min_qty: 5, unit_price_cents: 3000 }, { min_qty: 10, unit_price_cents: 2500 }],
};

console.log('\n[1] unitPriceForQty — volume rules');
check('base price when no rules match', () => {
  assert.equal(unitPriceForQty(ivTier, 3), 24900);
  assert.equal(unitPriceForQty(expTier, 4), 3500);
});
check('highest matching min_qty wins', () => {
  assert.equal(unitPriceForQty(expTier, 5), 3000);
  assert.equal(unitPriceForQty(expTier, 9), 3000);
  assert.equal(unitPriceForQty(expTier, 10), 2500);
});
check('malformed rules are ignored, never crash pricing', () => {
  const t = { price_cents: 1000, volume_rules: [{ min_qty: 'x' }, null, { min_qty: 0, unit_price_cents: 1 }] };
  assert.equal(unitPriceForQty(t, 50), 1000);
});
check('free tier prices at zero', () => {
  assert.equal(unitPriceForQty({ price_cents: 0 }, 2), 0);
});

console.log('\n[2] salesWindowOpen — presale gating');
const gated = {
  presale_opens_at: '2026-08-09T12:00:00Z',   // opened yesterday for members
  public_opens_at: '2026-08-11T12:00:00Z',    // opens tomorrow for public
};
check('member inside presale window can buy', () => {
  assert.equal(salesWindowOpen(gated, { now: NOW, isMember: true }), true);
});
check('public before public_opens_at cannot', () => {
  assert.equal(salesWindowOpen(gated, { now: NOW, isMember: false }), false);
});
check('everyone after public open can', () => {
  assert.equal(salesWindowOpen(gated, { now: new Date('2026-08-12T00:00:00Z'), isMember: false }), true);
});
check('undated tier is always open', () => {
  assert.equal(salesWindowOpen({}, { now: NOW }), true);
});

console.log('\n[3] computeOrderLines');
check('itemizes IV + experience Airbnb-style', () => {
  const { totalCents, lines } = computeOrderLines([
    { tier: ivTier, attendees: [{ name: 'A' }, { name: 'B' }] },
    { tier: expTier, attendees: [{ name: 'C' }] },
  ], { now: NOW });
  assert.equal(totalCents, 24900 * 2 + 3500);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], { tierId: 't-iv', tierName: 'Hydration', qty: 2, unitCents: 24900, subtotalCents: 49800 });
});
check('volume pricing applies inside an order line', () => {
  const { totalCents } = computeOrderLines(
    [{ tier: expTier, attendees: Array.from({ length: 10 }, (_, i) => ({ name: `G${i}` })) }],
    { now: NOW },
  );
  assert.equal(totalCents, 2500 * 10);
});
check('rejects inactive tier', () => {
  assert.throws(() => computeOrderLines([{ tier: { ...ivTier, active: false }, attendees: [{}] }]), /inactive/i);
});
check('rejects empty party and oversized party', () => {
  assert.throws(() => computeOrderLines([{ tier: ivTier, attendees: [] }]), /at least one/i);
  assert.throws(
    () => computeOrderLines([{ tier: ivTier, attendees: Array.from({ length: 21 }, () => ({})) }]),
    /too large/i,
  );
});
check('rejects closed sales window with 409 reason', () => {
  try {
    computeOrderLines([{ tier: { ...ivTier, ...gated } , attendees: [{}] }], { now: NOW, isMember: false });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.status, 409);
    assert.equal(err.reason, 'window_closed');
  }
});
check('free RSVP order computes to zero total', () => {
  const { totalCents } = computeOrderLines([{ tier: { id: 'f', name: 'RSVP', price_cents: 0, active: true }, attendees: [{}] }]);
  assert.equal(totalCents, 0);
});

console.log('\n[4] isCountedAgainstCapacity — hold semantics');
check('confirmed/pending/served always count', () => {
  for (const status of ['pending', 'confirmed', 'served']) {
    assert.equal(isCountedAgainstCapacity({ status }, NOW), true);
  }
});
check('live hold counts, expired hold does not', () => {
  const future = new Date(NOW.getTime() + 60000).toISOString();
  const past = new Date(NOW.getTime() - 60000).toISOString();
  assert.equal(isCountedAgainstCapacity({ status: 'held', hold_expires_at: future }, NOW), true);
  assert.equal(isCountedAgainstCapacity({ status: 'held', hold_expires_at: past }, NOW), false);
});
check('canceled/refunded/no_show free the seat', () => {
  for (const status of ['canceled', 'refunded', 'left']) {
    assert.equal(isCountedAgainstCapacity({ status }, NOW), false);
  }
});

console.log('\n[5] constants');
check('15-minute hold, 4-hour waitlist claim (blueprint)', () => {
  assert.equal(HOLD_MINUTES, 15);
  assert.equal(WAITLIST_CLAIM_HOURS, 4);
});

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
