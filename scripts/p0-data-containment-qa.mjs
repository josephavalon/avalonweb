import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyQualiphyMutationEnabled } from '../api/_lib/qualiphy-webhook-policy.js';
import { resolveUniqueProfileIdByEmail } from '../api/_lib/gfe-core.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const attachmentMigration = read('supabase/migrations/056_secure_member_message_attachments.sql');
const messages = read('app-modules/pages/members/Messages.jsx');
const bookNow = read('app-modules/pages/BookNow.jsx');
const account = read('app-modules/pages/members/Account.jsx');
const platformOps = read('app-modules/lib/platformOps.js');
const authStore = read('src/lib/useAuthStore.js');
const localOs = read('src/lib/localOs.js');
const preApiSecurity = read('src/lib/preApiSecurity.js');
const qualiphyWebhook = read('api/webhooks/qualiphy-inbound.js');
const qualiphyWebhookPolicy = read('api/_lib/qualiphy-webhook-policy.js');
const gfeCore = read('api/_lib/gfe-core.js');
const profileIdentity = read('api/_lib/profile-identity.js');
const profileApi = read('api/me/profile.js');
const profileAuthorityMigration = read('supabase/migrations/055_profiles_authority_rls_hardening.sql');

assert.match(attachmentMigration, /update storage\.buckets[\s\S]*set public = false[\s\S]*id = 'member-messages'/,
  'member message storage must be private');
for (const policy of [
  'members upload own message images',
  'members read own message images',
  'members delete own message images',
]) {
  assert.equal(attachmentMigration.includes(`drop policy if exists "${policy}"`), true,
    `browser-direct storage policy must be removed: ${policy}`);
}

