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
  { from: /<title>[^<]*<\/title>/, to: '<title>Bay to Breakers Recovery Presale | Avalon Vitality</title>' },
  { from: /<meta name="description" content="[^"]*"/, to: '<meta name="description" content="Pre-buy Avalon race-day recovery for Bay to Breakers 2026 with clinician-reviewed intake, licensed RN staffing, and finish-line support."' },
  { from: /<meta property="og:title" content="[^"]*"/, to: '<meta property="og:title" content="Bay to Breakers Recovery Presale | Avalon Vitality"' },
  { from: /<meta property="og:description" content="[^"]*"/, to: '<meta property="og:description" content="Pre-buy race-day recovery with Avalon. Clinician-reviewed intake, licensed RN staffing, and finish-line support."' },
  { from: /<meta property="og:url" content="[^"]*"/, to: '<meta property="og:url" content="https://www.avalonvitality.co/b2b"' },
  { from: /<meta property="og:image" content="[^"]*"/, to: '<meta property="og:image" content="https://www.avalonvitality.co/og-b2b.png"' },
  { from: /<meta property="og:image:alt" content="[^"]*"/, to: '<meta property="og:image:alt" content="Avalon Vitality x Bay to Breakers presale"' },
  { from: /<link rel="canonical" href="[^"]*"/, to: '<link rel="canonical" href="https://www.avalonvitality.co/b2b"' },
  { from: /<meta name="twitter:title" content="[^"]*"/, to: '<meta name="twitter:title" content="Bay to Breakers Recovery Presale | Avalon Vitality"' },
  { from: /<meta name="twitter:description" content="[^"]*"/, to: '<meta name="twitter:description" content="Pre-buy race-day recovery with Avalon. Clinician-reviewed intake and licensed RN staffing."' },
  { from: /<meta name="twitter:image" content="[^"]*"/, to: '<meta name="twitter:image" content="https://www.avalonvitality.co/og-b2b.png"' },
  { from: /<meta name="twitter:image:alt" content="[^"]*"/, to: '<meta name="twitter:image:alt" content="Avalon Vitality x Bay to Breakers presale"' },
];

let applied = 0;
for (const { from, to } of replacements) {
  const before = html;
  html = html.replace(from, to);
  if (html !== before) applied++;
}

const b2bPrerender = `
      <div id="seo-prerender" style="min-height:100vh;background:#0a0a0a;color:#f4f4f1;font-family:Inter,Arial,sans-serif;padding:48px 24px;">
        <main style="max-width:960px;margin:0 auto;">
          <p style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(244,244,241,.52);margin:0 0 18px;">Avalon Vitality</p>
          <h1 style="font-family:Arial,sans-serif;font-size:clamp(42px,10vw,96px);line-height:.9;text-transform:uppercase;margin:0 0 24px;">Bay to Breakers Recovery Presale</h1>
          <p style="max-width:700px;font-size:18px;line-height:1.65;color:rgba(244,244,241,.68);margin:0 0 34px;">Pre-buy race-day recovery for Bay to Breakers 2026. Avalon coordinates guest intake, clinical review, licensed RN staffing, and finish-line recovery support for eligible participants.</p>
          <section aria-label="Clinical review" style="border:1px solid rgba(244,244,241,.12);border-radius:20px;padding:22px;background:rgba(244,244,241,.035);margin:0 0 28px;">
            <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,244,241,.45);margin:0 0 10px;">Clinical standard</p>
            <p style="font-size:14px;line-height:1.6;color:rgba(244,244,241,.66);margin:0;">All IV-related service requires intake, consent, and clinical approval. Final service depends on eligibility, staffing, supplies, and operational conditions.</p>
          </section>
          <ul style="display:grid;gap:12px;margin:0;padding:0;list-style:none;">
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Presale guest registration</li>
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Licensed RN appointment execution</li>
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Clinician-reviewed intake before service</li>
            <li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">Finish-line recovery support</li>
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
      name: 'Bay to Breakers Recovery Presale',
      description: 'Pre-buy Avalon race-day recovery for Bay to Breakers 2026 with clinician-reviewed intake, licensed RN staffing, and finish-line support.',
      isPartOf: { '@id': 'https://www.avalonvitality.co/#website' },
    },
    {
      '@type': 'Event',
      '@id': 'https://www.avalonvitality.co/b2b#event',
      name: 'Bay to Breakers Recovery Presale',
      startDate: '2026-05-17',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: 'Bay to Breakers finish area',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
          addressCountry: 'US',
        },
      },
      organizer: { '@id': 'https://www.avalonvitality.co/#localbusiness' },
      description: 'Race-day recovery support for eligible participants with intake, clinical review, and licensed RN staffing.',
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
