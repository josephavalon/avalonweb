import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Reuse the RUNTIME block-list rather than maintaining a second one here. This
// scanner and the outbound send-email/send-sms guards must never drift apart.
import { PHI_BODY_PATTERNS, bodyContainsPhi } from '../api/_lib/phi-guard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'scripts', 'app-modules', 'api'];
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);

const BLOCKED_SOURCE_PATTERNS = [
  { label: 'sample SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'sample card number', pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2})[- ]?\d{4}[- ]?\d{4}[- ]?\d{3,4}\b/ },
  { label: 'local PHI key', pattern: /localStorage\.setItem\(\s*['"`][^'"`]*(ssn|diagnosis|medications|medicalHistory|allergies|dob)[^'"`]*['"`]/i },
  { label: 'session PHI key', pattern: /sessionStorage\.setItem\(\s*['"`][^'"`]*(ssn|diagnosis|medications|medicalHistory|allergies|dob)[^'"`]*['"`]/i },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(abs));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(abs);
  }
  return files;
}

function lineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

// Return the raw source of a call's argument list, given the index of its "(".
// Paren-balanced and quote-aware so JSON.stringify({ ... }) does not truncate.
function argSource(text, openParenIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openParenIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openParenIndex + 1, i);
    }
  }
  return text.slice(openParenIndex + 1, openParenIndex + 2000);
}

// Everything after the first top-level comma — i.e. the VALUE being stored,
// with the key argument removed (keys are covered by the patterns above).
function valueArgSource(args) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) return args.slice(i + 1);
  }
  return '';
}

const failures = [];
const storageKeys = new Set();
const phiMap = await fs.readFile(path.join(ROOT, 'docs/PHI_DATA_FLOW.md'), 'utf8').catch(() => '');

if (!phiMap) {
  failures.push('docs/PHI_DATA_FLOW.md: missing PHI inventory and data-flow map');
} else {
  for (const required of [
    'Supabase `public.appointments.external_payload`',
    'Stripe Checkout',
    'Acuity',
    'Resend ops email',
    'Resend customer email',
    'HubSpot',
    'Sentry-compatible endpoint',
    'Appointment Summary Access',
    'Exhaust Controls',
    'Client',
    'Nurse / provider',
    'Admin / operator / clinical authority',
    'BAAs before real PHI flows',
  ]) {
    if (!phiMap.includes(required)) {
      failures.push(`docs/PHI_DATA_FLOW.md: missing required data-flow term "${required}"`);
    }
  }
}

for (const dir of SCAN_DIRS) {
  const files = await walk(path.join(ROOT, dir));
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const rel = path.relative(ROOT, file);

    for (const match of text.matchAll(/\b(?:localStorage|sessionStorage)\.setItem\(\s*['"`]([^'"`]+)['"`]/g)) {
      storageKeys.add(match[1]);
    }

    // Every violation, not just the first per pattern per file.
    for (const check of BLOCKED_SOURCE_PATTERNS) {
      const global = new RegExp(check.pattern.source, `${check.pattern.flags.replace(/g/g, '')}g`);
      for (const match of text.matchAll(global)) {
        failures.push(`${rel}:${lineForIndex(text, match.index)} ${check.label}`);
      }
    }

    // Key names are not enough: setItem('draft', JSON.stringify({ note }))
    // hides PHI in the VALUE. Scan the stored value with the runtime block-list.
    for (const match of text.matchAll(/\b(?:localStorage|sessionStorage)\.setItem\s*\(/g)) {
      const openParen = match.index + match[0].length - 1;
      const value = valueArgSource(argSource(text, openParen));
      if (!value.trim() || !bodyContainsPhi(value)) continue;
      const hits = PHI_BODY_PATTERNS.filter((re) => re.test(value)).map((re) => re.source).join(', ');
      failures.push(`${rel}:${lineForIndex(text, match.index)} PHI-shaped value in browser storage (${hits})`);
    }
  }
}

if (failures.length) {
  console.error('Privacy QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Privacy QA passed. Browser storage keys tracked: ${storageKeys.size}.`);
for (const key of [...storageKeys].sort()) console.log(`KEY ${key}`);
