/**
 * Verification for the events refund state-sync + waitlist promotion (ET2,
 * eng decision 2A). No network, no live DB — a tiny in-memory fake of the
 * supabase-js query chain drives the real events-core / events-webhook logic.
 *
 * Covers:
 *   1. charge.refunded with an unknown payment intent → ignored_non_event_refund
 *   2. syncEventOrderRefund flips order + visits (via the transition RPC) and
 *      promotes the top waitlist entry with a claim window
 *   3. Idempotency: a second charge.refunded for the same order is a no-op
 *      (alreadySynced) — no double transition, no double promotion
 *   4. releaseOrderHolds cancels held visits only and expires pending orders
 *
 * Run:  node scripts/verify-events-refund-waitlist.mjs
 */
import assert from 'node:assert/strict';
import { WAITLIST_CLAIM_HOURS } from '../api/_lib/events-core.js';
import { handleEventChargeRefunded, releaseOrderHolds } from '../api/_lib/events-webhook.js';

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}
async function checkAsync(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

// ── minimal in-memory supabase fake ─────────────────────────────────────────
// Supports the exact chains events-core/events-webhook use:
//   from(t).select().eq().maybeSingle()/single(), .in(), .is(), .order(),
//   .limit(), from(t).update(patch).eq().select().single(), from(t).insert(),
//   and rpc('transition_event_visit', ...) which mutates the visit row and
//   records the call for assertions.
class Query {
  constructor(tables, table) {
    this.tables = tables; this.table = table;
    this.filters = []; this._order = null; this._limit = null;
    this._mode = 'select'; this._patch = null; this._insertRows = null;
  }
  select() { return this; }
  update(patch) { this._mode = 'update'; this._patch = patch; return this; }
  insert(rows) { this._mode = 'insert'; this._insertRows = Array.isArray(rows) ? rows : [rows]; return this; }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this; }
  is(col, val) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  ilike(col, val) { this.filters.push((r) => String(r[col] || '').toLowerCase() === String(val).toLowerCase()); return this; }
  lt(col, val) { this.filters.push((r) => r[col] != null && r[col] < val); return this; }
  order(col, { ascending = true } = {}) { this._order = { col, ascending }; return this; }
  limit(n) { this._limit = n; return this; }
  maybeSingle() { return this._run('maybe'); }
  single() { return this._run('strict'); }
  then(resolve, reject) { return this._run(null).then(resolve, reject); }
  async _run(single) {
    const rows = this.tables[this.table] || (this.tables[this.table] = []);
    if (this._mode === 'insert') {
      const inserted = this._insertRows.map((r, i) => ({ id: `${this.table}-${rows.length + i + 1}`, ...r }));
      rows.push(...inserted);
      return single === 'strict' ? { data: inserted[0], error: null } : { data: inserted, error: null };
    }
    let matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this._mode === 'update') matched.forEach((r) => Object.assign(r, this._patch));
    if (this._order) {
      const { col, ascending } = this._order;
      matched = [...matched].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (this._limit != null) matched = matched.slice(0, this._limit);
    if (single === 'maybe') return { data: matched[0] ?? null, error: null };
    if (single === 'strict') {
      return matched[0]
        ? { data: matched[0], error: null }
        : { data: null, error: Object.assign(new Error('no rows'), { code: 'PGRST116' }) };
    }
    return { data: matched, error: null, count: matched.length };
  }
}

function fakeDb(tables) {
  const rpcCalls = [];
  return {
    tables,
    rpcCalls,
    from(table) { return new Query(tables, table); },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name !== 'transition_event_visit') return { data: null, error: null };
      const row = (tables.event_visits || []).find((v) => v.id === args.p_visit_id);
      if (!row) return { data: null, error: new Error(`visit ${args.p_visit_id} not found`) };
      row[args.p_field] = args.p_to;
      return { data: { ...row }, error: null };
    },
  };
}

function seed() {
  return {
    event_orders: [{
      id: 'order-1', container_id: 'c-1', status: 'paid', refund_status: null,
      stripe_payment_intent: 'pi_event_123', total_cents: 49800,
    }],
    event_visits: [
      { id: 'v-1', order_id: 'order-1', container_id: 'c-1', tier_id: 't-iv', status: 'confirmed' },
      { id: 'v-2', order_id: 'order-1', container_id: 'c-1', tier_id: 't-iv', status: 'confirmed' },
    ],
    event_waitlist: [
      { id: 'w-1', container_id: 'c-1', tier_id: 't-iv', position: 1, promoted_at: null, claim_expires_at: null },
      { id: 'w-2', container_id: 'c-1', tier_id: 't-iv', position: 2, promoted_at: null, claim_expires_at: null },
    ],
  };
}