for (const forbidden of ['getPublicUrl', 'from(MSG_IMAGE_BUCKET)', 'type="file"', 'src={att.url}', 'href={att.url}']) {
  assert.equal(messages.includes(forbidden), false, `member messaging must not retain direct attachment behavior: ${forbidden}`);
}
assert.doesNotMatch(messages, /\.select\([^\n]*(?:attachments|image_url)/,
  'member message queries must not return legacy attachment metadata or public URLs to the browser');
assert.match(messages, /Attachments are temporarily unavailable/,
  'the contained UI must explain that attachments are unavailable');

assert.doesNotMatch(bookNow, /sessionStorage\.setItem\(BOOKING_SESSION_KEY/,
  'BookNow must never persist the Clinical booking form in session storage');
for (const forbidden of [
  'saveBookingDraft(',
  'saveLastBooking(',
  "writeLocal('webstore.groupLead'",
  "writeLocal('webstore.subscriptionIntake'",
  'orchestrateOrderHandoff(',
]) {
  assert.equal(bookNow.includes(forbidden), false, `live booking must not persist browser Clinical state: ${forbidden}`);
}
assert.match(localOs, /sessionStorage\?\.removeItem\('avalon\.webstore\.sessionDraft'\)/,
  'sign-out must remove the legacy non-prefixed booking session draft');

assert.match(platformOps, /export function clearClientProfileCache\(\)[\s\S]*clearLocal\('clientProfile'\)/,
  'the legacy browser profile cache must have an explicit purge');
assert.match(authStore, /async function buildSupabaseUser[\s\S]*clearClientProfileCache\(\)/,
  'every real Supabase session must purge the legacy browser profile cache');
assert.match(account, /await apiPatch\('\/api\/me\/profile', payload\);[\s\S]*clearClientProfileCache\(\)/,
  'live profile saves must leave authority on the server and clear browser state');
assert.doesNotMatch(account, /await apiPatch\('\/api\/me\/profile', payload\);[\s\S]{0,240}persistLocal\(\)/,
  'live profile saves must not mirror Clinical data into local storage');

for (const key of ['address', 'covidstatus', 'infectiousstatus', 'ivhistory', 'nursenotes', 'phipolicy', 'gfe']) {
  assert.equal(preApiSecurity.includes(`'${key}'`), true, `local redaction must include ${key}`);
}

assert.match(qualiphyWebhookPolicy, /QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED/,
  'legacy Clinical callback mutation must require an explicit containment flag');
assert.match(qualiphyWebhookPolicy, /return enabled && localRuntime && localDeployment/,
  'the legacy Clinical callback must require an explicit flag and a local-only runtime');
assert.ok(
  qualiphyWebhook.indexOf('if (!legacyQualiphyMutationEnabled())') < qualiphyWebhook.indexOf('const expected = process.env.QUALIPHY_WEBHOOK_SECRET'),
  'production containment must run before the legacy shared-secret path',
);
assert.match(gfeCore, /legacyQualiphyMutationEnabled\(\) \? process\.env\.QUALIPHY_WEBHOOK_SECRET : ''/,
  'production exam invites must not disclose the disabled legacy URL secret to the provider');
assert.match(profileIdentity, /db\.rpc\('resolve_unique_profile_id_by_email', \{[\s\S]*p_tenant_id: tenantId,[\s\S]*p_email: canonicalEmail/,
  'legacy identity lookup must delegate to the tenant-bound exact database resolver');
for (const source of [profileIdentity, gfeCore, profileApi]) {
  assert.doesNotMatch(source, /\.ilike\(/,
    'profile identity code must not interpret caller-controlled email characters as wildcards');
}
const emailResolverSql = profileAuthorityMigration.match(/create or replace function public\.resolve_unique_profile_id_by_email\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1] || '';
assert.match(emailResolverSql, /profile\.tenant_id = p_tenant_id[\s\S]*lower\(btrim\(profile\.email\)\) = v_email[\s\S]*limit 2/,
  'database identity resolution must use exact canonical equality in one tenant');
assert.match(emailResolverSql, /coalesce\(cardinality\(v_ids\), 0\) <> 1/,
  'database identity resolution must fail closed for zero or duplicate matches');
assert.doesNotMatch(emailResolverSql, /\bilike\b|~~\*/i,
  'database identity resolution must never use wildcard comparison');
assert.doesNotMatch(gfeCore, /\.from\('profiles'\)[\s\S]{0,180}?\.eq\('email'/,
  'GFE reads and writes must not use a non-unique email as the mutation key');
assert.match(gfeCore, /\.from\('profiles'\)\.update\(\{ gfe: gfeRecord \}\)\.eq\('id', profileId\)\.eq\('tenant_id', tenantId\)/,
  'GFE cache writes must bind the resolved profile id and tenant');
assert.match(qualiphyWebhook, /resolveUniqueProfileIdByEmail\(db, \{ tenantId: appt\.tenant_id, email \}\)/,
  'even the synthetic callback must fail closed on ambiguous profile identity');
assert.match(qualiphyWebhook, /\.eq\('id', profileId\)\.eq\('tenant_id', appt\.tenant_id\)/,
  'synthetic callback profile writes must bind stable profile id and tenant');

function profileLookupDb(data, error = null) {
  const calls = [];
  const db = {
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      return { data, error };
    },
  };
  return { db, calls };
}

const uniqueProfile = profileLookupDb('profile-1');
assert.equal(await resolveUniqueProfileIdByEmail(uniqueProfile.db, { tenantId: 'tenant-1', email: 'USER@EXAMPLE.COM' }), 'profile-1');
assert.deepEqual(uniqueProfile.calls, [
  ['rpc', 'resolve_unique_profile_id_by_email', {
    p_tenant_id: 'tenant-1',
    p_email: 'user@example.com',
  }],
]);
assert.equal(await resolveUniqueProfileIdByEmail(profileLookupDb(null).db, { tenantId: 'tenant-1', email: 'user@example.com' }), null,
  'zero matching profiles must skip Clinical cache mutation');
assert.equal(await resolveUniqueProfileIdByEmail(profileLookupDb(null).db, { tenantId: 'tenant-1', email: 'duplicate@example.com' }), null,
  'an ambiguity rejected by the database resolver must fail closed');
assert.equal(await resolveUniqueProfileIdByEmail(profileLookupDb('profile-1', { code: 'db_error' }).db, { tenantId: 'tenant-1', email: 'user@example.com' }), null,
  'profile lookup errors must fail closed');
const wildcardEmail = profileLookupDb('profile-literal');
assert.equal(await resolveUniqueProfileIdByEmail(wildcardEmail.db, {
  tenantId: 'tenant-1',
  email: ' USER_100%+TAG@EXAMPLE.COM ',
}), 'profile-literal');
assert.equal(wildcardEmail.calls[0][2].p_email, 'user_100%+tag@example.com',
  'percent and underscore must be passed as literal canonical email characters');
assert.equal(legacyQualiphyMutationEnabled({ QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'true', VERCEL_ENV: 'production' }), false,
  'the legacy callback flag must not override the production deny');
assert.equal(legacyQualiphyMutationEnabled({ QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'true', NODE_ENV: 'production' }), false,
  'NODE_ENV production must also deny the legacy callback');
assert.equal(legacyQualiphyMutationEnabled({}), false,
  'empty environment configuration must fail closed');
assert.equal(legacyQualiphyMutationEnabled({ QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'true' }), false,
  'the explicit flag alone must not enable legacy mutations without a local runtime');
assert.equal(legacyQualiphyMutationEnabled({
  QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'true',
  NODE_ENV: 'development',
  VERCEL_ENV: 'preview',
}), false, 'a preview deployment must remain read-only even when NODE_ENV looks local');
assert.equal(legacyQualiphyMutationEnabled({
  QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'true',
  NODE_ENV: 'test',
  VERCEL_ENV: 'production',
}), false, 'a production Vercel environment must win over a test NODE_ENV');
assert.equal(legacyQualiphyMutationEnabled({ QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'true', NODE_ENV: 'development' }), true,
  'explicit local synthetic testing remains possible');
assert.equal(legacyQualiphyMutationEnabled({
  QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED: 'yes',
  NODE_ENV: 'test',
  VERCEL_ENV: 'development',
}), true, 'explicit synthetic test mode remains possible in a local Vercel environment');
assert.doesNotMatch(qualiphyWebhook, /console\.warn\([^\n]*patientExamId/,
  'provider patient identifiers must not be written to logs');

console.log('P0 data containment QA passed: public attachments, live Clinical browser caching, and the legacy production webhook are contained.');
