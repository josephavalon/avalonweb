/**
 * Pure-logic verification: TTF stage math (ET6/T4) + queue SMS abstraction
 * (ET8/T10). Run:  node scripts/verify-events-ttf.mjs
 */
import assert from 'node:assert/strict';
import {
  computeStageStats, stageDurationsFromAudit, stageDurationsFromQueue,
  stageDurationsFromOrders, assembleTtfReport, TTF_BUDGETS_MS,
} from '../api/_lib/events-ttf.js';
import { sendQueueSms, smsMode, QUEUE_SMS_TEMPLATES } from '../api/_lib/events-sms.js';

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

console.log('\n[1] computeStageStats');
check('empty → nulls, never NaN', () => {
  assert.deepEqual(computeStageStats([]), { count: 0, p50: null, p95: null, max: null });
});
check('percentiles over a known series', () => {
  const s = computeStageStats([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  assert.equal(s.count, 10);
  assert.equal(s.max, 1000);
  assert.ok(s.p50 >= 500 && s.p50 <= 600, `p50=${s.p50}`);
  assert.ok(s.p95 >= 900, `p95=${s.p95}`);
});
check('negative/garbage durations are dropped', () => {
  assert.equal(computeStageStats([-5, NaN, 100]).count, 1);
});

console.log('\n[2] stageDurationsFromAudit — pairing transitions per visit');
const T0 = new Date('2026-08-15T18:00:00Z').getTime();
const iso = (offsetMin) => new Date(T0 + offsetMin * 60000).toISOString();
const audit = [
  { target_id: 'v1', to_value: 'invited', at: iso(0) },
  { target_id: 'v1', to_value: 'scheduled', at: iso(30) },
  { target_id: 'v1', to_value: 'cleared', at: iso(60) },
  { target_id: 'v1', to_value: 'confirmed', at: iso(0) },
  { target_id: 'v1', to_value: 'served', at: iso(240) },
  { target_id: 'v2', to_value: 'invited', at: iso(0) },     // never scheduled — no pair
];
check('invited→scheduled and confirmed→served pair correctly, unpaired ignored', () => {
  const stages = stageDurationsFromAudit(audit);
  assert.deepEqual(stages.gfe_invited_to_scheduled, [30 * 60000]);
  assert.deepEqual(stages.gfe_invited_to_cleared, [60 * 60000]);
  assert.deepEqual(stages.confirmed_to_served, [240 * 60000]);
});

console.log('\n[3] queue + orders stages');
check('queue join→resolved and call→resolved', () => {
  const q = stageDurationsFromQueue([
    { joined_at: iso(0), called_at: iso(20), resolved_at: iso(35) },
    { joined_at: iso(0), called_at: null, resolved_at: null },       // still in line
  ]);
  assert.deepEqual(q.queue_join_to_resolved, [35 * 60000]);
  assert.deepEqual(q.queue_call_to_resolved, [15 * 60000]);
});
check('orders: only paid orders count', () => {
  const d = stageDurationsFromOrders([
    { status: 'paid', created_at: iso(0), updated_at: iso(1) },
    { status: 'pending', created_at: iso(0), updated_at: iso(9) },
  ]);
  assert.deepEqual(d, [60000]);
});

console.log('\n[4] assembleTtfReport — budgets and alarms');
check('a p95 GFE stage past 24h raises the alarm', () => {
  const slowAudit = [
    { target_id: 'v9', to_value: 'invited', at: iso(0) },
    { target_id: 'v9', to_value: 'scheduled', at: new Date(T0 + 25 * 3600 * 1000).toISOString() },
  ];
  const report = assembleTtfReport({ auditRows: slowAudit });
  assert.ok(report.alarms.includes('gfe_invited_to_scheduled'));
  assert.equal(report.budgets, TTF_BUDGETS_MS);
});
check('healthy stages raise no alarms', () => {
  const report = assembleTtfReport({ auditRows: audit });
  assert.deepEqual(report.alarms.filter((a) => a !== 'confirmed_to_served'), []);
});

console.log('\n[5] queue SMS abstraction (ET8/T10)');
check('placeholder mode without Twilio env — nothing sends, loudly labeled', async () => {
  assert.equal(smsMode({}), 'placeholder');
  const r = await sendQueueSms({ to: '+14155550100', template: 'youre_up', optedIn: true, env: {} });
  assert.equal(r.sent, false);
  assert.equal(r.placeholder, true);
});
check('no consent → no send, even in placeholder mode', async () => {
  const r = await sendQueueSms({ to: '+14155550100', template: 'youre_up', optedIn: false, env: {} });
  assert.deepEqual(r, { sent: false, reason: 'no_consent' });
});
check('free-text bodies are structurally impossible (templates only)', async () => {
  const r = await sendQueueSms({ to: '+1', template: 'tell_them_their_diagnosis', optedIn: true, env: {} });
  assert.equal(r.reason, 'unknown_template');
});
check('every template body is content-free (no clinical vocabulary)', () => {
  const banned = ['iv', 'drip', 'medication', 'allerg', 'condition', 'protocol', 'diagnos', 'declin'];
  for (const [key, render] of Object.entries(QUEUE_SMS_TEMPLATES)) {
    const body = render({ position: 4 }).toLowerCase();
    for (const word of banned) assert.ok(!body.includes(word), `template ${key} contains "${word}"`);
  }
});
check('twilio mode requires the full credential set', () => {
  assert.equal(smsMode({ EVENTS_SMS_PROVIDER: 'twilio' }), 'placeholder');
  assert.equal(smsMode({
    EVENTS_SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+1',
  }), 'twilio');
});

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
