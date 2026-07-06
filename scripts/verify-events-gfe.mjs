/**
 * Pure-logic verification for the events GFE pathway + Acuity webhook branch
 * (ET3). No network, no DB, no Acuity/Qualiphy.
 *
 * Covers:
 *   1. resolveGfePathway precedence: per-event override > service default >
 *      category default from the tenant GFE settings store
 *   2. isEventsGfeAppointment type-id matching (+ env parsing)
 *   3. conductQualiphyGfe stays an env-gated placeholder
 *   4. REGRESSION: the Acuity webhook source still calls upsertAppointment for
 *      non-events appointments, and the events GFE branch returns early
 *      BEFORE that call
 *
 * Run:  node scripts/verify-events-gfe.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  resolveGfePathway,
  conductQualiphyGfe,
  parseEventsGfeTypeIds,
  isEventsGfeAppointment,
} from '../api/_lib/events-gfe.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}
async function checkAsync(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

console.log('\n[1] resolveGfePathway precedence (override > service > category default)');
check('per-event override wins over everything', () => {
  assert.equal(resolveGfePathway({
    container: { gfe_overrides: { pathway: 'qualiphy_auto' } },
    service: { gfe_pathway: 'acuity_np' },
    settings: { events: false },
  }), 'qualiphy_auto');
  assert.equal(resolveGfePathway({
    container: { gfe_overrides: { pathway: 'acuity_np' } },
    service: { gfe_pathway: 'qualiphy_auto' },
    settings: { events: true },
  }), 'acuity_np');
});
check('service default wins when no override', () => {
  assert.equal(resolveGfePathway({
    container: { gfe_overrides: {} },
    service: { gfe_pathway: 'qualiphy_auto' },
    settings: { events: false },
  }), 'qualiphy_auto');
});
check('category default comes from the GFE settings store (events toggle)', () => {
  assert.equal(resolveGfePathway({ settings: { events: true } }), 'qualiphy_auto');
  assert.equal(resolveGfePathway({ settings: { events: false } }), 'acuity_np');
  // raw gfe_settings row shape (require_events) is accepted too
  assert.equal(resolveGfePathway({ settings: { require_events: true } }), 'qualiphy_auto');
});
check('no inputs at all → acuity_np (an NP always exists; Qualiphy never assumed)', () => {
  assert.equal(resolveGfePathway({}), 'acuity_np');
  assert.equal(resolveGfePathway(), 'acuity_np');
});
check('unknown override/service values are ignored, not trusted', () => {
  assert.equal(resolveGfePathway({
    container: { gfe_overrides: { pathway: 'telepathy' } },
    service: { gfe_pathway: 'also_wrong' },
  }), 'acuity_np');
});

console.log('\n[2] isEventsGfeAppointment — type-id matching');
check('matches appointmentTypeID against the known events GFE ids', () => {
  assert.equal(isEventsGfeAppointment({ appointmentTypeID: 12345 }, ['12345', '678']), true);
  assert.equal(isEventsGfeAppointment({ appointmentTypeID: '12345' }, [12345]), true);
  assert.equal(isEventsGfeAppointment({ appointmentTypeID: 999 }, ['12345']), false);
});
check('no type id or empty id list → false, never throws', () => {
  assert.equal(isEventsGfeAppointment({}, ['12345']), false);
  assert.equal(isEventsGfeAppointment(null, ['12345']), false);
  assert.equal(isEventsGfeAppointment({ appointmentTypeID: 12345 }, []), false);
  assert.equal(isEventsGfeAppointment({ appointmentTypeID: 12345 }), false);
});
check('parseEventsGfeTypeIds handles the comma-separated env format', () => {
  assert.deepEqual(parseEventsGfeTypeIds('123, 456 ,789'), ['123', '456', '789']);
  assert.deepEqual(parseEventsGfeTypeIds(''), []);
  assert.deepEqual(parseEventsGfeTypeIds(undefined), []);
  assert.deepEqual(parseEventsGfeTypeIds(' , ,'), []);
});

console.log('\n[3] conductQualiphyGfe — explicitly a placeholder, env-gated');
await checkAsync('without QUALIPHY_API_KEY → credentials-not-configured placeholder', async () => {
  const result = await conductQualiphyGfe({ id: 'v-1' }, { env: {} });
  assert.deepEqual(result, { ok: false, placeholder: true, reason: 'qualiphy_credentials_not_configured' });
});
await checkAsync('with a key it still refuses (not implemented) — never fakes a GFE', async () => {
  const result = await conductQualiphyGfe({ id: 'v-1' }, { env: { QUALIPHY_API_KEY: 'test' } });
  assert.equal(result.ok, false);
  assert.equal(result.placeholder, true);
  assert.equal(result.reason, 'qualiphy_conduct_not_implemented');
});

console.log('\n[4] REGRESSION — Acuity webhook shape');
const webhookSrc = readFileSync(path.join(ROOT, 'api/integrations/acuity/webhook.js'), 'utf8');
check('original upsertAppointment call still present for non-events appointments', () => {
  assert.ok(webhookSrc.includes('const appointmentRecordId = await upsertAppointment(db, appt, action);'));
});
check('events GFE branch returns early BEFORE the mobile-IV upsert', () => {
  const guardIdx = webhookSrc.indexOf('isEventsGfeAppointment(appt, eventsGfeTypeIds)');
  const upsertIdx = webhookSrc.indexOf('const appointmentRecordId = await upsertAppointment(db, appt, action);');
  assert.ok(guardIdx > -1, 'scheduled-path guard exists');
  assert.ok(upsertIdx > -1, 'upsert call exists');
  assert.ok(guardIdx < upsertIdx, 'guard sits before the upsert');
  const between = webhookSrc.slice(guardIdx, upsertIdx);
  assert.match(between, /return processEventsGfeAppointment\(/, 'guard returns early');
});
check('canceled path has its own events GFE guard before the mobile-IV cancel flow', () => {
  const cancelGuard = /if \(action === 'canceled'\) \{\s*\/\/[^]{0,400}?isEventsGfeAppointment\(body, eventsGfeTypeIds\)/;
  assert.match(webhookSrc, cancelGuard);
});
check('all events GFE status changes route through the transition RPC (no direct status writes)', () => {
  const gfeSrc = readFileSync(path.join(ROOT, 'api/_lib/events-gfe.js'), 'utf8');
  assert.ok(gfeSrc.includes("db.rpc('transition_event_visit'"));
  assert.ok(!/\.update\(\{[^}]*gfe_status/.test(gfeSrc), 'gfe_status must never be written via .update()');
});

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
