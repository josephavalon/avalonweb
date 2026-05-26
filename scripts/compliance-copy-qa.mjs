import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src/components', 'src/pages', 'src/data'];
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

const BLOCKED_PATTERNS = [
  { label: 'cure claim', pattern: /\b(cures?|cured|curing)\b/i },
  { label: 'disease treatment claim', pattern: /\b(treats?|treated|treating)\s+(disease|illness|anxiety|depression|pain|migraine|infection|covid)\b/i },
  { label: 'aging reversal claim', pattern: /\brevers(?:e|es|ing)\s+aging\b/i },
  { label: 'detox toxin claim', pattern: /\bdetox(?:es|ing)?\s+(toxins?|your\s+body|the\s+body)\b/i },
  { label: 'hangover prevention claim', pattern: /\bprevent(?:s|ed|ing)?\s+hangovers?\b/i },
  { label: 'guaranteed result claim', pattern: /\bguarantee(?:s|d)?\s+(results?|relief|recovery|outcomes?)\b/i },
  { label: 'illness fix claim', pattern: /\bfix(?:es|ed|ing)?\s+(illness|disease|anxiety|depression|pain|migraine)\b/i },
  { label: 'self-prescribing language', pattern: /\bself[-\s]?prescribed\s+iv\b/i },
  { label: 'medication shopping language', pattern: /\b(build\s+your\s+own\s+medication|choose\s+your\s+drugs)\b/i },
  { label: 'clearance bypass language', pattern: /\b(no\s+medical\s+clearance|no\s+clinical\s+review|without\s+clinical\s+review)\b/i },
];

const REQUIRED_COPY = [
  {
    file: 'src/pages/BookNow.jsx',
    label: 'booking clinical clearance',
    pattern: /(clinical\s+(clearance|review)|subject\s+to\s+clinical\s+approval)/i,
  },
  {
    file: 'src/components/landing/Hero.jsx',
    label: 'homepage clinical review',
    pattern: /clinical\s+review/i,
  },
  {
    file: 'src/pages/BookingConfirmation.jsx',
    label: 'confirmation dispatch clearance',
    pattern: /(clinical\s+clearance|clinical\s+review|dispatch\s+waits)/i,
  },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(abs));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(abs);
  }
  return files;
}

function lineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function excerpt(text, index) {
  return text
    .slice(Math.max(0, index - 70), Math.min(text.length, index + 120))
    .replace(/\s+/g, ' ')
    .trim();
}

function isProtectiveContext(text, index) {
  const context = excerpt(text, index);
  return [
    /not\s+intended\s+to\s+(diagnose,\s*)?treat,\s*cure,?\s+or\s+prevent/i,
    /not\s+intended\s+to\s+diagnose,\s*treat,\s*cure,?\s+or\s+prevent/i,
    /does\s+not\s+diagnose,\s*treat,\s*cure,?\s+or\s+prevent/i,
    /not\s+(be\s+)?framed\s+as\s+a\s+cure/i,
    /\b(not|no|avoid|without)\s+guaranteed?\s+(results?|outcomes?|claims?)/i,
    /\bguaranteed?\s+(results?|outcomes?)\s+(are\s+)?(not|never)\b/i,
    /\bnot\s+self[-\s]?prescribed\s+iv\b/i,
    /\bavoid\s+disease[-\s]?treatment\s+claims\b/i,
    /\bno\s+public\s+claims\b/i,
  ].some((pattern) => pattern.test(context));
}

const failures = [];
const warnings = [];

for (const dir of SCAN_DIRS) {
  const absDir = path.join(ROOT, dir);
  const files = await walk(absDir);
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const check of BLOCKED_PATTERNS) {
      const match = check.pattern.exec(text);
      if (match) {
        if (isProtectiveContext(text, match.index)) continue;
        failures.push({
          file: rel,
          line: lineForIndex(text, match.index),
          label: check.label,
          excerpt: excerpt(text, match.index),
        });
      }
    }

    if (/\b(hangover|fatigue|immune|NAD|CBD|medication|Toradol|Zofran)\b/i.test(text) &&
        !/\b(supports?|helps?|clinical|clinician|clearance|review|subject\s+to\s+approval)\b/i.test(text)) {
      warnings.push(`${rel}: medical-adjacent copy without nearby conservative language`);
    }
  }
}

for (const required of REQUIRED_COPY) {
  const abs = path.join(ROOT, required.file);
  const text = await fs.readFile(abs, 'utf8');
  if (!required.pattern.test(text)) {
    failures.push({
      file: required.file,
      line: 1,
      label: `missing ${required.label}`,
      excerpt: 'Required conservative clinical language was not found.',
    });
  }
}

if (failures.length) {
  console.error('Compliance copy QA failed:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.label}: ${failure.excerpt}`);
  }
  process.exit(1);
}

console.log(`Compliance copy QA passed. ${warnings.length} advisory item(s).`);
for (const warning of warnings.slice(0, 10)) console.log(`WARN ${warning}`);
