import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./seed-nurse-route-beta.mjs', import.meta.url), 'utf8');

for (const required of [
  "const APPLY = process.argv.includes('--apply')",
  "const CHECK = process.argv.includes('--check')",
  "target !== 'avalonweb-beta'",
  "hostname !== `${projectRef}.supabase.co`",
  "/prod|production|main|live/i",
  "must be a .test email address",
  "tenant.brand_config?.synthetic_only !== true",
  "AVALON_BETA_COORDINATES_APPROVED",
  "AVALON_BETA_SYNTHETIC_GFE_PAYMENT_APPROVED",
  "displayName: '[BETA TEST] Joseph'",
  "displayName: '[BETA TEST] Joshua'",
  "protocolKey: 'hydration'",
  "protocolKey: 'nad'",
  'durationMinutes: 60',
  'durationMinutes: 120',
  "verification_mode: 'explicit_beta_operator_attestation_not_external_signature'",
  "publication_status', 'published'",
  "status: 'pending'",
  "approvedCandidates: []",
  'No readiness, offer, assignment, route feasibility, route plan, or release decision was fabricated.',
]) {
  assert.ok(source.includes(required), `seed is missing guard: ${required}`);
}

assert.doesNotMatch(source, /MAPBOX|mapbox/i, 'seed must not imply Mapbox is the implemented route provider');
assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY\s*=|eyJ[A-Za-z0-9_-]{20,}/, 'seed must not contain a service-role credential');
assert.doesNotMatch(source, /nurse_shift_readiness_snapshots.*insert|nurse_route_plan_versions.*insert|provider_route_days.*insert/s,
  'seed must not fabricate readiness or route feasibility');

console.log('Synthetic Nurse route beta seed verification passed.');
