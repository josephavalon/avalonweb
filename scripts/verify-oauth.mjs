#!/usr/bin/env node
/**
 * Verify Supabase Auth provider configuration after the human adds secrets in
 * Supabase Studio.
 *
 * Required env:
 *   VITE_SUPABASE_URL
 * Optional:
 *   VITE_SUPABASE_ANON_KEY (sent as apikey if supplied)
 */

const url = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!url) fail('Set VITE_SUPABASE_URL.');

const res = await fetch(`${url}/auth/v1/settings`, {
  headers: anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {},
});
if (!res.ok) fail(`/auth/v1/settings returned HTTP ${res.status}.`);

const settings = await res.json();
const checks = [
  ['google', settings?.external?.google?.enabled === true],
  ['apple', settings?.external?.apple?.enabled === true],
  ['phone', settings?.external?.phone?.enabled === true],
];

let ok = true;
for (const [provider, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}: external.${provider}.enabled`);
  if (!pass) ok = false;
}

if (!ok) process.exit(1);
console.log('PASS: Supabase OAuth/phone providers are enabled.');
