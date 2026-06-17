/**
 * Pure-logic verification for the admin team-management feature. No network,
 * no DB, no Stripe — just the decision logic that gates access and invites.
 *
 * Covers:
 *   1. Invite token/code hashing + expiry validation (api/_lib/invite-token.js)
 *   2. Last-admin guard (api/_lib/team-core.js → decideDropsLastAdmin)
 *   3. Role → allowed-route mapping (src/lib/adminAccess.js)
 *
 * Run:  node scripts/verify-team-access.mjs
 */
import assert from 'node:assert/strict';
import {
  generateToken, generateCode, hashToken, hashCode, safeEqualHex, isInviteLive, isValidTier,
} from '../api/_lib/invite-token.js';
import { decideDropsLastAdmin, TEAM_ROLES } from '../api/_lib/team-core.js';
import { canAccessAdminRoute, allowedRolesForRoute, LIVE_ADMIN_ROUTES } from '../src/lib/adminAccess.js';

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

console.log('\n[1] Invite token + code');
check('hashToken is deterministic and matches via safeEqualHex', () => {
  const t = generateToken();
  assert.equal(hashToken(t), hashToken(t));
  assert.ok(safeEqualHex(hashToken(t), hashToken(t)));
});
check('different tokens produce different hashes', () => {
  assert.notEqual(hashToken(generateToken()), hashToken(generateToken()));
});
check('generateCode is a 6-digit numeric string', () => {
  for (let i = 0; i < 50; i += 1) assert.match(generateCode(), /^\d{6}$/);
});
check('code hash is scoped to the email', () => {
  const code = '123456';
  assert.notEqual(hashCode('a@x.com', code), hashCode('b@x.com', code));
  // email is normalized (trim + lowercase)
  assert.equal(hashCode('A@X.com', code), hashCode('  a@x.com ', code));
});
check('safeEqualHex rejects mismatched / empty', () => {
  assert.equal(safeEqualHex(hashToken('a'), hashToken('b')), false);
  assert.equal(safeEqualHex('', ''), false);
  assert.equal(safeEqualHex('zz', 'zz'), false); // invalid hex → length 0
});
check('isInviteLive requires pending + future expiry', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();
  assert.equal(isInviteLive({ status: 'pending', expires_at: future }), true);
  assert.equal(isInviteLive({ status: 'pending', expires_at: past }), false);
  assert.equal(isInviteLive({ status: 'accepted', expires_at: future }), false);
  assert.equal(isInviteLive({ status: 'revoked', expires_at: future }), false);
  assert.equal(isInviteLive(null), false);
});
check('isValidTier only accepts staff/admin', () => {
  assert.equal(isValidTier('staff'), true);
  assert.equal(isValidTier('admin'), true);
  assert.equal(isValidTier('nurse'), false);
  assert.equal(isValidTier('client'), false);
});

console.log('\n[2] Last-admin guard');
const ADMIN = { role: 'admin', status: 'active' };
const STAFF = { role: 'staff', status: 'active' };
check('demoting the only active admin is blocked', () => {
  assert.equal(decideDropsLastAdmin(ADMIN, { nextRole: 'staff' }, 1), true);
});
check('deactivating the only active admin is blocked', () => {
  assert.equal(decideDropsLastAdmin(ADMIN, { nextStatus: 'inactive' }, 1), true);
});
check('demoting one of two admins is allowed', () => {
  assert.equal(decideDropsLastAdmin(ADMIN, { nextRole: 'staff' }, 2), false);
});
check('changing a staff member never trips the guard', () => {
  assert.equal(decideDropsLastAdmin(STAFF, { nextRole: 'admin' }, 1), false);
  assert.equal(decideDropsLastAdmin(STAFF, { nextStatus: 'inactive' }, 1), false);
});
check('admin staying admin+active is fine even as the last one', () => {
  assert.equal(decideDropsLastAdmin(ADMIN, { nextRole: 'admin', nextStatus: 'active' }, 1), false);
});
check('TEAM_ROLES is exactly staff + admin', () => {
  assert.deepEqual([...TEAM_ROLES].sort(), ['admin', 'staff']);
});

console.log('\n[3] Role → allowed routes');
check('admin can open only live admin routes when preview is off', () => {
  for (const p of LIVE_ADMIN_ROUTES) assert.equal(canAccessAdminRoute('admin', p), true);
  for (const p of ['/admin/crm', '/admin/credentials', '/admin/field', '/admin/client-heat-map', '/admin/dispatch']) {
    assert.equal(canAccessAdminRoute('admin', p), false);
  }
});
check('dispatch and preview surfaces are redirect-only when preview is off', () => {
  for (const role of ['admin', 'staff']) {
    assert.equal(canAccessAdminRoute(role, '/admin/dispatch'), false);
    assert.equal(canAccessAdminRoute(role, '/admin/client-heat-map'), false);
  }
});
check('staff can open the live staff surface, including read-only Team', () => {
  for (const p of LIVE_ADMIN_ROUTES) assert.equal(canAccessAdminRoute('staff', p), true);
});
check('staff is blocked from hidden preview and sensitive routes when preview is off', () => {
  for (const p of ['/admin/crm', '/admin/credentials', '/admin/field', '/admin/client-heat-map', '/admin/dispatch']) {
    assert.equal(canAccessAdminRoute('staff', p), false);
  }
});
check('unknown role can open nothing', () => {
  assert.equal(canAccessAdminRoute('nurse', '/admin'), false);
  assert.equal(canAccessAdminRoute('client', '/admin/crm'), false);
});
check('allowedRolesForRoute adds staff only on staff routes', () => {
  assert.deepEqual(allowedRolesForRoute('/admin/crm'), ['admin', 'staff']);
  assert.deepEqual(allowedRolesForRoute('/admin/team'), ['admin', 'staff']);
  assert.deepEqual(allowedRolesForRoute('/admin/credentials'), ['admin']);
});

console.log(`\n${process.exitCode ? 'FAILED' : `OK — ${passed} checks passed`}\n`);
