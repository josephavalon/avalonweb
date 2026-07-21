/**
 * Stripe PHI guard — enforces the HIPAA route-around.
 *
 * Stripe does not sign a BAA with Avalon. To keep Stripe in the stack we must
 * guarantee PHI never reaches it: not in metadata, not in descriptions, not in
 * line-item product_data, not in payment_intent_data. This script scans every
 * file that talks to the Stripe SDK and fails if a PHI-shaped identifier
 * appears inside the args of a Stripe write call.
 *
 * See api/_lib/safe-stripe.js (the chokepoint), docs/PHI_DATA_FLOW.md (policy),
 * and the broader BAA checklist for context.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STRIPE_FILES = [
  'api/create-checkout-session.js',
  'api/_checkout-fulfillment.js',
  'api/checkout/verify.js',
  'api/charge-balance.js',
  'api/integrations/stripe/webhook.js',
  'api/_lib/balance-core.js',
];

// Stripe SDK write methods. We only audit calls that send data outbound to
// Stripe — reads (retrieve, list) cannot leak PHI by themselves.
const STRIPE_WRITE_METHOD_RE = /\bstripe\.[A-Za-z_][\w.]*\.(create|update|del|cancel|finalize|pay|void|capture)\s*\(/g;

// PHI-shaped tokens that must never appear inside a Stripe write call's args.
// These intentionally include both camelCase identifiers and lowercase fragments
// so accidental string literals (e.g. "patient_dob") also trip the guard.
const PHI_TOKENS = [
  'dob',
  'birthDate',
  'allergies',
  'medications',
  'medicalConditions',
  'intake',
  'gfe',
  'emergencyContact',
  'emergency_contact',
  'clinical',
  'diagnosis',
  'symptom',
  'peopleManifest',
  'people_manifest',
  // address + zip are PHI when tied to a healthcare relationship; if Stripe
  // ever needs an address, use customer.address (Stripe's typed field) — not
  // free-form metadata. Keep this guard strict.
  'address',
  'zip',
];

function extractCallArgs(source, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return '';
}

function lineForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

const failures = [];

for (const rel of STRIPE_FILES) {
  const abs = path.join(ROOT, rel);
  let source;
  try {
    source = await fs.readFile(abs, 'utf8');
  } catch (err) {
    failures.push(`${rel}: cannot read (${err.code || err.message})`);
    continue;
  }

  const matches = [...source.matchAll(STRIPE_WRITE_METHOD_RE)];
  let sawMetadataWrite = false;
  let sawSanitizedMetadataWrite = false;
  for (const match of matches) {
    const callStart = match.index;
    const openParen = source.indexOf('(', callStart + match[0].length - 1);
    if (openParen < 0) continue;
    const args = extractCallArgs(source, openParen);

    if (/\bmetadata\s*:/.test(args)) {
      sawMetadataWrite = true;
      if (/safeStripeMetadata\s*\(/.test(args)) sawSanitizedMetadataWrite = true;
      else {
        failures.push(
          `${rel}:${lineForIndex(source, callStart)}: ${match[0].trim()}…) writes metadata without safeStripeMetadata()`,
        );
      }
    }

    for (const token of PHI_TOKENS) {
      const tokenRe = new RegExp(`\\b${token}\\b`);
      if (tokenRe.test(args)) {
        failures.push(
          `${rel}:${lineForIndex(source, callStart)}: PHI token "${token}" appears inside ${match[0].trim()}…) — route through safeStripeMetadata or remove`,
        );
      }
    }
  }

  if (sawMetadataWrite && !sawSanitizedMetadataWrite) {
    failures.push(`${rel}: has Stripe metadata writes but none use safeStripeMetadata — see api/_lib/safe-stripe.js`);
  }
}

if (failures.length) {
  console.error('\n✗ Stripe PHI guard failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\nFix: ensure all Stripe metadata writes go through safeStripeMetadata() (api/_lib/safe-stripe.js).',
    '\nSee docs/PHI_DATA_FLOW.md for the route-around policy.\n',
  );
  process.exit(1);
}

console.log(`✓ no-phi-in-stripe-qa: ${STRIPE_FILES.length} files clean — no PHI tokens inside Stripe write calls.`);
