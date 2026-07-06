/**
 * Pure-logic verification for door tokens + per-service clearance (ET5/T7).
 * Run:  node scripts/verify-events-qr.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mintVisitToken, verifyVisitToken, clearanceAtStation, qrMode } from '../api/_lib/events-qr.js';

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

const VISIT = {
  id: '11111111-2222-4333-8444-555555555555',
  attendee_name: 'Drill Guest',
  service_class: 'flow',
  gfe_status: 'cleared',
  gfe_scope: { iv: true },
  event_slug: 'rehearsal',
};

console.log('\n[1] Placeholder (HMAC) mode — no keypair env');
const envHmac = { SUPABASE_SERVICE_ROLE_KEY: 'test-secret' };
check('mode reports online_only_placeholder', () => {
  assert.equal(qrMode(envHmac), 'online_only_placeholder');
});
check('mint → verify roundtrip carries the payload', () => {
  const { token } = mintVisitToken(VISIT, { env: envHmac });
  const v = verifyVisitToken(token, { env: envHmac });
  assert.equal(v.valid, true);
  assert.equal(v.payload.vid, VISIT.id);
  assert.equal(v.payload.gfe, 'cleared');
  assert.equal(v.kid, 'hmac-placeholder');
});
check('tampered payload fails verification', () => {
  const { token } = mintVisitToken(VISIT, { env: envHmac });
  const [h, p, s] = token.split('.');
  const evil = JSON.parse(Buffer.from(p, 'base64url').toString());
  evil.gfe = 'cleared'; evil.nm = 'Someone Else';
  const forged = `${h}.${Buffer.from(JSON.stringify(evil)).toString('base64url')}.${s}`;
  assert.equal(verifyVisitToken(forged, { env: envHmac }).valid, false);
});
check('different secret cannot verify (per-deploy isolation)', () => {
  const { token } = mintVisitToken(VISIT, { env: envHmac });
  assert.equal(verifyVisitToken(token, { env: { SUPABASE_SERVICE_ROLE_KEY: 'other' } }).valid, false);
});

console.log('\n[2] Ed25519 mode — offline verify with kid');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const envEd = {
  EVENTS_QR_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  EVENTS_QR_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
  EVENTS_QR_KEY_ID: 'k-2026-07',
};
check('mode reports ed25519 and stamps the kid (rotation, T7)', () => {
  assert.equal(qrMode(envEd), 'ed25519');
  const { token, kid } = mintVisitToken(VISIT, { env: envEd });
  assert.equal(kid, 'k-2026-07');
  const v = verifyVisitToken(token, { env: envEd });
  assert.equal(v.valid, true);
  assert.equal(v.kid, 'k-2026-07');
});
check('signature from a different key fails', () => {
  const other = crypto.generateKeyPairSync('ed25519');
  const envOther = { ...envEd, EVENTS_QR_PUBLIC_KEY: other.publicKey.export({ type: 'spki', format: 'pem' }) };
  const { token } = mintVisitToken(VISIT, { env: envEd });
  assert.equal(verifyVisitToken(token, { env: envOther }).valid, false);
});
check('malformed tokens never throw', () => {
  for (const bad of ['', 'a.b', 'not-a-token', 'a.b.c']) {
    assert.equal(verifyVisitToken(bad, { env: envEd }).valid, false);
  }
});

console.log('\n[3] clearanceAtStation — the per-service enforcement matrix');
check('cleared for IV only: green at IV chair, RED at shot bar', () => {
  const g = { gfeStatus: 'cleared', gfeScope: { iv: true }, gfeRequired: true };
  assert.equal(clearanceAtStation(g, 'flow').allowed, true);
  assert.equal(clearanceAtStation(g, 'express').allowed, false);
  assert.equal(clearanceAtStation(g, 'express').reason, 'outside_clearance_scope');
});
check('cleared for shots only: green at shot bar, RED at IV chair', () => {
  const g = { gfeStatus: 'cleared', gfeScope: { im: true }, gfeRequired: true };
  assert.equal(clearanceAtStation(g, 'express').allowed, true);
  assert.equal(clearanceAtStation(g, 'flow').allowed, false);
});
check('cleared with empty scope = cleared for everything (pre-shot-bar events)', () => {
  const g = { gfeStatus: 'cleared', gfeScope: {}, gfeRequired: true };
  assert.equal(clearanceAtStation(g, 'flow').allowed, true);
  assert.equal(clearanceAtStation(g, 'express').allowed, true);
});
check('not cleared → stop at any clinical station, with the enum reason', () => {
  for (const gfe of ['not_started', 'invited', 'scheduled', 'in_review', 'needs_followup']) {
    const verdict = clearanceAtStation({ gfeStatus: gfe, gfeScope: {}, gfeRequired: true }, 'flow');
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.reason, `gfe_${gfe}`);
  }
});
check('experience station admits everyone with a ticket', () => {
  assert.equal(clearanceAtStation({ gfeStatus: 'not_started', gfeRequired: true }, 'experience').allowed, true);
  assert.equal(clearanceAtStation({ gfeStatus: 'cleared', gfeRequired: false }, 'experience').allowed, true);
});
check('experience-only ticket can never scan into a clinical station', () => {
  const verdict = clearanceAtStation({ gfeStatus: 'not_started', gfeScope: {}, gfeRequired: false }, 'flow');
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'not_a_clinical_ticket');
});

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
