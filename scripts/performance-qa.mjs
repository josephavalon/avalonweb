import fs from 'node:fs';
import path from 'node:path';
import {
  allMatches,
  exists,
  lineOf,
  listFiles,
  printAudit,
  read,
  rel,
  scoreFrom,
  tagMatches,
} from './audit-utils.mjs';

const MAX = 1500;
const findings = [];
const deductions = [];
const add = (points, file, message, line) => {
  deductions.push({ points });
  findings.push({ file, line: line || lineOf(file, /./), message });
};

const app = read('src/App.jsx');
const main = read('src/main.jsx');
const vite = read('vite.config.js');
const index = read('index.html');
const tailwind = exists('tailwind.config.js') ? read('tailwind.config.js') : '';
const pkg = JSON.parse(read('package.json'));

if (!/lazyRoute|React\.lazy|lazy\(/.test(app)) add(180, 'src/App.jsx', 'Routes are not lazily loaded.');
if (!/Suspense/.test(app)) add(80, 'src/App.jsx', 'Lazy route fallback is missing Suspense.');
if (!/manualChunks|splitVendorChunkPlugin|lazyRoute/.test(vite + app)) add(140, 'vite.config.js', 'No explicit code-splitting strategy found.');
if (!/content:\s*\[/.test(tailwind)) add(100, 'tailwind.config.js', 'Tailwind content purge paths are missing.');
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(index) && !/rel="preconnect"[^>]+fonts\.gstatic|fonts\.gstatic[^>]+rel="preconnect"/.test(index)) add(50, 'index.html', 'Google Fonts preconnect is missing.');
if (/fonts\.googleapis\.com\/css2/.test(index)) add(70, 'index.html', 'Fonts still depend on Google stylesheet; self-hosting would reduce third-party render dependency.', lineOf('index.html', 'fonts.googleapis.com/css2'));
if (!/rel="manifest"/.test(index) || !exists('public/manifest.json')) add(80, 'index.html', 'PWA manifest is not fully wired.');
if (!/serviceWorker|navigator\.serviceWorker|sw\.js/.test(app + main + index + JSON.stringify(pkg))) add(70, 'src/main.jsx', 'No service worker registration found; offline shell/cache is not available.');
if (/<script>(?!\s*\{)/.test(index)) add(70, 'index.html', 'Inline head scripts run before the app bundle and can block first paint.', lineOf('index.html', '<script>'));
if (!/type="module"[^>]+src="\/src\/main\.jsx"/.test(index)) add(40, 'index.html', 'Main module script tag was not found in expected Vite form.');

const publicImages = listFiles('public', (file) => /\.(png|jpe?g)$/i.test(file));
const heavyRaster = publicImages
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .filter((item) => item.size > 350 * 1024)
  .sort((a, b) => b.size - a.size)
  .slice(0, 8);
for (const item of heavyRaster.slice(0, 5)) {
  add(25, rel(item.file), `Large raster asset is ${Math.round(item.size / 1024)}KB; prefer WebP/AVIF or responsive sizes.`, 1);
}

const jsxFiles = listFiles('src', (file) => /\.(jsx|js)$/.test(file));
const eagerMotion = jsxFiles
  .filter((file) => /from ['"]framer-motion['"]/.test(read(rel(file))) && !rel(file).includes('components/ui/PageTransition'))
  .slice(0, 8);
for (const file of eagerMotion.slice(0, 4)) {
  add(25, rel(file), 'Framer Motion is imported directly; verify this route/component is lazy or move animation primitives behind shared wrappers.', lineOf(rel(file), 'framer-motion'));
}

const imageTags = jsxFiles.flatMap((file) => tagMatches(rel(file), 'img'));
const missingLazy = imageTags
  .filter((match) => !/loading=|fetchpriority=|fetchPriority=/.test(match.text))
  .slice(0, 10);
for (const match of missingLazy.slice(0, 5)) {
  add(20, match.file, 'Image tag lacks loading/fetch priority hint; non-hero images should be lazy.', match.line);
}

if (exists('dist/assets')) {
  const chunks = fs.readdirSync(path.resolve('dist/assets'))
    .filter((name) => /\.js$/.test(name))
    .map((name) => {
      const file = path.resolve('dist/assets', name);
      return { name, size: fs.statSync(file).size };
    })
    .filter((item) => item.size > 300 * 1024)
    .sort((a, b) => b.size - a.size);
  for (const chunk of chunks.slice(0, 4)) {
    add(35, `dist/assets/${chunk.name}`, `Large JS chunk is ${Math.round(chunk.size / 1024)}KB raw; consider deeper route/module splitting.`, 1);
  }
}

const score = scoreFrom(MAX, deductions);
printAudit('PERFORMANCE', score, MAX, findings, {
  min: Number(process.env.PERFORMANCE_QA_MIN || 0),
});
