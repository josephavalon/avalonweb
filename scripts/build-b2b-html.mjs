// Post-build: dist/b2b.html with /b2b-specific OG meta. Crawlers don't run JS,
// so per-route OG cards on a Vite SPA require a pre-rendered HTML per route.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(dist, 'index.html');

function ensureCanonicalRootHtml(baseName) {
  const canonical = path.join(dist, `${baseName}.html`);
  if (fs.existsSync(canonical)) return;
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fallback = fs.readdirSync(dist)
    .find((name) => new RegExp(`^${escaped} \\d+\\.html$`).test(name));
  if (fallback) fs.copyFileSync(path.join(dist, fallback), canonical);
}

ensureCanonicalRootHtml('index');

if (!fs.existsSync(indexPath)) {
  console.error('[build-b2b-html] dist/index.html missing');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

const replacements = [
  { from: /<title>[^<]*<\/title>/, to: '<title>Group Recovery | Avalon Vitality</title>' },
  { from: /<meta name="description" content="[^"]*"/, to: '<meta name="description" content="Private mobile IV, shots, and recovery support for teams, events, hotels, and offices across the San Francisco Bay Area."' },
  { from: /<meta property="og:title" content="[^"]*"/, to: '<meta property="og:title" content="Group Recovery | Avalon Vitality"' },
  { from: /<meta property="og:description" content="[^"]*"/, to: '<meta property="og:description" content="Plan group recovery with Avalon. Contact us to confirm services, pricing, timing, and availability."' },
  { from: /<meta property="og:url" content="[^"]*"/, to: '<meta property="og:url" content="https://www.avalonvitality.co/b2b"' },
  { from: /<meta property="og:image" content="[^"]*"/, to: '<meta property="og:image" content="https://www.avalonvitality.co/og-homepage.jpg"' },
  { from: /<meta property="og:image:alt" content="[^"]*"/, to: '<meta property="og:image:alt" content="Avalon Vitality Group Recovery"' },
  { from: /"image": "https:\/\/www\.avalonvitality\.co\/[^"]+"/, to: '"image": "https://www.avalonvitality.co/og-homepage.jpg"' },
  { from: /<link rel="canonical" href="[^"]*"/, to: '<link rel="canonical" href="https://www.avalonvitality.co/b2b"' },
  { from: /<meta name="twitter:title" content="[^"]*"/, to: '<meta name="twitter:title" content="Group Recovery | Avalon Vitality"' },
  { from: /<meta name="twitter:description" content="[^"]*"/, to: '<meta name="twitter:description" content="Plan group recovery with Avalon for teams, events, hotels, and offices."' },
  { from: /<meta name="twitter:image" content="[^"]*"/, to: '<meta name="twitter:image" content="https://www.avalonvitality.co/og-homepage.jpg"' },
  { from: /<meta name="twitter:image:alt" content="[^"]*"/, to: '<meta name="twitter:image:alt" content="Avalon Vitality Group Recovery"' },
];

let applied = 0;
for (const { from, to } of replacements) {
  const before = html;
  html = html.replace(from, to);
  if (html !== before) applied++;
}

const b2bPrerender = `
      <div id="seo-prerender" style="min-height:100vh;background-color:#2a2521;background-image:linear-gradient(90deg,rgba(42,37,33,.84),rgba(42,37,33,.52) 45%,rgba(42,37,33,.22)),url('/images/avalon-static-back-512.webp');background-size:cover;background-position:86% 52%;color:#f4f4f1;font-family:Inter,Arial,sans-serif;padding:48px 24px;">
        <main style="max-width:960px;margin:0 auto;">
          <p style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(244,244,241,.52);margin:0 0 18px;">Avalon Vitality</p>
          <h1 style="font-family:Arial,sans-serif;font-size:clamp(42px,10vw,96px);line-height:.9;text-transform:uppercase;margin:0 0 24px;">Group Recovery</h1>
          <p style="max-width:700px;font-size:18px;line-height:1.65;color:rgba(244,244,241,.68);margin:0 0 34px;">Private mobile IV, shots, and recovery support for teams, events, hotels, and offices across the San Francisco Bay Area. Contact Avalon to confirm services, pricing, timing, and availability.</p>
          <section aria-label="Clinical review" style="border:1px solid rgba(244,244,241,.12);border-radius:20px;padding:22px;background:rgba(244,244,241,.035);margin:0 0 28px;">
            <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,244,241,.45);margin:0 0 10px;">Clinical standard</p>
            <p style="font-size:14px;line-height:1.6;color:rgba(244,244,241,.66);margin:0;">All IV-related service requires intake, consent, and clinical approval. Final service depends on eligibility, staffing, supplies, and operational conditions.</p>
          </section>
          <ul style="display:grid;gap:12px;margin:0;padding:0;list-style:none;">
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Group planning and coordination</li>
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Licensed Registered Nurse appointment execution</li>
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Clinician-reviewed intake before service</li>
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Mobile group recovery support</li>
          </ul>
        </main>
      </div>`;

html = html.replace(/<div id="root"><\/div>/, `<div id="root">${b2bPrerender}\n    </div>`);

const b2bJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MedicalBusiness',
      '@id': 'https://www.avalonvitality.co/#localbusiness',
      name: 'Avalon Vitality',
      url: 'https://www.avalonvitality.co/',
      telephone: '+14159807708',
      email: 'support@avalonvitality.co',
      areaServed: { '@type': 'AdministrativeArea', name: 'San Francisco Bay Area' },
    },
    {
      '@type': 'WebPage',
      '@id': 'https://www.avalonvitality.co/b2b#webpage',
      url: 'https://www.avalonvitality.co/b2b',
      name: 'Group Recovery',
      description: 'Private mobile IV, shots, and recovery support for teams, events, hotels, and offices across the San Francisco Bay Area.',
      isPartOf: { '@id': 'https://www.avalonvitality.co/#website' },
    },
    {
      '@type': 'Service',
      '@id': 'https://www.avalonvitality.co/b2b#service',
      name: 'Avalon Vitality Group Recovery',
      serviceType: 'Mobile IV therapy and group wellness recovery',
      areaServed: 'San Francisco Bay Area',
      provider: { '@id': 'https://www.avalonvitality.co/#localbusiness' },
      description: 'Private mobile IV, shots, and recovery support for teams, events, hotels, and offices.',
    },
  ],
};

html = html.replace(
  /<script[^>]+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/,
  `<script id="static-jsonld" type="application/ld+json">${JSON.stringify(b2bJsonLd)}</script>`,
);

fs.writeFileSync(path.join(dist, 'b2b.html'), html, 'utf8');
ensureCanonicalRootHtml('b2b');
console.log(`[build-b2b-html] wrote dist/b2b.html (${applied}/${replacements.length} meta tags applied)`);
