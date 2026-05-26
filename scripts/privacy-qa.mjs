import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'scripts'];
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

const failures = [];
const storageKeys = new Set();

for (const dir of SCAN_DIRS) {
  const files = await walk(path.join(ROOT, dir));
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const rel = path.relative(ROOT, file);

    for (const match of text.matchAll(/\b(?:localStorage|sessionStorage)\.setItem\(\s*['"`]([^'"`]+)['"`]/g)) {
      storageKeys.add(match[1]);
    }

    for (const check of BLOCKED_SOURCE_PATTERNS) {
      const match = check.pattern.exec(text);
      if (match) {
        failures.push(`${rel}:${lineForIndex(text, match.index)} ${check.label}`);
      }
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
