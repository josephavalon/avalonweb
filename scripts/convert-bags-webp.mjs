// Convert product bag PNGs to webp (high quality, alpha preserved) to cut wire weight.
// Bags are ~360px wide product cutouts on dark backgrounds, so we keep quality high
// (q82 + near-lossless alpha) to avoid edge halos. Run: node scripts/convert-bags-webp.mjs
import { readdir, stat, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';

const dir = join(process.cwd(), 'public', 'bags');
const files = (await readdir(dir)).filter((f) => extname(f).toLowerCase() === '.png');

let beforeTotal = 0;
let afterTotal = 0;

for (const file of files) {
  const src = join(dir, file);
  const out = src.replace(/\.png$/i, '.webp');
  const before = (await stat(src)).size;
  await sharp(src)
    .webp({ quality: 82, alphaQuality: 100, effort: 6 })
    .toFile(out);
  const after = (await stat(out)).size;
  beforeTotal += before;
  afterTotal += after;
  console.log(
    `${file.padEnd(22)} ${(before / 1024).toFixed(0).padStart(4)}K -> ${(after / 1024).toFixed(0).padStart(4)}K webp`,
  );
  // remove the now-unreferenced source PNG so it does not ship in the deploy
  await rm(src, { force: true });
}

console.log(
  `\nTotal: ${(beforeTotal / 1024 / 1024).toFixed(2)} MB png -> ${(afterTotal / 1024 / 1024).toFixed(2)} MB webp ` +
    `(${(100 - (afterTotal / beforeTotal) * 100).toFixed(0)}% smaller)`,
);
