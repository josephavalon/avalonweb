import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  mfaStateFromAuthenticatorAssurance,
  readSupabaseMfaAssurance,
} from '../src/lib/mfaAssurance.js';
import { privilegedSessionFailure } from '../api/_lib/supabase-auth.js';

function clientReturning(result) {
  let calls = 0;
  return {
    client: {
      auth: {
        mfa: {
          async getAuthenticatorAssuranceLevel() {
            calls += 1;
            return result;
          },
        },
      },
    },
    calls: () => calls,
  };
}

const verified = mfaStateFromAuthenticatorAssurance(
  { currentLevel: 'aal2', nextLevel: 'aal2' },
  { enforced: true },
);
assert.equal(verified.verified, true, 'AAL2 must clear the privileged gate');
assert.equal(verified.status, 'verified');
assert.equal(verified.required, true);

const challenge = mfaStateFromAuthenticatorAssurance(
  { currentLevel: 'aal1', nextLevel: 'aal2' },
  { enforced: true },
);
assert.equal(challenge.verified, false, 'AAL1 must never clear the privileged gate');
assert.equal(challenge.status, 'challenge_required', 'an enrolled factor should route to challenge');

const enrollment = mfaStateFromAuthenticatorAssurance(
  { currentLevel: 'aal1', nextLevel: 'aal1' },
  { enforced: true },
);
assert.equal(enrollment.status, 'enrollment_required', 'an AAL1 account without a step-up path should enroll');
assert.equal(enrollment.verified, false);

const disabled = mfaStateFromAuthenticatorAssurance(
  { currentLevel: 'aal1', nextLevel: 'aal2' },
  { enforced: false },
);
assert.equal(disabled.status, 'not_enforced', 'disabled policy must preserve current non-MFA access');
assert.equal(disabled.required, false);
assert.equal(disabled.verified, false, 'disabled policy must not pretend the session is AAL2');

const successClient = clientReturning({
  data: { currentLevel: 'aal2', nextLevel: 'aal2' },
  error: null,
});
const supportedResult = await readSupabaseMfaAssurance(successClient.client, { enforced: true });
assert.equal(successClient.calls(), 1, 'the supported Supabase assurance method must be called exactly once');
assert.equal(supportedResult.verified, true);

const errorClient = clientReturning({ data: null, error: { code: 'session_unavailable' } });
const enforcedError = await readSupabaseMfaAssurance(errorClient.client, { enforced: true });
assert.equal(enforcedError.status, 'assurance_unavailable');
assert.equal(enforcedError.required, true);
assert.equal(enforcedError.verified, false, 'unreadable assurance must fail privileged access closed');

const disabledError = await readSupabaseMfaAssurance(errorClient.client, { enforced: false });
assert.equal(disabledError.status, 'not_enforced');
assert.equal(disabledError.required, false, 'an assurance outage must not lock out an environment where enforcement is off');

const thrown = await readSupabaseMfaAssurance({
  auth: { mfa: { getAuthenticatorAssuranceLevel: async () => { throw new Error('provider detail'); } } },
}, { enforced: true });
assert.equal(thrown.status, 'assurance_unavailable');
assert.equal(thrown.reason.includes('provider detail'), false, 'raw provider errors must not reach the user state');

const unsupported = await readSupabaseMfaAssurance({ auth: { mfa: {} } }, { enforced: true });
assert.equal(unsupported.status, 'assurance_unavailable', 'missing SDK support must fail closed when enforced');

const aal1Admin = { role: 'admin', aal: 'aal1', mustChangePassword: false };
assert.equal(privilegedSessionFailure(aal1Admin, { enforceMfa: true })?.code, 'mfa_required',
  'an AAL1 Admin must be denied when server MFA enforcement is enabled');
assert.equal(privilegedSessionFailure(aal1Admin, { enforceMfa: false }), null,
  'disabled server MFA must preserve local/demo compatibility');
assert.equal(privilegedSessionFailure({ ...aal1Admin, aal: 'aal2' }, { enforceMfa: true }), null,
  'an AAL2 Admin may pass the shared privileged-session policy');
assert.equal(privilegedSessionFailure({ ...aal1Admin, aal: 'aal2', mustChangePassword: true }, { enforceMfa: true })?.code, 'password_change_required',
  'forced password rotation must deny privileged access even at AAL2');
assert.equal(privilegedSessionFailure({ role: 'promoter', aal: 'aal1', mustChangePassword: false }, { enforceMfa: true }), null,
  'organizer identities must keep their assigned-event flow and are not promoted into Admin/staff policy');

