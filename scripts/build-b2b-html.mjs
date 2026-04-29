// Post-build: dist/b2b.html with /b2b-specific OG meta. Crawlers don't run JS,
// so per-route OG cards on a Vite SPA require a pre-rendered HTML per route.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('[build-b2b-html] dist/index.html missing');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

const replacements = [
  { from: /<title>[^<]*<\/title>/, to: '<title>B2B Presale — Avalon Vitality</title>' },
  { from: /<meta name="description" content="[^"]*"/, to: '<meta name="description" content="Race-day IV, shots, and recovery for Bay to Breakers 2026. Pre-buy and we will be at the finish line when you cross."' },
  { from: /<meta property="og:title" content="[^"]*"/, to: '<meta property="og:title" content="Avalon Vitality × Bay to Breakers"' },
  { from: /<meta property="og:description" content="[^"]*"/, to: '<meta property="og:description" content="Finish-line IV, shots, & recovery. Sunday, May 17, 2026. Pre-buy now."' },
  { from: /<meta property="og:url" content="[^"]*"/, to: '<meta property="og:url" content="https://avalonvitality.co/b2b"' },
  { from: /<meta property="og:image" content="[^"]*"/, to: '<meta property="og:image" content="https://avalonvitality.co/og-b2b.png"' },
  { from: /<meta property="og:image:alt" content="[^"]*"/, to: '<meta property="og:image:alt" content="Avalon Vitality x Bay to Breakers presale"' },
  { from: /<link rel="canonical" href="[^"]*"/, to: '<link rel="canonical" href="https://avalonvitality.co/b2b"' },
  { from: /<meta name="twitter:title" content="[^"]*"/, to: '<meta name="twitter:title" content="Avalon Vitality × Bay to Breakers"' },
  { from: /<meta name="twitter:description" content="[^"]*"/, to: '<meta name="twitter:description" content="Finish-line IV, shots, & recovery. Sunday, May 17, 2026."' },
  { from: /<meta name="twitter:image" content="[^"]*"/, to: '<meta name="twitter:image" content="https://avalonvitality.co/og-b2b.png"' },
];

let applied = 0;
for (const { from, to } of replacements) {
  const before = html;
  html = html.replace(from, to);
  if (html !== before) applied++;
}

fs.writeFileSync(path.join(dist, 'b2b.html'), html, 'utf8');
console.log(`[build-b2b-html] wrote dist/b2b.html (${applied}/${replacements.length} meta tags applied)`);
