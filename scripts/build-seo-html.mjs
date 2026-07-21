// Post-build SEO pre-render for public routes.
// Vite serves an app shell by default; these route HTML files give crawlers
// unique titles, canonicals, robots directives, JSON-LD, and crawlable body copy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLINICAL_STANDARD,
  LOCAL_BUSINESS_PROFILE,
  MEDICAL_REVIEW,
  SEO_BASE_URL,
  educationArticles,
  indexedEducationArticles,
  indexedServicePillars,
  locationPages,
  noindexStaticRoutes,
  publicStaticRoutes,
  servicePillars,
} from '../src/data/seoArchitecture.js';
import { IV_SESSIONS, productsByCategory, slugify } from '../src/data/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dist = path.join(repoRoot, 'dist');
const indexPath = path.join(dist, 'index.html');
const TODAY = new Date().toISOString().slice(0, 10);

function removeFinderSuffixArtifacts(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory() && / \d+$/i.test(name)) {
      fs.rmSync(file, { recursive: true, force: true });
      continue;
    }
    if (stat.isDirectory()) {
      removeFinderSuffixArtifacts(file);
      continue;
    }
    if (/ \d+\.(html|xml)$/i.test(name)) fs.rmSync(file, { force: true });
  }
}

function ensureCanonicalRootHtml(baseName) {
  const canonical = path.join(dist, `${baseName}.html`);
  if (fs.existsSync(canonical)) return;
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fallback = fs.readdirSync(dist)
    .find((name) => new RegExp(`^${escaped} \\d+\\.html$`).test(name));
  if (fallback) fs.copyFileSync(path.join(dist, fallback), canonical);
}

removeFinderSuffixArtifacts(dist);
ensureCanonicalRootHtml('index');

if (!fs.existsSync(indexPath)) {
  console.error('[build-seo-html] dist/index.html missing');
  process.exit(1);
}

