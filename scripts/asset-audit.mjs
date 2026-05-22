import { statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp4']);
const warnBytes = 350 * 1024;

async function walk(dir, results = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name === 'optimized') continue;
    if (entry.isDirectory()) {
      await walk(full, results);
    } else if (imageExts.has(extname(entry.name).toLowerCase())) {
      const size = statSync(full).size;
      results.push({ file: relative(root, full), size });
    }
  }
  return results;
}

const assets = (await walk(join(root, 'public'))).sort((a, b) => b.size - a.size);
const heavy = assets.filter((asset) => asset.size > warnBytes);

console.log(`Scanned ${assets.length} public media assets.`);
console.log(`${heavy.length} assets are over ${Math.round(warnBytes / 1024)} KB.`);

for (const asset of heavy) {
  console.log(`${(asset.size / 1024 / 1024).toFixed(2)} MB  ${asset.file}`);
}

if (heavy.length) {
  process.exitCode = 1;
}
