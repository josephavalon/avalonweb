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
assert.match(migration, /clear_own_password_rotation_flag/,
  'the legacy migration must remain detectable so its unsafe RPC can be retired explicitly');

const authorityRls = fs.readFileSync(new URL('../supabase/migrations/055_profiles_authority_rls_hardening.sql', import.meta.url), 'utf8');
assert.match(authorityRls, /drop policy if exists "admins manage profiles" on public\.profiles/,
  'the operator-wide profile mutation policy must be retired');
assert.doesNotMatch(authorityRls, /create policy "admins manage profiles"/,
  'the broad operator profile mutation policy must not be recreated');
assert.match(authorityRls, /drop policy if exists "profiles self update" on public\.profiles/,
  'the direct authenticated self-update policy must be retired');
assert.doesNotMatch(authorityRls, /create policy "profiles self update"/,
  'patient profile edits must use the service-role API rather than direct RLS writes');
const authorityGuard = authorityRls.match(/create or replace function app_private\.guard_profile_authority_update\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1] || '';
assert.match(authorityGuard, /if auth\.role\(\) = 'service_role' then[\s\S]*return new/,
  'server-authorized profile administration must remain available to service-role APIs');
assert.doesNotMatch(authorityGuard, /app_private\.is_operator\(\)/,
  'operator status alone must never bypass the profile authority guard');
assert.doesNotMatch(authorityGuard, /auth\.uid\(\)|must_change_password|to_jsonb\(new\)/,
  'the profile guard must not retain an authenticated password-rotation exception');
assert.equal((authorityGuard.match(/\breturn new;/g) || []).length, 1,
  'only service-role APIs may pass the profile update trigger');
assert.match(authorityGuard, /raise exception 'Profiles can only be changed through an authorized server API\.'/,
  'all direct clinical and authority mutations must fail closed');
assert.match(authorityRls, /revoke execute on function public\.clear_own_password_rotation_flag\(\) from authenticated[\s\S]*drop function if exists public\.clear_own_password_rotation_flag\(\)/,
  'the browser-callable password-rotation flag RPC must be revoked and removed');

const emailResolver = authorityRls.match(/create or replace function public\.resolve_unique_profile_id_by_email\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1] || '';
assert.match(emailResolver, /auth\.role\(\) <> 'service_role'/,
  'legacy profile identity resolution must remain server-only');
assert.match(emailResolver, /profile\.tenant_id = p_tenant_id[\s\S]*lower\(btrim\(profile\.email\)\) = v_email[\s\S]*limit 2/,
  'legacy email resolution must use exact canonical equality inside one tenant');
assert.match(emailResolver, /coalesce\(cardinality\(v_ids\), 0\) <> 1[\s\S]*return null/,
  'zero and ambiguous email matches must fail closed');
assert.doesNotMatch(emailResolver, /\bilike\b|~~\*/i,
  'email identity resolution must never interpret percent or underscore as wildcards');
assert.match(authorityRls, /revoke all on function public\.resolve_unique_profile_id_by_email\(uuid, text\) from anon, authenticated[\s\S]*grant execute on function public\.resolve_unique_profile_id_by_email\(uuid, text\) to service_role/,
  'only the service role may execute the email resolver');

const patientUpdateRpc = authorityRls.match(/create or replace function public\.update_patient_profile_fields\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1] || '';
assert.match(patientUpdateRpc, /auth\.role\(\) <> 'service_role'/,
  'patient profile mutation must remain a server-owned operation');
assert.match(patientUpdateRpc, /where profile\.id = p_profile_id[\s\S]*profile\.tenant_id = p_tenant_id/,
  'patient profile mutation must bind both stable profile id and tenant');
const patientEditableAllowlist = patientUpdateRpc.match(/where key <> all \(array\[([\s\S]*?)\]::text\[\]\)/i)?.[1] || '';
const patientEditableFields = [...patientEditableAllowlist.matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(patientEditableFields, [
  'full_name', 'preferred_name', 'address', 'date_of_birth', 'phone',
  'emergency_contact', 'phi', 'comm_prefs',
], 'the RPC may accept only the explicit patient-editable profile fields');
for (const authorityField of ['role', 'status', 'tenant_id', 'must_change_password']) {
  assert.equal(patientEditableFields.includes(authorityField), false,
    `${authorityField} must never be patient-editable`);
}
for (const clinicianField of ['nurseNotes', 'lastReviewedAt', 'lastReviewedBy']) {
  assert.match(patientUpdateRpc, new RegExp(`p_patch->'phi' - array\\[[\\s\\S]*'${clinicianField}'`),
    `${clinicianField} must be removed from patient-supplied PHI`);
  assert.match(patientUpdateRpc, new RegExp(`profile\\.phi->'${clinicianField}'`),
    `${clinicianField} must be restored from the row locked by the update`);
}
assert.equal((patientUpdateRpc.match(/update public\.profiles as profile/g) || []).length, 1,
  'patient PHI preservation and mutation must happen in one database update');
assert.match(authorityRls, /revoke all on function public\.update_patient_profile_fields\(uuid, uuid, jsonb\) from anon, authenticated[\s\S]*grant execute on function public\.update_patient_profile_fields\(uuid, uuid, jsonb\) to service_role/,
  'only the service role may execute the patient profile update RPC');

const profileApi = fs.readFileSync(new URL('../api/me/profile.js', import.meta.url), 'utf8');
assert.match(profileApi, /resolveUniqueProfileIdByEmail\(db, \{ tenantId, email \}\)/,
  'legacy profile reads must use the exact tenant-bound resolver');
assert.doesNotMatch(profileApi, /\.ilike\(|\.eq\('email'/,
  'profile identity and mutation must never use a caller-controlled email query');
assert.match(profileApi, /db\.rpc\('update_patient_profile_fields', \{[\s\S]*p_profile_id: currentProfile\.id,[\s\S]*p_tenant_id: tenantId,[\s\S]*p_patch: patch/,
  'the profile API must use the tenant/id-bound atomic patient update RPC');
assert.doesNotMatch(profileApi, /\.from\('profiles'\)[\s\S]{0,180}?\.update\(/,
  'the profile API must not perform a stale read/merge/write update');
const memberAccount = fs.readFileSync(new URL('../app-modules/pages/members/Account.jsx', import.meta.url), 'utf8');
const memberProfilePayload = memberAccount.match(/function formToServerPayload\(form\) \{([\s\S]*?)\n\}\n\n\/\/ Build the local form state/)?.[1] || '';
assert.match(memberProfilePayload, /patientNotes: form\.health\.nurseNotes/,
  'member-authored context must be stored separately from clinician nurseNotes');
assert.doesNotMatch(memberProfilePayload, /\n\s+nurseNotes: form\.health\.nurseNotes/,
  'member profile PATCH must not overwrite clinician nurseNotes');

const serverAuth = fs.readFileSync(new URL('../api/_lib/supabase-auth.js', import.meta.url), 'utf8');
assert.match(serverAuth, /\.insert\(row\)/,
  'first-touch profile bootstrap must be insert-only');
assert.doesNotMatch(serverAuth, /\.upsert\(row/,
  'first-touch auth must never overwrite role, status, or tenant');
assert.match(serverAuth, /if \(profileError\)[\s\S]*?return null;/,
  'profile lookup errors must fail authentication closed');
assert.match(serverAuth, /error\?\.code === '23505'[\s\S]*?\.select\('role, tenant_id, status'\)/,
  'a concurrent profile insert must resolve by reading the authoritative row');

console.log('Admin cross-portal QA passed: portal identity and profile authority RLS are hardened.');
