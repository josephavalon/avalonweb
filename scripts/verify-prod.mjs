#!/usr/bin/env node
/**
 * Launch verification orchestrator. Runs the go-live smoke checks in order and
 * stops on the first failure.
 */
import { spawn } from 'node:child_process';
import { loadEnvFiles } from './_load-env.mjs';

loadEnvFiles([process.env.VERIFY_ENV_FILE, '.env.local', '.env'].filter(Boolean));

const requiredEnv = [
  'API_BASE_URL',
  'PUBLIC_SITE_URL',
  'AVALON_ENABLE_LIVE_API',
  'VITE_AVALON_ENABLE_LIVE_API',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VERIFY_EMAIL_ROOT',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'STRIPE_SECRET_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'APPOINTMENT_SUMMARY_TOKEN_SECRET',
  'ACUITY_VERIFY',
  'ACUITY_USER_ID',
  'ACUITY_API_KEY',
];

const missing = requiredEnv.filter((key) => !String(process.env[key] || '').trim());
if (missing.length) {
  console.error(`FAIL: Missing required verify:prod env: ${missing.join(', ')}`);
  process.exit(1);
}
if (!String(process.env.API_BASE_URL || '').startsWith('https://')) {
  console.error('FAIL: API_BASE_URL must be the HTTPS snooches origin.');
  process.exit(1);
}
if (!String(process.env.PUBLIC_SITE_URL || '').startsWith('https://')) {
  console.error('FAIL: PUBLIC_SITE_URL must be the HTTPS snooches origin.');
  process.exit(1);
}
if (process.env.AVALON_ENABLE_LIVE_API !== 'true' || process.env.VITE_AVALON_ENABLE_LIVE_API !== 'true') {
  console.error('FAIL: AVALON_ENABLE_LIVE_API and VITE_AVALON_ENABLE_LIVE_API must both be true for launch verification.');
  process.exit(1);
}
if (!String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_')) {
  console.error('FAIL: STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_...), never live.');
  process.exit(1);
}
if (!String(process.env.VITE_STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_')) {
  console.error('FAIL: VITE_STRIPE_PUBLISHABLE_KEY must be a Stripe publishable key.');
  process.exit(1);
}
if (process.env.ACUITY_VERIFY !== '1') {
  console.error('FAIL: Set ACUITY_VERIFY=1 to acknowledge that the verifier creates and cleans up real Acuity test appointments.');
  process.exit(1);
}
if (!process.env.ACUITY_DEFAULT_TYPE_ID && (!process.env.ACUITY_TYPE_HYDRATION || !process.env.ACUITY_TYPE_MEMBERSHIP)) {
  console.error('FAIL: Set ACUITY_DEFAULT_TYPE_ID, or both ACUITY_TYPE_HYDRATION and ACUITY_TYPE_MEMBERSHIP, for deterministic booking-to-Acuity verification.');
  process.exit(1);
}

const steps = [
  ['verify:signup', ['npm', ['run', 'verify:signup']]],
  ['verify:team-invite', ['npm', ['run', 'verify:team-invite']]],
  ['test:oauth-config', ['npm', ['run', 'test:oauth-config']]],
  ['verify:booking-to-acuity', ['npm', ['run', 'verify:booking-to-acuity']]],
  ['verify:plan-billing', ['npm', ['run', 'verify:plan-billing']]],
  ['verify:password-reset', ['npm', ['run', 'verify:password-reset']]],
];

function run(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${label}`);
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

for (const [label, [command, args]] of steps) {
  try {
    await run(label, command, args);
  } catch (err) {
    console.error(`\nFAIL: ${err.message}`);
    process.exit(1);
  }
}

console.log('\nPASS: all go-live verification scripts passed.');