const indexTemplate = fs.readFileSync(indexPath, 'utf8');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripTags(value = '') {
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function routeUrl(routePath) {
  if (routePath === '/') return `${SEO_BASE_URL}/`;
  return `${SEO_BASE_URL}${routePath}`;
}

function ensureHeadTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, () => tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function dedupeRoutes(routes) {
  const seen = new Map();
  routes.forEach((route) => {
    if (!route?.path || seen.has(route.path)) return;
    seen.set(route.path, route);
  });
  return [...seen.values()];
}

function pageKeywords(page) {
  const parts = [
    page.h1,
    page.eyebrow,
    page.city,
    page.region,
    'Avalon Vitality',
    'Bay Area mobile IV therapy',
    'clinician-reviewed mobile recovery',
  ].filter(Boolean);
  return [...new Set(parts)].join(', ');
}

function breadcrumbJsonLd(page) {
  const bits = page.path.split('/').filter(Boolean);
  const items = [{ name: 'Home', item: `${SEO_BASE_URL}/` }];

  if (bits[0] === 'locations') items.push({ name: 'Locations', item: `${SEO_BASE_URL}/locations` });
  if (bits[0] === 'learn') items.push({ name: 'Learn', item: `${SEO_BASE_URL}/learn` });
  if (bits[0] === 'services') items.push({ name: 'Protocols', item: `${SEO_BASE_URL}/protocols` });
  if (bits[0] === 'launches') items.push({ name: 'Launches', item: `${SEO_BASE_URL}/launches` });
  if (bits[0] === 'events') items.push({ name: 'Launches', item: `${SEO_BASE_URL}/launches` });

  items.push({ name: page.h1 || page.title, item: routeUrl(page.path) });

  return {
    '@type': 'BreadcrumbList',
    '@id': `${routeUrl(page.path)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

function routeJsonLd(page, kind) {
  const graph = [
    {
      ...LOCAL_BUSINESS_PROFILE,
      url: `${SEO_BASE_URL}/`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SEO_BASE_URL}/#website`,
      name: 'Avalon Vitality',
      url: `${SEO_BASE_URL}/`,
      publisher: { '@id': `${SEO_BASE_URL}/#localbusiness` },
    },
    {
      '@type': 'WebPage',
      '@id': `${routeUrl(page.path)}#webpage`,
      url: routeUrl(page.path),
      name: page.h1 || page.title,
      description: page.description,
      isPartOf: { '@id': `${SEO_BASE_URL}/#website` },
      reviewedBy: {
        '@type': 'Person',
        name: MEDICAL_REVIEW.reviewerName,
        jobTitle: MEDICAL_REVIEW.reviewerTitle,
      },
      dateModified: MEDICAL_REVIEW.reviewedDate,
      lastReviewed: MEDICAL_REVIEW.reviewedDate,
    },
    breadcrumbJsonLd(page),
  ];

  if (kind === 'service' && !page.noindex) {
    graph.push({
      '@type': 'Service',
      '@id': `${routeUrl(page.path)}#service`,
      name: page.h1,
      description: page.description,
      serviceType: page.eyebrow || 'Mobile recovery service',
      provider: { '@id': `${SEO_BASE_URL}/#localbusiness` },
      areaServed: { '@type': 'AdministrativeArea', name: 'San Francisco Bay Area' },
    });
  }

  if (kind === 'location') {
    graph.push({
      '@type': 'Service',
      '@id': `${routeUrl(page.path)}#service`,
      name: page.h1,
      description: page.description,
      serviceType: 'Mobile IV therapy and recovery support',
      provider: { '@id': `${SEO_BASE_URL}/#localbusiness` },
      areaServed: { '@type': 'City', name: page.city },
    });
  }

  if (kind === 'article') {
    graph.push({
      '@type': 'Article',
      '@id': `${routeUrl(page.path)}#article`,
      headline: page.h1,
      description: page.description,
      url: routeUrl(page.path),
      author: { '@type': 'Organization', name: 'Avalon Vitality' },
      publisher: { '@id': `${SEO_BASE_URL}/#localbusiness` },
      reviewedBy: {
        '@type': 'Person',
        name: MEDICAL_REVIEW.reviewerName,
        jobTitle: MEDICAL_REVIEW.reviewerTitle,
      },
      datePublished: MEDICAL_REVIEW.reviewedDate,
      dateModified: MEDICAL_REVIEW.reviewedDate,
      mainEntityOfPage: `${routeUrl(page.path)}#webpage`,
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

function fallbackPoints(page) {
  if (Array.isArray(page.points)) return page.points;
  if (Array.isArray(page.services)) return page.services;
  if (Array.isArray(page.neighborhoods)) {
    return [
      `${page.city} mobile appointments are reviewed for location, timing, and eligibility.`,
      `Nearby areas include ${page.neighborhoods.slice(0, 5).join(', ')}.`,
      'Final service depends on clinical approval, staff coverage, and supplies.',
    ];
  }
  return [
    'Licensed Registered Nurse appointment execution',
    'Clinician-reviewed intake before service',
    'Final service subject to clinical approval',
  ];
}

function fallbackHtml(page) {
  const points = [...new Set([...fallbackPoints(page), ...CLINICAL_STANDARD])].slice(0, 9);
  return `
      <div id="seo-prerender" style="min-height:100vh;background-color:#2a2521;background-image:linear-gradient(90deg,rgba(42,37,33,.84),rgba(42,37,33,.52) 45%,rgba(42,37,33,.22)),url('/images/avalon-static-back-512.webp');background-size:cover;background-position:86% 52%;color:#f4f4f1;font-family:Inter,Arial,sans-serif;padding:48px 24px;">
        <main style="max-width:960px;margin:0 auto;">
          <p style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(244,244,241,.52);margin:0 0 18px;">Avalon Vitality</p>
          <h1 style="font-family:Arial,sans-serif;font-size:clamp(42px,10vw,96px);line-height:.9;text-transform:uppercase;margin:0 0 24px;">${escapeHtml(stripTags(page.h1 || page.title))}</h1>
          <p style="max-width:680px;font-size:18px;line-height:1.65;color:rgba(244,244,241,.68);margin:0 0 34px;">${escapeHtml(stripTags(page.intro || page.description))}</p>
          <section aria-label="Clinical review" style="border:1px solid rgba(244,244,241,.12);border-radius:20px;padding:22px;background:rgba(244,244,241,.035);margin:0 0 28px;">
            <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,244,241,.45);margin:0 0 10px;">Medical review</p>
            <p style="font-size:14px;line-height:1.6;color:rgba(244,244,241,.66);margin:0;">Reviewed by ${escapeHtml(MEDICAL_REVIEW.reviewerName)}, ${escapeHtml(MEDICAL_REVIEW.reviewerCredentials)} - ${escapeHtml(MEDICAL_REVIEW.reviewerTitle)}. Last reviewed ${escapeHtml(MEDICAL_REVIEW.reviewedLabel)}. Services require intake, consent, and clinical approval.</p>
          </section>
          <ul style="display:grid;gap:12px;margin:0;padding:0;list-style:none;">
            ${points.map((point) => `<li style="border:1px solid rgba(244,244,241,.10);border-radius:999px;padding:13px 16px;color:rgba(244,244,241,.62);font-size:13px;text-transform:uppercase;letter-spacing:.12em;">${escapeHtml(stripTags(point))}</li>`).join('')}
          </ul>
          <p style="max-width:760px;margin:34px 0 0;color:rgba(244,244,241,.45);font-size:13px;line-height:1.65;">General wellness education only. Avalon services are not emergency care and are not a substitute for medical advice, diagnosis, or treatment. Availability depends on eligibility, staffing, supplies, and operational coverage.</p>
        </main>
      </div>`;
}

function renderRouteHtml(page, kind = 'page') {
  const robots = page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const canonical = routeUrl(page.path);
  const title = page.title || `${page.h1} | Avalon Vitality`;
  const description = page.description || 'Avalon Vitality mobile recovery and IV therapy in the San Francisco Bay Area.';
  const jsonLd = JSON.stringify(routeJsonLd(page, kind));

  let html = indexTemplate;
  html = ensureHeadTag(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = ensureHeadTag(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = ensureHeadTag(html, /<meta name="keywords" content="[^"]*"\s*\/?>/, `<meta name="keywords" content="${escapeHtml(pageKeywords(page))}" />`);
  html = ensureHeadTag(html, /<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${robots}" />`);
  html = ensureHeadTag(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`);
  html = ensureHeadTag(html, /<meta property="og:type" content="[^"]*"\s*\/?>/, '<meta property="og:type" content="website" />');
  html = ensureHeadTag(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = ensureHeadTag(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = ensureHeadTag(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`);
  html = ensureHeadTag(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = ensureHeadTag(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => `<script id="static-jsonld" type="application/ld+json">${jsonLd}</script>`);
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${fallbackHtml(page)}\n    </div>`);
  html = makeCssNonBlocking(html);
  return html;
}

// Preload the main stylesheet at high priority so it lands fast, then apply it
// with a standard render-blocking <link>. We previously used the
// media="print" → onload="this.media='all'" swap to make the sheet non-blocking,
// but the production CSP (script-src without 'unsafe-hashes') blocks that inline
// event handler, so the sheet stayed media="print" and never applied — the whole
// site rendered unstyled. CSP hashes do not cover inline event handlers, so the
// only CSP-safe options are a plain stylesheet link or an external activation
// script. The prerendered critical inline styles already cover first paint, so a
// standard link costs little FCP and can't be defeated by CSP. Do NOT reintroduce
// an inline onload handler here.
function makeCssNonBlocking(html) {
  return html.replace(
    /<link rel="stylesheet"((?:\s+crossorigin)?)\s+href="(\/assets\/[^"]+\.css)"\s*\/?>/g,
    (_m, cross, href) =>
      `<link rel="preload" as="style"${cross} href="${href}">` +
      `<link rel="stylesheet"${cross} href="${href}">`,
  );
}

function writeRoute(page, kind) {
  if (page.path === '/b2b') return;
  const html = renderRouteHtml(page, kind);
  if (page.path === '/') {
    fs.writeFileSync(indexPath, html, 'utf8');
    return;
  }
  const routeDir = path.join(dist, page.path.replace(/^\//, ''));
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
}

function writeSitemap(routes) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url>\n    <loc>${routeUrl(route.path)}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${route.changefreq || 'monthly'}</changefreq>\n    <priority>${route.priority || '0.6'}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), xml, 'utf8');
}

const serviceRoutes = servicePillars.map((page) => ({
  ...page,
  priority: page.noindex ? '0.0' : '0.85',
  changefreq: 'weekly',
}));

const locationHub = {
  path: '/locations',
  title: 'Bay Area Mobile IV Therapy Locations | Avalon Vitality',
  description: 'Explore Avalon Vitality mobile recovery protocols, IV therapy, NAD+, recovery support, hotel service, launch service, and mobile appointment locations across the Bay Area.',
  h1: 'Mobile Recovery Across the Bay',
  priority: '0.75',
  changefreq: 'weekly',
};

const learnHub = {
  path: '/learn',
  title: 'Mobile IV Therapy Education | Avalon Vitality',
  description: 'Educational guides for mobile IV therapy, NAD+, recovery therapy, launch recovery, hotel service, and Bay Area location planning.',
  h1: 'Mobile Recovery Guides',
  priority: '0.75',
  changefreq: 'weekly',
};

const locationRoutes = locationPages.map((page) => ({ ...page, priority: '0.75', changefreq: 'weekly' }));
const articleRoutes = educationArticles.map((page) => ({
  ...page,
  priority: page.noindex ? '0.0' : '0.65',
  changefreq: 'monthly',
}));

const protocolRoutes = IV_SESSIONS.map((session) => ({
  path: `/therapies/${session.key}`,
  title: `${session.label} Protocol | Avalon Vitality`,
  description: `${session.label} mobile recovery protocol information from Avalon Vitality. Service is subject to intake, clinical review, eligibility, and location availability.`,
  h1: `${session.label} Protocol`,
  priority: session.key === 'cbd' ? '0.0' : '0.55',
  changefreq: 'monthly',
  noindex: session.key === 'cbd',
}));

const productRoutes = Object.entries(productsByCategory).flatMap(([categorySlug, category]) => (
  (category.treatments || []).map((treatment) => {
    const productSlug = slugify(treatment.name);
    return {
      path: `/products/${categorySlug}/${productSlug}`,
      title: `${treatment.name} | Avalon Vitality`,
      description: `${treatment.name} protocol details from Avalon Vitality. Final service is subject to clinical review, eligibility, and appointment availability.`,
      h1: treatment.name,
      priority: categorySlug === 'cbd' ? '0.35' : '0.5',
      changefreq: 'monthly',
    };
  })
));

const renderRoutes = dedupeRoutes([
  ...publicStaticRoutes,
  ...serviceRoutes,
  ...protocolRoutes,
  ...productRoutes,
  locationHub,
  ...locationRoutes,
  learnHub,
  ...articleRoutes,
  ...noindexStaticRoutes.map((page) => ({ ...page, noindex: true })),
]);

renderRoutes.forEach((route) => {
  let kind = 'page';
  if (servicePillars.some((page) => page.path === route.path)) kind = 'service';
  if (locationPages.some((page) => page.path === route.path)) kind = 'location';
  if (educationArticles.some((page) => page.path === route.path)) kind = 'article';
  writeRoute(route, kind);
});

writeSitemap(dedupeRoutes([
  ...publicStaticRoutes,
  ...indexedServicePillars.map((page) => ({ ...page, priority: '0.85', changefreq: 'weekly' })),
  ...protocolRoutes.filter((page) => !page.noindex),
  ...productRoutes.filter((page) => !page.noindex),
  locationHub,
  ...locationRoutes,
  learnHub,
  ...indexedEducationArticles.map((page) => ({ ...page, priority: '0.65', changefreq: 'monthly' })),
]));
ensureCanonicalRootHtml('index');
ensureCanonicalRootHtml('b2b');

console.log(`[build-seo-html] wrote ${renderRoutes.length} route HTML files and sitemap.xml`);
