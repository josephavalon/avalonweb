// Reproducible web-font optimization: subset the shipped TTF faces to Latin
// (+ Latin-Ext + punctuation/symbols) and re-encode as WOFF2.
//
// Why: the repo originally shipped full, unsubset TTF files (~325 KiB per Inter
// weight, 5 weights, plus an unused 251 KiB Caveat). Those dominated FCP/LCP — the
// hero <h1> waited ~1.7 s on the heading font. WOFF2 + subsetting cuts each face by
// ~85-95%. We keep only the faces actually wired through --font-heading (Bebas) and
// --font-body (Inter 400/500/600/700); Caveat and Inter-300 are dropped.
//
// Requires: python3 with `fonttools` + `brotli` (pip install --user fonttools brotli).
// Run: node scripts/optimize-fonts.mjs

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(__dirname, '..', 'public', 'fonts');

// Google-Fonts "latin" + "latin-ext" unicode ranges merged — covers English copy,
// accented names, smart quotes, dashes, the €/™ symbols and ↑/↓ arrows.
const UNICODES = [
  'U+0000-00FF', 'U+0100-017F', 'U+0180-024F', 'U+0259',
  'U+02BB-02BC', 'U+02C6', 'U+02DA', 'U+02DC',
  'U+0300-0301', 'U+0303-0304', 'U+0308-0309', 'U+0323', 'U+0329',
  'U+1E00-1EFF', 'U+2000-206F', 'U+2074', 'U+20AC',
  'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215', 'U+FEFF', 'U+FFFD',
].join(',');

// Faces to keep (source TTF -> output WOFF2). Everything else in public/fonts is dropped.
const FACES = [
  'bebas-neue-400',
  'inter-400',
  'inter-500',
  'inter-600',
  'inter-700',
];

// Faces to remove from the repo (unused / superseded by WOFF2).
const DROP_TTF = [
  'caveat-700', 'inter-300', 'inter-400', 'inter-500', 'inter-600', 'inter-700', 'bebas-neue-400',
];

function subset(face) {
  const src = path.join(fontsDir, `${face}.ttf`);
  const out = path.join(fontsDir, `${face}.woff2`);
  if (!fs.existsSync(src)) throw new Error(`missing source font: ${src}`);
  execFileSync('python3', [
    '-m', 'fontTools.subset', src,
    `--unicodes=${UNICODES}`,
    '--layout-features=kern,liga,clig,calt,ccmp,locl,mark,mkmk',
    '--flavor=woff2',
    '--no-hinting',
    '--desubroutinize',
    `--output-file=${out}`,
  ], { stdio: 'inherit' });
  const before = fs.statSync(src).size;
  const after = fs.statSync(out).size;
  console.log(`  ${face}: ${(before / 1024).toFixed(0)} KiB TTF -> ${(after / 1024).toFixed(0)} KiB WOFF2`);
  return after;
}

console.log('Subsetting + converting fonts to WOFF2...');
let total = 0;
for (const face of FACES) total += subset(face);
console.log(`Total WOFF2 payload: ${(total / 1024).toFixed(0)} KiB across ${FACES.length} faces.`);

// Remove the now-superseded TTF sources so they cannot be shipped/referenced.
for (const face of DROP_TTF) {
  const ttf = path.join(fontsDir, `${face}.ttf`);
  if (fs.existsSync(ttf)) {
    fs.rmSync(ttf);
    console.log(`  removed ${face}.ttf`);
  }
}
console.log('Done.');
