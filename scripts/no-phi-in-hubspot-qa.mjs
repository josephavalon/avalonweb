/**
 * HubSpot PHI guard — enforces the HIPAA route-around.
 *
 * HubSpot does not sign a BAA with Avalon. `api/_hubspot.js` is the sole
 * outbound chokepoint and its `buildHubspotProperties` explicitly allowlists a
 * fixed set of identifiers + lifecycle + hospitality fields. This script
 * runtime-verifies the allowlist:
 *
 *   1. Assert that PHI-shaped fields provided as input are NEVER present in
 *      the resulting `properties` object.
 *   2. Assert that a hospitality free-text field containing PHI-shaped tokens
 *      throws `HubspotPhiRefused` (defense in depth against staff pasting
 *      clinical notes into "hospitality notes").
 *
 * Runs green even if HUBSPOT_SYNC_ENABLED is false — it operates on the
 * builder, not the wire.
 */

import { buildHubspotProperties, HubspotPhiRefused } from '../api/_hubspot.js';

const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function assertNoKey(props, key, label) {
  assert(!(key in props), `[${label}] property "${key}" should NEVER be in HubSpot payload`);
}

// --- Test 1: PHI inputs are silently stripped by the allowlist -----------

const phiLoaded = {
  email: 'phi-guard@example.com',
  firstName: 'Guard',
  lastName: 'Test',
  phone: '+15555550100',
  city: 'Sherman Oaks',
  source: 'Avalon Signup',
  lifecycleStage: 'Lead',
  // Every one of the following is PHI-shaped or PHI itself and must be
  // dropped by the allowlist inside buildHubspotProperties.
  dob: '1985-04-01',
  birthDate: '1985-04-01',
  date_of_birth: '1985-04-01',
  address: '123 Real St',
  saved_address: { line1: '123 Real St', city: 'LA', zip: '90001' },
  zip: '90001',
  emergencyContact: { name: 'Kin', phone: '+15555550101' },
  emergency_contact: { name: 'Kin', phone: '+15555550101' },
  allergies: 'penicillin',
  medications: 'lisinopril',
  medicalConditions: 'hypertension',
  medical_history: 'diabetes',
  intakeNotes: 'wants IV for hangover',
  notes: 'has migraines',
  gfe: { status: 'cleared', clearedAt: '2026-01-01', examId: 'q_123' },
  phi: { allergies: 'x', medications: 'y', conditions: 'z' },
  covidPositive: 'No',
  infectiousDisease: 'No',
  ivBefore: 'Yes',
  nurseNotes: 'client anxious',
};

const props = buildHubspotProperties(phiLoaded);

for (const forbidden of [
  'dob', 'date_of_birth', 'birthdate',
  'address', 'saved_address', 'zip', 'street',
  'emergency_contact', 'emergencyContact',
  'allergies', 'medications', 'medicalconditions', 'medical_history',
  'intakenotes', 'notes', 'phi',
  'gfe', 'covidPositive', 'infectiousdisease', 'ivbefore', 'nursenotes',
]) {
  assertNoKey(props, forbidden, 'phi-allowlist');
}

// Positive assertions: identifiers made it through
assert(props.email === 'phi-guard@example.com', '[phi-allowlist] email should be normalized+included');
assert(props.firstname === 'Guard', '[phi-allowlist] firstname should pass through');
assert(props.lastname === 'Test', '[phi-allowlist] lastname should pass through');
assert(props.city === 'Sherman Oaks', '[phi-allowlist] city should pass through');
assert(props.avalon_source === 'Avalon Signup', '[phi-allowlist] avalon_source should pass through');
assert(props.avalon_lifecycle_stage === 'Lead', '[phi-allowlist] avalon_lifecycle_stage should pass through');

// --- Test 2: Hospitality free-text with PHI tokens throws ------------------

function shouldThrowPhi(label, guestProfileValue) {
  try {
    buildHubspotProperties({
      email: 'test@example.com',
      guestProfile: guestProfileValue,
    });
    failures.push(`[phi-freetext] ${label} should have thrown HubspotPhiRefused`);
  } catch (err) {
    if (!(err instanceof HubspotPhiRefused)) {
      failures.push(`[phi-freetext] ${label} threw wrong error: ${err.message}`);
    }
  }
}

shouldThrowPhi('style with "allergies"',   { style: 'prefers loose sleeves, has allergies to latex' });
shouldThrowPhi('wardrobe with "medication"', { wardrobe: 'no wristband on left, on medication' });
shouldThrowPhi('notes with "diagnosis"',   { notes: 'client discussed new diagnosis last visit' });
shouldThrowPhi('context with "symptom"',   { context: 'referred after ER visit for symptom flareup' });
shouldThrowPhi('notes with "prescription"', { notes: 'brings own prescription list' });
shouldThrowPhi('notes with "patient"',      { notes: 'this patient is anxious' });

// --- Test 3: Hospitality free-text WITHOUT PHI tokens passes through --------

const cleanHospitality = buildHubspotProperties({
  email: 'guest@example.com',
  guestProfile: {
    instagram: '@guest',
    tiktok: '@guest_tt',
    linkedin: 'https://linkedin.com/in/guest',
    style: 'prefers loose sleeves, cold rooms bother her',
    wardrobe: 'brings own robe',
    beverage: 'oat milk latte',
    music: 'Norah Jones or Zero 7',
    notes: 'birthday March 14, dog named Biscuit',
    context: 'referred by Sarah in accounts',
  },
});
assert(cleanHospitality.avalon_instagram_handle === '@guest', '[hospitality] instagram should pass');
assert(cleanHospitality.avalon_beverage_preference === 'oat milk latte', '[hospitality] beverage should pass');
assert(cleanHospitality.avalon_hospitality_notes?.includes('Biscuit'), '[hospitality] notes should pass');

// --- Report ---------------------------------------------------------------

if (failures.length) {
  console.error('\nHubSpot PHI guard FAILED:');
  for (const msg of failures) console.error(`  ✗ ${msg}`);
  process.exit(1);
}

console.log('HubSpot PHI guard passed.');
console.log(`  • Verified ${Object.keys(props).length} allowlisted properties present`);
console.log(`  • Verified 15+ PHI-shaped keys stripped`);
console.log(`  • Verified 6 PHI-token free-text values refused`);
console.log(`  • Verified clean hospitality payload passes through`);