const authStore = fs.readFileSync(new URL('../src/lib/useAuthStore.js', import.meta.url), 'utf8');
const adapter = fs.readFileSync(new URL('../src/lib/mfaAssurance.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const gate = fs.readFileSync(new URL('../src/components/auth/MfaGate.jsx', import.meta.url), 'utf8');
const serverAuth = fs.readFileSync(new URL('../api/_lib/supabase-auth.js', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const authSetup = fs.readFileSync(new URL('../docs/AUTH_SETUP.md', import.meta.url), 'utf8');
const passwordApi = fs.readFileSync(new URL('../api/me/account/password.js', import.meta.url), 'utf8');
const authorityMigration = fs.readFileSync(new URL('../supabase/migrations/055_profiles_authority_rls_hardening.sql', import.meta.url), 'utf8');

assert.match(adapter, /auth\?\.mfa\?\.getAuthenticatorAssuranceLevel/,
  'client assurance adapter must use Supabase mfa.getAuthenticatorAssuranceLevel()');
assert.match(authStore, /await supabaseMfaState\(\)/,
  'the app user must await the supported assurance result before rendering protected routes');
assert.doesNotMatch(authStore, /authUser\?\.(?:aal|amr)|authUser\?\.app_metadata\?\.aal/,
  'client assurance must not infer AAL/AMR from unsupported User fields');
assert.match(authStore, /status: 'not_required_demo_local'/,
  'demo/local review authentication must retain its explicit no-MFA state');
assert.match(app, /MFA_ENFORCED && requiresPrivilegedMfa\(user\) && !user\.mfa\?\.verified/,
  'privileged routes must continue to consume the verified assurance state');
for (const operation of ['listFactors', 'enroll', 'challenge', 'verify']) {
  assert.equal(gate.includes(`mfa.${operation}`), true, `MfaGate must keep ${operation} reachable`);
}
assert.match(gate, /const \{ signOut \} = useAuthStore\(\)/,
  'MfaGate must use the shared auth sign-out path so local session state clears immediately');
assert.match(gate, /onClick=\{handleSwitchAccount\}/,
  'MfaGate must keep a switch-account action reachable in every gate mode');
assert.match(gate, /Sign out & switch account/,
  'the MFA escape action must be clearly labeled for a locked-out operator');
assert.match(serverAuth, /mfaEnforced\(\)[\s\S]*?authed\.aal !== 'aal2'/,
  'server authorization must independently enforce JWT AAL2');
assert.match(serverAuth, /select\('role, tenant_id, status, must_change_password'\)/,
  'server auth must read forced-rotation state from the authoritative profile');
assert.match(serverAuth, /sendPrivilegedSessionFailure\(res, authed\)/,
  'standard privileged role gates must use the shared MFA and password-rotation policy');
for (const path of [
  '../api/_lib/os-api.js',
  '../api/events/organizer.js',
  '../api/events/assets.js',
  '../api/events/documents.js',
  '../api/appointment-summary.js',
]) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /privilegedSessionFailure/,
    `${path} must enforce the shared privileged-session policy around its custom role check`);
}
assert.ok(
  passwordApi.indexOf('auth.admin.updateUserById') < passwordApi.indexOf('must_change_password: false'),
  'the server may clear forced rotation only after the identity-provider password write completes',
);
assert.match(passwordApi, /select\('must_change_password'\)[\s\S]*?profile\?\.must_change_password !== false/,
  'the password endpoint must verify the server-owned rotation flag actually cleared');
assert.match(authStore, /apiPost\('\/api\/me\/account\/password'/,
  'the password form must use the verified server completion path');
assert.doesNotMatch(authStore, /supabase\.auth\.updateUser\(\{ password|clear_own_password_rotation_flag|\.update\(\{ must_change_password: false/,
  'the browser must not update a password and clear forced rotation independently');
assert.match(authorityMigration, /drop function if exists public\.clear_own_password_rotation_flag\(\)/,
  'the client-callable rotation bypass must be removed from the database');
assert.doesNotMatch(authorityMigration, /old\.must_change_password is true[\s\S]*new\.must_change_password is false/,
  'the profile authority guard must not retain a browser-authenticated flag-clear exception');
for (const flag of ['VITE_MFA_ENFORCED=false', 'MFA_ENFORCED=false']) {
  assert.equal(envExample.includes(flag), true, `.env.example must document ${flag}`);
  assert.equal(authSetup.includes(flag.split('=')[0]), true, `AUTH_SETUP must document ${flag.split('=')[0]}`);
}

console.log('MFA assurance QA passed: supported Supabase AAL reads, fail-closed enforcement, and lockout-safe disabled/demo behavior verified.');
