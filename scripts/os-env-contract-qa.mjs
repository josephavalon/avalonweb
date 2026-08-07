import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const base = {
  ...process.env,
  AVALON_OS_BETA: 'true',
  VITE_AVALON_OS_BETA: 'true',
  VITE_AVALON_DEMO_AUTH: 'false',
  PUBLIC_SITE_URL: 'https://beta.avalonvitality.co',
  VITE_PUBLIC_SITE_URL: 'https://beta.avalonvitality.co',
  SUPABASE_URL: 'https://betaref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-placeholder',
  VITE_SUPABASE_URL: 'https://betaref.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'synthetic-anon-placeholder',
  AVALON_BETA_SUPABASE_PROJECT_REF: 'betaref',
  STRIPE_SECRET_KEY: 'sk_test_synthetic_placeholder',
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_synthetic_placeholder',
  ACUITY_USER_ID: 'synthetic-user',
  ACUITY_API_KEY: 'synthetic-key',
  ACUITY_BETA_CALENDAR_ID: 'sandbox-calendar',
  BETA_EMAIL_RECIPIENT_ALLOWLIST: 'reviewer@example.test',
  BETA_SMS_RECIPIENT_ALLOWLIST: '+15555550100',
  VERCEL_PROJECT_ID: 'prj_smizqQYWmruc0rbuWIulXxKUMQvD',
  VERCEL_ENV: 'preview',
};

function verify(overrides = {}) {
  return spawnSync(process.execPath, ['scripts/verify-avalon-os-beta-env.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...base, ...overrides },
    encoding: 'utf8',
  });
}

assert.equal(verify().status, 0, 'isolated beta fixture must pass');
assert.notEqual(verify({ STRIPE_SECRET_KEY: 'sk_live_forbidden' }).status, 0, 'live Stripe must fail');
assert.notEqual(verify({ SUPABASE_URL: 'https://wrong.supabase.co' }).status, 0, 'mismatched Supabase must fail');
assert.notEqual(verify({ VERCEL_PROJECT_ID: 'prj_production' }).status, 0, 'wrong Vercel project must fail');
assert.notEqual(verify({ VERCEL_ENV: 'production' }).status, 0, 'production deploy target must fail');
assert.notEqual(verify({ VITE_AVALON_DEMO_AUTH: 'true' }).status, 0, 'demo auth must fail');

console.log('Avalon OS environment QA passed isolated beta and refused production credentials, projects, targets, and demo auth.');
