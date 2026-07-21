#!/usr/bin/env node
/**
 * Verify Supabase Auth provider configuration after the human adds secrets in
 * Supabase Studio. Providers are launch-required only when the matching
 * VITE_AUTH_* flag is enabled for the build; otherwise the UI must keep them
 * hidden and this verifier records them as intentionally disabled.
 *
 * Required env:
 *   VITE_SUPABASE_URL
 * Optional:
 *   VITE_SUPABASE_ANON_KEY (sent as apikey if supplied)
 */

import { loadEnvFiles } from './_load-env.mjs';

loadEnvFiles(['.env.local', '.env']);

const strict = ['1', 'true', 'yes'].includes(String(process.env.OAUTH_VERIFY_STRICT || '').toLowerCase());

function envFlag(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

const requiredProviders = {
  google: strict || envFlag('VITE_AUTH_GOOGLE_ENABLED'),
  apple: strict || envFlag('VITE_AUTH_APPLE_ENABLED'),
  phone: strict || envFlag('VITE_AUTH_PHONE_ENABLED'),
};
const requiredCount = Object.values(requiredProviders).filter(Boolean).length;
const url = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!url && requiredCount === 0) {
  console.log('PASS: no Supabase OAuth/phone providers are exposed by this build.');
  process.exit(0);
}
if (!url) fail('Set VITE_SUPABASE_URL.');

const res = await fetch(`${url}/auth/v1/settings`, {
  headers: anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {},
});
if (!res.ok) fail(`/auth/v1/settings returned HTTP ${res.status}.`);

const settings = await res.json();
const checks = [
  ['google', requiredProviders.google, settings?.external?.google?.enabled === true],
  ['apple', requiredProviders.apple, settings?.external?.apple?.enabled === true],
  ['phone', requiredProviders.phone, settings?.external?.phone?.enabled === true],
];

let ok = true;
for (const [provider, required, enabled] of checks) {
  if (!required) {
    console.log(`PASS: external.${provider}.enabled not required because VITE_AUTH_${provider.toUpperCase()}_ENABLED is not true`);
    continue;
  }
  console.log(`${enabled ? 'PASS' : 'FAIL'}: external.${provider}.enabled`);
  if (!enabled) ok = false;
}

if (!ok) process.exit(1);
console.log(requiredCount
  ? 'PASS: required Supabase OAuth/phone providers are enabled.'
  : 'PASS: no Supabase OAuth/phone providers are exposed by this build.');
