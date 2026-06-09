// Regression guard for: "store top-nav links stop working after scroll".
//
// Root cause: the fixed Navbar renders inside PageTransition's `.av-page-stage`
// wrapper. If that wrapper becomes a CONTAINING BLOCK for position:fixed
// descendants, the navbar is no longer pinned to the viewport — it scrolls away
// with the page and its links become unclickable after any scroll.
//
// Two properties create that containing block, and BOTH must stay clear:
//   1. src/index.css  `.av-page-stage { will-change: ... }`  must not list
//      transform / filter / perspective.
//   2. PageTransition.jsx `stageMotion` must not animate `filter` (even
//      `blur(0px)` is a non-`none` filter and traps fixed descendants).
//
// Without the fix this test fails; with it, it passes.

import fs from 'node:fs';

let failed = false;
const fail = (msg) => { failed = true; console.error('FAIL:', msg); };

// 1. CSS will-change must not trap fixed descendants.
const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const stageRule = css.match(/\.av-page-stage\s*\{[^}]*\}/);
if (!stageRule) {
  fail('.av-page-stage rule not found in src/index.css');
} else {
  const willChange = (stageRule[0].match(/will-change:\s*([^;]*)/) || [])[1] || '';
  if (/\b(transform|filter|perspective)\b/.test(willChange)) {
    fail(`.av-page-stage will-change must not include transform/filter/perspective ` +
         `(they make it a containing block and un-pin the fixed navbar). Found: "${willChange.trim()}"`);
  }
}

// 2. Page-transition variants must not set `filter`.
const pt = fs.readFileSync(new URL('../src/components/ui/PageTransition.jsx', import.meta.url), 'utf8');
const stageMotion = (pt.match(/const stageMotion\s*=\s*\{[\s\S]*?\n\};/) || [])[0] || '';
if (!stageMotion) {
  fail('stageMotion object not found in src/components/ui/PageTransition.jsx');
} else if (/filter\s*:/.test(stageMotion)) {
  fail('PageTransition stageMotion must not set `filter` (even blur(0px) traps the fixed navbar).');
}

if (failed) {
  console.error('\nfixed-nav regression guard FAILED — the store top-nav links will die after scroll.');
  process.exit(1);
}
console.log('PASS: fixed-nav containing-block guard (.av-page-stage + PageTransition stay clean).');
