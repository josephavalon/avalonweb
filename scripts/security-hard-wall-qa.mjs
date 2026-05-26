import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  {
    file: 'api/create-checkout-session.js',
    must: ['sanitizeCheckoutItems', 'sanitizeCheckoutMembership', 'pre_api_hard_wall'],
  },
  {
    file: 'api/integrations/stripe/webhook.js',
    must: ['requireLiveWebhook', 'STRIPE_WEBHOOK_SECRET'],
    mustNot: ['typeof req.body === \'object\' ? req.body'],
  },
  {
    file: 'api/integrations/acuity/webhook.js',
    must: ['requireLiveWebhook', 'ACUITY_WEBHOOK_SECRET'],
  },
  {
    file: 'src/lib/useAuthStore.js',
    must: ['isDemoAuthAllowed', 'pre-api-hard-wall'],
  },
  {
    file: 'src/pages/Login.jsx',
    must: ['PRE_API_SECURITY_MODE', 'Local simulation only'],
  },
  {
    file: 'src/pages/provider/NurseShift.jsx',
    must: ['writeLocal(NOTES_KEY', 'hasNotes'],
    mustNot: ['localStorage.setItem(NOTES_KEY'],
  },
  {
    file: 'src/lib/financeIntegrations.js',
    mustNot: ['VITE_MERCURY_API_KEY', 'VITE_QUALIPHY_API_KEY', 'VITE_NURSEYS_API_KEY', 'VITE_MERCURY_WEBHOOK_SECRET', 'VITE_QUALIPHY_WEBHOOK_SECRET'],
  },
];

const failures = [];

for (const check of checks) {
  const text = await fs.readFile(path.join(ROOT, check.file), 'utf8');
  for (const needle of check.must || []) {
    if (!text.includes(needle)) failures.push(`${check.file}: missing "${needle}"`);
  }
  for (const needle of check.mustNot || []) {
    if (text.includes(needle)) failures.push(`${check.file}: forbidden "${needle}"`);
  }
}

const sourceFiles = await collect(path.join(ROOT, 'src'));
for (const file of sourceFiles) {
  const rel = path.relative(ROOT, file);
  const text = await fs.readFile(file, 'utf8');
  if (/localStorage\.setItem\([^)]*(medicalConditions|allergies|medications|dob|bp|hr|visitNote|clinicalNotes)/i.test(text)) {
    failures.push(`${rel}: direct PHI-like localStorage write`);
  }
}

if (failures.length) {
  console.error('Security hard wall QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security hard wall QA passed: pre-API live-vendor and PHI storage guards are armed.');

async function collect(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(abs));
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(abs);
  }
  return files;
}
