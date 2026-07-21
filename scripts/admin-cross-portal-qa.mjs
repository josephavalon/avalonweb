import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  allowedPortalsForUser,
  newCustomerDestinationForUser,
  readPortalIntent,
  rememberPortalIntent,
  requiresPrivilegedMfa,
  resolvePortalSession,
} from '../src/lib/portalAccess.js';

const authUser = {
  app_metadata: {},
  // Client-owned metadata must never affect authorization.
  user_metadata: { portal_access: ['admin'] },
};

assert.deepEqual(
  allowedPortalsForUser({ canonicalRole: 'admin', authUser }),
  ['customer', 'nurse', 'admin', 'organizer'],
  'every canonical Admin should receive the complete trusted portal set',
);

for (const [entry, expectedRole, expectedRedirect] of [
  ['customer', 'client', '/members/dashboard'],
  ['nurse', 'nurse', '/provider/shift'],
  ['admin', 'admin', '/admin'],
]) {
  const resolved = resolvePortalSession({ canonicalRole: 'admin', authUser, requestedPortal: entry });
  assert.equal(resolved.activePortal, entry, `${entry}: selected portal should persist`);
  assert.equal(resolved.role, expectedRole, `${entry}: effective UI role should match`);
  assert.equal(resolved.redirect, expectedRedirect, `${entry}: redirect should match`);
}

const adminCustomerSession = resolvePortalSession({ canonicalRole: 'admin', authUser, requestedPortal: 'customer' });
assert.equal(
  newCustomerDestinationForUser({
    primaryRole: 'admin',
    portalAccess: adminCustomerSession.portalAccess,
    redirect: '/admin',
  }),
  '/members/dashboard',
  'New Customer must recognize an existing Admin without creating another identity',
);

assert.deepEqual(
  allowedPortalsForUser({ canonicalRole: 'client', authUser }),
  ['customer'],
  'client-controlled metadata must not manufacture Admin access',
);

assert.equal(requiresPrivilegedMfa({ primaryRole: 'admin', role: 'client' }), true,
  'an Admin in Customer must retain the privileged MFA gate');
assert.equal(requiresPrivilegedMfa({ primaryRole: 'admin', role: 'nurse' }), true,
  'an Admin in Nurse must retain the privileged MFA gate');
assert.equal(requiresPrivilegedMfa({ primaryRole: 'nurse', role: 'nurse' }), false);

const sessionValues = new Map();
globalThis.sessionStorage = {
  getItem: (key) => sessionValues.get(key) || null,
  setItem: (key, value) => sessionValues.set(key, value),
  removeItem: (key) => sessionValues.delete(key),
};
rememberPortalIntent('nurse', 'admin@avalonvitality.co');
const [intentKey, rawIntent] = [...sessionValues.entries()][0];
const intent = JSON.parse(rawIntent);
intent.createdAt = Date.now() - (8 * 60 * 60 * 1000);
sessionValues.set(intentKey, JSON.stringify(intent));
assert.equal(readPortalIntent({ email: 'admin@avalonvitality.co' }), 'nurse',
  'selected Admin portal should survive a full field shift and session refresh');

const migration = fs.readFileSync(new URL('../supabase/migrations/041_profiles_authority_guard.sql', import.meta.url), 'utf8');
const allowlist = migration.match(/to_jsonb\(new\)\s*-\s*array\[([\s\S]*?)\]::text\[\]/i)?.[1] || '';
for (const field of ['role', 'status', 'tenant_id', 'must_change_password']) {
  assert.equal(allowlist.includes(`'${field}'`), false, `${field} must not be self-service editable`);
}
assert.match(migration, /raise exception 'Profile authority fields cannot be changed/);
assert.match(migration, /clear_own_password_rotation_flag/);

console.log('Admin cross-portal QA passed: New Customer, Returning, Admin, and Nurse.');
