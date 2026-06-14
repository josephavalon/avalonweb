// Generate AVIF + WebP variants of the hero backdrop photo at each shipped width.
// The backdrop sits behind veil/gradient overlays, so it tolerates aggressive
// compression. Cuts the ~179 KiB JPEG on the critical path to ~30-45 KiB.
//
// Requires sharp (npm i sharp). Run: node scripts/optimize-backdrop.mjs

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(__dirname, '..', 'public', 'images');

const SOURCES = [
  'avalon-static-back-512',
  'avalon-static-back-1024',
  'avalon-static-back',
];

for (const base of SOURCES) {
  const src = path.join(imagesDir, `${base}.jpg`);
  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${base}.jpg`);
    continue;
  }
  const jpgKiB = (fs.statSync(src).size / 1024).toFixed(0);

  const avifOut = path.join(imagesDir, `${base}.avif`);
  await sharp(src).avif({ quality: 48, effort: 6 }).toFile(avifOut);

  const webpOut = path.join(imagesDir, `${base}.webp`);
  await sharp(src).webp({ quality: 70, effort: 6 }).toFile(webpOut);

  const avifKiB = (fs.statSync(avifOut).size / 1024).toFixed(0);
  const webpKiB = (fs.statSync(webpOut).size / 1024).toFixed(0);
  console.log(`${base}: ${jpgKiB} KiB jpg -> ${avifKiB} KiB avif / ${webpKiB} KiB webp`);
}
console.log('Done.');