console.log('\n[1] unknown payment intent is ignored (non-event refunds untouched)');
await checkAsync('charge with a mobile-IV payment intent → ignored_non_event_refund', async () => {
  const db = fakeDb(seed());
  const result = await handleEventChargeRefunded(db, { payment_intent: 'pi_mobile_iv_999' });
  assert.equal(result.action, 'ignored_non_event_refund');
  assert.equal(result.matched, false);
  assert.equal(db.rpcCalls.length, 0, 'no visit transitions on ignored refunds');
  assert.equal(db.tables.event_orders[0].status, 'paid');
});
await checkAsync('charge with no payment intent at all → ignored, never throws', async () => {
  const db = fakeDb(seed());
  assert.equal((await handleEventChargeRefunded(db, {})).action, 'ignored_non_event_refund');
  assert.equal((await handleEventChargeRefunded(db, { payment_intent: null })).action, 'ignored_non_event_refund');
});

console.log('\n[2] refund sync flips order + visits and promotes the waitlist');
await checkAsync('matching charge refunds the order, transitions visits via RPC, promotes w-1', async () => {
  const db = fakeDb(seed());
  const result = await handleEventChargeRefunded(db, { payment_intent: { id: 'pi_event_123' } });
  assert.equal(result.action, 'event_refund_synced');
  assert.equal(result.matched, true);
  assert.equal(result.orderId, 'order-1');
  assert.equal(result.waitlistPromoted, true);

  assert.equal(db.tables.event_orders[0].status, 'refunded');
  assert.equal(db.tables.event_orders[0].refund_status, 'refunded');
  for (const v of db.tables.event_visits) assert.equal(v.status, 'refunded');

  // Every visit change went through the audited transition RPC.
  const transitions = db.rpcCalls.filter((c) => c.name === 'transition_event_visit');
  assert.equal(transitions.length, 2);
  for (const t of transitions) assert.equal(t.args.p_to, 'refunded');

  // Top waitlist entry got the claim window; second stayed unpromoted.
  const [w1, w2] = db.tables.event_waitlist;
  assert.ok(w1.promoted_at, 'w-1 promoted');
  assert.ok(w2.promoted_at == null, 'w-2 still waiting');
  const claimMs = new Date(w1.claim_expires_at).getTime() - new Date(w1.promoted_at).getTime();
  assert.equal(Math.round(claimMs / 3600000), WAITLIST_CLAIM_HOURS);
});

console.log('\n[3] idempotency — second refund event is a no-op');
await checkAsync('replayed charge.refunded → alreadySynced, no extra transitions/promotions', async () => {
  const db = fakeDb(seed());
  await handleEventChargeRefunded(db, { payment_intent: 'pi_event_123' });
  const callsAfterFirst = db.rpcCalls.length;

  const second = await handleEventChargeRefunded(db, { payment_intent: 'pi_event_123' });
  assert.equal(second.action, 'event_refund_already_synced');
  assert.equal(second.matched, true);
  assert.equal(db.rpcCalls.length, callsAfterFirst, 'no additional visit transitions');
  const promoted = db.tables.event_waitlist.filter((w) => w.promoted_at);
  assert.equal(promoted.length, 1, 'waitlist promoted exactly once');
});

console.log('\n[4] releaseOrderHolds — expiry path frees held seats only');
await checkAsync('held visits cancel via RPC; confirmed visits and paid orders untouched', async () => {
  const tables = seed();
  tables.event_orders.push({ id: 'order-2', container_id: 'c-1', status: 'pending', stripe_payment_intent: null });
  tables.event_visits.push(
    { id: 'v-3', order_id: 'order-2', container_id: 'c-1', tier_id: 't-iv', status: 'held' },
    { id: 'v-4', order_id: 'order-2', container_id: 'c-1', tier_id: 't-iv', status: 'held' },
  );
  const db = fakeDb(tables);
  const released = await releaseOrderHolds(db, 'order-2');
  assert.equal(released, 2);
  assert.equal(db.tables.event_visits.find((v) => v.id === 'v-3').status, 'canceled');
  assert.equal(db.tables.event_visits.find((v) => v.id === 'v-4').status, 'canceled');
  assert.equal(db.tables.event_orders.find((o) => o.id === 'order-2').status, 'expired');
  // order-1 (paid) and its confirmed visits untouched
  assert.equal(db.tables.event_orders.find((o) => o.id === 'order-1').status, 'paid');
  assert.equal(db.tables.event_visits.find((v) => v.id === 'v-1').status, 'confirmed');
});
await checkAsync('releaseOrderHolds is idempotent (second run releases nothing)', async () => {
  const tables = seed();
  tables.event_orders.push({ id: 'order-2', container_id: 'c-1', status: 'pending' });
  tables.event_visits.push({ id: 'v-3', order_id: 'order-2', container_id: 'c-1', status: 'held' });
  const db = fakeDb(tables);
  await releaseOrderHolds(db, 'order-2');
  assert.equal(await releaseOrderHolds(db, 'order-2'), 0);
  assert.equal(db.tables.event_orders.find((o) => o.id === 'order-2').status, 'expired');
});

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
