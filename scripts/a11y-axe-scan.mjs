#!/usr/bin/env node
// Lightweight WCAG smoke test using axe-core via Playwright.
// Advisory by default — exits 0 even with violations so this isn't a CI gate
// until the E1 sweep cleans the catalog. Pass --strict to make it a gate.
//
// Usage:
//   BASE_URL=https://snooches-preview.vercel.app npm run a11y:scan
//   BASE_URL=http://localhost:4173 npm run a11y:scan
//   BASE_URL=... npm run a11y:scan -- --strict
//
// Covers the public surfaces a first-time visitor + buying user touches.
// Member / admin / provider pages are deliberately excluded — those run
// behind auth and need a separate credentialed pass.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const STRICT = process.argv.includes('--strict');

const TARGETS = [
  { name: 'Home', path: '/' },
  { name: 'Protocols', path: '/protocols' },
  { name: 'Book', path: '/book' },
  { name: 'Plans', path: '/subscription' },
  { name: 'Plan checkout', path: '/plan' },
  { name: 'Checkout success (recovery)', path: '/checkout/success' },
  { name: 'Booking confirmation (recovery)', path: '/booking/confirmation' },
  { name: 'Login', path: '/login' },
  { name: 'Forgot password', path: '/forgot' },
  { name: 'Team', path: '/team' },
  { name: 'Locations', path: '/locations' },
  { name: 'Learn', path: '/learn' },
  { name: '404', path: '/this-route-does-not-exist' },
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

function severityRank(level) {
  return { minor: 1, moderate: 2, serious: 3, critical: 4 }[level] || 0;
}

async function scan(url, page) {
  const start = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Give the SPA a moment to mount post-DCL.
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return {
    url,
    duration: Date.now() - start,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      tags: v.tags.filter((t) => t.startsWith('wcag')),
    })),
  };
}

(async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let totalViolations = 0;
  let seriousOrWorse = 0;
  const report = [];

  for (const target of TARGETS) {
    const url = `${BASE_URL.replace(/\/$/, '')}${target.path}`;
    try {
      const result = await scan(url, page);
      report.push({ name: target.name, ...result });
      totalViolations += result.violations.length;
      seriousOrWorse += result.violations.filter((v) => severityRank(v.impact) >= 3).length;
      console.log(`\n--- ${target.name} (${target.path}) — ${result.violations.length} violation(s) in ${result.duration}ms`);
      for (const v of result.violations) {
        console.log(`  [${v.impact}] ${v.id} — ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'})`);
      }
    } catch (err) {
      console.error(`\n--- ${target.name} (${target.path}) — SCAN ERROR: ${err.message}`);
      report.push({ name: target.name, url, error: err.message });
    }
  }

  await browser.close();

  console.log('\n────────────────────────────────────────────────────────');
  console.log(`Total violations across ${TARGETS.length} surfaces: ${totalViolations}`);
  console.log(`Serious or critical: ${seriousOrWorse}`);
  console.log('────────────────────────────────────────────────────────');

  if (STRICT && seriousOrWorse > 0) {
    console.error('\nFAIL (--strict): serious or critical violations present.');
    process.exit(1);
  }
})().catch((err) => {
  console.error('a11y scan crashed:', err);
  process.exit(2);
});
